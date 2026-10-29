import React, { useEffect, useRef, useState } from 'react';
import './landing.css';

interface Props {
  authed: boolean;
  onLogin: () => void;
  onSignup: () => void;
}

const FEATURES: [string, string, string][] = [
  ['🤖', 'AI Coach', 'Ask “how much can I still lose today?” and get answers from your own trades, phases and risk buffers.'],
  ['🎯', 'Prop-firm tracking', 'Phase 1 → Phase 2 → Funded, static or trailing drawdown, even instant funded accounts.'],
  ['📸', 'Screenshot import', 'Snap your MT5 or TradingView history — AI fills the journal, skips repeats and fixes time zones. You review before saving.'],
  ['🔔', 'TradingView sync', 'Strategy alerts flow straight into your journal with a pop-up and phone notification.'],
  ['📊', 'Deep analytics', 'Equity curve, drawdown, win rate by session and hour, plus plain-English insights.'],
  ['🧠', 'Psychology tracking', 'Mood, discipline, FOMO and broken plans — turn patterns into rules you can follow.'],
  ['🔗', 'Private share links', 'One tap creates a read-only link to one account. No sign-in for viewers, no email shown, switch off any time.'],
  ['🏆', 'Leaderboard', 'Compare consistency and returns with other traders. Wins in green, losses in red — honest numbers only.'],
  ['⚔️', 'Competitions', 'Challenge friends and your community and see who stays disciplined.'],
];
const MARQUEE = ['🤖 AI Coach', '🎯 Prop-firm phases', '📸 Screenshot import', '🔔 TradingView alerts', '📊 Analytics', '🧠 Psychology', '🔗 Share links', '🏆 Leaderboard', '⚔️ Competitions', '🕒 Time-zone smart', '📈 Trailing drawdown', '⚡ Instant funded'];
const FAQ: [string, string][] = [
  ['Is TraderVault a signal service?', "No. It's a journal and coaching tool. It never gives buy/sell signals or price predictions."],
  ['Which platforms can I import from?', 'MetaTrader 5 (screenshot or the TraderVault EA) and TradingView (screenshots and webhook alerts, which need a TradingView plan that supports them). You can also log trades by hand.'],
  ['Does it work for prop-firm challenges?', 'Yes — phases, profit targets, daily loss, and static or trailing max-loss, including instant funded accounts.'],
  ['Who can see my trades?', 'Only you, unless you create a read-only share link for a single account. You can switch the link off any time.'],
  ['Is the AI always right?', 'No. It can make mistakes, so imports are shown for your review before anything is saved, and coaching is for process and risk — not financial advice.'],
];

const PLANS = [
  { id: 'starter', name: 'Starter', emoji: '🌱', blurb: 'Everything you need to start journaling.', monthly: 0, yearly: 0, cta: 'Start for free',
    feats: ['1 trading account', 'Manual trade logging', 'Core analytics & calendar', 'Psychology tracking', 'Leaderboard & competitions'] },
  { id: 'pro', name: 'Pro', emoji: '🚀', blurb: 'For traders chasing a funded account.', monthly: 9, yearly: 7, cta: 'Get Pro', popular: true,
    feats: ['Unlimited accounts', 'AI Coach that knows your account', 'Prop-firm phases & trailing drawdown', 'Screenshot import (MT5 / TradingView)', 'TradingView & MT5 sync', 'Private share links'] },
  { id: 'elite', name: 'Elite', emoji: '👑', blurb: 'For serious traders and teams.', monthly: 19, yearly: 15, cta: 'Go Elite',
    feats: ['Everything in Pro', 'Early access to Backtesting', 'Early access to the Pine script editor', 'Priority support'] },
];

const HEADLINE = ['Your', 'trading', 'journal,'];

