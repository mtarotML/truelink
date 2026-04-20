"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiGet, apiPostJson, mediaUrl } from "@/lib/api";
import { useEffectiveUser } from "@/lib/useEffectiveUser";

interface PeerProfile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
  intent: "long_term" | "short_term" | null;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (isToday) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const peerId = params?.id ?? "";
  const { status } = useSession();
  const me = useEffectiveUser();
  const meId = me?.id;

  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated" && me && !me.onboarded) {
      router.replace("/onboarding");
    }
  }, [status, me, router]);

  const loadPeer = useCallback(async () => {
    if (!peerId) return;
    try {
      const data = await apiGet<PeerProfile>(`/users/${peerId}`);
      setPeer(data);
    } catch (err) {
      setError((err as Error).message || "Couldn't load profile.");
    }
  }, [peerId]);

  const loadMessages = useCallback(async () => {
    if (!peerId) return;
    try {
      const data = await apiGet<Message[]>(`/messages/${peerId}`);
      setMessages(data);
    } catch (err) {
      setError((err as Error).message || "Couldn't load messages.");
    }
  }, [peerId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadPeer();
    void loadMessages();
    const interval = setInterval(() => {
      void loadMessages();
    }, 3000);
    return () => clearInterval(interval);
  }, [status, loadPeer, loadMessages]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const grouped = useMemo(() => {
    if (!messages) return [] as Array<{ day: string; items: Message[] }>;
    const buckets = new Map<string, Message[]>();
    for (const m of messages) {
      const key = formatDayLabel(m.created_at);
      const arr = buckets.get(key) ?? [];
      arr.push(m);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries()).map(([day, items]) => ({ day, items }));
  }, [messages]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending || !peerId) return;
    setSending(true);
    setError(null);
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sender_id: meId ?? "me",
      recipient_id: peerId,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => (prev ? [...prev, optimistic] : [optimistic]));
    setDraft("");
    try {
      const saved = await apiPostJson<Message>(`/messages/${peerId}`, {
        content,
      });
      setMessages((prev) =>
        prev
          ? prev.map((m) => (m.id === optimistic.id ? saved : m))
          : [saved],
      );
    } catch (err) {
      setMessages((prev) => prev?.filter((m) => m.id !== optimistic.id) ?? null);
      setDraft(content);
      setError((err as Error).message || "Couldn't send message.");
    } finally {
      setSending(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  const peerPhoto = peer ? mediaUrl(peer.photo_url) : "";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-navy-deep">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/5 bg-navy-deep/90 px-4 py-3 backdrop-blur">
        <Link
          href="/discovery"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/80 transition hover:border-pink hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-navy-soft">
            {peerPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={peerPhoto}
                alt={peer?.first_name ?? "Profile"}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {peer?.first_name ?? "…"}
            </p>
            <p className="text-[11px] text-white/50">Active now</p>
          </div>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-4">
        {messages === null && (
          <div className="flex justify-center py-10">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
          </div>
        )}

        {messages !== null && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-3xl border border-white/10 bg-navy-soft px-5 py-6 text-center text-sm text-white/70">
            Say hi to {peer?.first_name ?? "them"} to start the conversation.
          </div>
        )}

        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {grouped.map((group) => (
            <div key={group.day} className="flex flex-col gap-2">
              <div className="my-2 flex items-center justify-center">
                <span className="rounded-pill bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-white/50">
                  {group.day}
                </span>
              </div>
              {group.items.map((m, idx) => {
                const mine = m.sender_id === meId;
                const prev = group.items[idx - 1];
                const sameAuthorAsPrev = prev && prev.sender_id === m.sender_id;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"} ${sameAuthorAsPrev ? "" : "mt-1"}`}
                  >
                    <div
                      className={`max-w-[75%] whitespace-pre-wrap break-words px-4 py-2 text-sm shadow-pop ${
                        mine
                          ? "rounded-[22px] rounded-br-md bg-pink text-white"
                          : "rounded-[22px] rounded-bl-md bg-white/10 text-white"
                      }`}
                    >
                      {m.content}
                      <div
                        className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-white/40"}`}
                      >
                        {formatTime(m.created_at)}
                        {mine && m.read_at ? " · Read" : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </section>

      {error && (
        <p className="mx-auto w-full max-w-xl px-4 pb-2 text-center text-xs text-pink">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 border-t border-white/5 bg-navy-deep/95 px-3 py-3 backdrop-blur"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
      >
        <div className="mx-auto flex w-full max-w-xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
            placeholder="Type a message"
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-3xl border border-white/10 bg-navy-soft px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-pink focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink text-white shadow-pop transition active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M3.105 3.105a.75.75 0 0 1 .815-.17l13.5 5.25a.75.75 0 0 1 0 1.39l-13.5 5.25a.75.75 0 0 1-1.02-.86l1.35-4.56a.75.75 0 0 1 .62-.53l6.39-.85a.125.125 0 0 0 0-.248l-6.39-.85a.75.75 0 0 1-.62-.53l-1.35-4.56a.75.75 0 0 1 .205-.762Z" />
            </svg>
          </button>
        </div>
      </form>
    </main>
  );
}
