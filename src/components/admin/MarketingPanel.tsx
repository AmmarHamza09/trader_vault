import React, { useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useToast } from '../common/Toast';
import { MarketingAgent } from './MarketingAgent';
import { ConnectedAccounts } from './ConnectedAccounts';

const ADS: [string, string][] = [
  ['01', 'launch'], ['02', 'ai-coach'], ['03', 'prop-firm'], ['04', 'screenshot-import'], ['05', 'tradingview-sync'], ['06', 'analytics'],
  ['07', 'backtesting'], ['08', 'pine-scripts'], ['09', 'share-link'], ['10', 'leaderboard'], ['11', 'psychology'], ['12', 'cta'],
];
const adUrl = (n: string) => { const a = ADS.find((x) => x[0] === n); return a ? `/ads/tradevault-ad-${a[0]}-${a[1]}.png` : ''; };

const PLATFORMS: { id: string; label: string; emoji: string; open: (text: string) => string }[] = [
  { id: 'facebook', label: 'Facebook', emoji: '📘', open: () => 'https://www.facebook.com/' },
  { id: 'instagram', label: 'Instagram', emoji: '📸', open: () => 'https://www.instagram.com/' },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬', open: (t) => `https://wa.me/?text=${encodeURIComponent(t)}` },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', open: (t) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(t)}` },
  { id: 'x', label: 'X', emoji: '𝕏', open: (t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}` },
];
const ANGLES = [
  'Launch announcement', 'AI coach that knows your account', 'Pass your prop-firm challenge', 'Snap a screenshot, we log the trade',
  'TradingView alerts into your journal', 'Find your edge with analytics', 'Backtesting is coming soon', 'Share results without losing privacy',
  'Revenge trading and psychology', 'Climb the leaderboard',
];
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-amber-100 text-amber-700',
  posted: 'bg-emerald-100 text-emerald-700',
};