const LandingPage: React.FC<Props> = ({ authed, onLogin, onSignup }) => {
  const root = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [yearly, setYearly] = useState(true);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let fired = false;
    const io = new IntersectionObserver(
      (es) => { fired = true; es.forEach((e) => { if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add('in'); io.unobserve(e.target); } }); },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    el.querySelectorAll('.reveal').forEach((n) => io.observe(n));
    // If the observer never reports (very old/paused browser), show everything instead of leaving blank space.
    const safety = window.setTimeout(() => { if (!fired) el.querySelectorAll('.reveal').forEach((n) => n.classList.add('in')); }, 1800);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.clearTimeout(safety); io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  const open = (e: React.MouseEvent, fn: () => void) => { e.preventDefault(); fn(); };

  return (
    <div className="lp" ref={root} id="top">
      <nav className={scrolled ? 'scrolled' : ''}>
        <div className="wrap">
          <a className="brand" href="#top"><img src="/logo.png" alt="" /><span>TraderVault<b>.PRO</b></span></a>
          <div className="links"><a href="#features">Features</a><a href="#coach">AI Coach</a><a href="#prop">Prop firms</a><a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
          <div className="navr">
            {authed ? (
              <a className="btn btn-dark btn-sm" href="/">Open dashboard →</a>
            ) : (
              <>
                <a className="btn btn-text" href="/login" onClick={(e) => open(e, onLogin)}>Log in</a>
                <a className="btn btn-dark btn-sm" href="/signup" onClick={(e) => open(e, onSignup)}>Sign up</a>
              </>
            )}
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="glow" /><div className="glow glow2" />
        <div className="wrap grid">
          <div>
            <span className="eyebrow fade">📈 Built for gold &amp; prop-firm traders</span>
            <h1>
              {HEADLINE.map((w, i) => <span key={w}><span className="w" style={{ ['--i' as any]: i }}>{w}</span>{' '}</span>)}
              <br /><em><span className="w" style={{ ['--i' as any]: 3 }}>finally</span> <span className="w" style={{ ['--i' as any]: 4 }}>smart.</span></em>
            </h1>
            <p className="lead fade" style={{ ['--d' as any]: '420ms' }}>Log every trade, pass your prop-firm challenge and get an AI coach that actually knows your account — all in one soft, simple app.</p>
            <div className="cta fade" style={{ ['--d' as any]: '540ms' }}>
              {authed ? (
                <a className="btn btn-green" href="/">Open your dashboard →</a>
              ) : (
                <a className="btn btn-green" href="/signup" onClick={(e) => open(e, onSignup)}>Get started →</a>
              )}
              <a className="btn btn-ghost" href="#features">See what's inside</a>
            </div>
            <p className="note fade" style={{ ['--d' as any]: '640ms' }}>Works on desktop and phone · Import from MT5 &amp; TradingView</p>
          </div>

          <div className="vis fade" style={{ ['--d' as any]: '300ms' }}>
            <div className="card mock">
              <div className="row"><div><div className="lbl">Equity · this month</div><div className="big">$12,480</div></div><span className="pill g">+8.4%</span></div>
              <svg viewBox="0 0 360 110" preserveAspectRatio="none" style={{ width: '100%', height: 110 }} aria-hidden="true">
                <defs><linearGradient id="lpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10733d" stopOpacity=".25" /><stop offset="1" stopColor="#10733d" stopOpacity="0" /></linearGradient></defs>
                <path className="area" d="M0 92 L30 82 L60 88 L90 62 L120 70 L150 46 L180 54 L210 34 L240 42 L270 20 L300 28 L330 10 L360 16 L360 110 L0 110Z" fill="url(#lpg)" />
                <path className="line" d="M0 92 L30 82 L60 88 L90 62 L120 70 L150 46 L180 54 L210 34 L240 42 L270 20 L300 28 L330 10 L360 16" fill="none" stroke="#10733d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
              <div className="mini"><div><b>64%</b><small>Win rate</small></div><div><b>2.1</b><small>Profit factor</small></div><div><b>Phase 2</b><small>Challenge</small></div></div>
              <p className="sample">Sample data for illustration</p>
            </div>
            <div className="float f1">✅ Trade added from screenshot</div>
            <div className="float f2">🤖 <i>AI coach</i> says: protect the buffer</div>
          </div>
        </div>
      </header>

      <div className="marq" aria-hidden="true"><div className="track">{[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}</div></div>

      <section id="features"><div className="wrap">
        <div className="head reveal"><span className="eyebrow">✨ Everything in one place</span><h2>Built around how you really trade</h2><p className="lead">From the first screenshot to the funded account — TraderVault keeps your numbers and your mindset in one journal.</p></div>
        <div className="feat">
          {FEATURES.map(([i, t, d], n) => (
            <div className="card reveal" key={t} style={{ ['--d' as any]: `${(n % 3) * 80}ms` }}><div className="ico">{i}</div><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </div></section>

      <section id="coach"><div className="wrap split">
        <div className="reveal">
          <span className="eyebrow">🤖 AI Coach</span>
          <h2>A coach that knows your account</h2>
          <p className="lead">It reads your trades, your active phase and your habits — then gives short, practical answers, not generic advice.</p>
          <ul className="ticks"><li>Knows your daily-loss room and max-loss buffer</li><li>Spots revenge trading, FOMO and over-trading</li><li>Suggests rules: a daily stop, a max-trades limit, a checklist</li></ul>
        </div>
        <div className="reveal black"><div className="g1" />
          <div className="chat">
            <div className="msg me" style={{ ['--k' as any]: 0 }}>How much can I still lose today?</div>
            <div className="msg ai" style={{ ['--k' as any]: 1 }}>You have <b>$180</b> of daily room left and <b>$1,240</b> before your max-loss line. Two of your last three losses came right after a win — want a cool-down rule?</div>
            <div className="msg me" style={{ ['--k' as any]: 2 }}>Yes please</div>
            <div className="msg ai" style={{ ['--k' as any]: 3 }}>Try: after any loss, wait <b>15 minutes</b> and re-check your plan before the next entry. 💚</div>
            <p className="sample">Sample conversation for illustration</p>
          </div>
        </div>
      </div></section>

      <section id="prop"><div className="wrap split rev">
        <div className="reveal card mock">
          <div className="row"><b style={{ fontSize: 18 }}>Prop-firm challenge</b><span className="pill m">Phase 2</span></div>
          <div className="phase"><div className="row"><span>Profit target</span><span>$480 / $800</span></div><div className="bar"><i style={{ ['--w' as any]: '60%', width: '60%' }} /></div></div>
          <div className="phase"><div className="row"><span>Daily loss room</span><span>$320 left</span></div><div className="bar"><i style={{ ['--w' as any]: '80%', width: '80%' }} /></div></div>
          <div className="phase"><div className="row"><span>Trailing max-loss floor</span><span>$1,240 buffer</span></div><div className="bar"><i style={{ ['--w' as any]: '70%', width: '70%' }} /></div></div>
          <p className="sample">Sample data for illustration</p>
        </div>
        <div className="reveal">
          <span className="eyebrow">🎯 Prop-firm ready</span>
          <h2>Pass the challenge without the guesswork</h2>
          <p className="lead">TraderVault follows the rules your firm uses, live from your trades.</p>
          <ul className="ticks"><li>Static or trailing drawdown, with optional lock</li><li>Phase 1, Phase 2 and Funded stages</li><li>Instant funded accounts supported</li><li>Upload a screenshot of your plan and AI sets it up</li></ul>
        </div>
      </div></section>

      <section id="how"><div className="wrap">
        <div className="head reveal"><span className="eyebrow">⚡ Get going in minutes</span><h2>How it works</h2></div>
        <div className="steps">
          {[['Add your account', 'Create a journal account or a prop-firm challenge with your phases and drawdown rules.'], ['Bring in your trades', 'Snap a screenshot, connect your MT5 EA or TradingView alerts, or log a trade by hand.'], ['Review and improve', 'Check your analytics and ask the AI coach what to fix next.']].map(([t, d], n) => (
            <div className="card reveal" key={t} style={{ ['--d' as any]: `${n * 100}ms` }}><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </div></section>

      <section id="pricing"><div className="wrap">
        <div className="head reveal"><span className="eyebrow">💎 Simple pricing</span><h2>Pick the plan that fits your trading</h2><p className="lead">Start free. Upgrade when you're ready. Cancel anytime.</p>
          <div className="bill" role="group" aria-label="Billing period">
            <span className="thumb" style={{ transform: yearly ? 'translateX(100%)' : 'none' }} />
            <button type="button" className={!yearly ? 'on' : ''} onClick={() => setYearly(false)}>Monthly</button>
            <button type="button" className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>Yearly <em>-20%</em></button>
          </div>
        </div>
        <div className="plans">
          {PLANS.map((p, n) => {
            const price = yearly ? p.yearly : p.monthly;
            return (
              <div className={`plan reveal${p.popular ? ' popular' : ''}`} key={p.id} style={{ ['--d' as any]: `${n * 110}ms` }}>
                {p.popular && <span className="tagpop">⭐ Most popular</span>}
                <div className="pin">
                  <div className="ptop"><span className="pe">{p.emoji}</span><h3>{p.name}</h3></div>
                  <p className="pb">{p.blurb}</p>
                  <div className="price"><span className="amt" key={`${p.id}-${yearly}`}>{price === 0 ? 'Free' : `$${price}`}</span>{price > 0 && <span className="per">/ month</span>}</div>
                  <p className="billed">{price === 0 ? 'No card needed' : yearly ? `Billed $${price * 12} yearly` : 'Billed monthly'}</p>
                  {authed ? (
                    <a className={`btn ${p.popular ? 'btn-green' : 'btn-dark'} pbtn`} href="/">Open dashboard</a>
                  ) : (
                    <a className={`btn ${p.popular ? 'btn-green' : 'btn-dark'} pbtn`} href="/signup" onClick={(e) => { try { if (p.id !== 'starter') localStorage.setItem('tv_plan_intent', JSON.stringify({ plan: p.id, interval: yearly ? 'yearly' : 'monthly' })); } catch { /* ignore */ } open(e, onSignup); }}>{p.cta} →</a>
                  )}
                  <ul className="ticks">{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              </div>
            );
          })}
        </div>
        <p className="sample" style={{ marginTop: 18 }}>Prices in USD. Backtesting and the script editor are coming soon.</p>
      </div></section>

      <section><div className="wrap">
        <div className="black soon reveal"><div className="g1" />
          <span className="eyebrow pulse" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', position: 'relative' }}>🚧 On the way</span>
          <h2>Coming <span>soon</span></h2>
          <p>Backtesting on real gold history with a Pine-style script editor, built right into TraderVault.</p>
          <div className="tags"><span>🧪 Candle-by-candle replay</span><span>&lt;/&gt; Script editor</span><span>📊 Full session report</span></div>
        </div>
      </div></section>

      <section id="faq"><div className="wrap">
        <div className="head reveal"><h2>Questions, answered</h2></div>
        <div className="faq reveal">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </div></section>

      <section style={{ paddingTop: 24 }}><div className="wrap">
        <div className="black final reveal"><div className="g1" />
          <h2>Trade like it's your <em>business.</em></h2>
          <p>{authed ? 'Your journal is waiting.' : 'Join TraderVault.PRO and turn every trade into a lesson.'}</p>
          {authed ? <a className="btn btn-white" href="/">Open your dashboard →</a> : <a className="btn btn-white" href="/signup" onClick={(e) => open(e, onSignup)}>Get started →</a>}
        </div>
      </div></section>

      <footer><div className="wrap">
        <a className="brand" href="#top"><img src="/logo.png" alt="" /><span>TraderVault<b>.PRO</b></span></a>
        <div className="fl">{authed ? <a href="/">Dashboard</a> : <><a href="/login" onClick={(e) => open(e, onLogin)}>Log in</a><a href="/signup" onClick={(e) => open(e, onSignup)}>Sign up</a></>}<a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
        <p>Trading involves risk. TraderVault is a journaling and coaching tool, not financial advice. Figures shown on this page are illustrative samples, not performance claims.</p>
        <p>© 2026 TraderVault.PRO</p>
      </div></footer>
    </div>
  );
};

export default LandingPage;
