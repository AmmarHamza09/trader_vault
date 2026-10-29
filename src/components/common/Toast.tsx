import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (options: { type?: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

// Convex wraps server errors as "[CONVEX M(fn)] [Request ID: …] Server Error\nUncaught Error: <real message>\n    at …".
// Show only the real message.
const cleanMessage = (m?: string) => {
  if (!m) return m;
  const hit = m.match(/Uncaught Error:\s*([^\n]*)/);
  if (hit) return hit[1].trim();
  return m.replace(/\[CONVEX[^\]]*\]\s*(\[Request ID:[^\]]*\]\s*)?/g, '').split('\n')[0].trim() || m;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(({ type = 'success', title, message }: { type?: 'success' | 'error' | 'info'; title: string; message?: string }) => {
    const id = Math.random().toString(36).substring(2, 9);
    message = cleanMessage(message);
    // A plan limit isn't a failure — present it as an upgrade prompt and keep it up a bit longer.
    const paywall = !!message && /upgrade in Settings/i.test(message);
    if (paywall) { type = 'info'; title = '⭐ Upgrade to unlock'; }
    setToasts((prev) => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, paywall ? 7000 : 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
              t.type === 'success'
                ? 'bg-slate-800/95 border-emerald-500/30 text-white shadow-emerald-950/20'
                : t.type === 'error'
                ? 'bg-slate-800/95 border-rose-500/30 text-white shadow-rose-950/20'
                : 'bg-slate-800/95 border-slate-700/50 text-white shadow-slate-950/20'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}

            <div className="flex-1">
              <h5 className="text-sm font-semibold text-slate-100">{t.title}</h5>
              {t.message && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.message}</p>}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
