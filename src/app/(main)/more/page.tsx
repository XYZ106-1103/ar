import { PageHeader } from "@/components/layout/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default function MorePage() {
  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="더보기" />
      <form action={signOut} className="px-5">
        <button className="w-full rounded-lg border border-line py-3 text-sm">로그아웃</button>
      </form>
    </div>
  );
}
