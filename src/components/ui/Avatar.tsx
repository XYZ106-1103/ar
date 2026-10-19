import clsx from "clsx";
import { User, Users, Archive } from "lucide-react";

/** 카톡식 둥근 사각형(squircle) 프로필 */
export function Avatar({
  src, size = 48, kind = "user", className,
}: { src?: string | null; size?: number; kind?: "user" | "group" | "archive"; className?: string }) {
  const Icon = kind === "group" ? Users : kind === "archive" ? Archive : User;
  return (
    <div
      className={clsx("relative shrink-0 overflow-hidden bg-[#a3bbd1]", className)}
      style={{ width: size, height: size, borderRadius: size * 0.4 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Icon className="absolute inset-0 m-auto text-white" style={{ width: size * 0.55, height: size * 0.55 }} fill="currentColor" />
      )}
    </div>
  );
}
