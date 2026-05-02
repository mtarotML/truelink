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

import { apiDelete, apiGet, apiPostJson, mediaUrl } from "@/lib/api";
import { useEffectiveUser } from "@/lib/useEffectiveUser";

interface MoodData {
  mood_score: number | null;
  mood_label: string | null;
  computed_at: string | null;
}

interface ExclusiveStatus {
  status: "none" | "eligible" | "pending_sent" | "pending_received" | "active";
  partner_name: string | null;
}

interface PeerProfile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
  intent: "long_term" | "short_term" | null;
  is_fictive: boolean;
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

const MOOD_GRADIENT = "linear-gradient(to right, #FCA5A5, #FDE68A, #86EFAC)";

function moodColorAt(pct: number): string {
  const stops: [number, [number, number, number]][] = [
    [0,   [252, 165, 165]],
    [50,  [253, 230, 138]],
    [100, [134, 239, 172]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (pct >= stops[i][0] && pct <= stops[i + 1][0]) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const t = lo[0] === hi[0] ? 0 : (pct - lo[0]) / (hi[0] - lo[0]);
  const r = Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t);
  const g = Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t);
  const b = Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t);
  return `rgb(${r},${g},${b})`;
}

// ── Exclusive mode modal ────────────────────────────────────────────────────

function ExclusiveModal({
  excl,
  peerName,
  onClose,
  onConfirm,
  onDecline,
  onEnd,
  loading,
}: {
  excl: ExclusiveStatus;
  peerName: string;
  onClose: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onEnd: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 pb-8 px-4 sm:items-center sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-amber-400/20 bg-navy-soft p-7 text-center shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            className="h-7 w-7 text-amber-400"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {excl.status === "eligible" && (
          <>
            <h3 className="mt-3 text-xl font-bold">Exclusive Mode</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              While Exclusive Mode is active, you and{" "}
              <span className="font-semibold text-white">{peerName}</span> will
              only be able to talk to each other. Your discovery page will show
              only them.
            </p>
            <p className="mt-3 text-xs text-white/40">
              We'll ask {peerName} if they agree.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className="mt-5 w-full rounded-pill bg-amber-400 py-3 text-sm font-semibold text-navy-deep transition hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Enable Exclusive Mode"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-pill border border-white/10 py-3 text-sm text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </>
        )}

        {excl.status === "pending_sent" && (
          <>
            <h3 className="mt-3 text-xl font-bold">Request sent</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              Waiting for{" "}
              <span className="font-semibold text-white">{peerName}</span> to
              accept Exclusive Mode…
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-pill border border-white/10 py-3 text-sm text-white/60 hover:text-white"
            >
              Close
            </button>
          </>
        )}

        {excl.status === "pending_received" && (
          <>
            <h3 className="mt-3 text-xl font-bold">Exclusive Mode request</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              <span className="font-semibold text-white">{peerName}</span> wants
              to enter Exclusive Mode with you. While active, you can only talk
              to each other.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className="mt-5 w-full rounded-pill bg-amber-400 py-3 text-sm font-semibold text-navy-deep transition hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? "Accepting…" : "Accept"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onDecline}
              className="mt-3 w-full rounded-pill border border-white/10 py-3 text-sm text-white/60 hover:text-white disabled:opacity-60"
            >
              Decline
            </button>
          </>
        )}

        {excl.status === "active" && (
          <>
            <h3 className="mt-3 text-xl font-bold">Exclusive Mode is on</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              You and{" "}
              <span className="font-semibold text-white">{peerName}</span> are
              in Exclusive Mode. You only see each other in Discovery.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={onEnd}
              className="mt-5 w-full rounded-pill border border-red-400/40 py-3 text-sm text-red-400 hover:border-red-400 disabled:opacity-60"
            >
              {loading ? "Ending…" : "End Exclusive Mode"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-pill border border-white/10 py-3 text-sm text-white/60 hover:text-white"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

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
  const [mood, setMood] = useState<MoodData | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [excl, setExcl] = useState<ExclusiveStatus | null>(null);
  const [exclModalOpen, setExclModalOpen] = useState(false);
  const [exclLoading, setExclLoading] = useState(false);

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

  const loadMood = useCallback(async () => {
    if (!peerId) return;
    try {
      const data = await apiGet<MoodData>(`/messages/${peerId}/mood`);
      setMood(data);
    } catch {
      // mood is optional — silently ignore errors
    }
  }, [peerId]);

  const loadTyping = useCallback(async () => {
    if (!peerId) return;
    try {
      const data = await apiGet<{ typing: boolean }>(`/messages/${peerId}/typing`);
      setIsTyping(data.typing);
    } catch {
      setIsTyping(false);
    }
  }, [peerId]);

  const loadExclusive = useCallback(async () => {
    if (!peerId) return;
    try {
      const data = await apiGet<ExclusiveStatus>(`/exclusive/${peerId}`);
      setExcl(data);
    } catch {
      // non-critical
    }
  }, [peerId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadPeer();
    void loadMessages();
    void loadMood();
    void loadTyping();
    void loadExclusive();
    const msgInterval = setInterval(() => void loadMessages(), 3000);
    const moodInterval = setInterval(() => {
      void loadMood();
      void loadExclusive();
    }, 6000);
    const typingInterval = setInterval(() => void loadTyping(), 1000);
    return () => {
      clearInterval(msgInterval);
      clearInterval(moodInterval);
      clearInterval(typingInterval);
    };
  }, [status, loadPeer, loadMessages, loadMood, loadTyping, loadExclusive]);

  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    const count = messages?.length ?? 0;
    if (count > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = count;
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

  function handleResetClick() {
    if (!resetPending) {
      setResetPending(true);
      resetTimerRef.current = setTimeout(() => setResetPending(false), 3000);
      return;
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setResetPending(false);
    setMessages([]);
    setMood(null);
    setIsTyping(false);
    setError(null);
    apiDelete(`/messages/${peerId}`).catch((err: unknown) => {
      setError((err as Error).message || "Couldn't reset conversation.");
      void loadMessages();
    });
  }

  async function handleExclConfirm() {
    if (!excl) return;
    setExclLoading(true);
    try {
      if (excl.status === "eligible") {
        const updated = await apiPostJson<ExclusiveStatus>(
          `/exclusive/${peerId}/request`,
          {},
        );
        setExcl(updated);
      } else if (excl.status === "pending_received") {
        const updated = await apiPostJson<ExclusiveStatus>(
          `/exclusive/${peerId}/respond`,
          { accept: true },
        );
        setExcl(updated);
        setExclModalOpen(false);
      }
    } catch (err) {
      setError((err as Error).message || "Couldn't update exclusive mode.");
    } finally {
      setExclLoading(false);
    }
  }

  async function handleExclDecline() {
    setExclLoading(true);
    try {
      const updated = await apiPostJson<ExclusiveStatus>(
        `/exclusive/${peerId}/respond`,
        { accept: false },
      );
      setExcl(updated);
      setExclModalOpen(false);
    } catch (err) {
      setError((err as Error).message || "Couldn't decline.");
    } finally {
      setExclLoading(false);
    }
  }

  async function handleExclEnd() {
    setExclLoading(true);
    try {
      await apiDelete(`/exclusive/${peerId}`);
      setExcl({ status: "none", partner_name: null });
      setExclModalOpen(false);
    } catch (err) {
      setError((err as Error).message || "Couldn't end exclusive mode.");
    } finally {
      setExclLoading(false);
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
  const showExclBtn =
    excl !== null && excl.status !== "none";
  const exclBlinks =
    excl?.status === "eligible" || excl?.status === "pending_received";

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
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
            {mood?.mood_label && mood.mood_score !== null ? (
              (() => {
                const pct = Math.round(((mood.mood_score + 1) / 2) * 100);
                const knobColor = moodColorAt(pct);
                return (
                  <div className="mt-1 flex flex-col gap-[3px]">
                    <div className="flex items-center gap-2">
                      <span className="w-7 shrink-0 text-[9px] uppercase tracking-widest text-white/40 leading-none">
                        mood
                      </span>
                      <div
                        className="relative h-[3px] w-28 overflow-visible rounded-full"
                        style={{ background: "rgba(255,255,255,0.12)" }}
                      >
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{ background: MOOD_GRADIENT, opacity: 0.55 }}
                        />
                        <div
                          className="absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-700"
                          style={{
                            left: `${pct}%`,
                            boxShadow: `0 0 0 2px rgba(255,255,255,0.15), 0 0 8px 3px ${knobColor}99`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-7 shrink-0" />
                      <span
                        className="text-[10px] font-medium leading-none transition-colors duration-700"
                        style={{ color: knobColor }}
                      >
                        {mood.mood_label.toLowerCase()}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="text-[11px] text-white/50">Active now</p>
            )}
          </div>
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2">
          {/* Exclusive mode button */}
          {showExclBtn && (
            <button
              type="button"
              onClick={() => setExclModalOpen(true)}
              aria-label="Exclusive mode"
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition active:scale-95 ${
                excl?.status === "active"
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-400"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-400"
              } ${exclBlinks ? "animate-pulse" : ""}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
                aria-hidden="true"
              >
                {excl?.status === "active" ? (
                  // open lock when active
                  <>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </>
                ) : (
                  // closed lock otherwise
                  <>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </>
                )}
              </svg>
            </button>
          )}

          {peer?.is_fictive && (
            <button
              onClick={handleResetClick}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                resetPending
                  ? "border-pink bg-pink/10 text-pink"
                  : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
              }`}
            >
              {resetPending ? "Sure?" : "Reset"}
            </button>
          )}
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
          {isTyping && (
            <div className="mt-1 flex justify-start">
              <div className="flex items-center gap-1 rounded-[22px] rounded-bl-md bg-white/10 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:300ms]" />
              </div>
            </div>
          )}

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

      {exclModalOpen && excl && (
        <ExclusiveModal
          excl={excl}
          peerName={peer?.first_name ?? excl.partner_name ?? "them"}
          onClose={() => setExclModalOpen(false)}
          onConfirm={handleExclConfirm}
          onDecline={handleExclDecline}
          onEnd={handleExclEnd}
          loading={exclLoading}
        />
      )}
    </main>
  );
}
