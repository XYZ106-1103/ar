"use client";

import Link from "next/link";
import { FileText, FileSpreadsheet, FileImage, FileArchive, File, Download, ShieldCheck } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { DocumentRow } from "@/types/db";

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (/sheet|excel|csv/.test(mime)) return FileSpreadsheet;
  if (/zip|compressed|tar/.test(mime)) return FileArchive;
  if (/pdf|word|text|hwp|presentation/.test(mime)) return FileText;
  return File;
}

/** 채팅방 안 문서 말풍선. 카톡 파일 말풍선과 같은 형태 + "영구보관" 표시 (만료일 없음) */
export function DocumentCard({ doc }: { doc: DocumentRow | null | undefined }) {
  if (!doc) {
    return <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-sub">관리자가 숨긴 문서입니다.</div>;
  }
  const Icon = iconFor(doc.mime_type);
  return (
    <div className="w-[240px] overflow-hidden rounded-lg bg-white text-left shadow-sm">
      <Link href={`/documents/${doc.id}`} className="flex gap-3 p-3 hover:bg-black/[.02]">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8]">
          <Icon className="size-6 text-[#4a7bb7]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14px] leading-snug font-medium break-all">{doc.title}</p>
          <p className="mt-1 text-[11px] text-sub">
            {formatBytes(doc.size_bytes)}
            {doc.current_version > 1 && ` · v${doc.current_version}`}
          </p>
        </div>
      </Link>
      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px]">
        <span className="flex items-center gap-1 text-[#2f8f5b]">
          <ShieldCheck className="size-3.5" /> 영구보관
        </span>
        <div className="flex gap-3 text-[#555]">
          <Link href={`/documents/${doc.id}`} className="hover:underline">바로보기</Link>
          <a href={`/api/documents/${doc.id}/access?mode=download`} className="flex items-center gap-0.5 hover:underline">
            <Download className="size-3.5" /> 저장
          </a>
        </div>
      </div>
    </div>
  );
}
