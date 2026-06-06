// 検索設定ジェネレーター・プロンプト（コピー用のプレーンテキスト）。
// アプリ内のガイドページから「コピー」して、ChatGPT/Claude 等に貼って使う。

export const GENERATOR_PROMPT = `役割: あなたはインフルエンサーマーケティングと YouTube 検索に精通したリサーチャーです。
「YouTuber スクリーナー」アプリ用に、案件ブリーフから効率的な検索設定を生成してください。

# アプリの仕組み（必ず踏まえる）
- 検索は search.list をキーワードごとに実行（1語=100クオータ、最大50件/回）。語の選定がコストと精度を支配。
- キーワードは tier1/2/3。tier1 ヒットほどスコアが高い。
- フィルタ: 登録者数min/max・avg_views_min・engagement_min・min_video_count・active_within_days。
- exclude_title_keywords=含むと除外。competitor_flag_keywords=言及を印付け。
- theme_overrides=テーマ別に avg_views_min/engagement_min/require_keywords を上書き
  （require_keywords=そのテーマで残す必須の「使用証拠」語）。
- YouTube検索は関連度依存で網羅的でない。広すぎる単語は母数だけ増えノイズ。

# 設計原則
1. シーン×ニーズの掛け合わせ（商品名でなく「使う場面語＋ニーズ語」の複合）
2. ティア設計（tier1=意図最濃の複合語 / tier2=テーマ中核 / tier3=拡張）
3. ノイズ除去（隣接ジャンルは exclude、"実使用の証拠語"は theme_overrides の require_keywords）
4. セグメント別に theme_overrides でしきい値調整
5. クオータ: 語数×100。広い単独語を避け複合語に予算を寄せる

# 入力（ブリーフ）※ここを埋めてください
- 商材／一言の特徴:
- 想定する利用シーン（複数）:
- ターゲット視聴者像:
- 競合・代替製品:
- 起用したいチャンネル規模（登録者）:
- 地域・言語（既定 JP / ja）:

# 出力フォーマット（アプリにそのまま貼れる形で）
- keywords_tier1（改行区切り。各語は「シーン語＋ニーズ語」の複合にする）
- keywords_tier2 / keywords_tier3（改行区切り）
- exclude_title_keywords（改行区切り）
- competitor_flag_keywords（改行区切り）
- filters（JSON: subscriber_min/max, avg_views_min, engagement_min, min_video_count, active_within_days）
- theme_overrides（JSON。サブテーマ別のしきい値や require_keywords。不要なら {}）
- scoring_weights（JSON: scene_match/engagement/recent_activity/subscriber_fit、合計100目安）
- 設計意図メモ（各tierの狙い／除外理由／クオータ概算＝語数×100）

# 出力前のセルフチェック
- tier1 の各語は「単独の広い語」でなく複合語になっているか？
- 隣接ノイズ（似て非なるジャンル）を exclude したか？
- "実際に商材を使う層"を require_keywords で担保したか？
- クオータ概算（語数×100）が予算内（無料枠10,000）に収まるか？`;

export const BRIEF_TEMPLATE = `- 商材／一言の特徴:
- 想定する利用シーン（複数）:
- ターゲット視聴者像:
- 競合・代替製品:
- 起用したいチャンネル規模（登録者）:
- 地域・言語（既定 JP / ja）:`;

export const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "シーン × ニーズの掛け合わせ",
    body: "商品名で探さない。「使う場面語 ＋ ニーズ語」の複合にする。例: ×ポータブル電源 → ○車中泊 ポータブル電源 / 電動リール バッテリー。",
  },
  {
    title: "ティア設計",
    body: "tier1=意図最濃の複合語、tier2=テーマ中核、tier3=拡張。tier1 を厚くするほど上位が狙った層になる。",
  },
  {
    title: "ノイズ除去の二段構え",
    body: "隣接ジャンルは exclude（星→占い、釣り→バス釣り）、実使用の証拠語は require_keywords（釣り→魚探/電動リール）で必須化。",
  },
  {
    title: "セグメント別チューニング",
    body: "母数や再生相場が違うサブテーマは theme_overrides でしきい値を変える（星空は母数小→avg_views_min を別設定）。",
  },
  {
    title: "クオータ設計",
    body: "消費＝語数×100が全て。広い単独語を削り複合語に予算を寄せる。results_per_keyword=50 固定が最効率。",
  },
];
