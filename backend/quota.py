"""YouTube API クオータの当日消費を概算で管理し、上限を超えないよう守る。

インメモリで「今日(UTC)の概算消費ユニット」を加算カウントする。
プロセス再起動で 0 に戻るが、検索キャッシュと併用して濫用を防ぐのが目的。
"""
from __future__ import annotations

import os
import threading
from datetime import datetime, timezone

_lock = threading.Lock()
_state = {"date": None, "used": 0}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _roll() -> None:
    today = _today()
    if _state["date"] != today:
        _state["date"] = today
        _state["used"] = 0


def cap() -> int:
    return int(os.getenv("DAILY_QUOTA_CAP", "8000"))


def used() -> int:
    with _lock:
        _roll()
        return _state["used"]


def remaining() -> int:
    return max(0, cap() - used())


def can_afford(estimated_units: int) -> bool:
    """これから消費しそうなユニットを加味して上限内か判定。"""
    with _lock:
        _roll()
        return _state["used"] + estimated_units <= cap()


def add(units: int) -> None:
    with _lock:
        _roll()
        _state["used"] += max(0, int(units))


def status() -> dict:
    return {"used": used(), "cap": cap(), "remaining": remaining()}
