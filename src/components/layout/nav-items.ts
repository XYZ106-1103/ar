import { User, MessageCircle, Archive, MoreHorizontal } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/friends", segment: "friends", label: "친구", icon: User },
  { href: "/chats", segment: "chats", label: "채팅", icon: MessageCircle },
  { href: "/archive", segment: "archive", label: "보관함", icon: Archive },
  { href: "/more", segment: "more", label: "더보기", icon: MoreHorizontal },
] as const;
