import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Award,
  ShieldAlert,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Sparkles,
  Activity,
  Eye,
  EyeOff,
  Wallet,
  BookOpen,
  BarChart2,
  Calendar as CalendarIcon,
  Trophy,
  Swords,
  Target,
  FileText,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
import { Trade, TraderStats, DateRange, User, TradingAccount } from '../../types';
import { NavTab } from '../layout/AppShell';
import {
  buildEquityCurve,
  buildDailyPnLSeries,
  generateTraderInsights,
} from '../../lib/calculations';

interface OverviewViewProps {
  currentUser: User;
  currentAccount: TradingAccount | null;
  accounts: TradingAccount[];
  selectedDateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onAccountChange: (accId: string) => void;
  stats: TraderStats;
  trades: Trade[];
  onOpenAddTrade: () => void;
  onSelectTrade: (trade: Trade) => void;
  onNavigateToJournal: () => void;
  onNavigate: (tab: NavTab) => void;
}

const QUICK_ACTIONS: { id: NavTab; label: string; icon: typeof BookOpen; emoji: string }[] = [
  { id: 'journal', label: 'Journal', icon: BookOpen, emoji: '📓' },
  { id: 'coach', label: 'AI Coach', icon: Plus, emoji: '🤖' },
  { id: 'analytics', label: 'Analytics', icon: BarChart2, emoji: '📊' },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon, emoji: '📅' },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, emoji: '🏆' },
  { id: 'competitions', label: 'Competitions', icon: Swords, emoji: '⚔️' },
  { id: 'goals', label: 'Goals', icon: Target, emoji: '🎯' },
  { id: 'reports', label: 'Reports', icon: FileText, emoji: '🧾' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, emoji: '⚙️' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentUser,
  currentAccount,
  accounts,
  selectedDateRange,
  onDateRangeChange,
  onAccountChange,
  stats,
  trades,
  onOpenAddTrade,
  onSelectTrade,
  onNavigateToJournal,
  onNavigate,
}) => {
  const [balanceHidden, setBalanceHidden] = useState(false);
  const equityCurve = buildEquityCurve(trades, currentAccount?.startingBalance || 50000);
  const dailyPnL = buildDailyPnLSeries(trades);
  const insights = generateTraderInsights(trades);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const outcomeData = [
    { name: 'Wins', value: stats.winCount, color: '#10b981' },
    { name: 'Losses', value: stats.lossCount, color: '#f43f5e' },
    { name: 'Breakeven', value: stats.breakevenCount, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero: greeting, range chips, balance banner + quick actions (mobile stack, desktop 2/3 + 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 [&>*]:min-w-0">
      <div className="space-y-3 lg:col-span-2 min-w-0">
        <div className="flex items-end justify-between px-0.5">
          <h2 className="text-[28px] lg:text-[34px] leading-tight font-medium tracking-tight text-black"><span className="lg:hidden">Overview</span><span className="hidden lg:inline">{greeting}, {currentUser.name.split(' ')[0]} 👋</span></h2>
          <button type="button" onClick={() => onNavigate('journal')} className="text-base text-slate-400 font-light pb-1">
            view all
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 pb-1">
          {(['today', '7d', '30d', '90d', 'ytd', 'all'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onDateRangeChange(id)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-base font-normal shadow-sm ${
                selectedDateRange === id ? 'bg-black text-white' : 'bg-white text-slate-900'
              }`}
            >
              {({ today: '☀️ Today', '7d': '📆 7D', '30d': '🗓️ 30D', '90d': '📈 90D', ytd: '🎯 YTD', all: '♾️ All Time' } as Record<string, string>)[id]}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-[2rem] p-6 lg:p-9 bg-black text-white">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-emerald-500/20 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-light text-white/60">{currentAccount?.name || 'Account'}</p>
              <p className="text-[32px] lg:text-[52px] leading-tight font-light mt-1">
                {balanceHidden ? '••••••' : `$${(currentAccount?.currentBalance ?? 0).toLocaleString()}`}
              </p>
              <button type="button" onClick={() => setBalanceHidden((v) => !v)} className="flex items-center gap-1 text-xs font-light text-white/60 mt-2">
                {balanceHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {balanceHidden ? 'Show balance' : 'Hide balance'}
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs font-light text-white/60">Net P&L</p>
              <p className={`text-2xl lg:text-4xl font-light ${stats.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toLocaleString()}
              </p>
              <button type="button" onClick={() => onNavigate('analytics')} className="text-xs font-light text-white/50 mt-2">
                learn more…
              </button>
            </div>
          </div>
        </div>
      </div>

        <div>
          <h3 className="text-[22px] font-medium text-black mb-3 px-0.5">Quick actions</h3>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onNavigate(action.id)}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 lg:py-5 px-1 bg-white rounded-2xl shadow-inner-card hover:-translate-y-0.5 active:bg-slate-50 transition-all"
                >
                  <span className="text-2xl leading-none">{action.emoji}</span>
                  <span className="text-[13px] font-normal text-slate-900 text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Welcome & Workspace Filter Bar */}
      <div className="hidden flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-inner-card">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-800">
              {greeting}, {currentUser.name.split(' ')[0]}
            </h1>
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 sm:px-2.5 py-0.5 rounded-lg shadow-inner-soft">
              Market Active
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            {currentUser.bio}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Account Selector (hero card above already covers this on mobile) */}
          <div className="hidden lg:flex items-center gap-1.5">
            <select
              value={currentAccount?.id || ''}
              onChange={(e) => onAccountChange(e.target.value)}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none shadow-inner-soft cursor-pointer hover:bg-white transition-colors"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (${a.currentBalance?.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Segmented Control with inner shadow */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/70 shadow-inner-soft">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: '90d', label: '90D' },
                { id: 'ytd', label: 'YTD' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onDateRangeChange(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  selectedDateRange === item.id
                    ? 'bg-white text-slate-800 shadow-sm font-semibold border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Noticeable Quick Add Trade Button with Soft Inner Shadow (hero card's + already covers this on mobile) */}
          <button
            type="button"
            onClick={onOpenAddTrade}
            className="hidden lg:flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-sm shadow-inner-btn"
          >
            <Plus className="w-4 h-4" />
            Add Trade
          </button>
        </div>
      </div>

      {/* 10 Key Performance Metric Cards with Inset / Inner Shadow */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* 1. Net P&L */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>💰 Net Realized P&L</span>
            {stats.netPnL >= 0 ? (
              <span className="text-emerald-600 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3" /> +18.4%
              </span>
            ) : (
              <span className="text-rose-600 font-semibold flex items-center">
                <ArrowDownRight className="w-3 h-3" /> -4.2%
              </span>
            )}
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              stats.netPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            Gross: ${stats.grossProfit.toLocaleString()}
          </div>
        </div>

        {/* 2. Win Rate */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>🎯 Win Rate</span>
            <span className="text-slate-400 font-mono text-[10px]">{stats.winCount}W / {stats.lossCount}L</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {stats.winRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            {stats.breakevenCount} Breakeven
          </div>
        </div>

        {/* 3. Total Trades */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>⚡ Total Executions</span>
            <Activity className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {stats.totalTrades}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Adherence: {stats.planAdherenceRate}%
          </div>
        </div>

        {/* 4. Profit Factor */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>🏅 Profit Factor</span>
            <Award className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {stats.profitFactor}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Benchmark &gt; 2.0
          </div>
        </div>

        {/* 5. Avg Risk-to-Reward */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>⚖️ Average R:R</span>
            <span className="text-emerald-600 font-mono text-[10px]">Realized</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-800">
            1 : {stats.avgRiskReward || '2.4'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Avg R: {stats.avgRMultiple > 0 ? '+' : ''}{stats.avgRMultiple}R
          </div>
        </div>

        {/* 6. Expectancy per Trade */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>🧠 Expectancy / Trade</span>
            <span className="text-emerald-600 text-[10px] font-mono">Edge</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Stat edge per trade
          </div>
        </div>

        {/* 7. Average Win */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>📈 Average Win</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600">
            +${stats.avgWin.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            From {stats.winCount} wins
          </div>
        </div>

        {/* 8. Average Loss */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>📉 Average Loss</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-600">
            -${stats.avgLoss.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Win/Loss: {stats.winLossRatio}x
          </div>
        </div>

        {/* 9. Max Drawdown */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>🛡️ Max Drawdown</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {stats.maxDrawdownPercentage}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            -${stats.maxDrawdownMonetary.toLocaleString()} peak
          </div>
        </div>

        {/* 10. Current Streak */}
        <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-inner-card hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>🔥 Current Streak</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {stats.currentStreak.count}{stats.currentStreak.type === 'WIN' ? 'W' : stats.currentStreak.type === 'LOSS' ? 'L' : '—'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Best Streak: {stats.bestWinStreak}W
          </div>
        </div>
      </div>

      {/* Main Charts Section with Inner Shadows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cumulative Equity Curve (2 cols) */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-inner-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Cumulative Equity Curve & Growth
              </h3>
              <p className="text-xs text-slate-500">
                Chronological trajectory over {trades.length} executions
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-mono block">Current Equity</span>
              <span className="text-sm font-bold font-mono text-emerald-600">
                ${currentAccount?.currentBalance?.toLocaleString() || '100,000'}
              </span>
            </div>
          </div>

          <div className="h-64 w-full p-2 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner-soft">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 1000', 'dataMax + 1000']}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 text-xs font-mono shadow-inner-card">
                          <div className="text-slate-400 text-[10px]">{data.date}</div>
                          <div className="font-bold text-emerald-600 text-sm mt-0.5">
                            ${data.equity.toLocaleString()}
                          </div>
                          <div className="text-slate-600 text-[11px] mt-1">
                            Trade P&L: {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString()} ({data.instrument})
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#equityGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win / Loss & Session Distribution (1 col) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-inner-card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Outcome Breakdown
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Distribution across closed trades
            </p>

            <div className="h-44 w-full flex items-center justify-center p-2 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner-soft">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {outcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="p-2.5 bg-white text-slate-800 rounded-xl shadow-md border border-slate-200 text-xs font-mono shadow-inner-card">
                            {item.name}: {item.value} trades
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs font-mono pt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-700">Wins ({stats.winCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-700">Losses ({stats.lossCount})</span>
              </div>
              {stats.breakevenCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-slate-700">BE ({stats.breakevenCount})</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs mt-3">
            <div className="flex justify-between text-slate-500 mb-1.5">
              <span>Rule Adherence Rate:</span>
              <span className="font-semibold text-emerald-600">
                {stats.planAdherenceRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner border border-slate-200/60 p-0.5">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${stats.planAdherenceRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Daily PnL Bar Chart */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-inner-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Daily Realized P&L
            </h3>
            <p className="text-xs text-slate-500">
              Net profit and loss grouped per trading calendar day
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-lg shadow-inner-soft">
            {dailyPnL.length} active sessions
          </span>
        </div>

        <div className="h-48 w-full p-2 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner-soft">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyPnL} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-3 bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 text-xs font-mono shadow-inner-card">
                        <div className="text-slate-400 text-[10px]">{data.date}</div>
                        <div
                          className={`font-bold text-sm mt-0.5 ${
                            data.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString()}
                        </div>
                        <div className="text-slate-600 text-[11px] mt-1">
                          {data.count} trades ({data.wins}W / {data.losses}L)
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dailyPnL.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Personalized Algorithmic Insights */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Algorithmic Performance Insights
            </h3>
          </div>
          <span className="text-xs text-slate-400">Calculated from verified executions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {insights.map((ins, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border transition-all shadow-inner-card ${
                ins.impact === 'positive'
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : ins.impact === 'negative'
                  ? 'bg-rose-50/40 border-rose-200'
                  : 'bg-white border-slate-200/90'
              }`}
            >
              <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>{ins.title}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shadow-inner-soft ${
                    ins.impact === 'positive'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : ins.impact === 'negative'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {ins.impact.toUpperCase()}
                </span>
              </h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {ins.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Trades Quick View */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-inner-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Recent Trade Executions
            </h3>
            <p className="text-xs text-slate-500">Latest entries logged in your journal</p>
          </div>
          <button
            type="button"
            onClick={onNavigateToJournal}
            className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
          >
            View Full Journal ({trades.length}) →
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {trades.slice(0, 5).map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTrade(t)}
              className="py-3 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border shadow-inner-soft ${
                    t.direction === 'BUY'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {t.direction}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {t.instrument}
                    </span>
                    <span className="text-[11px] text-slate-400">· {t.strategy}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {t.entryDate} {t.entryTime} · {t.session} Session
                  </div>
                </div>
              </div>

              <div className="text-right font-mono">
                <div
                  className={`text-xs font-bold ${
                    t.netPnL >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {t.netPnL >= 0 ? '+' : ''}${t.netPnL.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t.rMultiple ? `${t.rMultiple > 0 ? '+' : ''}${t.rMultiple}R` : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
