import type { PressLink, PressLinkType } from "@pax-pal/core";
import { ExternalLink, Mic, Newspaper, Play, Sparkles, Star } from "lucide-react";

const TYPE_CONFIG: Record<
  PressLinkType,
  { icon: React.ComponentType<{ className?: string }>; label: string; order: number }
> = {
  review: { icon: Star, label: "Reviews", order: 0 },
  preview: { icon: Sparkles, label: "Previews", order: 1 },
  interview: { icon: Mic, label: "Interviews", order: 2 },
  announcement: { icon: Newspaper, label: "Announcements", order: 3 },
  trailer: { icon: Play, label: "Trailers", order: 4 },
  other: { icon: Newspaper, label: "Articles", order: 5 },
};

export function PressLinks({ links }: { links: PressLink[] }) {
  if (links.length === 0) return null;

  // Group by type, sorted by display order
  const grouped = new Map<PressLinkType, PressLink[]>();
  for (const link of links) {
    const existing = grouped.get(link.type) ?? [];
    existing.push(link);
    grouped.set(link.type, existing);
  }

  const sortedGroups = [...grouped.entries()].sort(
    ([a], [b]) => TYPE_CONFIG[a].order - TYPE_CONFIG[b].order,
  );

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Press & Coverage
      </h3>
      <div className="flex flex-col gap-4">
        {sortedGroups.map(([type, typeLinks]) => {
          const config = TYPE_CONFIG[type];
          const Icon = config.icon;
          return (
            <div key={type}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5" />
                <span>{config.label}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {typeLinks.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      <span className="flex-1">
                        <span className="group-hover:underline">{link.title}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{link.source}</span>
                      </span>
                      <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
