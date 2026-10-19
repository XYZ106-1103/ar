"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError("이메일 또는 비밀번호를 확인해 주세요.");
    router.replace("/chats");
    router.refresh();
  }

  return (
    <main className="h-dvh-safe flex items-center justify-center bg-brand px-6">
      <form onSubmit={onSubmit} className="w-full max-w-xs space-y-2">
        <h1 className="mb-10 text-center text-3xl font-black tracking-tight text-brand-ink">ArchiveTalk</h1>
        <input
          type="email" required placeholder="이메일" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-b border-black/10 bg-white px-3 py-3 text-base outline-none"
        />
        <input
          type="password" required placeholder="비밀번호" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white px-3 py-3 text-base outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="mt-2 w-full rounded bg-[#423630] py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </main>
  );
}
