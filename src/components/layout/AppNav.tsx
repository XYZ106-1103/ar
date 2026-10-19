"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import clsx from "clsx";
import { NAV_ITEMS } from "./nav-items";

/**
 * 반응형 네비게이션
 *  - 모바일(<768px) : 하단 탭바. 채팅방 안에서는 숨김 (카톡과 동일)
 *  - 데스크톱       : 좌측 세로 아이콘 레일 (카톡 PC 버전과 동일)
 */
export function AppNav({ totalUnread = 0 }: { totalUnread?: number }) {
  const segments = useSelectedLayoutSegments();
  const active = segments[0];
  const inRoom = segments[0] === "chats" && segments.length > 1;

  return (
    <nav
      className={clsx(
        "z-20 shrink-0 bg-[#f6f6f6] md:bg-[#ececed]",
        // mobile: bottom bar
        "fixed inset-x-0 bottom-0 flex border-t border-line pb-safe",
        // desktop: left rail
        "md:static md:h-full md:w-[70px] md:flex-col md:items-center md:gap-2 md:border-t-0 md:border-r md:pt-8 md:pb-0",
        inRoom && "max-md:hidden",
      )}
    >
      {NAV_ITEMS.map(({ href, segment, label, icon: Icon }) => {
        const isActive = active === segment;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={clsx(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 md:flex-none md:p-3",
              isActive ? "text-black" : "text-[#b4b4b4] hover:text-[#7a7a7a]",
            )}
          >
            <Icon className="size-6 md:size-7" strokeWidth={isActive ? 2.4 : 1.8} fill={isActive ? "currentColor" : "none"} />
            <span className="text-[10px] md:hidden">{label}</span>
            {segment === "chats" && totalUnread > 0 && (
              <span className="absolute top-1 left-1/2 ml-1.5 min-w-4 rounded-full bg-unread px-1 text-center text-[10px] leading-4 font-bold text-white md:top-1.5">
                {totalUnread > 999 ? "999+" : totalUnread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
