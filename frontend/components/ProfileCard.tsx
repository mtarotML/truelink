import Link from "next/link";

import { mediaUrl } from "@/lib/api";

interface Profile {
  id: string;
  first_name: string | null;
  photo_url: string | null;
  intent: "long_term" | "short_term" | null;
  is_fictive?: boolean;
}

const INTENT_LABEL: Record<NonNullable<Profile["intent"]>, string> = {
  long_term: "Long term",
  short_term: "Short term",
};

export function ProfileCard({
  profile,
  compact = false,
  href,
}: {
  profile: Profile;
  compact?: boolean;
  href?: string;
}) {
  const src = mediaUrl(profile.photo_url);
  const target = href ?? `/profile/${profile.id}`;

  return (
    <Link
      href={target}
      className={`group relative flex min-w-0 overflow-hidden rounded-2xl bg-navy-soft shadow-[0_0_35px_-8px_rgba(236,47,138,0.45)] transition active:scale-[0.98] ${compact ? "flex-1" : ""}`}
    >
      <div
        className={`relative w-full flex-1 overflow-hidden rounded-2xl ${compact ? "aspect-[3/4]" : "aspect-[4/5]"}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={profile.first_name ?? "Profile photo"}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-navy-deep text-white/30">
            No photo
          </div>
        )}
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent ${
            compact ? "px-1.5 pb-2 pt-8" : "px-5 pb-5 pt-16"
          }`}
        >
          <div className={compact ? "" : "flex items-end justify-between gap-3"}>
            <div className="min-w-0">
              <h3
                className={`font-bold leading-tight text-white ${
                  compact ? "line-clamp-2 text-[11px] sm:text-xs" : "text-2xl"
                }`}
              >
                {profile.first_name ?? "Someone"}
              </h3>
              {profile.is_fictive && (
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full bg-violet-500/80 font-semibold text-white backdrop-blur-sm ${
                    compact ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[11px]"
                  }`}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className={compact ? "h-2 w-2" : "h-3 w-3"} aria-hidden="true">
                    <path d="M8 1a.5.5 0 0 1 .45.285l1.428 2.894 3.195.464a.5.5 0 0 1 .277.853L11.13 7.587l.545 3.18a.5.5 0 0 1-.726.527L8 9.765l-2.949 1.55a.5.5 0 0 1-.726-.527l.545-3.18L2.65 5.496a.5.5 0 0 1 .277-.853l3.195-.464L7.55 1.285A.5.5 0 0 1 8 1Z" />
                  </svg>
                  AI
                </span>
              )}
            </div>
            {!compact && profile.intent && (
              <span className="rounded-pill bg-pink px-3 py-1 text-xs font-semibold text-white shadow-pop">
                {INTENT_LABEL[profile.intent]}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
