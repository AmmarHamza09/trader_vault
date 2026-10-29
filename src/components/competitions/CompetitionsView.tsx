import React, { useState } from 'react';
import {
  Swords,
  Plus,
  X,
  Calendar,
  Users,
  Trophy,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Target,
  Crown,
} from 'lucide-react';
import {
  Competition,
  CompetitionLeaderboardResult,
  CompetitionTargetMetric,
  User,
} from '../../types';

interface CompetitionsViewProps {
  competitions: Competition[];
  currentUser: User;
  onCreate: (data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    targetMetric?: CompetitionTargetMetric;
    targetValue?: number;
  }) => Promise<void>;
  onJoin: (competitionId: string) => Promise<void>;
  onLeave: (competitionId: string) => Promise<void>;
  getLeaderboard: (competitionId: string) => Promise<CompetitionLeaderboardResult>;
}

const statusBadge = (status: Competition['status']) => {
  if (status === 'active')
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (status === 'upcoming')
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  return 'bg-slate-100 text-slate-500 border-slate-200';
};

const formatTargetLabel = (metric?: CompetitionTargetMetric | null, value?: number | null) => {
  if (!metric || value === undefined || value === null) return null;
  return metric === 'netPnL' ? `$${value.toLocaleString()} Net P&L` : `${value}% Return`;
};

