"""
Consultas de estoque e preco de produtos via API WK Radar.

Endpoints esperados (ajustar conforme documentacao real da API):
- GET /api/v1/estoque/saldo?codigo={codigo}
- GET /api/v1/estoque/preco?codigo={codigo}

IMPORTANTE: os endpoints abaixo sao exemplos baseados no padrao REST comum.
Valide os endpoints reais consultando a documentacao da API ou
inspecionando chamadas no navegador/Postman.
"""

import logging

from ..wk_radar_client import WKRadarClient, APIError

logger = logging.getLogger(__name__)

# ── Endpoints (ajustar conforme API real) ─────────────────────────
# Se a API usa paths diferentes, altere apenas estas constantes.
ENDPOINT_SALDO = "/api/v1/estoque/saldo"
ENDPOINT_PRECO = "/api/v1/estoque/preco"


def consultar_saldo(client: WKRadarClient, codigo_produto: str) -> str:
    """Consulta saldo/estoque de um produto.

    Args:
        client: Instancia do WKRadarClient.
        codigo_produto: Codigo do produto (ex: "PASOL 015").

    Returns:
        Texto formatado com o saldo do produto.
    """
    logger.info("Consultando saldo do produto: %s", codigo_produto)

    try:
        data = client.get(ENDPOINT_SALDO, params={"codigo": codigo_produto})
    except APIError as e:
        if e.status_code == 404:
            return f"Produto '{codigo_produto}' nao encontrado no sistema."
        if e.status_code == 400:
            return (
                f"Erro na consulta do produto '{codigo_produto}': requisicao invalida.\n"
                f"Detalhe: {e.detail}\n"
                f"Verifique se o codigo do produto esta correto."
            )
        return f"Erro ao consultar saldo: {e}"

    return _formatar_saldo(data, codigo_produto)


def consultar_preco(client: WKRadarClient, codigo_produto: str) -> str:
    """Consulta preco de um produto.

    Args:
        client: Instancia do WKRadarClient.
        codigo_produto: Codigo do produto (ex: "PASOL 015").

    Returns:
        Texto formatado com o preco do produto.
    """
    logger.info("Consultando preco do produto: %s", codigo_produto)

    try:
        data = client.get(ENDPOINT_PRECO, params={"codigo": codigo_produto})
    except APIError as e:
        if e.status_code == 404:
            return f"Produto '{codigo_produto}' nao encontrado no sistema."
        if e.status_code == 400:
            return (
                f"Erro na consulta de preco do produto '{codigo_produto}'.\n"
                f"Detalhe: {e.detail}\n"
                f"Verifique se o codigo do produto esta correto."
            )
        return f"Erro ao consultar preco: {e}"

    return _formatar_preco(data, codigo_produto)


# ── Formatacao ────────────────────────────────────────────────────

def _formatar_saldo(data: dict | list, codigo: str) -> str:
    """Formata resposta de saldo para exibicao.

    Adapte esta funcao ao formato real de resposta da API.
    Exemplo de resposta esperada:
    {
        "codigo": "PASOL 015",
        "descricao": "Parafuso Solitario 015mm",
        "saldo": 150.0,
        "unidade": "UN",
        "depositos": [
            {"deposito": "DEP01", "saldo": 100.0},
            {"deposito": "DEP02", "saldo": 50.0}
        ]
    }
    """
    if isinstance(data, list):
        if not data:
            return f"Nenhum resultado encontrado para '{codigo}'."
        # Se retorna lista, pega o primeiro item
        data = data[0]

    descricao = data.get("descricao", data.get("nome", codigo))
    saldo = data.get("saldo", data.get("quantidade", "N/A"))
    unidade = data.get("unidade", data.get("un", ""))

    lines = [
        f"Produto: {codigo} - {descricao}",
        f"Saldo: {saldo} {unidade}",
    ]

    # Se tem detalhamento por deposito
    depositos = data.get("depositos", data.get("estoques", []))
    if depositos:
        lines.append("")
        lines.append("Detalhamento por deposito:")
        for dep in depositos:
            nome_dep = dep.get("deposito", dep.get("nome", "?"))
            saldo_dep = dep.get("saldo", dep.get("quantidade", "?"))
            lines.append(f"  {nome_dep}: {saldo_dep} {unidade}")

    return "\n".join(lines)


def _formatar_preco(data: dict | list, codigo: str) -> str:
    """Formata resposta de preco para exibicao."""
    if isinstance(data, list):
        if not data:
            return f"Nenhum resultado encontrado para '{codigo}'."
        data = data[0]

    descricao = data.get("descricao", data.get("nome", codigo))
    preco = data.get("preco", data.get("valor", data.get("precoVenda", "N/A")))

    lines = [
        f"Produto: {codigo} - {descricao}",
        f"Preco: R$ {preco}",
    ]

    # Se tem tabelas de preco
    tabelas = data.get("tabelas", data.get("precos", []))
    if tabelas:
        lines.append("")
        lines.append("Tabelas de preco:")
        for tab in tabelas:
            nome_tab = tab.get("tabela", tab.get("nome", "?"))
            valor = tab.get("preco", tab.get("valor", "?"))
            lines.append(f"  {nome_tab}: R$ {valor}")

    return "\n".join(lines)
