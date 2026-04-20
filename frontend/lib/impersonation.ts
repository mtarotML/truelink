"use client";

const TOKEN_KEY = "tl_impersonate_jwt";
const USER_KEY = "tl_impersonate_user";

export interface ImpersonatedUser {
  id: string;
  email: string;
  first_name: string | null;
  photo_url: string | null;
  onboarded: boolean;
  role: "user" | "admin";
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getImpersonationToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getImpersonatedUser(): ImpersonatedUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ImpersonatedUser) : null;
  } catch {
    return null;
  }
}

export function startImpersonation(jwt: string, user: ImpersonatedUser): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(TOKEN_KEY, jwt);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("impersonation-changed"));
}

export function stopImpersonation(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("impersonation-changed"));
}
