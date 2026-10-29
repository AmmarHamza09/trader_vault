import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Medal,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  Search,
  Sparkles,
  ShieldCheck,
  X,
  ExternalLink,
  Target,
  Award,
} from 'lucide-react';
import { LeaderboardEntry, User } from '../../types';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  currentUser: User;
}

// Sign-aware formatting: losses show a minus sign and red, wins green.
const pctText = (n: number) => `${n > 0 ? '+' : ''}${n}%`;
const usdText = (n: number) => `${n < 0 ? '-' : n > 0 ? '+' : ''}$${Math.abs(n).toLocaleString()}`;
const tone = (n: number) => (n < 0 ? 'text-rose-600' : n > 0 ? 'text-emerald-600' : 'text-slate-500');

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ entries, currentUser }) => {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  const [sortBy, setSortBy] = useState<'return' | 'pnl' | 'winrate' | 'profitfactor'>('return');
  const [search, setSearch] = useState('');
  const [selectedTrader, setSelectedTrader] = useState<LeaderboardEntry | null>(null);

  const filteredAndSorted = useMemo(() => {
    return [...entries]
      .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'return') return b.returnPercentage - a.returnPercentage;
        if (sortBy === 'pnl') return b.netPnL - a.netPnL;
        if (sortBy === 'winrate') return b.winRate - a.winRate;
        if (sortBy === 'profitfactor') return b.profitFactor - a.profitFactor;
        return 0;
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
  }, [entries, search, sortBy]);

  const top3 = filteredAndSorted.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); // Silver (2), Gold (1), Bronze (3)

  return (
    <div className="space-y-6">
      {/* Header and Disclaimer */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-0.5">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-[26px] sm:text-[30px] leading-tight font-medium tracking-tight text-black">
              🏆 Global Trader Leaderboard
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standardized performance benchmarks based on percentage return and disciplined consistency
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Tabs */}
          <div className="flex items-center p-1 bg-slate-100  rounded-lg text-xs">
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1 font-semibold rounded-md transition-all ${
                period === 'week'
                  ? 'bg-white  text-slate-800  shadow-inner-card'
                  : 'text-slate-500'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1 font-semibold rounded-md transition-all ${
                period === 'month'
                  ? 'bg-white  text-slate-800  shadow-inner-card'
                  : 'text-slate-500'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1 font-semibold rounded-md transition-all ${
                period === 'all'
                  ? 'bg-white  text-slate-800  shadow-inner-card'
                  : 'text-slate-500'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Metric Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200  bg-slate-50  text-slate-800  focus:outline-none"
          >
            <option value="return">Sort by Return %</option>
            <option value="pnl">Sort by Net P&L ($)</option>
            <option value="winrate">Sort by Win Rate</option>
            <option value="profitfactor">Sort by Profit Factor</option>
          </select>
        </div>
      </div>

      {/* Fairness & Privacy Disclaimer Badge */}
      <div className="p-3 bg-slate-50  rounded-xl border border-slate-200  text-xs text-slate-500 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800 ">Fairness & Privacy Architecture:</strong> Leaderboard statistics are calculated using percentage return so traders of various capital sizes compete fairly. Individual private journal entries, screenshots, and account notes are strictly confidential and never displayed to other users.
        </div>
      </div>

      {/* Podium for Top 3 */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Silver #2 */}
          <div
            onClick={() => setSelectedTrader(podiumOrder[0])}
            className="p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200  text-center flex flex-col items-center justify-between shadow-inner-card hover:border-slate-300 :border-slate-700 cursor-pointer transition-all md:translate-y-4"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200  text-slate-600  font-bold text-xs flex items-center justify-center mb-2">
              #2
            </div>
            <img
              src={podiumOrder[0].avatar}
              alt={podiumOrder[0].name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-300  shadow-md"
            />
            <h3 className="font-bold text-sm text-slate-800  mt-2">
              {podiumOrder[0].name}
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {podiumOrder[0].favoriteInstrument} · {podiumOrder[0].accountType.toUpperCase()}
            </span>
            <div className="mt-3 p-2 bg-slate-50  rounded-xl w-full">
              <span className={`text-lg font-bold font-mono ${tone(podiumOrder[0].returnPercentage)} block`}>
                {pctText(podiumOrder[0].returnPercentage)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                WR: {podiumOrder[0].winRate}% · PF: {podiumOrder[0].profitFactor}
              </span>
            </div>
          </div>

          {/* Gold #1 */}
          <div
            onClick={() => setSelectedTrader(podiumOrder[1])}
            className="p-4 sm:p-6 bg-gradient-to-b from-amber-500/10 via-white to-white    rounded-2xl border border-amber-500/30 text-center flex flex-col items-center justify-between shadow-lg hover:border-amber-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-1 bg-amber-500 text-slate-950 font-extrabold text-xs px-2.5 py-0.5 rounded-full mb-1">
              <Trophy className="w-3.5 h-3.5" /> 1ST PLACE
            </div>
            <img
              src={podiumOrder[1].avatar}
              alt={podiumOrder[1].name}
              className="w-20 h-20 rounded-2xl object-cover border-3 border-amber-500 shadow-xl"
            />
            <h3 className="font-bold text-base text-slate-800  mt-2 flex items-center gap-1.5">
              {podiumOrder[1].name}
              {podiumOrder[1].userId === currentUser.id && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-600  px-1.5 py-0.5 rounded font-mono">
                  You
                </span>
              )}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {podiumOrder[1].favoriteInstrument} · {podiumOrder[1].accountType.toUpperCase()}
            </span>
            <div className="mt-3 p-3 bg-amber-500/10 rounded-xl w-full border border-amber-500/20">
              <span className={`text-xl sm:text-2xl font-black font-mono ${tone(podiumOrder[1].returnPercentage)} block`}>
                {pctText(podiumOrder[1].returnPercentage)}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {usdText(podiumOrder[1].netPnL)} · WR: {podiumOrder[1].winRate}%
              </span>
            </div>
          </div>

          {/* Bronze #3 */}
          <div
            onClick={() => setSelectedTrader(podiumOrder[2])}
            className="p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200  text-center flex flex-col items-center justify-between shadow-inner-card hover:border-slate-300 :border-slate-700 cursor-pointer transition-all md:translate-y-6"
          >
            <div className="w-8 h-8 rounded-full bg-amber-900/10 text-amber-800  font-bold text-xs flex items-center justify-center mb-2">
              #3
            </div>
            <img
              src={podiumOrder[2].avatar}
              alt={podiumOrder[2].name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-700/50 shadow-md"
            />
            <h3 className="font-bold text-sm text-slate-800  mt-2">
              {podiumOrder[2].name}
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {podiumOrder[2].favoriteInstrument} · {podiumOrder[2].accountType.toUpperCase()}
            </span>
            <div className="mt-3 p-2 bg-slate-50  rounded-xl w-full">
              <span className={`text-lg font-bold font-mono ${tone(podiumOrder[2].returnPercentage)} block`}>
                {pctText(podiumOrder[2].returnPercentage)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                WR: {podiumOrder[2].winRate}% · PF: {podiumOrder[2].profitFactor}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card overflow-hidden">
        <div className="p-4 border-b border-slate-100  flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trader name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200  bg-slate-50  text-slate-800  focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredAndSorted.length} Verified Traders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100  bg-slate-50/50  text-slate-500 font-semibold">
                <th className="py-3 px-4 w-14 text-center">Rank</th>
                <th className="py-3 px-4">Trader</th>
                <th className="py-3 px-4">Account Type</th>
                <th className="py-3 px-4 text-right">Return %</th>
                <th className="py-3 px-4 text-right">Net P&L</th>
                <th className="py-3 px-4 text-center">Win Rate</th>
                <th className="py-3 px-4 text-center">Profit Factor</th>
                <th className="py-3 px-4 text-center">Trades</th>
                <th className="py-3 px-4 text-center">Best Streak</th>
                <th className="py-3 px-4 text-center">Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {filteredAndSorted.map((t) => {
                const isCurrentUser = t.userId === currentUser.id;
                return (
                  <tr
                    key={t.userId}
                    onClick={() => setSelectedTrader(t)}
                    className={`hover:bg-slate-50/80 :bg-slate-800/50 cursor-pointer transition-colors ${
                      isCurrentUser
                        ? 'bg-emerald-50/40  font-medium'
                        : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                      {t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : `#${t.rank}`}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img
                          src={t.avatar}
                          alt={t.name}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 "
                        />
                        <div>
                          <div className="font-semibold text-slate-800  flex items-center gap-1.5">
                            {t.name}
                            {isCurrentUser && (
                              <span className="text-[10px] text-emerald-600  bg-emerald-500/10 px-1 py-0.2 rounded font-mono">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Prefers {t.favoriteInstrument}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-mono text-slate-600 ">
                        {t.accountType === 'live' ? 'Live Capital' : 'Prop Firm Funded'}
                      </span>
                    </td>

                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${tone(t.returnPercentage)} whitespace-nowrap`}>
                      {pctText(t.returnPercentage)}
                    </td>

                    <td className={`py-3.5 px-4 text-right font-mono ${tone(t.netPnL)} whitespace-nowrap`}>
                      {usdText(t.netPnL)}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-700 ">
                      {t.winRate}%
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-700 ">
                      {t.profitFactor}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                      {t.totalTrades}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-emerald-500">
                      {t.bestStreak}W
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono">
                      {t.rankChange > 0 ? (
                        <span className="text-emerald-500 flex items-center justify-center gap-0.5 text-[11px]">
                          <ArrowUp className="w-3 h-3" /> +{t.rankChange}
                        </span>
                      ) : t.rankChange < 0 ? (
                        <span className="text-rose-500 flex items-center justify-center gap-0.5 text-[11px]">
                          <ArrowDown className="w-3 h-3" /> {t.rankChange}
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trader Profile Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-800/25 backdrop-blur-xs backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white  border border-slate-200  rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto animate-modalIn">
            <button
              onClick={() => setSelectedTrader(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 :text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 pb-4 border-b border-slate-100 ">
              <img
                src={selectedTrader.avatar}
                alt={selectedTrader.name}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 "
              />
              <div>
                <h3 className="text-base font-bold text-slate-800 ">
                  {selectedTrader.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Rank #{selectedTrader.rank} · {selectedTrader.accountType === 'live' ? 'Live Broker' : 'Prop Firm Trader'}
                </p>
                <div className="text-[11px] text-emerald-600  font-semibold mt-1">
                  Consistency Score: {selectedTrader.consistencyScore} / 100
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4 text-xs font-mono">
              <div className="p-3 bg-slate-50  rounded-xl">
                <span className="text-slate-400 block text-[10px]">Net Return %</span>
                <span className={`text-base font-bold ${tone(selectedTrader.returnPercentage)} mt-0.5 block`}>
                  {pctText(selectedTrader.returnPercentage)}
                </span>
              </div>
              <div className="p-3 bg-slate-50  rounded-xl">
                <span className="text-slate-400 block text-[10px]">Realized P&L</span>
                <span className={`text-base font-bold ${tone(selectedTrader.netPnL)} mt-0.5 block`}>
                  {usdText(selectedTrader.netPnL)}
                </span>
              </div>
              <div className="p-3 bg-slate-50  rounded-xl">
                <span className="text-slate-400 block text-[10px]">Win Rate</span>
                <span className="text-base font-bold text-slate-800  mt-0.5 block">
                  {selectedTrader.winRate}%
                </span>
              </div>
              <div className="p-3 bg-slate-50  rounded-xl">
                <span className="text-slate-400 block text-[10px]">Profit Factor</span>
                <span className="text-base font-bold text-slate-800  mt-0.5 block">
                  {selectedTrader.profitFactor}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50  rounded-xl text-xs text-slate-500 border border-slate-100  leading-relaxed">
              <strong>Privacy Protection:</strong> tradewithplan safeguards trader proprietary setups. Individual entry tickets, charts, and private journal notes are strictly confidential.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
