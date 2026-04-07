# Condomob Tennis Court Booking Agent

Reserva automática da quadra de tênis no Condomob assim que o slot abre
(meia-noite, 3 dias antes do jogo). Usa Playwright contra o portal web do
Condomob (https://www.condomob.net).

## Como funciona

1. Lê configuração (`config.yaml`) com credenciais, dias-alvo, horário, fuso.
2. Calcula o próximo instante de abertura (00:00:00 do dia D-3).
3. Sincroniza com NTP e dorme até ~T-30s.
4. Faz login no Condomob e navega até "Reservas → Quadra de Tênis".
5. No instante exato, dispara o clique de reserva e confirma.
6. Loga o resultado e (opcional) envia notificação.

## Setup local

```bash
pip install -r requirements.txt
playwright install chromium
cp config.example.yaml config.yaml   # editar credenciais
python -m agents.condomob_tennis.book --once   # teste manual
```

## Deploy em VPS (recomendado)

Qualquer VPS pequeno (1 vCPU / 1 GB) basta. Use systemd timer ou cron:

```
# /etc/systemd/system/condomob-tennis.service
[Service]
Type=oneshot
WorkingDirectory=/opt/agents
ExecStart=/usr/bin/python -m agents.condomob_tennis.book

# /etc/systemd/system/condomob-tennis.timer
[Timer]
# roda 23:59:30 todo dia, agente lida com a espera fina
OnCalendar=*-*-* 23:59:30
Persistent=true
```

Ative NTP no host: `timedatectl set-ntp true`.

## Configuração padrão deste usuário

- Dias-alvo: terça e quinta
- Horário: 19:00
- Janela: abre 00:00 três dias antes
- Logo: terça 19h → reserva às 00:00 do sábado anterior;
        quinta 19h → reserva às 00:00 da segunda anterior

## Avisos

- O seletor exato dos botões depende do layout do seu condomínio no Condomob.
  Rode `--debug` uma vez para capturar HTML e ajustar `selectors.py`.
- Não compartilhe `config.yaml` (já está no .gitignore).
