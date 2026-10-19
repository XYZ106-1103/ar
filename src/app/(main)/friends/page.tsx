import { createClient } from "@/lib/supabase/server";
import { FriendList } from "@/components/chat/FriendList";
import type { Profile } from "@/types/db";

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, status_message").eq("id", user!.id).single(),
    supabase.from("friendships").select("friend:profiles!friendships_friend_id_fkey(id, display_name, avatar_url, status_message)")
      .eq("user_id", user!.id),
  ]);
  const friends = (rows ?? []).map((r) => r.friend as unknown as Profile)
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "ko"));
  return <FriendList me={me as Profile} friends={friends} />;
}
