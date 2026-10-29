import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain,
  ShieldCheck,
  Calendar,
  Layers,
  Clock,
  Compass,
  AlertTriangle,
  Smile,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Trade, TraderStats } from '../../types';
import {
  buildCategoryBreakdown,
  buildPlanAdherenceComparison,
} from '../../lib/calculations';

interface AnalyticsViewProps {
  trades: Trade[];
  stats: TraderStats;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ trades, stats }) => {
  const [activeTab, setActiveTab] = useState<'performance' | 'behavior' | 'consistency'>('performance');

  const sessionData = buildCategoryBreakdown(trades, 'session');
  const instrumentData = buildCategoryBreakdown(trades, 'instrument');
  const strategyData = buildCategoryBreakdown(trades, 'strategy');
  const timeframeData = buildCategoryBreakdown(trades, 'timeframe');
  const planComparison = buildPlanAdherenceComparison(trades);

  // Performance by weekday
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayMap: { [day: string]: { name: string; pnl: number; count: number; wins: number } } = {};
  trades.forEach((t) => {
    const dayName = weekdayNames[new Date(t.entryDate).getDay()];
    if (!weekdayMap[dayName]) {
      weekdayMap[dayName] = { name: dayName.slice(0, 3), pnl: 0, count: 0, wins: 0 };
    }
    weekdayMap[dayName].pnl += t.netPnL;
    weekdayMap[dayName].count += 1;
    if (t.outcome === 'WIN') weekdayMap[dayName].wins += 1;
  });
  const weekdaySeries = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => {
    const found = Object.values(weekdayMap).find((item) => item.name === d);
    return (
      found || {
        name: d,
        pnl: 0,
        count: 0,
        wins: 0,
      }
    );
  });

  // Emotional state breakdown
  const emotionMap: { [mood: string]: { name: string; pnl: number; count: number } } = {};
  trades.forEach((t) => {
    const m = t.moodBefore || 'Neutral';
    if (!emotionMap[m]) emotionMap[m] = { name: m, pnl: 0, count: 0 };
    emotionMap[m].pnl += t.netPnL;
    emotionMap[m].count += 1;
  });
  const emotionSeries = Object.values(emotionMap).sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200  pb-3">
        <div>
          <h2 className="text-[26px] sm:text-[30px] leading-tight font-medium tracking-tight text-black">
            📊 Quantitative Trading Analytics
          </h2>
          <p className="text-xs text-slate-500">
            Algorithmic distribution analysis across statistical edge, psychology, and risk
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100  rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'performance'
                ? 'bg-white  text-slate-800  shadow-inner-card'
                : 'text-slate-500 hover:text-slate-800 '
            }`}
          >
            Performance Edge
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('behavior')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'behavior'
                ? 'bg-white  text-slate-800  shadow-inner-card'
                : 'text-slate-500 hover:text-slate-800 '
            }`}
          >
            Behavior & Psychology
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('consistency')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'consistency'
                ? 'bg-white  text-slate-800  shadow-inner-card'
                : 'text-slate-500 hover:text-slate-800 '
            }`}
          >
            Consistency & Drawdown
          </button>
        </div>
      </div>

      {/* Tab 1: Performance Edge */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200/80  bg-white ">
              <span className="text-[11px] text-slate-500 block">Gross Profit</span>
              <span className="text-lg font-bold font-mono text-emerald-600  mt-1 block">
                +${stats.grossProfit.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{stats.winCount} Winners</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80  bg-white ">
              <span className="text-[11px] text-slate-500 block">Gross Loss</span>
              <span className="text-lg font-bold font-mono text-rose-600  mt-1 block">
                -${stats.grossLoss.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{stats.lossCount} Losses</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80  bg-white ">
              <span className="text-[11px] text-slate-500 block">Expectancy per Execution</span>
              <span className="text-lg font-bold font-mono text-slate-800  mt-1 block">
                {stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Math Edge / Trade</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80  bg-white ">
              <span className="text-[11px] text-slate-500 block">Average Win / Loss Ratio</span>
              <span className="text-lg font-bold font-mono text-slate-800  mt-1 block">
                {stats.winLossRatio}x
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                +${stats.avgWin.toLocaleString()} vs -${stats.avgLoss.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Instruments & Strategies Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Instrument */}
            <div className="bg-white  p-4 sm:p-5 rounded-2xl border border-slate-200/80  shadow-inner-card">
              <h3 className="text-sm font-bold text-slate-800  mb-1">
                Net P&L by Instrument
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Profit distribution across traded pairs and indices
              </p>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={instrumentData} layout="vertical" margin={{ left: 15, right: 15 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={65} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="p-2.5 bg-white text-slate-800 border border-slate-200 shadow-md shadow-inner-card rounded-lg text-xs font-mono">
                              <div className="font-bold">{item.name}</div>
                              <div className={item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                P&L: {item.pnl >= 0 ? '+' : ''}${item.pnl.toLocaleString()}
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                {item.trades} trades · {item.winRate}% Win Rate
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                      {instrumentData.map((entry, index) => (
                        <Cell key={`inst-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* By Strategy */}
            <div className="bg-white  p-4 sm:p-5 rounded-2xl border border-slate-200/80  shadow-inner-card">
              <h3 className="text-sm font-bold text-slate-800  mb-1">
                Net P&L by Trading Model
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Comparison of setups and rule systems
              </p>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyData} layout="vertical" margin={{ left: 40, right: 15 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={120} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="p-2.5 bg-white text-slate-800 border border-slate-200 shadow-md shadow-inner-card rounded-lg text-xs font-mono">
                              <div className="font-bold">{item.name}</div>
                              <div className={item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                P&L: {item.pnl >= 0 ? '+' : ''}${item.pnl.toLocaleString()}
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                {item.trades} executions · {item.winRate}% WR
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                      {strategyData.map((entry, index) => (
                        <Cell key={`strat-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Behavioral & Psychology Analysis */}
      {activeTab === 'behavior' && (
        <div className="space-y-6">
          {/* Plan Adherence Impact Hero Card */}
          <div className="p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 ">
                Rule Adherence Edge vs Impulse Cost
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Empirical difference between executions strictly adhering to written plan vs off-plan discretionary trades
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/20 ">
                <span className="text-xs font-bold text-emerald-600  block mb-2">
                  ✓ Followed Trading Plan ({planComparison.followed.count} trades)
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Return:</span>
                    <span className="font-bold text-emerald-600 ">
                      +${planComparison.followed.netPnL.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Win Rate:</span>
                    <span className="font-bold text-slate-800 ">
                      {planComparison.followed.winRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg R-Multiple:</span>
                    <span className="font-bold text-slate-800 ">
                      +{planComparison.followed.avgR}R
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-50/20 ">
                <span className="text-xs font-bold text-rose-600  block mb-2">
                  ✗ Deviated / Impulsive ({planComparison.broken.count} trades)
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Return:</span>
                    <span className={`font-bold ${planComparison.broken.netPnL >= 0 ? 'text-emerald-500' : 'text-rose-600 '}`}>
                      {planComparison.broken.netPnL >= 0 ? '+' : ''}${planComparison.broken.netPnL.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Win Rate:</span>
                    <span className="font-bold text-slate-800 ">
                      {planComparison.broken.winRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg R-Multiple:</span>
                    <span className="font-bold text-slate-800 ">
                      {planComparison.broken.avgR}R
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Weekday & Session Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekday */}
            <div className="bg-white  p-4 sm:p-5 rounded-2xl border border-slate-200/80  shadow-inner-card">
              <h3 className="text-sm font-bold text-slate-800  mb-1">
                Net P&L by Day of the Week
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Identifies weekly consistency or fatigue trends
              </p>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdaySeries}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="p-2 bg-white text-slate-800 border border-slate-200 shadow-md shadow-inner-card rounded-lg text-xs font-mono">
                              <div>{item.name}</div>
                              <div className={item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                ${item.pnl.toLocaleString()} ({item.count} trades)
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {weekdaySeries.map((entry, index) => (
                        <Cell key={`day-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trading Session */}
            <div className="bg-white  p-4 sm:p-5 rounded-2xl border border-slate-200/80  shadow-inner-card">
              <h3 className="text-sm font-bold text-slate-800  mb-1">
                Performance by Trading Session
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                London vs New York vs Asian market hours
              </p>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessionData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="p-2 bg-white text-slate-800 border border-slate-200 shadow-md shadow-inner-card rounded-lg text-xs font-mono">
                              <div>{item.name} Session</div>
                              <div className={item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                ${item.pnl.toLocaleString()} · {item.winRate}% WR
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {sessionData.map((entry, index) => (
                        <Cell key={`sess-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Consistency & Drawdown */}
      {activeTab === 'consistency' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card">
              <span className="text-[11px] text-slate-500 block">Consecutive Wins Record</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600  mt-1 block">
                {stats.bestWinStreak} in a row
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Peak uninterrupted momentum</span>
            </div>

            <div className="p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card">
              <span className="text-[11px] text-slate-500 block">Max Consecutive Losses</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-rose-600  mt-1 block">
                {stats.worstLossStreak} consecutive
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Max losing streak navigated</span>
            </div>

            <div className="p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card">
              <span className="text-[11px] text-slate-500 block">Peak-to-Trough Drawdown</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-800  mt-1 block">
                {stats.maxDrawdownPercentage}% (-${stats.maxDrawdownMonetary.toLocaleString()})
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Well within standard risk boundaries</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card">
            <h3 className="text-sm font-bold text-slate-800  mb-1">
              Emotional State Correlation
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Return based on self-reported psychological state prior to taking entry
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {emotionSeries.map((emo) => (
                <div
                  key={emo.name}
                  className="p-3 rounded-xl border border-slate-200  bg-slate-50/50 "
                >
                  <span className="text-xs font-semibold text-slate-700  block">
                    {emo.name}
                  </span>
                  <div
                    className={`text-sm font-bold font-mono mt-1 ${
                      emo.pnl >= 0 ? 'text-emerald-600 ' : 'text-rose-600 '
                    }`}
                  >
                    {emo.pnl >= 0 ? '+' : ''}${Math.round(emo.pnl).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {emo.count} trades
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
