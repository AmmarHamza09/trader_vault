import { useEffect, useRef } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';

// Two jobs: (1) if the visitor picked a paid plan on the landing page before signing up, send them to checkout
// as soon as they're signed in; (2) confirm a successful payment when they come back from checkout.
export const PlanIntent: React.FC = () => {
  const { toast } = useToast();
  const me = useQuery(api.billing.myPlan, {});
  const checkout = useAction(api.billing.createCheckout);
  const ran = useRef(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('billing') === 'success') {
      toast({ type: 'success', title: 'Payment received 🎉', message: 'Your plan switches on in a few seconds.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!me || ran.current) return;
    let raw: string | null = null;
    try { raw = localStorage.getItem('tv_plan_intent'); } catch { /* ignore */ }
    if (!raw) return;
    ran.current = true;
    try { localStorage.removeItem('tv_plan_intent'); } catch { /* ignore */ }
    if (me.source !== 'free' || !me.billingReady) return;
    try {
      const { plan, interval } = JSON.parse(raw);
      if (plan !== 'pro' && plan !== 'elite') return;
      checkout({ plan, interval: interval === 'monthly' ? 'monthly' : 'yearly' })
        .then((url) => { window.location.href = url; })
        .catch(() => {});
    } catch { /* ignore */ }
  }, [me]);

  return null;
};
