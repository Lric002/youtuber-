"""
FastAPI バックエンド。

YouTube チャンネルスクリーニングを Web/スマホから実行できるようにする。
- 共有パスワードでログイン（APIキーはサーバ側 env に隠す）
- 検索はバックグラウンドジョブで実行し、進捗をポーリングで返す
- 結果は JSON テーブル / Excel ダウンロードで取得
- クオータ上限ガードでキー濫用を防止
"""
from __future__ import annotations

import os
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

import quota
from auth import issue_token, password_ok, require_auth
from screener import Cache, Config, YouTubeScreener, excel_bytes, run_screening

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

CACHE_TTL_HOURS = int(os.getenv("CACHE_TTL_HOURS", "168"))
# 検索キャッシュはプロセス内で共有（クオータ節約）。Render無料は単一インスタンス前提。
_cache = Cache(BASE_DIR / "cache", ttl_seconds=CACHE_TTL_HOURS * 3600)

# ジョブ置き場（インメモリ）。job_id -> dict
_jobs: Dict[str, Dict[str, Any]] = {}
_jobs_lock = threading.Lock()

app = FastAPI(title="YouTuber Screener API")

# FRONTEND_ORIGIN は複数可（カンマ区切り）。末尾スラッシュは事故りやすいので吸収する。
_origins = [
    o.strip().rstrip("/")
    for o in os.getenv("FRONTEND_ORIGIN", "").split(",")
    if o.strip()
]
_origins += ["http://localhost:3000", "http://127.0.0.1:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Vercel のプレビュー含む *.vercel.app も許可（本番ドメイン未設定でも動くように）
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# モデル
# --------------------------------------------------------------------------- #
class LoginReq(BaseModel):
    password: str


# --------------------------------------------------------------------------- #
# ジョブ実行
# --------------------------------------------------------------------------- #
def _run_job(job_id: str, payload: Dict[str, Any]) -> None:
    job = _jobs[job_id]
    try:
        cfg = Config(payload)
        api_key = os.getenv("YOUTUBE_API_KEY")
        if not api_key:
            raise RuntimeError("サーバに YOUTUBE_API_KEY が設定されていません。")

        screener = YouTubeScreener(api_key, _cache)

        def progress(phase: str, done: int, total: int) -> None:
            job["progress"] = {"phase": phase, "done": done, "total": total}

        out = run_screening(cfg, screener, progress)
        quota.add(screener.quota_used)  # 実消費を当日カウントに反映
        job["results"] = out["results"]
        job["stats"] = out["stats"]
        job["status"] = "done"
    except Exception as e:  # noqa: BLE001  失敗内容をジョブに残す
        job["status"] = "error"
        job["error"] = str(e)


# --------------------------------------------------------------------------- #
# エンドポイント
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "quota": quota.status()}


@app.post("/api/login")
def login(req: LoginReq) -> Dict[str, str]:
    if not password_ok(req.password):
        raise HTTPException(status_code=401, detail="パスワードが違います。")
    return {"token": issue_token()}


@app.get("/api/quota")
def get_quota(_: None = Depends(require_auth)) -> Dict[str, Any]:
    return quota.status()


@app.post("/api/search")
def start_search(
    payload: Dict[str, Any] = Body(...), _: None = Depends(require_auth)
) -> Dict[str, str]:
    cfg = Config(payload)
    if not cfg.keywords:
        raise HTTPException(status_code=400, detail="検索キーワードを1つ以上入力してください。")

    # クオータ上限ガード（最悪ケースで概算）
    estimate = min(len(cfg.keywords), cfg.max_searches_per_run) * 100
    if not quota.can_afford(estimate):
        raise HTTPException(
            status_code=429,
            detail=f"本日のクオータ上限に近づいています（残り {quota.remaining()} ユニット）。"
                   "明日まで待つか、キーワード数を減らしてください。",
        )

    job_id = uuid.uuid4().hex
    with _jobs_lock:
        _jobs[job_id] = {
            "status": "running",
            "progress": {"phase": "queued", "done": 0, "total": len(cfg.keywords)},
            "results": None,
            "stats": None,
            "error": None,
        }
    threading.Thread(target=_run_job, args=(job_id, payload), daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/search/{job_id}")
def search_status(job_id: str, _: None = Depends(require_auth)) -> Dict[str, Any]:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="ジョブが見つかりません。")
    resp: Dict[str, Any] = {
        "status": job["status"],
        "progress": job["progress"],
        "error": job["error"],
    }
    if job["status"] == "done":
        resp["results"] = job["results"]
        resp["stats"] = job["stats"]
    return resp


@app.get("/api/export/{job_id}.xlsx")
def export_xlsx(job_id: str, _: None = Depends(require_auth)) -> Response:
    job = _jobs.get(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(status_code=404, detail="完了したジョブが見つかりません。")
    data = excel_bytes(job["results"] or [])
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="youtubers.xlsx"'},
    )
