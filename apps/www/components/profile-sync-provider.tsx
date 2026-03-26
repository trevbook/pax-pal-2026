"use client";

import { useProfileSync } from "@/hooks/use-profile-sync";

/** Mounts the profile sync hook at the app layout level. Renders nothing. */
export function ProfileSyncProvider() {
  useProfileSync();
  return null;
}
