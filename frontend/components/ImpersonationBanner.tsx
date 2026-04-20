"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getImpersonatedUser,
  ImpersonatedUser,
  stopImpersonation,
} from "@/lib/impersonation";

export function ImpersonationBanner() {
  const router = useRouter();
  const [user, setUser] = useState<ImpersonatedUser | null>(null);

  useEffect(() => {
    const read = () => setUser(getImpersonatedUser());
    read();
    window.addEventListener("impersonation-changed", read);
    return () => window.removeEventListener("impersonation-changed", read);
  }, []);

  if (!user) return null;

  const exit = () => {
    stopImpersonation();
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-pink/50 bg-pink/20 px-4 py-2 text-xs backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 text-white">
        <span className="inline-flex h-5 items-center rounded-pill bg-pink px-2 text-[10px] font-bold uppercase tracking-wider">
          Admin
        </span>
        <span className="truncate">
          Impersonating{" "}
          <strong>{user.first_name ?? user.email}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={exit}
        className="shrink-0 rounded-pill border border-white/40 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/10"
      >
        Exit
      </button>
    </div>
  );
}
