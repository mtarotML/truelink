"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { ProfileCard } from "@/components/ProfileCard";
import { apiGet } from "@/lib/api";
import { useEffectiveUser } from "@/lib/useEffectiveUser";

interface Profile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
  intent: "long_term" | "short_term" | null;
}

function EmptySlot() {
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
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated" && me) {
      if (!me.onboarded) {
        router.replace("/onboarding");
        return;
      }
      apiGet<Profile[]>("/discovery")
        .then((data) => setProfile(data[0] ?? null))
        .catch((err) => setError((err as Error).message || "Couldn't load your match."));
    }
  }, [status, me, router]);

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
            href="/messages"
            className="rounded-pill border border-white/15 px-4 py-1.5 text-xs text-white/80 transition hover:border-pink hover:text-white"
          >
            Messages
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-white/60 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mt-6">
        <h2 className="text-xl font-semibold">Matchs</h2>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-pink/10 px-4 py-3 text-center text-sm text-pink">
          {error}
        </p>
      )}

      <section className="mt-4">
        {profile === undefined ? (
          <div className="flex justify-center py-10">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
          </div>
        ) : (
          <div className="flex w-full gap-2 sm:gap-3">
            {profile ? (
              <ProfileCard profile={profile} compact />
            ) : (
              <EmptySlot />
            )}
            <EmptySlot />
            <EmptySlot />
          </div>
        )}
      </section>
    </main>
  );
}
