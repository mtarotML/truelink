"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { CameraCapture } from "@/components/CameraCapture";
import { Choice } from "@/components/Choice";
import { Logo } from "@/components/Logo";
import { apiPostForm } from "@/lib/api";
import { getDeviceId } from "@/lib/fingerprint";

type Gender = "male" | "female";
type Intent = "long_term" | "short_term";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [genderPref, setGenderPref] = useState<Gender | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated" && session.user?.onboarded) {
      router.replace("/discovery");
    }
  }, [status, session, router]);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return firstName.trim().length > 0 && lastName.trim().length > 0;
      case 1:
        return photo !== null;
      case 2:
        return gender !== null && genderPref !== null && intent !== null;
      default:
        return false;
    }
  }, [step, firstName, lastName, photo, gender, genderPref, intent]);

  const submit = useCallback(async () => {
    if (!photo || !gender || !genderPref || !intent) return;
    setSubmitting(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      const form = new FormData();
      form.set("first_name", firstName.trim());
      form.set("last_name", lastName.trim());
      form.set("gender", gender);
      form.set("gender_pref", genderPref);
      form.set("intent", intent);
      if (deviceId) form.set("device_id", deviceId);
      form.set("photo", photo, "selfie.jpg");
      await apiPostForm("/onboarding", form);
      await update({ onboarded: true });
      router.replace("/discovery");
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }, [photo, gender, genderPref, intent, firstName, lastName, router]);

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-6 pb-10 pt-10">
      <div className="flex items-center justify-between">
        <Logo className="text-3xl" />
        <StepDots count={3} active={step} />
      </div>

      <div className="mt-10 flex flex-1 flex-col">
        {step === 0 && (
          <section className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold">What should we call you?</h2>
            <div className="flex flex-col gap-3">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                autoComplete="given-name"
              />
              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                autoComplete="family-name"
              />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold">Take a live photo</h2>
              <p className="mt-2 text-sm text-white/60">
                TrueLink only accepts a photo taken right now, from your camera.
              </p>
            </div>
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
            {photoPreview && (
              <p className="text-center text-xs text-white/60">
                Looks good? Continue or retake.
              </p>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-8">
            <div>
              <h3 className="text-lg font-semibold">I am</h3>
              <div className="mt-3">
                <Choice<Gender>
                  value={gender}
                  onChange={setGender}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">I want to meet</h3>
              <div className="mt-3">
                <Choice<Gender>
                  value={genderPref}
                  onChange={setGenderPref}
                  options={[
                    { value: "male", label: "Men" },
                    { value: "female", label: "Women" },
                  ]}
                />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Looking for</h3>
              <div className="mt-3">
                <Choice<Intent>
                  value={intent}
                  onChange={setIntent}
                  options={[
                    {
                      value: "long_term",
                      label: "Long term",
                      hint: "Something meaningful.",
                    },
                    {
                      value: "short_term",
                      label: "Short term",
                      hint: "Keeping it casual.",
                    },
                  ]}
                />
              </div>
            </div>
          </section>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-2xl bg-pink/10 px-4 py-3 text-center text-sm text-pink">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-5">
        {step < 2 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button
            disabled={!canNext}
            loading={submitting}
            onClick={submit}
          >
            Finish
          </Button>
        )}
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="text-sm text-white/60 hover:text-white"
          >
            Back
          </button>
        )}
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

function StepDots({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === active ? "w-6 bg-pink" : "w-1.5 bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-white/60">
        {label}
      </span>
      <input
        type="text"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-2xl border border-white/10 bg-navy-soft px-4 text-base outline-none transition focus:border-pink"
      />
    </label>
  );
}
