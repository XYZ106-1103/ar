"use client";

import { useState } from "react";
import clsx from "clsx";
import { ShieldCheck } from "lucide-react";
import { DocumentList } from "./DocumentList";
import type { DocumentRow } from "@/types/db";

const FILTERS = [
  { key: "all", label: "전체", test: () => true },
  { key: "pdf", label: "PDF", test: (m: string) => m === "application/pdf" },
  { key: "office", label: "문서", test: (m: string) => /word|sheet|excel|presentation|hwp|text/.test(m) },
  { key: "image", label: "이미지", test: (m: string) => m.startsWith("image/") },
] as const;

export function ArchiveBrowser({ docs, roomNames }: { docs: DocumentRow[]; roomNames: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [room, setRoom] = useState("");

  const test = FILTERS.find((f) => f.key === filter)!.test;
  const visible = docs.filter((d) =>
    test(d.mime_type) && (!room || d.room_id === room) &&
    (!q || d.title.toLowerCase().includes(q.toLowerCase()) || d.file_name.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-6 md:px-8">
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-[#eef7f1] p-3 text-[12px] text-[#2f6b4a]">
        <ShieldCheck className="size-4 shrink-0" />
        보관함의 문서는 기간 만료 없이 클라우드에 영구 보존되며, 버전 이력과 열람 기록이 함께 저장됩니다.
      </div>
      <div className="mb-3 flex flex-col gap-2 md:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="문서 이름 검색"
          className="flex-1 rounded-full bg-[#f2f2f2] px-4 py-2 text-sm outline-none" />
        <select value={room} onChange={(e) => setRoom(e.target.value)}
          className="rounded-full bg-[#f2f2f2] px-4 py-2 text-sm outline-none">
          <option value="">모든 채팅방</option>
          {Object.entries(roomNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={clsx("rounded-full border px-3 py-1 text-xs",
              filter === f.key ? "border-black bg-black text-white" : "border-line text-[#555]")}>
            {f.label}
          </button>
        ))}
      </div>
      <DocumentList docs={visible} roomNames={roomNames} />
    </div>
  );
}
