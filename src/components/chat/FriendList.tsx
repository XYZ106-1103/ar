"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { AddFriendDialog } from "@/components/chat/AddFriendDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Profile, RoomType } from "@/types/db";

export function FriendList({ me, friends }: { me: Profile; friends: Profile[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const openDirect = async (friendId: string) => {
    const { data, error } = await supabase.rpc("get_or_create_direct_room", { p_other: friendId });
    if (error) return alert(error.message);
    router.push(`/chats/${data}`);
  };

  const createRoom = async (type: Exclude<RoomType, "direct">) => {
    const name = prompt(type === "archive" ? "문서 보관함 이름" : "그룹 채팅방 이름");
    if (!name) return;
    const { data, error } = await supabase.rpc("create_group_room", { p_name: name, p_member_ids: picked, p_type: type });
    if (error) return alert(error.message);
    router.push(`/chats/${data}`);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={selecting ? `대화상대 선택 ${picked.length}` : "친구"}
        actions={
          <>
            <Search className="size-5" />
            <button title="친구 추가" onClick={() => setAdding(true)}>
              <UserPlus className="size-5" />
            </button>
            <button title="그룹/보관함 만들기" onClick={() => { setSelecting(!selecting); setPicked([]); }}>
              <Users className={clsx("size-5", selecting && "text-[#f5b400]")} />
            </button>
          </>
        }
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {!selecting && (
          <div className="flex items-center gap-3 border-b border-line px-5 pb-4">
            <Avatar src={me.avatar_url} size={58} />
            <div>
              <p className="font-semibold">{me.display_name}</p>
              <p className="text-xs text-sub">{me.status_message}</p>
            </div>
          </div>
        )}
        <p className="px-5 pt-3 pb-1 text-xs text-sub">친구 {friends.length}</p>
        {friends.length === 0 && (
          <button onClick={() => setAdding(true)} className="mx-5 my-4 text-sm text-sub underline">
            친구를 추가해 보세요
          </button>
        )}
        <ul>
          {friends.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => selecting
                  ? setPicked((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))
                  : openDirect(f.id)}
                className="flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-[#f8f8f8]"
              >
                <Avatar src={f.avatar_url} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{f.display_name}</p>
                  {f.status_message && <p className="truncate text-xs text-sub">{f.status_message}</p>}
                </div>
                {selecting && (
                  <span className={clsx("size-5 rounded-full border-2",
                    picked.includes(f.id) ? "border-brand bg-brand" : "border-[#ccc]")} />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selecting && (
        <div className="flex gap-2 border-t border-line p-3">
          <button disabled={!picked.length} onClick={() => createRoom("group")}
            className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium disabled:opacity-40">
            그룹 채팅 만들기
          </button>
          <button disabled={!picked.length} onClick={() => createRoom("archive")}
            className="flex-1 rounded-lg bg-[#423630] py-2.5 text-sm font-medium text-white disabled:opacity-40">
            문서 보관함 만들기
          </button>
        </div>
      )}
      {adding && <AddFriendDialog onClose={() => setAdding(false)} />}
    </div>
  );
}
