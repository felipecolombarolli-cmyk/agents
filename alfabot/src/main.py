"""
Interface grafica do ALFABOT (PySide6).

Regras:
- NUNCA faz chamadas HTTP na thread principal
- Usa QueryWorker (QThread) para todas as consultas
- Desabilita input enquanto uma consulta esta em andamento
- Mantem referencia ao worker para evitar garbage collection
"""

import logging
import sys
from datetime import datetime

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont, QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QApplication,
    QFileDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QPlainTextEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from .bot import Bot
from .worker import QueryWorker

logger = logging.getLogger(__name__)

# Configuracao de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)


class MainWindow(QMainWindow):
    """Janela principal do ALFABOT."""

    def __init__(self):
        super().__init__()
        self.bot = Bot()
        self._worker: QueryWorker | None = None  # Referencia para evitar GC

        self._setup_ui()
        self._connect_signals()
        self._append_bot_message(
            "Ola! Sou o ALFABOT.\n"
            "Digite sua consulta abaixo.\n"
            "Exemplos: 'saldo do pasol 015', 'dados do cliente 100'"
        )

    def _setup_ui(self):
        self.setWindowTitle("ALFABOT - Consulta WK Radar")
        self.setMinimumSize(700, 500)

        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setSpacing(8)
        layout.setContentsMargins(12, 12, 12, 12)

        # ── Titulo ────────────────────────────────────────────
        title = QLabel("ALFABOT")
        title.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        # ── Area de historico ─────────────────────────────────
        self.history = QPlainTextEdit()
        self.history.setReadOnly(True)
        self.history.setFont(QFont("Consolas", 10))
        self.history.setPlaceholderText("As respostas aparecerao aqui...")
        layout.addWidget(self.history, stretch=1)

        # ── Status ────────────────────────────────────────────
        self.status_label = QLabel("")
        self.status_label.setStyleSheet("color: gray; font-size: 11px;")
        layout.addWidget(self.status_label)

        # ── Input + botao ─────────────────────────────────────
        input_layout = QHBoxLayout()

        self.input_field = QLineEdit()
        self.input_field.setFont(QFont("Segoe UI", 11))
        self.input_field.setPlaceholderText("Digite sua pergunta aqui...")
        input_layout.addWidget(self.input_field, stretch=1)

        self.send_button = QPushButton("Enviar")
        self.send_button.setFont(QFont("Segoe UI", 11))
        self.send_button.setFixedWidth(80)
        input_layout.addWidget(self.send_button)

        layout.addLayout(input_layout)

        # ── Botoes de acao ────────────────────────────────────
        action_layout = QHBoxLayout()

        self.copy_button = QPushButton("Copiar Ultima Resposta")
        self.copy_button.setEnabled(False)
        action_layout.addWidget(self.copy_button)

        self.export_button = QPushButton("Exportar para TXT")
        self.export_button.setEnabled(False)
        action_layout.addWidget(self.export_button)

        self.clear_button = QPushButton("Limpar Historico")
        action_layout.addWidget(self.clear_button)

        layout.addLayout(action_layout)

    def _connect_signals(self):
        self.input_field.returnPressed.connect(self._on_send)
        self.send_button.clicked.connect(self._on_send)
        self.copy_button.clicked.connect(self._on_copy)
        self.export_button.clicked.connect(self._on_export)
        self.clear_button.clicked.connect(self._on_clear)

        # Atalho Ctrl+C para copiar (quando input nao tem foco)
        shortcut = QShortcut(QKeySequence("Ctrl+Shift+C"), self)
        shortcut.activated.connect(self._on_copy)

    # ── Acoes ─────────────────────────────────────────────────

    def _on_send(self):
        texto = self.input_field.text().strip()
        if not texto:
            return

        # Exibe pergunta do usuario
        self._append_user_message(texto)
        self.input_field.clear()

        # Desabilita input enquanto processa
        self._set_loading(True)

        # Cria worker e inicia em thread separada
        self._worker = QueryWorker(self.bot, texto)
        self._worker.finished.connect(self._on_result)
        self._worker.error.connect(self._on_error)
        self._worker.start()

    def _on_result(self, resultado: str):
        """Chamado quando o worker termina com sucesso."""
        self._last_response = resultado
        self._append_bot_message(resultado)
        self._set_loading(False)
        self.copy_button.setEnabled(True)
        self.export_button.setEnabled(True)

    def _on_error(self, error_msg: str):
        """Chamado quando o worker encontra um erro."""
        self._append_bot_message(f"[ERRO] {error_msg}")
        self._set_loading(False)

    def _on_copy(self):
        if hasattr(self, "_last_response"):
            clipboard = QApplication.clipboard()
            clipboard.setText(self._last_response)
            self.status_label.setText("Resposta copiada!")

    def _on_export(self):
        if not hasattr(self, "_last_response"):
            return

        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Exportar Resposta",
            f"alfabot_export_{datetime.now():%Y%m%d_%H%M%S}.txt",
            "Arquivos de Texto (*.txt)",
        )
        if file_path:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(self._last_response)
            self.status_label.setText(f"Exportado para {file_path}")

    def _on_clear(self):
        self.history.clear()
        self.copy_button.setEnabled(False)
        self.export_button.setEnabled(False)
        self.status_label.setText("")

    # ── Helpers ───────────────────────────────────────────────

    def _set_loading(self, loading: bool):
        self.input_field.setEnabled(not loading)
        self.send_button.setEnabled(not loading)
        if loading:
            self.status_label.setText("Consultando...")
        else:
            self.status_label.setText("")
            self.input_field.setFocus()

    def _append_user_message(self, text: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.history.appendPlainText(f"[{timestamp}] Voce: {text}")
        self.history.appendPlainText("")

    def _append_bot_message(self, text: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.history.appendPlainText(f"[{timestamp}] ALFABOT:")
        for line in text.split("\n"):
            self.history.appendPlainText(f"  {line}")
        self.history.appendPlainText("")

        # Auto-scroll para o final
        scrollbar = self.history.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
