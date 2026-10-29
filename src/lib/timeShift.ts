// Shift a wall-clock date+time by a number of hours (handles crossing midnight / month ends).
// Used to turn "time shown on a TradingView/MT5 screenshot" into Pakistan time.
export const shiftLocal = (date: string, time: string, hours: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0) + Math.round(hours * 60) * 60000);
  const iso = t.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};
