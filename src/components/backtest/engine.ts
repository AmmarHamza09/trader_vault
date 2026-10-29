import type { UTCTimestamp } from 'lightweight-charts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Side = 'long' | 'short';
export type ExitReason = 'stop' | 'target' | 'manual';
export type OrderType = 'market' | 'limit';

export type BacktestTrade = {
  id: string;
  side: Side;
  entry: number;
  stop: number;
  target: number;
  qty: number;
  risk: number;
  entryTime: number;
  entryIndex?: number;
  exitIndex?: number;
  orderType?: OrderType;
  exit?: number;
  exitTime?: number;
  exitReason?: ExitReason;
  pnl?: number;
  rMultiple?: number;
};

/** A resting limit order that fills when price trades through it during replay. */
export type PendingOrder = {
  id: string;
  side: Side;
  price: number;
  stop: number;
  target: number;
  qty: number;
  risk: number;
  createdAt: number;
  createdIndex: number;
};

export type TimeframeId = '5m' | '15m' | '1h' | '4h' | '1d';

export type Timeframe = { id: TimeframeId; label: string; seconds: number };

export const TIMEFRAMES: Timeframe[] = [
  { id: '5m', label: '5m', seconds: 300 },
  { id: '15m', label: '15m', seconds: 900 },
  { id: '1h', label: '1h', seconds: 3_600 },
  { id: '4h', label: '4h', seconds: 14_400 },
  { id: '1d', label: '1D', seconds: 86_400 },
];

export type Market = {
  id: string;
  label: string;
  kind: 'crypto' | 'practice';
  /** Binance symbol used for real history (crypto only). */
  binance?: string;
  base: number;
  volatility: number;
  digits: number;
};

export const MARKETS: Market[] = [
  { id: 'BTCUSDT', label: 'BTC / USDT', kind: 'crypto', binance: 'BTCUSDT', base: 68_240, volatility: 0.0038, digits: 2 },
  { id: 'ETHUSDT', label: 'ETH / USDT', kind: 'crypto', binance: 'ETHUSDT', base: 3_520, volatility: 0.0046, digits: 2 },
  { id: 'SOLUSDT', label: 'SOL / USDT', kind: 'crypto', binance: 'SOLUSDT', base: 168.4, volatility: 0.0062, digits: 3 },
  { id: 'BNBUSDT', label: 'BNB / USDT', kind: 'crypto', binance: 'BNBUSDT', base: 592.5, volatility: 0.0044, digits: 2 },
  { id: 'XAUUSD', label: 'XAU / USD', kind: 'practice', base: 2_348.4, volatility: 0.0021, digits: 2 },
  { id: 'EURUSD', label: 'EUR / USD', kind: 'practice', base: 1.0865, volatility: 0.0011, digits: 5 },
  { id: 'GBPUSD', label: 'GBP / USD', kind: 'practice', base: 1.2712, volatility: 0.0013, digits: 5 },
];

export const getMarket = (id: string): Market => MARKETS.find((market) => market.id === id) ?? MARKETS[0];
export const getTimeframe = (id: TimeframeId): Timeframe => TIMEFRAMES.find((frame) => frame.id === id) ?? TIMEFRAMES[1];

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

export function priceDigits(candles: Candle[], fallback = 2): number {
  const sample = candles.slice(0, 40);
  let digits = 0;
  for (const candle of sample) {
    const text = String(candle.close);
    const dot = text.indexOf('.');
    if (dot >= 0) digits = Math.max(digits, text.length - dot - 1);
  }
  return Math.min(6, Math.max(fallback > 3 ? fallback : 2, digits));
}

