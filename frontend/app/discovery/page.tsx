"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { ProfileCard } from "@/components/ProfileCard";
import { apiGet, mediaUrl } from "@/lib/api";
import { useEffectiveUser } from "@/lib/useEffectiveUser";

interface Profile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
  intent: "long_term" | "short_term" | null;
  is_fictive: boolean;
}

interface ExclusiveStatus {
  status: "none" | "active";
  partner_id: string | null;
  partner_name: string | null;
}

interface PeerProfile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
}

interface MessageOut {
  id: string;
  sender_id: string;
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

function EmptySlot({ locked }: { locked?: boolean }) {
  if (locked) {
    return (
      <div className="flex-1 overflow-hidden rounded-2xl border border-dashed border-amber-400/20 bg-amber-400/5">
        <div className="aspect-[3/4] w-full flex flex-col items-center justify-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            className="h-6 w-6 text-amber-400/40"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-hidden rounded-2xl border border-dashed border-white/10 bg-navy-soft/40">
      <div className="aspect-[3/4] w-full" />
    </div>
  );
}

export default function DiscoveryPage() {
  const router = useRouter();
  const { status } = useSession();
  const me = useEffectiveUser();
  const meId = me?.id;
  const [profiles, setProfiles] = useState<Profile[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [exclusive, setExclusive] = useState<ExclusiveStatus | null>(null);
  const [conversations, setConversations] = useState<ConversationPreview[] | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiGet<ConversationPreview[]>("/conversations");
      setConversations(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated" && me) {
      if (!me.onboarded) {
        router.replace("/onboarding");
        return;
      }
      apiGet<Profile[]>("/discovery")
        .then((data) => setProfiles(data))
        .catch((err) => setError((err as Error).message || "Couldn't load your match."));
      apiGet<ExclusiveStatus>("/exclusive")
        .then(setExclusive)
        .catch(() => null);
      void loadConversations();
      const id = setInterval(() => void loadConversations(), 5000);
      return () => clearInterval(id);
    }
  }, [status, me, router, loadConversations]);

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  const isExclusive = exclusive?.status === "active";

  return (
    <main className={`flex min-h-screen flex-col px-5 pb-10 pt-8 transition-colors ${isExclusive ? "bg-[#0A0B2E]" : ""}`}>
      <header className="flex items-center justify-between">
        <Logo className="text-3xl" />
        <div className="flex items-center gap-3">
          {me?.role === "admin" && !me?.impersonated && (
            <Link
              href="/admin"
              className="rounded-pill border border-pink/60 bg-pink/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-pink/20"
            >
              Admin
            </Link>
          )}
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:border-pink hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Matchs</h2>
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className="rounded-pill bg-gradient-to-r from-pink to-orange-400 px-4 py-1.5 text-xs font-semibold text-white shadow-pop transition hover:opacity-90"
        >
          ✦ Upgrade
        </button>
      </div>

      {/* Exclusive mode banner */}
      {isExclusive && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            className="h-4 w-4 shrink-0 text-amber-400"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
          <p className="text-xs text-amber-400">
            <span className="font-semibold">Exclusive Mode</span>
            {exclusive?.partner_name ? ` · with ${exclusive.partner_name}` : ""}
          </p>
        </div>
      )}

      {upgradeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setUpgradeOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-white/10 bg-navy-soft p-8 text-center shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-3xl">✦</p>
            <h3 className="mt-3 text-xl font-bold">TrueLink Premium</h3>
            <p className="mt-2 text-sm text-white/60">
              Available soon. Stay tuned!
            </p>
            <button
              type="button"
              onClick={() => setUpgradeOpen(false)}
              className="mt-6 w-full rounded-pill border border-white/15 py-3 text-sm font-semibold text-white/80 transition hover:border-pink hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-2xl bg-pink/10 px-4 py-3 text-center text-sm text-pink">
          {error}
        </p>
      )}

      <section className="mt-4">
        {profiles === undefined ? (
          <div className="flex justify-center py-10">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
          </div>
        ) : (
          <div className="flex w-full gap-2 sm:gap-3">
            {profiles[0] ? (
              <ProfileCard profile={profiles[0]} compact />
            ) : (
              <EmptySlot locked={isExclusive} />
            )}
            {profiles[1] ? (
              <ProfileCard profile={profiles[1]} compact />
            ) : (
              <EmptySlot locked={isExclusive} />
            )}
            <EmptySlot locked={isExclusive} />
          </div>
        )}
      </section>

      {/* Messages */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Messages</h2>
        {isExclusive && (
          <p className="mt-1.5 text-xs text-amber-400/70">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              className="mb-0.5 mr-1 inline h-3 w-3"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Exclusive mode — only your partner&apos;s conversation is visible.
          </p>
        )}
        <div className="mt-3 flex flex-col gap-1">
          {conversations === null && (
            <div className="flex justify-center py-6">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pink border-t-transparent" />
            </div>
          )}

          {conversations !== null && conversations.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-navy-soft px-5 py-6 text-center text-sm text-white/50">
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
                    <img src={photo} alt={c.user.first_name ?? "Profile"} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-sm ${c.unread_count > 0 ? "font-semibold text-white" : "font-medium text-white/90"}`}>
                      {c.user.first_name ?? "Someone"}
                    </p>
                    <span className="shrink-0 text-[11px] text-white/40">
                      {relativeTime(c.last_message.created_at)}
                    </span>
                  </div>
                  <p className={`truncate text-xs ${c.unread_count > 0 ? "text-white/90" : "text-white/50"}`}>
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
        </div>
      </section>
    </main>
  );
}
