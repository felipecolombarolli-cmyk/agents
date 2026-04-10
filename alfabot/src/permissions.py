"""
Camada de permissoes e bloqueio de queries.

Bloqueia consultas agregadas que poderiam:
- Retornar volumes enormes de dados
- Expor informacoes sensiveis (faturamento total, rankings)
- Sobrecarregar a API com queries pesadas

Uso:
    allowed, reason = check(intent, entities)
    if not allowed:
        print(f"Bloqueado: {reason}")
"""

import re

from .intent import Intent

# Termos que indicam queries agregadas/proibidas
_BLOCKED_TERMS = [
    re.compile(r"\btodos?\s+(?:os\s+)?clientes?\b", re.IGNORECASE),
    re.compile(r"\btodos?\s+(?:os\s+)?produtos?\b", re.IGNORECASE),
    re.compile(r"\btodos?\s+(?:os\s+)?pedidos?\b", re.IGNORECASE),
    re.compile(r"\branking\b", re.IGNORECASE),
    re.compile(r"\bfaturamento\s+(?:total|geral|mensal|anual)\b", re.IGNORECASE),
    re.compile(r"\brelat[oó]rio\s+(?:geral|completo)\b", re.IGNORECASE),
    re.compile(r"\blistar?\s+tudo\b", re.IGNORECASE),
    re.compile(r"\bexportar?\s+(?:todos?|tudo|geral)\b", re.IGNORECASE),
]

# Mensagens de erro para cada tipo de bloqueio
_BLOCK_REASON_AGGREGATE = (
    "Consultas agregadas nao sao permitidas. "
    "Por favor, especifique um produto ou cliente especifico.\n"
    "Exemplo: 'saldo do pasol 015' ou 'dados do cliente 100'"
)

_BLOCK_REASON_MISSING_PRODUCT = (
    "Nao consegui identificar o codigo do produto na sua pergunta.\n"
    "Tente: 'saldo do pasol 015' ou 'preco do produto XYZ-100'"
)

_BLOCK_REASON_MISSING_CLIENT = (
    "Nao consegui identificar o codigo do cliente na sua pergunta.\n"
    "Tente: 'dados do cliente 100' ou 'pedidos do cliente 250'"
)


def check(intent: Intent, entities: dict, original_text: str = "") -> tuple[bool, str]:
    """Verifica se a consulta e permitida.

    Args:
        intent: Intent classificado.
        entities: Entidades extraidas do texto.
        original_text: Texto original para verificar termos bloqueados.

    Returns:
        Tupla (permitido, motivo). Se permitido=True, motivo e string vazia.
    """
    # Verifica termos bloqueados no texto original
    for pattern in _BLOCKED_TERMS:
        if pattern.search(original_text):
            return False, _BLOCK_REASON_AGGREGATE

    # Intent desconhecido nao e bloqueado aqui (o bot trata)
    if intent == Intent.DESCONHECIDO:
        return True, ""

    # Verifica se entidades obrigatorias foram extraidas
    intents_produto = {Intent.SALDO, Intent.PRECO}
    intents_cliente = {Intent.DADOS_CLIENTE, Intent.HISTORICO_CLIENTE,
                       Intent.PEDIDOS_CLIENTE, Intent.CARTEIRA_CLIENTE}

    if intent in intents_produto:
        if not entities.get("codigo_produto"):
            return False, _BLOCK_REASON_MISSING_PRODUCT

    if intent in intents_cliente:
        if not entities.get("codigo_cliente"):
            return False, _BLOCK_REASON_MISSING_CLIENT

    return True, ""
