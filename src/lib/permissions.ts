import type { MemberRole } from "@/types/db";

/**
 * UI 표시용 권한 판단. 실제 집행은 DB RLS + API Route 에서 이중으로 수행된다.
 * 이 함수 결과만 믿고 서버 검사를 생략하면 안 된다.
 */
export const canUploadDocument = (role: MemberRole | null | undefined) =>
  role === "owner" || role === "admin";

export const canManageMembers = (role: MemberRole | null | undefined) => role === "owner";

export const canHideDocument = canUploadDocument;
