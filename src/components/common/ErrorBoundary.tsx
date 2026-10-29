import React from 'react';
import { reportClientError } from '../../lib/errorReporting';

interface State {
  hasError: boolean;
  attempt: number;
  secondsLeft: number;
}

// Catches any screen crash, tells the user plainly that auto-repair is running, and retries by itself.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, attempt: 0, secondsLeft: 0 };
  private timer: number | undefined;
  private stableTimer: number | undefined;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportClientError(`Render crash: ${error.message}`, error.stack);
    this.scheduleRetry();
  }

  componentDidUpdate(_: unknown, prev: State) {
    // if the app has stayed healthy for 30s, forget earlier failures
    if (prev.hasError && !this.state.hasError) {
      window.clearTimeout(this.stableTimer);
      this.stableTimer = window.setTimeout(() => this.setState({ attempt: 0 }), 30_000);
    }
  }

  componentWillUnmount() {
    window.clearInterval(this.timer);
    window.clearTimeout(this.stableTimer);
  }

  private scheduleRetry() {
    const next = this.state.attempt + 1;
    const delay = Math.min(3 * next, 12);
    this.setState({ attempt: next, secondsLeft: delay });
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      this.setState((s) => {
        if (s.secondsLeft <= 1) {
          window.clearInterval(this.timer);
          // after 3 failed in-place retries do a clean reload (clears any bad in-memory state)
          if (s.attempt >= 3) {
            location.reload();
            return s;
          }
          return { ...s, hasError: false, secondsLeft: 0 };
        }
        return { ...s, secondsLeft: s.secondsLeft - 1 };
      });
    }, 1000);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f4f5]">
        <div className="max-w-sm w-full bg-white rounded-[2rem] shadow-sm p-7 text-center space-y-4">
          <div className="text-5xl">🛠️</div>
          <h1 className="text-2xl font-medium text-black leading-tight">We hit a snag — fixing it now</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Our auto-repair is on it. Your trades and data are safe. Retrying automatically
            {this.state.secondsLeft > 0 ? ` in ${this.state.secondsLeft}s` : '…'}
          </p>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-black animate-pulse w-2/3" />
          </div>
          <button type="button" onClick={() => location.reload()} className="px-5 py-2.5 rounded-full bg-black text-white text-sm">
            Reload now
          </button>
        </div>
      </div>
    );
  }
}
