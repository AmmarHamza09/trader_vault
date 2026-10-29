import React from 'react';

// Whole Backtesting tab is hidden for now: just a big "Coming soon".
export const ComingSoon: React.FC = () => (
  <div className="min-h-[70vh] flex items-center justify-center py-6">
    <div className="relative overflow-hidden w-full max-w-4xl rounded-[2.5rem] bg-black text-white px-6 py-16 sm:py-24 text-center">
      <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-emerald-500/25 blur-3xl" />
      <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative space-y-4">
        <div className="text-6xl sm:text-7xl">🧪</div>
        <h2 className="text-[56px] sm:text-[104px] leading-[0.95] font-semibold tracking-tight">
          Coming <span className="text-emerald-400">soon</span>
        </h2>
        <p className="text-base sm:text-xl font-light text-white/60">Something big is on its way 🚀</p>
      </div>
    </div>
  </div>
);
