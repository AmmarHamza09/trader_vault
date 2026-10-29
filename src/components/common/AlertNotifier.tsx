import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from './Toast';
import { playChime } from '../../lib/alertSound';

// Watches incoming TradingView alerts in real time: plays a chime and shows a pop-up the
// moment one arrives. (System notifications when the app is closed come from web push.)
export const AlertNotifier: React.FC = () => {
  const { toast } = useToast();
  const signals = useQuery(api.tradingview.getSignals, {});
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (!signals) return;
    const newest = signals.length ? Math.max(...signals.map((s) => s.at)) : 0;
    if (seen.current === null) {
      seen.current = newest; // first load: don't replay old alerts
      return;
    }
    const fresh = signals.filter((s) => s.at > (seen.current as number)).sort((a, b) => a.at - b.at);
    seen.current = Math.max(seen.current, newest);
    for (const s of fresh) {
      if (s.event === 'entry') {
        playChime('entry');
        toast({
          type: 'info',
          title: `${s.side === 'sell' ? '🔴 SELL' : '🟢 BUY'} ${s.symbol} @ ${s.price}`,
          message: s.note ?? 'TradingView entry alert',
        });
      } else {
        const win = /\+\$/.test(s.note ?? '');
        playChime(win ? 'win' : 'loss');
        toast({
          type: win ? 'success' : 'error',
          title: `${win ? '✅' : '❌'} ${s.symbol} closed @ ${s.price}`,
          message: s.note ?? 'TradingView exit alert',
        });
      }
    }
  }, [signals, toast]);

  return null;
};
