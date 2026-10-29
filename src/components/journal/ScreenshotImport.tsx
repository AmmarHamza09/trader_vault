import React, { useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Smartphone } from 'lucide-react';
import { TradingAccount } from '../../types';
import { ImageUploader } from '../common/ImageUploader';
import { useToast } from '../common/Toast';
import { shiftLocal } from '../../lib/timeShift';

interface Row {
  symbol: string;
  type: string;
  volume: number;
  openPrice: number | null;
  closePrice: number | null;
  openTime: string | null;
  closeTime: string | null;
  profit: number;
  commission: number | null;
  swap: number | null;
  sl: number | null;
  tp: number | null;
  source?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const splitTime = (s: string | null, fallbackDate: string) => {
  const m = s?.match(/(\d{4})[-.](\d{2})[-.](\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4].padStart(2, '0')}:${m[5]}` };
  return { date: fallbackDate, time: '00:00' };
};
const sessionFor = (hour: number) =>
  hour >= 12 && hour < 16 ? 'Overlap' : hour >= 7 && hour < 12 ? 'London' : hour >= 16 && hour < 21 ? 'New York' : 'Asian';

export const ScreenshotImport: React.FC<{
  currentAccount: TradingAccount | null;
  onDone: () => void;
}> = ({ currentAccount, onDone }) => {
  const { toast } = useToast();
  const generateUploadUrl = useMutation(api.trades.generateUploadUrl);
  const extract = useAction(api.ai.extractTradesFromScreenshot);
  const bulkCreate = useMutation(api.trades.bulkCreateTrades);
  const offsets = useQuery(api.users.getTimeOffsets, {});
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);

  const handleUploaded = async (storageId: any) => {
    setReading(true);
    try {
      const result = (await extract({ storageId })) as Row[];
      setRows(result);
      setPicked(result.map(() => true));
      if (result.length === 0) toast({ type: 'info', title: 'No trades found', message: 'Try a clearer screenshot of the History tab.' });
    } catch (e: any) {
      toast({ type: 'error', title: 'Could not read screenshot', message: e?.message });
    } finally {
      setReading(false);
    }
  };

  const handleImport = async () => {
    if (!rows || !currentAccount) return;
    const trades = rows
      .filter((_, i) => picked[i])
      .map((r) => {
        // screenshot clock → Pakistan time (TradingView and MT5 each have their own offset)
        const hoursToAdd = r.source === 'tradingview' ? offsets?.tv ?? 7 : r.source === 'mt5' ? offsets?.mt5 ?? 0 : 0;
        const rawOpen = splitTime(r.openTime ?? r.closeTime, today());
        const rawClose = splitTime(r.closeTime ?? r.openTime, rawOpen.date);
        let open = hoursToAdd ? shiftLocal(rawOpen.date, rawOpen.time, hoursToAdd) : rawOpen;
        let close = hoursToAdd ? shiftLocal(rawClose.date, rawClose.time, hoursToAdd) : rawClose;
        // A trade can't close before it opens — if the AI mixed up the two columns, swap them.
        if (`${close.date} ${close.time}` < `${open.date} ${open.time}`) {
          const tmp = open;
          open = close;
          close = tmp;
        }
        const entry = r.openPrice ?? 0;
        const exit = r.closePrice ?? 0;
        const commission = r.commission ?? 0;
        const swap = r.swap ?? 0;
        const net = r2(r.profit + commission + swap);
        const perUnit = entry && exit && entry !== exit ? Math.abs(r.profit) / Math.abs(exit - entry) : 0;
        const risk = r.sl && perUnit ? r2(Math.abs(entry - r.sl) * perUnit) : 0;
        const reward = r.tp && perUnit ? r2(Math.abs(r.tp - entry) * perUnit) : 0;
        return {
          accountId: currentAccount.id,
          instrument: r.symbol.toUpperCase(),
          direction: r.type?.toLowerCase().startsWith('s') ? 'SELL' : 'BUY',
          entryDate: open.date,
          entryTime: open.time,
          exitDate: close.date,
          exitTime: close.time,
          entryPrice: entry,
          exitPrice: exit,
          stopLoss: r.sl ?? 0,
          takeProfit: r.tp ?? 0,
          positionSize: r.volume,
          riskAmount: risk,
          potentialReward: reward,
          grossPnL: r2(r.profit),
          commission,
          swap,
          netPnL: net,
          outcome: net > 10 ? 'WIN' : net < -10 ? 'LOSS' : 'BREAKEVEN',
          rMultiple: risk ? r2(net / risk) : 0,
          plannedRR: risk ? r2(reward / risk) : 0,
          roiPercentage: currentAccount.currentBalance > 0 ? r2((net / currentAccount.currentBalance) * 100) : 0,
          strategy: 'Screenshot Import',
          timeframe: 'Unknown',
          session: sessionFor((parseInt(open.time.slice(0, 2), 10) + 19) % 24),
          setupType: 'Screenshot Import',
          entryReason: 'Imported from screenshot',
          exitReason: 'Imported from screenshot',
          tags: ['mt5', 'screenshot'],
          moodBefore: 'Neutral',
          confidenceLevel: 3,
          emotionDuring: 'Disciplined',
          followedPlan: true,
          revengeTrade: false,
          fomoTrade: false,
          screenshots: [],
          mt5Ticket: `shot:${r.symbol}:${r.openTime ?? r.closeTime ?? ''}:${r.volume}:${r.closePrice ?? ''}:${r.profit}`,
        };
      });
    if (trades.length === 0) return;
    setSaving(true);
    try {
      const res = await bulkCreate({ trades } as any);
      toast({
        type: 'success',
        title: 'Imported from screenshot',
        message: `${res.imported} added${res.skipped ? ` · ${res.skipped} already in journal` : ''}.`,
      });
      onDone();
    } catch (e: any) {
      toast({ type: 'error', title: 'Import failed', message: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        <Smartphone className="inline w-3.5 h-3.5 mr-1" />
        In MT5 mobile open <b>History</b>, or in TradingView open your <b>Account history / Trades list</b> → screenshot the closed trades → upload it here. AI reads every trade;
        you review before anything is saved. Same trade twice is skipped automatically.
      </p>

      {reading ? (
        <div className="flex items-center gap-2 text-xs text-violet-600 font-medium py-6 justify-center">
          <span className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
          Reading your trades…
        </div>
      ) : (
        <ImageUploader generateUploadUrl={() => generateUploadUrl()} onUploaded={handleUploaded} label="Upload trade history screenshot" />
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {rows.map((r, i) => (
              <label key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 text-xs cursor-pointer">
                <input type="checkbox" checked={picked[i]} onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                <span className="font-semibold text-slate-800">{r.symbol}</span>
                <span className={r.type?.toLowerCase().startsWith('s') ? 'text-rose-600' : 'text-emerald-600'}>
                  {r.type?.toUpperCase()} {r.volume}
                </span>
                <span className="text-slate-400 truncate flex-1">
                  {r.openPrice ?? '?'} → {r.closePrice ?? '?'}
                </span>
                <span className={`font-mono font-semibold ${r.profit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {r.profit >= 0 ? '+' : ''}
                  {r.profit}
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={saving || !currentAccount || !picked.some(Boolean)}
            onClick={handleImport}
            className="w-full py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'Importing…' : `Import ${picked.filter(Boolean).length} trade(s)`}
          </button>
        </>
      )}
    </div>
  );
};
