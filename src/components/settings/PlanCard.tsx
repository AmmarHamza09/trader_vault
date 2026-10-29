import React, { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';

const PLANS = [
  { id: 'pro' as const, name: 'Pro', emoji: '🚀', monthly: 9, yearly: 7, blurb: 'AI coach, prop-firm phases, imports, sync, share links, unlimited accounts' },
  { id: 'elite' as const, name: 'Elite', emoji: '👑', monthly: 19, yearly: 15, blurb: 'Everything in Pro + early access to Backtesting & the script editor, priority support' },
];
const LABEL: Record<string, string> = { starter: 'Starter (free)', pro: 'Pro', elite: 'Elite' };
const date = (t: number | null) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const PlanCard: React.FC = () => {
  const { toast } = useToast();
  const me = useQuery(api.billing.myPlan, {});
  const checkout = useAction(api.billing.createCheckout);
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  if (!me) return null;

  const go = async (plan: 'pro' | 'elite') => {
    setBusy(plan);
    try {
      window.location.href = await checkout({ plan, interval: yearly ? 'yearly' : 'monthly' });
    } catch (e: any) {
      toast({ type: 'error', title: String(e?.message ?? e).replace(/^.*Error:\s*/, '').slice(0, 140) });
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-inner-card space-y-4" id="plan">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">💎 Plan &amp; billing</h3>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${me.plan === 'starter' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
          {me.source === 'super' ? '⭐ Super user' : `Current: ${LABEL[me.plan]}`}
        </span>
      </div>

      {me.source === 'super' ? (
        <p className="text-sm text-slate-600">You have full access to every feature, free. Nothing to pay. 💚</p>
      ) : me.source === 'subscription' ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            You're on <b>{LABEL[me.plan]}</b>
            {me.status === 'cancelled' ? <> — cancelled, access until <b>{date(me.endsAt)}</b>.</> : me.status === 'past_due' ? <> — your last payment failed, please update your card.</> : me.status === 'comped' ? <> — complimentary.</> : me.renewsAt ? <> — renews on <b>{date(me.renewsAt)}</b>.</> : '.'}
          </p>
          {me.portalUrl && <a href={me.portalUrl} target="_blank" rel="noreferrer" className="inline-block px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold">Manage subscription</a>}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">You're on the free Starter plan: 1 trading account and the core journal. Upgrade to unlock the AI coach, prop-firm phases, screenshot import, sync and share links.</p>
          <div className="inline-flex bg-slate-100 rounded-full p-1 text-xs font-semibold">
            <button onClick={() => setYearly(false)} className={`px-3 py-1.5 rounded-full ${!yearly ? 'bg-black text-white' : 'text-slate-600'}`}>Monthly</button>
            <button onClick={() => setYearly(true)} className={`px-3 py-1.5 rounded-full ${yearly ? 'bg-black text-white' : 'text-slate-600'}`}>Yearly −20%</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {PLANS.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold text-slate-800">{p.emoji} {p.name}</p>
                  <p className="text-lg font-bold text-slate-900">${yearly ? p.yearly : p.monthly}<span className="text-xs font-medium text-slate-400"> /mo</span></p>
                </div>
                <p className="text-xs text-slate-500">{p.blurb}</p>
                <p className="text-[11px] text-slate-400">{yearly ? `Billed $${p.yearly * 12} yearly` : 'Billed monthly'} · cancel anytime</p>
                <button disabled={!!busy || !me.billingReady} onClick={() => go(p.id)} className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                  {busy === p.id ? 'Opening checkout…' : me.billingReady ? `Upgrade to ${p.name}` : 'Payments opening soon'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
