# Setup no Mac (passo a passo)

Guia pra rodar o agente no seu próprio Mac, sem servidor na nuvem.

## Como funciona

O `launchd` (sistema de agendamento do Mac) dispara o script em duas noites
por semana:

- **Sexta 23:59** → reserva a quadra de terça-feira 19h (janela abre sábado 00:00)
- **Domingo 23:59** → reserva a quadra de quinta-feira 19h (janela abre segunda 00:00)

O script acorda antes da meia-noite, faz login no Condomob, abre a tela da
quadra de tênis e dispara a reserva no instante exato que a janela abre.

## Pré-requisitos

1. **Homebrew** instalado (https://brew.sh)
2. **Python 3** (`brew install python` se não tiver)

## Instalação (copie e cole no Terminal)

```bash
# 1. Baixar o repositório
git clone https://github.com/felipecolombarolli-cmyk/agents.git ~/condomob-agent
cd ~/condomob-agent
git checkout claude/tennis-court-booking-agent-wEx60

# 2. Rodar o instalador
bash agents/condomob_tennis/install_mac.sh

# 3. Editar o config com seu login/senha
open -e agents/condomob_tennis/config.yaml
# (troque SEU_CPF_OU_EMAIL e SUA_SENHA, salve e feche)

# 4. Testar sem reservar de verdade
source .venv/bin/activate
python -m agents.condomob_tennis.book --dry-run
# Deve imprimir o próximo jogo e horário de abertura da janela.

# 5. Fazer o Mac acordar sozinho nas noites de reserva (sex e dom, 23:55)
sudo pmset repeat wake FU 23:55:00
```

## Como garantir que vai funcionar

1. **Deixe o Mac ligado nas noites de sexta e domingo.** Mesmo que a tela
   apague, o `pmset` acorda o Mac e o `launchd` dispara o script.
2. **Desative "Power Nap" apenas se estiver dando problema** — normalmente
   não atrapalha.
3. **Não precisa ficar logado**, mas o Mac não pode estar desligado.

## Verificar se está ativo

```bash
launchctl list | grep condomob
# deve aparecer: com.condomob.tennis

pmset -g sched
# deve aparecer o wake repetitivo sex/dom 23:55
```

## Ver o log da última execução

```bash
tail -f ~/condomob-agent/agents/condomob_tennis/condomob.log
```

## Testar AGORA sem esperar a noite

Força o agente a rodar imediatamente (ele vai calcular o próximo slot e
dormir até o instante exato — se esse instante for daqui a dias, ele
fica dormindo; Ctrl+C pra cancelar):

```bash
launchctl start com.condomob.tennis
```

Pra rodar manualmente sem passar pelo launchd:

```bash
cd ~/condomob-agent
source .venv/bin/activate
python -m agents.condomob_tennis.book
```

## Desativar tudo

```bash
launchctl unload ~/Library/LaunchAgents/com.condomob.tennis.plist
sudo pmset repeat cancel
```

## Ajuste de seletores (se a reserva falhar na 1ª vez)

Os botões do portal do Condomob podem ter nomes diferentes no seu condomínio.
Se o log mostrar erro do tipo "não encontrou botão Reservas":

1. Edita `agents/condomob_tennis/booker.py`
2. Na função `open_reservation_screen`, troca os textos pelos que aparecem
   no seu portal
3. Salva e testa com `--dry-run` não ajuda (só calcula datas); rode o fluxo
   real num horário de teste
