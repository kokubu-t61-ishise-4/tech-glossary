"use client";

import { useState, useEffect } from "react";
import { supabase, Term, FollowUp } from "@/lib/supabase";

type ClarificationState = {
  term: string;
  reason: string;
  possibleMeanings: string[];
} | null;

type PreviewData = {
  term: string;
  definition: string;
  category: string;
  usage_scenarios: string[];
  examples: string[];
} | null;

export default function Home() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [clarification, setClarification] = useState<ClarificationState>(null);
  const [contextInput, setContextInput] = useState("");
  const [preview, setPreview] = useState<PreviewData>(null);
  const [isSaving, setIsSaving] = useState(false);

  const categories = [
    "すべて",
    "データベース",
    "ETL",
    "クラウド",
    "プログラミング",
    "データ分析",
    "インフラ",
    "その他",
  ];

  useEffect(() => {
    fetchTerms();
  }, []);

  async function fetchTerms() {
    const { data, error } = await supabase
      .from("terms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching terms:", error);
      return;
    }
    setTerms(data || []);
  }

  async function searchTerm(context?: string) {
    const termToSearch = clarification ? clarification.term : newTerm;
    if (!termToSearch.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: termToSearch, context }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "エラーが発生しました");
        return;
      }

      if (data.needsClarification) {
        setClarification({
          term: termToSearch,
          reason: data.reason,
          possibleMeanings: data.possibleMeanings || [],
        });
        setNewTerm("");
        return;
      }

      setPreview({
        term: termToSearch,
        definition: data.definition,
        category: data.category,
        usage_scenarios: data.usage_scenarios || [],
        examples: data.examples || [],
      });
      setNewTerm("");
      setClarification(null);
      setContextInput("");
    } catch (error) {
      console.error("Error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  async function savePreview() {
    if (!preview) return;

    setIsSaving(true);

    try {
      const { data: inserted, error } = await supabase
        .from("terms")
        .insert({
          term: preview.term,
          definition: preview.definition,
          category: preview.category,
          usage_scenarios: preview.usage_scenarios,
          examples: preview.examples,
          follow_ups: [],
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting term:", error);
        alert("保存に失敗しました");
        return;
      }

      setPreview(null);
      setExpandedTerm(inserted.id);
      fetchTerms();
    } catch (error) {
      console.error("Error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function askFollowUp(term: Term) {
    if (!followUpQuestion.trim()) return;

    setIsAskingFollowUp(true);

    try {
      const response = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: term.term,
          definition: term.definition,
          question: followUpQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "エラーが発生しました");
        return;
      }

      const newFollowUp: FollowUp = {
        question: followUpQuestion,
        answer: data.answer,
      };

      const updatedFollowUps = [...(term.follow_ups || []), newFollowUp];

      const { error } = await supabase
        .from("terms")
        .update({ follow_ups: updatedFollowUps })
        .eq("id", term.id);

      if (error) {
        console.error("Error updating follow-ups:", error);
        alert("保存に失敗しました");
        return;
      }

      setFollowUpQuestion("");
      fetchTerms();
    } catch (error) {
      console.error("Error:", error);
      alert("エラーが発生しました");
    } finally {
      setIsAskingFollowUp(false);
    }
  }

  async function deleteTerm(id: string) {
    if (!confirm("この用語を削除しますか？")) return;

    const { error } = await supabase.from("terms").delete().eq("id", id);

    if (error) {
      console.error("Error deleting term:", error);
      alert("削除に失敗しました");
      return;
    }

    if (expandedTerm === id) {
      setExpandedTerm(null);
    }
    fetchTerms();
  }

  const filteredTerms = terms.filter((term) => {
    const matchesSearch =
      term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      term.definition.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory ||
      selectedCategory === "すべて" ||
      term.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const showResults = showAllTerms || searchQuery.trim() !== "" || selectedCategory !== null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Tech Glossary</h1>
          <p className="text-slate-400">
            新しい用語を入力すると、AIが意味を調べます
          </p>
        </header>

        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-8 border border-slate-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && !clarification && !preview && searchTerm()}
              placeholder="新しい用語を入力... (例: ETL, Airflow, dbt)"
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading || !!clarification || !!preview}
            />
            <button
              onClick={() => searchTerm()}
              disabled={isLoading || !newTerm.trim() || !!clarification || !!preview}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  検索中...
                </span>
              ) : (
                "検索"
              )}
            </button>
          </div>
        </div>

        {clarification && (
          <div className="bg-amber-900/30 backdrop-blur rounded-xl p-6 mb-8 border border-amber-500/50">
            <div className="flex items-start gap-3 mb-4">
              <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-amber-300 mb-1">
                  「{clarification.term}」について確認させてください
                </h3>
                <p className="text-amber-200/80 text-sm">{clarification.reason}</p>
              </div>
            </div>

            {clarification.possibleMeanings.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-2">考えられる意味：</p>
                <div className="space-y-2">
                  {clarification.possibleMeanings.map((meaning, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setContextInput(meaning);
                        searchTerm(meaning);
                      }}
                      disabled={isLoading}
                      className="w-full text-left p-3 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 hover:border-amber-500/50 rounded-lg text-slate-200 text-sm transition-colors disabled:opacity-50"
                    >
                      {meaning}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-2">または、どのような場面で出てきた用語か教えてください：</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isLoading && contextInput.trim() && searchTerm(contextInput)}
                  placeholder="例: BigQueryのクエリを書いているとき、Airflowの設定ファイルで..."
                  className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={() => searchTerm(contextInput)}
                  disabled={isLoading || !contextInput.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
                >
                  {isLoading ? "検索中..." : "この文脈で検索"}
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setClarification(null);
                setContextInput("");
              }}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        )}

        {preview && (
          <div className="bg-emerald-900/30 backdrop-blur rounded-xl p-6 mb-8 border border-emerald-500/50">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-emerald-400 mb-1">検索結果プレビュー</p>
                <h2 className="text-2xl font-bold text-white">{preview.term}</h2>
                <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-600/30 text-blue-300 rounded">
                  {preview.category}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">説明</h3>
              <p className="text-slate-200 leading-relaxed bg-slate-700/30 p-4 rounded-lg whitespace-pre-wrap">
                {preview.definition}
              </p>
            </div>

            {preview.usage_scenarios && preview.usage_scenarios.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-purple-400 mb-2">使用場面</h3>
                <ul className="space-y-2">
                  {preview.usage_scenarios.map((scenario, index) => (
                    <li
                      key={index}
                      className="text-slate-200 bg-purple-900/20 border border-purple-700/30 p-3 rounded-lg flex items-start gap-2"
                    >
                      <span className="text-purple-400 font-bold">{index + 1}.</span>
                      <span>{scenario}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.examples && preview.examples.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-green-400 mb-2">具体例</h3>
                <ul className="space-y-2">
                  {preview.examples.map((example, index) => (
                    <li
                      key={index}
                      className="text-slate-200 bg-green-900/20 border border-green-700/30 p-3 rounded-lg flex items-start gap-2"
                    >
                      <span className="text-green-400 font-bold">{index + 1}.</span>
                      <span>{example}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={savePreview}
                disabled={isSaving}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                {isSaving ? "保存中..." : "この内容で保存する"}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg transition-colors"
              >
                保存しない
              </button>
            </div>
          </div>
        )}

        {expandedTerm && terms.find((t) => t.id === expandedTerm) && (
          <TermDetail
            term={terms.find((t) => t.id === expandedTerm)!}
            onClose={() => setExpandedTerm(null)}
            onDelete={deleteTerm}
            followUpQuestion={followUpQuestion}
            setFollowUpQuestion={setFollowUpQuestion}
            isAskingFollowUp={isAskingFollowUp}
            onAskFollowUp={askFollowUp}
          />
        )}

        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="登録済みの用語を検索..."
              className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedCategory || "すべて"}
              onChange={(e) =>
                setSelectedCategory(
                  e.target.value === "すべて" ? null : e.target.value
                )
              }
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAllTerms(!showAllTerms)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showAllTerms
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600"
              }`}
            >
              {showAllTerms ? "一覧を閉じる" : "一覧表示"}
            </button>
          </div>

          {!showResults ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">
                検索またはカテゴリを選択、または「一覧表示」をクリック
              </p>
              <p className="text-xs mt-2">登録用語数: {terms.length}件</p>
            </div>
          ) : filteredTerms.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>該当する用語が見つかりません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTerms.map((term) => (
                <div key={term.id} className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedTerm(term.id)}
                    className="flex-1 p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-blue-500 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-white">
                        {term.term}
                      </span>
                      <div className="flex items-center gap-2">
                        {term.category && (
                          <span className="px-2 py-1 text-xs bg-blue-600/30 text-blue-300 rounded">
                            {term.category}
                          </span>
                        )}
                        {term.follow_ups && term.follow_ups.length > 0 && (
                          <span className="px-2 py-1 text-xs bg-green-600/30 text-green-300 rounded">
                            Q&A: {term.follow_ups.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteTerm(term.id)}
                    className="p-3 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                    title="削除"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TermDetail({
  term,
  onClose,
  onDelete,
  followUpQuestion,
  setFollowUpQuestion,
  isAskingFollowUp,
  onAskFollowUp,
}: {
  term: Term;
  onClose: () => void;
  onDelete: (id: string) => void;
  followUpQuestion: string;
  setFollowUpQuestion: (q: string) => void;
  isAskingFollowUp: boolean;
  onAskFollowUp: (term: Term) => void;
}) {
  if (!term) return null;

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl p-6 mb-8 border border-blue-500/50">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{term.term}</h2>
          {term.category && (
            <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-600/30 text-blue-300 rounded">
              {term.category}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onDelete(term.id)}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="削除"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="閉じる"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-slate-400 mb-2">説明</h3>
        <p className="text-slate-200 leading-relaxed bg-slate-700/30 p-4 rounded-lg whitespace-pre-wrap">
          {term.definition}
        </p>
      </div>

      {term.usage_scenarios && term.usage_scenarios.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-purple-400 mb-2">使用場面</h3>
          <ul className="space-y-2">
            {term.usage_scenarios.map((scenario, index) => (
              <li
                key={index}
                className="text-slate-200 bg-purple-900/20 border border-purple-700/30 p-3 rounded-lg flex items-start gap-2"
              >
                <span className="text-purple-400 font-bold">{index + 1}.</span>
                <span>{scenario}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {term.examples && term.examples.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-green-400 mb-2">具体例</h3>
          <ul className="space-y-2">
            {term.examples.map((example, index) => (
              <li
                key={index}
                className="text-slate-200 bg-green-900/20 border border-green-700/30 p-3 rounded-lg flex items-start gap-2"
              >
                <span className="text-green-400 font-bold">{index + 1}.</span>
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {term.follow_ups && term.follow_ups.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-400 mb-2">
            追加の質問と回答
          </h3>
          <div className="space-y-3">
            {term.follow_ups.map((fu, index) => (
              <div key={index} className="bg-slate-700/30 p-4 rounded-lg">
                <p className="text-blue-300 text-sm mb-2">Q: {fu.question}</p>
                <p className="text-slate-200 text-sm">A: {fu.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2">
          追加で質問する
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={followUpQuestion}
            onChange={(e) => setFollowUpQuestion(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !isAskingFollowUp && onAskFollowUp(term)
            }
            placeholder="説明の中でわからない言葉があれば質問..."
            className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={isAskingFollowUp}
          />
          <button
            onClick={() => onAskFollowUp(term)}
            disabled={isAskingFollowUp || !followUpQuestion.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
          >
            {isAskingFollowUp ? "質問中..." : "質問"}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        登録日: {new Date(term.created_at).toLocaleDateString("ja-JP")}
      </p>
    </div>
  );
}
