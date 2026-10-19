import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL = 60 * 5; // 5분. URL 이 유출돼도 금방 무효화된다.

/**
 * 문서 바로보기 / 다운로드
 *   GET /api/documents/{id}/access?mode=view|download[&version=n][&format=json]
 * - 문서 조회 자체가 RLS(방 멤버)로 제한되므로, 조회 성공 = 열람 권한 있음
 * - 매 요청마다 짧은 만료의 Signed URL 을 새로 발급 → 파일은 "영구 보관" 되지만 링크는 "일시적"
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mode = req.nextUrl.searchParams.get("mode") === "download" ? "download" : "view";
  const versionParam = req.nextUrl.searchParams.get("version");
  const asJson = req.nextUrl.searchParams.get("format") === "json";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, file_name, mime_type, size_bytes, storage_path, current_version")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "문서가 없거나 열람 권한이 없습니다." }, { status: 404 });

  let path = doc.storage_path;
  let version = doc.current_version;
  if (versionParam !== null) {
    const n = Number(versionParam);
    if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "잘못된 버전입니다." }, { status: 400 });
  }
  if (versionParam && Number(versionParam) !== doc.current_version) {
    const { data: v } = await supabase
      .from("document_versions").select("storage_path, version")
      .eq("document_id", id).eq("version", Number(versionParam)).maybeSingle();
    if (!v) return NextResponse.json({ error: "해당 버전이 없습니다." }, { status: 404 });
    path = v.storage_path;
    version = v.version;
  }

  // storage.objects SELECT 정책(방 멤버)도 통과해야 발급된다 → 이중 검증
  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, SIGNED_URL_TTL, mode === "download" ? { download: doc.file_name } : undefined);
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "URL 발급 실패" }, { status: 500 });

  await supabase.from("document_access_logs").insert({
    document_id: id,
    user_id: user.id,
    action: mode,
    version,
    user_agent: req.headers.get("user-agent"),
  });

  if (asJson) {
    return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL, document: { ...doc, version } });
  }
  return NextResponse.redirect(signed.signedUrl);
}
