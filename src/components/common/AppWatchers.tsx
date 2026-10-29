import React, { useEffect, useRef, useState } from 'react';

declare const __BUILD_ID__: string;

// Two background watchers:
//  - UpdateWatcher: when a new version is deployed, refresh automatically once the user is idle
//    (or show a one-tap banner) — so nobody is ever stuck on a stale, broken bundle.
//  - OfflineBanner: tells the user the connection dropped; the app reconnects by itself.
export const UpdateWatcher: React.FC = () => {
  const [stale, setStale] = useState(false);
  const lastInput = useRef(Date.now());

  useEffect(() => {
    const bump = () => (lastInput.current = Date.now());
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!stop && j?.id && typeof __BUILD_ID__ !== 'undefined' && j.id !== __BUILD_ID__) {
          setStale(true);
          if (Date.now() - lastInput.current > 20_000) location.reload(); // idle → update silently
        }
      } catch {
        /* offline or dev server — ignore */
      }
    };
    const id = window.setInterval(check, 90_000);
    return () => {
      stop = true;
      window.clearInterval(id);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, []);

  if (!stale) return null;
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-full bg-black text-white text-sm shadow-xl"
    >
      ✨ New version ready — tap to update
    </button>
  );
};

export const OfflineBanner: React.FC = () => {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-amber-400 text-black text-center text-sm py-2">
      📡 You're offline — reconnecting automatically. Your data is safe.
    </div>
  );
};
