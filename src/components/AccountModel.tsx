import React, { useState } from 'react';
import { X, Wallet, Trash2, CheckCircle2 } from 'lucide-react';
import { useToast } from './common/Toast';
import { AccountType, TradingAccount } from '../types';

export interface AccountFormData {
  name: string;
  broker: string;
  type: AccountType;
  currency: string;
  startingBalance: number;
  isDefault: boolean;
}

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, the modal edits this account; otherwise it creates a new one. */
  account?: TradingAccount | null;
  /** False when this is the user's only account (it cannot be deleted). */
  canDelete?: boolean;
  onSave: (data: AccountFormData) => void | Promise<void>;
  onDelete?: (accountId: string) => void | Promise<void>;
}

const ACCOUNT_TYPES: { value: AccountType; label: string; hint: string }[] = [
  { value: 'live', label: 'Live', hint: 'Real money with your broker' },
  { value: 'prop_firm', label: 'Prop Firm', hint: 'Funded or challenge account' },
  { value: 'demo', label: 'Demo', hint: 'Paper trading / practice' },
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  account,
  canDelete = false,
  onSave,
  onDelete,
}) => {
  const { toast } = useToast();
  const isEditing = !!account;

  const [name, setName] = useState(account?.name ?? '');
  const [broker, setBroker] = useState(account?.broker ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'live');
  const [currency, setCurrency] = useState(account?.currency ?? 'USD');
  const [startingBalance, setStartingBalance] = useState(
    account ? String(account.startingBalance) : '10000'
  );
  const [isDefault, setIsDefault] = useState(account?.isDefault ?? false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const balance = parseFloat(startingBalance);
    if (!name.trim()) {
      toast({ type: 'error', title: 'Account name required', message: 'Give this account a name.' });
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      toast({
        type: 'error',
        title: 'Invalid starting balance',
        message: 'Enter a starting balance of 0 or more.',
      });
      return;
    }

    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        broker: broker.trim(),
        type,
        currency,
        startingBalance: balance,
        isDefault,
      });
      toast({
        type: 'success',
        title: isEditing ? 'Account updated' : 'Account created',
        message: name.trim(),
      });
      onClose();
    } catch (err) {
      console.error('Failed to save account:', err);
      toast({
        type: 'error',
        title: 'Could not save account',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!account || !onDelete || saving) return;
    const ok = window.confirm(
      `Delete "${account.name}"?\n\nAll trades logged under this account will also be permanently deleted. This cannot be undone.`
    );
    if (!ok) return;

    try {
      setSaving(true);
      await onDelete(account.id);
      toast({ type: 'info', title: 'Account deleted', message: account.name });
      onClose();
    } catch (err) {
      console.error('Failed to delete account:', err);
      toast({
        type: 'error',
        title: 'Could not delete account',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-800/30 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-modalIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isEditing ? 'Edit Trading Account' : 'Add Trading Account'}
              </h3>
              <p className="text-xs text-slate-500">
                Track each broker, prop firm or demo account separately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FTMO 100K Challenge"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Broker / Firm</label>
            <input
              type="text"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              placeholder="e.g. IC Markets, FTMO, OANDA"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Account Type</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  title={t.hint}
                  onClick={() => setType(t.value)}
                  className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                    type === t.value
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Starting Balance</label>
              <input
                type="number"
                step="any"
                min="0"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="PKR">PKR (₨)</option>
              </select>
            </div>
          </div>

          {isEditing && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Changing the starting balance recalculates the current balance from your logged trades.
            </p>
          )}

          <label
            className={`flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 ${
              account?.isDefault ? 'opacity-70' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={isDefault}
              disabled={!!account?.isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <div>
              <span className="text-xs font-semibold block text-slate-800">Make default account</span>
              <span className="text-[10px] text-slate-500">
                {account?.isDefault
                  ? 'This is your default account. Make another account default to change it.'
                  : 'New trades are logged here unless you pick another account.'}
              </span>
            </div>
          </label>

          <div className="flex items-center justify-between pt-2">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || saving}
                title={canDelete ? 'Delete this account' : 'You must keep at least one account'}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};