"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Logo } from "@/components/Logo";
import { apiDelete, apiGet, apiPostForm, apiPostJson, mediaUrl } from "@/lib/api";
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

  // Create profile modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [cFirstName, setCFirstName] = useState("");
  const [cLastName, setCLastName] = useState("");
  const [cGender, setCGender] = useState<"male" | "female">("female");
  const [cGenderPref, setCGenderPref] = useState<"male" | "female">("male");
  const [cIntent, setCIntent] = useState<"long_term" | "short_term">("long_term");
  const [cBio, setCBio] = useState("");
  const [cIsFictive, setCIsFictive] = useState(true);
  const [cPhoto, setCPhoto] = useState<File | null>(null);
  const [cPhotoPreview, setCPhotoPreview] = useState<string | null>(null);

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

  function openCreate() {
    setCFirstName(""); setCLastName(""); setCGender("female"); setCGenderPref("male");
    setCIntent("long_term"); setCBio(""); setCIsFictive(true);
    setCPhoto(null); setCPhotoPreview(null); setCreateError(null);
    setCreateOpen(true);
  }

  async function createProfile() {
    if (!cFirstName.trim()) { setCreateError("First name is required."); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const form = new FormData();
      form.set("first_name", cFirstName.trim());
      form.set("last_name", cLastName.trim());
      form.set("gender", cGender);
      form.set("gender_pref", cGenderPref);
      form.set("intent", cIntent);
      if (cBio.trim()) form.set("bio", cBio.trim());
      form.set("is_fictive", String(cIsFictive));
      if (cPhoto) form.set("photo", cPhoto, cPhoto.name);
      const created = await apiPostForm<AdminUser>("/admin/users", form);
      setUsers((prev) => (prev ? [created, ...prev] : [created]));
      setCreateOpen(false);
    } catch (err) {
      setCreateError((err as Error).message || "Creation failed.");
    } finally {
      setCreating(false);
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
          <button
            type="button"
            onClick={openCreate}
            className="rounded-pill bg-pink px-4 py-2 text-xs font-semibold text-white shadow-pop transition hover:opacity-90"
          >
            + New profile
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

      {/* Create profile modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-navy-soft p-7 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">New profile</h2>

            <div className="mt-5 flex flex-col gap-4">
              {/* Name */}
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">First name *</span>
                  <input
                    type="text"
                    value={cFirstName}
                    onChange={(e) => setCFirstName(e.target.value)}
                    className="h-10 rounded-2xl border border-white/10 bg-navy-deep px-3 text-sm text-white outline-none focus:border-pink"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Last name</span>
                  <input
                    type="text"
                    value={cLastName}
                    onChange={(e) => setCLastName(e.target.value)}
                    className="h-10 rounded-2xl border border-white/10 bg-navy-deep px-3 text-sm text-white outline-none focus:border-pink"
                  />
                </label>
              </div>

              {/* Gender + pref */}
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Gender</span>
                  <select
                    value={cGender}
                    onChange={(e) => setCGender(e.target.value as "male" | "female")}
                    className="h-10 rounded-2xl border border-white/10 bg-navy-deep px-3 text-sm text-white outline-none focus:border-pink"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Meets</span>
                  <select
                    value={cGenderPref}
                    onChange={(e) => setCGenderPref(e.target.value as "male" | "female")}
                    className="h-10 rounded-2xl border border-white/10 bg-navy-deep px-3 text-sm text-white outline-none focus:border-pink"
                  >
                    <option value="male">Men</option>
                    <option value="female">Women</option>
                  </select>
                </label>
              </div>

              {/* Intent */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Looking for</span>
                <select
                  value={cIntent}
                  onChange={(e) => setCIntent(e.target.value as "long_term" | "short_term")}
                  className="h-10 rounded-2xl border border-white/10 bg-navy-deep px-3 text-sm text-white outline-none focus:border-pink"
                >
                  <option value="long_term">Long term</option>
                  <option value="short_term">Short term</option>
                </select>
              </label>

              {/* Bio */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Bio (optional)</span>
                <textarea
                  value={cBio}
                  onChange={(e) => setCBio(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="resize-none rounded-2xl border border-white/10 bg-navy-deep px-3 py-2 text-sm text-white outline-none focus:border-pink"
                />
              </label>

              {/* Photo */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">Photo (optional)</span>
                <div className="flex items-center gap-3">
                  {cPhotoPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cPhotoPreview} alt="preview" className="h-12 w-12 rounded-full object-cover" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setCPhoto(f);
                      setCPhotoPreview(f ? URL.createObjectURL(f) : null);
                    }}
                    className="text-sm text-white/70 file:mr-3 file:rounded-pill file:border file:border-white/15 file:bg-transparent file:px-3 file:py-1 file:text-xs file:text-white/80"
                  />
                </div>
              </label>

              {/* is_fictive toggle */}
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  onClick={() => setCIsFictive((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${cIsFictive ? "bg-pink" : "bg-white/20"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${cIsFictive ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-white/80">Fictive profile (AI-powered)</span>
              </label>
            </div>

            {createError && (
              <p className="mt-4 rounded-2xl bg-pink/10 px-3 py-2 text-sm text-pink">{createError}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={creating}
                onClick={createProfile}
                className="flex-1 rounded-pill bg-pink py-3 text-sm font-semibold text-white shadow-pop transition hover:opacity-90 disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex-1 rounded-pill border border-white/15 py-3 text-sm text-white/70 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
