import React, { useEffect, useRef, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';

type Msg = { role: 'user' | 'agent'; text: string };
const KEY = 'tv_mkt_agent_chat';
const STARTERS = [
  'Plan this week: 3 posts for LinkedIn and Instagram',
  'Write a LinkedIn founder story about why I built TraderVault',
  'Give me 5 hooks for the AI coach feature',
  'Reply to a comment: "is this free?"',
];
const POST_RE = /\[\[POST platform=(\w+)(?: image=(\w+))?\]\]([\s\S]*?)\[\[\/POST\]\]/g;

const load = (): Msg[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };

// Split an agent reply into plain text and ready-to-queue post blocks.
const parts = (text: string) => {
  const out: ({ t: 'text'; v: string } | { t: 'post'; platform: string; image: string; v: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(POST_RE)) {
    if (m.index! > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    out.push({ t: 'post', platform: m[1].toLowerCase(), image: /^\d\d$/.test(m[2] ?? '') ? m[2] : '', v: m[3].trim() });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
};

export const MarketingAgent: React.FC = () => {
  const { toast } = useToast();
  const ask = useAction(api.marketingAi.agentChat);
  const save = useMutation(api.marketing.save);
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ }
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  const send = async (t = text) => {
    const q = t.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: q }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const reply = await ask({ messages: next });
      setMsgs([...next, { role: 'agent', text: reply }]);
    } catch (e: any) {
      setMsgs([...next, { role: 'agent', text: `⚠️ ${String(e?.message ?? e).replace(/^.*Error:\s*/, '').slice(0, 200)}` }]);
    }
    setBusy(false);
  };

  const queue = async (platform: string, image: string, caption: string, status: string) => {
    try {
      await save({ platform, caption, image, status });
      toast({ type: 'success', title: status === 'approved' ? 'Approved and queued ✅' : 'Saved to queue ✍️', message: 'See it in the Studio tab.' });
    } catch (e: any) { toast({ type: 'error', title: 'Could not save', message: e?.message }); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-[70vh] min-h-[420px]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-base">🤖</span>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-none">Marketing Agent</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Knows TraderVault · drafts only, you press post</p>
          </div>
        </div>
        {msgs.length > 0 && <button onClick={() => { if (confirm('Clear this chat?')) setMsgs([]); }} className="text-[11px] text-slate-400 hover:text-slate-600">Clear</button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-slate-500">Hey! 👋 Tell me what to market today.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-emerald-500">{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-black text-white' : 'bg-slate-50 text-slate-700'}`}>
              {m.role === 'user' ? <p className="whitespace-pre-wrap">{m.text}</p> : parts(m.text).map((p, j) => p.t === 'text' ? (
                <p key={j} className="whitespace-pre-wrap">{p.v.replace(/\*\*(.+?)\*\*/g, '$1')}</p>
              ) : (
                <div key={j} className="my-2 rounded-xl border border-emerald-200 bg-white p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{p.platform}{p.image ? ` · ad ${p.image}` : ''}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{p.v}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => queue(p.platform, p.image, p.v, 'draft')} className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">➕ Save draft</button>
                    <button onClick={() => queue(p.platform, p.image, p.v, 'approved')} className="px-2.5 py-1 rounded-lg bg-black text-white text-[11px] font-semibold">✅ Approve</button>
                    <button onClick={async () => { try { await navigator.clipboard.writeText(p.v); toast({ type: 'success', title: 'Copied 📋' }); } catch { /* ignore */ } }} className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold">📋 Copy</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-slate-400 px-2">Agent is thinking… 💭</div>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-slate-100 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the agent… e.g. write 3 LinkedIn posts" className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500" />
        <button disabled={busy || !text.trim()} className="px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">Send</button>
      </form>
    </div>
  );
};
