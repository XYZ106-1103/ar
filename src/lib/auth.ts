import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/types/db";

/** API Route 공통: 로그인 + 방 역할 조회 */
export async function getRoomContext(roomId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) } as const;

  // RLS 상 본인이 멤버인 방만 조회됨 → 결과 없음 = 멤버 아님
  const { data: member } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, role: (member?.role ?? null) as MemberRole | null } as const;
}

export const forbidden = (msg = "권한이 없습니다.") => NextResponse.json({ error: msg }, { status: 403 });
