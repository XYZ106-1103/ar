import { ChatList } from "@/components/chat/ChatList";
import { ChatsShell } from "@/components/chat/ChatsShell";
import { createClient } from "@/lib/supabase/server";
import type { RoomListItem } from "@/types/db";

export default async function ChatsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_rooms");
  return <ChatsShell list={<ChatList initialRooms={(data ?? []) as RoomListItem[]} />}>{children}</ChatsShell>;
}