// Admin-only marketing studio: draft posts with AI, pick an ad image, approve, then one-click open the platform to post.
export const MarketingPanel: React.FC = () => {
  const { toast } = useToast();
  const posts = useQuery(api.marketing.list, {});
  const save = useMutation(api.marketing.save);
  const setStatus = useMutation(api.marketing.setStatus);
  const remove = useMutation(api.marketing.remove);
  const generate = useAction(api.marketingAi.generatePost);
  const postNow = useAction(api.social.postNow);
  const autoPost = !!useQuery(api.social.status, {})?.connected;

  const [platform, setPlatform] = useState('instagram');
  const [angle, setAngle] = useState(ANGLES[0]);
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState('01');
  const [editing, setEditing] = useState<Id<'marketingPosts'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'agent' | 'studio'>('agent');

  const plat = PLATFORMS.find((p) => p.id === platform)!;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { toast({ type: 'error', title: String(e?.message ?? e).replace(/^.*Error:\s*/, '').slice(0, 160) }); }
    setBusy(false);
  };

  const onGenerate = () => run(async () => { setCaption(await generate({ platform, angle })); });
  const onSave = (status = 'draft') => run(async () => {
    if (!caption.trim()) throw new Error('Write or generate a caption first.');
    await save({ id: editing ?? undefined, platform, caption: caption.trim(), image, status });
    setCaption(''); setEditing(null);
    toast({ type: 'success', title: status === 'approved' ? 'Approved ✅' : 'Saved as draft ✍️' });
  });
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast({ type: 'success', title: 'Caption copied 📋' }); } catch { toast({ type: 'error', title: 'Copy failed — select the text manually' }); } };
  const edit = (p: NonNullable<typeof posts>[number]) => { setEditing(p._id); setPlatform(p.platform); setCaption(p.caption); setImage(p.image || '01'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const shown = (posts ?? []).filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-black text-white p-6">
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl font-medium tracking-tight">📣 Marketing Studio</h2>
          <p className="text-sm text-white/60 font-light mt-1 max-w-xl">Draft with AI, pick an ad, approve, then post in one click. You stay in control — nothing is published without you pressing the platform button.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        {([['agent', '🤖 Agent chat'], ['studio', '✍️ Studio & queue']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${view === id ? 'bg-black text-white' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      <ConnectedAccounts />

      {view === 'agent' && <MarketingAgent />}

      {view === 'studio' && (<>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button key={p.id} onClick={() => setPlatform(p.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${platform === p.id ? 'bg-black text-white border-black' : 'bg-white text-slate-600 border-slate-200'}`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={angle} onChange={(e) => setAngle(e.target.value)} className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white max-w-full">
            {ANGLES.map((a) => <option key={a}>{a}</option>)}
          </select>
          <button disabled={busy} onClick={onGenerate} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
            {busy ? 'Working…' : '✨ Generate with AI'}
          </button>
        </div>

        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} placeholder={`Write your ${plat.label} caption, or generate one…`}
          className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-500" />
        <div className="text-[11px] text-slate-400 -mt-2">{caption.length} characters{platform === 'x' && caption.length > 280 ? ' — too long for X' : ''}</div>

        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Ad image</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button onClick={() => setImage('')} className={`shrink-0 w-16 h-20 rounded-xl border text-[10px] ${image === '' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'}`}>No image</button>
            {ADS.map(([n]) => (
              <button key={n} onClick={() => setImage(n)} className={`shrink-0 rounded-xl overflow-hidden border ${image === n ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'}`}>
                <img src={adUrl(n)} alt={`Ad ${n}`} className="w-16 h-20 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => onSave('draft')} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">{editing ? 'Update draft' : 'Save draft'}</button>
          <button disabled={busy} onClick={() => onSave('approved')} className="px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold">✅ Approve</button>
          {editing && <button onClick={() => { setEditing(null); setCaption(''); }} className="px-3 py-2 text-xs text-slate-500">Cancel edit</button>}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-800">Queue ({shown.length})</h3>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {['all', 'draft', 'approved', 'posted'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize ${filter === f ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>{f}</button>
          ))}
        </div>
      </div>

      {posts === undefined ? <p className="text-sm text-slate-400">Loading…</p> : shown.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">Nothing here yet — generate your first post above. 🚀</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {shown.map((p) => {
            const pl = PLATFORMS.find((x) => x.id === p.platform)!;
            const url = adUrl(p.image);
            return (
              <div key={p._id} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-3">
                {url && <img src={url} alt="" className="w-20 h-24 object-cover rounded-xl shrink-0" loading="lazy" />}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">{pl?.emoji} {pl?.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_STYLE[p.status] ?? ''}`}>{p.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-5">{p.caption}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => copy(p.caption)} className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">📋 Copy</button>
                    {url && <a href={url} download className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">⬇️ Image</a>}
                    <button onClick={() => edit(p)} className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">✏️ Edit</button>
                    {p.status !== 'posted' && p.platform !== 'whatsapp' && autoPost && (
                      <button disabled={busy} onClick={() => { if (confirm(`Publish this to ${pl.label} now?`)) run(async () => { await postNow({ postId: p._id }); toast({ type: 'success', title: `Posted on ${pl.label} 🎉` }); }); }} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold">⚡ Post now</button>
                    )}
                    {p.status !== 'posted' && (
                      <a href={pl.open(p.caption)} target="_blank" rel="noreferrer" onClick={() => { copy(p.caption); }} className="px-2.5 py-1 rounded-lg bg-black text-white text-[11px] font-semibold">🚀 Post on {pl.label}</a>
                    )}
                    {p.status !== 'posted' && <button onClick={() => setStatus({ id: p._id, status: 'posted' })} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold">✔ Mark posted</button>}
                    <button onClick={() => { if (confirm('Delete this post?')) remove({ id: p._id }); }} className="px-2.5 py-1 rounded-lg text-rose-500 text-[11px] font-semibold">🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}
      <p className="text-[11px] text-slate-400">“Post on …” copies the caption and opens that platform (WhatsApp, LinkedIn and X pre-fill the text). Upload the downloaded image there, then press “Mark posted”. Instagram and Facebook don't allow pre-filled posts from the web.</p>
    </div>
  );
};
