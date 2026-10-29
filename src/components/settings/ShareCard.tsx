import React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';
import { TradingAccount } from '../../types';

export const ShareCard: React.FC<{ accounts: TradingAccount[] }> = ({ accounts }) => {
  const { toast } = useToast();
  const shares = useQuery(api.share.getMyShares, {});
  const create = useMutation(api.share.createShare);
  const revoke = useMutation(api.share.revokeShare);

  const linkFor = (token: string) => `${window.location.origin}/s/${token}`;
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast({ type: 'success', title: 'Link copied' });
    } catch {
      toast({ type: 'error', title: 'Copy failed', message: 'Select and copy the link manually.' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-inner-card space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">🔗 Share Dashboard</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Create a read-only link for an account. Anyone with the link can view its stats, journal and calendar — without
        signing in and without being able to change anything. Your email, other accounts, goals and AI chats are never
        shown. Turn a link off any time.
      </p>
      <div className="space-y-3">
        {accounts.map((a) => {
          const token = shares?.find((s) => s.accountId === a.id)?.token;
          return (
            <div key={a.id} className="rounded-2xl bg-slate-50 p-3 space-y-2">
              <p className="text-sm font-medium text-slate-900">{a.name}</p>
              {token ? (
                <>
                  <input readOnly value={linkFor(token)} onFocus={(e) => e.currentTarget.select()} className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => copy(token)} className="px-4 py-2 rounded-full text-xs bg-black text-white">Copy link</button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('Turn off this link? Anyone using it loses access.')) await revoke({ accountId: a.id as any });
                      }}
                      className="px-4 py-2 rounded-full text-xs bg-white border border-slate-200 text-rose-600"
                    >
                      Turn off
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try { await create({ accountId: a.id as any }); } catch (e: any) { toast({ type: 'error', title: 'Could not create link', message: e?.message }); }
                  }}
                  className="px-4 py-2 rounded-full text-xs bg-black text-white"
                >
                  Create share link
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
