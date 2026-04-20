"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FacingMode = "user" | "environment";

type Status =
  | "idle"
  | "requesting"
  | "streaming"
  | "captured"
  | "denied"
  | "unsupported"
  | "error";

interface Props {
  onCapture: (blob: Blob, previewUrl: string) => void;
  onClear?: () => void;
}

const CAPTURE_SIZE = 1024;

export function CameraCapture({ onCapture, onClear }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>("user");
  const [preview, setPreview] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const start = useCallback(
    async (nextFacing: FacingMode = facing) => {
      setError(null);

      if (typeof window === "undefined") return;
      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setStatus("unsupported");
        return;
      }
      if (!window.isSecureContext) {
        setStatus("unsupported");
        setError(
          "Camera access needs HTTPS or localhost. Reopen the app on a secure URL.",
        );
        return;
      }

      stopStream();
      setStatus("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1080 },
            height: { ideal: 1080 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {
            /* iOS needs the user gesture which we already have; ignore replay errors */
          });
        }
        setStatus("streaming");
      } catch (err) {
        const name = (err as DOMException)?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setError(
            "Camera permission was denied. Enable it in your browser settings, then retry.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("error");
          setError("No compatible camera found on this device.");
        } else {
          setStatus("error");
          setError(
            (err as Error)?.message ?? "Unable to start the camera. Please retry.",
          );
        }
      }
    },
    [facing, stopStream],
  );

  useEffect(() => {
    return () => {
      stopStream();
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flip = useCallback(async () => {
    const next: FacingMode = facing === "user" ? "environment" : "user";
    setFacing(next);
    await start(next);
  }, [facing, start]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facing === "user") {
      ctx.translate(CAPTURE_SIZE, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (preview) URL.revokeObjectURL(preview);
        const url = URL.createObjectURL(blob);
        setPreview(url);
        setStatus("captured");
        stopStream();
        onCapture(blob, url);
      },
      "image/jpeg",
      0.9,
    );
  }, [facing, onCapture, preview, stopStream]);

  const retake = useCallback(async () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    onClear?.();
    await start(facing);
  }, [facing, onClear, preview, start]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-navy-deep shadow-pop">
        {status === "captured" && preview ? (
          <img
            src={preview}
            alt="Captured preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${
              facing === "user" ? "-scale-x-100" : ""
            }`}
          />
        )}

        {(status === "idle" || status === "requesting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-navy/80 p-6 text-center text-sm text-white/80">
            {status === "requesting" ? (
              <>
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pink border-t-transparent" />
                <p>Starting camera...</p>
              </>
            ) : (
              <>
                <CameraIcon className="h-10 w-10 text-pink" />
                <p>Photos on TrueLink must be taken live, right now.</p>
                <button
                  type="button"
                  onClick={() => start()}
                  className="rounded-pill bg-pink px-6 py-3 text-sm font-semibold text-white shadow-pop"
                >
                  Enable camera
                </button>
              </>
            )}
          </div>
        )}

        {(status === "denied" ||
          status === "unsupported" ||
          status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/90 p-6 text-center text-sm text-white/80">
            <CameraIcon className="h-10 w-10 text-pink" />
            <p className="font-medium">
              {status === "unsupported"
                ? "Camera isn't available here"
                : status === "denied"
                  ? "Camera access blocked"
                  : "Camera error"}
            </p>
            {error && <p className="text-xs text-white/60">{error}</p>}
            {status !== "unsupported" && (
              <button
                type="button"
                onClick={() => start()}
                className="mt-2 rounded-pill bg-pink px-5 py-2 text-xs font-semibold text-white"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        {status === "captured" ? (
          <button
            type="button"
            onClick={retake}
            className="flex h-12 flex-1 items-center justify-center rounded-pill border border-white/20 text-sm font-semibold text-white/90"
          >
            Retake
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={flip}
              disabled={status !== "streaming"}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white/80 disabled:opacity-40"
              aria-label="Flip camera"
            >
              <FlipIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={capture}
              disabled={status !== "streaming"}
              className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/30 bg-white/0 transition disabled:opacity-40"
              aria-label="Take photo"
            >
              <span className="h-12 w-12 rounded-full bg-pink shadow-pop" />
            </button>

            <div className="h-12 w-12" aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function FlipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
      aria-hidden="true"
    >
      <path d="M16 4h3a2 2 0 0 1 2 2v3" />
      <path d="M8 20H5a2 2 0 0 1-2-2v-3" />
      <path d="m21 9-3-3-3 3" />
      <path d="m3 15 3 3 3-3" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
