"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import type { Profile } from "@/types/db";

type SearchResult = Profile & { is_friend: boolean };

/** 이메일(정확히) 또는 이름(부분 일치)으로 검색 → 바로 친구 추가 */
export function AddFriendDialog({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return setError("2글자 이상 입력해 주세요.");
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("search_users", { p_query: q });
    setLoading(false);
    if (error) return setError(error.message);
    setResults((data ?? []) as SearchResult[]);
  };

  const add = async (id: string) => {
    setAdding(id);
    const { error } = await supabase.rpc("add_friend", { p_friend: id });
    setAdding(null);
    if (error) return setError(error.message);
    setResults((rs) => rs?.map((r) => (r.id === id ? { ...r, is_friend: true } : r)) ?? null);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl bg-white md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold">친구 추가</h2>
          <button onClick={onClose} title="닫기"><X className="size-5" /></button>
        </div>
        <form onSubmit={search} className="flex gap-2 px-5 pb-3">
          <input
            autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="이메일 또는 이름"
            className="min-w-0 flex-1 rounded-lg bg-[#f2f2f2] px-3 py-2.5 text-base outline-none"
          />
          <button disabled={loading} className="rounded-lg bg-brand px-3 disabled:opacity-40" title="검색">
            <Search className="size-5" />
          </button>
        </form>
        {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}
        <ul className="scrollbar-thin flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          {results?.length === 0 && <li className="px-5 py-6 text-center text-sm text-sub">검색 결과가 없습니다.</li>}
          {results?.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-2">
              <Avatar src={r.avatar_url} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{r.display_name}</p>
                {r.status_message && <p className="truncate text-xs text-sub">{r.status_message}</p>}
              </div>
              {r.is_friend ? (
                <span className="text-xs text-sub">친구</span>
              ) : (
                <button
                  disabled={adding === r.id} onClick={() => add(r.id)}
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                >
                  추가
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
