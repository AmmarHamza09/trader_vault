import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Crosshair, Download, Gauge,
  Loader2, Pause, Play, RotateCcw, SkipBack, SkipForward, SlidersHorizontal, Target, TrendingDown,
  TrendingUp, Upload, X,
} from 'lucide-react';
import { BacktestChart, type ChartOverlays, type OpenPosition } from './BacktestChart';
import {
  MARKETS, TIMEFRAMES, atrAt, atrSeries, closeTrade, computeStats, emaSeries, fetchCandles, fmtMoney,
  fmtPrice, fmtSigned, fmtSignedMoney, getMarket, makeSampleCandles, parseCsv,
  priceDigits, rsiSeries, settleTrades,
  type BacktestTrade, type Candle, type Side, type TimeframeId,
} from './engine';

const PREFS_KEY = 'trader-vault-backtest-v1';

type Prefs = {
  marketId?: string;
  timeframe?: TimeframeId;
  balance?: number;
  riskPct?: number;
  stopMult?: number;
  rewardR?: number;
  speed?: number;
  overlays?: ChartOverlays;
};

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') as Prefs;
  } catch {
    return {};
  }
}

const DEFAULT_OVERLAYS: ChartOverlays = { ema9: true, ema21: true, ema50: false, bollinger: false, volume: true, rsi: false };

const fmtQty = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (value >= 1) return value.toFixed(3);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
};

const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

const StatCard: React.FC<{ label: string; value: string; hint: string; tone?: 'up' | 'down' | 'neutral'; icon: React.ElementType }> = ({ label, value, hint, tone = 'neutral', icon: Icon }) => (
  <div className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <Icon size={14} className="text-slate-300" />
    </div>
    <div className={`mt-2 text-[19px] font-semibold tracking-tight tabular-nums ${tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-rose-600' : 'text-zinc-900'}`}>
      {value}
    </div>
    <div className="mt-1 truncate text-[10px] text-slate-400">{hint}</div>
  </div>
);

