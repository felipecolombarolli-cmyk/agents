#!/usr/bin/env bash
# Instalador para macOS. Rode: bash agents/condomob_tennis/install_mac.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="$REPO_DIR/agents/condomob_tennis"
VENV="$REPO_DIR/.venv"

echo "==> Repo: $REPO_DIR"

# 1) Python
if ! command -v python3 >/dev/null; then
  echo "Python3 não encontrado. Instale com: brew install python"
  exit 1
fi

# 2) venv + deps
if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$AGENT_DIR/requirements.txt"
python -m playwright install chromium

# 3) config.yaml
if [ ! -f "$AGENT_DIR/config.yaml" ]; then
  cp "$AGENT_DIR/config.example.yaml" "$AGENT_DIR/config.yaml"
  echo "==> Criado $AGENT_DIR/config.yaml — EDITE com seu login/senha do Condomob."
fi

# 4) launchd plist
PLIST="$HOME/Library/LaunchAgents/com.condomob.tennis.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.condomob.tennis</string>
  <key>ProgramArguments</key>
  <array>
    <string>$VENV/bin/python</string>
    <string>-m</string>
    <string>agents.condomob_tennis.book</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>StartCalendarInterval</key>
  <array>
    <!-- Dispara 23:59 nas noites anteriores a terça e quinta.
         Reservas abrem 3 dias antes, então:
           - jogo terça 19h → abre sábado 00:00 → agendar sexta 23:59 (dia 5)
           - jogo quinta 19h → abre segunda 00:00 → agendar domingo 23:59 (dia 0)
         Weekday: 0=Domingo, 1=Segunda, ..., 6=Sábado -->
    <dict>
      <key>Weekday</key><integer>5</integer>
      <key>Hour</key><integer>23</integer>
      <key>Minute</key><integer>59</integer>
    </dict>
    <dict>
      <key>Weekday</key><integer>0</integer>
      <key>Hour</key><integer>23</integer>
      <key>Minute</key><integer>59</integer>
    </dict>
  </array>
  <key>StandardOutPath</key><string>$AGENT_DIR/condomob.log</string>
  <key>StandardErrorPath</key><string>$AGENT_DIR/condomob.log</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
EOF
echo "==> LaunchAgent criado em $PLIST"

# 5) Carregar launchd (remove se já existia)
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

# 6) Agendar wake do Mac nas mesmas noites (o Mac acorda sozinho)
#    sex 23:55 e dom 23:55
echo "==> Para o Mac acordar sozinho nessas noites, rode MANUALMENTE (precisa sudo):"
echo "    sudo pmset repeat wake FU 23:55:00"
echo "    (F=Fri, U=Sun. O launchd dispara o script logo depois.)"

echo
echo "✅ Pronto. Próximos passos:"
echo "  1. Editar: $AGENT_DIR/config.yaml  (login/senha)"
echo "  2. Testar: source $VENV/bin/activate && python -m agents.condomob_tennis.book --dry-run"
echo "  3. Rodar o comando pmset acima (uma vez só)"
