"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Search, MessageCirclePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatListTime } from "@/lib/format";
import type { RoomListItem } from "@/types/db";

export function ChatList({ initialRooms }: { initialRooms: RoomListItem[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { roomId: activeId } = useParams<{ roomId?: string }>();
  const [rooms, setRooms] = useState(initialRooms);
  const [q, setQ] = useState("");

  // 어느 방이든 새 메시지가 오면 목록(정렬·미리보기·안읽음 수) 갱신
  // RLS 덕분에 내가 속한 방의 메시지 이벤트만 수신된다.
  useEffect(() => {
    const refresh = async () => {
      const { data } = await supabase.rpc("get_my_rooms");
      if (data) setRooms(data as RoomListItem[]);
    };
    const ch = supabase
      .channel("room-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .subscribe();
    window.addEventListener("focus", refresh);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", refresh);
    };
  }, [supabase]);

  // 현재 열려있는 방은 안읽음 0 으로 표시
  const visible = rooms
    .map((r) => (r.id === activeId ? { ...r, unread_count: 0 } : r))
    .filter((r) => !q || r.name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="채팅"
        actions={
          <>
            <Search className="size-5" />
            <button title="새 채팅" onClick={() => router.push("/friends?select=1")}>
              <MessageCirclePlus className="size-5" />
            </button>
          </>
        }
      />
      <div className="px-4 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="채팅방 이름 검색"
          className="w-full rounded-full bg-[#f2f2f2] px-4 py-2 text-sm outline-none"
        />
      </div>
      <ul className="scrollbar-thin flex-1 overflow-y-auto">
        {visible.map((r) => (
          <li key={r.id}>
            <Link
              href={`/chats/${r.id}`}
              className={clsx(
                "flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8f8f8]",
                r.id === activeId && "md:bg-[#f0f0f0]",
              )}
            >
              <Avatar src={r.avatar_url} kind={r.type === "direct" ? "user" : r.type} size={50} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[15px] font-semibold">{r.name ?? "알 수 없음"}</span>
                  {r.type !== "direct" && <span className="text-sm text-sub">{r.member_count}</span>}
                  {(r.my_role === "owner" || r.my_role === "admin") && (
                    <span className="rounded bg-brand px-1 text-[10px] font-bold text-brand-ink">관리</span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-sub">{r.last_message_preview}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-1">
                <span className="text-[11px] text-sub">{formatListTime(r.last_message_at)}</span>
                {Number(r.unread_count) > 0 && (
                  <span className="min-w-5 rounded-full bg-unread px-1.5 text-center text-[11px] leading-5 font-bold text-white">
                    {Number(r.unread_count) > 999 ? "999+" : r.unread_count}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
        {visible.length === 0 && <li className="py-20 text-center text-sm text-sub">채팅방이 없습니다.</li>}
      </ul>
    </div>
  );
}
