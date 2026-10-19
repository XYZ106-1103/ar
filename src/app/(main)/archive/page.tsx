import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArchiveBrowser } from "@/components/docs/ArchiveBrowser";
import type { DocumentRow, RoomListItem } from "@/types/db";

/** 내가 속한 모든 방의 영구보관 문서를 한 곳에서 (카톡에 없는 기능) */
export default async function ArchivePage() {
  const supabase = await createClient();
  const [{ data: rooms }, { data: docs }] = await Promise.all([
    supabase.rpc("get_my_rooms"),
    supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const roomNames = Object.fromEntries(((rooms ?? []) as RoomListItem[]).map((r) => [r.id, r.name ?? "대화"]));

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="보관함" />
      <ArchiveBrowser docs={(docs ?? []) as DocumentRow[]} roomNames={roomNames} />
    </div>
  );
}
