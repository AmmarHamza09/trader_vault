import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  X,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Trade } from '../../types';

interface CalendarViewProps {
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ trades, onSelectTrade }) => {
  // Current viewed month and year (defaults to October 2026, aligned with current mock data)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(9); // 0-indexed: 9 = October
  const [selectedDayTrades, setSelectedDayTrades] = useState<{ date: string; trades: Trade[] } | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Group trades by date string YYYY-MM-DD
  const tradesByDate = useMemo(() => {
    const map: { [dateStr: string]: Trade[] } = {};
    trades.forEach((t) => {
      if (!map[t.entryDate]) map[t.entryDate] = [];
      map[t.entryDate].push(t);
    });
    return map;
  }, [trades]);

  // Monthly statistics
  const monthlyStats = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthlyTrades = trades.filter((t) => t.entryDate.startsWith(monthPrefix));

    let totalPnL = 0;
    let winDays = 0;
    let lossDays = 0;
    let beDays = 0;

    const daySums: { [date: string]: number } = {};
    monthlyTrades.forEach((t) => {
      totalPnL += t.netPnL;
      daySums[t.entryDate] = (daySums[t.entryDate] || 0) + t.netPnL;
    });

    const activeDays = Object.keys(daySums);
    activeDays.forEach((d) => {
      if (daySums[d] > 10) winDays++;
      else if (daySums[d] < -10) lossDays++;
      else beDays++;
    });

    const sortedDayPnl = Object.entries(daySums).sort((a, b) => b[1] - a[1]);
    const bestDay = sortedDayPnl[0] || null;
    const worstDay = sortedDayPnl[sortedDayPnl.length - 1] || null;

    const consistencyRate =
      activeDays.length > 0 ? Math.round((winDays / activeDays.length) * 100) : 0;

    return {
      totalPnL: Math.round(totalPnL * 100) / 100,
      tradesCount: monthlyTrades.length,
      activeDaysCount: activeDays.length,
      winDays,
      lossDays,
      consistencyRate,
      bestDay: bestDay ? { date: bestDay[0], pnl: bestDay[1] } : null,
      worstDay: worstDay && worstDay[1] < 0 ? { date: worstDay[0], pnl: worstDay[1] } : null,
    };
  }, [trades, currentYear, currentMonth]);

  // Generate calendar days grid
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days = [];
    // Padding before day 1
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, dateStr: '' });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dateStr });
    }

    return days;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Monthly Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 sm:p-5 bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card">
        <div className="min-w-0">
          <span className="text-[11px] text-slate-500 block">Monthly Realized P&L</span>
          <span
            className={`text-base sm:text-xl font-bold font-mono truncate block ${
              monthlyStats.totalPnL >= 0
                ? 'text-emerald-600 '
                : 'text-rose-600 '
            }`}
          >
            {monthlyStats.totalPnL >= 0 ? '+' : ''}${monthlyStats.totalPnL.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Across {monthlyStats.tradesCount} executions
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-[11px] text-slate-500 block">Profitable Days Ratio</span>
          <span className="text-base sm:text-xl font-bold font-mono text-slate-800 block">
            {monthlyStats.consistencyRate}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {monthlyStats.winDays} Win Days / {monthlyStats.lossDays} Loss Days
          </span>
        </div>

        <div>
          <span className="text-[11px] text-slate-500 block">Best Trading Session</span>
          <span className="text-sm font-bold font-mono text-emerald-600 ">
            {monthlyStats.bestDay
              ? `+$${monthlyStats.bestDay.pnl.toLocaleString()}`
              : '—'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {monthlyStats.bestDay ? monthlyStats.bestDay.date : 'No sessions recorded'}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-slate-500 block">Max Day Drawdown</span>
          <span className="text-sm font-bold font-mono text-rose-600 ">
            {monthlyStats.worstDay
              ? `-$${Math.abs(monthlyStats.worstDay.pnl).toLocaleString()}`
              : '$0'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {monthlyStats.worstDay ? monthlyStats.worstDay.date : 'Zero loss days'}
          </span>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-white  rounded-2xl border border-slate-200/80  shadow-inner-card overflow-hidden">
        {/* Navigation Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 ">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold text-slate-800 ">
              📅 {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>

          <div className="flex items-center gap-1 border border-slate-200  rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 :bg-slate-100 rounded text-slate-600  transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700 ">
              {monthNames[currentMonth].slice(0, 3)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 :bg-slate-100 rounded text-slate-600  transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-100  bg-slate-50/60  text-center text-[9px] sm:text-[11px] font-semibold text-slate-400 py-2 sm:py-2.5">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Day Grid */}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-w-[560px] sm:min-w-0">
            {calendarGrid.map((cell, idx) => {
              if (!cell.day) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[72px] sm:min-h-[96px] bg-slate-50/20 "
                  />
                );
              }

              const dayTrades = tradesByDate[cell.dateStr] || [];
              const dayPnL = dayTrades.reduce((sum, t) => sum + t.netPnL, 0);
              const winCount = dayTrades.filter((t) => t.outcome === 'WIN').length;
              const lossCount = dayTrades.filter((t) => t.outcome === 'LOSS').length;
              const hasTrades = dayTrades.length > 0;
              const isProfit = dayPnL > 0;
              const isLoss = dayPnL < 0;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => hasTrades && setSelectedDayTrades({ date: cell.dateStr, trades: dayTrades })}
                  className={`min-h-[72px] sm:min-h-[96px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${
                    hasTrades
                      ? 'cursor-pointer hover:bg-slate-50 :bg-slate-800/50'
                      : 'bg-white '
                  } ${
                    isProfit
                      ? 'bg-emerald-50/15 '
                      : isLoss
                      ? 'bg-rose-50/15 '
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] sm:text-xs font-mono font-medium text-slate-700 ">
                      {cell.day}
                    </span>
                    {hasTrades && (
                      <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
                        {dayTrades.length} trade{dayTrades.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {hasTrades ? (
                    <div className="mt-1 sm:mt-2 min-w-0">
                      <div
                        className={`text-[10px] sm:text-xs font-bold font-mono truncate ${
                          isProfit
                            ? 'text-emerald-600 '
                            : isLoss
                            ? 'text-rose-600 '
                            : 'text-slate-500'
                        }`}
                      >
                        {dayPnL >= 0 ? '+' : ''}${Math.round(dayPnL).toLocaleString()}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5">
                        {winCount}W/{lossCount}L
                      </div>
                    </div>
                  ) : (
                    <div className="h-4 sm:h-6" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Trades Slideover Modal */}
      {selectedDayTrades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-800/25 backdrop-blur-xs backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl bg-white  border border-slate-200  rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-modalIn">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 ">
              <div>
                <h3 className="text-base font-bold text-slate-800 ">
                  Trades on {selectedDayTrades.date}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDayTrades.trades.length} executions recorded on this calendar session
                </p>
              </div>
              <button
                onClick={() => setSelectedDayTrades(null)}
                className="text-slate-400 hover:text-slate-600 :text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 divide-y divide-slate-100  max-h-[60vh] overflow-y-auto">
              {selectedDayTrades.trades.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    onSelectTrade(t);
                    setSelectedDayTrades(null);
                  }}
                  className="py-3 flex items-center justify-between gap-2 hover:bg-slate-50 :bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0 ${
                        t.direction === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-600 '
                          : 'bg-rose-500/10 text-rose-600 '
                      }`}
                    >
                      {t.direction}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold font-mono text-slate-800 truncate">
                        {t.instrument} · {t.strategy}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {t.entryTime} · {t.session} Session ({t.positionSize} Lots)
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <div
                      className={`text-xs font-bold ${
                        t.netPnL >= 0
                          ? 'text-emerald-600 '
                          : 'text-rose-600 '
                      }`}
                    >
                      {t.netPnL >= 0 ? '+' : ''}${t.netPnL.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {t.rMultiple ? `${t.rMultiple > 0 ? '+' : ''}${t.rMultiple}R` : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
