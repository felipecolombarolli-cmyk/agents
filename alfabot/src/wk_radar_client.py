"""
Cliente HTTP para a API do WK Radar.

Responsabilidades:
- Autenticacao com cache de token Bearer
- Renovacao automatica quando o token expira
- Retry com backoff exponencial em caso de timeout/erro de conexao
- Cache de respostas com TTL configuravel
- Logging detalhado para debug de erros 400/401/500
"""

import hashlib
import json
import logging
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

BASE_URL = "https://wkradar.alfatecbr.com.br/wk.api"
AUTH_PAYLOAD = {
    "empresa": "alfatec",
    "nomeUsuario": "api",
    "senha": "@alfa2020",
}
CONNECT_TIMEOUT = 10  # segundos para estabelecer conexao
READ_TIMEOUT = 120    # segundos para ler resposta
CACHE_TTL = 300       # 5 minutos


class TokenError(Exception):
    """Falha ao obter ou renovar token."""


class APIError(Exception):
    """Erro retornado pela API do WK Radar."""

    def __init__(self, status_code: int, detail: str, url: str = ""):
        self.status_code = status_code
        self.detail = detail
        self.url = url
        super().__init__(f"HTTP {status_code} em {url}: {detail}")


class WKRadarClient:
    """Cliente singleton para a API do WK Radar.

    Uso:
        client = WKRadarClient()
        dados = client.get("/api/v1/estoque/saldo", params={"codigo": "PASOL 015"})
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        self._session = requests.Session()
        # Servidor WK Radar usa certificado auto-assinado
        self._session.verify = False
        # Suprime warning de InsecureRequestWarning
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        # Retry automatico para erros de conexao e 502/503/504
        retry_strategy = Retry(
            total=3,
            backoff_factor=2,  # 2s, 4s, 8s
            status_forcelist=[502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self._session.mount("https://", adapter)
        self._session.mount("http://", adapter)

        self._token: str | None = None
        self._token_expires_at: float = 0
        self._cache: dict[str, tuple[float, object]] = {}

    # ── Autenticacao ──────────────────────────────────────────────

    def _authenticate(self) -> None:
        """Obtem novo token Bearer via POST /api/v1/token."""
        url = f"{BASE_URL}/api/v1/token"
        logger.info("Autenticando em %s", url)

        try:
            resp = self._session.post(
                url,
                json=AUTH_PAYLOAD,
                timeout=(CONNECT_TIMEOUT, 30),
            )
        except requests.RequestException as exc:
            logger.error("Falha na autenticacao: %s", exc)
            raise TokenError(f"Nao foi possivel autenticar: {exc}") from exc

        if resp.status_code != 200:
            logger.error("Auth retornou %d: %s", resp.status_code, resp.text)
            raise TokenError(
                f"Autenticacao falhou (HTTP {resp.status_code}): {resp.text}"
            )

        data = resp.json()
        self._token = data["accessToken"]
        expires_in = data.get("expiresIn", 3600)
        # Renovar 60s antes de expirar para evitar race condition
        self._token_expires_at = time.time() + expires_in - 60
        logger.info("Token obtido, expira em %ds", expires_in)

    def _ensure_token(self) -> None:
        """Garante que temos um token valido."""
        if self._token is None or time.time() >= self._token_expires_at:
            self._authenticate()

    def _auth_headers(self) -> dict[str, str]:
        """Retorna headers com Authorization."""
        self._ensure_token()
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    # ── Cache ─────────────────────────────────────────────────────

    @staticmethod
    def _cache_key(method: str, endpoint: str, params: dict | None, body: dict | None) -> str:
        raw = json.dumps({"m": method, "e": endpoint, "p": params, "b": body}, sort_keys=True)
        return hashlib.md5(raw.encode()).hexdigest()

    def _get_cached(self, key: str) -> object | None:
        if key in self._cache:
            ts, data = self._cache[key]
            if time.time() - ts < CACHE_TTL:
                logger.debug("Cache hit: %s", key)
                return data
            del self._cache[key]
        return None

    def _set_cache(self, key: str, data: object) -> None:
        self._cache[key] = (time.time(), data)

    def clear_cache(self) -> None:
        """Limpa todo o cache."""
        self._cache.clear()

    # ── Requests ──────────────────────────────────────────────────

    def _request(
        self,
        method: str,
        endpoint: str,
        params: dict | None = None,
        json_body: dict | None = None,
        use_cache: bool = True,
    ) -> dict | list:
        """Executa request autenticado com retry em 401."""
        if use_cache:
            cache_key = self._cache_key(method, endpoint, params, json_body)
            cached = self._get_cached(cache_key)
            if cached is not None:
                return cached

        url = f"{BASE_URL}{endpoint}"
        logger.info("%s %s params=%s body=%s", method, url, params, json_body)

        for attempt in range(2):  # 1 tentativa + 1 retry apos renovar token
            headers = self._auth_headers()
            try:
                resp = self._session.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json_body,
                    timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
                )
            except requests.Timeout:
                logger.error("Timeout em %s %s (tentativa %d)", method, url, attempt + 1)
                raise APIError(0, "Timeout na conexao com o servidor", url)
            except requests.ConnectionError as exc:
                logger.error("Erro de conexao: %s", exc)
                raise APIError(0, f"Erro de conexao: {exc}", url)

            # Token expirado -> renova e tenta novamente
            if resp.status_code == 401 and attempt == 0:
                logger.warning("Token expirado, renovando...")
                self._token = None
                continue

            if resp.status_code >= 400:
                detail = resp.text[:500]
                logger.error(
                    "Erro HTTP %d em %s %s\nParams: %s\nBody: %s\nResponse: %s",
                    resp.status_code, method, url, params, json_body, detail,
                )
                raise APIError(resp.status_code, detail, url)

            data = resp.json()
            if use_cache:
                self._set_cache(cache_key, data)
            return data

        raise APIError(401, "Falha na autenticacao apos renovar token", url)

    def get(self, endpoint: str, params: dict | None = None, use_cache: bool = True) -> dict | list:
        """GET autenticado."""
        return self._request("GET", endpoint, params=params, use_cache=use_cache)

    def post(self, endpoint: str, body: dict | None = None, use_cache: bool = False) -> dict | list:
        """POST autenticado."""
        return self._request("POST", endpoint, json_body=body, use_cache=use_cache)
