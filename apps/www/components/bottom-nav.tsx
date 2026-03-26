"use client";

import { Gamepad2, Home, MapIcon, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrackingStats } from "@/hooks/use-tracking";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/chat", label: "PAX Pal", icon: MessageCircle },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/my-games", label: "My Games", icon: Star },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { totalTracked } = useTrackingStats();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 items-center justify-around">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const showBadge = href === "/my-games" && totalTracked > 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div className="relative">
                <Icon className="size-5" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {totalTracked > 99 ? "99+" : totalTracked}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
