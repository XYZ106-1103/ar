export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-5 md:h-16">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="flex items-center gap-4 text-[#333]">{actions}</div>
    </header>
  );
}
