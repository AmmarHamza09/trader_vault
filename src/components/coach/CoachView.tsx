import React, { useEffect, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ArrowUp, Trash2 } from 'lucide-react';
import { User } from '../../types';
import { useToast } from '../common/Toast';

const SUGGESTIONS = [
  '📊 How is my account doing right now?',
  '🛡️ How much can I still lose today?',
  '🧠 What patterns hurt me most?',
  '😤 Am I revenge trading or overtrading?',
  '🎯 Plan for my next session',
  '📈 What should I focus on to pass my phase?',
];

// Tiny markdown: **bold**, "- " bullets, line breaks.
const renderInline = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

const MessageText: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: number) => {
    if (bullets.length) {
      out.push(
        <ul key={`ul${k}`} className="list-disc pl-5 space-y-1 my-1.5">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };
  lines.forEach((line, i) => {
    const m = line.match(/^\s*[-*•]\s+(.*)$/);
    const h = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (m) bullets.push(m[1]);
    else if (h) {
      flush(i);
      out.push(<p key={i} className="font-semibold text-base mt-3 mb-1">{renderInline(h[1])}</p>);
    } else {
      flush(i);
      if (line.trim()) out.push(<p key={i} className="my-1.5">{renderInline(line)}</p>);
    }
  });
  flush(lines.length);
  return <>{out}</>;
};

export const CoachView: React.FC<{ currentUser: User; currentAccountId: string; accountName?: string }> = ({ currentUser, currentAccountId, accountName }) => {
  const { toast } = useToast();
  const messages = useQuery(api.coach.getMessages, currentAccountId ? { accountId: currentAccountId as any } : 'skip');
  const send = useAction(api.ai.chatWithCoach);
  const clear = useMutation(api.coach.clearChat);

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages?.length, pending, currentAccountId]);

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || pending || !currentAccountId) return;
    setInput('');
    setPending(t);
    try {
      await send({ accountId: currentAccountId as any, text: t });
    } catch (e: any) {
      toast({ type: 'error', title: 'Coach is unavailable', message: e?.message || '' });
    } finally {
      setPending(null);
    }
  };

  const empty = (messages?.length ?? 0) === 0 && !pending;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-11rem)] lg:h-[calc(100vh-11rem)]">
      <div className="flex items-end justify-between px-0.5 mb-3">
        <div>
          <h2 className="text-[28px] lg:text-[34px] leading-tight font-medium tracking-tight text-black">🤖 AI Coach</h2>
          <p className="text-sm text-slate-400 font-light">Chatting about {accountName || 'this account'} only</p>
        </div>
        {!empty && (
          <button
            type="button"
            onClick={async () => {
              if (window.confirm('Clear this conversation?')) await clear({ accountId: currentAccountId as any });
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-white shadow-sm text-slate-600"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 lg:mx-0 lg:px-0 pb-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={!!pending}
            onClick={() => ask(s.replace(/^\S+\s/, ''))}
            className="shrink-0 px-4 py-2.5 rounded-full text-sm bg-white shadow-sm text-slate-900 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 py-3 pr-1">
        {empty && (
          <div className="bg-black text-white rounded-[2rem] p-6">
            <p className="text-xs font-light text-white/60">Coach</p>
            <p className="text-2xl font-light mt-1 leading-snug">Hey {currentUser.name.split(' ')[0]} 👋</p>
            <p className="text-sm font-light text-white/70 mt-2 leading-relaxed">
              I can see your account stage, challenge phases, risk buffers, recent trades and discipline patterns. Ask me
              anything — how much room you have left, why you keep losing in a certain session, or how to stay calm
              after a loss.
            </p>
          </div>
        )}

        {messages?.map((m) => (
          <div key={m._id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] px-4 py-3 text-[15px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-black text-white rounded-[1.5rem] rounded-br-md'
                  : 'bg-white text-slate-900 rounded-[1.5rem] rounded-bl-md shadow-sm'
              }`}
            >
              <MessageText content={m.content} />
            </div>
          </div>
        ))}

        {pending && (
          <>
            {!messages?.some((m) => m.role === 'user' && m.content === pending) && (
              <div className="flex justify-end">
                <div className="max-w-[88%] px-4 py-3 text-[15px] bg-black text-white rounded-[1.5rem] rounded-br-md">{pending}</div>
              </div>
            )}
            <div className="flex justify-start">
              <div className="bg-white shadow-sm rounded-[1.5rem] rounded-bl-md px-5 py-4 flex gap-1.5">
                <span className="loading-dot w-2 h-2 rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="loading-dot w-2 h-2 rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="loading-dot w-2 h-2 rounded-full bg-slate-400" />
              </div>
            </div>
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="shrink-0 pt-2"
      >
        <div className="flex items-center gap-2 bg-white rounded-full shadow-lg p-1.5 pl-5 border border-slate-100">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach…"
            className="coach-input flex-1 min-w-0 bg-transparent text-[15px] focus:outline-none py-2"
          />
          <button
            type="submit"
            disabled={!input.trim() || !!pending}
            className="w-10 h-10 shrink-0 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};
