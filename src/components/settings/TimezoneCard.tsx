import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';

const pad = (n: number) => String(((n % 24) + 24) % 24).padStart(2, '0');

export const TimezoneCard: React.FC = () => {
  const { toast } = useToast();
  const offsets = useQuery(api.users.getTimeOffsets, {});
  const save = useMutation(api.users.setTimeOffsets);
  const [tv, setTv] = useState('7');
  const [mt5, setMt5] = useState('0');

  useEffect(() => {
    if (offsets) {
      setTv(String(offsets.tv));
      setMt5(String(offsets.mt5));
    }
  }, [offsets]);

  const tvN = Number(tv) || 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-inner-card space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">🕒 Screenshot Time Zones</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Your journal uses <b>Pakistan time</b>. TradingView and MT5 screenshots show a different clock, so TraderVault adds the hours below
        to every time it reads from a screenshot (and tells the AI coach about it).
      </p>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm">
        <span>
          📈 TradingView time → Pakistan time
          <span className="block text-[11px] text-slate-400">add this many hours (TradingView 14:00 → {pad(14 + tvN)}:00 PKT)</span>
        </span>
        <input type="number" step="0.5" min={-14} max={14} value={tv} onChange={(e) => setTv(e.target.value)} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-right" />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm">
        <span>
          📱 MT5 screenshot time → Pakistan time
          <span className="block text-[11px] text-slate-400">0 if your MT5 already shows Pakistan time</span>
        </span>
        <input type="number" step="0.5" min={-14} max={14} value={mt5} onChange={(e) => setMt5(e.target.value)} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-right" />
      </label>
      <button
        type="button"
        onClick={async () => {
          try {
            await save({ tv: Number(tv) || 0, mt5: Number(mt5) || 0 });
            toast({ type: 'success', title: 'Time zones saved' });
          } catch (e: any) {
            toast({ type: 'error', title: 'Could not save', message: e?.message });
          }
        }}
        className="px-5 py-2 rounded-full text-xs bg-black text-white"
      >
        Save
      </button>
    </div>
  );
};
