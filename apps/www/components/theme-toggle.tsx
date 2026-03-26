"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle dark mode"
    >
      <Sun className="size-5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute inset-0 m-auto size-5 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
    </button>
  );
}
