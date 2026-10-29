import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';

export const Mt5SyncCard: React.FC = () => {
  const { toast } = useToast();
  const key = useQuery(api.mt5.getMt5Key, {});
  const generate = useMutation(api.mt5.generateMt5Key);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string) || '';
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ type: 'success', title: `${what} copied` });
    } catch {
      toast({ type: 'error', title: 'Copy failed', message: 'Select and copy it manually.' });
    }
  };

  const handleGenerate = async () => {
    if (key && !window.confirm('Generate a new key? The old key stops working — update it in your MT5 EA.')) return;
    setBusy(true);
    try {
      await generate({});
      setShow(true);
    } catch (e: any) {
      toast({ type: 'error', title: 'Could not create key', message: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-inner-card space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">📡 MT5 Auto-Sync</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Closed trades from your MetaTrader 5 land in your journal automatically — no manual entry/exit typing.
        Works with any broker. MT5 must be running (desktop or VPS) with the EA attached.
      </p>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">Your API key</label>
        {key === undefined ? (
          <div className="text-xs text-slate-400">Loading…</div>
        ) : key ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={show ? key : '•'.repeat(24)}
              className="flex-1 min-w-0 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="px-3 text-xs font-semibold rounded-lg border border-slate-200">
              {show ? 'Hide' : 'Show'}
            </button>
            <button type="button" onClick={() => copy(key, 'API key')} className="px-3 text-xs font-semibold rounded-lg border border-slate-200">
              Copy
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No key yet.</p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={handleGenerate}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-60"
        >
          {key ? 'Regenerate key' : 'Generate key'}
        </button>
      </div>

      <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4 leading-relaxed">
        <li>
          Download the EA:{' '}
          <a href="/TradeVaultSync.mq5" download className="text-emerald-600 font-semibold underline">
            TradeVaultSync.mq5
          </a>{' '}
          and put it in MT5 → File → Open Data Folder → MQL5 → Experts, then compile it in MetaEditor (F7).
        </li>
        <li>
          In MT5: Tools → Options → Expert Advisors → tick <b>Allow WebRequest</b> and add{' '}
          <button type="button" onClick={() => copy(siteUrl, 'URL')} className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
            {siteUrl || 'your convex site URL'}
          </button>
        </li>
        <li>Drag the EA onto any chart, paste your API key into its inputs, and allow Algo Trading.</li>
        <li>Past 30 days of closed trades back-fill on start; every new closed trade syncs instantly.</li>
      </ol>
    </div>
  );
};
