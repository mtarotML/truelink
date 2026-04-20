import FingerprintJS from "@fingerprintjs/fingerprintjs";

const CACHE_KEY = "truelink_device_id";

let agentPromise: ReturnType<typeof FingerprintJS.load> | null = null;

function loadAgent() {
  if (!agentPromise) {
    agentPromise = FingerprintJS.load();
  }
  return agentPromise;
}

export async function getDeviceId(): Promise<string> {
  if (typeof window === "undefined") return "";

  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) return cached;
  } catch {
    /* localStorage might be disabled in private mode */
  }

  const fp = await loadAgent();
  const { visitorId } = await fp.get();

  try {
    window.localStorage.setItem(CACHE_KEY, visitorId);
  } catch {
    /* ignore */
  }

  return visitorId;
}
