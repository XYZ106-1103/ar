"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { X, Crown, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { DocumentList } from "@/components/docs/DocumentList";
import { canManageMembers } from "@/lib/permissions";
import type { DocumentRow, MemberRole, RoomType } from "@/types/db";
import type { RoomMember } from "./ChatRoom";

/** 카톡 "채팅방 서랍" — 우측 슬라이드 패널: 영구보관 문서함 + 대화상대(권한 관리) */
export function RoomDrawer({
  open, onClose, roomId, roomType, me, myRole, members,
}: {
  open: boolean; onClose: () => void; roomId: string; roomType: RoomType;
  me: string; myRole: MemberRole; members: RoomMember[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("documents").select("*").eq("room_id", roomId).order("created_at", { ascending: false })
      .then(({ data }) => setDocs((data ?? []) as DocumentRow[]));
  }, [open, supabase, roomId]);

  const setRole = async (userId: string, role: Exclude<MemberRole, "owner">) => {
    const { error } = await supabase.rpc("set_member_role", { p_room: roomId, p_user: userId, p_role: role });
    if (error) alert(error.message);
    // 성공 시 room_members UPDATE 실시간 이벤트로 목록이 갱신된다.
  };

  const roleBadge = (role: MemberRole) =>
    role === "owner" ? <Crown className="size-3.5 text-[#f5b400]" fill="currentColor" />
      : role === "admin" ? <ShieldCheck className="size-3.5 text-[#2f8f5b]" /> : null;

  return (
    <>
      <div
        onClick={onClose}
        className={clsx("absolute inset-0 z-30 bg-black/40 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        className={clsx(
          "absolute top-0 right-0 z-40 flex h-full w-[85%] max-w-[360px] flex-col bg-white shadow-xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex h-14 items-center justify-between border-b border-line px-4">
          <h3 className="font-semibold">채팅방 서랍</h3>
          <button onClick={onClose}><X className="size-5" /></button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <section className="border-b-8 border-[#f5f5f5] p-4">
            <h4 className="mb-1 text-sm font-semibold">영구보관 문서 <span className="text-sub">{docs.length}</span></h4>
            <p className="mb-3 text-[11px] text-sub">이 방의 문서는 만료되지 않으며 언제든 열람·다운로드할 수 있습니다.</p>
            <DocumentList docs={docs} compact />
          </section>

          <section className="p-4">
            <h4 className="mb-3 text-sm font-semibold">대화상대 <span className="text-sub">{members.length}</span></h4>
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <Avatar src={m.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm">
                      {m.id === me && <span className="rounded bg-[#555] px-1 text-[10px] text-white">나</span>}
                      {m.display_name} {roleBadge(m.role)}
                    </p>
                    <p className="text-[11px] text-sub">
                      {m.role === "owner" ? "방장 · 문서 관리" : m.role === "admin" ? "문서 관리자" : "열람 가능"}
                    </p>
                  </div>
                  {canManageMembers(myRole) && roomType !== "direct" && m.role !== "owner" && (
                    <button
                      onClick={() => setRole(m.id, m.role === "admin" ? "member" : "admin")}
                      className="rounded border border-line px-2 py-1 text-[11px] hover:bg-black/5"
                    >
                      {m.role === "admin" ? "관리자 해제" : "관리자 지정"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
}
