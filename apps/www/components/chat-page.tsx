"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { Clock, MessageCircle, Plus, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";

import { useTrackingList } from "@/hooks/use-tracking";
import {
  chatTitle,
  deleteChat,
  getStoredChats,
  type StoredChat,
  saveChat,
} from "@/lib/chat-storage";
import { cn } from "@/lib/utils";
import { GameCard } from "./game-card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_USER_MESSAGES = 7;

const SUGGESTIONS = [
  "What should I play first?",
  "Best co-op games at PAX",
  "Recommend me something weird",
  "What's at booth 18019?",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useTrackingBody() {
  const tracking = useTrackingList();
  return useMemo(() => {
    const watchlistIds = Object.keys(tracking.watchlist);
    const playedIds = Object.keys(tracking.played);
    return { watchlistIds, playedIds };
  }, [tracking.watchlist, tracking.played]);
}

function generateChatId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Relative time label like "2m ago", "3h ago", "yesterday". */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// ChatPage — manages active chat + history
// ---------------------------------------------------------------------------

export function ChatPage() {
  const body = useTrackingBody();
  const hasTrackedGames = body.watchlistIds.length > 0 || body.playedIds.length > 0;
  const reactId = useId();

  // Active chat ID + history
  const [chatId, setChatId] = useState<string>(() => generateChatId());
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [pastChats, setPastChats] = useState<StoredChat[]>([]);
  const [viewingChatId, setViewingChatId] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    const stored = getStoredChats();
    setPastChats(stored);

    // Resume the most recent chat if it hasn't hit the limit
    if (stored.length > 0) {
      const latest = stored[0];
      if (latest.userMessageCount < MAX_USER_MESSAGES) {
        setChatId(latest.id);
        setInitialMessages(latest.messages);
      }
    }
  }, []);

  // Chat hook
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body }), [body]);
  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    id: `${reactId}-${chatId}`,
    transport,
    messages: initialMessages,
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(status);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const atLimit = userMessageCount >= MAX_USER_MESSAGES;
  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll when messages change or streaming updates
  const messageCount = messages.length;
  useEffect(() => {
    // messageCount and status referenced to trigger scroll on changes
    if (messageCount === 0 && status === "ready") return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, status]);

  // Persist chat when assistant finishes responding
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (wasStreaming && status === "ready" && messages.length > 0) {
      const chat: StoredChat = {
        id: chatId,
        messages,
        userMessageCount,
        createdAt: pastChats.find((c) => c.id === chatId)?.createdAt ?? new Date().toISOString(),
        title: chatTitle(messages),
      };
      saveChat(chat);
      setPastChats(getStoredChats());
    }
  }, [status, messages, chatId, userMessageCount, pastChats]);

  // Send a message
  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || atLimit || isStreaming) return;
      // If viewing a past chat, switch to it (or start fresh if at limit)
      if (viewingChatId) setViewingChatId(null);
      sendMessage({ text }, { body });
      setInput("");
    },
    [atLimit, isStreaming, viewingChatId, sendMessage, body],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  // Start a new chat
  const handleNewChat = useCallback(() => {
    const newId = generateChatId();
    setChatId(newId);
    setInitialMessages([]);
    setMessages([]);
    setViewingChatId(null);
    setInput("");
  }, [setMessages]);

  // View a past chat (read-only)
  const handleViewChat = useCallback(
    (stored: StoredChat) => {
      setChatId(stored.id);
      setInitialMessages(stored.messages);
      setMessages(stored.messages);
      setViewingChatId(stored.id);
      setInput("");
    },
    [setMessages],
  );

  // Delete a past chat
  const handleDeleteChat = useCallback(
    (id: string) => {
      deleteChat(id);
      setPastChats(getStoredChats());
      if (chatId === id) handleNewChat();
    },
    [chatId, handleNewChat],
  );

  // Viewing a completed past chat?
  const isViewingPast = viewingChatId !== null;
  const viewingAtLimit =
    isViewingPast &&
    (pastChats.find((c) => c.id === viewingChatId)?.userMessageCount ?? 0) >= MAX_USER_MESSAGES;

  return (
    <div className="mx-auto flex h-[calc(100dvh-theme(spacing.12)-theme(spacing.14))] max-w-2xl flex-col">
      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.length === 0 ? (
          <WelcomeState
            hasTrackedGames={hasTrackedGames}
            onSuggestion={handleSend}
            pastChats={pastChats}
            onViewChat={handleViewChat}
            onDeleteChat={handleDeleteChat}
          />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {error && (
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-sm font-medium">PAX Pal got lost in the expo hall!</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Something went wrong. Try asking again.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={clearError}>
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-4">
        {atLimit || viewingAtLimit ? (
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm text-muted-foreground">
              {isViewingPast ? "Viewing a past chat." : `All ${MAX_USER_MESSAGES} messages used.`}
            </p>
            <Button variant="outline" size="sm" onClick={handleNewChat}>
              <Plus className="mr-1 size-3.5" />
              New chat
            </Button>
          </div>
        ) : isViewingPast ? (
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm text-muted-foreground">Continue this chat or start fresh.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setViewingChatId(null);
              }}
            >
              Continue
            </Button>
            <Button variant="outline" size="sm" onClick={handleNewChat}>
              <Plus className="mr-1 size-3.5" />
              New chat
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                className="shrink-0"
                title="New chat"
              >
                <Plus className="size-4" />
              </Button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isStreaming ? "PAX Pal is thinking..." : "Ask about games at PAX East..."
              }
              disabled={isStreaming}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="shrink-0"
            >
              <Send className="size-4" />
            </Button>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {userMessageCount}/{MAX_USER_MESSAGES}
            </span>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome state — now includes past chat history
// ---------------------------------------------------------------------------

function WelcomeState({
  hasTrackedGames,
  onSuggestion,
  pastChats,
  onViewChat,
  onDeleteChat,
}: {
  hasTrackedGames: boolean;
  onSuggestion: (text: string) => void;
  pastChats: StoredChat[];
  onViewChat: (chat: StoredChat) => void;
  onDeleteChat: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <MessageCircle className="size-7 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Ask PAX Pal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your AI guide to PAX East 2026. Ask me anything about the games!
          </p>
          {hasTrackedGames && (
            <p className="mt-1 text-xs text-primary">
              I can see your games — ask for personalized recs!
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion(s)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent/50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Past chats */}
      {pastChats.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" />
            Recent chats
          </h2>
          <div className="space-y-1.5">
            {pastChats.map((chat) => (
              <div
                key={chat.id}
                className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50"
              >
                <button type="button" className="flex-1 text-left" onClick={() => onViewChat(chat)}>
                  <p className="truncate text-sm">{chat.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {chat.userMessageCount} message{chat.userMessageCount !== 1 && "s"} ·{" "}
                    {timeAgo(chat.createdAt)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteChat(chat.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  title="Delete chat"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
}: {
  message: { id: string; role: string; parts: Array<Record<string, unknown>> };
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      {(message.parts ?? []).map((part, i) => {
        const key = `${message.id}-${i}`;

        // Text part
        if (part.type === "text") {
          const text = part.text as string;
          if (!text) return null;
          return (
            <div
              key={key}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                isUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground",
              )}
            >
              {isUser ? (
                text
              ) : (
                <Markdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  }}
                >
                  {text}
                </Markdown>
              )}
            </div>
          );
        }

        // Tool call parts — render game cards when output is available
        if (typeof part.type === "string" && (part.type as string).startsWith("tool-")) {
          const state = part.state as string;
          const output = part.output as Record<string, unknown> | undefined;

          // Loading state
          if (state !== "output-available") {
            return <ToolSkeleton key={key} />;
          }

          // Error from tool
          if (output?.error && (!output.games || (output.games as unknown[]).length === 0)) {
            return (
              <div
                key={key}
                className="max-w-[85%] rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground"
              >
                {output.error as string}
              </div>
            );
          }

          // Game cards
          const games = output?.games as Array<Record<string, unknown>> | undefined;
          if (games && games.length > 0) {
            return (
              <div key={key} className="w-full max-w-[90%] space-y-2">
                {games.map((game) => (
                  <GameCard key={game.id as string} game={game as never} variant="mobile" />
                ))}
              </div>
            );
          }

          // Single game detail (getGameDetails returns { game: ... })
          const singleGame = output?.game as Record<string, unknown> | undefined;
          if (singleGame) {
            return (
              <div key={key} className="w-full max-w-[90%]">
                <GameCard game={singleGame as never} variant="mobile" />
              </div>
            );
          }

          return null;
        }

        return null;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool call skeleton
// ---------------------------------------------------------------------------

function ToolSkeleton() {
  return (
    <div className="w-full max-w-[85%] space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-border p-3">
          <Skeleton className="size-16 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
