import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { ko } from "date-fns/locale";

/** 채팅 목록 시간 표기 (카톡 방식: 오늘=오후 3:12, 어제, 이번해=3월 2일, 그외=2024. 3. 2.) */
export function formatListTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "a h:mm", { locale: ko });
  if (isYesterday(d)) return "어제";
  if (isThisYear(d)) return format(d, "M월 d일", { locale: ko });
  return format(d, "yyyy. M. d.", { locale: ko });
}

export const formatBubbleTime = (iso: string) => format(new Date(iso), "a h:mm", { locale: ko });
export const formatDateDivider = (iso: string) => format(new Date(iso), "yyyy년 M월 d일 EEEE", { locale: ko });

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** 브라우저에서 바로 렌더 가능한지 */
export function previewKind(mime: string): "pdf" | "image" | "video" | "text" | "office" | "none" {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/")) return "text";
  if (/officedocument|msword|ms-excel|ms-powerpoint|hwp/.test(mime)) return "office";
  return "none";
}
