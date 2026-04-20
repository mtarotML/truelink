"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";

import { apiGet } from "@/lib/api";

/**
 * If the DB was reset but the browser still holds a NextAuth cookie + app JWT,
 * the backend returns 401 for /me. apiGet triggers signOut so the user is not
 * stuck on onboarding with a ghost session.
 */
export function SessionHealth() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.appJwt) return;
    let cancelled = false;
    void (async () => {
      try {
        await apiGet("/me");
      } catch {
        if (!cancelled) {
          /* 401: ensureOk already called signOut */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session?.appJwt]);

  return null;
}
