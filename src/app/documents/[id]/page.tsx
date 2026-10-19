import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentViewer } from "@/components/docs/DocumentViewer";
import type { DocumentRow, MemberRole } from "@/types/db";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (!doc || !user) notFound(); // 멤버가 아니면 RLS 로 조회 불가

  const [{ data: versions }, { data: member }] = await Promise.all([
    supabase.from("document_versions").select("version, size_bytes, created_at, checksum_sha256")
      .eq("document_id", id).order("version", { ascending: false }),
    supabase.from("room_members").select("role").eq("room_id", doc.room_id).eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <DocumentViewer
      doc={doc as DocumentRow}
      versions={versions ?? []}
      myRole={(member?.role ?? "member") as MemberRole}
    />
  );
}
