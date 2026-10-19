"use client";

import { useCallback, useState } from "react";
import type { Message } from "@/types/db";

export type UploadState =
  | { status: "idle" }
  | { status: "hashing" | "uploading" | "saving"; fileName: string; progress: number }
  | { status: "error"; fileName: string; error: string };

async function sha256(file: File) {
  // 무결성 검증용 체크섬 (수백 MB 이상은 Web Worker + 청크 해싱 권장)
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Signed Upload URL 로 Storage 에 직접 PUT (XHR 사용 → 진행률 표시 가능) */
function putWithProgress(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false"); // 덮어쓰기 금지 → 기존 파일 보존
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("네트워크 오류"));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

/**
 * 문서 업로드 3단계
 *   1) POST /api/documents/prepare   : 관리자 권한 확인 + Signed Upload URL
 *   2) PUT  {signedUrl}              : 브라우저 → Storage 직접 업로드
 *   3) POST /api/documents/complete  : 메타데이터·버전·채팅 메시지·감사로그 기록
 */
export function useDocumentUpload(roomId: string, onDone?: (msg: Message) => void) {
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const upload = useCallback(async (file: File, opts?: { title?: string; description?: string; documentId?: string }) => {
    const fileName = file.name;
    try {
      setState({ status: "hashing", fileName, progress: 0 });
      const checksum = await sha256(file);

      const prep = await fetch("/api/documents/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, fileName, mimeType: file.type, size: file.size, documentId: opts?.documentId }),
      });
      const p = await prep.json();
      if (!prep.ok) throw new Error(p.error);

      setState({ status: "uploading", fileName, progress: 0 });
      await putWithProgress(p.signedUrl, file, (progress) => setState({ status: "uploading", fileName, progress }));

      setState({ status: "saving", fileName, progress: 1 });
      const done = await fetch("/api/documents/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId, documentId: p.documentId, version: p.version, path: p.path,
          fileName, mimeType: p.mimeType, size: file.size, checksum,
          title: opts?.title, description: opts?.description,
        }),
      });
      const d = await done.json();
      if (!done.ok) throw new Error(d.error);

      setState({ status: "idle" });
      if (d.message) onDone?.(d.message as Message);
    } catch (e) {
      setState({ status: "error", fileName, error: e instanceof Error ? e.message : "업로드 실패" });
    }
  }, [roomId, onDone]);

  return { state, upload, reset: () => setState({ status: "idle" }) };
}
