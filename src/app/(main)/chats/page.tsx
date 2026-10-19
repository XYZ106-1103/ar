import { MessageCircle } from "lucide-react";

/** 데스크톱에서 방을 선택하지 않았을 때 오른쪽 영역 */
export default function ChatsIndex() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f7f7f7] text-sub">
      <MessageCircle className="size-14 text-[#d5d5d5]" />
      <p className="text-sm">채팅방을 선택하세요</p>
    </div>
  );
}
