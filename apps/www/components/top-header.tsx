import Link from "next/link";

export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex h-12 items-center px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          PAX Pal
        </Link>
      </div>
    </header>
  );
}
