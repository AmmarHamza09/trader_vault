import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Logical,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import {
  bollingerSeries,
  emaSeries,
  heikinAshi,
  macdSeries,
  rsiSeries,
  stochRsiSeries,
  toLine,
  vwapSeries,
  type BacktestTrade,
  type Candle,
  type PendingOrder,
  type Side,
} from './engine';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type ChartType = 'candles' | 'hollow' | 'heikin' | 'bars' | 'line' | 'area';

export type ChartOverlays = {
  ema1: boolean;
  ema2: boolean;
  ema3: boolean;
  ema4: boolean;
  vwap: boolean;
  bollinger: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
  stoch: boolean;
};

export type IndicatorPeriods = {
  ema1: number;
  ema2: number;
  ema3: number;
  ema4: number;
  bbLength: number;
  bbMult: number;
  rsiLength: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  stochLength: number;
  stochK: number;
  stochD: number;
  atrLength: number;
};

export type ChartSettings = {
  grid: boolean;
  logScale: boolean;
  lastPriceLine: boolean;
};

export type DrawingTool = 'cursor' | 'crosshair' | 'trend' | 'hline' | 'ray' | 'rect' | 'fib' | 'measure' | 'eraser';

export type DrawPoint = { logical: number; price: number };

export type Drawing =
  | { id: string; type: 'hline'; price: number }
  | { id: string; type: 'trend' | 'ray' | 'rect' | 'measure' | 'fib'; a: DrawPoint; b: DrawPoint };

export type OpenPosition = { side: Side; entry: number; stop: number; target: number };

type ChartProps = {
  candles: Candle[];
  cursor: number;
  digits: number;
  chartType: ChartType;
  overlays: ChartOverlays;
  periods: IndicatorPeriods;
  settings: ChartSettings;
  trades: BacktestTrade[];
  position: OpenPosition | null;
  orders: PendingOrder[];
  drawings: Drawing[];
  tool: DrawingTool;
  magnet: boolean;
  screenshotSignal: number;
  screenshotName: string;
  onAddDrawing: (drawing: Drawing) => void;
  onDeleteDrawing: (id: string) => void;
};

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

/* TradingView dark palette */
const UP = '#26a69a';
const DOWN = '#ef5350';
const GRID = '#1e222d';
const BORDER = '#2a2e39';
const TEXT = '#d1d4dc';
const ACCENT = '#2962ff';
const EMA_COLORS = ['#2962ff', '#ff9800', '#e91e63', '#9c27b0'];
const DRAW_COLOR = '#2962ff';
const MEASURE_COLOR = '#2962ff';
const FIB_COLOR = '#2962ff';

type PriceSeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Line'> | ISeriesApi<'Area'>;

