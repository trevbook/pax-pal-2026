// ---------------------------------------------------------------------------
// localStorage schema for user identity (username, token, recovery phrase)
// Separate from pax-pal-tracking to keep concerns decoupled.
// ---------------------------------------------------------------------------

export interface LocalUserData {
  username: string;
  secretToken: string;
  recoveryPhrase: string;
}

const STORAGE_KEY = "pax-pal-user";

/** Read user identity from localStorage. Returns null if not claimed. */
export function readUser(): LocalUserData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalUserData;
  } catch {
    return null;
  }
}

/** Write user identity to localStorage. */
export function writeUser(data: LocalUserData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Clear user identity from localStorage. */
export function clearUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
