import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Trash2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useMutation, useAction, useQuery } from 'convex/react';
import { shiftLocal } from '../../lib/timeShift';
import { api } from '../../../convex/_generated/api';
import {
  Trade,
  User,
  TradingAccount,
  Direction,
  TradeOutcome,
  TradingSession,
  Mood,
  EmotionDuring,
  TradeScreenshot,
} from '../../types';
import { estimateTradePnL } from '../../lib/calculations';
import { useToast } from '../common/Toast';
import { ImageUploader } from '../common/ImageUploader';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTrade?: Trade | null;
  onTradeSaved: (trade: Trade) => void | Promise<void>;
  currentUser: User;
  accounts: TradingAccount[];
  currentAccountId: string;
}

const COMMON_INSTRUMENTS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NAS100', 'US30', 'USDJPY', 'AUDUSD', 'BTCUSD'];
const COMMON_STRATEGIES = [
  '9 EMA / VWAP Cross (1:2)',
  'London Liquidity Sweep',
  'NY FVG Retest',
  'Order Block Rejection',
  'Opening Range Breakout',
  'Asia High/Low Sweep',
  'Break of Structure (BOS)',
  'Daily Trend Continuation',
  'Supply/Demand Zone Tap',
];

export const AddTradeModal: React.FC<AddTradeModalProps> = ({
  isOpen,
  onClose,
  initialTrade,
  onTradeSaved,
  currentUser,
  accounts,
  currentAccountId,
}) => {
  const { toast } = useToast();
  const generateUploadUrl = useMutation(api.trades.generateUploadUrl);
  const analyzeTradeChart = useAction(api.ai.analyzeTradeChart);
  const timeOffsets = useQuery(api.users.getTimeOffsets, {});
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiDetected, setAiDetected] = useState<{ confidence?: string } | null>(null);
  const currentAccount = accounts.find((a) => a.id === currentAccountId) || accounts[0] || null;

  // Form State
  const [selectedAccountId, setSelectedAccountId] = useState(
    initialTrade?.accountId || currentAccount?.id || accounts[0]?.id || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [instrument, setInstrument] = useState(initialTrade?.instrument || 'XAUUSD');
  const [direction, setDirection] = useState<Direction>(initialTrade?.direction || 'BUY');
  const [entryDate, setEntryDate] = useState(
    initialTrade?.entryDate || new Date().toISOString().split('T')[0]
  );
  const [entryTime, setEntryTime] = useState(
    initialTrade?.entryTime ||
      new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Karachi',
      })
  );
  const [exitDate, setExitDate] = useState(
    initialTrade?.exitDate || new Date().toISOString().split('T')[0]
  );
  const [exitTime, setExitTime] = useState(initialTrade?.exitTime || '11:15');

  const [entryPrice, setEntryPrice] = useState<string>(
    initialTrade ? initialTrade.entryPrice.toString() : '2650.00'
  );
  const [exitPrice, setExitPrice] = useState<string>(
    initialTrade ? initialTrade.exitPrice.toString() : '2672.00'
  );
  const [stopLoss, setStopLoss] = useState<string>(
    initialTrade ? initialTrade.stopLoss.toString() : '2640.00'
  );
  const [takeProfit, setTakeProfit] = useState<string>(
    initialTrade ? initialTrade.takeProfit.toString() : '2670.00'
  );
  const [positionSize, setPositionSize] = useState<string>(
    initialTrade ? initialTrade.positionSize.toString() : '2.0'
  );
  const [commission, setCommission] = useState<string>(
    initialTrade ? initialTrade.commission.toString() : '14.0'
  );

  // Strategy & Context
  const [strategy, setStrategy] = useState(
    initialTrade?.strategy || '9 EMA / VWAP Cross (1:2)'
  );
  const [timeframe, setTimeframe] = useState(initialTrade?.timeframe || '5m');
  const [session, setSession] = useState<TradingSession>(initialTrade?.session || 'New York');
  const [setupType, setSetupType] = useState(initialTrade?.setupType || 'EMA/VWAP Cross');
  const [marketConditions, setMarketConditions] = useState(
    initialTrade?.marketConditions || 'Trending Bullish'
  );
  const [entryReason, setEntryReason] = useState(
    initialTrade?.entryReason || '9 EMA crossed VWAP during the NY session (09:30–16:00 ET); SL at signal candle low/high, TP at 1:2.'
  );
  const [exitReason, setExitReason] = useState(
    initialTrade?.exitReason || 'TP 1:2 hit / SL hit / closed when a candle crossed back through the 9 EMA.'
  );
  const [mistakesMade, setMistakesMade] = useState(initialTrade?.mistakesMade || '');
  const [lessonsLearned, setLessonsLearned] = useState(
    initialTrade?.lessonsLearned || ''
  );
  const [tagsInput, setTagsInput] = useState(
    initialTrade?.tags ? initialTrade.tags.join(', ') : 'EMA, VWAP, NY'
  );

  // Psychology
  const [moodBefore, setMoodBefore] = useState<Mood>(initialTrade?.moodBefore || 'Calm');
  const [confidenceLevel, setConfidenceLevel] = useState<1 | 2 | 3 | 4 | 5>(
    initialTrade?.confidenceLevel || 4
  );
  const [emotionDuring, setEmotionDuring] = useState<EmotionDuring>(
    initialTrade?.emotionDuring || 'Disciplined'
  );
  const [followedPlan, setFollowedPlan] = useState<boolean>(
    initialTrade ? initialTrade.followedPlan : true
  );
  const [revengeTrade, setRevengeTrade] = useState<boolean>(
    initialTrade ? initialTrade.revengeTrade : false
  );
  const [fomoTrade, setFomoTrade] = useState<boolean>(
    initialTrade ? initialTrade.fomoTrade : false
  );

  // Screenshots
  const [screenshots, setScreenshots] = useState<TradeScreenshot[]>(
    initialTrade?.screenshots || []
  );

  // Strategy rule: TP = entry ± 2 × risk (1:2). Auto-fills until the trader edits TP themselves.
  const tpTouched = useRef(!!initialTrade);
  useEffect(() => {
    if (tpTouched.current) return;
    const e = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    if (!isFinite(e) || !isFinite(sl) || e === sl) return;
    setTakeProfit((e + (e - sl) * 2).toFixed(2));
  }, [entryPrice, stopLoss]);

  // Real-time calculation previews
  const numEntry = parseFloat(entryPrice) || 0;
  const numExit = parseFloat(exitPrice) || 0;
  const numSL = parseFloat(stopLoss) || 0;
  const numTP = parseFloat(takeProfit) || 0;

  const numSize = parseFloat(positionSize) || 0;
  const numComm = parseFloat(commission) || 0;

  const est = estimateTradePnL({
    instrument,
    direction,
    entryPrice: numEntry,
    exitPrice: numExit,
    positionSize: numSize,
    commission: numComm,
  });

  const riskEst = estimateTradePnL({
    instrument,
    direction,
    entryPrice: numEntry,
    exitPrice: numSL,
    positionSize: numSize,
  });
  const riskMoney = Math.abs(riskEst.grossPnL);

  const rewardEst = estimateTradePnL({
    instrument,
    direction,
    entryPrice: numEntry,
    exitPrice: numTP,
    positionSize: numSize,
  });
  const potentialReward = Math.abs(rewardEst.grossPnL);

  const realizedR = riskMoney > 0 ? Math.round((est.netPnL / riskMoney) * 100) / 100 : 0;
  const plannedRR = riskMoney > 0 ? Math.round((potentialReward / riskMoney) * 100) / 100 : 0;

  let outcome: TradeOutcome = 'BREAKEVEN';
  if (est.netPnL > 10) outcome = 'WIN';
  else if (est.netPnL < -10) outcome = 'LOSS';

  if (!isOpen) return null;

  const handleRemoveScreenshot = (id: string) => {
    setScreenshots(screenshots.filter((s) => s.id !== id));
  };

  const handleScreenshotUploaded = (storageId: any, file: File) => {
    setScreenshots((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'analysis',
        url: URL.createObjectURL(file),
        storageId,
      },
    ]);
  };

  const handleChartUploaded = async (storageId: any, file: File) => {
    // Keep the chart as an attached screenshot too, not just an AI input.
    handleScreenshotUploaded(storageId, file);

    setAiAnalyzing(true);
    setAiDetected(null);
    try {
      const result = await analyzeTradeChart({ storageId });
      setAiDetected(result);
      if (result.instrument) setInstrument(String(result.instrument).toUpperCase());
      if (result.direction === 'BUY' || result.direction === 'SELL') setDirection(result.direction);
      if (result.entryPrice) setEntryPrice(String(result.entryPrice));
      if (result.stopLoss) setStopLoss(String(result.stopLoss));
      if (result.takeProfit) {
        tpTouched.current = true;
        setTakeProfit(String(result.takeProfit));
      }
      if (result.timeframe) setTimeframe(String(result.timeframe));
      // chart clock → Pakistan time (TradingView shows an earlier clock; the offset lives in Settings)
      const tm = String(result.entryTime ?? '').match(/(\d{4})[-.](\d{2})[-.](\d{2})[ T](\d{1,2}):(\d{2})/);
      if (tm) {
        const shifted = shiftLocal(`${tm[1]}-${tm[2]}-${tm[3]}`, `${tm[4].padStart(2, '0')}:${tm[5]}`, timeOffsets?.tv ?? 7);
        setEntryDate(shifted.date);
        setEntryTime(shifted.time);
      }
      toast({
        type: 'success',
        title: 'Chart analyzed',
        message: 'Review the auto-filled fields below, then add your lot size and notes.',
      });
    } catch (err: any) {
      toast({ type: 'error', title: 'Chart analysis failed', message: err?.message });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!numEntry || !numExit || !numSize) {
      toast({
        type: 'error',
        title: 'Missing Required Pricing',
        message: 'Please provide valid Entry Price, Exit Price, and Position Size.',
      });
      return;
    }

    if (!selectedAccountId) {
      toast({
        type: 'error',
        title: 'No Account Selected',
        message: 'Please select a trading account first.',
      });
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const targetAccount =
      accounts.find((a) => a.id === selectedAccountId) || currentAccount || accounts[0];
    const startingBal = targetAccount ? targetAccount.currentBalance : 100000;
    const roiPercentage = startingBal > 0 ? Math.round((est.netPnL / startingBal) * 10000) / 100 : 0;

    const tradeToSave: Trade = {
      id: initialTrade?.id || `trade-${Date.now()}`,
      userId: currentUser.id,
      accountId: selectedAccountId,
      instrument: instrument.toUpperCase(),
      direction,
      entryDate,
      entryTime,
      exitDate,
      exitTime,
      entryPrice: numEntry,
      exitPrice: numExit,
      stopLoss: numSL,
      takeProfit: numTP,
      positionSize: numSize,
      riskAmount: riskMoney,
      potentialReward,
      grossPnL: est.grossPnL,
      commission: numComm,
      swap: 0,
      netPnL: est.netPnL,
      outcome,
      rMultiple: realizedR,
      plannedRR,
      roiPercentage,
      strategy,
      timeframe,
      session,
      setupType,
      marketConditions,
      entryReason,
      exitReason,
      mistakesMade: mistakesMade || undefined,
      lessonsLearned: lessonsLearned || undefined,
      tags,
      moodBefore,
      confidenceLevel,
      emotionDuring,
      followedPlan,
      revengeTrade,
      fomoTrade,
      screenshots,
      createdAt: initialTrade?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      setSubmitting(true);
      await onTradeSaved(tradeToSave);

      toast({
        type: 'success',
        title: initialTrade ? 'Trade Updated' : 'Trade Logged Successfully',
        message: `${direction} ${instrument} · Net ${est.netPnL >= 0 ? '+' : ''}$${est.netPnL.toLocaleString()} (${realizedR}R)`,
      });

      onClose();
    } catch (err) {
      console.error('Failed to save trade:', err);
      toast({
        type: 'error',
        title: 'Could not save trade',
        message: 'Something went wrong while saving. Check the console for details.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-800/30 backdrop-blur-xs backdrop-blur-sm overflow-y-auto">
      <div className="trade-modal relative w-full max-w-3xl my-auto rounded-[2rem] shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[92vh] animate-modalIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
              {direction === 'BUY' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-[26px] leading-tight font-medium tracking-tight text-black">
                {initialTrade ? '✏️ Edit Trade Record' : '📝 Log New Execution'}
              </h2>
              <p className="hidden">
                Record institutional metrics, strategy, psychology, and attachments.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-8 pb-6 pt-2 space-y-4">
          {/* AI Auto-Fill from Chart */}
          {!initialTrade && (
            <div className="p-5 rounded-[1.75rem] bg-white shadow-sm space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-violet-700">
                <Sparkles className="w-3.5 h-3.5" />
                AI Auto-Fill from Chart
              </div>
              <p className="text-[11px] text-violet-500 leading-relaxed">
                Upload a TradingView screenshot and the AI reads your instrument, direction, entry, stop
                loss, take profit, and timeframe off the chart. You just confirm the fields, add your lot
                size, and rate the trade.
              </p>
              {aiAnalyzing ? (
                <div className="flex items-center gap-2 text-xs text-violet-600 font-medium py-2">
                  <span className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  Analyzing chart…
                </div>
              ) : (
                <ImageUploader
                  generateUploadUrl={async () => await generateUploadUrl()}
                  onUploaded={handleChartUploaded}
                  label="Upload Chart Screenshot"
                  compact
                />
              )}
              {aiDetected && !aiAnalyzing && (
                <p className="text-[11px] text-emerald-600 font-semibold">
                  ✓ Detected (confidence: {aiDetected.confidence || 'unknown'}) — double-check the fields
                  below before saving, AI reads can be wrong.
                </p>
              )}
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="trade-banner grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-black text-white rounded-[1.75rem]">
            <div>
              <span className="text-[11px] text-slate-500 block">Calculated Net P&L</span>
              <span
                className={`text-base font-bold font-mono ${
                  est.netPnL > 0
                    ? 'text-emerald-600'
                    : est.netPnL < 0
                    ? 'text-rose-600'
                    : 'text-slate-600'
                }`}
              >
                {est.netPnL >= 0 ? '+' : ''}${est.netPnL.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Realized Return</span>
              <span className="text-base font-bold font-mono text-slate-800">
                {realizedR >= 0 ? '+' : ''}{realizedR} R
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Risk at Stake</span>
              <span className="text-base font-bold font-mono text-slate-700">
                ${riskMoney.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Planned R:R</span>
              <span className="text-base font-bold font-mono text-slate-700">
                1 : {plannedRR || '—'}
              </span>
            </div>
          </div>

          {/* Section 1: Execution Details */}
          <div className="bg-white rounded-[1.75rem] p-5 sm:p-6 shadow-sm">
            <h3 className="text-xl font-medium text-black mb-4 flex items-center gap-2">
              <span>01.</span> Trade Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Trading Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.broker})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Instrument
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value.toUpperCase())}
                    placeholder="e.g. XAUUSD"
                    list="instruments-list"
                    className="w-full px-3 py-2 text-xs uppercase font-mono font-bold rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                  <datalist id="instruments-list">
                    {COMMON_INSTRUMENTS.map((inst) => (
                      <option key={inst} value={inst} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDirection('BUY')}
                    className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                      direction === 'BUY'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    BUY / Long
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('SELL')}
                    className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                      direction === 'SELL'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    SELL / Short
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Entry Date & Time
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                    required
                  />
                  <div
                    className="w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed"
                    title="Auto-set to Pakistan Standard Time at the moment you log the trade"
                  >
                    <span>{entryTime}</span>
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-captured in Pakistan Time (PKT) &mdash; not editable.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Exit Date & Time
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                    required
                  />
                  <input
                    type="time"
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Position Size (Lots)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={positionSize}
                  onChange={(e) => setPositionSize(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  required
                />
              </div>

              {/* Pricing Grid */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Entry Price
                </label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Stop Loss (SL)
                </label>
                <input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-rose-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Take Profit (TP)
                </label>
                <input
                  type="number"
                  step="any"
                  value={takeProfit}
                  onChange={(e) => {
                    tpTouched.current = true;
                    setTakeProfit(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Exit Price
                </label>
                <input
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Commission ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Strategy & Setup Context */}
          <div className="bg-white rounded-[1.75rem] p-5 sm:p-6 shadow-sm">
            <h3 className="text-xl font-medium text-black mb-4 flex items-center gap-2">
              <span>02.</span> Strategy & Market Setup
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Strategy / Model
                </label>
                <input
                  type="text"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  list="strategies-list"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  required
                />
                <datalist id="strategies-list">
                  {COMMON_STRATEGIES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Timeframe
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                >
                  <option value="1m">1-Minute (M1)</option>
                  <option value="5m">5-Minute (M5)</option>
                  <option value="15m">15-Minute (M15)</option>
                  <option value="1h">1-Hour (H1)</option>
                  <option value="4h">4-Hour (H4)</option>
                  <option value="1D">Daily (D1)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Trading Session
                </label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value as TradingSession)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                >
                  <option value="London">London Session</option>
                  <option value="New York">New York Session</option>
                  <option value="Overlap">London / NY Overlap</option>
                  <option value="Asian">Asian Session</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Entry Rationale
                </label>
                <input
                  type="text"
                  value={entryReason}
                  onChange={(e) => setEntryReason(e.target.value)}
                  placeholder="Key liquidity sweep, order block confirmation, divergence..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Exit Rationale & Outcome Notes
                </label>
                <input
                  type="text"
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  placeholder="Target reached, partial closed at 1.5R, trailing stop hit..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Psychology & Discipline */}
          <div className="bg-white rounded-[1.75rem] p-5 sm:p-6 shadow-sm">
            <h3 className="text-xl font-medium text-black mb-4 flex items-center gap-2">
              <span>03.</span> Trading Psychology & Discipline
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mood Before Trade
                </label>
                <select
                  value={moodBefore}
                  onChange={(e) => setMoodBefore(e.target.value as Mood)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                >
                  <option value="Calm">Calm & Focused</option>
                  <option value="Neutral">Neutral</option>
                  <option value="Anxious">Anxious / Stressed</option>
                  <option value="Excited">Excited</option>
                  <option value="Overconfident">Overconfident</option>
                  <option value="Fatigued">Fatigued / Low Energy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confidence Rating (1 to 5)
                </label>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfidenceLevel(lvl as any)}
                      className={`flex-1 py-1 text-xs font-bold rounded border transition-colors ${
                        confidenceLevel >= lvl
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                    >
                      {lvl}★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Emotional State During Trade
                </label>
                <select
                  value={emotionDuring}
                  onChange={(e) => setEmotionDuring(e.target.value as EmotionDuring)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                >
                  <option value="Disciplined">Disciplined & Patient</option>
                  <option value="Greedy">Greedy (Wanted More)</option>
                  <option value="Fearful">Fearful (Wanted to close early)</option>
                  <option value="Impatient">Impatient</option>
                  <option value="Hesitant">Hesitant / Doubtful</option>
                </select>
              </div>

              <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followedPlan}
                    onChange={(e) => setFollowedPlan(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-semibold block text-slate-800">
                      Followed Trading Plan
                    </span>
                    <span className="text-[10px] text-slate-500">Adhered to written checklist</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fomoTrade}
                    onChange={(e) => setFomoTrade(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-semibold block text-slate-800">
                      FOMO Impulse Entry
                    </span>
                    <span className="text-[10px] text-slate-500">Chased the moving candle</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revengeTrade}
                    onChange={(e) => setRevengeTrade(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-semibold block text-slate-800">
                      Revenge Trade
                    </span>
                    <span className="text-[10px] text-slate-500">Attempted to recover prior loss</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Chart Screenshots */}
          <div className="bg-white rounded-[1.75rem] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-medium text-black flex items-center gap-2">
                <span>04.</span> Chart Screenshots ({screenshots.length})
              </h3>
            </div>

            {screenshots.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {screenshots.map((scr) => (
                  <div
                    key={scr.id}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-black"
                  >
                    {scr.url ? (
                      <img src={scr.url} alt="Trade chart" className="w-full h-full object-cover" />
                    ) : null}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveScreenshot(scr.id)}
                        className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition-colors shadow-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ImageUploader
              label="Upload chart screenshot"
              generateUploadUrl={() => generateUploadUrl()}
              onUploaded={handleScreenshotUploaded}
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80">
          <div className="text-xs text-slate-500">
            Account:{' '}
            <span className="font-semibold text-slate-800">
              {accounts.find((a) => a.id === selectedAccountId)?.name || 'Default Account'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Saving...' : initialTrade ? 'Save Changes' : 'Record Trade'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};