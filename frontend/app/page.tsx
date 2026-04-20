"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";

export default function SignUpPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      const dest = session.user?.onboarded ? "/discovery" : "/onboarding";
      router.replace(dest);
    }
  }, [status, session, router]);

  async function handleGoogle() {
    setSubmitting(true);
    await signIn("google", { callbackUrl: "/onboarding" });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-navy px-6 pb-10 pt-24">
      <div className="flex flex-1 flex-col items-center justify-center gap-14">
        <Logo />
        <p className="text-xl font-semibold text-white">Sign up to continue</p>
      </div>

      <div className="flex w-full flex-col gap-4">
        <Button onClick={handleGoogle} loading={submitting}>
          <GoogleGlyph />
          <span className="ml-3">Continue with Google</span>
        </Button>

        <p className="mt-4 text-center text-xs text-white/60">
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms of use
          </Link>
          <span className="mx-3 opacity-40">|</span>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#fff"
        d="M21.35 11.1H12v2.84h5.37c-.23 1.47-1.64 4.3-5.37 4.3-3.23 0-5.86-2.67-5.86-5.96s2.63-5.96 5.86-5.96c1.84 0 3.07.78 3.77 1.45l2.57-2.48C16.87 3.87 14.66 3 12 3 6.98 3 2.9 7.03 2.9 12s4.08 9 9.1 9c5.25 0 8.73-3.68 8.73-8.87 0-.6-.06-1.05-.38-2.03Z"
      />
    </svg>
  );
}
