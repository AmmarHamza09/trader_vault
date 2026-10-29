// Alert chimes synthesised with WebAudio (no audio files). Browsers only allow sound after
// the user has interacted with the page once, so we unlock on the first tap/click.
export type ChimeKind = 'entry' | 'win' | 'loss' | 'test';

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
};

export const unlockAudio = () => {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
};

export const isSoundOn = () => {
  try {
    return localStorage.getItem('tv_alert_sound') !== 'off';
  } catch {
    return true;
  }
};
export const setSoundOn = (on: boolean) => {
  try {
    localStorage.setItem('tv_alert_sound', on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
};

const note = (c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.28) => {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
};

export const playChime = (kind: ChimeKind, force = false) => {
  if (!force && !isSoundOn()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const t = c.currentTime + 0.02;
  if (kind === 'entry' || kind === 'test') {
    // two bright rising tones: "something is happening"
    note(c, 880, t, 0.22, 'triangle');
    note(c, 1318.5, t + 0.16, 0.38, 'triangle');
    if (kind === 'test') note(c, 1760, t + 0.34, 0.5, 'sine', 0.2);
  } else if (kind === 'win') {
    // happy major arpeggio C5 E5 G5 C6
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(c, f, t + i * 0.1, 0.35, 'triangle'));
    note(c, 1046.5, t + 0.45, 0.7, 'sine', 0.2);
  } else {
    // soft descending tones for a loss
    note(c, 392, t, 0.3, 'sine', 0.3);
    note(c, 311.1, t + 0.2, 0.3, 'sine', 0.3);
    note(c, 233.1, t + 0.4, 0.6, 'sine', 0.3);
  }
};

if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once);
  window.addEventListener('keydown', once);
}
