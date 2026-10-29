import React, { useEffect, useRef, useState } from 'react';

// The real TradingView chart (their free embeddable widget): live gold, every drawing tool and indicator.
export const TradingViewWidget: React.FC<{ className?: string }> = ({ className = 'absolute inset-0' }) => {
  const box = useRef<HTMLDivElement>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    host.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    inner.style.width = '100%';
    host.appendChild(inner);
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async = true;
    s.type = 'text/javascript';
    s.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval: '5',
      timezone: 'Asia/Karachi',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#131722',
      allow_symbol_change: true,
      hide_side_toolbar: false,
      withdateranges: true,
      details: false,
      hotlist: false,
      calendar: false,
      save_image: true,
      support_host: 'https://www.tradingview.com',
    });
    host.appendChild(s);
    const t = window.setTimeout(() => setSlow(true), 8000);
    const watch = window.setInterval(() => {
      if (host.querySelector('iframe')) { setSlow(false); window.clearTimeout(t); window.clearInterval(watch); }
    }, 500);
    return () => { window.clearTimeout(t); window.clearInterval(watch); host.innerHTML = ''; };
  }, []);

  return (
    <div className={`bg-[#131722] ${className}`}>
      <div ref={box} className="tradingview-widget-container absolute inset-0" />
      {slow && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-slate-300 p-6 pointer-events-none">
          The chart is taking a while to load. If it never appears, an ad-blocker or network filter may be blocking TradingView.
        </div>
      )}
    </div>
  );
};

const LiveChartView: React.FC = () => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[26px] sm:text-[30px] leading-tight font-medium tracking-tight text-black">📈 Live Chart</h2>
          <p className="text-xs text-slate-500">The real TradingView chart — live gold with all drawing tools and indicators.</p>
        </div>
        <a href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD" target="_blank" rel="noreferrer" className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white">Open on TradingView ↗</a>
      </div>
      <div className="relative rounded-[1.5rem] overflow-hidden border border-[#2a2e39] h-[calc(100vh-190px)] min-h-[480px]">
        <TradingViewWidget />
      </div>
      <p className="text-[11px] text-slate-400">Chart and prices by TradingView. For analysis only — not financial advice.</p>
    </div>
  );
};

export default LiveChartView;
