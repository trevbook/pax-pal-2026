import type { Metadata } from "next";
import { ChatPage } from "@/components/chat-page";

export const metadata: Metadata = {
  title: "Ask PAX Pal | PAX Pal 2026",
  description: "Chat with PAX Pal to discover games at PAX East 2026.",
};

export default function Page() {
  return <ChatPage />;
}
