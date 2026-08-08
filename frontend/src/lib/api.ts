export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

type BackendCheckOptions = {
  attempts?: number;
  timeoutMs?: number;
  onAttempt?: (attempt: number, attempts: number) => void;
};

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export async function waitForBackend({
  attempts = 3,
  timeoutMs = 20000,
  onAttempt,
}: BackendCheckOptions = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    onAttempt?.(attempt, attempts);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(apiUrl("/api/status"), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok) return;
    } catch {
      // A sleeping backend or temporary network failure is retried below.
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (attempt < attempts) {
      await delay(1000 * attempt);
    }
  }

  throw new Error("BACKEND_UNAVAILABLE");
}
