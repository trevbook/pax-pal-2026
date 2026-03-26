import { Info } from "lucide-react";
import Link from "next/link";

export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex h-12 items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          PAX Pal
        </Link>
        <Link
          href="/about"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="About PAX Pal"
        >
          <Info className="size-5" />
        </Link>
      </div>
    </header>
  );
}
