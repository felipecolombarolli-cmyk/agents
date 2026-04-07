"""Calcula próximos slots-alvo e instantes de abertura."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

WEEKDAY_MAP = {"MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6}


@dataclass
class Slot:
    play_datetime: datetime   # quando o jogo acontece
    open_datetime: datetime   # quando a reserva abre


def next_slots(
    weekdays: list[str],
    start_time_str: str,
    open_days_before: int,
    tz_name: str,
    horizon_days: int = 14,
) -> list[Slot]:
    tz = ZoneInfo(tz_name)
    now = datetime.now(tz)
    hh, mm = map(int, start_time_str.split(":"))
    targets = {WEEKDAY_MAP[w] for w in weekdays}
    out: list[Slot] = []
    for i in range(horizon_days):
        d = (now + timedelta(days=i)).date()
        if d.weekday() in targets:
            play_dt = datetime.combine(d, time(hh, mm), tzinfo=tz)
            open_dt = datetime.combine(
                d - timedelta(days=open_days_before), time(0, 0), tzinfo=tz
            )
            if open_dt > now - timedelta(minutes=5):
                out.append(Slot(play_dt, open_dt))
    return sorted(out, key=lambda s: s.open_datetime)


def next_actionable(weekdays, start_time_str, open_days_before, tz_name) -> Slot | None:
    slots = next_slots(weekdays, start_time_str, open_days_before, tz_name)
    return slots[0] if slots else None
