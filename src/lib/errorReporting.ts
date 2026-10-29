// Sends browser errors to the backend (plain fetch, so it works even if React has crashed).
const SITE = (import.meta.env.VITE_CONVEX_SITE_URL as string) || '';
const sent = new Map<string, number>();
let windowStart = Date.now();
let windowCount = 0;

export const reportClientError = (message: string, stack?: string) => {
  if (!SITE || !message) return;
  const key = message.slice(0, 120);
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= 5) return; // never flood the server
  if (sent.has(key) && now - (sent.get(key) as number) < 5 * 60_000) return; // dedupe repeats
  sent.set(key, now);
  windowCount++;
  try {
    fetch(`${SITE}/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ message, stack, url: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
};

const isNoise = (msg: string) => /ResizeObserver|Script error|AbortError|Load failed|NetworkError|cancelled/i.test(msg);

export const installGlobalHandlers = () => {
  window.addEventListener('error', (e) => {
    const msg = e.message || '';
    if (!msg || isNoise(msg)) return;
    // a stale deploy can leave the browser with old chunk URLs — one automatic reload fixes it
    if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)) {
      if (!sessionStorage.getItem('tv_chunk_reload')) {
        sessionStorage.setItem('tv_chunk_reload', '1');
        location.reload();
        return;
      }
    }
    reportClientError(msg, e.error?.stack);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e.reason && (e.reason.message || e.reason)) || 'Unhandled promise rejection');
    if (isNoise(msg)) return;
    reportClientError(msg, e.reason?.stack);
  });
};
