# ALFABOT - Redesign Completo

## Visao Geral

Chatbot desktop (Python + PySide6) que recebe perguntas em linguagem natural e
consulta a API do WK Radar (ERP da Alfatec) para retornar dados de estoque,
clientes e pedidos.

---

## 1. Arquitetura de Arquivos

```
alfabot/
├── REDESIGN.md              # Este documento
├── requirements.txt         # Dependencias
└── src/
    ├── __init__.py
    ├── main.py              # GUI PySide6 - janela, input, historico
    ├── bot.py               # Orquestrador: intent -> permission -> query -> resposta
    ├── intent.py            # Matcher de intencoes (o que o usuario quer?)
    ├── extractor.py         # Extrai entidades do texto (codigo, nome, numero)
    ├── permissions.py       # Bloqueia queries agregadas/perigosas
    ├── wk_radar_client.py   # Cliente HTTP com cache de token Bearer
    ├── worker.py            # QThread para chamadas nao bloqueantes
    └── queries/
        ├── __init__.py
        ├── estoque.py       # Saldo, preco de produtos
        ├── comercial.py     # Pedidos, carteira, acompanhamento
        └── cliente.py       # Dados e historico de clientes
```

### Responsabilidade de cada arquivo

| Arquivo | Responsabilidade |
|---------|-----------------|
| `main.py` | Janela PySide6: campo de input, area de historico, botoes copiar/exportar. **Nunca** faz HTTP diretamente. |
| `bot.py` | Recebe texto do usuario, chama `intent.py` para classificar, `extractor.py` para entidades, `permissions.py` para validar, e o modulo de query correto para executar. Retorna string formatada. |
| `intent.py` | Mapeia texto para um enum `Intent` (SALDO, PRECO, DADOS_CLIENTE, HISTORICO_CLIENTE, PEDIDOS_CLIENTE, CARTEIRA_CLIENTE, DESCONHECIDO). Usa lista de padroes regex ordenados por prioridade. |
| `extractor.py` | Extrai codigo de produto (ex: "pasol 015"), codigo de cliente (ex: "100"), e outros parametros do texto. Estrategia: primeiro tenta regex especificos, depois fallback por posicao. |
| `permissions.py` | Valida se a query e permitida. Bloqueia termos como "todos", "ranking", "faturamento total". Retorna `(permitido: bool, motivo: str)`. |
| `wk_radar_client.py` | Singleton HTTP client. Gerencia token Bearer com cache e renovacao automatica. Todos os requests passam por aqui. Retry com backoff exponencial. |
| `worker.py` | `QThread` que executa `bot.process()` fora da thread principal. Emite signals `finished(str)` e `error(str)` para a GUI. |
| `queries/estoque.py` | Monta e executa requests para endpoints de estoque/saldo/preco. |
| `queries/comercial.py` | Monta e executa requests para endpoints de pedidos/carteira. |
| `queries/cliente.py` | Monta e executa requests para endpoints de dados/historico de clientes. |

---

## 2. Fluxo Principal

```
Usuario digita "saldo do pasol 015"
         |
         v
    main.py (GUI)
    - Desabilita input
    - Cria QueryWorker(texto)
    - Worker roda em QThread
         |
         v
    bot.py :: process(texto)
    1. intent = Intent.match(texto)        -> Intent.SALDO
    2. entities = Extractor.extract(texto, intent)  -> {"codigo_produto": "pasol 015"}
    3. Permissions.check(intent, entities)  -> (True, "")
    4. resultado = estoque.consultar_saldo(client, entities)
    5. return formatar_resposta(resultado)
         |
         v
    Worker emite signal finished(resposta)
         |
         v
    main.py recebe signal
    - Exibe resposta no historico
    - Reabilita input
```

---

## 3. Resolucao dos Problemas Atuais

### 3.1 Travamento da UI (CRITICO)

**Causa**: chamadas HTTP bloqueantes na thread principal do Qt.

**Solucao**: `QThread` + signals.

```python
# worker.py
from PySide6.QtCore import QThread, Signal

class QueryWorker(QThread):
    finished = Signal(str)
    error = Signal(str)

    def __init__(self, bot, texto):
        super().__init__()
        self.bot = bot
        self.texto = texto

    def run(self):
        try:
            resultado = self.bot.process(self.texto)
            self.finished.emit(resultado)
        except Exception as e:
            self.error.emit(str(e))
```

**Regra**: a GUI so faz `worker.start()`. Nunca chama `bot.process()` diretamente.

### 3.2 Extracao de Codigo Quebrada (CRITICO)

**Causa**: regex muito rigido, nao captura padroes como "pasol 015" ou "PASOL-015".

**Solucao**: extrator em camadas com normalizacao.

```python
# Padroes de codigo de produto (ordem de prioridade):
# 1. Codigo explicito: "codigo 12345", "cod. ABC-123"
# 2. Padrao PASOL/produto: "pasol 015", "pasol-015", "PASOL 15"
# 3. Codigo alfanumerico apos keyword: "produto XYZ-100"
# 4. Ultimo token alfanumerico da frase (fallback)

PRODUCT_PATTERNS = [
    r'(?:cod(?:igo)?\.?\s*)([A-Za-z0-9][\w\s\-\.]{0,30})',
    r'(pasol[\s\-]?\d+)',
    r'(?:produto|item|material)\s+([A-Za-z0-9][\w\s\-\.]{1,30})',
]
```

