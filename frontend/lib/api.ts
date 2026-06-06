// バックエンド(FastAPI)との通信クライアント。

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export type ChannelResult = {
  score: number;
  title: string;
  theme: string;
  subscriber_count: number | null;
  avg_views: number | null;
  engagement: number | null;
  video_count: number | null;
  last_upload: string | null;
  published_at: string | null;
  view_count: number | null;
  matched_keywords: string[];
  competitor_flags: string[];
  emails: string[];
  url: string;
};

export type Stats = {
  unique_channels: number;
  after_cheap_filter: number;
  final: number;
  quota_used: number;
  api_searches: number;
  drop_stage1: Record<string, number>;
  drop_stage2: Record<string, number>;
};

export type JobStatus = {
  status: "running" | "done" | "error";
  progress: { phase: string; done: number; total: number };
  error: string | null;
  results?: ChannelResult[];
  stats?: Stats;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
export function setToken(t: string) {
  localStorage.setItem("token", t);
}
export function clearToken() {
  localStorage.removeItem("token");
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "ログインに失敗しました。");
  }
  const data = await res.json();
  return data.token as string;
}

export async function startSearch(config: unknown): Promise<string> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(config),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "検索の開始に失敗しました。");
  return data.job_id as string;
}

export async function getStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/search/${jobId}`, {
    headers: authHeaders(),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "状態取得に失敗しました。");
  }
  return res.json();
}

// Excel をダウンロード（認証ヘッダ付き fetch → Blob）。
export async function downloadExcel(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/export/${jobId}.xlsx`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Excelの取得に失敗しました。");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "youtubers.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
