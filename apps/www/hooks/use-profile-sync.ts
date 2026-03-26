"use client";

import { useEffect, useRef } from "react";
import { syncProfileData } from "@/app/actions/social";
import { useTrackingList } from "@/hooks/use-tracking";
import { useUser } from "@/hooks/use-user";

const DEBOUNCE_MS = 3000;

/**
 * Auto-syncs localStorage tracking data to the server when the user is logged in.
 * Debounces writes to avoid hammering DynamoDB on rapid tracking changes.
 * Fire-and-forget — does not block UI or surface errors.
 */
export function useProfileSync() {
  const { user } = useUser();
  const data = useTrackingList();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHashRef = useRef<string>("");

  useEffect(() => {
    if (!user) return;

    // Simple hash to avoid redundant writes
    const hash = JSON.stringify({ watchlist: data.watchlist, played: data.played });
    if (hash === lastHashRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      lastHashRef.current = hash;
      syncProfileData({
        username: user.username,
        secretToken: user.secretToken,
        watchlist: data.watchlist,
        played: data.played,
      }).catch(() => {
        // Fire-and-forget — reset hash so next change retries
        lastHashRef.current = "";
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, data.watchlist, data.played]);
}
