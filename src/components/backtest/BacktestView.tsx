import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AreaChart, ArrowDown, ArrowUp, BarChart3, Camera, CandlestickChart, Check, ChevronDown,
  ChevronLeft, ChevronRight, Crosshair, Download, Eraser, FunctionSquare, Gauge, Layers, LineChart, Loader2, Magnet,
  Maximize2, Minimize2, Minus, MousePointer2, Pause, Pencil, Play, Redo2, RotateCcw, Ruler, Search, Settings2,
  SkipBack, SkipForward, Square, Star, Target, Trash2, TrendingDown, TrendingUp, Undo2, Upload, X,
} from 'lucide-react';
import {
  BacktestChart,
  type ChartOverlays,
  type ChartSettings,
  type ChartType,
  type Drawing,
  type DrawingTool,
  type IndicatorPeriods,
  type OpenPosition,
} from './BacktestChart';
import {
  MARKETS, TIMEFRAMES, advanceSession, atrAt, atrSeries, closeTrade, computeStats, emaSeries, fetchCandles,
  fetchTickers, fmtCompact, fmtMoney, fmtPrice, fmtSigned, fmtSignedMoney, getMarket, macdSeries, makeSampleCandles,
  parseCsv, partialClose, priceDigits, rsiSeries, stochRsiSeries, vwapSeries,
  type BacktestTrade, type Candle, type PendingOrder, type Side, type Ticker, type TimeframeId,
} from './engine';

const PREFS_KEY = 'trader-vault-backtest-v2';

type DockTab = 'executions' | 'statistics' | 'distribution';
type OrderKind = 'market' | 'limit';

type Prefs = {
  marketId?: string;
  timeframe?: TimeframeId;
  balance?: number;
  riskPct?: number;
  stopMult?: number;
  rewardR?: number;
  speed?: number;
  overlays?: ChartOverlays;
  periods?: IndicatorPeriods;
  settings?: ChartSettings;
  chartType?: ChartType;
  magnet?: boolean;
  dock?: DockTab;
  watchlist?: string[];
};

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') as Prefs;
  } catch {
    return {};
  }
}

const DEFAULT_OVERLAYS: ChartOverlays = {
  ema1: true,
  ema2: true,
  ema3: false,
  ema4: false,
  vwap: false,
  bollinger: false,
  volume: true,
  rsi: false,
  macd: false,
  stoch: false,
};

const DEFAULT_PERIODS: IndicatorPeriods = {
  ema1: 9,
  ema2: 21,
  ema3: 50,
  ema4: 200,
  bbLength: 20,
  bbMult: 2,
  rsiLength: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  stochLength: 14,
  stochK: 3,
  stochD: 3,
  atrLength: 14,
};

const DEFAULT_SETTINGS: ChartSettings = { grid: true, logScale: false, lastPriceLine: true };

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XAUUSD', 'EURUSD'];

const OVERLAY_META: { key: keyof ChartOverlays; label: string; color: string; hint: string }[] = [
  { key: 'ema1', label: 'EMA · fast', color: '#2962ff', hint: 'EMA 1' },
  { key: 'ema2', label: 'EMA · slow', color: '#ff9800', hint: 'EMA 2' },
  { key: 'ema3', label: 'EMA · trend', color: '#e91e63', hint: 'EMA 3' },
  { key: 'ema4', label: 'EMA · long', color: '#9c27b0', hint: 'EMA 4' },
  { key: 'vwap', label: 'VWAP (session)', color: '#00bcd4', hint: 'VWAP' },
  { key: 'bollinger', label: 'Bollinger Bands', color: '#787b86', hint: 'BB' },
  { key: 'volume', label: 'Volume', color: '#787b86', hint: 'Volume' },
  { key: 'rsi', label: 'RSI pane', color: '#7e57c2', hint: 'RSI' },
  { key: 'macd', label: 'MACD pane', color: '#2962ff', hint: 'MACD' },
  { key: 'stoch', label: 'Stochastic RSI pane', color: '#ff6d00', hint: 'Stoch RSI' },
];

const PERIOD_FIELDS: { group: string; fields: { key: keyof IndicatorPeriods; label: string; min: number; max: number; step: number }[] }[] = [
  {
    group: 'Moving averages',
    fields: [
      { key: 'ema1', label: 'EMA 1', min: 2, max: 400, step: 1 },
      { key: 'ema2', label: 'EMA 2', min: 2, max: 400, step: 1 },
      { key: 'ema3', label: 'EMA 3', min: 2, max: 400, step: 1 },
      { key: 'ema4', label: 'EMA 4', min: 2, max: 400, step: 1 },
    ],
  },
  {
    group: 'Bollinger Bands',
    fields: [
      { key: 'bbLength', label: 'Length', min: 5, max: 200, step: 1 },
      { key: 'bbMult', label: 'Std dev', min: 0.5, max: 5, step: 0.1 },
    ],
  },
  { group: 'RSI', fields: [{ key: 'rsiLength', label: 'Length', min: 2, max: 100, step: 1 }] },
  {
    group: 'MACD',
    fields: [
      { key: 'macdFast', label: 'Fast', min: 2, max: 100, step: 1 },
      { key: 'macdSlow', label: 'Slow', min: 3, max: 200, step: 1 },
      { key: 'macdSignal', label: 'Signal', min: 2, max: 100, step: 1 },
    ],
  },
  {
    group: 'Stochastic RSI',
    fields: [
      { key: 'stochLength', label: 'Length', min: 3, max: 100, step: 1 },
      { key: 'stochK', label: '%K', min: 1, max: 20, step: 1 },
      { key: 'stochD', label: '%D', min: 1, max: 20, step: 1 },
    ],
  },
  { group: 'Risk', fields: [{ key: 'atrLength', label: 'ATR length', min: 2, max: 100, step: 1 }] },
];

const CHART_TYPES: { id: ChartType; label: string; icon: React.ElementType }[] = [
  { id: 'candles', label: 'Candles', icon: CandlestickChart },
  { id: 'hollow', label: 'Hollow candles', icon: CandlestickChart },
  { id: 'heikin', label: 'Heikin Ashi', icon: CandlestickChart },
  { id: 'bars', label: 'Bars', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: LineChart },
  { id: 'area', label: 'Area', icon: AreaChart },
];

const DRAW_TOOLS: { id: DrawingTool; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'cursor', label: 'Cursor', icon: MousePointer2, hint: 'Cursor — drag/zoom the chart' },
  { id: 'crosshair', label: 'Crosshair', icon: Crosshair, hint: 'Crosshair' },
  { id: 'trend', label: 'Trend line', icon: Pencil, hint: 'Trend line — drag from A to B' },
  { id: 'hline', label: 'Horizontal line', icon: Minus, hint: 'Horizontal price line' },
  { id: 'ray', label: 'Ray', icon: TrendingUp, hint: 'Ray — extends to the right' },
  { id: 'rect', label: 'Rectangle', icon: Square, hint: 'Rectangle / zone' },
  { id: 'fib', label: 'Fib retracement', icon: Ruler, hint: 'Fibonacci retracement' },
  { id: 'measure', label: 'Measure', icon: Layers, hint: 'Measure price & time' },
  { id: 'eraser', label: 'Eraser', icon: Eraser, hint: 'Eraser — click a drawing to remove it' },
];

