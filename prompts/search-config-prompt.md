# YouTuber スクリーナー：検索設定ジェネレーター・プロンプト

このアプリは「最初に入れる検索設定（キーワード階層・フィルタ・除外語・テーマ別上書き）」の
質で結果がほぼ決まる。任意の案件ブリーフから、効率的（高精度＆低クオータ）な検索設定を
生成するための **再利用プロンプト** と、その背景にある設計原則をまとめる。

---

## A. 効率を決める仕組み（前提知識）

- 検索は `search.list` をキーワードごとに実行。**1キーワード = 100 クオータ**（最大50件まで同コスト）。
  → 消費は「キーワード数 × 100」。**語の選定がコストと精度の両方を支配する。**
- キーワードは **tier1/2/3** に分け、tier1 ヒットほどスコアが高い（`scene_match`）。
- フィルタ: `subscriber_min/max`, `avg_views_min`, `engagement_min`, `min_video_count`, `active_within_days`。
- `exclude_title_keywords`: タイトル/説明に含むと**除外**。
- `competitor_flag_keywords`: 言及を**印付け**（除外ではない＝既に他社製品を扱う先＝商談の要確認）。
- `theme_overrides`: テーマ単位で `avg_views_min` / `engagement_min` / `require_keywords` を上書き。
  `require_keywords` は「そのテーマで残すために**必須の証拠語**（＝本当に商材に関係する層）」。
- YouTube 検索は**関連度ランキング依存で網羅的でない**。広すぎる単語は母数だけ増えてノイズになる。

## B. 設計原則（効く検索の作り方）

1. **シーン × ニーズの掛け合わせ**：商品名で探さない。「使う場面の語」×「その商材が満たすニーズ語」の
   2語複合にする。例：×「ポータブル電源」→ ○「車中泊 ポータブル電源」「電動リール バッテリー」。
2. **ティア設計**：tier1=意図が最も濃い複合語（シーン×ニーズ直撃）、tier2=テーマ中核のやや広い語、
   tier3=周辺・拡張。tier1 を厚くするほど上位が狙った層になる。
3. **ノイズ除去の二段構え**：
   - `exclude_title_keywords`＝**隣接するが対象外**のジャンルを弾く（例：星→占い、釣り→バス釣り）。
   - `require_keywords`（theme_overrides）＝**実際に使っている証拠語**を必須化（例：釣りは魚探/電動リール）。
4. **セグメント別チューニング**：母数や再生相場が違うサブテーマは `theme_overrides` でしきい値を変える
   （例：星空は母数小→`avg_views_min` を別設定）。
5. **クオータ設計**：tier1+2+3 の語数 × 100 が概算消費。`max_searches_per_run` でキャップ。
   `results_per_keyword=50` 固定が最も取得効率がよい。広い語を削り、複合語に予算を寄せる。
6. **日本語検索の癖**：`region_code=JP` / `language=ja`。実際に人が打つ自然な語順・表記（俗称含む。
   例「ポタ赤」「電視観望」）を入れると関連層を直撃できる。

---

## C. 生成プロンプト（これをLLMに渡す）

> 役割: あなたはインフルエンサーマーケティングと YouTube 検索に精通したリサーチャーです。
> 下記「YouTuber スクリーナー」アプリ用に、案件ブリーフから**効率的な検索設定**を生成してください。
>
> ### アプリの仕組み（必ず踏まえる）
> - 検索は `search.list` をキーワードごとに実行（1語=100クオータ、最大50件/回）。語の選定がコストと精度を支配。
> - キーワードは tier1/2/3。tier1 ヒットほどスコアが高い。
> - フィルタ: 登録者数min/max・avg_views_min・engagement_min・min_video_count・active_within_days。
> - exclude_title_keywords=含むと除外。competitor_flag_keywords=言及を印付け。
> - theme_overrides=テーマ別に avg_views_min/engagement_min/require_keywords を上書き
>   （require_keywords=そのテーマで残す必須の"使用証拠"語）。
> - YouTube検索は関連度依存で網羅的でない。広すぎる単語は母数だけ増えノイズ。
>
> ### 設計原則
> 1. シーン×ニーズの掛け合わせ（商品名でなく「使う場面語＋ニーズ語」の複合）
> 2. ティア設計（tier1=意図最濃の複合語 / tier2=テーマ中核 / tier3=拡張）
> 3. ノイズ除去（隣接ジャンルは exclude、"実使用の証拠語"は theme_overrides の require_keywords）
> 4. セグメント別に theme_overrides でしきい値調整
> 5. クオータ: 語数×100。広い単独語を避け複合語に予算を寄せる
>
> ### 入力（ブリーフ）
> - 商材／一言の特徴:
> - 想定する利用シーン（複数）:
> - ターゲット視聴者像:
> - 競合・代替製品:
> - 起用したいチャンネル規模（登録者）:
> - 地域・言語（既定 JP / ja）:
>
> ### 出力フォーマット（アプリにそのまま貼れる形で）
> - **keywords_tier1**（改行区切り。各語は「シーン語＋ニーズ語」の複合にする）
> - **keywords_tier2** / **keywords_tier3**（改行区切り）
> - **exclude_title_keywords**（改行区切り）
> - **competitor_flag_keywords**（改行区切り）
> - **filters**（JSON: subscriber_min/max, avg_views_min, engagement_min, min_video_count, active_within_days）
> - **theme_overrides**（JSON。サブテーマ別のしきい値や require_keywords。不要なら {} ）
> - **scoring_weights**（JSON: scene_match/engagement/recent_activity/subscriber_fit、合計100目安）
> - **設計意図メモ**（各tierの狙い／除外理由／クオータ概算＝語数×100）
>
> ### 出力前のセルフチェック
> - tier1 の各語は「単独の広い語」でなく**複合語**になっているか？
> - 隣接ノイズ（似て非なるジャンル）を exclude したか？
> - "実際に商材を使う層"を require_keywords で担保したか？
> - クオータ概算（語数×100）が予算内（無料枠10,000）に収まるか？

---

## D. 完成例（few-shot：Jackery ポータブル電源）

このプロンプトに次のブリーフを与えると、本アプリで実証済みの設定が得られる想定。

**入力**
- 商材: ポータブル電源／ソーラーパネル（屋外で大電力）
- 利用シーン: 車中泊・防災・船釣り（電動リール/魚探）・天体撮影（赤道儀/電視観望）
- ターゲット: 屋外で電力を食う機材を使う"ガチ勢"
- 競合: EcoFlow, BLUETTI, Anker, PowerArQ, 電力丸, スーパーリチウム
- 規模: 登録者 2,000〜150,000
- 地域: JP / ja

**出力（抜粋）**
- tier1: `電動リール バッテリー` / `魚群探知機 取り付け` / `電視観望` / `赤道儀 自動導入` …
- tier2: `船釣り` / `ジギング 電動` / `星空撮影` / `天体望遠鏡 おすすめ` …
- exclude: `バス釣り` / `占い` / `星座占い` / `切り抜き` …
- competitor_flag: `EcoFlow` / `BLUETTI` / `BMO` / `スーパーリチウム` …
- theme_overrides: `星空 → avg_views_min: 10000` / `釣り → require_keywords: [魚探, 電動リール, 中深場, …]`
- scoring_weights: `scene_match:35, engagement:30, recent_activity:20, subscriber_fit:15`

**狙い**: tier1で「電力を食うガジェット使用」を直撃、釣りは require_keywords で実使用者に限定、
星空は母数が小さいので別しきい値、隣接の淡水バス/占いは exclude で除去。