type SeriesBag = {
  candles: ISeriesApi<'Candlestick'>;
  bars: ISeriesApi<'Bar'>;
  line: ISeriesApi<'Line'>;
  area: ISeriesApi<'Area'>;
  volume: ISeriesApi<'Histogram'>;
  ema: ISeriesApi<'Line'>[];
  vwap: ISeriesApi<'Line'>;
  bbUpper: ISeriesApi<'Line'>;
  bbMiddle: ISeriesApi<'Line'>;
  bbLower: ISeriesApi<'Line'>;
  rsi: ISeriesApi<'Line'> | null;
  macdLine: ISeriesApi<'Line'> | null;
  macdSignal: ISeriesApi<'Line'> | null;
  macdHist: ISeriesApi<'Histogram'> | null;
  stochK: ISeriesApi<'Line'> | null;
  stochD: ISeriesApi<'Line'> | null;
  markers: ISeriesMarkersPluginApi<Time>[];
};

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const BacktestChart: React.FC<ChartProps> = ({
  candles,
  cursor,
  digits,
  chartType,
  overlays,
  periods,
  settings,
  trades,
  position,
  orders,
  drawings,
  tool,
  magnet,
  screenshotSignal,
  screenshotName,
  onAddDrawing,
  onDeleteDrawing,
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<SeriesBag | null>(null);
  const priceLinesRef = useRef<{ series: PriceSeries; line: IPriceLine }[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [tick, setTick] = useState(0);
  const [paneTops, setPaneTops] = useState<number[]>([]);
  const dataRef = useRef<{ candles: Candle[]; cursor: number }>({ candles, cursor });
  const typeRef = useRef(chartType);
  dataRef.current = { candles, cursor };
  typeRef.current = chartType;

  const activeSeries = (): PriceSeries | null => {
    const bag = seriesRef.current;
    if (!bag) return null;
    if (typeRef.current === 'bars') return bag.bars;
    if (typeRef.current === 'line') return bag.line;
    if (typeRef.current === 'area') return bag.area;
    return bag.candles;
  };

  /** Keep study panes readable using relative stretch factors (survives resizes). */
  const syncPaneHeights = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const panes = chart.panes();
    if (!panes.length) return;
    panes[0].setStretchFactor(panes.length > 1 ? 3.6 : 1);
    for (let index = 1; index < panes.length; index += 1) panes[index].setStretchFactor(1);
    measurePanes();
  };

  /** Track each study pane's top offset so legends can sit inside them. */
  const measurePanes = (attempt = 0) => {
    const chart = chartRef.current;
    if (!chart) return;
    const heights = chart.panes().map((pane) => pane.getHeight());
    // Panes that were just added report 0 until the chart has laid them out.
    if (heights.some((height) => !(height > 0))) {
      if (attempt < 8) window.requestAnimationFrame(() => measurePanes(attempt + 1));
      return;
    }
    let offset = 0;
    const tops = heights.map((height) => {
      const top = offset;
      offset += height + 1;
      return top;
    });
    setPaneTops((previous) => (previous.length === tops.length && previous.every((value, index) => value === tops[index]) ? previous : tops));
  };

  /* ---------- create chart once ---------- */
  useEffect(() => {
    const host = hostRef.current;
    const outer = outerRef.current;
    if (!host || !outer) return;

    const chart = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: TEXT,
        fontFamily: '"Trebuchet MS", Roboto, Ubuntu, -apple-system, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#363a45' },
        horzLine: { color: '#758696', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#363a45' },
      },
      rightPriceScale: {
        borderColor: BORDER,
        scaleMargins: { top: 0.08, bottom: 0.24 },
        entireTextOnly: true,
      },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 7 },
      localization: {
        priceFormatter: (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
      },
    });

    const priceFormat = { type: 'price' as const, precision: digits, minMove: 10 ** -digits };
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat,
    });
    const barSeries = chart.addSeries(BarSeries, {
      upColor: UP,
      downColor: DOWN,
      thinBars: false,
      priceFormat,
      visible: false,
    });
    const lineSeries = chart.addSeries(LineSeries, {
      color: ACCENT,
      lineWidth: 2,
      priceFormat,
      visible: false,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
    });
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: ACCENT,
      topColor: 'rgba(41,98,255,.26)',
      bottomColor: 'rgba(41,98,255,.02)',
      lineWidth: 2,
      priceFormat,
      visible: false,
      priceLineVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    const lineBase = { priceLineVisible: false, crosshairMarkerVisible: false, priceFormat, lineWidth: 2 as const, lastValueVisible: false };
    const ema = EMA_COLORS.map((color, index) =>
      chart.addSeries(LineSeries, { ...lineBase, color, lineWidth: 2 as const, title: `EMA ${index + 1}` }),
    );
    const vwap = chart.addSeries(LineSeries, { ...lineBase, color: '#00bcd4', lineWidth: 2, lineStyle: LineStyle.Dashed, title: 'VWAP' });
    const bbUpper = chart.addSeries(LineSeries, { ...lineBase, color: 'rgba(120,123,134,.75)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB upper' });
    const bbMiddle = chart.addSeries(LineSeries, { ...lineBase, color: 'rgba(120,123,134,.55)', lineWidth: 1, title: 'BB basis' });
    const bbLower = chart.addSeries(LineSeries, { ...lineBase, color: 'rgba(120,123,134,.75)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB lower' });

    seriesRef.current = {
      candles: candleSeries,
      bars: barSeries,
      line: lineSeries,
      area: areaSeries,
      volume: volumeSeries,
      ema,
      vwap,
      bbUpper,
      bbMiddle,
      bbLower,
      rsi: null,
      macdLine: null,
      macdSignal: null,
      macdHist: null,
      stochK: null,
      stochD: null,
      markers: [
        createSeriesMarkers(candleSeries, []),
        createSeriesMarkers(barSeries, []),
        createSeriesMarkers(lineSeries, []),
        createSeriesMarkers(areaSeries, []),
      ],
    };
    chartRef.current = chart;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      chart.applyOptions({ width, height });
      setSize({ width, height });
      setTick((value) => value + 1);
      syncPaneHeights();
    });
    observer.observe(outer);

    const onRange = () => setTick((value) => value + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    chart.timeScale().subscribeSizeChange(onRange);

    return () => {
      observer.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.timeScale().unsubscribeSizeChange(onRange);
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [digits]);

  /* ---------- chart type ---------- */
  useEffect(() => {
    const bag = seriesRef.current;
    if (!bag) return;
    const showCandles = chartType === 'candles' || chartType === 'hollow' || chartType === 'heikin';
    bag.candles.applyOptions({
      visible: showCandles,
      upColor: chartType === 'hollow' ? 'rgba(0,0,0,0)' : UP,
      downColor: chartType === 'hollow' ? 'rgba(0,0,0,0)' : DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    bag.bars.applyOptions({ visible: chartType === 'bars' });
    bag.line.applyOptions({ visible: chartType === 'line' });
    bag.area.applyOptions({ visible: chartType === 'area' });
    setTick((value) => value + 1);
  }, [chartType]);

  /* ---------- chart settings ---------- */
  useEffect(() => {
    const chart = chartRef.current;
    const bag = seriesRef.current;
    if (!chart || !bag) return;
    chart.applyOptions({
      grid: { vertLines: { visible: settings.grid }, horzLines: { visible: settings.grid } },
      rightPriceScale: { mode: settings.logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal },
    });
    for (const series of [bag.candles, bag.bars, bag.line, bag.area]) {
      series.applyOptions({ priceLineVisible: settings.lastPriceLine, lastValueVisible: settings.lastPriceLine });
    }
    bag.candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: overlays.volume ? 0.24 : 0.06 } });
  }, [settings, overlays.volume]);

  /* ---------- overlay visibility ---------- */
  useEffect(() => {
    const bag = seriesRef.current;
    if (!bag) return;
    bag.ema.forEach((series, index) => series.applyOptions({ visible: overlays[`ema${index + 1}` as 'ema1' | 'ema2' | 'ema3' | 'ema4'] }));
    bag.vwap.applyOptions({ visible: overlays.vwap });
    bag.bbUpper.applyOptions({ visible: overlays.bollinger });
    bag.bbMiddle.applyOptions({ visible: overlays.bollinger });
    bag.bbLower.applyOptions({ visible: overlays.bollinger });
    bag.volume.applyOptions({ visible: overlays.volume });
    bag.candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: overlays.volume ? 0.24 : 0.06 } });
  }, [overlays]);

  /* ---------- study panes ---------- */
  useEffect(() => {
    const chart = chartRef.current;
    const bag = seriesRef.current;
    if (!chart || !bag) return;

    while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1);
    bag.rsi = null;
    bag.macdLine = null;
    bag.macdSignal = null;
    bag.macdHist = null;
    bag.stochK = null;
    bag.stochD = null;

    if (overlays.rsi) {
      const pane = chart.addPane();
      const index = pane.paneIndex();
      const rsi = chart.addSeries(
        LineSeries,
        { color: '#7e57c2', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 0, minMove: 1 } },
        index,
      );
      rsi.createPriceLine({ price: 70, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
      rsi.createPriceLine({ price: 30, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' });
      bag.rsi = rsi;
    }
    if (overlays.macd) {
      const pane = chart.addPane();
      const index = pane.paneIndex();
      const hist = chart.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } },
        index,
      );
      const line = chart.addSeries(
        LineSeries,
        { color: '#2962ff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } },
        index,
      );
      const signal = chart.addSeries(
        LineSeries,
        { color: '#ff6d00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } },
        index,
      );
      line.createPriceLine({ price: 0, color: 'rgba(120,123,134,.45)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      bag.macdHist = hist;
      bag.macdLine = line;
      bag.macdSignal = signal;
    }
    if (overlays.stoch) {
      const pane = chart.addPane();
      const index = pane.paneIndex();
      const k = chart.addSeries(
        LineSeries,
        { color: '#2962ff', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 0, minMove: 1 } },
        index,
      );
      const d = chart.addSeries(
        LineSeries,
        { color: '#ff6d00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 0, minMove: 1 } },
        index,
      );
      k.createPriceLine({ price: 80, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '80' });
      k.createPriceLine({ price: 20, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '20' });
      bag.stochK = k;
      bag.stochD = d;
    }

    const studyPanes = chart.panes();
    for (let index = 1; index < studyPanes.length; index += 1) {
      studyPanes[index].setStretchFactor(1);
    }
    applyStudyData();
    syncPaneHeights();
    setTick((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays.rsi, overlays.macd, overlays.stoch, periods.rsiLength, periods.macdFast, periods.macdSlow, periods.macdSignal, periods.stochLength, periods.stochK, periods.stochD]);

  const applyStudyData = () => {
    const bag = seriesRef.current;
    if (!bag) return;
    const { candles: all, cursor: at } = dataRef.current;
    const visible = all.slice(0, at + 1);
    if (!visible.length) return;
    if (bag.rsi) bag.rsi.setData(toLine(visible, rsiSeries(visible, periods.rsiLength)));
    if (bag.macdLine && bag.macdSignal && bag.macdHist) {
      const macd = macdSeries(visible, periods.macdFast, periods.macdSlow, periods.macdSignal);
      bag.macdLine.setData(toLine(visible, macd.macd));
      bag.macdSignal.setData(toLine(visible, macd.signal));
      bag.macdHist.setData(
        visible.flatMap((candle, index) => {
          const value = macd.histogram[index];
          if (value === null || !Number.isFinite(value)) return [];
          return [{ time: candle.time, value, color: value >= 0 ? 'rgba(38,166,154,.5)' : 'rgba(239,83,80,.5)' }];
        }),
      );
    }
    if (bag.stochK && bag.stochD) {
      const stoch = stochRsiSeries(visible, periods.rsiLength, periods.stochLength, periods.stochK, periods.stochD);
      bag.stochK.setData(toLine(visible, stoch.k));
      bag.stochD.setData(toLine(visible, stoch.d));
    }
  };

  /* ---------- data + markers ---------- */
  useEffect(() => {
    const bag = seriesRef.current;
    const chart = chartRef.current;
    if (!bag || !chart) return;
    const visible = candles.slice(0, cursor + 1);
    if (!visible.length) return;

    const ohlc = chartType === 'heikin' ? heikinAshi(visible) : visible;
    bag.candles.setData(ohlc as CandlestickData<UTCTimestamp>[]);
    bag.bars.setData(ohlc as CandlestickData<UTCTimestamp>[]);
    bag.line.setData(ohlc.map((candle) => ({ time: candle.time, value: candle.close })));
    bag.area.setData(ohlc.map((candle) => ({ time: candle.time, value: candle.close })));

    bag.volume.setData(
      visible.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(38,166,154,.45)' : 'rgba(239,83,80,.45)',
      })),
    );
    bag.ema[0].setData(toLine(visible, emaSeries(visible, periods.ema1)));
    bag.ema[1].setData(toLine(visible, emaSeries(visible, periods.ema2)));
    bag.ema[2].setData(toLine(visible, emaSeries(visible, periods.ema3)));
    bag.ema[3].setData(toLine(visible, emaSeries(visible, periods.ema4)));
    bag.vwap.setData(toLine(visible, vwapSeries(visible)));
    const bands = bollingerSeries(visible, periods.bbLength, periods.bbMult);
    bag.bbUpper.setData(toLine(visible, bands.upper));
    bag.bbMiddle.setData(toLine(visible, bands.middle));
    bag.bbLower.setData(toLine(visible, bands.lower));
    applyStudyData();

    const lastVisible = Number(visible[visible.length - 1].time);
    const markers: SeriesMarker<Time>[] = [];
    trades.forEach((trade) => {
      if (trade.entryTime <= lastVisible) {
        markers.push({
          time: trade.entryTime as UTCTimestamp,
          position: trade.side === 'long' ? 'belowBar' : 'aboveBar',
          color: trade.side === 'long' ? UP : DOWN,
          shape: trade.side === 'long' ? 'arrowUp' : 'arrowDown',
          text: trade.side === 'long' ? 'Long' : 'Short',
        });
      }
      if (trade.exitTime !== undefined && trade.exitTime <= lastVisible && trade.exit !== undefined) {
        markers.push({
          time: trade.exitTime as UTCTimestamp,
          position: (trade.pnl ?? 0) >= 0 ? 'aboveBar' : 'belowBar',
          color: (trade.pnl ?? 0) >= 0 ? UP : DOWN,
          shape: 'circle',
          text: `${(trade.pnl ?? 0) >= 0 ? '+' : '-'}$${Math.abs(trade.pnl ?? 0).toFixed(0)}`,
        });
      }
    });
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    bag.markers.forEach((plugin) => plugin.setMarkers(markers));

    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, cursor - 96), to: cursor + 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, cursor, trades, chartType, periods]);

  /* ---------- price levels (position + resting orders) ---------- */
  useEffect(() => {
    const bag = seriesRef.current;
    if (!bag) return;
    priceLinesRef.current.forEach(({ series, line }) => series.removePriceLine(line));
    priceLinesRef.current = [];

    const levels: { price: number; color: string; title: string; style: LineStyle }[] = [];
    if (position) {
      levels.push(
        { price: position.entry, color: '#2962ff', title: 'Entry', style: LineStyle.Dotted },
        { price: position.stop, color: DOWN, title: 'Stop', style: LineStyle.Dashed },
        { price: position.target, color: UP, title: 'Target', style: LineStyle.Dashed },
      );
    }
    orders.forEach((order) =>
      levels.push({ price: order.price, color: '#2962ff', title: `${order.side === 'long' ? 'Buy' : 'Sell'} limit`, style: LineStyle.Dotted }),
    );
    if (!levels.length) return;

    const all: PriceSeries[] = [bag.candles, bag.bars, bag.line, bag.area];
    for (const series of all) {
      for (const level of levels) {
        const line = series.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 1,
          lineStyle: level.style,
          axisLabelVisible: true,
          title: level.title,
        });
        priceLinesRef.current.push({ series, line });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, orders, digits]);

  /* ---------- screenshot ---------- */
  useEffect(() => {
    if (!screenshotSignal) return;
    const chart = chartRef.current;
    if (!chart) return;
    const canvas = chart.takeScreenshot();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${screenshotName.replace(/[^\w.-]+/g, '-')}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [screenshotSignal, screenshotName]);

  /* ---------- drawing helpers ---------- */
  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>): DrawPoint | null => {
    const chart = chartRef.current;
    const series = activeSeries();
    const overlay = event.currentTarget;
    if (!chart || !series) return null;
    const rect = overlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    if (logical === null || price === null) return null;

    let snapped = Number(price);
    if (magnet) {
      const index = Math.max(0, Math.min(candles.length - 1, Math.round(Number(logical))));
      const candle = candles[index];
      if (candle) {
        const choices = [candle.open, candle.high, candle.low, candle.close];
        snapped = choices.reduce((best, value) => (Math.abs(value - snapped) < Math.abs(best - snapped) ? value : best), choices[0]);
      }
    }
    return { logical: Number(logical), price: snapped };
  };

  const toXY = (point: DrawPoint): { x: number; y: number } | null => {
    const chart = chartRef.current;
    const series = activeSeries();
    if (!chart || !series) return null;
    const x = chart.timeScale().logicalToCoordinate(point.logical as Logical);
    const y = series.priceToCoordinate(point.price);
    if (x === null || y === null) return null;
    return { x: Number(x), y: Number(y) };
  };

  const distanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  const findDrawingAt = (x: number, y: number): string | null => {
    const series = activeSeries();
    if (!series) return null;
    for (const drawing of [...drawings].reverse()) {
      if (drawing.type === 'hline') {
        const lineY = series.priceToCoordinate(drawing.price);
        if (lineY !== null && Math.abs(y - Number(lineY)) < 8) return drawing.id;
        continue;
      }
      const a = toXY(drawing.a);
      const b = toXY(drawing.b);
      if (!a || !b) continue;
      if (drawing.type === 'rect' || drawing.type === 'measure') {
        if (x >= Math.min(a.x, b.x) - 4 && x <= Math.max(a.x, b.x) + 4 && y >= Math.min(a.y, b.y) - 4 && y <= Math.max(a.y, b.y) + 4) {
          return drawing.id;
        }
      }
      if (distanceToSegment(x, y, a.x, a.y, b.x, b.y) < 8) return drawing.id;
    }
    return null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'cursor' || tool === 'crosshair') return;
    event.preventDefault();
    const point = pointFromEvent(event);
    if (!point) return;
    if (tool === 'eraser') {
      const rect = event.currentTarget.getBoundingClientRect();
      const id = findDrawingAt(event.clientX - rect.left, event.clientY - rect.top);
      if (id) onDeleteDrawing(id);
      return;
    }
    if (tool === 'hline') {
      onAddDrawing({ id: uid(), type: 'hline', price: point.price });
      return;
    }
    setDraft({ id: uid(), type: tool, a: point, b: point });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const point = pointFromEvent(event);
    if (!point) return;
    setDraft((current) => (current && current.type !== 'hline' ? { ...current, b: point } : current));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft || draft.type === 'hline') return;
    const point = pointFromEvent(event);
    const final = point ? { ...draft, b: point } : draft;
    const a = toXY(final.a);
    const b = toXY(final.b);
    setDraft(null);
    if (!a || !b) return;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 6) return;
    onAddDrawing(final);
  };

  /* ---------- drawing rendering ---------- */
  const plotWidth = chartRef.current?.timeScale().width() ?? size.width;
  const renderDrawing = (drawing: Drawing) => {
    const priceLabel = (price: number) => price.toFixed(digits);
    if (drawing.type === 'hline') {
      const series = activeSeries();
      const y = series?.priceToCoordinate(drawing.price);
      if (y === null || y === undefined) return null;
      return (
        <g key={drawing.id}>
          <line x1={0} x2={plotWidth} y1={Number(y)} y2={Number(y)} stroke={DRAW_COLOR} strokeWidth={1} strokeDasharray="6 4" />
          <rect x={Math.max(4, plotWidth - 74)} y={Number(y) - 9} width={70} height={18} rx={2} fill="#363a45" stroke="#2a2e39" />
          <text x={Math.max(4, plotWidth - 74) + 35} y={Number(y) + 4} textAnchor="middle" fill="#d1d4dc" fontSize={10} fontFamily='"Trebuchet MS", Roboto, Ubuntu, sans-serif'>
            {priceLabel(drawing.price)}
          </text>
        </g>
      );
    }

    const a = toXY(drawing.a);
    const b = toXY(drawing.b);
    if (!a || !b) return null;
    const color = drawing.type === 'measure' ? MEASURE_COLOR : drawing.type === 'fib' ? FIB_COLOR : DRAW_COLOR;

    if (drawing.type === 'rect' || drawing.type === 'measure') {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const width = Math.abs(b.x - a.x);
      const height = Math.abs(b.y - a.y);
      const delta = drawing.b.price - drawing.a.price;
      const pct = drawing.a.price !== 0 ? (delta / drawing.a.price) * 100 : 0;
      const bars = Math.round(Math.abs(drawing.b.logical - drawing.a.logical));
      const label = drawing.type === 'measure' ? `${delta >= 0 ? '+' : ''}${priceLabel(delta)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%) · ${bars} bars` : null;
      const labelWidth = label ? Math.max(96, label.length * 5.6 + 14) : 0;
      const labelX = Math.min(Math.max(6, b.x + 8), plotWidth - labelWidth - 6);
      return (
        <g key={drawing.id}>
          <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.1} stroke={color} strokeWidth={1} strokeDasharray={drawing.type === 'measure' ? '5 4' : undefined} />
          {label && (
            <g>
              <rect x={labelX} y={b.y - 24} width={labelWidth} height={18} rx={2} fill="#363a45" stroke={color} strokeOpacity={0.6} />
              <text x={labelX + 7} y={b.y - 11} fill="#d1d4dc" fontSize={10} fontFamily='"Trebuchet MS", Roboto, Ubuntu, sans-serif'>{label}</text>
            </g>
          )}
        </g>
      );
    }

    if (drawing.type === 'fib') {
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      const x1 = Math.min(a.x, b.x);
      return (
        <g key={drawing.id}>
          {levels.map((level) => {
            const price = drawing.a.price + (drawing.b.price - drawing.a.price) * level;
            const y = activeSeries()?.priceToCoordinate(price);
            if (y === null || y === undefined) return null;
            return (
              <g key={level}>
                <line x1={x1} x2={plotWidth} y1={Number(y)} y2={Number(y)} stroke={color} strokeWidth={1} strokeOpacity={level === 0 || level === 1 ? 0.9 : 0.55} />
                <text x={x1 + 4} y={Number(y) - 3} fill="#d1d4dc" fontSize={9} fontFamily='"Trebuchet MS", Roboto, Ubuntu, sans-serif'>
                  {level.toFixed(3)} · {priceLabel(price)}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    // trend line / ray
    let end = b;
    if (drawing.type === 'ray') {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > 0.001) {
        const t = dx > 0 ? (plotWidth - a.x) / dx : (0 - a.x) / dx;
        end = { x: a.x + dx * t, y: a.y + dy * t };
      }
    }
    return (
      <g key={drawing.id}>
        <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={1.5} />
        <circle cx={a.x} cy={a.y} r={3} fill={color} />
        <circle cx={b.x} cy={b.y} r={3} fill={color} fillOpacity={drawing.type === 'ray' ? 0.35 : 1} />
      </g>
    );
  };

  const draftVisible = draft && draft.type !== 'hline' ? draft : null;

  /* ---------- study pane legends ---------- */
  const studyLegends = useMemo(() => {
    const visible = candles.slice(0, cursor + 1);
    const lastOf = (series: (number | null)[]) => {
      for (let index = series.length - 1; index >= 0; index -= 1) if (series[index] !== null) return series[index] as number;
      return null;
    };
    const rows: { key: string; label: string; values: { text: string; color?: string }[]; color: string }[] = [];
    if (overlays.rsi) {
      rows.push({
        key: 'rsi',
        label: `RSI ${periods.rsiLength}`,
        values: [{ text: (lastOf(rsiSeries(visible, periods.rsiLength)) ?? NaN).toFixed(2) }],
        color: '#7e57c2',
      });
    }
    if (overlays.macd) {
      const macd = macdSeries(visible, periods.macdFast, periods.macdSlow, periods.macdSignal);
      rows.push({
        key: 'macd',
        label: `MACD ${periods.macdFast} ${periods.macdSlow} ${periods.macdSignal}`,
        values: [
          { text: (lastOf(macd.macd) ?? NaN).toFixed(2), color: '#2962ff' },
          { text: (lastOf(macd.signal) ?? NaN).toFixed(2), color: '#ff6d00' },
        ],
        color: '#2962ff',
      });
    }
    if (overlays.stoch) {
      const stoch = stochRsiSeries(visible, periods.rsiLength, periods.stochLength, periods.stochK, periods.stochD);
      rows.push({
        key: 'stoch',
        label: `Stoch RSI ${periods.stochLength} ${periods.stochK} ${periods.stochD}`,
        values: [
          { text: (lastOf(stoch.k) ?? NaN).toFixed(2), color: '#2962ff' },
          { text: (lastOf(stoch.d) ?? NaN).toFixed(2), color: '#ff6d00' },
        ],
        color: '#2962ff',
      });
    }
    return rows;
  }, [candles, cursor, overlays.rsi, overlays.macd, overlays.stoch, periods]);

  /* ---------- cursor label ---------- */
  const overlayActive = tool !== 'cursor' && tool !== 'crosshair';

  return (
    <div ref={outerRef} className="relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" />
      <div
        className={`absolute inset-0 z-10 ${overlayActive ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ cursor: overlayActive ? (tool === 'eraser' ? 'not-allowed' : 'crosshair') : undefined, touchAction: overlayActive ? 'none' : undefined }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setDraft(null)}
      >
        <svg width={size.width} height={size.height} className="block">
          {drawings.map(renderDrawing)}
          {draftVisible && renderDrawing(draftVisible)}
        </svg>
        {studyLegends.map((row, index) => {
          const top = paneTops[index + 1];
          if (top === undefined) return null;
          return (
            <div key={row.key} className="pointer-events-none absolute left-3 z-20 flex items-center gap-1.5 text-[10px] leading-none" style={{ top: top + 5 }}>
              <span className="h-[2px] w-3 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="text-[#d1d4dc]">{row.label}</span>
              {row.values.map((value, valueIndex) => (
                <span key={valueIndex} style={{ color: value.color ?? '#d1d4dc' }} className="tabular-nums">{value.text}</span>
              ))}
            </div>
          );
        })}

        {overlayActive && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded border border-[#2a2e39] bg-[#1e222d]/95 px-3 py-1 text-[10px] text-[#d1d4dc] shadow-lg">
            {tool === 'eraser'
              ? 'Click a drawing to remove it'
              : tool === 'hline'
                ? 'Click to place a horizontal price line'
                : 'Drag on the chart to draw · Esc to cancel'}
          </div>
        )}
      </div>
      <span className="hidden">{tick}</span>
    </div>
  );
};
