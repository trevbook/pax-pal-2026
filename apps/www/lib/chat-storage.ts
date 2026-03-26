import type { UIMessage } from "ai";

const STORAGE_KEY = "pax-pal-chats";
const MAX_STORED_CHATS = 20;

export interface StoredChat {
  id: string;
  messages: UIMessage[];
  userMessageCount: number;
  createdAt: string;
  /** First user message text, used as a display title. */
  title: string;
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

export function getStoredChats(): StoredChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredChat[]) : [];
  } catch {
    return [];
  }
}

function writeChats(chats: StoredChat[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_STORED_CHATS)));
  } catch {
    // Storage full — silently drop oldest chats and retry
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 5)));
    } catch {
      // give up
    }
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Save or update a chat. Most recent chats first. */
export function saveChat(chat: StoredChat): void {
  const chats = getStoredChats();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = chat;
  } else {
    chats.unshift(chat);
  }
  writeChats(chats);
}

/** Delete a chat by ID. */
export function deleteChat(id: string): void {
  const chats = getStoredChats().filter((c) => c.id !== id);
  writeChats(chats);
}

/** Extract a display title from the first user message. */
export function chatTitle(messages: UIMessage[]): string {
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    for (const part of msg.parts) {
      if (part.type === "text" && part.text) {
        return part.text.length > 60 ? `${part.text.slice(0, 57)}...` : part.text;
      }
    }
  }
  return "New chat";
}
