import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 문서 숨김/복원 (관리자). 물리 삭제 API 는 존재하지 않는다. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { hidden } = await req.json();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabase
    .from("documents")
    .update({ is_hidden: !!hidden, hidden_at: hidden ? new Date().toISOString() : null, hidden_by: hidden ? user.id : null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  // RLS 로 막히면 0 row 갱신 → data null
  if (error || !data) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  await supabase.from("document_access_logs").insert({
    document_id: id, user_id: user.id, action: hidden ? "hide" : "restore",
  });
  return NextResponse.json({ ok: true });
}
