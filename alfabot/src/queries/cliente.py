"""
Consultas de dados e historico de clientes via API WK Radar.

Endpoints esperados (ajustar conforme documentacao real da API):
- GET /api/v1/clientes/{codigo}
- GET /api/v1/clientes/{codigo}/historico
"""

import logging

from ..wk_radar_client import WKRadarClient, APIError

logger = logging.getLogger(__name__)

ENDPOINT_CLIENTE = "/api/v1/clientes"


def consultar_dados(client: WKRadarClient, codigo_cliente: str) -> str:
    """Consulta dados cadastrais de um cliente.

    Args:
        client: Instancia do WKRadarClient.
        codigo_cliente: Codigo do cliente (ex: "100").

    Returns:
        Texto formatado com dados do cliente.
    """
    logger.info("Consultando dados do cliente: %s", codigo_cliente)

    try:
        data = client.get(f"{ENDPOINT_CLIENTE}/{codigo_cliente}")
    except APIError as e:
        if e.status_code == 404:
            return f"Cliente {codigo_cliente} nao encontrado no sistema."
        if e.status_code == 400:
            return (
                f"Erro na consulta do cliente {codigo_cliente}.\n"
                f"Detalhe: {e.detail}\n"
                f"Verifique se o codigo do cliente esta correto."
            )
        return f"Erro ao consultar cliente: {e}"

    return _formatar_dados(data, codigo_cliente)


def consultar_historico(client: WKRadarClient, codigo_cliente: str) -> str:
    """Consulta historico de pedidos de um cliente.

    Args:
        client: Instancia do WKRadarClient.
        codigo_cliente: Codigo do cliente (ex: "100").

    Returns:
        Texto formatado com historico do cliente.
    """
    logger.info("Consultando historico do cliente: %s", codigo_cliente)

    try:
        data = client.get(
            f"{ENDPOINT_CLIENTE}/{codigo_cliente}/historico",
            use_cache=False,  # Historico pode mudar
        )
    except APIError as e:
        if e.status_code == 404:
            return f"Nenhum historico encontrado para o cliente {codigo_cliente}."
        if e.status_code == 400:
            return (
                f"Erro na consulta de historico do cliente {codigo_cliente}.\n"
                f"Detalhe: {e.detail}"
            )
        return f"Erro ao consultar historico: {e}"

    return _formatar_historico(data, codigo_cliente)


# ── Formatacao ────────────────────────────────────────────────────

def _formatar_dados(data: dict | list, codigo: str) -> str:
    """Formata dados cadastrais do cliente.

    Adapte ao formato real da API. Exemplo esperado:
    {
        "codigo": "100",
        "razaoSocial": "Empresa XYZ Ltda",
        "nomeFantasia": "XYZ",
        "cnpj": "12.345.678/0001-00",
        "endereco": "Rua ABC, 123",
        "cidade": "Curitiba",
        "uf": "PR",
        "telefone": "(41) 3333-4444",
        "email": "contato@xyz.com"
    }
    """
    if isinstance(data, list):
        if not data:
            return f"Cliente {codigo} nao encontrado."
        data = data[0]

    # Mapeia campos comuns (a API pode usar nomes diferentes)
    campos = [
        ("Codigo", ["codigo", "codigoCliente", "id"]),
        ("Razao Social", ["razaoSocial", "razao_social", "nome"]),
        ("Nome Fantasia", ["nomeFantasia", "nome_fantasia", "fantasia"]),
        ("CNPJ/CPF", ["cnpj", "cpf", "cnpjCpf", "documento"]),
        ("Endereco", ["endereco", "logradouro", "rua"]),
        ("Cidade", ["cidade", "municipio"]),
        ("UF", ["uf", "estado"]),
        ("Telefone", ["telefone", "fone", "tel"]),
        ("Email", ["email", "e-mail", "emailContato"]),
    ]

    lines = [f"Dados do cliente {codigo}:"]
    lines.append("-" * 50)

    for label, keys in campos:
        for key in keys:
            value = data.get(key)
            if value:
                lines.append(f"  {label}: {value}")
                break

    return "\n".join(lines)


def _formatar_historico(data: dict | list, codigo: str) -> str:
    """Formata historico de pedidos do cliente."""
    registros = data if isinstance(data, list) else data.get("historico", data.get("pedidos", []))

    if not registros:
        return f"Nenhum historico encontrado para o cliente {codigo}."

    lines = [f"Historico do cliente {codigo} ({len(registros)} registros):"]
    lines.append("-" * 50)

    for r in registros[:30]:  # Limita a 30 registros
        numero = r.get("numero", r.get("numeroPedido", "?"))
        data_reg = r.get("data", r.get("dataEmissao", "?"))
        valor = r.get("valor", r.get("valorTotal", "?"))
        tipo = r.get("tipo", r.get("tipoDocumento", ""))

        line = f"  {data_reg} | {tipo} {numero} | R$ {valor}"
        lines.append(line.rstrip())

    if len(registros) > 30:
        lines.append(f"  ... e mais {len(registros) - 30} registros")

    return "\n".join(lines)
