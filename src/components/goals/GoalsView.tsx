import React, { useState } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Flame,
  Award,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { Goal, GoalCategory, User, TradingAccount } from '../../types';
import { PhasesSection } from './PhasesSection';
import { useToast } from '../common/Toast';

interface GoalsViewProps {
  currentUser: User;
  goals: Goal[];
  accounts?: TradingAccount[];
  currentAccountId?: string;
  readOnly?: boolean;
  onSaveGoal: (goal: Goal) => Promise<void> | void;
  onDeleteGoal: (goalId: string) => Promise<void> | void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ currentUser, goals, accounts = [], currentAccountId, readOnly, onSaveGoal, onDeleteGoal }) => {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategory>('profit');
  const [targetValue, setTargetValue] = useState('10000');
  const [currentValue, setCurrentValue] = useState('0');
  const [unit, setUnit] = useState<'$' | '%' | 'R' | 'trades'>('$');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'challenge'>('monthly');
  const [notes, setNotes] = useState('');
  const [isHardRiskLimit, setIsHardRiskLimit] = useState(false);

  const handleToggleComplete = async (goal: Goal) => {
    const updated = { ...goal, completed: !goal.completed };
    await onSaveGoal(updated);
    toast({
      type: 'success',
      title: updated.completed ? 'Goal Completed!' : 'Goal Status Reopened',
      message: `${goal.title} status updated.`,
    });
  };

  const handleDelete = async (goalId: string) => {
    if (window.confirm('Delete this trading goal?')) {
      await onDeleteGoal(goalId);
      toast({
        type: 'info',
        title: 'Goal Removed',
      });
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetValue) return;

    const newGoal: Goal = {
      id: '',
      userId: currentUser.id,
      title,
      category,
      targetValue: parseFloat(targetValue),
      currentValue: parseFloat(currentValue) || 0,
      unit,
      period,
      completed: false,
      notes: notes || undefined,
      isHardRiskLimit,
    };

    await onSaveGoal(newGoal);
    toast({
      type: 'success',
      title: 'Goal Established',
      message: title,
    });
    setIsAddModalOpen(false);
    setTitle('');
    setNotes('');
  };

  // Separate hard risk limits from performance objectives
  const hardRiskLimits = goals.filter((g) => g.isHardRiskLimit);
  const performanceGoals = goals.filter((g) => !g.isHardRiskLimit);

  return (
    <div className="space-y-6">
      <PhasesSection accounts={accounts} currentAccountId={currentAccountId} readOnly={readOnly} />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-0.5">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" />
            <h2 className="text-[26px] sm:text-[30px] leading-tight font-medium tracking-tight text-black">
              🎯 Goals, Discipline & Hard Risk Limits
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track process excellence, profit milestones, and enforce non-negotiable risk boundaries
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-inner-card"
        >
          <Plus className="w-4 h-4" />
          Create New Objective
        </button>
      </div>

      {/* Safety Notice on Risk Limits */}
      <div className="p-3 bg-amber-50  rounded-xl border border-amber-200/50  text-xs text-amber-800  flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Professional Risk Principle:</strong> Profit milestones should inspire patience, never over-trading. Always prioritize protecting capital over hitting arbitrary daily profit numbers.
        </div>
      </div>

      {/* Section 1: Non-Negotiable Hard Risk Limits */}
      {hardRiskLimits.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Non-Negotiable Hard Risk Guardrails
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hardRiskLimits.map((g) => {
              const progress = Math.min(Math.round((g.currentValue / g.targetValue) * 100), 100);
              const isBreached = g.currentValue >= g.targetValue;

              return (
                <div
                  key={g.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isBreached
                      ? 'bg-rose-50/40  border-rose-500/50'
                      : 'bg-white  border-slate-200/80 '
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">
                        Hard Ceiling
                      </span>
                      <h4 className="text-sm font-bold text-slate-800  mt-2">
                        {g.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(g.id)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                      <span className="text-slate-500">
                        Exposure: {g.unit === '$' ? '$' : ''}{g.currentValue.toLocaleString()}{g.unit !== '$' ? g.unit : ''}
                      </span>
                      <span className="font-bold text-slate-800 ">
                        Max Allowed: {g.unit === '$' ? '$' : ''}{g.targetValue.toLocaleString()}{g.unit !== '$' ? g.unit : ''}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100  h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progress > 80 ? 'bg-rose-500' : progress > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {g.notes && (
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed border-t border-slate-100  pt-2">
                      {g.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Performance Milestones & Challenges */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400  flex items-center gap-1.5">
          <Award className="w-4 h-4" /> Performance Objectives & Challenges
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {performanceGoals.map((g) => {
            const progress = Math.min(Math.round((g.currentValue / g.targetValue) * 100), 100);

            return (
              <div
                key={g.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  g.completed
                    ? 'bg-emerald-50/20  border-emerald-500/30'
                    : 'bg-white  border-slate-200/80 '
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      {g.period} target
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(g)}
                        className={`p-1 rounded transition-colors ${
                          g.completed
                            ? 'text-emerald-500 hover:text-emerald-600'
                            : 'text-slate-400 hover:text-emerald-500'
                        }`}
                        title={g.completed ? 'Mark incomplete' : 'Mark completed'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(g.id)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800  mt-1">
                    {g.title}
                  </h4>

                  {g.notes && (
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {g.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 ">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-500">
                      {g.unit === '$' ? '$' : ''}{g.currentValue.toLocaleString()}{g.unit !== '$' ? g.unit : ''}
                    </span>
                    <span className="font-bold text-emerald-600 ">
                      {progress}%
                    </span>
                    <span className="text-slate-400">
                      Target: {g.unit === '$' ? '$' : ''}{g.targetValue.toLocaleString()}{g.unit !== '$' ? g.unit : ''}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100  h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Goal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-800/25 backdrop-blur-xs backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white  border border-slate-200  rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto animate-modalIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 ">
              <h3 className="text-base font-bold text-slate-800 ">
                Create Trading Goal or Hard Limit
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 :text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700  mb-1">
                  Objective Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Max Daily Loss $1,500 Hard Cutoff"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700  mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GoalCategory)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
                  >
                    <option value="profit">Profit Target ($)</option>
                    <option value="winrate">Win Rate (%)</option>
                    <option value="max_daily_loss">Max Daily Loss ($)</option>
                    <option value="max_drawdown">Max Drawdown (%)</option>
                    <option value="plan_adherence">Plan Adherence (%)</option>
                    <option value="no_revenge">Zero Revenge Trades</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700  mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
                  >
                    <option value="$">Dollars ($)</option>
                    <option value="%">Percentage (%)</option>
                    <option value="R">R-Multiple (R)</option>
                    <option value="trades">Trades Count</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700  mb-1">
                    Target Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700  mb-1">
                    Current Starting Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-rose-200/50  bg-rose-50/20  cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHardRiskLimit}
                    onChange={(e) => setIsHardRiskLimit(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-rose-700  block">
                      Enforce as Hard Risk Limit
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Non-negotiable stop line (e.g. daily max drawdown limit)
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700  mb-1">
                  Notes & Rules
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specific rules for this challenge..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors shadow-inner-card"
              >
                Save Objective
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
