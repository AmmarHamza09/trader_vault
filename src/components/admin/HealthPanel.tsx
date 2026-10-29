import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};

// Live view of the 24/7 background workers: AI model health, data self-repair, and recent app errors.
export const HealthPanel: React.FC = () => {
  const h = useQuery(api.health.adminStatus, {});
  if (h === undefined) return <div className="text-sm text-slate-400">Loading system health…</div>;
  const aiOk = !!h.ai && h.ai.results.some((r) => r.ok);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">🤖 AI service</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${aiOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {h.ai ? (aiOk ? 'Healthy' : 'Down — retrying') : 'Not checked yet'}
            </span>
          </div>
          {h.ai ? (
            <>
              <p className="text-[11px] text-slate-400">Checked {ago(h.ai.checkedAt)} · every 5 min · AI features try models in this order:</p>
              <div className="space-y-1">
                {h.ai.order.map((m, i) => {
                  const r = h.ai!.results.find((x) => x.model === m)!;
                  return (
                    <div key={m} className="flex items-center justify-between text-xs rounded-lg bg-slate-50 px-3 py-1.5">
                      <span className="font-medium text-slate-700">{i + 1}. {m}</span>
                      <span className={r.ok ? 'text-emerald-600' : 'text-rose-500'}>{r.ok ? `${(r.ms / 1000).toFixed(1)}s` : r.error?.includes('timeout') ? 'too slow' : 'busy / failing'}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">The first check runs within 5 minutes.</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">🛠️ Self-repair workers</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">Running 24/7</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
            <li>• <b>Every 5 min:</b> tests every AI model, re-ranks them, skips broken ones, alerts admins if all are down.</li>
            <li>• <b>Every hour:</b> re-verifies every account balance and challenge phase and corrects drift.</li>
            <li>• <b>In every browser:</b> crashes auto-recover with a friendly message; stale versions auto-update; errors are reported here.</li>
          </ul>
          <p className="text-[11px] text-slate-400">
            Last data check: {h.lastData ? `${ago(h.lastData._creationTime)} — ${h.lastData.detail}` : 'pending'}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">🐞 Recent app errors {h.errors.length === 0 && <span className="text-emerald-600 font-normal">— none, all clear ✅</span>}</h3>
        <div className="space-y-1.5">
          {h.errors.map((e) => (
            <div key={e._id} className="flex items-start justify-between gap-3 text-xs rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-700 break-all">{e.message}</span>
              <span className="text-slate-400 whitespace-nowrap">×{e.count} · {ago(e.lastSeen)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
