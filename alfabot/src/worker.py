"""
Worker thread para executar consultas fora da thread principal do Qt.

A GUI NUNCA deve chamar bot.process() diretamente.
Em vez disso, cria um QueryWorker e conecta os signals.

Uso:
    worker = QueryWorker(bot, "saldo do pasol 015")
    worker.finished.connect(self.on_result)
    worker.error.connect(self.on_error)
    worker.start()
"""

from PySide6.QtCore import QThread, Signal


class QueryWorker(QThread):
    """Executa bot.process() em uma thread separada.

    Signals:
        finished(str): Emitido com o resultado formatado da consulta.
        error(str): Emitido com a mensagem de erro se algo falhar.
    """

    finished = Signal(str)
    error = Signal(str)

    def __init__(self, bot, texto: str, parent=None):
        super().__init__(parent)
        self.bot = bot
        self.texto = texto

    def run(self):
        try:
            resultado = self.bot.process(self.texto)
            self.finished.emit(resultado)
        except Exception as e:
            self.error.emit(f"Erro inesperado: {e}")
