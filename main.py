"""
YouTube チャンネルスクリーニング CLI。

config.yaml を読み、backend/screener.py の共通ロジックでスクリーニングを実行して
output.xlsx に出力する。ロジック本体は Web 版(backend/app.py)と共有している。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from googleapiclient.errors import HttpError

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "backend"))  # 共通モジュールを import 可能に

from screener import Cache, Config, run_screening, write_excel, YouTubeScreener  # noqa: E402


def main() -> int:
    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key or api_key == "ここにAPIキーを貼り付け":
        print("エラー: .env に YOUTUBE_API_KEY を設定してください。", file=sys.stderr)
        return 1

    with (BASE_DIR / "config.yaml").open(encoding="utf-8") as f:
        cfg = Config(yaml.safe_load(f))
    if not cfg.keywords:
        print("エラー: config.yaml に keywords(_tier1/2/3) がありません。", file=sys.stderr)
        return 1

    cache = Cache(BASE_DIR / "cache", ttl_seconds=cfg.cache_ttl_hours * 3600)
    screener = YouTubeScreener(api_key, cache, log=lambda m: print(f"  {m}"))

    last = {"phase": None}

    def progress(phase: str, done: int, total: int) -> None:
        if phase != last["phase"]:
            label = {"searching": "検索中", "details": "チャンネル詳細取得中",
                     "scoring": "直近動画取得・絞り込み中"}.get(phase, phase)
            print(f"{label}...")
            last["phase"] = phase

    print(f"キーワード {len(cfg.keywords)} 件 / 検索上限 {cfg.max_searches_per_run}")
    try:
        out = run_screening(cfg, screener, progress)
    except HttpError as e:
        print(f"APIエラー: {e}", file=sys.stderr)
        return 1

    s = out["stats"]
    d1, d2 = s["drop_stage1"], s["drop_stage2"]
    print(f"ユニークなチャンネル数: {s['unique_channels']}")
    print(
        f"安フィルタ後: {s['after_cheap_filter']} 件 "
        f"(除外: 非公開{d1['hidden']} / 登録者{d1['subs']} / 動画数{d1['videos']} / 除外語{d1['excluded']})"
    )
    print(
        f"最終通過: {s['final']} 件 "
        f"(除外: 平均再生{d2['avg']} / エンゲージ{d2['eng']} / 休眠{d2['active']} / 非ガジェット{d2['relevance']})"
    )

    saved = write_excel(out["results"], BASE_DIR / cfg.output_file, log=lambda m: print(f"  {m}"))
    print(f"\n完了: {saved}")
    print(
        f"概算クオータ消費（キャッシュ未使用分）: {s['quota_used']} ユニット / 日次上限 10,000  "
        f"(API検索 {s['api_searches']} 回)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
