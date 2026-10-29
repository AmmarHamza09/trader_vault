import React, { useEffect, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';

const LABEL: Record<string, string> = { facebook: '📘 Facebook', instagram: '📸 Instagram', linkedin: '💼 LinkedIn', twitter: '𝕏 X', tiktok: '🎵 TikTok', youtube: '▶️ YouTube', pinterest: '📌 Pinterest', reddit: '👽 Reddit', telegram: '✈️ Telegram' };

// One-key connection to a posting service (Ayrshare): the owner links socials on its page, pastes one key here, done.
export const ConnectedAccounts: React.FC = () => {
  const { toast } = useToast();
  const status = useQuery(api.social.status, {});
  const connect = useAction(api.social.connect);
  const listAccounts = useAction(api.social.accounts);
  const disconnect = useMutation(api.social.disconnect);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<string[] | null>(null);

  useEffect(() => {
    if (status?.connected) listAccounts({}).then(setLinked).catch(() => setLinked([]));
    else setLinked(null);
  }, [status?.connected]);

  const save = async () => {
    setBusy(true);
    try {
      const a = await connect({ key });
      setLinked(a); setKey('');
      toast({ type: 'success', title: a.length ? 'Connected ✅' : 'Key saved — now link your socials in Ayrshare' });
    } catch (e: any) {
      toast({ type: 'error', title: String(e?.message ?? e).replace(/^.*Error:\s*/, '').slice(0, 160) });
    }
    setBusy(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-800">🔗 Connected accounts</h3>

      {status?.connected ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Posting service connected. Posts only go out when you press “⚡ Post now” on a specific post.</p>
            <button onClick={() => { if (confirm('Disconnect the posting service?')) disconnect({}); }} className="text-[11px] font-semibold text-rose-500 shrink-0">Disconnect</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {linked === null ? <span className="text-xs text-slate-400">Checking accounts…</span> : linked.length === 0 ? (
              <a href="https://app.ayrshare.com/social-accounts" target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-700">No socials linked yet → link them on Ayrshare</a>
            ) : linked.map((p) => <span key={p} className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">{LABEL[p] ?? p} ✓</span>)}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500">No developer apps needed. You log in to each social once on Ayrshare's own page (your passwords stay with them), then paste one key here.</p>
          <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-5">
            <li><a className="text-emerald-700 font-semibold" href="https://app.ayrshare.com" target="_blank" rel="noreferrer">Open Ayrshare</a> and sign up.</li>
            <li>Under <b>Social Accounts</b>, press Link for Facebook, Instagram, LinkedIn, X.</li>
            <li>Copy your <b>API Key</b> and paste it below.</li>
          </ol>
          <div className="flex gap-2">
            <input value={key} onChange={(e) => setKey(e.target.value)} type="password" autoComplete="off" placeholder="Paste your Ayrshare API key" className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500" />
            <button disabled={busy || key.trim().length < 10} onClick={save} className="px-4 rounded-xl bg-black text-white text-xs font-semibold disabled:opacity-40">{busy ? 'Checking…' : 'Connect'}</button>
          </div>
        </>
      )}
      <p className="text-[11px] text-slate-400">WhatsApp isn't supported by posting services — use the “Post on WhatsApp” button for that one.</p>
    </div>
  );
};
