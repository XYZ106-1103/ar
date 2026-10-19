import Link from "next/link";
import { Download, EyeOff } from "lucide-react";
import clsx from "clsx";
import { formatBytes, formatListTime } from "@/lib/format";
import type { DocumentRow } from "@/types/db";

export function DocumentList({ docs, compact, roomNames }: {
  docs: DocumentRow[]; compact?: boolean; roomNames?: Record<string, string>;
}) {
  if (docs.length === 0) return <p className="py-6 text-center text-sm text-sub">보관된 문서가 없습니다.</p>;
  return (
    <ul className={clsx("divide-y divide-line", !compact && "rounded-lg border border-line")}>
      {docs.map((d) => (
        <li key={d.id} className={clsx("flex items-center gap-3", compact ? "py-2.5" : "px-4 py-3")}>
          <Link href={`/documents/${d.id}`} className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-medium">
              {d.is_hidden && <EyeOff className="size-3.5 shrink-0 text-sub" />}
              {d.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-sub">
              {roomNames?.[d.room_id] && <>{roomNames[d.room_id]} · </>}
              {formatBytes(d.size_bytes)} · {formatListTime(d.created_at)}
              {d.current_version > 1 && ` · v${d.current_version}`}
            </p>
          </Link>
          <a
            href={`/api/documents/${d.id}/access?mode=download`}
            className="rounded-full p-2 text-[#555] hover:bg-black/5"
            aria-label="다운로드"
          >
            <Download className="size-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}
