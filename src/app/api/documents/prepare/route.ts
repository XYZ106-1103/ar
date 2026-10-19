import { NextResponse } from "next/server";
import { forbidden, getRoomContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { canUploadDocument } from "@/lib/permissions";
import { buildStoragePath, MAX_FILE_BYTES } from "@/lib/storage-path";

/**
 * [업로드 1단계] 관리자 검증 → Signed Upload URL 발급
 * 파일 본문은 Next 서버를 거치지 않고 브라우저 → Storage 로 직접 전송된다 (대용량/서버리스 친화).
 *
 * body: { roomId, fileName, mimeType, size, documentId? }  // documentId 가 있으면 새 버전 업로드
 */
export async function POST(req: Request) {
  const { roomId, fileName, mimeType, size, documentId } = await req.json();
  if (!roomId || !fileName || !size) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (size > MAX_FILE_BYTES) return NextResponse.json({ error: "파일이 너무 큽니다." }, { status: 413 });

  const ctx = await getRoomContext(roomId);
  if ("error" in ctx) return ctx.error;
  if (!canUploadDocument(ctx.role)) return forbidden("문서 업로드 권한이 없는 사용자입니다.");

  let docId: string = documentId ?? crypto.randomUUID();
  let version = 1;

  if (documentId) {
    // 새 버전: 같은 방의 문서인지 확인 (RLS 적용 클라이언트)
    const { data: doc } = await ctx.supabase
      .from("documents").select("id, room_id, current_version").eq("id", documentId).maybeSingle();
    if (!doc || doc.room_id !== roomId) return forbidden();
    docId = doc.id;
    version = doc.current_version + 1;
  }

  const path = buildStoragePath(roomId, docId, version, fileName);
  const admin = createServiceClient();
  const { data, error } = await admin.storage.from("documents").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    documentId: docId,
    version,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    mimeType: mimeType || "application/octet-stream",
  });
}
