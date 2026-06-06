# YouTuber スクリーナー

YouTube Data API v3 を使い、キーワードでチャンネルを検索して
登録者数・平均再生数・エンゲージ率などで絞り込み・スコアリングするツール。

2つの使い方があります:

1. **CLI**（`main.py`）… `config.yaml` を編集してローカル実行、`output.xlsx` を出力
2. **Web アプリ**（`backend/` + `frontend/`）… ブラウザ/スマホから条件入力→結果表示→Excelダウンロード

検索ロジック本体は `backend/screener.py` に集約し、CLI と Web で共有しています。

## 取得・評価する指標

登録者数 / 総再生数 / 動画本数 / 開設日 / 最終投稿日 / 直近N本の平均再生数 /
エンゲージ率（平均再生÷登録者）/ テーマ判定 / 競合言及フラグ / 総合スコア

---

## セットアップ（共通）

```powershell
# 依存（CLI）
pip install -r requirements.txt
# APIキー等
copy .env.example .env   # .env を編集（YOUTUBE_API_KEY, APP_PASSWORD など）
```

APIキーは [Google Cloud Console](https://console.cloud.google.com/) で
「YouTube Data API v3」を有効化し、認証情報からAPIキーを発行して取得します。

## CLI の使い方

```powershell
# config.yaml の keywords / filters を編集してから
py main.py
```

`config.yaml` の主な項目: `keywords_tier1/2/3`（階層キーワード）、`filters`（登録者数・
平均再生数・エンゲージ率・動画本数・直近活動）、`exclude_title_keywords`（除外語）、
`competitor_flag_keywords`（競合フラグ）、`theme_overrides`（テーマ別しきい値上書き）、
`scoring_weights`（スコア重み）。

## Web アプリの使い方（ローカル）

```powershell
# 1) バックエンド（FastAPI）
pip install -r backend/requirements.txt
py -m uvicorn app:app --app-dir backend --port 8000

# 2) フロントエンド（Next.js）別ターミナルで
cd frontend
npm install
npm run dev
```

ブラウザで http://localhost:3000/login を開き、`.env` の `APP_PASSWORD` でログイン。
キーワードや条件を入力して「検索する」→ 結果テーブル表示 → 「Excelダウンロード」。
詳細条件（キーワード階層・除外語・テーマ別上書き・スコア重み）は「詳細設定」を開いて編集。
よく使う条件は「プリセット」としてブラウザに保存できます。

> Node が証明書エラー（`UNABLE_TO_VERIFY_LEAF_SIGNATURE`）になる場合は、
> `npm` コマンドの前に `$env:NODE_OPTIONS="--use-system-ca"` を付けてください。

---

## デプロイ（スマホからも使う / Vercel + Render 無料枠）

### バックエンド → Render
1. このリポジトリを GitHub に push
2. Render で **New + > Blueprint** を選び、リポジトリを指定（`render.yaml` を読み込む）
3. 環境変数を設定: `YOUTUBE_API_KEY`, `APP_PASSWORD`, `FRONTEND_ORIGIN`（後述のVercel URL）
   - `SECRET_KEY` は自動生成、`DAILY_QUOTA_CAP` は既定 8000
4. 発行された URL（例: `https://yt-screener-api.onrender.com`）を控える

### フロントエンド → Vercel
1. Vercel で **New Project** → リポジトリを選択
2. **Root Directory** を `frontend` に設定
3. 環境変数 `NEXT_PUBLIC_API_BASE` に Render の URL を設定
4. デプロイ後の URL を、Render 側の `FRONTEND_ORIGIN` に設定し直す（CORS 許可のため）

### 運用上の注意（無料枠）
- Render 無料枠は15分アクセスが無いとスリープし、初回起動に約50秒かかります（少し待てば復帰）。
- ファイルシステムは再起動で消えるため、**検索キャッシュ・ジョブはインメモリ**前提です
  （消えても再取得で復旧）。
- 公開URLは **共有パスワード** で保護され、APIキーはサーバ側に隠れています。さらに
  `DAILY_QUOTA_CAP` でクオータ濫用を防ぎます。

---

## クオータについて

無料枠は **1日 10,000 ユニット**。`search.list`=100、`channels.list`/`playlistItems.list`/
`videos.list`=各1。検索が最も高コストなため、検索結果・チャンネル詳細・直近動画統計を
`cache/` に保存（既定7日）し、同条件の再実行では消費しません。

## ディレクトリ

```
yt-channel-screener/
  main.py            # CLI（backend/screener.py を利用）
  config.yaml        # CLI用の設定／Webプリセットの元
  backend/           # FastAPI（screener.py に共通ロジック）
  frontend/          # Next.js（ログイン＋検索フォーム＋結果テーブル）
  render.yaml        # Render デプロイ定義
```
