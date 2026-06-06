"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChannelResult,
  JobStatus,
  Stats,
  clearToken,
  downloadExcel,
  getStatus,
  getToken,
  startSearch,
} from "@/lib/api";
import {
  DEFAULT_FORM,
  FormState,
  deletePreset,
  formToConfig,
  loadPresets,
  savePreset,
} from "@/lib/defaults";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PHASE_LABEL: Record<string, string> = {
  queued: "準備中",
  searching: "キーワード検索中",
  details: "チャンネル詳細取得中",
  scoring: "絞り込み・スコア計算中",
};

export default function Home() {
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<JobStatus["progress"] | null>(null);
  const [results, setResults] = useState<ChannelResult[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  // 認証ガード
  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
    } else {
      setReady(true);
    }
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function runSearch() {
    setError("");
    setResults(null);
    setStats(null);
    let cfg: Record<string, unknown>;
    try {
      cfg = formToConfig(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定エラー");
      return;
    }
    setRunning(true);
    setProgress({ phase: "queued", done: 0, total: 0 });
    let id: string | null = null;
    try {
      id = await startSearch(cfg);
      setJobId(id);
      for (;;) {
        await sleep(1200);
        const st = await getStatus(id);
        setProgress(st.progress);
        if (st.status === "done") {
          setResults(st.results || []);
          setStats(st.stats || null);
          break;
        }
        if (st.status === "error") {
          setError(st.error || "検索中にエラーが発生しました。");
          break;
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message === "unauthorized") {
        clearToken();
        window.location.href = "/login";
        return;
      }
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setRunning(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold sm:text-xl">YouTuber スクリーナー</h1>
        <div className="flex items-center gap-4 text-sm">
          <a href="/guide" className="text-blue-600 hover:underline">
            検索のコツ
          </a>
          <button
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
            className="text-gray-500 hover:underline"
          >
            ログアウト
          </button>
        </div>
      </header>

      <SearchForm
        form={form}
        update={update}
        setForm={setForm}
        running={running}
        onRun={runSearch}
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {running && progress && <ProgressBar progress={progress} />}

      {stats && <StatsBar stats={stats} />}

      {results && (
        <ResultsTable results={results} jobId={jobId} onError={setError} />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* フォーム                                                               */
/* --------------------------------------------------------------------- */
function SearchForm({
  form,
  update,
  setForm,
  running,
  onRun,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  setForm: (f: FormState) => void;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      <PresetBar form={form} setForm={setForm} />

      {/* シンプル表示 */}
      <label className="mb-1 block text-sm font-semibold">検索キーワード（1行に1つ）</label>
      <textarea
        value={form.keywordsTier1}
        onChange={(e) => update("keywordsTier1", e.target.value)}
        rows={5}
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800"
        placeholder="例: 電動リール バッテリー"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumField label="登録者数 下限" value={form.subMin} onChange={(v) => update("subMin", v)} />
        <NumField label="登録者数 上限" value={form.subMax} onChange={(v) => update("subMax", v)} />
        <NumField label="平均再生数 下限" value={form.avgViewsMin} onChange={(v) => update("avgViewsMin", v)} />
        <TextField label="地域コード" value={form.region} onChange={(v) => update("region", v)} />
        <NumField label="件数/キーワード" value={form.resultsPerKeyword} onChange={(v) => update("resultsPerKeyword", v === "" ? 50 : v)} />
        <NumField label="検索上限(回)" value={form.maxSearchesPerRun} onChange={(v) => update("maxSearchesPerRun", v === "" ? 30 : v)} />
      </div>

      {/* 詳細設定（折りたたみ） */}
      <details className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
          詳細設定（キーワード階層・除外語・テーマ別上書き・スコア重み）
        </summary>

        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextArea label="キーワード tier2（やや広め）" value={form.keywordsTier2} onChange={(v) => update("keywordsTier2", v)} />
            <TextArea label="キーワード tier3（拡張）" value={form.keywordsTier3} onChange={(v) => update("keywordsTier3", v)} />
            <TextArea label="除外語（タイトル/説明に含むと除外）" value={form.excludeTitle} onChange={(v) => update("excludeTitle", v)} />
            <TextArea label="競合フラグ語（言及を印付け）" value={form.competitorFlags} onChange={(v) => update("competitorFlags", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField label="エンゲージ率 下限" value={form.engagementMin} step="0.01" onChange={(v) => update("engagementMin", v)} />
            <NumField label="動画本数 下限" value={form.minVideoCount} onChange={(v) => update("minVideoCount", v)} />
            <NumField label="直近活動(日以内)" value={form.activeWithinDays} onChange={(v) => update("activeWithinDays", v)} />
            <NumField label="平均算出 本数" value={form.recentVideoCount} onChange={(v) => update("recentVideoCount", v === "" ? 10 : v)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              テーマ別の上書き（JSON）
            </label>
            <textarea
              value={form.themeOverridesJson}
              onChange={(e) => update("themeOverridesJson", e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
            />
            <p className="mt-1 text-xs text-gray-500">
              例: 星空テーマだけ平均再生数の下限を上げる、釣りは必須キーワードを指定する等。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">スコア重み</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="テーマ適合" value={form.sceneMatch} onChange={(v) => update("sceneMatch", v === "" ? 0 : v)} />
              <NumField label="エンゲージ" value={form.engagement} onChange={(v) => update("engagement", v === "" ? 0 : v)} />
              <NumField label="直近活動" value={form.recentActivity} onChange={(v) => update("recentActivity", v === "" ? 0 : v)} />
              <NumField label="登録者帯フィット" value={form.subscriberFit} onChange={(v) => update("subscriberFit", v === "" ? 0 : v)} />
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.multiKeywordBonus}
                onChange={(e) => update("multiKeywordBonus", e.target.checked)}
              />
              複数ティアにヒットしたら加点する
            </label>
          </div>
        </div>
      </details>

      <button
        onClick={onRun}
        disabled={running}
        className="mt-4 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {running ? "検索中..." : "検索する"}
      </button>
    </section>
  );
}

/* プリセット（ブラウザ保存） */
function PresetBar({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [sel, setSel] = useState("");

  useEffect(() => setNames(Object.keys(loadPresets())), []);

  function refresh() {
    setNames(Object.keys(loadPresets()));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <select
        value={sel}
        onChange={(e) => {
          const name = e.target.value;
          setSel(name);
          if (name) {
            const p = loadPresets()[name];
            if (p) setForm(p);
          }
        }}
        className="rounded-lg border border-gray-300 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800"
      >
        <option value="">プリセットを選択…</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          const name = prompt("プリセット名を入力");
          if (name) {
            savePreset(name, form);
            refresh();
            setSel(name);
          }
        }}
        className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        現在の条件を保存
      </button>
      {sel && (
        <button
          onClick={() => {
            deletePreset(sel);
            setSel("");
            refresh();
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:border-gray-700"
        >
          削除
        </button>
      )}
      <button
        onClick={() => setForm(DEFAULT_FORM)}
        className="ml-auto text-gray-500 hover:underline"
      >
        初期条件に戻す
      </button>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* 進捗・統計                                                             */
/* --------------------------------------------------------------------- */
function ProgressBar({ progress }: { progress: JobStatus["progress"] }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>{PHASE_LABEL[progress.phase] || progress.phase}</span>
        <span>
          {progress.done}/{progress.total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
      <span>検索ヒット: <b>{stats.unique_channels}</b></span>
      <span>絞り込み後: <b>{stats.after_cheap_filter}</b></span>
      <span>最終: <b className="text-gray-900 dark:text-gray-100">{stats.final}</b> 件</span>
      <span>クオータ消費: <b>{stats.quota_used}</b> (API検索 {stats.api_searches}回)</span>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* 結果テーブル                                                           */
/* --------------------------------------------------------------------- */
type SortKey = "score" | "subscriber_count" | "avg_views" | "engagement" | "video_count";

function ResultsTable({
  results,
  jobId,
  onError,
}: {
  results: ChannelResult[];
  jobId: string | null;
  onError: (m: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [themeFilter, setThemeFilter] = useState("");

  const themes = useMemo(
    () => Array.from(new Set(results.map((r) => r.theme))).sort(),
    [results],
  );

  const rows = useMemo(() => {
    let r = results;
    if (themeFilter) r = r.filter((x) => x.theme === themeFilter);
    return [...r].sort((a, b) => {
      const av = (a[sortKey] as number) ?? -1;
      const bv = (b[sortKey] as number) ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [results, sortKey, sortDir, themeFilter]);

  function header(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <th
        onClick={() => {
          if (active) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
          else {
            setSortKey(key);
            setSortDir("desc");
          }
        }}
        className="cursor-pointer whitespace-nowrap px-3 py-2 text-right hover:text-blue-600"
      >
        {label} {active ? (sortDir === "desc" ? "▼" : "▲") : ""}
      </th>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold">結果 {rows.length} 件</h2>
        <select
          value={themeFilter}
          onChange={(e) => setThemeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">全テーマ</option>
          {themes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={async () => {
            if (!jobId) return;
            try {
              await downloadExcel(jobId);
            } catch (e) {
              onError(e instanceof Error ? e.message : "ダウンロード失敗");
            }
          }}
          className="ml-auto rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
        >
          Excelダウンロード
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <tr>
              {header("スコア", "score")}
              <th className="px-3 py-2 text-left">チャンネル</th>
              <th className="px-3 py-2 text-left">テーマ</th>
              {header("登録者", "subscriber_count")}
              {header("平均再生", "avg_views")}
              {header("ｴﾝｹﾞｰｼﾞ", "engagement")}
              {header("動画数", "video_count")}
              <th className="px-3 py-2 text-left">最終投稿</th>
              <th className="px-3 py-2 text-left">メール候補</th>
              <th className="px-3 py-2 text-left">競合</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.url}
                className={i % 2 ? "bg-white dark:bg-gray-900" : "bg-gray-50/40 dark:bg-gray-900/40"}
              >
                <td className="px-3 py-2 text-right font-semibold">{r.score}</td>
                <td className="px-3 py-2">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {r.title}
                  </a>
                </td>
                <td className="px-3 py-2">{r.theme}</td>
                <td className="px-3 py-2 text-right">{fmt(r.subscriber_count)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.avg_views)}</td>
                <td className="px-3 py-2 text-right">{pct(r.engagement)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.video_count)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{(r.last_upload || "").slice(0, 10)}</td>
                <td className="px-3 py-2 text-xs">
                  {(r.emails || []).map((e, j) => (
                    <a key={j} href={`mailto:${e}`} className="block text-blue-600 hover:underline">
                      {e}
                    </a>
                  ))}
                </td>
                <td className="px-3 py-2 text-xs text-orange-600">
                  {r.competitor_flags.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- */
/* 小物                                                                   */
/* --------------------------------------------------------------------- */
function fmt(n: number | null): string {
  return n == null ? "-" : Math.round(n).toLocaleString();
}
function pct(n: number | null): string {
  return n == null ? "-" : `${(n * 100).toFixed(1)}%`;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-600 dark:text-gray-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-600 dark:text-gray-400">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
      />
    </label>
  );
}
