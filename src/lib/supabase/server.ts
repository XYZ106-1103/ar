import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** 로그인 사용자 권한으로 동작 (RLS 적용) */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* Server Component 에서 호출된 경우 무시 (proxy 가 세션 갱신) */
          }
        },
      },
    },
  );
}

/**
 * service_role 클라이언트 — RLS 우회. 반드시 "권한 검사를 마친 뒤" 에만 사용.
 * (Signed Upload URL 발급, 업로드 완료 검증 등)
 */
export function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