const EquityCurve: React.FC<{ points: { x: number; value: number }[]; start: number }> = ({ points, start }) => {
  const width = 340;
  const height = 104;
  const pad = 6;
  const values = points.map((point) => point.value);
  const min = Math.min(...values, start);
  const max = Math.max(...values, start);
  const span = max - min || Math.max(1, Math.abs(start) * 0.01);
  const toX = (index: number) => pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
  const toY = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  const coords = points.map((point, index) => ({ x: toX(index), y: toY(point.value) }));
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${height - pad} L${coords[0].x.toFixed(1)},${height - pad} Z`;
  const last = points[points.length - 1]?.value ?? start;
  const up = last >= start;
  const stroke = up ? '#059669' : '#e11d48';
  const gradientId = up ? 'bt-equity-up' : 'bt-equity-down';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={width - pad} y1={toY(start)} y2={toY(start)} stroke="rgba(148,163,184,.35)" strokeDasharray="3 4" strokeWidth="1" />
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3" fill={stroke} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */

export const BacktestView: React.FC = () => {
  const prefs = useMemo(loadPrefs, []);
  const initialMarket = getMarket(prefs.marketId ?? 'BTCUSDT');
  const initialTimeframe = prefs.timeframe ?? '15m';

  const [marketId, setMarketId] = useState(initialMarket.id);
  const [timeframe, setTimeframe] = useState<TimeframeId>(initialTimeframe);
  const [candles, setCandles] = useState<Candle[]>(() => makeSampleCandles(initialMarket, initialTimeframe));
  const [cursor, setCursor] = useState(() => Math.floor(900 * 0.35));
  const cursorRef = useRef(cursor);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(prefs.speed ?? 2);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('Practice candles');
  const [notice, setNotice] = useState('');

  const [balance, setBalance] = useState(prefs.balance ?? 10_000);
  const [riskPct, setRiskPct] = useState(prefs.riskPct ?? 1);
  const [stopMult, setStopMult] = useState(prefs.stopMult ?? 1.5);
  const [rewardR, setRewardR] = useState(prefs.rewardR ?? 2);
  const [overlays, setOverlays] = useState<ChartOverlays>({ ...DEFAULT_OVERLAYS, ...(prefs.overlays ?? {}) });
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const market = getMarket(marketId);
  const digits = useMemo(() => priceDigits(candles, market.digits), [candles, market.digits]);
  const candle = candles[Math.min(cursor, candles.length - 1)];
  const progress = candles.length > 1 ? (cursor / (candles.length - 1)) * 100 : 0;

  const stats = useMemo(() => computeStats(trades, balance), [trades, balance]);
  const active = trades.find((trade) => trade.exit === undefined) ?? null;
  const equity = balance + stats.netPnl;
  const openPnl = active && candle ? (candle.close - active.entry) * (active.side === 'long' ? 1 : -1) * active.qty : 0;

  const position: OpenPosition | null = useMemo(
    () => (active ? { side: active.side, entry: active.entry, stop: active.stop, target: active.target } : null),
    [active],
  );

  /* ---------- persisted preferences ---------- */
  useEffect(() => {
    const next: Prefs = { marketId, timeframe, balance, riskPct, stopMult, rewardR, speed, overlays };
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage can be unavailable in private mode — preferences are optional */
    }
  }, [marketId, timeframe, balance, riskPct, stopMult, rewardR, speed, overlays]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  /* ---------- load data whenever market / timeframe changes ---------- */
  const applyDataset = useCallback((data: Candle[], label: string) => {
    setCandles(data);
    const start = Math.max(1, Math.min(data.length - 2, Math.floor(data.length * 0.35)));
    cursorRef.current = start;
    setCursor(start);
    setTrades([]);
    setPlaying(false);
    setFeedback('');
    setSource(label);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const selected = getMarket(marketId);
    setLoading(true);
    setNotice('');

    const run = async () => {
      try {
        if (selected.kind === 'crypto') {
          const data = await fetchCandles(selected, timeframe, 1000);
          if (cancelled) return;
          applyDataset(data, `${selected.label} · ${timeframe} · Binance history`);
        } else {
          const data = makeSampleCandles(selected, timeframe, 1000);
          if (cancelled) return;
          applyDataset(data, `${selected.label} · ${timeframe} · practice candles`);
        }
      } catch {
        if (cancelled) return;
        applyDataset(makeSampleCandles(selected, timeframe, 1000), `${selected.label} · ${timeframe} · offline practice candles`);
        setNotice('Live history could not be loaded — practice candles were generated instead so you can keep testing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [marketId, timeframe, applyDataset]);

  /* ---------- replay engine ---------- */
  const advanceTo = useCallback((target: number, settle = true) => {
    const from = cursorRef.current;
    const next = Math.max(0, Math.min(candles.length - 1, Math.round(target)));
    if (next === from) return;
    cursorRef.current = next;
    setCursor(next);
    if (settle && next > from) {
      setTrades((current) => settleTrades(current, candles, from + 1, next));
      setFeedback('');
    }
  }, [candles]);

  useEffect(() => {
    if (!playing) return;
    if (cursorRef.current >= candles.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setInterval(() => {
      if (cursorRef.current >= candles.length - 1) {
        setPlaying(false);
        return;
      }
      advanceTo(cursorRef.current + 1);
    }, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, candles.length, advanceTo]);

  const togglePlay = useCallback(() => {
    if (cursorRef.current >= candles.length - 1) advanceTo(0, false);
    setPlaying((value) => !value);
  }, [advanceTo, candles.length]);

  /* ---------- order ticket ---------- */
  const atr = atrAt(candles, cursor, 14);
  const stopDistance = atr ? atr * stopMult : 0;
  const riskAmount = (equity * riskPct) / 100;
  const qty = stopDistance > 0 && riskAmount > 0 ? riskAmount / stopDistance : 0;

  const openPosition = useCallback((side: Side) => {
    if (active || !candle) return;
    const currentAtr = atrAt(candles, cursorRef.current, 14);
    if (!currentAtr) {
      setFeedback('Need a few more candles before the ATR stop can be calculated — step forward.');
      return;
    }
    const price = candle.close;
    const distance = currentAtr * stopMult;
    const risk = (equity * riskPct) / 100;
    if (!(distance > 0) || !(risk > 0)) {
      setFeedback('Set a positive balance, risk % and stop distance first.');
      return;
    }
    const size = risk / distance;
    setTrades((current) => [
      ...current,
      {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        side,
        entry: price,
        stop: side === 'long' ? price - distance : price + distance,
        target: side === 'long' ? price + distance * rewardR : price - distance * rewardR,
        qty: size,
        risk,
        entryTime: Number(candle.time),
      },
    ]);
    setFeedback('');
    setPlaying(false);
  }, [active, candle, candles, cursor, stopMult, equity, riskPct, rewardR]);

  const closeActive = useCallback(() => {
    if (!active || !candle) return;
    setTrades((current) => current.map((trade) => (trade.id !== active.id ? trade : closeTrade(trade, candle.close, Number(candle.time), 'manual'))));
  }, [active, candle]);

  const moveToBreakEven = useCallback(() => {
    if (!active) return;
    setTrades((current) => current.map((trade) => (trade.id === active.id ? { ...trade, stop: trade.entry } : trade)));
  }, [active]);

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPlaying(false);
        advanceTo(cursorRef.current + (event.shiftKey ? 10 : 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPlaying(false);
        advanceTo(cursorRef.current - (event.shiftKey ? 10 : 1));
      } else if (key === 'l') {
        openPosition('long');
      } else if (key === 's') {
        openPosition('short');
      } else if (key === 'c') {
        closeActive();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advanceTo, openPosition, closeActive, togglePlay]);

  /* ---------- indicators dropdown ---------- */
  useEffect(() => {
    if (!indicatorsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIndicatorsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [indicatorsOpen]);

  /* ---------- chart legend values ---------- */
  const legend = useMemo(() => {
    const visible = candles.slice(0, cursor + 1);
    const lastOf = (series: (number | null)[]) => {
      for (let i = series.length - 1; i >= 0; i -= 1) if (series[i] !== null) return series[i] as number;
      return null;
    };
    return {
      ema9: lastOf(emaSeries(visible, 9)),
      ema21: lastOf(emaSeries(visible, 21)),
      ema50: lastOf(emaSeries(visible, 50)),
      rsi: lastOf(rsiSeries(visible, 14)),
      atr: lastOf(atrSeries(visible, 14)),
    };
  }, [candles, cursor]);

  /* ---------- CSV import / reset ---------- */
  const importCsv = async (file?: File) => {
    if (!file) return;
    setNotice('');
    setFeedback('');
    setLoading(true);
    try {
      const data = parseCsv(await file.text());
      applyDataset(data, `${file.name} · ${data.length.toLocaleString()} candles`);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setNotice(error instanceof Error ? error.message : 'Could not read that CSV file.');
    }
  };

  const resetSession = () => {
    setTrades([]);
    setPlaying(false);
    setFeedback('');
    const start = Math.max(1, Math.min(candles.length - 2, Math.floor(candles.length * 0.35)));
    cursorRef.current = start;
    setCursor(start);
    setNotice('');
  };

  const jumpTo = (fraction: number) => {
    setPlaying(false);
    advanceTo(Math.round((candles.length - 1) * fraction));
  };

  const directionTone = !candle ? 'neutral' : candle.close >= candle.open ? 'up' : 'down';

  return (
    <div className="bt-page space-y-4">
      {/* ============ header ============ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-inner-card">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> REPLAY LAB <span className="text-slate-300">/</span> HISTORICAL PRACTICE
          </div>
          <h2 className="text-[28px] leading-tight font-medium tracking-tight text-black sm:text-[34px]">Backtesting</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Step through candles like a chart replay, size every trade by risk instead of gut feel, and watch your edge in R multiples.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Upload size={14} /> Import OHLC CSV
          </button>
          <button
            type="button"
            onClick={resetSession}
            className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            <RotateCcw size={14} /> Reset session
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              void importCsv(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {/* ============ stats ============ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Net P&L" value={fmtSignedMoney(stats.netPnl)} hint={`${stats.count} closed · ${stats.wins}W / ${stats.losses}L`} tone={stats.netPnl > 0 ? 'up' : stats.netPnl < 0 ? 'down' : 'neutral'} icon={Activity} />
        <StatCard label="Win rate" value={`${stats.winRate.toFixed(0)}%`} hint={stats.count ? `${stats.breakEven} break-even` : 'No closed trades yet'} icon={TrendingUp} />
        <StatCard label="Profit factor" value={stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)} hint={`${fmtMoney(stats.grossProfit, 0)} won / ${fmtMoney(stats.grossLoss, 0)} lost`} icon={Gauge} />
        <StatCard label="Avg R" value={`${fmtSigned(stats.avgR, 2)}R`} hint={`Expectancy ${fmtSignedMoney(stats.expectancy, 0)}/trade`} tone={stats.avgR > 0 ? 'up' : stats.avgR < 0 ? 'down' : 'neutral'} icon={Crosshair} />
        <StatCard label="Max drawdown" value={fmtMoney(stats.maxDrawdown, 0)} hint={`${stats.maxDrawdownPct.toFixed(1)}% from equity peak`} tone={stats.maxDrawdown > 0 ? 'down' : 'neutral'} icon={TrendingDown} />
        <StatCard label="Closed trades" value={String(stats.count).padStart(2, '0')} hint={active ? `${active.side === 'long' ? 'Long' : 'Short'} position open` : 'Practice executions'} icon={Target} />
      </div>

      {/* ============ chart + order ticket ============ */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_338px]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-[24px] bg-[#0c111a] shadow-[0_12px_36px_rgba(15,23,42,.12)]">
            {/* toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Instrument"
                  value={marketId}
                  onChange={(event) => setMarketId(event.target.value)}
                  className="bt-dark-field !w-auto !py-1.5 !pl-2 !pr-7 !text-xs !font-semibold !text-white"
                >
                  <optgroup label="Crypto · live history">
                    {MARKETS.filter((item) => item.kind === 'crypto').map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Practice data">
                    {MARKETS.filter((item) => item.kind === 'practice').map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </optgroup>
                </select>

                <div className="bt-seg">
                  {TIMEFRAMES.map((frame) => (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => setTimeframe(frame.id)}
                      className={`bt-seg-btn ${timeframe === frame.id ? 'is-active' : ''}`}
                    >
                      {frame.label}
                    </button>
                  ))}
                </div>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setIndicatorsOpen((value) => !value)}
                    aria-expanded={indicatorsOpen}
                    className={`bt-tool ${indicatorsOpen ? 'is-active' : ''}`}
                  >
                    <SlidersHorizontal size={13} /> Indicators
                  </button>
                  {indicatorsOpen && (
                    <div className="absolute left-0 top-11 z-30 w-60 rounded-2xl border border-white/10 bg-[#131a26] p-2 shadow-2xl">
                      {([
                        ['ema9', 'EMA 9', '#38bdf8'],
                        ['ema21', 'EMA 21', '#f59e0b'],
                        ['ema50', 'EMA 50', '#a78bfa'],
                        ['bollinger', 'Bollinger Bands (20, 2)', '#94a3b8'],
                        ['volume', 'Volume', '#64748b'],
                        ['rsi', 'RSI pane (14)', '#c084fc'],
                      ] as [keyof ChartOverlays, string, string][]).map(([key, label, color]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOverlays((current) => ({ ...current, [key]: !current[key] }))}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[11px] text-slate-300 hover:bg-white/[0.06]"
                        >
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                            {label}
                          </span>
                          <span className={`flex h-4 w-4 items-center justify-center rounded ${overlays[key] ? 'bg-emerald-400 text-[#0c111a]' : 'border border-white/15 text-transparent'}`}>
                            <Check size={11} strokeWidth={3} />
                          </span>
                        </button>
                      ))}
                      <div className="mt-1 border-t border-white/10 px-2.5 pb-1 pt-2 text-[10px] text-slate-500">Overlays redraw instantly on replay.</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400"><Loader2 size={12} className="animate-spin" /> loading history…</span>
                ) : (
                  <span className="hidden truncate text-[10px] text-slate-500 sm:inline">{source}</span>
                )}
                <button
                  type="button"
                  onClick={() => jumpTo(1)}
                  title="Jump to the latest candle"
                  className="bt-tool"
                >
                  <Download size={13} className="rotate-180" /> Latest
                </button>
              </div>
            </div>

            {/* chart */}
            <div className="relative h-[380px] sm:h-[480px]">
              <BacktestChart candles={candles} cursor={cursor} digits={digits} overlays={overlays} trades={trades} position={position} />

              <div className="pointer-events-none absolute left-3 top-3 z-10 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold sm:text-[11px]">
                  <span className="text-white">{market.label}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-slate-300">{timeframe.toUpperCase()}</span>
                  {candle && (
                    <span className="bt-mono flex flex-wrap gap-x-2 text-[10px] font-normal text-slate-400">
                      <span>O <span className={directionTone === 'up' ? 'text-emerald-400' : 'text-rose-400'}>{fmtPrice(candle.open, digits)}</span></span>
                      <span>H <span className={directionTone === 'up' ? 'text-emerald-400' : 'text-rose-400'}>{fmtPrice(candle.high, digits)}</span></span>
                      <span>L <span className={directionTone === 'up' ? 'text-emerald-400' : 'text-rose-400'}>{fmtPrice(candle.low, digits)}</span></span>
                      <span>C <span className={directionTone === 'up' ? 'text-emerald-400' : 'text-rose-400'}>{fmtPrice(candle.close, digits)}</span></span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  {overlays.ema9 && <span><span className="text-sky-400">EMA 9</span> {fmtPrice(legend.ema9 ?? undefined, digits)}</span>}
                  {overlays.ema21 && <span><span className="text-amber-400">EMA 21</span> {fmtPrice(legend.ema21 ?? undefined, digits)}</span>}
                  {overlays.ema50 && <span><span className="text-violet-400">EMA 50</span> {fmtPrice(legend.ema50 ?? undefined, digits)}</span>}
                  {overlays.rsi && <span><span className="text-fuchsia-400">RSI</span> {legend.rsi === null ? '—' : legend.rsi.toFixed(1)}</span>}
                  <span><span className="text-slate-400">ATR 14</span> {legend.atr === null ? '—' : fmtPrice(legend.atr, digits)}</span>
                </div>
              </div>

              {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c111a]/70 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-slate-200">
                    <Loader2 size={14} className="animate-spin" /> Fetching candles…
                  </div>
                </div>
              )}

              {active && candle && (
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-[#101722]/90 px-2.5 py-1.5 text-[10px] backdrop-blur">
                  <span className={active.side === 'long' ? 'text-emerald-400' : 'text-rose-400'}>{active.side === 'long' ? 'LONG' : 'SHORT'} · {fmtPrice(active.entry, digits)}</span>
                  <span className="text-slate-600">•</span>
                  <span className={openPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>uPnL {fmtSignedMoney(openPnl)}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{active.risk > 0 ? `${fmtSigned(openPnl / active.risk, 2)}R` : '—'}</span>
                </div>
              )}
            </div>

            {/* replay bar */}
            <div className="border-t border-white/[0.07] px-3 pb-3 pt-3 sm:px-4">
              <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                <span className="bt-mono">
                  {candle ? new Date(Number(candle.time) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </span>
                <span>{cursor + 1} / {candles.length} candles · {progress.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, candles.length - 1)}
                value={cursor}
                onChange={(event) => {
                  setPlaying(false);
                  advanceTo(Number(event.target.value));
                }}
                aria-label="Replay position"
                className="bt-range w-full"
                style={{ '--progress': `${progress}%` } as React.CSSProperties}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => jumpTo(0)} title="Start of data" className="bt-control"><SkipBack size={15} /></button>
                  <button type="button" onClick={() => advanceTo(cursorRef.current - 1)} title="Previous candle (←)" className="bt-control"><ChevronLeft size={17} /></button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    title="Play / pause (Space)"
                    className="flex h-9 w-11 items-center justify-center rounded-xl bg-white text-zinc-900 hover:bg-emerald-300"
                  >
                    {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  </button>
                  <button type="button" onClick={() => advanceTo(cursorRef.current + 1)} title="Next candle (→)" className="bt-control"><ChevronRight size={17} /></button>
                  <button type="button" onClick={() => advanceTo(cursorRef.current + 10)} title="Skip 10 candles (Shift+→)" className="bt-control"><SkipForward size={15} /></button>
                  <span className="ml-2 hidden items-center gap-1 text-[10px] text-slate-500 lg:flex">
                    <kbd>←</kbd><kbd>→</kbd> step <kbd>Space</kbd> play <kbd>L</kbd>/<kbd>S</kbd> trade <kbd>C</kbd> close
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Speed</span>
                  <select
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                    aria-label="Playback speed"
                    className="bt-dark-field !w-auto !py-1.5 !text-[11px]"
                  >
                    {[0.5, 1, 2, 4, 8, 16].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* equity + trade log */}
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Equity curve</h3>
                  <p className="mt-0.5 text-[10px] text-slate-400">Closed trades only</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold tabular-nums ${stats.netPnl >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {pct(balance > 0 ? (stats.netPnl / balance) * 100 : 0)}
                </span>
              </div>
              <div className="mt-3">
                <EquityCurve points={stats.equity} start={balance} />
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-slate-400">Equity</div>
                  <div className="text-lg font-semibold tabular-nums text-zinc-900">{fmtMoney(equity)}</div>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <div>Best {fmtMoney(stats.best)}</div>
                  <div>Worst {fmtMoney(stats.worst)}</div>
                </div>
              </div>
            </section>

            <section className="min-w-0 rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Execution log</h3>
                  <p className="mt-0.5 text-[10px] text-slate-400">Every simulated fill in this replay session.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">{stats.count} closed</span>
              </div>

              {trades.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
                  <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Crosshair size={16} /></div>
                  <p className="text-xs font-medium text-slate-600">No executions yet</p>
                  <p className="mt-1 text-[10px] text-slate-400">Press <kbd>L</kbd> for a long or <kbd>S</kbd> for a short at the current candle.</p>
                </div>
              ) : (
                <div className="-mx-1 max-h-64 overflow-auto px-1">
                  <table className="w-full min-w-[540px] border-separate border-spacing-y-1 text-left text-[11px]">
                    <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="rounded-l-xl px-2 py-1.5 font-medium">#</th>
                        <th className="px-2 py-1.5 font-medium">Side</th>
                        <th className="px-2 py-1.5 font-medium">Entry</th>
                        <th className="px-2 py-1.5 font-medium">Exit</th>
                        <th className="px-2 py-1.5 font-medium">Size</th>
                        <th className="px-2 py-1.5 font-medium">R</th>
                        <th className="px-2 py-1.5 font-medium">P&L</th>
                        <th className="rounded-r-xl px-2 py-1.5 font-medium">Exit type</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {[...trades].sort((a, b) => a.entryTime - b.entryTime).map((trade, index) => {
                        const open = trade.exit === undefined;
                        return (
                          <tr key={trade.id} className="bg-slate-50/80 text-slate-600">
                            <td className="rounded-l-xl px-2 py-2 text-slate-400">{index + 1}</td>
                            <td className="px-2 py-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${trade.side === 'long' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {trade.side === 'long' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                {trade.side === 'long' ? 'Long' : 'Short'}
                              </span>
                            </td>
                            <td className="px-2 py-2">{fmtPrice(trade.entry, digits)}</td>
                            <td className="px-2 py-2">{open ? <span className="text-amber-600">open</span> : fmtPrice(trade.exit, digits)}</td>
                            <td className="px-2 py-2 text-slate-500">{fmtQty(trade.qty)}</td>
                            <td className={`px-2 py-2 font-semibold ${open ? 'text-slate-400' : (trade.rMultiple ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {open ? '—' : `${fmtSigned(trade.rMultiple, 2)}R`}
                            </td>
                            <td className={`px-2 py-2 font-semibold ${open ? 'text-slate-400' : (trade.pnl ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {open ? '—' : fmtSignedMoney(trade.pnl)}
                            </td>
                            <td className="rounded-r-xl px-2 py-2 text-[10px] uppercase tracking-wide text-slate-400">
                              {open ? 'in progress' : trade.exitReason === 'target' ? 'target' : trade.exitReason === 'stop' ? 'stop' : 'manual'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ============ order ticket ============ */}
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Risk ticket</h3>
                <p className="mt-0.5 text-[10px] text-slate-400">Position sizing from your stop, not lot guesswork.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">{market.label}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Balance ($)</span>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={balance}
                  onChange={(event) => setBalance(Math.max(100, Number(event.target.value) || 0))}
                  className="w-full !py-2 !text-xs"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Risk / trade (%)</span>
                <input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={riskPct}
                  onChange={(event) => setRiskPct(Math.min(10, Math.max(0.1, Number(event.target.value) || 0.1)))}
                  className="w-full !py-2 !text-xs"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Stop (× ATR)</span>
                <input
                  type="number"
                  min={0.3}
                  max={6}
                  step={0.1}
                  value={stopMult}
                  onChange={(event) => setStopMult(Math.min(6, Math.max(0.3, Number(event.target.value) || 0.3)))}
                  className="w-full !py-2 !text-xs"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Reward (R)</span>
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={rewardR}
                  onChange={(event) => setRewardR(Math.min(10, Math.max(0.5, Number(event.target.value) || 0.5)))}
                  className="w-full !py-2 !text-xs"
                />
              </label>
            </div>

            <div className="mt-3 rounded-2xl bg-[#0c111a] p-3 text-[10px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>Entry · current close</span>
                <span className="bt-mono text-sm font-semibold text-white">{candle ? fmtPrice(candle.close, digits) : '—'}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/[0.04] px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-400"><ArrowUp size={9} /> Long</div>
                  <div className="mt-1 flex items-center justify-between"><span>Stop</span><span className="bt-mono text-rose-300">{candle && stopDistance ? fmtPrice(candle.close - stopDistance, digits) : '—'}</span></div>
                  <div className="flex items-center justify-between"><span>Target</span><span className="bt-mono text-emerald-300">{candle && stopDistance ? fmtPrice(candle.close + stopDistance * rewardR, digits) : '—'}</span></div>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-rose-400"><ArrowDown size={9} /> Short</div>
                  <div className="mt-1 flex items-center justify-between"><span>Stop</span><span className="bt-mono text-rose-300">{candle && stopDistance ? fmtPrice(candle.close + stopDistance, digits) : '—'}</span></div>
                  <div className="flex items-center justify-between"><span>Target</span><span className="bt-mono text-emerald-300">{candle && stopDistance ? fmtPrice(candle.close - stopDistance * rewardR, digits) : '—'}</span></div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                <span>Size · risk · R:R</span>
                <span className="bt-mono text-slate-200">{fmtQty(qty)} · <span className="text-amber-300">{fmtMoney(riskAmount, 0)}</span> · 1:{rewardR.toFixed(1)}</span>
              </div>
              <div className="mt-1 text-[9px] text-slate-500">
                {candle && stopDistance ? `Stop ${((stopDistance / candle.close) * 100).toFixed(2)}% away · ATR ${fmtPrice(atr ?? undefined, digits)}` : 'Waiting for enough candles to compute ATR.'}
              </div>
            </div>

            {feedback && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-700">{feedback}</p>}

            {active ? (
              <div className="mt-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">{active.side === 'long' ? 'Long' : 'Short'} open</span>
                    <span className={`text-xs font-semibold tabular-nums ${openPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtSignedMoney(openPnl)}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/60">
                    <div
                      className={`h-full rounded-full ${openPnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, ((candle?.close ?? active.entry) - active.entry) / (active.target - active.entry) * 100))}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-amber-900/80">
                    <div>Stop <span className="bt-mono font-semibold text-rose-700">{fmtPrice(active.stop, digits)}</span></div>
                    <div className="text-right">Target <span className="bt-mono font-semibold text-emerald-700">{fmtPrice(active.target, digits)}</span></div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={moveToBreakEven} className="rounded-full border border-slate-200 bg-white py-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Break-even</button>
                  <button type="button" onClick={closeActive} className="flex items-center justify-center gap-1.5 rounded-full bg-black py-2.5 text-[11px] font-semibold text-white hover:bg-zinc-800">
                    <Check size={13} /> Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openPosition('long')} disabled={!candle || loading} className="bt-long">
                  <ArrowUp size={14} /> Long
                </button>
                <button type="button" onClick={() => openPosition('short')} disabled={!candle || loading} className="bt-short">
                  <ArrowDown size={14} /> Short
                </button>
              </div>
            )}

            <p className="mt-2 text-center text-[9px] text-slate-400">
              Fills at the current candle close · stop or target settles automatically on the next candles.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
            <h3 className="text-sm font-semibold text-zinc-900">Session</h3>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><dt className="text-slate-500">Source</dt><dd className="max-w-[190px] truncate text-right text-slate-700">{source}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Starting balance</dt><dd className="tabular-nums text-slate-700">{fmtMoney(balance, 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Open P&L</dt><dd className={`tabular-nums ${openPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{active ? fmtSignedMoney(openPnl) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Win / loss / BE</dt><dd className="tabular-nums text-slate-700">{stats.wins} / {stats.losses} / {stats.breakEven}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Avg win / loss</dt><dd className="tabular-nums text-slate-700">{fmtMoney(stats.avgWin, 0)} / {fmtMoney(stats.avgLoss, 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Expectancy</dt><dd className="tabular-nums text-slate-700">{fmtSignedMoney(stats.expectancy, 0)} · {fmtSigned(stats.expectancyR, 2)}R</dd></div>
            </dl>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 shadow-inner-soft"><RotateCcw size={11} /></span>
              Reset the session to clear trades and replay from 35%.
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1.5"><Upload size={12} /> CSV: time/date, open, high, low, close (+ optional volume)</span>
        <span>Educational replay only — not financial advice.</span>
      </div>
    </div>
  );
};