export const fmtPrice = (value: number | undefined, digits = 2) =>
  value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtMoney = (value: number | undefined, digits = 2) =>
  value === undefined || !Number.isFinite(value) ? '—' : `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtSignedMoney = (value: number | undefined, digits = 2) =>
  value === undefined || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtSigned = (value: number | undefined, digits = 2) =>
  value === undefined || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

export const fmtCompact = (value: number) =>
  Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/* ------------------------------------------------------------------ */
/*  Synthetic practice data (deterministic per market + timeframe)     */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** Deterministic random-walk OHLC series so practice data never changes between reloads. */
export function makeSampleCandles(market: Market, timeframe: TimeframeId, count = 900): Candle[] {
  const frame = getTimeframe(timeframe);
  const random = mulberry32(hashString(`${market.id}:${timeframe}`));
  const lastBucket = Math.floor(Date.now() / 1000 / frame.seconds) * frame.seconds;
  const start = lastBucket - (count - 1) * frame.seconds;
  const digits = market.digits;
  const round = (value: number) => Number(value.toFixed(digits));

  let price = market.base * (0.86 + random() * 0.1);
  let drift = 0;
  const candles: Candle[] = [];

  for (let index = 0; index < count; index += 1) {
    if (index % 40 === 0) drift = (random() - 0.5) * market.volatility * 0.9;
    const shock = (random() + random() + random() - 1.5) * market.volatility;
    const open = price;
    const close = Math.max(open * 0.4, round(open * (1 + drift + shock)));
    const body = Math.abs(close - open);
    const wick = open * market.volatility;
    const high = round(Math.max(open, close) + body * 0.25 + wick * (0.15 + random() * 0.75));
    const low = round(Math.min(open, close) - body * 0.25 - wick * (0.15 + random() * 0.75));
    const volume = Math.round((0.35 + random() * 1.8) * 1_000 * (1 + body / Math.max(wick, 1e-9)));

    candles.push({
      time: (start + index * frame.seconds) as UTCTimestamp,
      open: round(open),
      high,
      low: Math.max(low, 0.00001),
      close,
      volume,
    });
    price = close;
  }

  return candles;
}

/* ------------------------------------------------------------------ */
/*  Live history (Binance public data endpoint, no API key)            */
/* ------------------------------------------------------------------ */

export async function fetchCandles(market: Market, timeframe: TimeframeId, limit = 1000): Promise<Candle[]> {
  if (!market.binance) throw new Error(`${market.label} is not available live.`);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${market.binance}&interval=${timeframe}&limit=${limit}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Price history request failed (${response.status}).`);
    const rows = (await response.json()) as unknown[][];
    const candles: Candle[] = [];
    for (const row of rows) {
      const time = Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      const volume = Number(row[5]);
      if (![time, open, high, low, close].every(Number.isFinite)) continue;
      candles.push({ time: Math.floor(time / 1000) as UTCTimestamp, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 });
    }
    if (candles.length < 20) throw new Error('Not enough candles returned.');
    return candles;
  } finally {
    window.clearTimeout(timeout);
  }
}

export type Ticker = { symbol: string; price: number; changePct: number };

