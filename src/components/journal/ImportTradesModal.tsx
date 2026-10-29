import React, { useRef, useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { TradingAccount } from '../../types';
import { computeTradeDerivedFields } from '../../lib/calculations';
import { parseCSV, normalizeDate, normalizeTime, normalizeDirection } from '../../lib/csv';
import { useToast } from '../common/Toast';
import { ScreenshotImport } from './ScreenshotImport';

interface ImportTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: TradingAccount | null;
  onImported: () => void;
}

const REQUIRED_FIELDS: { key: string; label: string; hints: string[] }[] = [
  { key: 'instrument', label: 'Instrument', hints: ['instrument', 'symbol', 'pair'] },
  { key: 'direction', label: 'Direction (Buy/Sell)', hints: ['direction', 'side', 'type', 'action'] },
  { key: 'entryDate', label: 'Entry Date', hints: ['entry date', 'open date', 'date open'] },
  { key: 'entryTime', label: 'Entry Time', hints: ['entry time', 'open time', 'time open'] },
  { key: 'exitDate', label: 'Exit Date', hints: ['exit date', 'close date', 'date close'] },
  { key: 'exitTime', label: 'Exit Time', hints: ['exit time', 'close time', 'time close'] },
  { key: 'entryPrice', label: 'Entry Price', hints: ['entry price', 'open price', 'price open'] },
  { key: 'exitPrice', label: 'Exit Price', hints: ['exit price', 'close price', 'price close'] },
  { key: 'positionSize', label: 'Position Size', hints: ['size', 'lots', 'volume', 'qty'] },
];

const OPTIONAL_FIELDS: { key: string; label: string; hints: string[] }[] = [
  { key: 'stopLoss', label: 'Stop Loss', hints: ['stop loss', 'sl'] },
  { key: 'takeProfit', label: 'Take Profit', hints: ['take profit', 'tp'] },
  { key: 'commission', label: 'Commission', hints: ['commission', 'comm'] },
  { key: 'swap', label: 'Swap', hints: ['swap'] },
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of ALL_FIELDS) {
    const match = headers.find((h) => field.hints.some((hint) => h.toLowerCase().includes(hint)));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

export const ImportTradesModal: React.FC<ImportTradesModalProps> = ({
  isOpen,
  onClose,
  currentAccount,
  onImported,
}) => {
  const { toast } = useToast();
  const bulkCreateTrades = useMutation(api.trades.bulkCreateTrades);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<'shot' | 'csv'>('shot');

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const result = parseCSV(text);
      if (result.rows.length === 0) {
        toast({ type: 'error', title: 'No rows found', message: 'That file looks empty or unreadable.' });
        return;
      }
      setFileName(file.name);
      setParsed(result);
      setMapping(guessMapping(result.headers));
    };
    reader.readAsText(file);
  };

  const reset = () => {
    setFileName('');
    setParsed(null);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f.key]);

  const handleImport = async () => {
    if (!parsed || !currentAccount) return;
    if (missingRequired.length > 0) {
      toast({
        type: 'error',
        title: 'Map all required fields',
        message: `Still missing: ${missingRequired.map((f) => f.label).join(', ')}`,
      });
      return;
    }

    const idx = (key: string) => parsed.headers.indexOf(mapping[key]);
    const trades: any[] = [];

    for (const row of parsed.rows) {
      const get = (key: string) => {
        const i = idx(key);
        return i >= 0 ? row[i] : '';
      };

      const instrument = get('instrument').trim().toUpperCase();
      const entryPrice = parseFloat(get('entryPrice'));
      const exitPrice = parseFloat(get('exitPrice'));
      const positionSize = parseFloat(get('positionSize'));
      if (!instrument || !entryPrice || !exitPrice || !positionSize) continue;

      const stopLoss = parseFloat(get('stopLoss')) || 0;
      const takeProfit = parseFloat(get('takeProfit')) || 0;
      const commission = parseFloat(get('commission')) || 0;
      const swap = parseFloat(get('swap')) || 0;
      const direction = normalizeDirection(get('direction'));

      const derived = computeTradeDerivedFields({
        instrument,
        direction,
        entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        positionSize,
        commission,
        swap,
        startingBalance: currentAccount.currentBalance,
      });

      trades.push({
        accountId: currentAccount.id,
        instrument,
        direction,
        entryDate: normalizeDate(get('entryDate')),
        entryTime: normalizeTime(get('entryTime')),
        exitDate: normalizeDate(get('exitDate')),
        exitTime: normalizeTime(get('exitTime')),
        entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        positionSize,
        commission,
        swap,
        ...derived,
        strategy: 'Imported',
        timeframe: 'Unknown',
        session: 'London',
        setupType: 'Imported',
        entryReason: 'Imported from CSV',
        exitReason: 'Imported from CSV',
        tags: ['imported'],
        moodBefore: 'Neutral',
        confidenceLevel: 5,
        emotionDuring: 'Disciplined',
        followedPlan: true,
        revengeTrade: false,
        fomoTrade: false,
        screenshots: [],
      });
    }

    if (trades.length === 0) {
      toast({ type: 'error', title: 'Nothing to import', message: "Couldn't parse any valid rows from that file." });
      return;
    }

    setImporting(true);
    try {
      const result = await bulkCreateTrades({ trades } as any);
      toast({
        type: 'success',
        title: 'Import complete',
        message: `Imported ${result.imported} trade${result.imported === 1 ? '' : 's'}${result.skipped ? ` · ${result.skipped} skipped` : ''}.`,
      });
      onImported();
      reset();
      onClose();
    } catch (err: any) {
      toast({ type: 'error', title: 'Import failed', message: err?.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto animate-modalIn">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            📥 Import Trades
          </h2>
          <button onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 p-1.5 mx-4 sm:mx-6 mt-3 bg-slate-100 rounded-xl">
          {([['shot', '📱 Screenshot (MT5 / TradingView)'], ['csv', '📄 CSV File']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'shot' ? (
          <div className="p-4 sm:p-6">
            <ScreenshotImport currentAccount={currentAccount} onDone={() => { onImported(); onClose(); }} />
          </div>
        ) : (
        <div className="p-4 sm:p-6 space-y-5">
          {!parsed ? (
            <div
              className="border-2 border-dashed border-slate-200 rounded-2xl py-10 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <FileText className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Click to choose a CSV, or drag it here</p>
              <p className="text-[11px] text-slate-400">Any broker/platform export with a header row works.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  {fileName} · {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'} detected
                </span>
                <button onClick={reset} className="text-slate-400 hover:text-slate-600 font-semibold">
                  Choose a different file
                </button>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">Map CSV Columns</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {ALL_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center justify-between gap-2">
                      <label className="text-[11px] text-slate-500 shrink-0">
                        {field.label}
                        {REQUIRED_FIELDS.some((f) => f.key === field.key) && (
                          <span className="text-red-500">*</span>
                        )}
                      </label>
                      <select
                        value={mapping[field.key] || ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-white max-w-[140px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        <option value="">— Not in file —</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Trades import into your current account ({currentAccount?.name || 'none selected'}) with sensible
                defaults for fields CSVs usually don't carry (strategy, mood, etc.) — you can edit any trade
                afterward.
              </p>
            </>
          )}
        </div>
        )}

        {tab === 'csv' && parsed && (
          <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100">
            <button
              disabled={importing || missingRequired.length > 0 || !currentAccount}
              onClick={handleImport}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importing…' : `Import ${parsed.rows.length} Trade${parsed.rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
