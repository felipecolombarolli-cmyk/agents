"""
Orquestrador do ALFABOT.

Pipeline:
    texto -> intent.match -> extractor.extract -> permissions.check -> query -> formato

Cada etapa e isolada e testavel. O bot nao faz HTTP diretamente;
delega para os modulos de query, que usam o WKRadarClient.
"""

import logging

from . import intent as intent_module
from . import extractor
from . import permissions
from .intent import Intent
from .wk_radar_client import WKRadarClient
from .queries import estoque, comercial, cliente

logger = logging.getLogger(__name__)

# Mensagens padroes
_MSG_DESCONHECIDO = (
    "Desculpe, nao entendi sua pergunta.\n\n"
    "Consultas disponiveis:\n"
    "  - Saldo de produto: 'saldo do pasol 015'\n"
    "  - Preco de produto: 'preco do produto XYZ'\n"
    "  - Dados do cliente: 'dados do cliente 100'\n"
    "  - Historico do cliente: 'historico do cliente 100'\n"
    "  - Pedidos do cliente: 'pedidos do cliente 100'\n"
    "  - Carteira do cliente: 'carteira do cliente 100'"
)

_MSG_SAUDACAO = (
    "Ola! Sou o ALFABOT.\n\n"
    "Posso consultar:\n"
    "  - Saldo/estoque de produtos\n"
    "  - Precos de produtos\n"
    "  - Dados de clientes\n"
    "  - Historico e pedidos de clientes\n\n"
    "Exemplo: 'saldo do pasol 015' ou 'dados do cliente 100'"
)

# Padroes de saudacao simples
_GREETINGS = {"oi", "ola", "bom dia", "boa tarde", "boa noite", "hey", "hi", "hello", "ajuda", "help"}


class Bot:
    """Orquestrador principal do chatbot."""

    def __init__(self):
        self.client = WKRadarClient()

    def process(self, texto: str) -> str:
        """Processa uma pergunta do usuario e retorna a resposta.

        Este metodo e chamado pelo QueryWorker em uma thread separada.
        NAO deve ser chamado diretamente pela GUI.

        Args:
            texto: Texto digitado pelo usuario.

        Returns:
            Resposta formatada como string.
        """
        texto = texto.strip()
        if not texto:
            return "Digite uma pergunta para consultar."

        logger.info("Processando: '%s'", texto)

        # Verifica saudacao
        if texto.lower() in _GREETINGS:
            return _MSG_SAUDACAO

        # 1. Identificar intent
        matched_intent = intent_module.match(texto)
        logger.info("Intent: %s", matched_intent.value)

        if matched_intent == Intent.DESCONHECIDO:
            return _MSG_DESCONHECIDO

        # 2. Extrair entidades
        entities = extractor.extract(texto, matched_intent.value)
        logger.info("Entidades: %s", entities)

        # 3. Verificar permissoes
        allowed, reason = permissions.check(matched_intent, entities, texto)
        if not allowed:
            logger.warning("Bloqueado: %s", reason)
            return reason

        # 4. Executar consulta
        return self._execute(matched_intent, entities)

    def _execute(self, matched_intent: Intent, entities: dict) -> str:
        """Despacha a consulta para o modulo correto."""
        handlers = {
            Intent.SALDO: self._handle_saldo,
            Intent.PRECO: self._handle_preco,
            Intent.DADOS_CLIENTE: self._handle_dados_cliente,
            Intent.HISTORICO_CLIENTE: self._handle_historico_cliente,
            Intent.PEDIDOS_CLIENTE: self._handle_pedidos_cliente,
            Intent.CARTEIRA_CLIENTE: self._handle_carteira_cliente,
        }

        handler = handlers.get(matched_intent)
        if handler is None:
            return _MSG_DESCONHECIDO

        return handler(entities)

    # ── Handlers ──────────────────────────────────────────────────

    def _handle_saldo(self, entities: dict) -> str:
        return estoque.consultar_saldo(self.client, entities["codigo_produto"])

    def _handle_preco(self, entities: dict) -> str:
        return estoque.consultar_preco(self.client, entities["codigo_produto"])

    def _handle_dados_cliente(self, entities: dict) -> str:
        return cliente.consultar_dados(self.client, entities["codigo_cliente"])

    def _handle_historico_cliente(self, entities: dict) -> str:
        return cliente.consultar_historico(self.client, entities["codigo_cliente"])

    def _handle_pedidos_cliente(self, entities: dict) -> str:
        return comercial.consultar_pedidos(self.client, entities["codigo_cliente"])

    def _handle_carteira_cliente(self, entities: dict) -> str:
        return comercial.consultar_carteira(self.client, entities["codigo_cliente"])
