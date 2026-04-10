"""
Consultas comerciais (pedidos, carteira) via API WK Radar.

Endpoints esperados (ajustar conforme documentacao real da API):
- GET /api/v1/pedidos?codigoCliente={codigo}
- GET /api/v1/pedidos/carteira?codigoCliente={codigo}
"""

import logging

from ..wk_radar_client import WKRadarClient, APIError

logger = logging.getLogger(__name__)

ENDPOINT_PEDIDOS = "/api/v1/pedidos"
ENDPOINT_CARTEIRA = "/api/v1/pedidos/carteira"


def consultar_pedidos(client: WKRadarClient, codigo_cliente: str) -> str:
    """Lista pedidos de um cliente.

    Args:
        client: Instancia do WKRadarClient.
        codigo_cliente: Codigo do cliente (ex: "100").

    Returns:
        Texto formatado com a lista de pedidos.
    """
    logger.info("Consultando pedidos do cliente: %s", codigo_cliente)

    try:
        data = client.get(ENDPOINT_PEDIDOS, params={"codigoCliente": codigo_cliente})
    except APIError as e:
        if e.status_code == 404:
            return f"Nenhum pedido encontrado para o cliente {codigo_cliente}."
        if e.status_code == 400:
            return (
                f"Erro na consulta de pedidos do cliente {codigo_cliente}.\n"
                f"Detalhe: {e.detail}\n"
                f"Verifique se o codigo do cliente esta correto."
            )
        return f"Erro ao consultar pedidos: {e}"

    return _formatar_pedidos(data, codigo_cliente)


def consultar_carteira(client: WKRadarClient, codigo_cliente: str) -> str:
    """Lista pedidos em carteira de um cliente.

    Args:
        client: Instancia do WKRadarClient.
        codigo_cliente: Codigo do cliente (ex: "100").

    Returns:
        Texto formatado com pedidos em carteira.
    """
    logger.info("Consultando carteira do cliente: %s", codigo_cliente)

    try:
        data = client.get(
            ENDPOINT_CARTEIRA,
            params={"codigoCliente": codigo_cliente},
            use_cache=False,  # Carteira muda frequentemente
        )
    except APIError as e:
        if e.status_code == 404:
            return f"Nenhum pedido em carteira para o cliente {codigo_cliente}."
        if e.status_code == 400:
            return (
                f"Erro na consulta de carteira do cliente {codigo_cliente}.\n"
                f"Detalhe: {e.detail}"
            )
        return f"Erro ao consultar carteira: {e}"

    return _formatar_carteira(data, codigo_cliente)


# ── Formatacao ────────────────────────────────────────────────────

def _formatar_pedidos(data: dict | list, codigo_cliente: str) -> str:
    """Formata lista de pedidos para exibicao."""
    pedidos = data if isinstance(data, list) else data.get("pedidos", data.get("itens", []))

    if not pedidos:
        return f"Nenhum pedido encontrado para o cliente {codigo_cliente}."

    lines = [f"Pedidos do cliente {codigo_cliente} ({len(pedidos)} encontrados):"]
    lines.append("-" * 50)

    for p in pedidos[:20]:  # Limita a 20 pedidos na exibicao
        numero = p.get("numero", p.get("numeroPedido", "?"))
        data_pedido = p.get("data", p.get("dataEmissao", "?"))
        status = p.get("status", p.get("situacao", "?"))
        valor = p.get("valor", p.get("valorTotal", "?"))

        lines.append(f"  Pedido {numero} | Data: {data_pedido} | Status: {status} | R$ {valor}")

    if len(pedidos) > 20:
        lines.append(f"  ... e mais {len(pedidos) - 20} pedidos")

    return "\n".join(lines)


def _formatar_carteira(data: dict | list, codigo_cliente: str) -> str:
    """Formata carteira de pedidos para exibicao."""
    pedidos = data if isinstance(data, list) else data.get("pedidos", data.get("itens", []))

    if not pedidos:
        return f"Nenhum pedido em carteira para o cliente {codigo_cliente}."

    lines = [f"Carteira do cliente {codigo_cliente} ({len(pedidos)} pedidos):"]
    lines.append("-" * 50)

    valor_total = 0
    for p in pedidos[:20]:
        numero = p.get("numero", p.get("numeroPedido", "?"))
        data_pedido = p.get("data", p.get("dataEntrega", "?"))
        valor = p.get("valor", p.get("valorTotal", 0))
        saldo_qtd = p.get("saldoQuantidade", p.get("qtdPendente", ""))

        lines.append(f"  Pedido {numero} | Entrega: {data_pedido} | R$ {valor}")
        if saldo_qtd:
            lines[-1] += f" | Qtd pendente: {saldo_qtd}"

        try:
            valor_total += float(valor)
        except (ValueError, TypeError):
            pass

    if len(pedidos) > 20:
        lines.append(f"  ... e mais {len(pedidos) - 20} pedidos")

    lines.append("-" * 50)
    lines.append(f"  Valor total em carteira: R$ {valor_total:,.2f}")

    return "\n".join(lines)
