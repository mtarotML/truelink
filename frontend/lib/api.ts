import { getSession, signOut } from "next-auth/react";

import { getImpersonationToken, stopImpersonation } from "./impersonation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function authHeaders(): Promise<HeadersInit> {
  const impersonationToken = getImpersonationToken();
  if (impersonationToken) {
    return { Authorization: `Bearer ${impersonationToken}` };
  }
  const session = await getSession();
  if (session?.appJwt) {
    return { Authorization: `Bearer ${session.appJwt}` };
  }
  return {};
}

/** JWT still valid in the browser but user row was removed (e.g. DB wiped). */
async function ensureOk(res: Response): Promise<void> {
  if (res.status === 401) {
    if (getImpersonationToken()) {
      stopImpersonation();
      if (typeof window !== "undefined") {
        window.location.href = "/admin";
      }
      throw new Error("Impersonation token invalid. Returning to admin.");
    }
    await signOut({ callbackUrl: "/" });
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    cache: "no-store",
  });
  await ensureOk(res);
  return (await res.json()) as T;
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const headers = {
    ...(await authHeaders()),
    "content-type": "application/json",
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  await ensureOk(res);
  return (await res.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  await ensureOk(res);
}

export async function apiPostForm<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: form,
  });
  await ensureOk(res);
  return (await res.json()) as T;
}

export function mediaUrl(photoUrl: string | null | undefined): string {
  if (!photoUrl) return "";
  if (photoUrl.startsWith("http")) return photoUrl;
  return photoUrl;
}
