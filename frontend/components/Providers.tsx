"use client";

import { SessionProvider } from "next-auth/react";

import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SessionHealth } from "@/components/SessionHealth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionHealth />
      <ImpersonationBanner />
      {children}
    </SessionProvider>
  );
}
