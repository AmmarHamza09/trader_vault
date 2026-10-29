import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';

const pine = (key: string) => `// ===== TraderVault sync: add these lines to your strategy =====
// 1) Near your other inputs:
tvKey  = input.string("${key}", "TraderVault API key")
tvLots = input.float(1.0, "Lots (for journal P&L)", minval=0.01)

// 2) Message builders (place before the ENTRIES section):
msgEntry(side, slPrice) =>
    '{"apiKey":"' + tvKey + '","event":"entry","symbol":"XAUUSD","side":"' + side + '","price":{{strategy.order.price}},"sl":' + str.tostring(slPrice) + ',"rr":' + str.tostring(rr) + ',"lots":' + str.tostring(tvLots) + ',"time":"{{timenow}}"}'
msgExit = '{"apiKey":"' + tvKey + '","event":"exit","symbol":"XAUUSD","price":{{strategy.order.price}},"time":"{{timenow}}"}'

// 3) Add alert_message to these calls:
strategy.entry("LONG",  strategy.long,  alert_message = msgEntry("buy", low))
strategy.entry("SHORT", strategy.short, alert_message = msgEntry("sell", high))
strategy.exit("LONG TP/SL",  from_entry="LONG",  stop=sl, limit=tp, alert_message = msgExit)
strategy.exit("SHORT TP/SL", from_entry="SHORT", stop=sl, limit=tp, alert_message = msgExit)
strategy.close("LONG",  comment="EMA EXIT", alert_message = msgExit)
strategy.close("SHORT", comment="EMA EXIT", alert_message = msgExit)`;

export const TradingViewCard: React.FC = () => {
  const { toast } = useToast();
  const key = useQuery(api.mt5.getMt5Key, {});
  const generate = useMutation(api.mt5.generateMt5Key);
  const signals = useQuery(api.tradingview.getSignals, {});
  const [showPine, setShowPine] = useState(false);

  const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string) || '';
  const hook = `${siteUrl}/tv/webhook`;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ type: 'success', title: `${what} copied` });
    } catch {
      toast({ type: 'error', title: 'Copy failed', message: 'Select and copy it manually.' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-inner-card space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">📈 TradingView Sync</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Your TradingView strategy alerts log trades here automatically: an <b>entry</b> alert opens a trade, the matching <b>exit</b>{' '}
        alert closes and journals it (with SL, TP, R-multiple and your strategy tags). Needs a TradingView plan that allows webhook
        alerts. Uses the same API key as MT5 sync.
      </p>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">Webhook URL (paste into the alert)</label>
        <div className="flex gap-2">
          <input readOnly value={hook} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50" />
          <button type="button" onClick={() => copy(hook, 'Webhook URL')} className="px-3 text-xs font-semibold rounded-lg border border-slate-200">Copy</button>
        </div>
      </div>

      {key === null ? (
        <button
          type="button"
          onClick={() => generate({})}
          className="px-4 py-2 text-xs font-semibold text-white bg-black rounded-full"
        >
          Generate API key first
        </button>
      ) : (
        <>
          <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4 leading-relaxed">
            <li>
              In TradingView open your strategy in the Pine editor and add the lines below.{' '}
              <button type="button" onClick={() => setShowPine((v) => !v)} className="text-emerald-600 font-semibold underline">
                {showPine ? 'Hide code' : 'Show code'}
              </button>
              {showPine && (
                <div className="mt-2 space-y-2">
                  <pre className="tv-mono text-[10px] leading-4 bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto whitespace-pre">{pine(key ?? 'YOUR_KEY')}</pre>
                  <button type="button" onClick={() => copy(pine(key ?? ''), 'Code')} className="px-3 py-1.5 text-xs rounded-full bg-black text-white">Copy code</button>
                </div>
              )}
            </li>
            <li>Create alert (⏰) → Condition: your strategy → <b>Order fills only</b>.</li>
            <li>Message box: <code className="tv-mono bg-slate-100 px-1 rounded">{'{{strategy.order.alert_message}}'}</code></li>
            <li>Notifications → tick <b>Webhook URL</b> and paste the URL above → Create.</li>
          </ol>
        </>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-700">Recent alerts received</p>
        {signals === undefined ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : signals.length === 0 ? (
          <p className="text-xs text-slate-400">None yet — they'll show up here as soon as TradingView fires one.</p>
        ) : (
          <div className="space-y-1">
            {signals.map((s) => (
              <div key={s._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className="font-medium text-slate-800">
                  {s.event === 'entry' ? '🟢 Entry' : '🔴 Exit'} · {s.symbol}
                  {s.side ? ` ${s.side}` : ''} @ {s.price}
                </span>
                <span className="text-slate-400 text-right">{s.note ?? ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
