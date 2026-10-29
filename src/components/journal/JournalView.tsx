import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Upload,
  Plus,
  ArrowUpDown,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { Trade } from '../../types';
import { exportTradesToCSV } from '../../lib/calculations';
import { useToast } from '../common/Toast';

interface JournalViewProps {
  trades: Trade[];
  onOpenAddTrade: () => void;
  onOpenImport: () => void;
  onSelectTrade: (trade: Trade) => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (tradeId: string) => void;
}

type SortField = 'date' | 'pnl' | 'rmult' | 'instrument' | 'size';

export const JournalView: React.FC<JournalViewProps> = ({
  trades,
  onOpenAddTrade,
  onOpenImport,
  onSelectTrade,
  onEditTrade,
  onDeleteTrade,
}) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    dateTime: true,
    instrument: true,
    direction: true,
    levels: true,
    size: true,
    risk: true,
    rr: true,
    pnl: true,
    outcome: true,
    strategy: true,
    session: true,
    psychology: true,
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Filtered & Sorted trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (instrumentFilter !== 'ALL' && t.instrument !== instrumentFilter) return false;
      if (outcomeFilter !== 'ALL' && t.outcome !== outcomeFilter) return false;
      if (sessionFilter !== 'ALL' && t.session !== sessionFilter) return false;
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchInst = t.instrument.toLowerCase().includes(query);
        const matchStrat = t.strategy.toLowerCase().includes(query);
        const matchReason = (t.entryReason || '').toLowerCase().includes(query);
        const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(query));
        const matchId = t.id.toLowerCase().includes(query);
        if (!matchInst && !matchStrat && !matchReason && !matchTags && !matchId) return false;
      }

      return true;
    });
  }, [trades, search, instrumentFilter, outcomeFilter, sessionFilter, directionFilter]);

  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let comp = 0;
      if (sortField === 'date') {
        const tA = new Date(`${a.entryDate}T${a.entryTime || '00:00'}`).getTime();
        const tB = new Date(`${b.entryDate}T${b.entryTime || '00:00'}`).getTime();
        comp = tA - tB;
      } else if (sortField === 'pnl') {
        comp = a.netPnL - b.netPnL;
      } else if (sortField === 'rmult') {
        comp = (a.rMultiple || 0) - (b.rMultiple || 0);
      } else if (sortField === 'instrument') {
        comp = a.instrument.localeCompare(b.instrument);
      } else if (sortField === 'size') {
        comp = a.positionSize - b.positionSize;
      }
      return sortAsc ? comp : -comp;
    });
  }, [filteredTrades, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(sortedTrades.length / pageSize) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTrades.slice(start, start + pageSize);
  }, [sortedTrades, currentPage, pageSize]);

  // Unique instruments in the data set
  const instruments = useMemo(() => {
    const set = new Set(trades.map((t) => t.instrument));
    return Array.from(set).sort();
  }, [trades]);

  const handleExportCSV = () => {
    const csvData = exportTradesToCSV(trades);
    if (!csvData) {
      toast({ type: 'error', title: 'Export Failed', message: 'No trades available to export.' });
      return;
    }
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tradevault-journal-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      type: 'success',
      title: 'CSV Journal Exported',
      message: `Exported ${trades.length} trade records.`,
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-inner-card">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input with Inset Shadow */}
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search instruments, tags, models..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner-soft"
            />
          </div>

          {/* Instrument Filter */}
          <select
            value={instrumentFilter}
            onChange={(e) => {
              setInstrumentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none shadow-inner-soft cursor-pointer hover:bg-white"
          >
            <option value="ALL">All Instruments</option>
            {instruments.map((inst) => (
              <option key={inst} value={inst}>
                {inst}
              </option>
            ))}
          </select>

          {/* Outcome Filter */}
          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none shadow-inner-soft cursor-pointer hover:bg-white"
          >
            <option value="ALL">All Outcomes</option>
            <option value="WIN">Wins Only</option>
            <option value="LOSS">Losses Only</option>
            <option value="BREAKEVEN">Breakeven Only</option>
          </select>

          {/* Session Filter */}
          <select
            value={sessionFilter}
            onChange={(e) => {
              setSessionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none shadow-inner-soft cursor-pointer hover:bg-white"
          >
            <option value="ALL">All Sessions</option>
            <option value="London">London</option>
            <option value="New York">New York</option>
            <option value="Overlap">Overlap</option>
            <option value="Asian">Asian</option>
          </select>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none shadow-inner-soft cursor-pointer hover:bg-white"
          >
            <option value="ALL">Both Directions</option>
            <option value="BUY">BUY / Long</option>
            <option value="SELL">SELL / Short</option>
          </select>
        </div>

        {/* Action Buttons with Inner Shadows */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Column Visibility Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColPicker(!showColPicker)}
              className="p-2 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl bg-slate-50 shadow-inner-soft transition-colors"
              title="Configure Columns"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {showColPicker && (
              <div className="absolute right-0 mt-2 w-52 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 space-y-1.5 text-xs shadow-inner-card">
                <span className="font-semibold text-slate-800 block pb-1 border-b border-slate-100">
                  Toggle Columns
                </span>
                {Object.entries(visibleColumns).map(([key, isVis]) => (
                  <label key={key} className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 px-1 rounded-lg">
                    <span className="capitalize text-slate-700">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <input
                      type="checkbox"
                      checked={isVis}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="rounded text-emerald-600"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-800 border border-slate-200 rounded-xl bg-white shadow-inner-soft hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-800 border border-slate-200 rounded-xl bg-white shadow-inner-soft hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <button
            type="button"
            onClick={onOpenAddTrade}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-sm shadow-inner-btn"
          >
            <Plus className="w-4 h-4" />
            Log Trade
          </button>
        </div>
      </div>

      {/* Main Journal Data Table with Inset Box Shadow Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-inner-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold select-none shadow-inner-soft">
                {visibleColumns.dateTime && (
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                    onClick={() => toggleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Date & Time</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.instrument && (
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-800"
                    onClick={() => toggleSort('instrument')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Instrument</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.direction && <th className="py-3.5 px-4">Side</th>}
                {visibleColumns.levels && <th className="py-3.5 px-4">Entry / Exit</th>}
                {visibleColumns.levels && <th className="py-3.5 px-4">SL / TP</th>}
                {visibleColumns.size && (
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-800"
                    onClick={() => toggleSort('size')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Size</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.risk && <th className="py-3.5 px-4">Risk ($)</th>}
                {visibleColumns.rr && (
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-800"
                    onClick={() => toggleSort('rmult')}
                  >
                    <div className="flex items-center gap-1">
                      <span>R:R (Realized)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.pnl && (
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-800 text-right"
                    onClick={() => toggleSort('pnl')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Net P&L</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.outcome && <th className="py-3.5 px-4 text-center">Outcome</th>}
                {visibleColumns.strategy && <th className="py-3.5 px-4">Strategy & Session</th>}
                {visibleColumns.psychology && <th className="py-3.5 px-4">Discipline</th>}
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTrades.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-500">
                    <p className="text-sm font-medium text-slate-700">
                      No trades matched your filter criteria
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try resetting filters or log a new trade execution.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTrades.map((t) => {
                  const isBuy = t.direction === 'BUY';
                  const isWin = t.outcome === 'WIN';
                  const isLoss = t.outcome === 'LOSS';

                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTrade(t)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {visibleColumns.dateTime && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-slate-800 block">
                            {t.entryDate}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {t.entryTime || '—'}
                          </span>
                        </td>
                      )}

                      {visibleColumns.instrument && (
                        <td className="py-3 px-4 font-semibold font-mono text-slate-800">
                          {t.instrument}
                        </td>
                      )}

                      {visibleColumns.direction && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold text-[11px] px-2 py-0.5 rounded border shadow-inner-soft ${
                              isBuy
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}
                          >
                            {t.direction}
                          </span>
                        </td>
                      )}

                      {visibleColumns.levels && (
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          <div>In: {t.entryPrice}</div>
                          <div className="text-slate-400">Out: {t.exitPrice}</div>
                        </td>
                      )}

                      {visibleColumns.levels && (
                        <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                          <div className="text-rose-600 font-semibold">SL: {t.stopLoss}</div>
                          <div className="text-emerald-600 font-semibold">TP: {t.takeProfit}</div>
                        </td>
                      )}

                      {visibleColumns.size && (
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {t.positionSize}L
                        </td>
                      )}

                      {visibleColumns.risk && (
                        <td className="py-3 px-4 font-mono text-slate-500">
                          ${t.riskAmount?.toLocaleString() || '0'}
                        </td>
                      )}

                      {visibleColumns.rr && (
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={
                              (t.rMultiple || 0) > 0
                                ? 'text-emerald-600 font-semibold'
                                : (t.rMultiple || 0) < 0
                                ? 'text-rose-600 font-semibold'
                                : 'text-slate-400'
                            }
                          >
                            {t.rMultiple ? `${t.rMultiple > 0 ? '+' : ''}${t.rMultiple}R` : '0R'}
                          </span>
                        </td>
                      )}

                      {visibleColumns.pnl && (
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              isWin
                                ? 'text-emerald-600'
                                : isLoss
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }
                          >
                            {t.netPnL >= 0 ? '+' : ''}${t.netPnL.toLocaleString()}
                          </span>
                        </td>
                      )}

                      {visibleColumns.outcome && (
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-inner-soft ${
                              isWin
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isLoss
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {t.outcome}
                          </span>
                        </td>
                      )}

                      {visibleColumns.strategy && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-slate-800 font-medium block">
                            {t.strategy}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {t.session} · {t.timeframe}
                          </span>
                        </td>
                      )}

                      {visibleColumns.psychology && (
                        <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                          <span
                            className={
                              t.followedPlan
                                ? 'text-emerald-600 font-medium'
                                : 'text-rose-600 font-medium'
                            }
                          >
                            {t.followedPlan ? 'Plan Followed' : 'Plan Broken'}
                          </span>
                          <span className="text-slate-400 block">{t.moodBefore}</span>
                        </td>
                      )}

                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onSelectTrade(t)}
                            className="p-1 hover:text-emerald-600 text-slate-400"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditTrade(t)}
                            className="p-1 hover:text-slate-800 text-slate-400"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Delete this trade? This cannot be undone.')) {
                                onDeleteTrade(t.id);
                              }
                            }}
                            className="p-1 hover:text-rose-600 text-slate-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-200 bg-slate-50/70 text-xs text-slate-600 gap-3 shadow-inner-soft">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-inner-soft"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>of {sortedTrades.length} trades</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-inner-soft"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-inner-soft"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
