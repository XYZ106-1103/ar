"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, Menu, Loader2, AlertCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { canUploadDocument } from "@/lib/permissions";
import { formatDateDivider } from "@/lib/format";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { RoomDrawer } from "./RoomDrawer";
import type { MemberRole, Message, Profile, RoomType } from "@/types/db";

export interface RoomMember extends Profile {
  role: MemberRole;
  last_read_at: string;
}

interface Props {
  room: { id: string; type: RoomType; name: string };
  me: string;
  myRole: MemberRole;
  initialMembers: RoomMember[];
  initialMessages: Message[];
}

const sameMinute = (a: string, b: string) => a.slice(0, 16) === b.slice(0, 16);
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

export function ChatRoom({ room, me, myRole, initialMembers, initialMessages }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { messages, hasMore, loadOlder, sendText, appendMessage } = useRealtimeMessages(room.id, me, initialMessages);
  const { state: upload, upload: uploadFile, reset } = useDocumentUpload(room.id, appendMessage);
  const [members, setMembers] = useState(initialMembers);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef(0);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const canUpload = canUploadDocument(myRole);

  // 다른 멤버의 읽음 시각 실시간 반영 → 안읽음 숫자 감소
  useEffect(() => {
    const ch = supabase
      .channel(`members:${room.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` },
        (p) => {
          const row = p.new as { user_id: string; last_read_at: string; role: MemberRole };
          setMembers((prev) => prev.map((m) => (m.id === row.user_id ? { ...m, last_read_at: row.last_read_at, role: row.role } : m)));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, room.id]);

  // 스크롤: 새 메시지 → 맨 아래 / 과거 로드 → 위치 유지
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    else if (prevHeight.current) el.scrollTop += el.scrollHeight - prevHeight.current;
    prevHeight.current = 0;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current!;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore) {
      prevHeight.current = el.scrollHeight;
      loadOlder();
    }
  };

  const unreadOf = (m: Message) =>
    m.pending ? 0 : members.filter((x) => x.id !== m.sender_id && x.last_read_at < m.created_at).length;

  return (
    <div className="relative flex h-full flex-col bg-chat-bg">
      {/* 헤더 */}
      <header className="flex h-14 shrink-0 items-center gap-2 bg-chat-bg/95 px-2 backdrop-blur md:h-16 md:px-4">
        <Link href="/chats" className="p-1 md:hidden" aria-label="뒤로">
          <ChevronLeft className="size-7" />
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold">
          {room.name}
          {room.type !== "direct" && <span className="ml-1.5 text-[15px] font-normal text-[#5b6b7b]">{members.length}</span>}
        </h2>
        <Search className="size-5 text-[#333]" />
        <button onClick={() => setDrawerOpen(true)} className="p-1" aria-label="채팅방 서랍">
          <Menu className="size-6 text-[#333]" />
        </button>
      </header>

      {/* 메시지 목록 */}
      <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto pb-3">
        {hasMore && <div className="py-3 text-center text-xs text-[#5b6b7b]">이전 대화 불러오는 중…</div>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || !sameDay(prev.created_at, m.created_at);
          const groupedWithPrev = !!prev && !newDay && prev.type !== "system" &&
            prev.sender_id === m.sender_id && sameMinute(prev.created_at, m.created_at);
          const groupedWithNext = !!next && next.type !== "system" && next.sender_id === m.sender_id &&
            sameMinute(next.created_at, m.created_at) && sameDay(next.created_at, m.created_at);
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-black/15 px-3 py-1 text-[12px] text-white">
                    {formatDateDivider(m.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={m}
                isMine={m.sender_id === me}
                sender={m.sender_id ? memberMap.get(m.sender_id) : undefined}
                showProfile={!groupedWithPrev}
                showTime={!groupedWithNext}
                unread={unreadOf(m)}
              />
            </div>
          );
        })}
      </div>

      {/* 업로드 진행 상태 */}
      {upload.status !== "idle" && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-sm shadow">
          {upload.status === "error" ? (
            <>
              <AlertCircle className="size-4 text-red-500" />
              <span className="flex-1 truncate">{upload.fileName}: {upload.error}</span>
              <button onClick={reset}><X className="size-4" /></button>
            </>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span className="flex-1 truncate">{upload.fileName}</span>
              <span className="text-xs text-sub">
                {upload.status === "hashing" ? "검증 중" : upload.status === "saving" ? "보관 처리 중"
                  : `${Math.round(upload.progress * 100)}%`}
              </span>
            </>
          )}
        </div>
      )}

      <MessageInput
        canUpload={canUpload}
        onSend={(t) => { stickToBottom.current = true; sendText(t); }}
        onPickFile={(f) => { stickToBottom.current = true; uploadFile(f); }}
      />

      <RoomDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        roomId={room.id}
        roomType={room.type}
        me={me}
        myRole={myRole}
        members={members}
      />
    </div>
  );
}
