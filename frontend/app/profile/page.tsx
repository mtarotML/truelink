"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { CameraCapture } from "@/components/CameraCapture";
import { Choice } from "@/components/Choice";
import { Logo } from "@/components/Logo";
import { apiGet, apiPatchForm, mediaUrl } from "@/lib/api";

type Gender = "male" | "female";
type Intent = "long_term" | "short_term";

interface UserMe {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  bio: string | null;
  gender: Gender | null;
  gender_pref: Gender | null;
  intent: Intent | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { status, update } = useSession();

  const [user, setUser] = useState<UserMe | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [genderPref, setGenderPref] = useState<Gender | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated") {
      apiGet<UserMe>("/me").then((data) => {
        setUser(data);
        setBio(data.bio ?? "");
        setGender(data.gender);
        setGenderPref(data.gender_pref);
        setIntent(data.intent);
      });
    }
  }, [status, router]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const form = new FormData();
      if (gender) form.set("gender", gender);
      if (genderPref) form.set("gender_pref", genderPref);
      if (intent) form.set("intent", intent);
      form.set("bio", bio.trim());
      if (photo) form.set("photo", photo, "selfie.jpg");
      const updated = await apiPatchForm<UserMe>("/me/profile", form);
      setUser(updated);
      setBio(updated.bio ?? "");
      setPhoto(null);
      setPhotoPreview(null);
      setShowCamera(false);
      await update({ photoUrl: updated.photo_url });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (status !== "authenticated" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  const displayPhoto = photoPreview || mediaUrl(user.photo_url);

  return (
    <main className="flex min-h-screen flex-col px-5 pb-10 pt-8">
      <header className="flex items-center justify-between">
        <Logo className="text-3xl" />
        <Link
          href="/discovery"
          className="text-xs text-white/60 hover:text-white"
        >
          ← Back
        </Link>
      </header>

      <div className="mt-8 flex flex-col gap-7">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          {showCamera ? (
            <>
              <CameraCapture
                onCapture={(blob, url) => {
                  setPhoto(blob);
                  setPhotoPreview(url);
                }}
                onClear={() => {
                  setPhoto(null);
                  setPhotoPreview(null);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setShowCamera(false);
                  setPhoto(null);
                  setPhotoPreview(null);
                }}
                className="text-sm text-white/60 hover:text-white"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="relative h-28 w-28 overflow-hidden rounded-full border border-white/10">
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-navy-soft" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="text-sm font-medium text-pink hover:text-pink/80"
              >
                Change photo
              </button>
            </>
          )}
        </div>

        {/* Name (read-only) */}
        <div className="text-center">
          <p className="text-xl font-semibold">
            {user.first_name} {user.last_name}
          </p>
          <p className="mt-0.5 text-sm text-white/50">{user.email}</p>
        </div>

        {/* Bio */}
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
            Bio
          </h3>
          <label className="flex flex-col gap-1.5">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell others a bit about yourself…"
              className="resize-none rounded-2xl border border-white/10 bg-navy-soft px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-pink"
            />
            <span className="text-right text-xs text-white/40">{bio.length}/500</span>
          </label>
        </div>

        {/* Gender */}
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
            I am
          </h3>
          <Choice<Gender>
            value={gender}
            onChange={setGender}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
        </div>

        {/* Gender preference */}
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
            I want to meet
          </h3>
          <Choice<Gender>
            value={genderPref}
            onChange={setGenderPref}
            options={[
              { value: "male", label: "Men" },
              { value: "female", label: "Women" },
            ]}
          />
        </div>

        {/* Intent */}
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
            Looking for
          </h3>
          <Choice<Intent>
            value={intent}
            onChange={setIntent}
            options={[
              { value: "long_term", label: "Long term", hint: "Something meaningful." },
              { value: "short_term", label: "Short term", hint: "Keeping it casual." },
            ]}
          />
        </div>
      </div>

      {error && (
        <p className="mt-5 rounded-2xl bg-pink/10 px-4 py-3 text-center text-sm text-pink">
          {error}
        </p>
      )}

      {saved && !error && (
        <p className="mt-5 rounded-2xl bg-white/5 px-4 py-3 text-center text-sm text-white/70">
          Changes saved.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        <Button loading={saving} onClick={save}>
          Save changes
        </Button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-white/40 hover:text-white/70"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
