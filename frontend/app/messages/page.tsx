"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { apiGet, mediaUrl } from "@/lib/api";
import { useEffectiveUser } from "@/lib/useEffectiveUser";

interface PeerProfile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
  intent: "long_term" | "short_term" | null;
}

interface MessageOut {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface ConversationPreview {
  user: PeerProfile;
  last_message: MessageOut;
  unread_count: number;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export default function MessagesPage() {
  const router = useRouter();
  const { status } = useSession();
  const me = useEffectiveUser();
  const meId = me?.id;

  const [conversations, setConversations] = useState<ConversationPreview[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<ConversationPreview[]>("/conversations");
      setConversations(data);
    } catch (err) {
      setError((err as Error).message || "Couldn't load messages.");
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated" && me) {
      if (!me.onboarded) {
        router.replace("/onboarding");
        return;
      }
      void load();
      const id = setInterval(() => void load(), 5000);
      return () => clearInterval(id);
    }
  }, [status, me, router, load]);

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-5 pb-10 pt-8">
      <header className="flex items-center justify-between">
        <Logo className="text-3xl" />
        <Link
          href="/discovery"
          className="rounded-pill border border-white/15 px-4 py-1.5 text-xs text-white/80 transition hover:border-pink hover:text-white"
        >
          Discover
        </Link>
      </header>

      <h2 className="mt-6 text-xl font-semibold">Messages</h2>

      {error && (
        <p className="mt-4 rounded-2xl bg-pink/10 px-4 py-3 text-center text-sm text-pink">
          {error}
        </p>
      )}

      <section className="mt-4 flex flex-col gap-1">
        {conversations === null && (
          <div className="flex justify-center py-10">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
          </div>
        )}

        {conversations !== null && conversations.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-navy-soft px-5 py-8 text-center text-sm text-white/70">
            No conversations yet. Open a match to start chatting.
          </div>
        )}

        {conversations?.map((c) => {
          const photo = mediaUrl(c.user.photo_url);
          const mine = c.last_message.sender_id === meId;
          const preview = (mine ? "You: " : "") + c.last_message.content;
          return (
            <Link
              key={c.user.id}
              href={`/chat/${c.user.id}`}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/5 active:scale-[0.99]"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-navy-soft">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={c.user.first_name ?? "Profile"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={`truncate text-sm ${c.unread_count > 0 ? "font-semibold text-white" : "font-medium text-white/90"}`}
                  >
                    {c.user.first_name ?? "Someone"}
                  </p>
                  <span className="shrink-0 text-[11px] text-white/40">
                    {relativeTime(c.last_message.created_at)}
                  </span>
                </div>
                <p
                  className={`truncate text-xs ${c.unread_count > 0 ? "text-white/90" : "text-white/50"}`}
                >
                  {preview}
                </p>
              </div>
              {c.unread_count > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-pink px-1.5 text-[10px] font-bold text-white">
                  {c.unread_count}
                </span>
              )}
            </Link>
          );
        })}
      </section>
    </main>
  );
}
