"use client";

import { cn } from "@/lib/utils";

const TABS = [
  { id: "expo", label: "Expo Hall" },
  { id: "tabletop", label: "Tabletop Hall" },
] as const;

export type MapTab = (typeof TABS)[number]["id"];

export function MapToggle({
  activeTab,
  onTabChange,
}: {
  activeTab: MapTab;
  onTabChange: (tab: MapTab) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 rounded-lg bg-muted p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
