"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { apiGet, mediaUrl } from "@/lib/api";

const INTENT_LABEL: Record<string, string> = {
  long_term: "Long term",
  short_term: "Short term",
};

interface PublicProfile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
  bio: string | null;
  intent: "long_term" | "short_term" | null;
  is_fictive: boolean;
}

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { status } = useSession();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated" && id) {
      apiGet<PublicProfile>(`/users/${id}`)
        .then(setProfile)
        .catch((err) => setError((err as Error).message || "Profile not found."));
    }
  }, [status, id, router]);

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <p className="rounded-2xl bg-pink/10 px-4 py-3 text-center text-sm text-pink">{error}</p>
        <Link href="/discovery" className="text-sm text-white/60 hover:text-white">
          ← Back to discovery
        </Link>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  const photo = mediaUrl(profile.photo_url);

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero photo */}
      <div className="relative w-full" style={{ aspectRatio: "3/4", maxHeight: "65vh" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={profile.first_name ?? "Profile"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-navy-soft" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/20 to-transparent" />

        {/* Back button */}
        <Link
          href="/discovery"
          aria-label="Back"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </Link>

        {/* Name + intent over photo */}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-white leading-tight">
                {profile.first_name ?? "Someone"}
              </h1>
              {profile.is_fictive && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-violet-500/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                    <path d="M8 1a.5.5 0 0 1 .45.285l1.428 2.894 3.195.464a.5.5 0 0 1 .277.853L11.13 7.587l.545 3.18a.5.5 0 0 1-.726.527L8 9.765l-2.949 1.55a.5.5 0 0 1-.726-.527l.545-3.18L2.65 5.496a.5.5 0 0 1 .277-.853l3.195-.464L7.55 1.285A.5.5 0 0 1 8 1Z" />
                  </svg>
                  AI Profile
                </span>
              )}
            </div>
            {profile.intent && (
              <span className="rounded-pill bg-pink px-3 py-1 text-xs font-semibold text-white shadow-pop">
                {INTENT_LABEL[profile.intent]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content below photo */}
      <div className="flex flex-1 flex-col px-6 pb-10 pt-6">
        {profile.bio && (
          <p className="text-sm leading-relaxed text-white/80">{profile.bio}</p>
        )}

        <div className="mt-auto pt-8">
          <Link
            href={`/chat/${profile.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-pill bg-gradient-to-r from-pink to-orange-400 py-4 text-base font-semibold text-white shadow-pop transition hover:opacity-90 active:scale-[0.98]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6.414l-2.707 2.707A1 1 0 0 1 2 16V5Z"
                clipRule="evenodd"
              />
            </svg>
            Send a message
          </Link>
        </div>
      </div>
    </main>
  );
}
