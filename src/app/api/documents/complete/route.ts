import { NextResponse } from "next/server";
import { forbidden, getRoomContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { canUploadDocument } from "@/lib/permissions";
import { isPathOf, MAX_FILE_BYTES } from "@/lib/storage-path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (msg = "잘못된 요청") => NextResponse.json({ error: msg }, { status: 400 });
const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);

/**
 * [업로드 2단계] Storage 업로드 완료 확인 → 메타데이터 / 버전 / 채팅 메시지 / 감사로그 기록
 * 기록은 RPC complete_document_upload (단일 트랜잭션, security invoker) 로 수행 →
 * 부분 실패가 남지 않고, RLS 가 관리자 권한을 한 번 더 검증한다.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad();

  const { roomId, documentId, version, path } = body;
  const fileName = str(body.fileName, 255);
  const mimeType = str(body.mimeType, 255) || "application/octet-stream";
  const checksum = body.checksum == null ? null : str(body.checksum, 128);
  const title = body.title == null ? null : str(body.title, 255);
  const description = body.description == null ? null : str(body.description, 2000);

  if (typeof roomId !== "string" || !UUID_RE.test(roomId)) return bad();
  if (typeof documentId !== "string" || !UUID_RE.test(documentId)) return bad();
  if (!Number.isInteger(version) || version < 1) return bad();
  if (typeof path !== "string" || !fileName) return bad();
  if (body.checksum != null && checksum === null) return bad();
  if (body.title != null && title === null) return bad();
  if (body.description != null && description === null) return bad();

  const ctx = await getRoomContext(roomId);
  if ("error" in ctx) return ctx.error;
  if (!canUploadDocument(ctx.role)) return forbidden();
  if (!isPathOf(path, roomId, documentId, version)) return forbidden("경로가 올바르지 않습니다.");

  // 실제로 파일이 올라갔는지 확인하고, 크기는 클라이언트 값이 아닌 Storage 메타데이터를 사용
  const admin = createServiceClient();
  const slash = path.lastIndexOf("/");
  const { data: files } = await admin.storage
    .from("documents")
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 10 });
  const obj = files?.find((f) => f.name === path.slice(slash + 1));
  const size = Number(obj?.metadata?.size);
  if (!obj || !Number.isFinite(size) || size <= 0) return bad("업로드된 파일을 찾을 수 없습니다.");
  if (size > MAX_FILE_BYTES) return NextResponse.json({ error: "파일이 너무 큽니다." }, { status: 413 });

  const { supabase } = ctx;
  const { data: messageId, error } = await supabase.rpc("complete_document_upload", {
    p_room: roomId,
    p_document: documentId,
    p_version: version,
    p_path: path,
    p_file_name: fileName,
    p_mime: mimeType,
    p_size: size,
    p_checksum: checksum,
    p_title: title,
    p_description: description,
    p_user_agent: req.headers.get("user-agent"),
  });
  if (error) {
    // 42501 = RLS/권한, 40001 = 버전 충돌, 23505 = 중복(이미 등록됨)
    const status = error.code === "42501" ? 403 : error.code === "40001" || error.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const { data: message } = await supabase
    .from("messages").select("*, document:documents(*)").eq("id", messageId).single();

  return NextResponse.json({ ok: true, message });
}
