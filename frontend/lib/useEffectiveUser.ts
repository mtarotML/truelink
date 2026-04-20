"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { getImpersonatedUser, ImpersonatedUser } from "./impersonation";

export interface EffectiveUser {
  id: string;
  email: string;
  first_name: string | null;
  photo_url: string | null;
  onboarded: boolean;
  role: "user" | "admin";
  impersonated: boolean;
}

export function useEffectiveUser(): EffectiveUser | null {
  const { data: session } = useSession();
  const [impersonated, setImpersonated] = useState<ImpersonatedUser | null>(
    null,
  );

  useEffect(() => {
    const read = () => setImpersonated(getImpersonatedUser());
    read();
    window.addEventListener("impersonation-changed", read);
    return () => window.removeEventListener("impersonation-changed", read);
  }, []);

  return useMemo((): EffectiveUser | null => {
    if (impersonated) {
      return { ...impersonated, impersonated: true };
    }
    if (session?.user?.id) {
      return {
        id: session.user.id,
        email: session.user.email ?? "",
        first_name: session.user.firstName ?? null,
        photo_url: session.user.photoUrl ?? null,
        onboarded: session.user.onboarded ?? false,
        role: session.user.role ?? "user",
        impersonated: false,
      };
    }
    return null;
  }, [
    impersonated,
    session?.user?.id,
    session?.user?.email,
    session?.user?.firstName,
    session?.user?.photoUrl,
    session?.user?.onboarded,
    session?.user?.role,
  ]);
}
