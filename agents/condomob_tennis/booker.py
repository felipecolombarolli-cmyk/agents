"""Automação Playwright do fluxo de reserva no portal Condomob."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime

from playwright.async_api import Page, async_playwright

log = logging.getLogger(__name__)


@dataclass
class BookingRequest:
    area_name: str
    play_datetime: datetime
    duration_minutes: int


@dataclass
class BookerConfig:
    login_url: str
    username: str
    password: str
    headless: bool = True
    retry_attempts: int = 5
    retry_delay_ms: int = 200


class CondomobBooker:
    def __init__(self, cfg: BookerConfig):
        self.cfg = cfg

    async def login(self, page: Page) -> None:
        await page.goto(self.cfg.login_url, wait_until="domcontentloaded")
        # Os IDs reais variam por condomínio; ajuste se necessário.
        await page.fill('input[name="login"], input[name="email"], #login', self.cfg.username)
        await page.fill('input[name="senha"], input[type="password"]', self.cfg.password)
        await page.click('button[type="submit"], input[type="submit"]')
        await page.wait_for_load_state("networkidle")
        log.info("login ok")

    async def open_reservation_screen(self, page: Page, area_name: str) -> None:
        # Caminho típico: menu lateral → "Reservas"
        await page.get_by_role("link", name="Reservas").first.click()
        await page.wait_for_load_state("networkidle")
        await page.get_by_text(area_name, exact=False).first.click()
        await page.wait_for_load_state("networkidle")
        log.info("tela de reservas aberta para %s", area_name)

    async def select_slot(self, page: Page, req: BookingRequest) -> None:
        date_str = req.play_datetime.strftime("%d/%m/%Y")
        time_str = req.play_datetime.strftime("%H:%M")
        # Tenta preencher campo de data se existir
        date_input = page.locator('input[type="date"], input[name*="data"]').first
        if await date_input.count():
            try:
                await date_input.fill(req.play_datetime.strftime("%Y-%m-%d"))
            except Exception:
                await date_input.fill(date_str)
        # Clica no horário do slot
        await page.get_by_text(time_str, exact=False).first.click()

    async def confirm(self, page: Page) -> bool:
        for label in ("Confirmar", "Reservar", "Salvar"):
            btn = page.get_by_role("button", name=label)
            if await btn.count():
                await btn.first.click()
                await page.wait_for_load_state("networkidle")
                break
        # Sucesso = mensagem positiva
        body = (await page.content()).lower()
        return any(k in body for k in ("sucesso", "reserva efetuada", "confirmada"))

    async def book(self, req: BookingRequest, fire_at: datetime) -> bool:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.cfg.headless)
            ctx = await browser.new_context()
            page = await ctx.new_page()
            try:
                await self.login(page)
                await self.open_reservation_screen(page, req.area_name)

                # Espera fina até o instante de abertura
                while True:
                    delta = (fire_at - datetime.now(fire_at.tzinfo)).total_seconds()
                    if delta <= 0:
                        break
                    await asyncio.sleep(min(delta, 0.05))

                last_err: Exception | None = None
                for attempt in range(self.cfg.retry_attempts):
                    try:
                        await self.select_slot(page, req)
                        ok = await self.confirm(page)
                        if ok:
                            log.info("reserva confirmada na tentativa %d", attempt + 1)
                            return True
                    except Exception as e:
                        last_err = e
                        log.warning("tentativa %d falhou: %s", attempt + 1, e)
                    await page.reload(wait_until="domcontentloaded")
                    await asyncio.sleep(self.cfg.retry_delay_ms / 1000)
                log.error("todas as tentativas falharam: %s", last_err)
                return False
            finally:
                await ctx.close()
                await browser.close()
