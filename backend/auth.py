"""共有パスワード認証（署名付きトークンの発行・検証）。"""
from __future__ import annotations

import os

from fastapi import Header, HTTPException
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

# トークン署名鍵。env が無ければ APP_PASSWORD から導出（本番では SECRET_KEY を必ず設定）。
_SECRET = os.getenv("SECRET_KEY") or (os.getenv("APP_PASSWORD", "") + "::yt-screener-secret")
_SALT = "yt-screener-login"
_MAX_AGE = 60 * 60 * 12  # トークン有効期間: 12時間

_serializer = URLSafeTimedSerializer(_SECRET, salt=_SALT)


def password_ok(password: str) -> bool:
    expected = os.getenv("APP_PASSWORD")
    return bool(expected) and password == expected


def issue_token() -> str:
    return _serializer.dumps({"ok": True})


def verify_token(token: str) -> bool:
    try:
        _serializer.loads(token, max_age=_MAX_AGE)
        return True
    except (BadSignature, SignatureExpired):
        return False


def require_auth(authorization: str = Header(default="")) -> None:
    """FastAPI 依存。Authorization: Bearer <token> を検証する。"""
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    if not token or not verify_token(token):
        raise HTTPException(status_code=401, detail="認証が必要です（ログインしてください）。")
