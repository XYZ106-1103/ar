import { notFound } from "next/navigation";
import { ChatRoom, type RoomMember } from "@/components/chat/ChatRoom";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Message, Profile } from "@/types/db";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // RLS: 멤버가 아니면 room 이 조회되지 않음 → 404
  const [{ data: room }, { data: memberRows }, { data: msgs }] = await Promise.all([
    supabase.from("rooms").select("id, type, name").eq("id", roomId).maybeSingle(),
    supabase.from("room_members").select("role, last_read_at, profile:profiles(id, display_name, avatar_url, status_message)").eq("room_id", roomId),
    supabase.from("messages").select("*, document:documents(*)").eq("room_id", roomId)
      .order("created_at", { ascending: false }).limit(50),
  ]);
  if (!room) notFound();

  const members: RoomMember[] = (memberRows ?? []).map((r) => {
    const p = r.profile as unknown as Profile;
    return { ...p, role: r.role as MemberRole, last_read_at: r.last_read_at };
  });
  const myRole = members.find((m) => m.id === user.id)?.role ?? "member";
  const others = members.filter((m) => m.id !== user.id);
  const name = room.name ?? others.map((m) => m.display_name).join(", ") ?? "대화";

  return (
    <ChatRoom
      key={roomId}
      room={{ id: room.id, type: room.type, name }}
      me={user.id}
      myRole={myRole}
      initialMembers={members}
      initialMessages={((msgs ?? []) as Message[]).reverse()}
    />
  );
}