/** Public 24h tickers for the watchlist (no API key, same Binance data host). */
export async function fetchTickers(symbols: string[]): Promise<Record<string, Ticker>> {
  if (!symbols.length) return {};
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const list = encodeURIComponent(JSON.stringify(symbols));
    const response = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${list}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Ticker request failed (${response.status}).`);
    const rows = (await response.json()) as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>;
    const out: Record<string, Ticker> = {};
    for (const row of rows) {
      const price = Number(row.lastPrice);
      const changePct = Number(row.priceChangePercent);
      if (Number.isFinite(price)) out[row.symbol] = { symbol: row.symbol, price, changePct: Number.isFinite(changePct) ? changePct : 0 };
    }
    return out;
  } finally {
    window.clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/*  CSV import                                                         */
/* ------------------------------------------------------------------ */

function parseTime(raw: string): number {
  const value = raw.trim().replace(/^["']|["']$/g, '');
  if (!value) return NaN;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric > 1e17) return Math.floor(numeric / 1e6); // nanoseconds
    if (numeric > 1e14) return Math.floor(numeric / 1e3); // microseconds
    if (numeric > 1e11) return Math.floor(numeric / 1e3); // milliseconds
    return Math.floor(numeric); // seconds
  }
  const isoTry = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
  const parsed = Date.parse(isoTry);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : NaN;
}

/** Accepts TradingView / MT4 exports: time|date + open, high, low, close (+ optional volume). */
export function parseCsv(text: string): Candle[] {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 3) throw new Error('CSV needs a header row and at least two candles.');

  const delimiter = [',', ';', '\t'].reduce((best, candidate) => (lines[0].split(candidate).length > lines[0].split(best).length ? candidate : best), ',');
  const split = (line: string) => line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
  const headers = split(lines[0]).map((header) => header.toLowerCase());

  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const timeIndex = find('time', 'date', 'datetime', 'timestamp', 'open time', 'opentime');
  const openIndex = find('open', 'o');
  const highIndex = find('high', 'h');
  const lowIndex = find('low', 'l');
  const closeIndex = find('close', 'c', 'last');
  const volumeIndex = find('volume', 'vol', 'v');
  if ([timeIndex, openIndex, highIndex, lowIndex, closeIndex].some((index) => index < 0)) {
    throw new Error('Missing columns. Use time/date, open, high, low, close.');
  }

  const rows: Candle[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    if (cells.length <= closeIndex) continue;
    const time = parseTime(cells[timeIndex]);
    const open = Number(cells[openIndex]);
    const high = Number(cells[highIndex]);
    const low = Number(cells[lowIndex]);
    const close = Number(cells[closeIndex]);
    const volume = volumeIndex >= 0 ? Number(cells[volumeIndex]) : 0;
    if (![time, open, high, low, close].every(Number.isFinite)) continue;
    if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) continue;
    rows.push({ time: time as UTCTimestamp, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 });
  }

  const sorted = rows.sort((a, b) => Number(a.time) - Number(b.time));
  const unique = sorted.filter((candle, index) => index === 0 || Number(candle.time) > Number(sorted[index - 1].time));
  if (unique.length < 2) throw new Error('No valid OHLC candles found in this file.');
  return unique;
}

/* ------------------------------------------------------------------ */
/*  Indicators                                                         */
/* ------------------------------------------------------------------ */

export type LinePoint = { time: UTCTimestamp; value: number };

export function smaSeries(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i += 1) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function emaSeries(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  let seed = 0;
  for (let i = 0; i < candles.length; i += 1) {
    const close = candles[i].close;
    if (i < period) {
      seed += close;
      out.push(null);
      if (i === period - 1) ema = seed / period;
      continue;
    }
    ema = close * k + (ema as number) * (1 - k);
    out.push(ema);
  }
  return out;
}

export function bollingerSeries(candles: Candle[], period = 20, mult = 2) {
  const middle = smaSeries(candles, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const mid = middle[i];
    if (mid === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j += 1) variance += (candles[j].close - mid) ** 2;
    const deviation = Math.sqrt(variance / period);
    upper.push(mid + deviation * mult);
    lower.push(mid - deviation * mult);
  }
  return { middle, upper, lower };
}

export function rsiSeries(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < candles.length; i += 1) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      out.push(i === period ? (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)) : null);
      continue;
    }
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return out;
}

/** EMA over a nullable series (used for MACD signal line and smoothed studies). */
function emaOfNullable(values: (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null || !Number.isFinite(value)) {
      out.push(null);
      continue;
    }
    if (ema === null) {
      seedSum += value;
      seedCount += 1;
      out.push(null);
      if (seedCount === period) {
        ema = seedSum / period;
        out[out.length - 1] = ema;
      }
      continue;
    }
    ema = value * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

function smaOfNullable(values: (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      const value = values[j];
      if (value === null || !Number.isFinite(value)) break;
      sum += value;
      count += 1;
    }
    out.push(count === period ? sum / period : null);
  }
  return out;
}

export function macdSeries(candles: Candle[], fast = 12, slow = 26, signal = 9) {
  const fastEma = emaSeries(candles, fast);
  const slowEma = emaSeries(candles, slow);
  const macd: (number | null)[] = candles.map((_, index) => {
    const a = fastEma[index];
    const b = slowEma[index];
    return a !== null && b !== null ? a - b : null;
  });
  const signalLine = emaOfNullable(macd, signal);
  const histogram: (number | null)[] = macd.map((value, index) => {
    const signalValue = signalLine[index];
    return value !== null && signalValue !== null ? value - signalValue : null;
  });
  return { macd, signal: signalLine, histogram };
}

export function stochRsiSeries(candles: Candle[], rsiPeriod = 14, length = 14, kSmooth = 3, dSmooth = 3) {
  const rsi = rsiSeries(candles, rsiPeriod);
  const raw: (number | null)[] = rsi.map((value, index) => {
    if (value === null || index < length - 1) return null;
    let min = Infinity;
    let max = -Infinity;
    for (let j = index - length + 1; j <= index; j += 1) {
      const sample = rsi[j];
      if (sample === null) return null;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    if (max === min) return 50;
    return ((value - min) / (max - min)) * 100;
  });
  return { k: smaOfNullable(raw, kSmooth), d: smaOfNullable(smaOfNullable(raw, kSmooth), dSmooth) };
}

/** Session VWAP: resets at each UTC day boundary. */
export function vwapSeries(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = [];
  let pv = 0;
  let volumeSum = 0;
  let day = -1;
  for (const candle of candles) {
    const currentDay = Math.floor(Number(candle.time) / 86_400);
    if (currentDay !== day) {
      day = currentDay;
      pv = 0;
      volumeSum = 0;
    }
    const volume = candle.volume > 0 ? candle.volume : 0;
    const typical = (candle.high + candle.low + candle.close) / 3;
    pv += typical * volume;
    volumeSum += volume;
    out.push(volumeSum > 0 ? pv / volumeSum : null);
  }
  return out;
}

/** Heikin Ashi candles for the trend-friendlier chart style. */
export function heikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const previous = out[index - 1];
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open = previous ? (previous.open + previous.close) / 2 : (candle.open + candle.close) / 2;
    const high = Math.max(candle.high, open, close);
    const low = Math.min(candle.low, open, close);
    out.push({ time: candle.time, open, high, low, close, volume: candle.volume });
  }
  return out;
}

export function atrSeries(candles: Candle[], period = 14): (number | null)[] {
  const trueRanges: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const previousClose = i > 0 ? candles[i - 1].close : candle.open;
    trueRanges.push(Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose)));
  }
  const out: (number | null)[] = [];
  let sum = 0;
  let atr: number | null = null;
  for (let i = 0; i < trueRanges.length; i += 1) {
    if (i < period) {
      sum += trueRanges[i];
      out.push(null);
      if (i === period - 1) atr = sum / period;
      continue;
    }
    atr = ((atr as number) * (period - 1) + trueRanges[i]) / period;
    out.push(atr);
  }
  return out;
}

export function atrAt(candles: Candle[], index: number, period = 14): number | null {
  if (index < period) return null;
  const series = atrSeries(candles.slice(0, index + 1), period);
  return series[series.length - 1];
}

export function toLine(candles: Candle[], values: (number | null)[]): LinePoint[] {
  const points: LinePoint[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const value = values[i];
    if (value !== null && Number.isFinite(value)) points.push({ time: candles[i].time, value });
  }
  return points;
}

/* ------------------------------------------------------------------ */
/*  Trade settlement + statistics                                      */
/* ------------------------------------------------------------------ */

export function closeTrade(trade: BacktestTrade, price: number, time: number, reason: ExitReason, exitIndex?: number): BacktestTrade {
  const direction = trade.side === 'long' ? 1 : -1;
  const pnl = (price - trade.entry) * direction * trade.qty;
  return {
    ...trade,
    exit: price,
    exitTime: time,
    exitIndex,
    exitReason: reason,
    pnl,
    rMultiple: trade.risk > 0 ? pnl / trade.risk : 0,
  };
}

/** Walk candles forward and close any open trade when stop/target is touched (stop first = conservative). */
export function settleTrades(trades: BacktestTrade[], candles: Candle[], fromIndex: number, toIndex: number): BacktestTrade[] {
  if (!trades.some((trade) => trade.exit === undefined)) return trades;
  return trades.map((trade) => {
    if (trade.exit !== undefined) return trade;
    const first = Math.max(fromIndex, trade.entryIndex !== undefined ? trade.entryIndex + 1 : fromIndex);
    for (let index = first; index <= toIndex; index += 1) {
      const candle = candles[index];
      if (!candle) break;
      const stopHit = trade.side === 'long' ? candle.low <= trade.stop : candle.high >= trade.stop;
      const targetHit = trade.side === 'long' ? candle.high >= trade.target : candle.low <= trade.target;
      if (stopHit) return closeTrade(trade, trade.stop, Number(candle.time), 'stop', index);
      if (targetHit) return closeTrade(trade, trade.target, Number(candle.time), 'target', index);
    }
    return trade;
  });
}

/**
 * One replay step: fill resting limit orders, then settle every open position.
 * Both happen inside one call so a limit fill and its stop/target can't desync.
 */
export function advanceSession(
  state: { trades: BacktestTrade[]; orders: PendingOrder[] },
  candles: Candle[],
  fromIndex: number,
  toIndex: number,
): { trades: BacktestTrade[]; orders: PendingOrder[] } {
  const start = Math.max(0, fromIndex + 1);
  if (toIndex < start) return state;

  const filled: BacktestTrade[] = [];
  const remaining: PendingOrder[] = [];

  for (const order of state.orders) {
    let filledTrade: BacktestTrade | null = null;
    const scanFrom = Math.max(start, order.createdIndex + 1);
    for (let index = scanFrom; index <= toIndex; index += 1) {
      const candle = candles[index];
      if (!candle) break;
      let fillPrice: number | null = null;
      if (order.side === 'long' && candle.low <= order.price) {
        fillPrice = candle.open <= order.price ? candle.open : order.price;
      } else if (order.side === 'short' && candle.high >= order.price) {
        fillPrice = candle.open >= order.price ? candle.open : order.price;
      }
      if (fillPrice === null) continue;
      filledTrade = {
        id: `${order.id}-fill`,
        side: order.side,
        entry: fillPrice,
        stop: order.stop,
        target: order.target,
        qty: order.qty,
        risk: Math.abs(fillPrice - order.stop) * order.qty,
        entryTime: Number(candle.time),
        entryIndex: index,
        orderType: 'limit',
      };
      break;
    }
    if (filledTrade) filled.push(filledTrade);
    else remaining.push(order);
  }

  const settled = settleTrades([...state.trades, ...filled], candles, start, toIndex);
  return { trades: settled, orders: remaining };
}

/** Close part of a position and keep the remainder open. */
export function partialClose(
  trade: BacktestTrade,
  fraction: number,
  price: number,
  time: number,
  exitIndex?: number,
): { closed: BacktestTrade; remaining: BacktestTrade } {
  const ratio = Math.min(0.95, Math.max(0.05, fraction));
  const partQty = trade.qty * ratio;
  const partRisk = trade.risk * ratio;
  const closed = closeTrade({ ...trade, id: `${trade.id}-partial-${Date.now()}`, qty: partQty, risk: partRisk }, price, time, 'manual', exitIndex);
  const remaining = { ...trade, qty: trade.qty - partQty, risk: trade.risk - partRisk };
  return { closed, remaining };
}

export type BacktestStats = {
  count: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  avgR: number;
  expectancy: number;
  expectancyR: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  best: number;
  worst: number;
  avgBars: number;
  longestWinStreak: number;
  longestLossStreak: number;
  rValues: number[];
  equity: { x: number; value: number }[];
};

export function computeStats(trades: BacktestTrade[], startBalance: number): BacktestStats {
  const closed = trades
    .filter((trade): trade is BacktestTrade & { pnl: number; exitTime: number } => trade.exit !== undefined && trade.pnl !== undefined)
    .sort((a, b) => a.exitTime - b.exitTime);

  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  let rSum = 0;
  let best = 0;
  let worst = 0;
  let equityValue = startBalance;
  let peak = startBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let barsSum = 0;
  let barsCount = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  const rValues: number[] = [];
  const equity: { x: number; value: number }[] = [{ x: 0, value: startBalance }];

  closed.forEach((trade, index) => {
    if (trade.pnl > 0) {
      wins += 1;
      grossProfit += trade.pnl;
      winStreak += 1;
      lossStreak = 0;
    } else if (trade.pnl < 0) {
      losses += 1;
      grossLoss += Math.abs(trade.pnl);
      lossStreak += 1;
      winStreak = 0;
    } else {
      breakEven += 1;
      winStreak = 0;
      lossStreak = 0;
    }
    longestWinStreak = Math.max(longestWinStreak, winStreak);
    longestLossStreak = Math.max(longestLossStreak, lossStreak);
    rSum += trade.rMultiple ?? 0;
    rValues.push(trade.rMultiple ?? 0);
    if (trade.entryIndex !== undefined && trade.exitIndex !== undefined) {
      barsSum += Math.max(1, trade.exitIndex - trade.entryIndex);
      barsCount += 1;
    }
    best = Math.max(best, trade.pnl);
    worst = Math.min(worst, trade.pnl);
    equityValue += trade.pnl;
    peak = Math.max(peak, equityValue);
    const drawdown = peak - equityValue;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;
    }
    equity.push({ x: index + 1, value: equityValue });
  });

  const netPnl = closed.reduce((total, trade) => total + trade.pnl, 0);
  const count = closed.length;

  return {
    count,
    wins,
    losses,
    breakEven,
    winRate: count ? (wins / count) * 100 : 0,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    avgWin: wins ? grossProfit / wins : 0,
    avgLoss: losses ? grossLoss / losses : 0,
    avgR: count ? rSum / count : 0,
    expectancy: count ? netPnl / count : 0,
    expectancyR: count ? rSum / count : 0,
    maxDrawdown,
    maxDrawdownPct,
    best,
    worst,
    avgBars: barsCount ? barsSum / barsCount : 0,
    longestWinStreak,
    longestLossStreak,
    rValues,
    equity,
  };
}
