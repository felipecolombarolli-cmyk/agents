"""
Sistema de matching de intencoes (intents).

Mapeia texto em linguagem natural para um Intent enum usando
padroes regex ordenados por prioridade.

Regras:
- Padroes mais especificos tem prioridade sobre genericos
- Matching e case-insensitive e ignora acentos
- Se nenhum padrao bate, retorna Intent.DESCONHECIDO
"""

import re
import unicodedata
from enum import Enum


class Intent(Enum):
    SALDO = "saldo"
    PRECO = "preco"
    DADOS_CLIENTE = "dados_cliente"
    HISTORICO_CLIENTE = "historico_cliente"
    PEDIDOS_CLIENTE = "pedidos_cliente"
    CARTEIRA_CLIENTE = "carteira_cliente"
    DESCONHECIDO = "desconhecido"


def _normalize(text: str) -> str:
    """Remove acentos e converte para minusculas."""
    nfkd = unicodedata.normalize("NFKD", text)
    without_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return without_accents.lower().strip()


# Padroes de intencao, ordenados por especificidade.
# Cada entrada: (Intent, [lista de regex patterns])
# Os padroes mais especificos (com mais palavras) vem primeiro para evitar
# que um padrao generico "roube" o match.
_INTENT_RULES: list[tuple[Intent, list[re.Pattern]]] = [
    # ── Cliente (mais especificos primeiro) ─────────────────────
    (Intent.HISTORICO_CLIENTE, [
        re.compile(r"\bhistorico\s+(?:do\s+)?cliente\b"),
        re.compile(r"\bhistorico\s+(?:de\s+)?(?:pedidos?\s+)?(?:do\s+)?cliente\b"),
        re.compile(r"\bcliente\b.*\bhistorico\b"),
    ]),
    (Intent.CARTEIRA_CLIENTE, [
        re.compile(r"\bcarteira\s+(?:do\s+)?cliente\b"),
        re.compile(r"\bcliente\b.*\bcarteira\b"),
        re.compile(r"\bpedidos?\s+(?:em\s+)?carteira\s+(?:do\s+)?cliente\b"),
    ]),
    (Intent.PEDIDOS_CLIENTE, [
        re.compile(r"\bpedidos?\s+(?:do\s+)?cliente\b"),
        re.compile(r"\bcliente\b.*\bpedidos?\b"),
        re.compile(r"\blista(?:r)?\s+pedidos?\s+(?:do\s+)?cliente\b"),
    ]),
    (Intent.DADOS_CLIENTE, [
        re.compile(r"\bdados?\s+(?:do\s+)?cliente\b"),
        re.compile(r"\bcliente\s+\d+\b"),  # "cliente 100" sem contexto = dados
        re.compile(r"\binformac(?:ao|oes)\s+(?:do\s+)?cliente\b"),
        re.compile(r"\bcadastro\s+(?:do\s+)?cliente\b"),
    ]),

    # ── Estoque / Produto ──────────────────────────────────────
    (Intent.SALDO, [
        re.compile(r"\bsaldo\b"),
        re.compile(r"\bestoque\b"),
        re.compile(r"\bquantidade\b.*\b(?:produto|pasol|item|material)\b"),
        re.compile(r"\bquanto\s+tem\b"),
        re.compile(r"\bquantas?\s+(?:unidades?|pecas?)\b"),
        re.compile(r"\bdisponivel\b.*\b(?:produto|pasol|item)\b"),
    ]),
    (Intent.PRECO, [
        re.compile(r"\bpreco\b"),
        re.compile(r"\bvalor\b.*\b(?:produto|pasol|item|material)\b"),
        re.compile(r"\bcusto\b"),
        re.compile(r"\bquanto\s+custa\b"),
        re.compile(r"\bvalor\s+(?:do\s+)?(?:produto|item)\b"),
    ]),
]


def match(text: str) -> Intent:
    """Identifica a intencao do usuario a partir do texto.

    Args:
        text: Texto em linguagem natural.

    Returns:
        Intent correspondente, ou Intent.DESCONHECIDO.

    Exemplos:
        >>> match("saldo do pasol 015")
        Intent.SALDO
        >>> match("dados do cliente 100")
        Intent.DADOS_CLIENTE
        >>> match("pedidos do cliente 250")
        Intent.PEDIDOS_CLIENTE
        >>> match("oi, bom dia")
        Intent.DESCONHECIDO
    """
    normalized = _normalize(text)

    for intent, patterns in _INTENT_RULES:
        for pattern in patterns:
            if pattern.search(normalized):
                return intent

    return Intent.DESCONHECIDO


def describe(intent: Intent) -> str:
    """Retorna descricao legivel do intent."""
    descriptions = {
        Intent.SALDO: "Consulta de saldo/estoque de produto",
        Intent.PRECO: "Consulta de preco de produto",
        Intent.DADOS_CLIENTE: "Dados cadastrais do cliente",
        Intent.HISTORICO_CLIENTE: "Historico de pedidos do cliente",
        Intent.PEDIDOS_CLIENTE: "Lista de pedidos do cliente",
        Intent.CARTEIRA_CLIENTE: "Pedidos em carteira do cliente",
        Intent.DESCONHECIDO: "Consulta nao reconhecida",
    }
    return descriptions.get(intent, "Desconhecido")
