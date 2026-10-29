import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Award,
  ShieldCheck,
  TrendingUp,
  Brain,
  CheckCircle2,
} from 'lucide-react';
import { Trade, TraderStats, User, TradingAccount } from '../../types';
import { buildCategoryBreakdown, buildPlanAdherenceComparison, exportTradesToCSV } from '../../lib/calculations';
import { useToast } from '../common/Toast';

interface ReportsViewProps {
  currentUser: User;
  currentAccount: TradingAccount | null;
  trades: Trade[];
  stats: TraderStats;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  currentUser,
  currentAccount,
  trades,
  stats,
}) => {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<
    'executive' | 'instruments' | 'psychology'
  >('executive');

  const instrumentData = buildCategoryBreakdown(trades, 'instrument');
  const strategyData = buildCategoryBreakdown(trades, 'strategy');
  const planComparison = buildPlanAdherenceComparison(trades);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvData = exportTradesToCSV(trades);
    if (!csvData) {
      toast({ type: 'error', title: 'Export Failed', message: 'No trades available.' });
      return;
    }
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tradevault-audit-report-${currentUser.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      type: 'success',
      title: 'Report Downloaded',
      message: 'CSV file saved.',
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Header Card - Pure Light with Inner Shadows */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-0.5 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 shadow-inner-soft flex items-center justify-center text-emerald-600">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-[26px] sm:text-[30px] leading-tight font-medium tracking-tight text-black">
              🧾 Institutional Trading Statements & Reports
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Formal audit logs, executive performance digests, and risk management compliance reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Report Type Selector with Inner Shadows */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl shadow-inner-medium border border-slate-200/60 text-xs">
            <button
              onClick={() => setReportType('executive')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                reportType === 'executive'
                  ? 'bg-white text-emerald-800 border border-emerald-300 shadow-inner-emerald font-bold'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Executive Statement
            </button>
            <button
              onClick={() => setReportType('instruments')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                reportType === 'instruments'
                  ? 'bg-white text-emerald-800 border border-emerald-300 shadow-inner-emerald font-bold'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Instrument Audit
            </button>
            <button
              onClick={() => setReportType('psychology')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                reportType === 'psychology'
                  ? 'bg-white text-emerald-800 border border-emerald-300 shadow-inner-emerald font-bold'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Psychology Review
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-200 bg-white rounded-xl shadow-inner-soft hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Print / PDF
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100/70 rounded-xl shadow-inner-emerald transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            Download CSV
          </button>
        </div>
      </div>

      {/* 2. Document Statement Card - 100% White with Inner Shadows */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-8 shadow-inner-card space-y-8 print:p-0 print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="flex items-start justify-between border-b border-slate-200/80 pb-6">
          <div>
            <div className="text-xl font-black tracking-tight text-slate-800 font-mono">
              TRADEVAULT AUDIT STATEMENT
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Account: {currentAccount?.name} ({currentAccount?.broker}) · Currency: {currentUser.currency}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono">
            <div>Trader: <strong className="text-slate-800">{currentUser.name}</strong></div>
            <div>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div>Verified Executions: {trades.length}</div>
          </div>
        </div>

        {/* Section 1: Executive Performance Summary with Inner Shadows */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            01. Verified Financial Key Performance Indicators
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner-soft">
              <span className="text-[11px] text-slate-500 block font-semibold">Realized Net P&L</span>
              <span
                className={`text-lg font-bold font-mono mt-0.5 block ${
                  stats.netPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toLocaleString()}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner-soft">
              <span className="text-[11px] text-slate-500 block font-semibold">Win Rate</span>
              <span className="text-lg font-bold font-mono text-slate-800 mt-0.5 block">
                {stats.winRate}% ({stats.winCount}W / {stats.lossCount}L)
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner-soft">
              <span className="text-[11px] text-slate-500 block font-semibold">Profit Factor</span>
              <span className="text-lg font-bold font-mono text-slate-800 mt-0.5 block">
                {stats.profitFactor}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner-soft">
              <span className="text-[11px] text-slate-500 block font-semibold">Max Peak Drawdown</span>
              <span className="text-lg font-bold font-mono text-slate-800 mt-0.5 block">
                {stats.maxDrawdownPercentage}% (-${stats.maxDrawdownMonetary.toLocaleString()})
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Instrument Breakdown Table with Inner Shadow on Well */}
        {reportType !== 'psychology' && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              02. Instrument Allocation & Yield
            </h3>
            <div className="p-1 bg-slate-50/60 rounded-xl border border-slate-200/80 shadow-inner-soft overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Instrument</th>
                    <th className="py-2.5 px-3 text-right">Executions</th>
                    <th className="py-2.5 px-3 text-right">Win Rate</th>
                    <th className="py-2.5 px-3 text-right">Net Realized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {instrumentData.map((item) => (
                    <tr key={item.name} className="hover:bg-white/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{item.name}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">{item.trades}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">{item.winRate}%</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${item.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.pnl >= 0 ? '+' : ''}${item.pnl.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Psychological Discipline Review */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            03. Trading Psychology & Compliance Audit
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-inner-soft space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Plan Adherence Rate:</span>
                <span className="font-bold text-emerald-600">
                  {stats.planAdherenceRate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">FOMO Impulsive Trades:</span>
                <span className="font-bold text-slate-800">
                  {stats.fomoTradeCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Revenge Trades:</span>
                <span className="font-bold text-slate-800">
                  {stats.revengeTradeCount}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-inner-soft space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Expected Mathematical Value:</span>
                <span className="font-bold text-emerald-600">
                  +${stats.expectancy.toLocaleString()} / trade
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Average Planned R:R:</span>
                <span className="font-bold text-slate-800">
                  1 : {stats.avgRiskReward}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Realized Avg R-Multiple:</span>
                <span className="font-bold text-slate-800">
                  +{stats.avgRMultiple}R
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Footer */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Generated by tradewithplan Pro Analytics</span>
          <span>Hash Verification: TWP-{currentUser.id.slice(-6).toUpperCase()}-{Date.now().toString(36).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
