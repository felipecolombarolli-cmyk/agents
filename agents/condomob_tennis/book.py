"""Entrypoint: lê config, escolhe próximo slot e dispara a reserva."""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

import yaml

from .booker import BookerConfig, BookingRequest, CondomobBooker
from .scheduler import next_actionable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("condomob_tennis")


def load_config(path: Path) -> dict:
    with path.open() as f:
        return yaml.safe_load(f)


async def run(cfg_path: Path, dry_run: bool) -> int:
    cfg = load_config(cfg_path)
    b = cfg["booking"]
    slot = next_actionable(
        b["weekdays"], b["start_time"], b["open_days_before"], b["timezone"]
    )
    if slot is None:
        log.info("nenhum slot futuro dentro do horizonte")
        return 0

    log.info("próximo jogo: %s | abertura: %s", slot.play_datetime, slot.open_datetime)

    if dry_run:
        return 0

    # Pré-armar: acordar antes da abertura para logar e abrir a tela
    prearm = int(cfg["runtime"].get("prearm_seconds", 30))
    wake = slot.open_datetime - timedelta(seconds=prearm)
    now = datetime.now(slot.open_datetime.tzinfo)
    wait = (wake - now).total_seconds()
    if wait > 0:
        log.info("dormindo %.1fs até T-%ds", wait, prearm)
        await asyncio.sleep(wait)

    booker = CondomobBooker(BookerConfig(
        login_url=cfg["condomob"]["login_url"],
        username=cfg["condomob"]["username"],
        password=cfg["condomob"]["password"],
        headless=cfg["runtime"].get("headless", True),
        retry_attempts=cfg["runtime"].get("retry_attempts", 5),
        retry_delay_ms=cfg["runtime"].get("retry_delay_ms", 200),
    ))
    req = BookingRequest(
        area_name=b["area_name"],
        play_datetime=slot.play_datetime,
        duration_minutes=b.get("duration_minutes", 60),
    )
    ok = await booker.book(req, slot.open_datetime)
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="agents/condomob_tennis/config.yaml")
    ap.add_argument("--dry-run", action="store_true", help="só mostra próximo slot")
    args = ap.parse_args()
    return asyncio.run(run(Path(args.config), args.dry_run))


if __name__ == "__main__":
    sys.exit(main())
