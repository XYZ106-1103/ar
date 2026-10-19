"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import clsx from "clsx";

/**
 * 반응형 2단 레이아웃
 *  - 데스크톱: [채팅 목록 | 채팅방] 동시 표시 (카톡 PC)
 *  - 모바일  : 목록 또는 채팅방 중 하나만 전체 화면
 */
export function ChatsShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const inRoom = useSelectedLayoutSegment() !== null;
  return (
    <div className="flex h-full">
      <aside className={clsx("h-full w-full border-r border-line md:w-[340px] md:shrink-0", inRoom && "max-md:hidden")}>
        {list}
      </aside>
      <section className={clsx("h-full min-w-0 flex-1", !inRoom && "max-md:hidden")}>{children}</section>
    </div>
  );
}
