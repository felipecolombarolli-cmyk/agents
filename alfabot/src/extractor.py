"""
Extrator de entidades do texto do usuario.

Extrai codigos de produto, codigos de cliente e outros parametros
a partir da pergunta em linguagem natural.

Estrategia em camadas (por prioridade):
1. Padroes explicitos com keyword ("codigo XYZ", "cod. 123")
2. Padroes especificos do dominio ("pasol 015", "PASOL-015")
3. Padroes genericos apos keyword ("produto ABC", "cliente 100")
4. Fallback: ultimo token numerico ou alfanumerico
"""

import re
import unicodedata


def _normalize(text: str) -> str:
    """Remove acentos e converte para minusculas."""
    nfkd = unicodedata.normalize("NFKD", text)
    without_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return without_accents.lower().strip()


def _clean_code(code: str) -> str:
    """Limpa e normaliza um codigo extraido."""
    code = code.strip().strip(".,;:!?")
    # Colapsa espacos multiplos em um so
    code = re.sub(r"\s+", " ", code)
    return code.upper()


# ── Extratores de Codigo de Produto ──────────────────────────────

# Padroes ordenados por especificidade (mais especifico primeiro)
_PRODUCT_PATTERNS = [
    # "codigo PASOL 015", "cod. ABC-123", "cod 12345"
    re.compile(r"(?:cod(?:igo)?\.?\s+)([A-Za-z0-9][\w\s\-\.]{0,30}\w)", re.IGNORECASE),
    # "pasol 015", "pasol-015", "pasol015", "PASOL 15"
    re.compile(r"\b(pasol[\s\-]?\d+)\b", re.IGNORECASE),
    # "produto XYZ-100", "item ABC 200", "material M-500"
    re.compile(r"(?:produto|item|material|peca|peça)\s+([A-Za-z0-9][\w\s\-\.]{0,30}\w)", re.IGNORECASE),
]

# Keywords que indicam que o proximo token e o codigo do produto
_PRODUCT_KEYWORDS = {"saldo", "preco", "preço", "estoque", "produto", "item", "material"}

# Preposicoes e artigos para ignorar entre keyword e codigo
_STOPWORDS = {"do", "da", "de", "dos", "das", "o", "a", "os", "as", "no", "na", "nos", "nas", "um", "uma", "para"}


def extract_product_code(text: str) -> str | None:
    """Extrai codigo de produto do texto.

    Exemplos:
        "saldo do pasol 015"     -> "PASOL 015"
        "preco do produto X-100" -> "X-100"
        "estoque pasol015"       -> "PASOL015"
        "saldo do codigo 12345"  -> "12345"
        "quanto tem de pasol 15" -> "PASOL 15"

    Returns:
        Codigo normalizado (uppercase, sem espacos extras) ou None.
    """
    # Camada 1: padroes regex especificos
    for pattern in _PRODUCT_PATTERNS:
        match = pattern.search(text)
        if match:
            return _clean_code(match.group(1))

    # Camada 2: fallback baseado em posicao
    # Encontra keyword de produto e pega tudo depois (removendo stopwords iniciais)
    normalized = _normalize(text)
    words = normalized.split()

    for i, word in enumerate(words):
        if word in _PRODUCT_KEYWORDS:
            # Pega palavras restantes apos a keyword, pulando stopwords
            remaining = words[i + 1:]
            while remaining and remaining[0] in _STOPWORDS:
                remaining.pop(0)
            if remaining:
                code = " ".join(remaining)
                return _clean_code(code)

    # Camada 3: ultimo token que parece codigo (alfanumerico com digitos)
    tokens = text.split()
    for token in reversed(tokens):
        cleaned = token.strip(".,;:!?")
        if re.match(r"^[A-Za-z]*\d+[\w\-]*$", cleaned):
            return _clean_code(cleaned)

    return None


# ── Extratores de Codigo de Cliente ──────────────────────────────

_CLIENT_PATTERNS = [
    # "cliente 100", "cliente nr 100", "cliente numero 100"
    re.compile(r"cliente\s+(?:(?:nr|n[uú]mero|cod(?:igo)?\.?)\s+)?(\d+)", re.IGNORECASE),
    # "do cliente 100" (captura em contextos como "pedidos do cliente 100")
    re.compile(r"(?:do|da|para\s+o?)\s+cliente\s+(\d+)", re.IGNORECASE),
]


def extract_client_code(text: str) -> str | None:
    """Extrai codigo de cliente do texto.

    Exemplos:
        "dados do cliente 100"       -> "100"
        "historico do cliente 250"   -> "250"
        "pedidos do cliente nr 100"  -> "100"

    Returns:
        Codigo do cliente ou None.
    """
    for pattern in _CLIENT_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1).strip()

    # Fallback: se tem "cliente" no texto, pega o proximo numero
    normalized = _normalize(text)
    if "cliente" in normalized:
        numbers = re.findall(r"\d+", text)
        if numbers:
            return numbers[0]

    return None


# ── Interface Unificada ──────────────────────────────────────────

def extract(text: str, intent_name: str) -> dict[str, str | None]:
    """Extrai todas as entidades relevantes para o intent dado.

    Args:
        text: Texto original do usuario.
        intent_name: Nome do intent (ex: "saldo", "dados_cliente").

    Returns:
        Dict com entidades extraidas. Chaves dependem do intent:
        - saldo/preco: {"codigo_produto": ...}
        - dados_cliente/historico_cliente/pedidos_cliente/carteira_cliente: {"codigo_cliente": ...}
    """
    intents_produto = {"saldo", "preco"}
    intents_cliente = {"dados_cliente", "historico_cliente", "pedidos_cliente", "carteira_cliente"}

    entities: dict[str, str | None] = {}

    if intent_name in intents_produto:
        entities["codigo_produto"] = extract_product_code(text)
    elif intent_name in intents_cliente:
        entities["codigo_cliente"] = extract_client_code(text)
    else:
        # Tenta extrair ambos
        entities["codigo_produto"] = extract_product_code(text)
        entities["codigo_cliente"] = extract_client_code(text)

    return entities
