"use client";

import { useState } from "react";
import { BRIEF_TEMPLATE, GENERATOR_PROMPT, PRINCIPLES } from "@/lib/prompt";

export default function GuidePage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold sm:text-xl">検索のコツ / プロンプト</h1>
        <a href="/" className="text-sm text-blue-600 hover:underline">
          ← 検索に戻る
        </a>
      </header>

      {/* 使い方 */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 font-bold">使い方（スマホでもOK）</h2>
        <ol className="list-decimal space-y-1 pl-5 text-gray-700 dark:text-gray-300">
          <li>下の「プロンプトをコピー」を押す</li>
          <li>ChatGPT / Claude などのアプリに貼り、ブリーフ欄を埋めて送信</li>
          <li>出てきた設定を、検索画面の各欄（キーワード等）に貼り付けて検索</li>
        </ol>
      </section>

      {/* プロンプト本体（コピー可能） */}
      <CopyBlock title="生成プロンプト" text={GENERATOR_PROMPT} rows={16} />

      {/* ブリーフだけ単体でコピーしたい場合 */}
      <CopyBlock title="ブリーフ記入テンプレ（任意）" text={BRIEF_TEMPLATE} rows={6} />

      {/* 設計原則 */}
      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-bold">効く検索の5原則</h2>
        <ul className="space-y-3">
          {PRINCIPLES.map((p, i) => (
            <li key={i} className="text-sm">
              <span className="font-semibold">
                {i + 1}. {p.title}
              </span>
              <p className="mt-0.5 text-gray-600 dark:text-gray-400">{p.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CopyBlock({ title, text, rows }: { title: string; text: string; rows: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 古い環境向けのフォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">{title}</h2>
        <button
          onClick={copy}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {copied ? "コピーしました ✓" : "コピー"}
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        rows={rows}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed dark:border-gray-700 dark:bg-gray-800"
      />
    </section>
  );
}
