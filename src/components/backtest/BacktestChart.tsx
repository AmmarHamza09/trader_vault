import React, { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import {
  atrSeries,
  bollingerSeries,
  emaSeries,
  rsiSeries,
  toLine,
  type BacktestTrade,
  type Candle,
  type Side,
} from './engine';

export type ChartOverlays = {
  ema9: boolean;
  ema21: boolean;
  ema50: boolean;
  bollinger: boolean;
  volume: boolean;
  rsi: boolean;
};

export type OpenPosition = { side: Side; entry: number; stop: number; target: number };

type ChartProps = {
  candles: Candle[];
  cursor: number;
  digits: number;
  overlays: ChartOverlays;
  trades: BacktestTrade[];
  position: OpenPosition | null;
};

type SeriesBag = {
  candles: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  ema9: ISeriesApi<'Line'>;
  ema21: ISeriesApi<'Line'>;
  ema50: ISeriesApi<'Line'>;
  bbUpper: ISeriesApi<'Line'>;
  bbMiddle: ISeriesApi<'Line'>;
  bbLower: ISeriesApi<'Line'>;
  rsi: ISeriesApi<'Line'> | null;
  markers: ISeriesMarkersPluginApi<Time>;
};

const UP = '#22c98a';
const DOWN = '#f05b70';
const GRID = 'rgba(148,163,184,0.07)';
const BORDER = 'rgba(148,163,184,0.12)';

export const BacktestChart: React.FC<ChartProps> = ({ candles, cursor, digits, overlays, trades, position }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<SeriesBag | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  /* ---------- create chart once ---------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0c111a' },
        textColor: '#94a3b8',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11,
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(148,163,184,.28)', labelBackgroundColor: '#1e293b' },
        horzLine: { color: 'rgba(148,163,184,.28)', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false, rightOffset: 6 },
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

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    const lineBase = { priceLineVisible: false, crosshairMarkerVisible: false, priceFormat, lineWidth: 2 as const };
    const ema9 = chart.addSeries(LineSeries, { ...lineBase, color: '#38bdf8', lineWidth: 2, title: 'EMA 9' });
    const ema21 = chart.addSeries(LineSeries, { ...lineBase, color: '#f59e0b', lineWidth: 2, title: 'EMA 21' });
    const ema50 = chart.addSeries(LineSeries, { ...lineBase, color: '#a78bfa', lineWidth: 2, title: 'EMA 50' });
    const bbUpper = chart.addSeries(LineSeries, { ...lineBase, color: 'rgba(148,163,184,.55)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB upper' });
    const bbMiddle = chart.addSeries(LineSeries, { ...lineBase, color: 'rgba(148,163,184,.35)', lineWidth: 1, title: 'BB basis' });
    const bbLower = chart.addSeries(LineSeries, { ...lineBase, color: 'rgba(148,163,184,.55)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB lower' });

    chartRef.current = chart;
    seriesRef.current = {
      candles: candleSeries,
      volume: volumeSeries,
      ema9,
      ema21,
      ema50,
      bbUpper,
      bbMiddle,
      bbLower,
      rsi: null,
      markers: createSeriesMarkers(candleSeries, []),
    };

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || !chartRef.current) return;
      chartRef.current.applyOptions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [digits]);

  /* ---------- indicator visibility ---------- */
  useEffect(() => {
    const bag = seriesRef.current;
    if (!bag) return;
    bag.ema9.applyOptions({ visible: overlays.ema9 });
    bag.ema21.applyOptions({ visible: overlays.ema21 });
    bag.ema50.applyOptions({ visible: overlays.ema50 });
    bag.bbUpper.applyOptions({ visible: overlays.bollinger });
    bag.bbMiddle.applyOptions({ visible: overlays.bollinger });
    bag.bbLower.applyOptions({ visible: overlays.bollinger });
    bag.volume.applyOptions({ visible: overlays.volume });
    bag.candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: overlays.volume ? 0.24 : 0.06 } });
  }, [overlays]);

  /* ---------- RSI pane (created on demand) ---------- */
  useEffect(() => {
    const chart = chartRef.current;
    const bag = seriesRef.current;
    if (!chart || !bag) return;

    if (overlays.rsi && !bag.rsi) {
      chart.addPane();
      const rsi = chart.addSeries(
        LineSeries,
        {
          color: '#c084fc',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'price', precision: 0, minMove: 1 },
        },
        1,
      );
      rsi.createPriceLine({ price: 70, color: 'rgba(240,91,112,.45)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
      rsi.createPriceLine({ price: 30, color: 'rgba(34,201,138,.45)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
      bag.rsi = rsi;
    } else if (!overlays.rsi && bag.rsi) {
      chart.removeSeries(bag.rsi);
      bag.rsi = null;
      if (chart.panes().length > 1) chart.removePane(1);
    }
  }, [overlays.rsi]);

  /* ---------- data ---------- */
  useEffect(() => {
    const bag = seriesRef.current;
    const chart = chartRef.current;
    if (!bag || !chart) return;
    const visible = candles.slice(0, cursor + 1);
    if (!visible.length) return;

    bag.candles.setData(visible as CandlestickData<UTCTimestamp>[]);
    bag.volume.setData(
      visible.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(34,201,138,.32)' : 'rgba(240,91,112,.32)',
      })),
    );
    bag.ema9.setData(toLine(visible, emaSeries(visible, 9)));
    bag.ema21.setData(toLine(visible, emaSeries(visible, 21)));
    bag.ema50.setData(toLine(visible, emaSeries(visible, 50)));
    const bands = bollingerSeries(visible, 20, 2);
    bag.bbUpper.setData(toLine(visible, bands.upper));
    bag.bbMiddle.setData(toLine(visible, bands.middle));
    bag.bbLower.setData(toLine(visible, bands.lower));
    bag.rsi?.setData(toLine(visible, rsiSeries(visible, 14)));

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
    bag.markers.setMarkers(markers);

    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, cursor - 96), to: cursor + 8 });
  }, [candles, cursor, trades, overlays.rsi, digits]);

  /* ---------- open position levels ---------- */
  useEffect(() => {
    const bag = seriesRef.current;
    if (!bag) return;
    priceLinesRef.current.forEach((line) => bag.candles.removePriceLine(line));
    priceLinesRef.current = [];

    if (!position) return;
    const makeLine = (price: number, color: string, title: string, style: LineStyle) =>
      bag.candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
    priceLinesRef.current = [
      makeLine(position.entry, 'rgba(226,232,240,.75)', 'Entry', LineStyle.Dotted),
      makeLine(position.stop, DOWN, 'Stop', LineStyle.Dashed),
      makeLine(position.target, UP, 'Target', LineStyle.Dashed),
    ];
  }, [position, digits]);

  return <div ref={hostRef} className="h-full w-full" />;
};
