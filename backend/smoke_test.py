"""バックエンドAPIの通し動作確認（login→search→poll→export）。"""
import time
import yaml
import requests
from pathlib import Path

BASE = "http://127.0.0.1:8000"
CFG = yaml.safe_load((Path(__file__).resolve().parent.parent / "config.yaml").open(encoding="utf-8"))

# 1. health
print("health:", requests.get(f"{BASE}/api/health", timeout=10).json())

# 2. login (wrong then right)
r = requests.post(f"{BASE}/api/login", json={"password": "wrong"}, timeout=10)
print("login(wrong):", r.status_code)
r = requests.post(f"{BASE}/api/login", json={"password": "jackery2026"}, timeout=10)
print("login(right):", r.status_code)
token = r.json()["token"]
H = {"Authorization": f"Bearer {token}"}

# 3. search (cached config -> fast)
r = requests.post(f"{BASE}/api/search", json=CFG, headers=H, timeout=30)
print("search start:", r.status_code, r.json())
job_id = r.json()["job_id"]

# 4. poll
for _ in range(60):
    st = requests.get(f"{BASE}/api/search/{job_id}", headers=H, timeout=30).json()
    if st["status"] in ("done", "error"):
        break
    time.sleep(1)
print("final status:", st["status"], "| progress:", st.get("progress"))
if st["status"] == "error":
    print("ERROR:", st["error"]); raise SystemExit(1)
print("stats:", st["stats"])
print("result count:", len(st["results"]))
print("top1:", {k: st["results"][0].get(k) for k in ("score", "title", "theme", "subscriber_count", "avg_views")})

# 5. export
r = requests.get(f"{BASE}/api/export/{job_id}.xlsx", headers=H, timeout=30)
print("export:", r.status_code, "bytes:", len(r.content), "ctype:", r.headers.get("content-type"))

# 6. export without auth -> 401
r = requests.get(f"{BASE}/api/export/{job_id}.xlsx", timeout=30)
print("export(no auth):", r.status_code)
print("OK")
