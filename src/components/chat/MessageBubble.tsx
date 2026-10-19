import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { DocumentCard } from "@/components/docs/DocumentCard";
import { formatBubbleTime } from "@/lib/format";
import type { Message, Profile } from "@/types/db";

interface Props {
  message: Message;
  isMine: boolean;
  sender?: Profile;
  /** 같은 사람이 같은 분에 연속으로 보낸 묶음의 첫 메시지 → 프로필/이름 표시 */
  showProfile: boolean;
  /** 묶음의 마지막 메시지 → 시간 표시 */
  showTime: boolean;
  /** 아직 안 읽은 사람 수 (카톡의 노란 숫자 1) */
  unread: number;
}

export function MessageBubble({ message, isMine, sender, showProfile, showTime, unread }: Props) {
  if (message.type === "system") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-black/10 px-3 py-1 text-[12px] text-[#333]">{message.content}</span>
      </div>
    );
  }

  const isDoc = message.type === "document";
  const meta = (
    <div className={clsx("flex shrink-0 flex-col justify-end text-[10px] leading-tight", isMine ? "items-end" : "items-start")}>
      {unread > 0 && <span className="font-bold text-[#f5c400]">{unread}</span>}
      {showTime && <span className="text-[#556677]">{message.pending ? "" : formatBubbleTime(message.created_at)}</span>}
    </div>
  );

  const body = isDoc ? (
    <DocumentCard doc={message.document} />
  ) : (
    <div
      className={clsx(
        "relative max-w-[min(70vw,460px)] rounded-[14px] px-3 py-2 text-[14.5px] leading-[1.45] break-words whitespace-pre-wrap",
        isMine ? "bg-brand text-brand-ink" : "bg-bubble-other",
        showProfile && (isMine ? "bubble-tail-me rounded-tr-[4px]" : "bubble-tail-other rounded-tl-[4px]"),
        message.pending && "opacity-60",
      )}
    >
      {message.content}
    </div>
  );

  if (isMine) {
    return (
      <div className={clsx("flex justify-end gap-1.5 px-4", showProfile ? "mt-2.5" : "mt-1")}>
        {meta}
        {body}
      </div>
    );
  }

  return (
    <div className={clsx("flex gap-2 px-3", showProfile ? "mt-2.5" : "mt-1")}>
      <div className="w-10 shrink-0">{showProfile && <Avatar src={sender?.avatar_url} size={40} />}</div>
      <div className="min-w-0">
        {showProfile && <p className="mb-1 text-[12px] text-[#444]">{sender?.display_name ?? "알 수 없음"}</p>}
        <div className="flex gap-1.5">
          {body}
          {meta}
        </div>
      </div>
    </div>
  );
}
