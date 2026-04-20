"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Logo } from "@/components/Logo";
import { apiDelete, apiGet, apiPostJson, mediaUrl } from "@/lib/api";
import {
  getImpersonatedUser,
  startImpersonation,
} from "@/lib/impersonation";

interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  gender: "male" | "female" | null;
  gender_pref: "male" | "female" | null;
  intent: "long_term" | "short_term" | null;
  device_id: string | null;
  onboarded: boolean;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

interface ImpersonateResponse {
  token: string;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    photo_url: string | null;
    onboarded: boolean;
    role: "user" | "admin";
  };
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const isImpersonating = typeof window !== "undefined" && !!getImpersonatedUser();
  const isAdmin = session?.user?.role === "admin" && !isImpersonating;

  const load = useCallback(async () => {
    try {
      const data = await apiGet<AdminUser[]>("/admin/users");
      setUsers(data);
    } catch (err) {
      setError((err as Error).message || "Couldn't load users.");
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated") {
      if (session?.user?.role !== "admin") {
        router.replace("/discovery");
        return;
      }
      void load();
    }
  }, [status, session, router, load]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.first_name ?? "").toLowerCase().includes(q) ||
        (u.last_name ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  async function impersonate(u: AdminUser) {
    setBusyUserId(u.id);
    setError(null);
    try {
      const data = await apiPostJson<ImpersonateResponse>(
        `/admin/impersonate/${u.id}`,
        {},
      );
      startImpersonation(data.token, {
        id: data.user.id,
        email: data.user.email,
        first_name: data.user.first_name,
        photo_url: data.user.photo_url,
        onboarded: data.user.onboarded,
        role: data.user.role,
      });
      router.push(u.onboarded ? "/discovery" : "/onboarding");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Impersonation failed.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    setBusyUserId(u.id);
    setError(null);
    try {
      await apiDelete(`/admin/users/${u.id}`);
      setUsers((prev) => prev?.filter((x) => x.id !== u.id) ?? null);
    } catch (err) {
      setError((err as Error).message || "Delete failed.");
    } finally {
      setBusyUserId(null);
    }
  }

  if (status !== "authenticated" || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-5 pb-10 pt-8">
      <header className="flex items-center justify-between">
        <Logo className="text-3xl" />
        <div className="flex items-center gap-3">
          <Link
            href="/discovery"
            className="rounded-pill border border-white/15 px-4 py-1.5 text-xs text-white/80 hover:border-pink hover:text-white"
          >
            App
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-white/60 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-xs text-white/50">
            {users?.length ?? 0} users · signed in as {session?.user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email or name"
            className="w-64 rounded-pill border border-white/10 bg-navy-soft px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-pink focus:outline-none"
          />
          <button
            type="button"
            onClick={load}
            className="rounded-pill border border-white/15 px-4 py-2 text-xs text-white/80 hover:border-pink hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-pink/10 px-4 py-3 text-sm text-pink">
          {error}
        </p>
      )}

      <section className="mt-4 overflow-x-auto rounded-3xl border border-white/10 bg-navy-soft">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wider text-white/60">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Pref</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Onboarded</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered === null && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pink border-t-transparent" />
                </td>
              </tr>
            )}
            {filtered !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/60">
                  No users.
                </td>
              </tr>
            )}
            {filtered?.map((u) => {
              const photo = mediaUrl(u.photo_url);
              const busy = busyUserId === u.id;
              const isSelf = u.id === session?.user?.id;
              return (
                <tr
                  key={u.id}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-navy-deep">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo}
                            alt={u.first_name ?? u.email}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {u.first_name || u.last_name
                            ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
                            : "—"}
                        </p>
                        <p className="truncate text-[11px] text-white/50">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        u.role === "admin"
                          ? "bg-pink text-white"
                          : "bg-white/10 text-white/70"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">{u.gender ?? "—"}</td>
                  <td className="px-4 py-3 text-white/70">
                    {u.gender_pref ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-white/70">{u.intent ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.onboarded ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-white/40">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-white/40">
                    {u.device_id ? u.device_id.slice(0, 10) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-white/50">
                    {fmtDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy || isSelf || u.role === "admin"}
                        onClick={() => impersonate(u)}
                        title={
                          u.role === "admin"
                            ? "Cannot impersonate an admin"
                            : "Sign in as this user"
                        }
                        className="rounded-pill bg-pink px-3 py-1 text-[11px] font-semibold text-white shadow-pop transition disabled:opacity-40"
                      >
                        {busy ? "…" : "Log in as"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || isSelf}
                        onClick={() => remove(u)}
                        className="rounded-pill border border-white/15 px-3 py-1 text-[11px] text-white/70 transition hover:border-pink hover:text-white disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
