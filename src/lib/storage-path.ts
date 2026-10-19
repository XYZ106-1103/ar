/**
 * Storage 경로 규칙: rooms/{roomId}/{documentId}/v{version}/{safeName}
 * - Supabase Storage 키는 한글 등 비 ASCII 문자를 허용하지 않으므로
 *   원본 파일명은 DB(file_name)에 보관하고, 키에는 안전한 이름만 쓴다.
 * - 다운로드 시 createSignedUrl({ download: 원본파일명 }) 으로 원래 이름 복원.
 */
export function buildStoragePath(roomId: string, documentId: string, version: number, fileName: string) {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const safe = `${Date.now()}${ext ? "." + ext : ""}`;
  return `rooms/${roomId}/${documentId}/v${version}/${safe}`;
}

export function isPathOf(path: string, roomId: string, documentId: string, version: number) {
  return path.startsWith(`rooms/${roomId}/${documentId}/v${version}/`) && !path.includes("..");
}

export const MAX_FILE_BYTES = 500 * 1024 * 1024; // 버킷 file_size_limit 와 일치
