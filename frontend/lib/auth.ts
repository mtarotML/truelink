import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://backend:8000";

interface BackendUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  gender: string | null;
  gender_pref: string | null;
  intent: string | null;
  onboarded: boolean;
  role: "user" | "admin";
}

async function exchangeIdToken(
  idToken: string,
): Promise<{ token: string; user: BackendUser }> {
  const res = await fetch(`${BACKEND_URL}/auth/google`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`backend auth failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { token: string; user: BackendUser };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
          scope: "openid email profile",
        },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, account, trigger, session }) {
      if (trigger === "update" && session && typeof session === "object") {
        const patch = session as {
          onboarded?: boolean;
          user?: { onboarded?: boolean };
        };
        const onboarded = patch.onboarded ?? patch.user?.onboarded;
        if (onboarded === true && token.backendUser) {
          token.backendUser = {
            ...token.backendUser,
            onboarded: true,
          };
        }
      }
      if (account?.id_token) {
        try {
          const { token: appJwt, user } = await exchangeIdToken(
            account.id_token,
          );
          token.appJwt = appJwt;
          token.backendUser = {
            id: user.id,
            email: user.email,
            onboarded: user.onboarded,
            first_name: user.first_name,
            photo_url: user.photo_url,
            role: user.role,
          };
        } catch (err) {
          token.error = (err as Error).message;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.appJwt = token.appJwt;
      session.error = token.error;
      if (token.backendUser) {
        session.user = {
          ...session.user,
          id: token.backendUser.id,
          email: token.backendUser.email,
          onboarded: token.backendUser.onboarded,
          firstName: token.backendUser.first_name,
          photoUrl: token.backendUser.photo_url,
          role: token.backendUser.role,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
