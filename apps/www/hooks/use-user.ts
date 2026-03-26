"use client";

import { useCallback, useSyncExternalStore } from "react";
import { clearUser as clearUserStorage, type LocalUserData, readUser, writeUser } from "@/lib/user";

// ---------------------------------------------------------------------------
// External store for user identity — mirrors use-tracking.ts pattern
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange(): void {
  for (const l of listeners) l();
}

let snapshot = readUser();

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return null;
}

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "pax-pal-user") {
      snapshot = readUser();
      emitChange();
    }
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUser() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setUser = useCallback((data: LocalUserData) => {
    writeUser(data);
    snapshot = data;
    emitChange();
  }, []);

  const clearUser = useCallback(() => {
    clearUserStorage();
    snapshot = null;
    emitChange();
  }, []);

  return { user, setUser, clearUser };
}
