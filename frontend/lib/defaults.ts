// フォームの状態と、バックエンドへ送る設定への変換。
// 初期値は現行の「Jackery 釣りガジェット/星空」プリセット。

export type FormState = {
  keywordsTier1: string;
  keywordsTier2: string;
  keywordsTier3: string;
  region: string;
  resultsPerKeyword: number;
  searchOrder: string;
  maxSearchesPerRun: number;
  recentVideoCount: number;
  subMin: number | "";
  subMax: number | "";
  avgViewsMin: number | "";
  engagementMin: number | "";
  minVideoCount: number | "";
  activeWithinDays: number | "";
  excludeTitle: string;
  competitorFlags: string;
  themeOverridesJson: string;
  sceneMatch: number;
  engagement: number;
  recentActivity: number;
  subscriberFit: number;
  multiKeywordBonus: boolean;
};

export const DEFAULT_FORM: FormState = {
  keywordsTier1: [
    "電動リール バッテリー",
    "電動リール インプレ",
    "魚群探知機 取り付け",
    "GPS魚探",
    "中深場 釣り",
    "電視観望",
    "赤道儀 自動導入",
    "ポータブル赤道儀",
    "天体撮影 機材",
  ].join("\n"),
  keywordsTier2: [
    "船釣り",
    "沖釣り",
    "ジギング 電動",
    "タイラバ",
    "ミニボート 釣り",
    "ホンデックス",
    "ガーミン 魚探",
    "星空撮影",
    "天体観測",
    "星景写真",
    "天体望遠鏡 おすすめ",
    "ディープスカイ 撮影",
  ].join("\n"),
  keywordsTier3: [
    "ボート釣り",
    "深場釣り",
    "釣り 装備 こだわり",
    "ポタ赤",
    "星雲 撮影",
    "天の川 撮影",
    "星空 タイムラプス",
  ].join("\n"),
  region: "JP",
  resultsPerKeyword: 50,
  searchOrder: "relevance",
  maxSearchesPerRun: 30,
  recentVideoCount: 10,
  subMin: 2000,
  subMax: 150000,
  avgViewsMin: 1500,
  engagementMin: 0.03,
  minVideoCount: 15,
  activeWithinDays: 180,
  excludeTitle: ["海外", "英語", "切り抜き", "ゲーム実況", "占い", "星座占い", "スピリチュアル", "バス釣り"].join("\n"),
  competitorFlags: ["EcoFlow", "エコフロー", "BLUETTI", "ブルーティ", "Anker", "アンカー", "PowerArQ", "BMO", "スーパーリチウム", "電力丸"].join("\n"),
  themeOverridesJson: JSON.stringify(
    {
      星空: { avg_views_min: 10000 },
      釣り: {
        require_keywords: [
          "電動リール", "魚群探知機", "魚探", "GPS魚探", "振動子",
          "ホンデックス", "ガーミン", "ローランス", "ライブスコープ",
          "パノプティクス", "電力丸", "スーパーリチウム", "BMO", "中深場", "深場",
        ],
      },
    },
    null,
    2,
  ),
  sceneMatch: 35,
  engagement: 30,
  recentActivity: 20,
  subscriberFit: 15,
  multiKeywordBonus: true,
};

function lines(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function numOrUndef(v: number | ""): number | undefined {
  return v === "" ? undefined : v;
}

export function formToConfig(f: FormState): Record<string, unknown> {
  let themeOverrides: unknown = {};
  try {
    themeOverrides = f.themeOverridesJson.trim() ? JSON.parse(f.themeOverridesJson) : {};
  } catch {
    throw new Error("テーマ別上書き(JSON)の形式が正しくありません。");
  }
  return {
    region_code: f.region,
    language: "ja",
    results_per_keyword: f.resultsPerKeyword,
    search_order: f.searchOrder,
    max_searches_per_run: f.maxSearchesPerRun,
    recent_video_count: f.recentVideoCount,
    keywords_tier1: lines(f.keywordsTier1),
    keywords_tier2: lines(f.keywordsTier2),
    keywords_tier3: lines(f.keywordsTier3),
    exclude_title_keywords: lines(f.excludeTitle),
    competitor_flag_keywords: lines(f.competitorFlags),
    filters: {
      subscriber_min: numOrUndef(f.subMin),
      subscriber_max: numOrUndef(f.subMax),
      avg_views_min: numOrUndef(f.avgViewsMin),
      engagement_min: numOrUndef(f.engagementMin),
      min_video_count: numOrUndef(f.minVideoCount),
      active_within_days: numOrUndef(f.activeWithinDays),
    },
    theme_overrides: themeOverrides,
    scoring_weights: {
      scene_match: f.sceneMatch,
      engagement: f.engagement,
      recent_activity: f.recentActivity,
      subscriber_fit: f.subscriberFit,
    },
    multi_keyword_bonus: f.multiKeywordBonus,
  };
}

const PRESET_KEY = "yt_presets";

export function loadPresets(): Record<string, FormState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) || "{}");
  } catch {
    return {};
  }
}

export function savePreset(name: string, form: FormState) {
  const all = loadPresets();
  all[name] = form;
  localStorage.setItem(PRESET_KEY, JSON.stringify(all));
}

export function deletePreset(name: string) {
  const all = loadPresets();
  delete all[name];
  localStorage.setItem(PRESET_KEY, JSON.stringify(all));
}