const fmtQty = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (value >= 1) return value.toFixed(3);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
};

const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const shortName = (label: string) => label.split(' / ')[0];
const quoteName = (label: string) => label.split(' / ')[1] ?? 'USD';

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
  const width = 420;
  const height = 108;
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
  const stroke = up ? '#26a69a' : '#ef5350';
  const gradientId = up ? 'bt-equity-up' : 'bt-equity-down';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[104px] w-full" role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={width - pad} y1={toY(start)} y2={toY(start)} stroke="rgba(120,123,134,.4)" strokeDasharray="3 4" strokeWidth="1" />
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2.6" fill={stroke} />
    </svg>
  );
};

const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; width?: string; children: React.ReactNode }> = ({ title, subtitle, onClose, width = 'max-w-2xl', children }) => (
  <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-zinc-950/45 p-4 backdrop-blur-[3px] sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`bt-modal w-full ${width} overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_30px_90px_rgba(15,23,42,.35)]`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
      </div>
      <div className="max-h-[72vh] overflow-y-auto px-5 py-4">{children}</div>
    </div>
  </div>
);

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
  const [cursor, setCursor] = useState(() => Math.floor(1000 * 0.35));
  const cursorRef = useRef(cursor);
  const [session, setSession] = useState<{ trades: BacktestTrade[]; orders: PendingOrder[] }>({ trades: [], orders: [] });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(prefs.speed ?? 2);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('Practice candles');
  const [notice, setNotice] = useState('');
  const [feedback, setFeedback] = useState('');

  const [balance, setBalance] = useState(prefs.balance ?? 10_000);
  const [riskPct, setRiskPct] = useState(prefs.riskPct ?? 1);
  const [stopMult, setStopMult] = useState(prefs.stopMult ?? 1.5);
  const [rewardR, setRewardR] = useState(prefs.rewardR ?? 2);
  const [orderKind, setOrderKind] = useState<OrderKind>('market');
  const [limitPrice, setLimitPrice] = useState('');

  const [overlays, setOverlays] = useState<ChartOverlays>({ ...DEFAULT_OVERLAYS, ...(prefs.overlays ?? {}) });
  const [periods, setPeriods] = useState<IndicatorPeriods>({ ...DEFAULT_PERIODS, ...(prefs.periods ?? {}) });
  const [settings, setSettings] = useState<ChartSettings>({ ...DEFAULT_SETTINGS, ...(prefs.settings ?? {}) });
  const [chartType, setChartType] = useState<ChartType>(prefs.chartType ?? 'candles');
  const [magnet, setMagnet] = useState(prefs.magnet ?? true);
  const [tool, setTool] = useState<DrawingTool>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [redoDrawings, setRedoDrawings] = useState<Drawing[]>([]);

  /* ---------- drawing history (TradingView-style undo / redo) ---------- */
  const addDrawing = useCallback((drawing: Drawing) => {
    setDrawings((current) => [...current, drawing]);
    setRedoDrawings([]);
  }, []);

  const deleteDrawing = useCallback((id: string) => {
    setDrawings((current) => current.filter((item) => item.id !== id));
    setRedoDrawings([]);
  }, []);

  const undoDrawing = useCallback(() => {
    if (!drawings.length) return;
    const last = drawings[drawings.length - 1];
    setDrawings(drawings.slice(0, -1));
    setRedoDrawings((stack) => [...stack, last]);
  }, [drawings]);

  const redoDrawing = useCallback(() => {
    if (!redoDrawings.length) return;
    const last = redoDrawings[redoDrawings.length - 1];
    setRedoDrawings(redoDrawings.slice(0, -1));
    setDrawings((current) => [...current, last]);
  }, [redoDrawings]);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
    setRedoDrawings([]);
  }, []);

  const [dock, setDock] = useState<DockTab>(prefs.dock ?? 'executions');
  const [zen, setZen] = useState(false);
  const [menu, setMenu] = useState<'chart' | 'settings' | null>(null);
  const [modal, setModal] = useState<'symbol' | 'indicators' | null>(null);
  const [search, setSearch] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>(prefs.watchlist ?? DEFAULT_WATCHLIST);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [screenshot, setScreenshot] = useState({ signal: 0, name: 'chart' });

  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const market = getMarket(marketId);
  const digits = useMemo(() => priceDigits(candles, market.digits), [candles, market.digits]);
  const candle = candles[Math.min(cursor, candles.length - 1)];
  const progress = candles.length > 1 ? (cursor / (candles.length - 1)) * 100 : 0;

  const trades = session.trades;
  const orders = session.orders;
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
    const next: Prefs = { marketId, timeframe, balance, riskPct, stopMult, rewardR, speed, overlays, periods, settings, chartType, magnet, dock, watchlist };
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage can be unavailable in private mode — preferences are optional */
    }
  }, [marketId, timeframe, balance, riskPct, stopMult, rewardR, speed, overlays, periods, settings, chartType, magnet, dock, watchlist]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    if (!zen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [zen]);

  /* ---------- live watchlist quotes ---------- */
  useEffect(() => {
    const symbols = MARKETS.map((item) => item.binance).filter((symbol): symbol is string => Boolean(symbol));
    let cancelled = false;
    const load = () => {
      fetchTickers(symbols)
        .then((next) => {
          if (!cancelled) setTickers(next);
        })
        .catch(() => {
          /* quotes are decoration — ignore network hiccups */
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  /* ---------- load data whenever market / timeframe changes ---------- */
  const applyDataset = useCallback((data: Candle[], label: string) => {
    setCandles(data);
    const start = Math.max(1, Math.min(data.length - 2, Math.floor(data.length * 0.35)));
    cursorRef.current = start;
    setCursor(start);
    setSession({ trades: [], orders: [] });
    setDrawings([]);
    setRedoDrawings([]);
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
  const advanceTo = useCallback((target: number) => {
    const from = cursorRef.current;
    const next = Math.max(0, Math.min(candles.length - 1, Math.round(target)));
    if (next === from) return;
    cursorRef.current = next;
    setCursor(next);
    if (next > from) {
      setSession((state) => advanceSession(state, candles, from, next));
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
    if (cursorRef.current >= candles.length - 1) {
      cursorRef.current = 0;
      setCursor(0);
    }
    setPlaying((value) => !value);
  }, [candles.length]);

  /* ---------- order ticket numbers ---------- */
  const atr = useMemo(() => atrAt(candles, cursor, periods.atrLength) ?? atrAt(candles, cursor, 14), [candles, cursor, periods.atrLength]);
  const stopDistance = atr ? atr * stopMult : 0;
  const riskAmount = (equity * riskPct) / 100;
  const entryRef = orderKind === 'limit' && Number(limitPrice) > 0 ? Number(limitPrice) : candle?.close ?? 0;
  const qty = stopDistance > 0 && riskAmount > 0 ? riskAmount / stopDistance : 0;

  const longStop = entryRef - stopDistance;
  const longTarget = entryRef + stopDistance * rewardR;
  const shortStop = entryRef + stopDistance;
  const shortTarget = entryRef - stopDistance * rewardR;

  useEffect(() => {
    if (!candle) return;
    setLimitPrice(candle.close.toFixed(digits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, timeframe, digits]);

  const guardTicket = () => {
    if (!candle) return 'No candle loaded yet.';
    if (active) return 'A position is already open — manage it before adding a new entry.';
    if (orders.length) return 'A working limit order exists — cancel it first.';
    if (!(stopDistance > 0) || !(riskAmount > 0)) return 'Set a positive balance and risk %, and let a few more candles load.';
    return '';
  };

  const openMarket = useCallback((side: Side) => {
    const blocked = guardTicket();
    if (blocked || !candle) {
      setFeedback(blocked);
      return;
    }
    const price = candle.close;
    const distance = atr ? atr * stopMult : 0;
    const risk = (equity * riskPct) / 100;
    const size = risk / distance;
    setSession((state) => ({
      ...state,
      trades: [
        ...state.trades,
        {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          side,
          entry: price,
          stop: side === 'long' ? price - distance : price + distance,
          target: side === 'long' ? price + distance * rewardR : price - distance * rewardR,
          qty: size,
          risk,
          entryTime: Number(candle.time),
          entryIndex: cursorRef.current,
          orderType: 'market',
        },
      ],
    }));
    setFeedback('');
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candle, atr, stopMult, equity, riskPct, rewardR, active, orders.length]);

  const placeLimit = useCallback((side: Side) => {
    const blocked = guardTicket();
    if (blocked || !candle) {
      setFeedback(blocked);
      return;
    }
    const price = Number(limitPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setFeedback('Enter a valid limit price.');
      return;
    }
    const distance = atr ? atr * stopMult : 0;
    const risk = (equity * riskPct) / 100;
    const size = risk / distance;
    setSession((state) => ({
      ...state,
      orders: [
        ...state.orders,
        {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          side,
          price,
          stop: side === 'long' ? price - distance : price + distance,
          target: side === 'long' ? price + distance * rewardR : price - distance * rewardR,
          qty: size,
          risk,
          createdAt: Number(candle.time),
          createdIndex: cursorRef.current,
        },
      ],
    }));
    setFeedback(side === 'long' && price >= candle.close ? 'Buy limit is at/above market — it will fill on the next candle.' : '');
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candle, limitPrice, atr, stopMult, equity, riskPct, rewardR, active, orders.length]);

  const cancelOrder = useCallback((id: string) => {
    setSession((state) => ({ ...state, orders: state.orders.filter((order) => order.id !== id) }));
  }, []);

  const closeActive = useCallback(() => {
    if (!active || !candle) return;
    setSession((state) => ({
      ...state,
      trades: state.trades.map((trade) =>
        trade.id !== active.id ? trade : closeTrade(trade, candle.close, Number(candle.time), 'manual', cursorRef.current),
      ),
    }));
    setFeedback('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, candle]);

  const moveToBreakEven = useCallback(() => {
    if (!active) return;
    setSession((state) => ({
      ...state,
      trades: state.trades.map((trade) => (trade.id === active.id ? { ...trade, stop: trade.entry } : trade)),
    }));
    setFeedback('Stop moved to break-even.');
  }, [active]);

  const closeHalf = useCallback(() => {
    if (!active || !candle) return;
    setSession((state) => {
      const { closed, remaining } = partialClose(active, 0.5, candle.close, Number(candle.time), cursorRef.current);
      return { ...state, trades: [...state.trades.filter((trade) => trade.id !== active.id), closed, remaining] };
    });
    setFeedback('Closed half of the position at market.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, candle]);

  const reversePosition = useCallback(() => {
    if (!active || !candle) return;
    const blocked = !(stopDistance > 0) || !(riskAmount > 0);
    if (blocked) {
      setFeedback('Not enough data to size the reversed trade.');
      return;
    }
    const price = candle.close;
    const risk = (equity * riskPct) / 100;
    const size = risk / stopDistance;
    const side: Side = active.side === 'long' ? 'short' : 'long';
    setSession((state) => ({
      ...state,
      trades: [
        ...state.trades.map((trade) =>
          trade.id !== active.id ? trade : closeTrade(trade, price, Number(candle.time), 'manual', cursorRef.current),
        ),
        {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          side,
          entry: price,
          stop: side === 'long' ? price - stopDistance : price + stopDistance,
          target: side === 'long' ? price + stopDistance * rewardR : price - stopDistance * rewardR,
          qty: size,
          risk,
          entryTime: Number(candle.time),
          entryIndex: cursorRef.current,
          orderType: 'market',
        },
      ],
    }));
    setFeedback(`Reversed to ${side}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, candle, equity, riskPct, stopDistance, riskAmount, rewardR]);

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
        event.preventDefault();
        if (key === 'y' || event.shiftKey) redoDrawing();
        else undoDrawing();
      } else if (event.key === 'Escape') {
        setMenu(null);
        setModal(null);
        setZen(false);
        setTool('cursor');
      } else if (event.code === 'Space') {
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
        if (orderKind === 'limit') placeLimit('long');
        else openMarket('long');
      } else if (key === 's') {
        if (orderKind === 'limit') placeLimit('short');
        else openMarket('short');
      } else if (key === 'c') {
        closeActive();
      } else if (key === 'b') {
        moveToBreakEven();
      } else if (key === 'f') {
        setZen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advanceTo, openMarket, placeLimit, closeActive, moveToBreakEven, togglePlay, orderKind, undoDrawing, redoDrawing]);

  /* ---------- dropdown dismissal ---------- */
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menu]);

  /* ---------- chart legend values ---------- */
  const legend = useMemo(() => {
    const visible = candles.slice(0, cursor + 1);
    const lastOf = (series: (number | null)[]) => {
      for (let i = series.length - 1; i >= 0; i -= 1) if (series[i] !== null) return series[i] as number;
      return null;
    };
    const macd = macdSeries(visible, periods.macdFast, periods.macdSlow, periods.macdSignal);
    const stoch = stochRsiSeries(visible, periods.rsiLength, periods.stochLength, periods.stochK, periods.stochD);
    return {
      ema1: lastOf(emaSeries(visible, periods.ema1)),
      ema2: lastOf(emaSeries(visible, periods.ema2)),
      ema3: lastOf(emaSeries(visible, periods.ema3)),
      ema4: lastOf(emaSeries(visible, periods.ema4)),
      vwap: lastOf(vwapSeries(visible)),
      rsi: lastOf(rsiSeries(visible, periods.rsiLength)),
      macd: lastOf(macd.histogram),
      stoch: lastOf(stoch.k),
      atr: lastOf(atrSeries(visible, periods.atrLength)),
    };
  }, [candles, cursor, periods]);

  /* ---------- CSV import / export / reset ---------- */
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

  const exportCsv = () => {
    if (!trades.length) {
      setNotice('Nothing to export yet — place at least one trade.');
      return;
    }
    const header = ['#', 'side', 'order_type', 'entry', 'exit', 'size', 'risk', 'r_multiple', 'pnl', 'entry_time', 'exit_time', 'exit_reason'];
    const rows = [...trades]
      .sort((a, b) => a.entryTime - b.entryTime)
      .map((trade, index) => [
        index + 1,
        trade.side,
        trade.orderType ?? 'market',
        trade.entry,
        trade.exit ?? '',
        trade.qty,
        trade.risk,
        trade.rMultiple ?? '',
        trade.pnl ?? '',
        new Date(trade.entryTime * 1000).toISOString(),
        trade.exitTime ? new Date(trade.exitTime * 1000).toISOString() : '',
        trade.exitReason ?? 'open',
      ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trader-vault-${marketId}-${timeframe}-trades.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetSession = () => {
    setSession({ trades: [], orders: [] });
    setDrawings([]);
    setRedoDrawings([]);
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

  const takeScreenshot = () => setScreenshot((current) => ({ signal: current.signal + 1, name: `${marketId}-${timeframe}-${Date.now()}` }));

  const toggleWatch = (id: string) => {
    setWatchlist((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const filteredMarkets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return MARKETS;
    return MARKETS.filter((item) => item.label.toLowerCase().includes(query) || item.id.toLowerCase().includes(query));
  }, [search]);

  const directionTone = !candle ? 'neutral' : candle.close >= candle.open ? 'up' : 'down';
  const priceFor = (id: string, fallback: number) => {
    const item = getMarket(id);
    const ticker = item.binance ? tickers[item.binance] : undefined;
    if (ticker) return { price: ticker.price, changePct: ticker.changePct };
    if (item.id === marketId && candle) return { price: candle.close, changePct: 0 };
    return { price: fallback, changePct: 0 };
  };

  const rBuckets = useMemo(() => {
    const bounds = [-Infinity, -2, -1, 0, 1, 2, Infinity];
    const labels = ['≤ -2R', '-2 to -1R', '-1 to 0R', '0 to 1R', '1 to 2R', '≥ 2R'];
    return labels.map((label, index) => ({
      label,
      count: stats.rValues.filter((value) => value > bounds[index] && value <= bounds[index + 1]).length,
    }));
  }, [stats.rValues]);
  const rMax = Math.max(1, ...rBuckets.map((bucket) => bucket.count));

  const metricTiles: [string, string, string?][] = [
    ['Net P&L', fmtSignedMoney(stats.netPnl), stats.netPnl > 0 ? 'up' : stats.netPnl < 0 ? 'down' : undefined],
    ['Profit factor', stats.profitFactor === null ? '∞' : stats.profitFactor.toFixed(2)],
    ['Win rate', `${stats.winRate.toFixed(0)}%`],
    ['Avg R', `${fmtSigned(stats.avgR, 2)}R`, stats.avgR > 0 ? 'up' : stats.avgR < 0 ? 'down' : undefined],
    ['Expectancy', fmtSignedMoney(stats.expectancy, 0)],
    ['Max drawdown', `${fmtMoney(stats.maxDrawdown, 0)} · ${stats.maxDrawdownPct.toFixed(1)}%`],
    ['Avg win / loss', `${fmtMoney(stats.avgWin, 0)} / ${fmtMoney(stats.avgLoss, 0)}`],
    ['Best / worst', `${fmtSignedMoney(stats.best, 0)} / ${fmtSignedMoney(stats.worst, 0)}`],
    ['Avg bars held', stats.avgBars.toFixed(1)],
    ['Streaks', `${stats.longestWinStreak}W / ${stats.longestLossStreak}L`],
    ['Break-even', String(stats.breakEven)],
    ['Equity', fmtMoney(equity, 0)],
  ];

  const ticketBlocked = Boolean(active) || orders.length > 0;

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
            A full charting desk: draw levels, stack studies, queue limit orders and replay candles bar by bar — every trade sized by risk.
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
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} /> Export trades
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
        <StatCard label="Closed trades" value={String(stats.count).padStart(2, '0')} hint={active ? `${active.side === 'long' ? 'Long' : 'Short'} position open` : orders.length ? `${orders.length} working order` : 'Practice executions'} icon={Target} />
      </div>

      {/* ============ terminal ============ */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <section className={`bt-terminal overflow-hidden rounded-lg bg-[#131722] shadow-[0_12px_36px_rgba(15,23,42,.18)] ${zen ? 'bt-zen' : ''}`}>
            {/* toolbar */}
            <div className="bt-topbar flex flex-wrap items-center gap-0.5 border-b border-[#2a2e39] px-1.5 py-1 sm:px-2">
              <button type="button" onClick={() => setModal('symbol')} className="bt-symbol" title={`Search symbols (watchlist) — ${source}`}>
                <span className="text-[13px] font-semibold leading-none text-[#d1d4dc]">{shortName(market.label)}<span className="text-[#787b86]">/{quoteName(market.label)}</span></span>
                <span className="hidden text-[11px] text-[#787b86] sm:inline">·</span>
                <span className="hidden text-[10px] font-medium uppercase tracking-wide text-[#787b86] sm:inline">{market.kind === 'crypto' ? 'BINANCE' : 'PRACTICE'}</span>
                <ChevronDown size={12} className="text-[#787b86]" />
              </button>

              <span className="bt-topbar-sep" />

              <div className="bt-intervals">
                {TIMEFRAMES.map((frame) => (
                  <button key={frame.id} type="button" onClick={() => setTimeframe(frame.id)} className={`bt-interval ${timeframe === frame.id ? 'is-active' : ''}`}>
                    {frame.label}
                  </button>
                ))}
              </div>

              <span className="bt-topbar-sep" />

              <div className="relative">
                <button type="button" onClick={() => setMenu((value) => (value === 'chart' ? null : 'chart'))} className={`bt-icon-btn ${menu === 'chart' ? 'is-active' : ''}`} title="Chart type">
                  {(() => {
                    const Icon = CHART_TYPES.find((item) => item.id === chartType)?.icon ?? CandlestickChart;
                    return <Icon size={16} />;
                  })()}
                  <ChevronDown size={10} />
                </button>
                {menu === 'chart' && (
                  <div className="bt-menu left-0 w-48">
                    {CHART_TYPES.map((item) => (
                      <button key={item.id} type="button" onClick={() => { setChartType(item.id); setMenu(null); }} className={`bt-menu-item ${chartType === item.id ? 'is-active' : ''}`}>
                        <item.icon size={13} /> <span className="flex-1 text-left">{item.label}</span>
                        {chartType === item.id && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button type="button" onClick={() => setModal('indicators')} className="bt-icon-btn" title="Indicators & studies">
                <FunctionSquare size={15} /> <span className="hidden md:inline">Indicators</span>
              </button>

              <button type="button" onClick={togglePlay} className={`bt-icon-btn ${playing ? 'is-active' : ''}`} title="Replay / pause (Space)">
                <Play size={13} fill="currentColor" /> <span className="hidden md:inline">{playing ? 'Pause' : 'Replay'}</span>
              </button>

              <div className="ml-auto flex min-w-0 items-center gap-0.5">
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 px-2 text-[10px] text-[#787b86]"><Loader2 size={12} className="animate-spin" /> loading…</span>
                ) : null}
                <button type="button" onClick={undoDrawing} disabled={!drawings.length} className="bt-icon-btn" title="Undo drawing (Ctrl+Z)"><Undo2 size={15} /></button>
                <button type="button" onClick={redoDrawing} disabled={!redoDrawings.length} className="bt-icon-btn" title="Redo drawing (Ctrl+Shift+Z)"><Redo2 size={15} /></button>

                <span className="bt-topbar-sep" />

                <div className="relative">
                  <button type="button" onClick={() => setMenu((value) => (value === 'settings' ? null : 'settings'))} className={`bt-icon-btn ${menu === 'settings' ? 'is-active' : ''}`} title="Chart settings">
                    <Settings2 size={15} />
                  </button>
                  {menu === 'settings' && (
                    <div className="bt-menu right-0 w-56">
                      <div className="px-2 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-wide text-[#787b86]">Canvas</div>
                      {([
                        ['grid', 'Show grid'],
                        ['logScale', 'Logarithmic scale'],
                        ['lastPriceLine', 'Last price line'],
                      ] as [keyof ChartSettings, string][]).map(([key, label]) => (
                        <button key={key} type="button" onClick={() => setSettings((current) => ({ ...current, [key]: !current[key] }))} className="bt-menu-item">
                          <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm ${settings[key] ? 'bg-[#2962ff] text-white' : 'border border-[#4a4e59] text-transparent'}`}><Check size={9} strokeWidth={3} /></span>
                          <span className="flex-1 text-left">{label}</span>
                        </button>
                      ))}
                      <div className="my-1 border-t border-[#2a2e39]" />
                      <button type="button" onClick={() => { jumpTo(1); setMenu(null); }} className="bt-menu-item"><ChevronRight size={12} /><span className="flex-1 text-left">Jump to latest candle</span></button>
                      <button type="button" onClick={() => setSettings({ ...DEFAULT_SETTINGS })} className="bt-menu-item"><RotateCcw size={12} /><span className="flex-1 text-left">Reset chart settings</span></button>
                    </div>
                  )}
                </div>

                <button type="button" onClick={takeScreenshot} className="bt-icon-btn" title="Save chart image"><Camera size={15} /></button>
                <button type="button" onClick={() => setZen((value) => !value)} className="bt-icon-btn" title={zen ? 'Exit fullscreen (Esc)' : 'Fullscreen (F)'}>
                  {zen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>

            {/* chart + drawing rail */}
            <div className="flex min-h-0 flex-1">
              <nav className="bt-rail" aria-label="Drawing tools">
                {DRAW_TOOLS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setTool(item.id)} title={item.hint} className={`bt-rail-btn ${tool === item.id ? 'is-active' : ''}`}>
                    <item.icon size={17} />
                  </button>
                ))}
                <div className="bt-rail-sep" />
                <button type="button" onClick={() => setMagnet((value) => !value)} title="Magnet snapping to OHLC" className={`bt-rail-btn ${magnet ? 'is-active' : ''}`}>
                  <Magnet size={17} />
                </button>
                <button type="button" onClick={clearDrawings} title="Remove all drawings" disabled={!drawings.length} className="bt-rail-btn disabled:opacity-30">
                  <Trash2 size={17} />
                </button>
              </nav>

              <div className="bt-chart-area relative h-[420px] min-w-0 flex-1 sm:h-[560px]">
                <BacktestChart
                  candles={candles}
                  cursor={cursor}
                  digits={digits}
                  chartType={chartType}
                  overlays={overlays}
                  periods={periods}
                  settings={settings}
                  trades={trades}
                  position={position}
                  orders={orders}
                  drawings={drawings}
                  tool={tool}
                  magnet={magnet}
                  screenshotSignal={screenshot.signal}
                  screenshotName={screenshot.name}
                  onAddDrawing={addDrawing}
                  onDeleteDrawing={deleteDrawing}
                />

                {/* TradingView watermark */}
                <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden">
                  <span className="select-none whitespace-nowrap text-[38px] font-semibold tracking-tight text-white/[0.04] sm:text-[64px]">
                    {shortName(market.label)}/{quoteName(market.label)} <span className="text-[0.55em]">{timeframe.toUpperCase()}</span>
                  </span>
                </div>

                {/* TradingView OHLC legend */}
                <div className="pointer-events-none absolute left-3 top-2 z-10 max-w-[calc(100%-24px)]">
                  <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight">
                    <span className="font-semibold text-[#d1d4dc]">{shortName(market.label)}/{quoteName(market.label)}</span>
                    <span className="text-[#787b86]">·</span>
                    <span className="font-medium text-[#d1d4dc]">{timeframe.toUpperCase()}</span>
                    <span className="text-[#787b86]">·</span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#787b86]">{market.kind === 'crypto' ? 'BINANCE' : 'PRACTICE'}</span>
                  </div>
                  {candle && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] tabular-nums" style={{ color: directionTone === 'up' ? '#26a69a' : '#ef5350' }}>
                      <span>O {fmtPrice(candle.open, digits)}</span>
                      <span>H {fmtPrice(candle.high, digits)}</span>
                      <span>L {fmtPrice(candle.low, digits)}</span>
                      <span>C {fmtPrice(candle.close, digits)}</span>
                      <span className="text-[#787b86]">{fmtSigned(candle.close - candle.open, digits)} ({pct(((candle.close - candle.open) / Math.max(1e-9, candle.open)) * 100)})</span>
                      {candle.volume > 0 && <span className="text-[#787b86]">Vol {fmtCompact(candle.volume)}</span>}
                    </div>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] leading-tight text-[#b2b5be]">
                    {overlays.ema1 && <span><span className="text-[#2962ff]">EMA {periods.ema1}</span> <span className="tabular-nums">{fmtPrice(legend.ema1 ?? undefined, digits)}</span></span>}
                    {overlays.ema2 && <span><span className="text-[#ff9800]">EMA {periods.ema2}</span> <span className="tabular-nums">{fmtPrice(legend.ema2 ?? undefined, digits)}</span></span>}
                    {overlays.ema3 && <span><span className="text-[#e91e63]">EMA {periods.ema3}</span> <span className="tabular-nums">{fmtPrice(legend.ema3 ?? undefined, digits)}</span></span>}
                    {overlays.ema4 && <span><span className="text-[#9c27b0]">EMA {periods.ema4}</span> <span className="tabular-nums">{fmtPrice(legend.ema4 ?? undefined, digits)}</span></span>}
                    {overlays.vwap && <span><span className="text-[#00bcd4]">VWAP</span> <span className="tabular-nums">{fmtPrice(legend.vwap ?? undefined, digits)}</span></span>}
                    <span><span className="text-[#787b86]">ATR {periods.atrLength}</span> <span className="tabular-nums">{legend.atr === null ? '—' : fmtPrice(legend.atr, digits)}</span></span>
                  </div>
                </div>

                {loading && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131722]/70 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-1.5 text-xs text-[#d1d4dc]">
                      <Loader2 size={14} className="animate-spin" /> Fetching candles…
                    </div>
                  </div>
                )}

                <div className="absolute bottom-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5">
                  {active && candle && (
                    <div className="flex items-center gap-2 rounded border border-[#2a2e39] bg-[#1e222d]/95 px-2.5 py-1.5 text-[10px] text-[#b2b5be] backdrop-blur">
                      <span className={active.side === 'long' ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{active.side === 'long' ? 'LONG' : 'SHORT'} · {fmtPrice(active.entry, digits)}</span>
                      <span className="text-[#4a4e59]">•</span>
                      <span className={openPnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>uPnL {fmtSignedMoney(openPnl)}</span>
                      <span className="text-[#4a4e59]">•</span>
                      <span>{active.risk > 0 ? `${fmtSigned(openPnl / active.risk, 2)}R` : '—'}</span>
                    </div>
                  )}
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center gap-1.5 rounded border border-[#2962ff]/40 bg-[#2962ff]/10 px-2.5 py-1.5 text-[10px] text-[#8ab4ff] backdrop-blur">
                      <span>{order.side === 'long' ? 'BUY' : 'SELL'} LIMIT @ {fmtPrice(order.price, digits)}</span>
                      <button type="button" onClick={() => cancelOrder(order.id)} className="text-[#8ab4ff]/70 hover:text-white" title="Cancel order"><X size={11} /></button>
                    </div>
                  ))}
                </div>

                {tool !== 'cursor' && tool !== 'crosshair' && (
                  <button type="button" onClick={() => setTool('cursor')} className="bt-icon-btn absolute right-2.5 top-2 z-20 border border-[#2a2e39] bg-[#1e222d]">
                    <X size={11} /> <span className="text-[10px]">exit drawing</span>
                  </button>
                )}
              </div>
            </div>

            {/* replay bar */}
            <div className="border-t border-[#2a2e39] bg-[#131722] px-2.5 pb-2 pt-2 sm:px-3">
              <div className="mb-1.5 flex items-center justify-between text-[10px] tabular-nums text-[#787b86]">
                <span>
                  {candle ? new Date(Number(candle.time) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </span>
                <span>{cursor + 1} / {candles.length} bars · {progress.toFixed(0)}%</span>
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
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => jumpTo(0)} title="Start of data" className="bt-control"><SkipBack size={15} /></button>
                  <button type="button" onClick={() => advanceTo(cursorRef.current - 1)} title="Previous candle (←)" className="bt-control"><ChevronLeft size={17} /></button>
                  <button type="button" onClick={togglePlay} title="Play / pause (Space)" className="mx-1 flex h-7 w-9 items-center justify-center rounded bg-[#2962ff] text-white hover:bg-[#1e53e5]">
                    {playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
                  </button>
                  <button type="button" onClick={() => advanceTo(cursorRef.current + 1)} title="Next candle (→)" className="bt-control"><ChevronRight size={17} /></button>
                  <button type="button" onClick={() => advanceTo(cursorRef.current + 10)} title="Skip 10 candles (Shift+→)" className="bt-control"><SkipForward size={15} /></button>
                  <button type="button" onClick={() => jumpTo(1)} title="End of data" className="bt-control"><ChevronRight size={15} /><ChevronRight size={15} className="-ml-2" /></button>
                  <span className="ml-1.5 hidden items-center gap-1 text-[10px] text-[#787b86] 2xl:flex">
                    <kbd>←</kbd><kbd>→</kbd> step <kbd>Space</kbd> play <kbd>L</kbd>/<kbd>S</kbd> trade <kbd>C</kbd> close <kbd>B</kbd> BE
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#787b86]">Speed</span>
                  <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Playback speed" className="bt-dark-field !w-auto !py-1 !text-[11px]">
                    {[0.5, 1, 2, 4, 8, 16].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* dock */}
            <div className="bt-dock border-t border-[#2a2e39] bg-[#131722]">
              <div className="flex items-center gap-0 overflow-x-auto px-2 pt-1.5">
                {([
                  ['executions', `Executions · ${trades.length}`],
                  ['statistics', 'Strategy stats'],
                  ['distribution', 'R distribution'],
                ] as [DockTab, string][]).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setDock(id)} className={`bt-dock-tab ${dock === id ? 'is-active' : ''}`}>{label}</button>
                ))}
                <span className="ml-auto hidden items-center gap-1 pr-1 text-[9px] text-[#787b86] sm:flex">
                  <span className="h-1 w-1 rounded-full bg-[#2962ff]" /> replay dock
                </span>
              </div>
              <div className="bt-dock-body px-2.5 py-2.5 sm:px-3">
                {dock === 'executions' && (
                  trades.length === 0 ? (
                    <div className="flex items-center gap-2 rounded border border-dashed border-[#363a45] px-3 py-6 text-[11px] text-[#787b86]">
                      <Crosshair size={14} /> No executions yet — press <kbd>L</kbd> or <kbd>S</kbd> (or use the ticket) to take a trade at the current candle.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-[11px]">
                        <thead className="text-[9px] uppercase tracking-wide text-[#787b86]">
                          <tr>
                            <th className="px-2 py-1 font-medium">#</th>
                            <th className="px-2 py-1 font-medium">Side</th>
                            <th className="px-2 py-1 font-medium">Type</th>
                            <th className="px-2 py-1 font-medium">Entry</th>
                            <th className="px-2 py-1 font-medium">Exit</th>
                            <th className="px-2 py-1 font-medium">Size</th>
                            <th className="px-2 py-1 font-medium">R</th>
                            <th className="px-2 py-1 font-medium">P&L</th>
                            <th className="px-2 py-1 font-medium">Bars</th>
                            <th className="px-2 py-1 font-medium">Exit type</th>
                          </tr>
                        </thead>
                        <tbody className="tabular-nums">
                          {[...trades].sort((a, b) => a.entryTime - b.entryTime).map((trade, index) => {
                            const open = trade.exit === undefined;
                            return (
                              <tr key={trade.id} className="border-t border-[#2a2e39] text-[#b2b5be] hover:bg-[#1e222d]">
                                <td className="px-2 py-1.5 text-[#787b86]">{index + 1}</td>
                                <td className="px-2 py-1.5">
                                  <span className={`inline-flex items-center gap-1 font-semibold ${trade.side === 'long' ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                                    {trade.side === 'long' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                    {trade.side === 'long' ? 'Long' : 'Short'}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-[9px] uppercase tracking-wide text-[#787b86]">{trade.orderType ?? 'market'}</td>
                                <td className="px-2 py-1.5 text-[#d1d4dc]">{fmtPrice(trade.entry, digits)}</td>
                                <td className="px-2 py-1.5">{open ? <span className="text-[#ff9800]">open</span> : fmtPrice(trade.exit, digits)}</td>
                                <td className="px-2 py-1.5 text-[#787b86]">{fmtQty(trade.qty)}</td>
                                <td className={`px-2 py-1.5 font-semibold ${open ? 'text-[#787b86]' : (trade.rMultiple ?? 0) >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{open ? '—' : `${fmtSigned(trade.rMultiple, 2)}R`}</td>
                                <td className={`px-2 py-1.5 font-semibold ${open ? 'text-[#787b86]' : (trade.pnl ?? 0) >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{open ? '—' : fmtSignedMoney(trade.pnl)}</td>
                                <td className="px-2 py-1.5 text-[#787b86]">{trade.entryIndex !== undefined && trade.exitIndex !== undefined ? trade.exitIndex - trade.entryIndex : '—'}</td>
                                <td className="px-2 py-1.5 text-[9px] uppercase tracking-wide text-[#787b86]">{open ? 'in progress' : trade.exitReason ?? 'manual'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {dock === 'statistics' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                      {metricTiles.map(([label, value, tone]) => (
                        <div key={label} className="rounded-sm bg-[#1e222d] px-2.5 py-1.5">
                          <div className="text-[9px] uppercase tracking-wide text-[#787b86]">{label}</div>
                          <div className={`mt-0.5 text-[12px] font-semibold tabular-nums ${tone === 'up' ? 'text-[#26a69a]' : tone === 'down' ? 'text-[#ef5350]' : 'text-[#d1d4dc]'}`}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-sm bg-[#1e222d] px-2 pb-1 pt-2">
                      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wide text-[#787b86]">
                        <span>Equity curve</span>
                        <span className="tabular-nums text-[#b2b5be]">{fmtMoney(equity, 0)}</span>
                      </div>
                      <EquityCurve points={stats.equity} start={balance} />
                    </div>
                  </div>
                )}

                {dock === 'distribution' && (
                  <div className="space-y-1.5">
                    {stats.count === 0 ? (
                      <div className="rounded border border-dashed border-[#363a45] px-3 py-6 text-center text-[11px] text-[#787b86]">Close a few trades to see how your R multiples are distributed.</div>
                    ) : (
                      rBuckets.map((bucket) => (
                        <div key={bucket.label} className="flex items-center gap-2 text-[10px]">
                          <span className="w-[74px] shrink-0 text-right text-[#787b86]">{bucket.label}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded-sm bg-[#2a2e39]">
                            <div
                              className={`h-full rounded-sm ${bucket.label.startsWith('-') || bucket.label.startsWith('≤') ? 'bg-[#ef5350]/80' : 'bg-[#26a69a]/80'}`}
                              style={{ width: `${(bucket.count / rMax) * 100}%` }}
                            />
                          </div>
                          <span className="w-6 text-right tabular-nums text-[#b2b5be]">{bucket.count}</span>
                        </div>
                      ))
                    )}
                    {stats.count > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[10px] text-[#787b86]">
                        <span>Best <span className="text-[#26a69a]">{fmtSigned(Math.max(...stats.rValues), 2)}R</span></span>
                        <span>Worst <span className="text-[#ef5350]">{fmtSigned(Math.min(...stats.rValues), 2)}R</span></span>
                        <span>Avg <span className="text-[#d1d4dc]">{fmtSigned(stats.avgR, 2)}R</span></span>
                        <span>Sample <span className="text-[#d1d4dc]">{stats.count}</span></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* ============ right rail ============ */}
        <div className="space-y-4">
          {/* order ticket */}
          <section className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Order ticket</h3>
                <p className="mt-0.5 text-[10px] text-slate-400">Size from your stop, then send it to the replay.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">{shortName(market.label)}/{quoteName(market.label)}</span>
            </div>

            <div className="bt-light-seg mt-3">
              {(['market', 'limit'] as OrderKind[]).map((kind) => (
                <button key={kind} type="button" onClick={() => {
                  setOrderKind(kind);
                  if (kind === 'limit' && candle) setLimitPrice(candle.close.toFixed(digits));
                }} className={orderKind === kind ? 'is-active' : ''}>
                  {kind === 'market' ? 'Market' : 'Limit'}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Balance ($)</span>
                <input type="number" min={100} step={100} value={balance} onChange={(event) => setBalance(Math.max(100, Number(event.target.value) || 0))} className="w-full !py-2 !text-xs" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Risk / trade (%)</span>
                <input type="number" min={0.1} max={10} step={0.1} value={riskPct} onChange={(event) => setRiskPct(Math.min(10, Math.max(0.1, Number(event.target.value) || 0.1)))} className="w-full !py-2 !text-xs" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Stop (× ATR)</span>
                <input type="number" min={0.3} max={6} step={0.1} value={stopMult} onChange={(event) => setStopMult(Math.min(6, Math.max(0.3, Number(event.target.value) || 0.3)))} className="w-full !py-2 !text-xs" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Reward (R)</span>
                <input type="number" min={0.5} max={10} step={0.5} value={rewardR} onChange={(event) => setRewardR(Math.min(10, Math.max(0.5, Number(event.target.value) || 0.5)))} className="w-full !py-2 !text-xs" />
              </label>
            </div>

            {orderKind === 'limit' && (
              <label className="mt-2 block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">Limit price</span>
                <input
                  type="number"
                  step={10 ** -digits}
                  value={limitPrice}
                  onChange={(event) => setLimitPrice(event.target.value)}
                  className="w-full !py-2 !text-xs tabular-nums"
                  placeholder={candle ? candle.close.toFixed(digits) : '0'}
                />
                <span className="mt-1 block text-[9px] text-slate-400">Rests until price trades through it on the next candles.</span>
              </label>
            )}

            <div className="mt-3 rounded-2xl bg-[#f7f8fa] p-3 text-[10px] text-slate-500">
              <div className="flex items-center justify-between">
                <span>{orderKind === 'limit' ? 'Limit entry' : 'Entry · current close'}</span>
                <span className="bt-mono text-sm font-semibold text-zinc-900">{candle ? fmtPrice(entryRef, digits) : '—'}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,.05)]">
                  <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-600"><ArrowUp size={9} /> Long</div>
                  <div className="mt-1 flex items-center justify-between"><span>Stop</span><span className="bt-mono text-rose-600">{fmtPrice(longStop, digits)}</span></div>
                  <div className="flex items-center justify-between"><span>Target</span><span className="bt-mono text-emerald-600">{fmtPrice(longTarget, digits)}</span></div>
                </div>
                <div className="rounded-xl bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,.05)]">
                  <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-rose-600"><ArrowDown size={9} /> Short</div>
                  <div className="mt-1 flex items-center justify-between"><span>Stop</span><span className="bt-mono text-rose-600">{fmtPrice(shortStop, digits)}</span></div>
                  <div className="flex items-center justify-between"><span>Target</span><span className="bt-mono text-emerald-600">{fmtPrice(shortTarget, digits)}</span></div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                <span>Size · risk · R:R</span>
                <span className="bt-mono text-zinc-800">{fmtQty(qty)} · <span className="text-amber-600">{fmtMoney(riskAmount, 0)}</span> · 1:{rewardR.toFixed(1)}</span>
              </div>
              <div className="mt-1 text-[9px] text-slate-500">
                {candle && stopDistance ? `Stop ${((stopDistance / candle.close) * 100).toFixed(2)}% away · ATR ${fmtPrice(atr ?? undefined, digits)}` : 'Waiting for enough candles to compute ATR.'}
              </div>
            </div>

            {feedback && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-700">{feedback}</p>}

            {active ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">{active.side === 'long' ? 'Long' : 'Short'} open · {fmtQty(active.qty)}</span>
                    <span className={`text-xs font-semibold tabular-nums ${openPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtSignedMoney(openPnl)}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/60">
                    <div
                      className={`h-full rounded-full ${openPnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, (((candle?.close ?? active.entry) - active.entry) * (active.side === 'long' ? 1 : -1)) / Math.max(1e-9, Math.abs(active.target - active.entry)) * 100))}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-amber-900/80">
                    <div>Stop <span className="bt-mono font-semibold text-rose-700">{fmtPrice(active.stop, digits)}</span></div>
                    <div className="text-right">Target <span className="bt-mono font-semibold text-emerald-700">{fmtPrice(active.target, digits)}</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={moveToBreakEven} className="rounded-full border border-slate-200 bg-white py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Break-even</button>
                  <button type="button" onClick={closeHalf} className="rounded-full border border-slate-200 bg-white py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Close ½</button>
                  <button type="button" onClick={reversePosition} className="rounded-full border border-slate-200 bg-white py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Reverse</button>
                  <button type="button" onClick={closeActive} className="flex items-center justify-center gap-1.5 rounded-full bg-black py-2 text-[11px] font-semibold text-white hover:bg-zinc-800">
                    <Check size={13} /> Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => (orderKind === 'limit' ? placeLimit('long') : openMarket('long'))} disabled={!candle || loading || ticketBlocked} className="bt-long">
                  <ArrowUp size={14} /> {orderKind === 'limit' ? 'Buy limit' : 'Long'}
                </button>
                <button type="button" onClick={() => (orderKind === 'limit' ? placeLimit('short') : openMarket('short'))} disabled={!candle || loading || ticketBlocked} className="bt-short">
                  <ArrowDown size={14} /> {orderKind === 'limit' ? 'Sell limit' : 'Short'}
                </button>
              </div>
            )}

            {orders.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[10px] text-amber-900">
                    <span className="font-semibold">{order.side === 'long' ? 'Buy' : 'Sell'} limit @ <span className="bt-mono">{fmtPrice(order.price, digits)}</span></span>
                    <span className="flex items-center gap-2">
                      <span className="text-amber-700/70">{fmtQty(order.qty)}</span>
                      <button type="button" onClick={() => cancelOrder(order.id)} className="rounded p-0.5 text-amber-700 hover:bg-amber-200" title="Cancel order"><X size={12} /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-2 text-center text-[9px] text-slate-400">
              Market fills at the close · limits fill when price trades through · stop/target settle on later candles.
            </p>
          </section>

          {/* watchlist */}
          <section className="rounded-2xl bg-white p-3.5 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star size={13} className="text-slate-300" />
                <h3 className="text-xs font-semibold text-zinc-900">Watchlist</h3>
              </div>
              <button type="button" onClick={() => { setSearch(''); setModal('symbol'); }} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Add symbol"><Search size={13} /></button>
            </div>
            <div className="space-y-0.5">
              {watchlist.map((id) => {
                const item = getMarket(id);
                const quote = priceFor(id, item.base);
                const selected = id === marketId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMarketId(id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition ${selected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  >
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className={`truncate text-[11px] font-semibold ${selected ? 'text-zinc-900' : 'text-slate-700'}`}>{shortName(item.label)}<span className="text-slate-400">/{quoteName(item.label)}</span></span>
                      <span className="text-[9px] text-slate-400">{item.kind === 'crypto' ? 'Crypto' : 'Practice'}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end leading-tight">
                      <span className="text-[11px] font-medium tabular-nums text-slate-700">{fmtPrice(quote.price, item.digits)}</span>
                      <span className={`text-[9px] tabular-nums ${quote.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.binance ? pct(quote.changePct) : 'synthetic'}</span>
                    </span>
                  </button>
                );
              })}
              {watchlist.length === 0 && <p className="px-2 py-3 text-[10px] text-slate-400">Empty — use the search button to add markets.</p>}
            </div>
            <button type="button" onClick={() => { setSearch(''); setModal('symbol'); }} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-1.5 text-[10px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700">
              <Search size={11} /> Symbol search
            </button>
          </section>

          {/* session */}
          <section className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,.05)]">
            <h3 className="text-sm font-semibold text-zinc-900">Session</h3>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><dt className="text-slate-500">Source</dt><dd className="max-w-[180px] truncate text-right text-slate-700">{source}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Starting balance</dt><dd className="tabular-nums text-slate-700">{fmtMoney(balance, 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Equity</dt><dd className="tabular-nums text-slate-700">{fmtMoney(equity, 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Open P&L</dt><dd className={`tabular-nums ${openPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{active ? fmtSignedMoney(openPnl) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Win / loss / BE</dt><dd className="tabular-nums text-slate-700">{stats.wins} / {stats.losses} / {stats.breakEven}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Expectancy</dt><dd className="tabular-nums text-slate-700">{fmtSignedMoney(stats.expectancy, 0)} · {fmtSigned(stats.expectancyR, 2)}R</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Drawings</dt><dd className="tabular-nums text-slate-700">{drawings.length}</dd></div>
            </dl>
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-600">Shortcuts</span> · Space play/pause · ←/→ step · Shift+←/→ ×10 · L/S order · C close · B break-even · F fullscreen · Esc cancel tool.
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1.5"><Upload size={12} /> CSV: time/date, open, high, low, close (+ optional volume)</span>
        <span>Educational replay only — not financial advice.</span>
      </div>

      {/* ============ symbol modal ============ */}
      {modal === 'symbol' && (
        <Modal title="Symbols" subtitle="Crypto uses live Binance history · metals & FX use deterministic practice candles." onClose={() => setModal(null)}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search BTC, ETH, gold, EUR…"
              className="w-full !py-2.5 !pl-9 !text-xs"
            />
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {filteredMarkets.map((item) => {
              const quote = priceFor(item.id, item.base);
              const watched = watchlist.includes(item.id);
              return (
                <div key={item.id} className="flex items-center gap-3 py-2">
                  <button type="button" onClick={() => toggleWatch(item.id)} className={`rounded-full p-1.5 ${watched ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`} title={watched ? 'Remove from watchlist' : 'Add to watchlist'}>
                    <Star size={14} fill={watched ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" onClick={() => { setMarketId(item.id); setModal(null); }} className="flex flex-1 items-center justify-between gap-3 text-left">
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="text-xs font-semibold text-zinc-900">{item.label}</span>
                      <span className="text-[10px] text-slate-400">{item.kind === 'crypto' ? 'Binance spot · live history' : 'Practice feed · synthetic history'}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end leading-tight">
                      <span className="text-xs tabular-nums text-slate-700">{fmtPrice(quote.price, item.digits)}</span>
                      <span className={`text-[10px] tabular-nums ${quote.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.binance ? pct(quote.changePct) : 'synthetic'}</span>
                    </span>
                  </button>
                </div>
              );
            })}
            {filteredMarkets.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No symbol matches “{search}”.</p>}
          </div>
        </Modal>
      )}

      {/* ============ indicators modal ============ */}
      {modal === 'indicators' && (
        <Modal title="Indicators & studies" subtitle="Toggle studies, tune the lengths — the chart and legend update immediately." onClose={() => setModal(null)} width="max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">On chart</div>
              <div className="divide-y divide-slate-100">
                {OVERLAY_META.map((item) => (
                  <button key={item.key} type="button" onClick={() => setOverlays((current) => ({ ...current, [item.key]: !current[item.key] }))} className="flex w-full items-center justify-between gap-3 py-2 text-left">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-slate-700">{item.label}</span>
                    </span>
                    <span className={`flex h-4 w-4 items-center justify-center rounded ${overlays[item.key] ? 'bg-emerald-500 text-white' : 'border border-slate-200 text-transparent'}`}><Check size={11} strokeWidth={3} /></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {PERIOD_FIELDS.map((group) => (
                <div key={group.group}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group.group}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.fields.map((field) => (
                      <label key={field.key} className="block">
                        <span className="mb-0.5 block text-[10px] text-slate-500">{field.label}</span>
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={periods[field.key]}
                          onChange={(event) => {
                            const raw = Number(event.target.value);
                            const next = Number.isFinite(raw) ? Math.min(field.max, Math.max(field.min, raw)) : field.min;
                            setPeriods((current) => ({ ...current, [field.key]: next }));
                          }}
                          className="w-full !py-1.5 !text-xs tabular-nums"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setPeriods({ ...DEFAULT_PERIODS })} className="text-[10px] font-medium text-slate-500 hover:text-slate-800">Reset defaults</button>
                <button type="button" onClick={() => setModal(null)} className="rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white hover:bg-zinc-800">Done</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Circle: React.FC = () => <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />;