const Avatar: React.FC<{ name: string; avatar?: string; size?: 'sm' | 'md' }> = ({
  name,
  avatar,
  size = 'sm',
}) => {
  const dims = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-12 h-12 text-sm';
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${dims} rounded-lg object-cover border border-slate-200 shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

export const CompetitionsView: React.FC<CompetitionsViewProps> = ({
  competitions,
  currentUser,
  onCreate,
  onJoin,
  onLeave,
  getLeaderboard,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasGoal, setHasGoal] = useState(false);
  const [targetMetric, setTargetMetric] = useState<CompetitionTargetMetric>('netPnL');
  const [targetValue, setTargetValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selected, setSelected] = useState<Competition | null>(null);
  const [result, setResult] = useState<CompetitionLeaderboardResult | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return;
    setSubmitting(true);
    try {
      await onCreate({
        title,
        description: description || undefined,
        startDate,
        endDate,
        targetMetric: hasGoal ? targetMetric : undefined,
        targetValue: hasGoal && targetValue ? parseFloat(targetValue) : undefined,
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setHasGoal(false);
      setTargetValue('');
    } finally {
      setSubmitting(false);
    }
  };

  const openCompetition = async (comp: Competition) => {
    setSelected(comp);
    setResult(null);
    setLoadingLeaderboard(true);
    try {
      const data = await getLeaderboard(comp.id);
      setResult(data);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  if (selected) {
    const winner = result?.winnerUserId
      ? result.entries.find((e) => e.userId === result.winnerUserId)
      : null;
    const targetLabel = formatTargetLabel(selected.targetMetric, selected.targetValue);

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Competitions
        </button>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-inner-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Swords className="w-5 h-5 text-emerald-500 shrink-0" />
                <h2 className="text-lg font-bold text-slate-800 break-words">{selected.title}</h2>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusBadge(selected.status)}`}>
                  {selected.status}
                </span>
              </div>
              {selected.description && (
                <p className="text-xs text-slate-500 mt-1">{selected.description}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {selected.startDate} → {selected.endDate} · Created by {selected.creatorName}
                </p>
                {targetLabel && (
                  <span className="text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                    <Target className="w-3 h-3" /> Goal: {targetLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> {selected.participantCount} joined
              </span>
              {selected.isJoined ? (
                <button
                  onClick={async () => {
                    await onLeave(selected.id);
                    setSelected({ ...selected, isJoined: false, participantCount: selected.participantCount - 1 });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> Leave
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await onJoin(selected.id);
                    setSelected({ ...selected, isJoined: true, participantCount: selected.participantCount + 1 });
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Join Competition
                </button>
              )}
            </div>
          </div>
        </div>

        {winner && (
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-500/30 flex items-center gap-3 flex-wrap">
            <Crown className="w-6 h-6 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800">
                {winner.userId === currentUser.id ? 'You' : winner.name} reached the goal and won this competition! 🎉
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Target: {targetLabel} · Achieved{' '}
                {selected.targetMetric === 'netPnL'
                  ? `$${winner.netPnL.toLocaleString()}`
                  : `${winner.returnPercentage}%`}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-inner-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Competition Leaderboard
            </h3>
          </div>
          {loadingLeaderboard ? (
            <div className="p-6 sm:p-8 text-center text-xs text-slate-400">Loading standings...</div>
          ) : !result || result.entries.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-xs text-slate-400">
              No trades logged within this competition window yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                    <th className="py-3 px-4 w-14 text-center">Rank</th>
                    <th className="py-3 px-4">Trader</th>
                    <th className="py-3 px-4 text-right">Return %</th>
                    <th className="py-3 px-4 text-right">Net P&L</th>
                    <th className="py-3 px-4 text-center">Win Rate</th>
                    <th className="py-3 px-4 text-center">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.entries.map((t) => {
                    const isCurrentUser = t.userId === currentUser.id;
                    const isWinner = t.userId === result.winnerUserId;
                    return (
                      <tr
                        key={t.userId}
                        className={`transition-colors ${
                          isWinner
                            ? 'bg-amber-50/60 font-medium'
                            : isCurrentUser
                            ? 'bg-emerald-50/40 font-medium'
                            : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                          {t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : `#${t.rank}`}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Avatar name={t.name} avatar={t.avatar} />
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {t.name}
                              {isWinner && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                              {isCurrentUser && (
                                <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1 py-0.2 rounded font-mono">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                          {t.returnPercentage >= 0 ? '+' : ''}{t.returnPercentage}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-800 whitespace-nowrap">
                          {t.netPnL >= 0 ? '+' : ''}${t.netPnL.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-700">{t.winRate}%</td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-500">{t.totalTrades}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-0.5">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-emerald-500" />
            <h2 className="text-[26px] sm:text-[30px] leading-tight font-medium tracking-tight text-black">⚔️ Trading Competitions</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Join or create time-boxed challenges and climb a leaderboard scoped to trades logged within the window
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> New Competition
        </button>
      </div>

      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800">Fair Scoring:</strong> standings only count trades with an entry date inside the competition window, ranked by percentage return so account sizes don't matter. If a competition has a goal, the first trader to reach it automatically wins.
        </div>
      </div>

      {competitions.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/80 shadow-inner-card">
          <Swords className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No competitions yet</p>
          <p className="text-xs text-slate-400 mt-1">Start the first one and invite other traders to compete.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.map((comp) => {
            const targetLabel = formatTargetLabel(comp.targetMetric, comp.targetValue);
            return (
              <div
                key={comp.id}
                onClick={() => openCompetition(comp)}
                className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-inner-card cursor-pointer hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(comp.status)}`}>
                    {comp.status}
                  </span>
                  {comp.isJoined && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                      Joined
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-sm text-slate-800 break-words">{comp.title}</h3>
                {comp.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{comp.description}</p>
                )}
                {targetLabel && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                    <Target className="w-3 h-3" /> {targetLabel}
                  </span>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100 flex-wrap gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {comp.startDate} → {comp.endDate}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {comp.participantCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-800/25 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto animate-modalIn">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-800 mb-4">Create Competition</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <div>
                  <span className="text-xs font-semibold block text-slate-800 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-500" /> Set a Win Goal
                  </span>
                  <span className="text-[11px] text-slate-500">
                    First trader to reach this target automatically wins
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hasGoal}
                  onChange={(e) => setHasGoal(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </label>

              {hasGoal && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Goal Metric</label>
                    <select
                      value={targetMetric}
                      onChange={(e) => setTargetMetric(e.target.value as CompetitionTargetMetric)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="netPnL">Net P&L ($)</option>
                      <option value="returnPercentage">Return (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Target {targetMetric === 'netPnL' ? '($)' : '(%)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      placeholder={targetMetric === 'netPnL' ? '500' : '10'}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                      required={hasGoal}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Competition'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
