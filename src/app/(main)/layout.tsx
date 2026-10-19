import { AppNav } from "@/components/layout/AppNav";
import { MainContent } from "@/components/layout/MainContent";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: rooms } = await supabase.rpc("get_my_rooms");
  const totalUnread = (rooms ?? []).reduce((sum: number, r: { unread_count: number }) => sum + Number(r.unread_count), 0);

  return (
    // 데스크톱: 가운데 정렬된 앱 프레임 (PC 메신저 창 느낌), 모바일: 전체 화면
    <div className="h-dvh-safe flex md:bg-[#e9e9e9] md:p-0 lg:items-center lg:justify-center lg:p-6">
      <div className="flex h-full w-full overflow-hidden bg-white md:flex-row lg:max-w-[1200px] lg:rounded-lg lg:shadow-xl">
        <AppNav totalUnread={totalUnread} />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
