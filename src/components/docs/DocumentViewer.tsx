"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, Loader2, Upload, EyeOff, Eye, History } from "lucide-react";
import { formatBytes, formatListTime, previewKind } from "@/lib/format";
import { canHideDocument, canUploadDocument } from "@/lib/permissions";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import type { DocumentRow, MemberRole } from "@/types/db";

interface Version { version: number; size_bytes: number; created_at: string; checksum_sha256: string | null }

/**
 * 문서 바로보기
 *  - PDF / 이미지 / 동영상 / 텍스트 : 브라우저 내장 뷰어
 *  - Office(docx/xlsx/pptx)        : Microsoft Office Online 뷰어 (signed URL 전달, 5분 만료)
 *  - HWP 등                         : 다운로드 안내 (서버측 PDF 변환 워커 연동 권장)
 */
export function DocumentViewer({ doc, versions, myRole }: { doc: DocumentRow; versions: Version[]; myRole: MemberRole }) {
  const router = useRouter();
  const [version, setVersion] = useState(doc.current_version);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const kind = previewKind(doc.mime_type);
  const { state, upload } = useDocumentUpload(doc.room_id, () => router.refresh());

  useEffect(() => {
    if (kind === "none") return;
    setUrl(null);
    fetch(`/api/documents/${doc.id}/access?mode=view&format=json&version=${version}`)
      .then((r) => r.json())
      .then((d) => (d.url ? setUrl(d.url) : setError(d.error)))
      .catch(() => setError("문서를 불러오지 못했습니다."));
  }, [doc.id, version, kind]);

  const toggleHidden = async () => {
    if (!doc.is_hidden && !confirm("문서를 숨기면 일반 멤버에게 보이지 않습니다. (파일은 삭제되지 않고 영구 보존됩니다)")) return;
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: !doc.is_hidden }),
    });
    if (!res.ok) return alert((await res.json()).error);
    router.refresh();
  };

  return (
    <div className="h-dvh-safe flex flex-col bg-[#2b2b2b] text-white">
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 md:px-4">
        <button onClick={() => router.back()} className="p-1" aria-label="뒤로"><ChevronLeft className="size-7" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{doc.title}</p>
          <p className="truncate text-[11px] text-white/60">
            {formatBytes(doc.size_bytes)} · v{version} · {formatListTime(doc.created_at)} · 영구보관
          </p>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="p-2" title="버전 이력"><History className="size-5" /></button>
        {canUploadDocument(myRole) && (
          <label className="cursor-pointer p-2" title="새 버전 올리기">
            <Upload className="size-5" />
            <input type="file" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, { title: doc.title, documentId: doc.id });
            }} />
          </label>
        )}
        {canHideDocument(myRole) && (
          <button onClick={toggleHidden} className="p-2" title={doc.is_hidden ? "다시 표시" : "숨기기"}>
            {doc.is_hidden ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
          </button>
        )}
        <a href={`/api/documents/${doc.id}/access?mode=download&version=${version}`}
          className="flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink">
          <Download className="size-4" /> <span className="max-sm:hidden">다운로드</span>
        </a>
      </header>

      {state.status !== "idle" && (
        <p className="bg-black/40 px-4 py-1.5 text-xs">
          {state.status === "error" ? `업로드 실패: ${state.error}` : `새 버전 업로드 중… ${"progress" in state ? Math.round(state.progress * 100) : 0}%`}
        </p>
      )}

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center justify-center bg-[#3a3a3a]">
          {error ? <p className="text-sm text-white/70">{error}</p>
            : kind === "none" ? (
              <div className="text-center text-sm text-white/70">
                <p>이 형식은 바로보기를 지원하지 않습니다.</p>
                <p className="mt-1">다운로드 후 확인해 주세요.</p>
              </div>
            ) : !url ? <Loader2 className="size-8 animate-spin text-white/60" />
            : kind === "pdf" || kind === "text" ? <iframe src={url} className="size-full bg-white" title={doc.title} />
            : kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={doc.title} className="max-h-full max-w-full object-contain" />
            )
            : kind === "video" ? <video src={url} controls className="max-h-full max-w-full" />
            : (
              <iframe
                title={doc.title}
                className="size-full bg-white"
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
              />
            )}
        </div>

        {showHistory && (
          <aside className="absolute inset-y-0 right-0 w-72 overflow-y-auto bg-[#1f1f1f] p-4 md:static">
            <h3 className="mb-3 text-sm font-semibold">버전 이력 (모든 버전 영구 보존)</h3>
            <ul className="space-y-1">
              {versions.map((v) => (
                <li key={v.version}>
                  <button onClick={() => setVersion(v.version)}
                    className={`w-full rounded px-3 py-2 text-left text-xs ${v.version === version ? "bg-white/15" : "hover:bg-white/5"}`}>
                    <p className="font-medium">v{v.version} {v.version === doc.current_version && "· 최신"}</p>
                    <p className="text-white/50">{formatListTime(v.created_at)} · {formatBytes(v.size_bytes)}</p>
                    {v.checksum_sha256 && <p className="truncate font-mono text-[10px] text-white/30">sha256 {v.checksum_sha256}</p>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
