import React, { useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Camera, Plus, Trash2, X, RotateCcw, Lock, Play } from 'lucide-react';
import { TradingAccount } from '../../types';
import { ImageUploader } from '../common/ImageUploader';
import { useToast } from '../common/Toast';

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const STAGES = ['Phase 1', 'Phase 2', 'Funded / Payout'];
const STAGE_EMOJI: Record<string, string> = { 'Phase 1': '1️⃣', 'Phase 2': '2️⃣', 'Funded / Payout': '💸' };

const PRESETS: { label: string; target: number; daily: number; max: number }[] = [
  { label: 'The5ers 1-Step', target: 8, daily: 3, max: 10 },
  { label: 'The5ers 2-Step', target: 5, daily: 3, max: 10 },
  { label: 'FTMO P1', target: 10, daily: 5, max: 10 },
  { label: 'FTMO P2', target: 5, daily: 5, max: 10 },
  { label: 'Funding Pips', target: 8, daily: 4, max: 8 },
];

type Phase = NonNullable<ReturnType<typeof useQuery<typeof api.phases.getUserPhases>>>[number];

export const PhasesSection: React.FC<{
  accounts: TradingAccount[];
  currentAccountId?: string;
  readOnly?: boolean;
}> = ({ accounts, currentAccountId, readOnly }) => {
  const allPhases = useQuery(api.phases.getUserPhases, {});
  const currentAccount = accounts.find((a) => a.id === currentAccountId) || accounts[0] || null;
  const [showImport, setShowImport] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Build chains (Phase 1 → Phase 2 → Funded) via prevPhaseId; keep chains that touch this account.
  const chains = useMemo(() => {
    if (!allPhases) return [];
    const byId = new Map(allPhases.map((p) => [p._id, p]));
    const children = new Map<string, Phase>();
    for (const p of allPhases) if (p.prevPhaseId && byId.has(p.prevPhaseId)) children.set(p.prevPhaseId, p);
    const roots = allPhases.filter((p) => !p.prevPhaseId || !byId.has(p.prevPhaseId));
    return roots
      .map((root) => {
        const chain: Phase[] = [root];
        let cur: Phase | undefined = children.get(root._id);
        while (cur) {
          chain.push(cur);
          cur = children.get(cur._id);
        }
        return chain;
      })
      .filter((chain) => chain.some((p) => (p.accountId ? p.accountId === currentAccount?.id : true)));
  }, [allPhases, currentAccount?.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-0.5">
        <h2 className="text-[28px] leading-tight font-medium tracking-tight text-black">Phases</h2>
        <span className="text-sm text-slate-400 font-light pb-1">{currentAccount?.name}</span>
      </div>

      {!readOnly && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 pb-1">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-base bg-black text-white shadow-sm"
          >
            <Camera className="w-4 h-4" /> Import from screenshot
          </button>
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-base bg-white text-slate-900 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add manually
          </button>
        </div>
      )}

      {allPhases === undefined && <p className="text-sm text-slate-400 px-1">Loading phases…</p>}
      {allPhases && chains.length === 0 && (
        <div className="bg-white rounded-[1.75rem] p-8 text-center shadow-sm">
          <p className="text-3xl mb-2">🚩</p>
          <p className="text-base text-slate-900">No phases for this account yet</p>
          <p className="text-sm text-slate-400 font-light mt-1">
            Upload a screenshot of your prop firm challenge (The5ers, FTMO, Funding Pips…) and I’ll create Phase 1,
            Phase 2 and the payout stage for you.
          </p>
        </div>
      )}

      {chains.map((chain) => (
        <ChainCard key={chain[0]._id} chain={chain} accounts={accounts} readOnly={readOnly} />
      ))}

      {showImport && !readOnly && (
        <ImportChallengeModal accounts={accounts} defaultAccountId={currentAccount?.id} onClose={() => setShowImport(false)} />
      )}
      {showManual && !readOnly && (
        <ManualPhaseModal accounts={accounts} defaultAccount={currentAccount} onClose={() => setShowManual(false)} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------- chain card

const ChainCard: React.FC<{ chain: Phase[]; accounts: TradingAccount[]; readOnly?: boolean }> = ({
  chain,
  accounts,
  readOnly,
}) => {
  const activeIdx = chain.findIndex((p) => p.progress.status === 'active');
  const [selected, setSelected] = useState<string | null>(null);
  const defaultIdx = activeIdx >= 0 ? activeIdx : chain.length - 1;
  const phase = chain.find((p) => p._id === selected) ?? chain[defaultIdx];

  return (
    <div className="space-y-3">
      {chain.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5">
          {chain.map((p) => {
            const st = p.progress.status;
            const on = p._id === phase._id;
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => setSelected(p._id)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm shadow-sm ${
                  on ? 'bg-black text-white' : 'bg-white text-slate-900'
                }`}
              >
                <span>{STAGE_EMOJI[p.stage ?? ''] ?? '🚩'}</span>
                {p.stage ?? p.name}
                <span>{st === 'passed' ? '✅' : st === 'failed' ? '❌' : st === 'upcoming' ? '🔒' : '▶️'}</span>
              </button>
            );
          })}
        </div>
      )}
      {phase.progress.status === 'upcoming' ? (
        <LockedStage
          phase={phase}
          prev={chain[chain.findIndex((p) => p._id === phase._id) - 1]}
          accounts={accounts}
          readOnly={readOnly}
        />
      ) : (
        <PhaseDetail key={phase._id} phase={phase} accounts={accounts} readOnly={readOnly} />
      )}
    </div>
  );
};

// -------------------------------------------------------------- phase detail

const PhaseDetail: React.FC<{ phase: Phase; accounts: TradingAccount[]; readOnly?: boolean }> = ({
  phase: p,
  accounts,
  readOnly,
}) => {
  const { toast } = useToast();
  const deletePhase = useMutation(api.phases.deletePhase);
  const resetPhase = useMutation(api.phases.resetPhase);
  const activatePhase = useMutation(api.phases.activatePhase);
  const setPhaseAccount = useMutation(api.phases.setPhaseAccount);
  const addImage = useMutation(api.phases.addPhaseImage);
  const generateUploadUrl = useMutation(api.trades.generateUploadUrl);

  const pr = p.progress;
  const passed = pr.status === 'passed';
  const failed = pr.status === 'failed';
  const upcoming = pr.status === 'upcoming';
  const account = accounts.find((a) => a.id === p.accountId);
  const hasTarget = p.targetBalance > p.startBalance;
  const pctTarget = Math.round(((p.targetBalance - p.startBalance) / p.startBalance) * 1000) / 10;

  const lossTone = (pct: number | null) => ((pct ?? 0) <= 25 ? 'rose' : (pct ?? 0) <= 50 ? 'amber' : 'slate');

  return (
    <div className="space-y-3">
      {/* Black banner */}
      <div
        className={`relative overflow-hidden rounded-[2rem] p-6 text-white ${
          failed ? 'bg-gradient-to-br from-black to-rose-950' : passed ? 'bg-gradient-to-br from-black to-emerald-950' : 'bg-black'
        }`}
      >
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-emerald-500/15 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-light text-white/60">
              {p.firm ? `${p.firm} · ` : ''}
              {p.stage ?? 'Phase'}
            </p>
            <p className="text-[32px] leading-tight font-light mt-1">{money(pr.currentBalance)}</p>
            <p className={`text-sm font-light ${pr.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pr.totalPnL >= 0 ? '+' : ''}
              {money(pr.totalPnL)} since start
            </p>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full ${
                passed ? 'bg-emerald-500/20 text-emerald-300' : failed ? 'bg-rose-500/20 text-rose-300' : upcoming ? 'bg-white/10 text-white/70' : 'bg-white/10 text-white'
              }`}
            >
              {(passed || failed) && <Lock className="w-3 h-3" />}
              {passed ? 'Passed' : failed ? 'Failed' : upcoming ? 'Upcoming' : 'Active'}
            </span>
            <p className="text-xs font-light text-white/50 mt-2">
              {hasTarget ? `${money(p.startBalance)} → ${money(p.targetBalance)}` : `from ${money(p.startBalance)}`}
            </p>
            <p className="text-xs font-light text-white/50">{hasTarget ? `${pctTarget}% target` : '💸 payout stage'}</p>
          </div>
        </div>
        <div className="relative flex flex-wrap gap-1.5 mt-3">
          {p.instant && <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/80">⚡ Instant funded</span>}
          {p.maxTotalLoss != null && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/80">
              {p.drawdownType === 'trailing' ? `📈 Trailing drawdown${p.trailingLock ? ' · locks at start' : ''}` : '📌 Static drawdown'}
            </span>
          )}
          {p.drawdownType === 'trailing' && !upcoming && <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/80">Peak {money(pr.peak)}</span>}
        </div>
        {failed && pr.failReason && <p className="relative text-xs text-rose-300 mt-3">{pr.failReason}</p>}
        {(passed || failed) && (
          <p className="relative text-[11px] font-light text-white/40 mt-2">
            Locked — later gains or losses won’t change this result.
          </p>
        )}
        {upcoming && (
          <p className="relative text-xs font-light text-white/60 mt-3">
            Unlocks automatically when the previous phase is passed.
          </p>
        )}
      </div>

      {/* Tiles: how much room is left */}
      {(
        <div className="grid grid-cols-3 gap-2">
          {hasTarget ? (
            <Tile label="To target" value={money(pr.profitRemaining)} sub={passed ? 'reached 🎉' : 'profit left'} tone="emerald" />
          ) : (
            <Tile label="Profit" value={money(pr.totalPnL)} sub="this stage" tone={pr.totalPnL >= 0 ? 'emerald' : 'rose'} />
          )}
          {p.maxDailyLoss != null && (
            <Tile label="Lose today" value={money(pr.dailyLossRoom ?? 0)} sub="before daily breach" tone={lossTone(pr.dailyLossPct)} />
          )}
          {p.maxTotalLoss != null && (
            <Tile label="Left to lose" value={money(pr.totalLossRoom ?? 0)} sub={p.drawdownType === 'trailing' ? 'to trailing floor' : 'before blown'} tone={lossTone(pr.totalLossPct)} />
          )}
        </div>
      )}

      {/* Meters */}
      {(
        <div className="bg-white rounded-[1.75rem] p-5 space-y-4 shadow-sm">
          {hasTarget && <Meter label="📈 Profit target" pct={pr.progressPct} tone="emerald" left={`${money(pr.currentBalance)} / ${money(p.targetBalance)}`} right={`${pr.progressPct}%`} />}
          {p.maxDailyLoss != null && (
            <Meter label="🛡️ Daily loss buffer" pct={pr.dailyLossPct ?? 0} tone={lossTone(pr.dailyLossPct)} left={`floor today ${money(pr.dailyLossFloor ?? 0)}`} right={`limit ${money(p.maxDailyLoss)}`} />
          )}
          {p.maxTotalLoss != null && (
            <Meter label="🔻 Max loss buffer" pct={pr.totalLossPct ?? 0} tone={lossTone(pr.totalLossPct)} left={p.drawdownType === 'trailing' ? `floor ${money(pr.totalLossFloor ?? 0)} · peak ${money(pr.peak)}` : `breach below ${money(pr.totalLossFloor ?? 0)}`} right={`limit ${money(p.maxTotalLoss)}`} />
          )}
          {p.dailyProfitTarget != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 font-light">🎯 Daily goal {money(p.dailyProfitTarget)}</span>
              <span className={pr.dailyProfitHit ? 'text-emerald-600' : 'text-slate-500'}>
                today {pr.todayPnL >= 0 ? '+' : ''}
                {money(pr.todayPnL)} {pr.dailyProfitHit ? '✓' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Account + proof images + actions */}
      <div className="bg-white rounded-[1.75rem] p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-500 font-light">Account</span>
          {!readOnly && !pr.locked ? (
            <select
              value={p.accountId ?? ''}
              onChange={async (e) => {
                try {
                  await setPhaseAccount({ phaseId: p._id, accountId: e.target.value as Id<'accounts'> });
                } catch (err: any) {
                  toast({ type: 'error', title: 'Could not change account', message: err?.message });
                }
              }}
              className="text-sm bg-slate-100 rounded-full px-3 py-1.5 max-w-[60%]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-900">{account?.name ?? '—'}</span>
          )}
        </div>

        {p.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {p.images.map((im, i) => (
              <a key={i} href={im.url} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={im.url} alt="Prop firm screenshot" className="h-20 w-28 object-cover rounded-xl border border-slate-200" />
              </a>
            ))}
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-wrap gap-2 pt-1">
            {upcoming && (
              <button
                type="button"
                onClick={() => activatePhase({ phaseId: p._id })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-black text-white"
              >
                <Play className="w-3.5 h-3.5" /> Start now
              </button>
            )}
            <div className="w-full sm:w-auto">
              <ImageUploader
                compact
                label="📎 Add proof screenshot"
                generateUploadUrl={() => generateUploadUrl()}
                onUploaded={async (storageId) => {
                  await addImage({ phaseId: p._id, storageId });
                  toast({ type: 'success', title: 'Screenshot attached' });
                }}
              />
            </div>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(pr.locked ? 'Unlock and restart this phase from today?' : 'Restart this phase from today?')) {
                  await resetPhase({ phaseId: p._id });
                  toast({ type: 'success', title: 'Phase restarted' });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-slate-100 text-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {pr.locked ? 'Unlock & restart' : 'Restart'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(`Delete “${p.name}”?`)) await deletePhase({ phaseId: p._id });
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-rose-50 text-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------- locked stage

const LockedStage: React.FC<{
  phase: Phase;
  prev?: Phase;
  accounts: TradingAccount[];
  readOnly?: boolean;
}> = ({ phase, prev, accounts, readOnly }) => {
  const activatePhase = useMutation(api.phases.activatePhase);
  return (
    <div className="relative">
      <div className="blur-md select-none pointer-events-none opacity-60" aria-hidden>
        <PhaseDetail phase={phase} accounts={accounts} readOnly />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-2">
        <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center shadow-lg">
          <Lock className="w-6 h-6" />
        </div>
        <p className="text-lg font-medium text-black">{phase.stage ?? 'Next stage'} locked</p>
        <p className="text-sm text-slate-600 font-light max-w-[16rem]">
          {prev ? `Pass ${prev.stage ?? 'the previous phase'} to unlock this stage.` : 'Complete the previous stage to unlock.'}
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Unlock this stage manually? (Only if you already moved to a new account for it.)'))
                activatePhase({ phaseId: phase._id });
            }}
            className="text-xs text-slate-500 underline underline-offset-2 mt-1"
          >
            Unlock manually
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- small bits

const TILE_TONE: Record<string, string> = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  slate: 'text-slate-900',
};
const Tile: React.FC<{ label: string; value: string; sub: string; tone: string }> = ({ label, value, sub, tone }) => (
  <div className="bg-white rounded-[1.5rem] p-3.5 text-center shadow-sm min-w-0">
    <p className="text-[11px] text-slate-400 font-light">{label}</p>
    <p className={`text-[17px] font-medium mt-1 truncate ${TILE_TONE[tone]}`}>{value}</p>
    <p className="text-[10px] text-slate-400 font-light mt-0.5">{sub}</p>
  </div>
);

const BAR_TONE: Record<string, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-800',
};
const Meter: React.FC<{ label: string; pct: number; tone: string; left: string; right: string }> = ({ label, pct, tone, left, right }) => (
  <div>
    <div className="flex items-center justify-between text-sm mb-1.5">
      <span className="text-slate-900">{label}</span>
      <span className="text-slate-400 font-light text-xs">{right}</span>
    </div>
    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${BAR_TONE[tone]}`} style={{ width: `${pct}%` }} />
    </div>
    <p className="text-xs text-slate-500 font-light mt-1.5">{left}</p>
  </div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/30 backdrop-blur-sm animate-fadeIn">
    <div className="w-full max-w-md bg-[#f4f4f5] rounded-t-[2rem] sm:rounded-[2rem] max-h-[92vh] overflow-y-auto animate-modalIn">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-xl font-medium text-black">{title}</h3>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-slate-500 shadow-sm">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 pb-6 space-y-3">{children}</div>
    </div>
  </div>
);

const Seg: React.FC<{ value: string; onChange: (v: string) => void; options: [string, string][] }> = ({ value, onChange, options }) => (
  <div className="flex rounded-full bg-white shadow-sm p-1 gap-1">
    {options.map(([id, label]) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        className={`flex-1 px-3 py-2 rounded-full text-sm ${value === id ? 'bg-black text-white' : 'text-slate-600'}`}
      >
        {label}
      </button>
    ))}
  </div>
);

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-2xl bg-white border-0 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40';
const Lbl: React.FC<{ t: string; children: React.ReactNode }> = ({ t, children }) => (
  <label className="block">
    <span className="block text-xs text-slate-500 font-light mb-1 px-1">{t}</span>
    {children}
  </label>
);

// --------------------------------------------------------- import from screenshot

interface DraftStage {
  stage: string;
  targetPct: string;
  dailyLossPct: string;
  maxLossPct: string;
}

const ImportChallengeModal: React.FC<{
  accounts: TradingAccount[];
  defaultAccountId?: string;
  onClose: () => void;
}> = ({ accounts, defaultAccountId, onClose }) => {
  const { toast } = useToast();
  const generateUploadUrl = useMutation(api.trades.generateUploadUrl);
  const extract = useAction(api.ai.extractChallengeFromScreenshot);
  const createChallenge = useMutation(api.phases.createChallenge);

  const [reading, setReading] = useState(false);
  const [storageId, setStorageId] = useState<Id<'_storage'> | null>(null);
  const [firm, setFirm] = useState('');
  const [size, setSize] = useState('');
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '');
  const [stages, setStages] = useState<DraftStage[] | null>(null);
  const [program, setProgram] = useState<'2step' | '1step' | 'instant'>('2step');
  const [drawdown, setDrawdown] = useState<'static' | 'trailing'>('static');
  const [trailLock, setTrailLock] = useState(false);
  const [saving, setSaving] = useState(false);

  const onUploaded = async (id: Id<'_storage'>) => {
    setStorageId(id);
    setReading(true);
    try {
      const r: any = await Promise.race([
        extract({ storageId: id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('The AI took too long — please try again (or use "Add manually").')), 75000)),
      ]);
      setFirm(r.firm ?? '');
      const prog: '2step' | '1step' | 'instant' = r.programType ?? (r.stages?.length === 1 ? 'instant' : r.stages?.length === 2 ? '1step' : '2step');
      setProgram(prog);
      setDrawdown(r.drawdownType === 'trailing' ? 'trailing' : 'static');
      setTrailLock(!!r.trailingLocksAtStart);
      const acc = accounts.find((a) => a.id === accountId);
      setSize(String(r.accountSize ?? Math.round(acc?.startingBalance ?? 100000)));
      setStages(
        (r.stages?.length
          ? r.stages
          : prog === 'instant'
            ? [{ stage: 'Funded / Payout', targetPct: 0, dailyLossPct: 3, maxLossPct: 6 }]
            : [
                { stage: 'Phase 1', targetPct: 8, dailyLossPct: 3, maxLossPct: 10 },
                { stage: 'Phase 2', targetPct: 5, dailyLossPct: 3, maxLossPct: 10 },
                { stage: 'Funded / Payout', targetPct: 0, dailyLossPct: 3, maxLossPct: 10 },
              ]
        ).map((s: any) => ({
          stage: s.stage,
          targetPct: String(s.targetPct ?? 0),
          dailyLossPct: s.dailyLossPct != null ? String(s.dailyLossPct) : '',
          maxLossPct: s.maxLossPct != null ? String(s.maxLossPct) : '',
        }))
      );
      if (!r.stages?.length) toast({ type: 'info', title: "Couldn't read stages", message: 'Filled a standard 2-step template — edit as needed.' });
    } catch (e: any) {
      toast({ type: 'error', title: 'Could not read screenshot', message: e?.message });
    } finally {
      setReading(false);
    }
  };

  // Switching program type rebuilds the stage list, keeping the loss limits already entered.
  const switchProgram = (next: '2step' | '1step' | 'instant') => {
    setProgram(next);
    setStages((cur) => {
      const base = cur?.[0] ?? { stage: 'Phase 1', targetPct: '8', dailyLossPct: '3', maxLossPct: '10' };
      const keep = { dailyLossPct: base.dailyLossPct, maxLossPct: base.maxLossPct };
      if (next === 'instant') return [{ stage: 'Funded / Payout', targetPct: '0', ...keep }];
      if (next === '1step') return [{ stage: 'Phase 1', targetPct: cur?.find((x) => x.stage === 'Phase 1')?.targetPct ?? '8', ...keep }, { stage: 'Funded / Payout', targetPct: '0', ...keep }];
      return [
        { stage: 'Phase 1', targetPct: cur?.find((x) => x.stage === 'Phase 1')?.targetPct ?? '8', ...keep },
        { stage: 'Phase 2', targetPct: cur?.find((x) => x.stage === 'Phase 2')?.targetPct ?? '5', ...keep },
        { stage: 'Funded / Payout', targetPct: '0', ...keep },
      ];
    });
  };

  const setStage = (i: number, k: keyof DraftStage, v: string) =>
    setStages((s) => s!.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const create = async () => {
    const accountSize = parseFloat(size);
    if (!accountSize || !accountId || !stages?.length) return toast({ type: 'error', title: 'Check account size and account' });
    setSaving(true);
    try {
      await createChallenge({
        firm: firm.trim() || 'Prop Firm',
        accountId: accountId as Id<'accounts'>,
        accountSize,
        imageStorageId: storageId ?? undefined,
        drawdownType: drawdown,
        trailingLock: drawdown === 'trailing' ? trailLock : undefined,
        instant: program === 'instant' ? true : undefined,
        stages: stages.map((s) => ({
          stage: s.stage,
          targetPct: parseFloat(s.targetPct) || 0,
          dailyLossPct: s.dailyLossPct ? parseFloat(s.dailyLossPct) : undefined,
          maxLossPct: s.maxLossPct ? parseFloat(s.maxLossPct) : undefined,
        })),
      });
      toast({ type: 'success', title: program === 'instant' ? 'Instant account set up' : 'Challenge created', message: `${stages.length} ${stages.length === 1 ? 'stage' : 'stages'} set up · ${drawdown} drawdown.` });
      onClose();
    } catch (e: any) {
      toast({ type: 'error', title: 'Could not create', message: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="📸 Import challenge" onClose={onClose}>
      <p className="text-sm text-slate-500 font-light">
        Upload a screenshot of your prop firm’s rules or account page (The5ers, FTMO, Funding Pips…). I’ll read it — 2-step, 1-step or
        instant funded, static or trailing drawdown — and set up the phases. Only the first stage is active; the next unlocks when you pass.
      </p>

      {!stages &&
        (reading ? (
          <div className="flex items-center gap-2 justify-center py-8 text-sm text-violet-600">
            <span className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
            Reading your screenshot…
          </div>
        ) : (
          <ImageUploader generateUploadUrl={() => generateUploadUrl()} onUploaded={onUploaded} label="Upload prop firm screenshot" />
        ))}

      {stages && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Lbl t="Firm">
              <input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="The5ers" className={inputCls} />
            </Lbl>
            <Lbl t="Account size ($)">
              <input type="number" value={size} onChange={(e) => setSize(e.target.value)} className={inputCls} />
            </Lbl>
          </div>
          <Lbl t="Track on account">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Lbl>

          <Lbl t="Account type">
            <Seg value={program} onChange={(v) => switchProgram(v as any)} options={[['2step', '2-Step'], ['1step', '1-Step'], ['instant', '⚡ Instant']]} />
          </Lbl>
          <Lbl t="Max loss (drawdown) type">
            <Seg value={drawdown} onChange={(v) => setDrawdown(v as any)} options={[['static', '📌 Static'], ['trailing', '📈 Trailing']]} />
          </Lbl>
          {drawdown === 'trailing' && (
            <label className="flex items-center gap-2 text-sm text-slate-600 px-1">
              <input type="checkbox" checked={trailLock} onChange={(e) => setTrailLock(e.target.checked)} />
              Stops trailing once the floor reaches the starting balance
            </label>
          )}

          <div className="space-y-2">
            {stages.map((s, i) => (
              <div key={i} className="bg-white rounded-[1.5rem] p-3.5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <select value={s.stage} onChange={(e) => setStage(i, 'stage', e.target.value)} className="text-sm font-medium bg-transparent">
                    {STAGES.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                  <button onClick={() => setStages((x) => x!.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Lbl t="Target %">
                    <input type="number" value={s.targetPct} onChange={(e) => setStage(i, 'targetPct', e.target.value)} className={inputCls} />
                  </Lbl>
                  <Lbl t="Daily loss %">
                    <input type="number" value={s.dailyLossPct} onChange={(e) => setStage(i, 'dailyLossPct', e.target.value)} className={inputCls} />
                  </Lbl>
                  <Lbl t="Max loss %">
                    <input type="number" value={s.maxLossPct} onChange={(e) => setStage(i, 'maxLossPct', e.target.value)} className={inputCls} />
                  </Lbl>
                </div>
              </div>
            ))}
          </div>

          <button
            disabled={saving}
            onClick={create}
            className="w-full py-3 rounded-full text-base text-white bg-black disabled:opacity-60"
          >
            {saving ? 'Creating…' : program === 'instant' ? 'Set up instant account' : `Create ${stages.length} phases`}
          </button>
        </>
      )}
    </Modal>
  );
};

// ------------------------------------------------------------- manual phase

const ManualPhaseModal: React.FC<{
  accounts: TradingAccount[];
  defaultAccount: TradingAccount | null;
  onClose: () => void;
}> = ({ accounts, defaultAccount, onClose }) => {
  const { toast } = useToast();
  const createPhase = useMutation(api.phases.createPhase);
  const [saving, setSaving] = useState(false);
  const start0 = defaultAccount ? Math.round(defaultAccount.currentBalance) : 100000;
  const [f, setF] = useState({
    firm: '',
    stage: 'Phase 1',
    accountId: defaultAccount?.id ?? accounts[0]?.id ?? '',
    start: String(start0),
    target: String(Math.round(start0 * 1.08)),
    daily: '',
    max: '',
    dailyProfit: '',
    drawdown: 'static',
    trailLock: false,
    instant: false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const s = parseFloat(f.start) || start0;
    setF((x) => ({
      ...x,
      target: String(Math.round(s * (1 + p.target / 100))),
      daily: String(Math.round((s * p.daily) / 100)),
      max: String(Math.round((s * p.max) / 100)),
    }));
  };

  const submit = async () => {
    const start = parseFloat(f.start);
    const target = parseFloat(f.target);
    if (!f.accountId) return toast({ type: 'error', title: 'Pick an account' });
    if (!start || (!f.instant && (!target || target <= start))) return toast({ type: 'error', title: 'Target must be above start balance' });
    setSaving(true);
    try {
      await createPhase({
        name: `${f.firm.trim() ? f.firm.trim() + ' — ' : ''}${f.stage}`,
        firm: f.firm.trim() || undefined,
        stage: f.instant ? 'Funded / Payout' : f.stage,
        accountId: f.accountId as Id<'accounts'>,
        startBalance: start,
        targetBalance: f.instant ? start : target,
        drawdownType: f.drawdown,
        trailingLock: f.drawdown === 'trailing' ? f.trailLock : undefined,
        instant: f.instant || undefined,
        dailyProfitTarget: f.dailyProfit ? Math.abs(parseFloat(f.dailyProfit)) : undefined,
        maxDailyLoss: f.daily ? Math.abs(parseFloat(f.daily)) : undefined,
        maxTotalLoss: f.max ? Math.abs(parseFloat(f.max)) : undefined,
      });
      toast({ type: 'success', title: 'Phase created' });
      onClose();
    } catch (e: any) {
      toast({ type: 'error', title: 'Could not create', message: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🚩 New phase" onClose={onClose}>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => applyPreset(p)} className="shrink-0 px-4 py-2 rounded-full text-sm bg-white shadow-sm">
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 font-light -mt-1 px-1">Presets are typical rules — always check your firm’s current terms.</p>
      <div className="grid grid-cols-2 gap-2">
        <Lbl t="Firm (optional)">
          <input value={f.firm} onChange={(e) => set('firm', e.target.value)} placeholder="The5ers" className={inputCls} />
        </Lbl>
        <Lbl t="Stage">
          <select value={f.stage} onChange={(e) => set('stage', e.target.value)} className={inputCls}>
            {STAGES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Lbl>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 px-1">
        <input type="checkbox" checked={f.instant} onChange={(e) => set('instant', e.target.checked)} />
        ⚡ Instant funded account (no profit target / phases)
      </label>
      <Lbl t="Max loss (drawdown) type">
        <Seg value={f.drawdown} onChange={(v) => set('drawdown', v)} options={[['static', '📌 Static'], ['trailing', '📈 Trailing']]} />
      </Lbl>
      {f.drawdown === 'trailing' && (
        <label className="flex items-center gap-2 text-sm text-slate-600 px-1">
          <input type="checkbox" checked={f.trailLock} onChange={(e) => set('trailLock', e.target.checked)} />
          Stops trailing once the floor reaches the starting balance
        </label>
      )}
      <Lbl t="Account (tracks only this account)">
        <select value={f.accountId} onChange={(e) => set('accountId', e.target.value)} className={inputCls}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({money(a.currentBalance)})
            </option>
          ))}
        </select>
      </Lbl>
      <div className="grid grid-cols-2 gap-2">
        <Lbl t="Start balance ($)">
          <input type="number" value={f.start} onChange={(e) => set('start', e.target.value)} className={inputCls} />
        </Lbl>
        {!f.instant && (
          <Lbl t="Target balance ($)">
            <input type="number" value={f.target} onChange={(e) => set('target', e.target.value)} className={inputCls} />
          </Lbl>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Lbl t="Daily goal $">
          <input type="number" value={f.dailyProfit} onChange={(e) => set('dailyProfit', e.target.value)} placeholder="—" className={inputCls} />
        </Lbl>
        <Lbl t="Max daily loss $">
          <input type="number" value={f.daily} onChange={(e) => set('daily', e.target.value)} placeholder="—" className={inputCls} />
        </Lbl>
        <Lbl t="Max loss $">
          <input type="number" value={f.max} onChange={(e) => set('max', e.target.value)} placeholder="—" className={inputCls} />
        </Lbl>
      </div>
      <button disabled={saving} onClick={submit} className="w-full py-3 rounded-full text-base text-white bg-black disabled:opacity-60">
        {saving ? 'Creating…' : 'Create phase'}
      </button>
    </Modal>
  );
};