**Normalizacao**: `"pasol 015"` -> `"PASOL 015"` (manter espaco, uppercase).

### 3.3 Timeouts e Erros HTTP

**Solucao**:
- Timeout de conexao: 10s / Timeout de leitura: 120s
- Retry: 3 tentativas com backoff exponencial (2s, 4s, 8s)
- Renovacao automatica do token quando expirado (HTTP 401)
- Log detalhado de request/response para debug

### 3.4 Erros 400 (Bad Request)

**Estrategia de debug**:
1. Logar URL completa, headers e body de cada request
2. Logar response.text completo em caso de erro
3. Validar parametros antes de enviar (codigo nao vazio, formato esperado)
4. Retornar mensagem amigavel: "Erro na consulta: [detalhe da API]"

---

## 4. Detalhes de Implementacao

### 4.1 Cliente HTTP (`wk_radar_client.py`)

```python
class WKRadarClient:
    BASE_URL = "https://wkradar.alfatecbr.com.br/wk.api"

    def __init__(self):
        self._session = requests.Session()
        self._token = None
        self._token_expires_at = 0

    def _authenticate(self):
        resp = self._session.post(f"{self.BASE_URL}/api/v1/token", json={...})
        data = resp.json()
        self._token = data["accessToken"]
        self._token_expires_at = time.time() + data["expiresIn"] - 60  # margem

    def _ensure_token(self):
        if time.time() >= self._token_expires_at:
            self._authenticate()

    def get(self, endpoint, params=None):
        self._ensure_token()
        # ... com retry e tratamento de erro
```

### 4.2 Matcher de Intencoes (`intent.py`)

```python
class Intent(Enum):
    SALDO = "saldo"
    PRECO = "preco"
    DADOS_CLIENTE = "dados_cliente"
    HISTORICO_CLIENTE = "historico_cliente"
    PEDIDOS_CLIENTE = "pedidos_cliente"
    CARTEIRA_CLIENTE = "carteira_cliente"
    DESCONHECIDO = "desconhecido"

# Cada intent tem lista de padroes regex
INTENT_PATTERNS = {
    Intent.SALDO: [r'\bsaldo\b', r'\bestoque\b', r'\bquantidade\b'],
    Intent.PRECO: [r'\bpre[cç]o\b', r'\bvalor\b', r'\bcusto\b'],
    Intent.DADOS_CLIENTE: [r'\bdados?\s+(?:do\s+)?cliente\b'],
    Intent.HISTORICO_CLIENTE: [r'\bhist[oó]rico\s+(?:do\s+)?cliente\b'],
    Intent.PEDIDOS_CLIENTE: [r'\bpedidos?\s+(?:do\s+)?cliente\b'],
    Intent.CARTEIRA_CLIENTE: [r'\bcarteira\s+(?:do\s+)?cliente\b'],
}
```

### 4.3 Pipeline do Bot

```
texto -> normalize -> match_intent -> extract_entities -> check_permissions -> execute_query -> format_response
```

Cada etapa e uma funcao pura (exceto execute_query que faz I/O).
Se qualquer etapa falha, retorna mensagem de erro clara.

---

## 5. Estrategia de Cache

```python
# Cache simples com TTL no WKRadarClient
_cache = {}  # chave: (endpoint, params_hash) -> (timestamp, data)
CACHE_TTL = 300  # 5 minutos

def _get_cached(self, key):
    if key in self._cache:
        ts, data = self._cache[key]
        if time.time() - ts < self.CACHE_TTL:
            return data
    return None
```

**O que cachear**: consultas de saldo, dados de cliente (mudam pouco).
**O que NAO cachear**: pedidos em carteira, historico recente.

---

## 6. Decisoes de Design

| Decisao | Escolha | Motivo |
|---------|---------|--------|
| Threading | QThread (nao asyncio) | PySide6 ja tem QThread, evita complexidade de event loop duplo |
| HTTP | requests.Session | Reutiliza conexao TCP, simples, sincrono (roda na QThread) |
| Pattern matching | Regex com prioridade | Simples, debugavel, sem dependencia de ML |
| Cache | Dict in-memory com TTL | Sem dependencia externa, suficiente para app desktop |
| Singleton client | Instancia unica | Evita criar multiplas sessoes/tokens |

---

## 7. Checklist de Implementacao

- [ ] Criar `wk_radar_client.py` com auth, retry, cache, logging
- [ ] Criar `extractor.py` com padroes em camadas
- [ ] Criar `intent.py` com enum e regex patterns
- [ ] Criar `permissions.py` com lista de bloqueios
- [ ] Criar `queries/estoque.py` - saldo e preco
- [ ] Criar `queries/comercial.py` - pedidos e carteira
- [ ] Criar `queries/cliente.py` - dados e historico
- [ ] Criar `worker.py` com QThread
- [ ] Criar `bot.py` orquestrando tudo
- [ ] Criar `main.py` com GUI PySide6
- [ ] Testar fluxo completo: digitar pergunta -> receber resposta
- [ ] Testar com perguntas ambiguas e edge cases
- [ ] Validar que UI nao trava durante consultas
