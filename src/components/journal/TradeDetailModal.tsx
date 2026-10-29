import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Target,
  Shield,
  Smile,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Trade } from '../../types';
import { useToast } from '../common/Toast';

interface TradeDetailModalProps {
  trade: Trade | null;
  allTrades: Trade[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onTradeDeleted: (tradeId: string) => void;
  onSelectTrade: (trade: Trade) => void;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  trade,
  allTrades,
  isOpen,
  onClose,
  onEdit,
  onTradeDeleted,
  onSelectTrade,
}) => {
  const { toast } = useToast();
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState<string | null>(null);
  const reviewTrade = useAction(api.ai.reviewTrade);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReviewTradeId, setAiReviewTradeId] = useState<string | null>(null);

  if (!isOpen || !trade) return null;

  if (aiReviewTradeId !== trade.id && (aiReview !== null || aiLoading)) {
    setAiReview(null);
    setAiLoading(false);
  }

  const handleAiReview = async () => {
    setAiReviewTradeId(trade.id);
    setAiLoading(true);
    setAiReview(null);
    try {
      const text = await reviewTrade({ tradeId: trade.id as any });
      setAiReview(text);
    } catch (err: any) {
      toast({ type: 'error', title: 'AI review failed', message: err?.message });
    } finally {
      setAiLoading(false);
    }
  };

  // Previous and next trade navigation
  const currentIndex = allTrades.findIndex((t) => t.id === trade.id);
  const prevTrade = currentIndex > 0 ? allTrades[currentIndex - 1] : null;
  const nextTrade = currentIndex < allTrades.length - 1 ? allTrades[currentIndex + 1] : null;

  const handleDelete = () => {
    if (window.confirm(`Delete trade record for ${trade.instrument} (${trade.entryDate})?`)) {
      onTradeDeleted(trade.id);
      toast({
        type: 'info',
        title: 'Trade Deleted',
        message: `Removed ${trade.instrument} trade record.`,
      });
      onClose();
    }
  };

  const isBuy = trade.direction === 'BUY';
  const isWin = trade.outcome === 'WIN';
  const isLoss = trade.outcome === 'LOSS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-800/30 backdrop-blur-xs backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl my-auto bg-white  border border-slate-200  rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800 animate-modalIn">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100  bg-slate-50/50 ">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                isBuy
                  ? 'bg-emerald-500/10 text-emerald-600 '
                  : 'bg-rose-500/10 text-rose-600 '
              }`}
            >
              {isBuy ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono tracking-tight">{trade.instrument}</h2>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    isBuy ? 'bg-emerald-500/10 text-emerald-600 ' : 'bg-rose-500/10 text-rose-600 '
                  }`}
                >
                  {trade.direction}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {trade.entryDate} {trade.entryTime}
                </span>
              </div>
              <p className="text-xs text-slate-500 ">
                {trade.strategy} · {trade.session} Session ({trade.timeframe})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Prev / Next buttons */}
            <div className="flex items-center border border-slate-200  rounded-lg overflow-hidden mr-2">
              <button
                type="button"
                disabled={!prevTrade}
                onClick={() => prevTrade && onSelectTrade(prevTrade)}
                title="Previous trade"
                className="p-1.5 hover:bg-slate-100 :bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-slate-200 " />
              <button
                type="button"
                disabled={!nextTrade}
                onClick={() => nextTrade && onSelectTrade(nextTrade)}
                title="Next trade"
                className="p-1.5 hover:bg-slate-100 :bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onEdit(trade)}
              className="p-1.5 text-slate-500 hover:text-slate-800  rounded-lg hover:bg-slate-100 :bg-slate-100 transition-colors"
              title="Edit trade"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 :bg-rose-950/30 transition-colors"
              title="Delete trade"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 :text-slate-200 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Performance Hero Block */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200/80  bg-slate-50 ">
            <div>
              <span className="text-[11px] text-slate-500 block">Realized Net P&L</span>
              <span
                className={`text-xl font-bold font-mono ${
                  isWin
                    ? 'text-emerald-600 '
                    : isLoss
                    ? 'text-rose-600 '
                    : 'text-slate-600 '
                }`}
              >
                {trade.netPnL >= 0 ? '+' : ''}${trade.netPnL.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Outcome: <strong className="font-semibold text-slate-700 ">{trade.outcome}</strong>
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">R-Multiple Return</span>
              <span className="text-xl font-bold font-mono text-slate-800 ">
                {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple} R
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Planned: 1 : {trade.plannedRR}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">Initial Risk</span>
              <span className="text-xl font-bold font-mono text-slate-700 ">
                ${trade.riskAmount?.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Position: {trade.positionSize} Lots
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">Commission & Fees</span>
              <span className="text-xl font-bold font-mono text-slate-700 ">
                ${trade.commission?.toFixed(2) || '0.00'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Gross: ${trade.grossPnL?.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Pricing Execution Ladder */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400  mb-3">
              Execution Price Levels
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border border-slate-200  bg-white ">
                <span className="text-[11px] text-slate-500 block">Entry Price</span>
                <span className="text-sm font-bold font-mono text-slate-800  mt-1 block">
                  {trade.entryPrice}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {trade.entryDate} {trade.entryTime}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-rose-200/50  bg-rose-50/30 ">
                <span className="text-[11px] text-rose-600  font-medium block">
                  Stop Loss (SL)
                </span>
                <span className="text-sm font-bold font-mono text-rose-600  mt-1 block">
                  {trade.stopLoss}
                </span>
                <span className="text-[10px] text-rose-500/70 mt-1 block">
                  Diff: {Math.abs(trade.entryPrice - trade.stopLoss).toFixed(2)} pts
                </span>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200/50  bg-emerald-50/30 ">
                <span className="text-[11px] text-emerald-600  font-medium block">
                  Take Profit (TP)
                </span>
                <span className="text-sm font-bold font-mono text-emerald-600  mt-1 block">
                  {trade.takeProfit}
                </span>
                <span className="text-[10px] text-emerald-500/70 mt-1 block">
                  Diff: {Math.abs(trade.takeProfit - trade.entryPrice).toFixed(2)} pts
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200  bg-white ">
                <span className="text-[11px] text-slate-500 block">Exit Price</span>
                <span className="text-sm font-bold font-mono text-slate-800  mt-1 block">
                  {trade.exitPrice}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {trade.exitDate} {trade.exitTime}
                </span>
              </div>
            </div>
          </div>

          {/* Strategy & Analysis Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200  bg-white  space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 ">
                Trade Analysis & Rationale
              </h4>
              <div>
                <span className="text-xs font-medium text-slate-500 block">Entry Reason</span>
                <p className="text-xs text-slate-800  mt-1 leading-relaxed">
                  {trade.entryReason}
                </p>
              </div>
              {trade.exitReason && (
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Exit Reason</span>
                  <p className="text-xs text-slate-800  mt-1 leading-relaxed">
                    {trade.exitReason}
                  </p>
                </div>
              )}
              {trade.mistakesMade && (
                <div className="p-2.5 bg-rose-50  rounded-lg border border-rose-200/50 ">
                  <span className="text-xs font-medium text-rose-600  flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Mistake Identified
                  </span>
                  <p className="text-xs text-rose-700  mt-0.5 leading-relaxed">
                    {trade.mistakesMade}
                  </p>
                </div>
              )}
              {trade.lessonsLearned && (
                <div className="p-2.5 bg-emerald-50  rounded-lg border border-emerald-200/50 ">
                  <span className="text-xs font-medium text-emerald-600  flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Key Lesson
                  </span>
                  <p className="text-xs text-emerald-700  mt-0.5 leading-relaxed">
                    {trade.lessonsLearned}
                  </p>
                </div>
              )}

              <div className="p-3 bg-violet-50 rounded-lg border border-violet-200/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-violet-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> AI Coach Review
                  </span>
                  <button
                    type="button"
                    onClick={handleAiReview}
                    disabled={aiLoading}
                    className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50"
                  >
                    {aiLoading ? 'Analyzing…' : aiReview ? 'Re-run' : 'Get Review'}
                  </button>
                </div>
                {aiReview && (
                  <p className="text-xs text-violet-800 mt-1.5 leading-relaxed whitespace-pre-wrap">{aiReview}</p>
                )}
                {!aiReview && !aiLoading && (
                  <p className="text-[11px] text-violet-400 mt-1">
                    Get a short, honest AI critique of this trade's entry, risk, and execution.
                  </p>
                )}
              </div>
            </div>

            {/* Psychology & Discipline Box */}
            <div className="p-4 rounded-xl border border-slate-200  bg-white  space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 ">
                Psychological State & Discipline
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Pre-Trade Mood:</span>
                  <span className="font-semibold text-slate-800  mt-0.5 block">
                    {trade.moodBefore}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Confidence Level:</span>
                  <span className="font-semibold text-slate-800  mt-0.5 block">
                    {trade.confidenceLevel} / 5 Stars
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Emotion in Trade:</span>
                  <span className="font-semibold text-slate-800  mt-0.5 block">
                    {trade.emotionDuring}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Plan Followed:</span>
                  <span
                    className={`font-semibold mt-0.5 inline-flex items-center gap-1 ${
                      trade.followedPlan
                        ? 'text-emerald-600 '
                        : 'text-rose-600 '
                    }`}
                  >
                    {trade.followedPlan ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> No (Deviated)
                      </>
                    )}
                  </span>
                </div>
              </div>

              {(trade.fomoTrade || trade.revengeTrade) && (
                <div className="p-2.5 bg-amber-50  rounded-lg border border-amber-200/50  text-xs text-amber-800 ">
                  <span className="font-semibold block">Discipline Infraction:</span>
                  {trade.fomoTrade && <div>• FOMO Entry (Chased price action)</div>}
                  {trade.revengeTrade && <div>• Revenge Trading (Immediate impulse after loss)</div>}
                </div>
              )}

              {trade.tags && trade.tags.length > 0 && (
                <div className="pt-2 border-t border-slate-100 ">
                  <span className="text-[11px] text-slate-500 block mb-1">Tags</span>
                  <div className="flex flex-wrap gap-1.5 text-xs text-slate-600 ">
                    {trade.tags.map((tag, idx) => (
                      <span key={idx}>
                        #{tag}
                        {idx < trade.tags.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Screenshots Section */}
          {trade.screenshots && trade.screenshots.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400  mb-3">
                Execution Chart Screenshots ({trade.screenshots.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trade.screenshots.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedScreenshotUrl(s.url)}
                    className="group relative rounded-xl overflow-hidden border border-slate-200  aspect-video bg-black cursor-pointer shadow-sm"
                  >
                    <img
                      src={s.url}
                      alt="Trade Chart"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                      <div className="text-white text-xs flex items-center justify-between w-full">
                        <span className="font-medium">{s.caption || 'Chart Breakdown'}</span>
                        <ExternalLink className="w-4 h-4 opacity-75 group-hover:opacity-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Screenshot Lightbox Modal */}
        {selectedScreenshotUrl && (
          <div
            className="fixed inset-0 z-60 bg-slate-800/25 backdrop-blur-xs backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setSelectedScreenshotUrl(null)}
          >
            <div className="relative max-w-5xl w-full max-h-[90vh]">
              <button
                onClick={() => setSelectedScreenshotUrl(null)}
                className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={selectedScreenshotUrl}
                alt="Enlarged Chart"
                className="w-full h-auto max-h-[85vh] object-contain rounded-xl border border-slate-700 shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
