"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import clsx from "clsx";

/** 모바일 하단 탭바 높이만큼 여백 확보 (채팅방 안에서는 탭바가 없으므로 제외) */
export function MainContent({ children }: { children: React.ReactNode }) {
  const segments = useSelectedLayoutSegments();
  const inRoom = segments[0] === "chats" && segments.length > 1;
  return (
    <main className={clsx("relative h-full min-w-0 flex-1", !inRoom && "max-md:pb-[calc(56px+env(safe-area-inset-bottom))]")}>
      {children}
    </main>
  );
}
