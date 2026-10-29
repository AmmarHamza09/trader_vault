import { Trade, TraderStats, DateRange } from '../types';

/**
 * Filter trades by a relative DateRange, counted back from today's (local) date.
 */
export function filterTradesByDateRange(trades: Trade[], range: DateRange): Trade[] {
  if (trades.length === 0 || range === 'all') return trades;

  // Ranges are measured back from the real current date (local day), not from the latest trade —
  // otherwise "Today" would show an old trade whenever nothing was traded today.
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayOf = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, (m || 1) - 1, day || 1).getTime();
  };

  return trades.filter((trade) => {
    const tradeTime = dayOf(trade.entryDate);
    const diffDays = Math.round((todayStart - tradeTime) / MS_PER_DAY);

    switch (range) {
      case 'today':
        return diffDays === 0;
      case '7d':
        return diffDays <= 7;
      case '30d':
        return diffDays <= 30;
      case '90d':
        return diffDays <= 90;
      case 'ytd':
        return new Date(tradeTime).getFullYear() === now.getFullYear();
      default:
        return true;
    }
  });
}

/**
 * Computes complete statistics for a given set of trades and initial starting balance.
 */
export function calculateTraderStats(trades: Trade[], startingBalance: number = 50000): TraderStats {
  const totalTrades = trades.length;

  if (totalTrades === 0) {
    return {
      netPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      winLossRatio: 0,
      avgRMultiple: 0,
      avgRiskReward: 0,
      expectancy: 0,
      maxDrawdownMonetary: 0,
      maxDrawdownPercentage: 0,
      currentStreak: { type: 'NONE', count: 0 },
      bestWinStreak: 0,
      worstLossStreak: 0,
      planAdherenceRate: 0,
      fomoTradeCount: 0,
      revengeTradeCount: 0,
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let netPnL = 0;
  let totalRMultiple = 0;
  let totalPlannedRR = 0;
  let planFollowedCount = 0;
  let fomoTradeCount = 0;
  let revengeTradeCount = 0;

  // Chronologically sort trades for equity curve, streaks, drawdown
  const sorted = [...trades].sort((a, b) => {
    const tA = new Date(`${a.entryDate}T${a.entryTime || '00:00'}`).getTime();
    const tB = new Date(`${b.entryDate}T${b.entryTime || '00:00'}`).getTime();
    return tA - tB;
  });

  // Streaks calculation
  let currentStreakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  let currentStreakCount = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  let runningWinStreak = 0;
  let runningLossStreak = 0;

  // Drawdown tracking
  let peakEquity = startingBalance;
  let currentEquity = startingBalance;
  let maxDrawdownMonetary = 0;
  let maxDrawdownPercentage = 0;

  sorted.forEach((trade) => {
    const pnl = trade.netPnL;
    netPnL += pnl;
    currentEquity += pnl;

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    } else {
      const ddMoney = peakEquity - currentEquity;
      const ddPct = peakEquity > 0 ? (ddMoney / peakEquity) * 100 : 0;
      if (ddMoney > maxDrawdownMonetary) {
        maxDrawdownMonetary = ddMoney;
      }
      if (ddPct > maxDrawdownPercentage) {
        maxDrawdownPercentage = ddPct;
      }
    }

    if (trade.outcome === 'WIN') {
      winCount++;
      grossProfit += pnl;
      runningWinStreak++;
      runningLossStreak = 0;
      if (runningWinStreak > bestWinStreak) bestWinStreak = runningWinStreak;
    } else if (trade.outcome === 'LOSS') {
      lossCount++;
      grossLoss += Math.abs(pnl);
      runningLossStreak++;
      runningWinStreak = 0;
      if (runningLossStreak > worstLossStreak) worstLossStreak = runningLossStreak;
    } else {
      breakevenCount++;
      // Breakeven pauses streaks
    }

    totalRMultiple += trade.rMultiple || 0;
    totalPlannedRR += trade.plannedRR || 0;
    if (trade.followedPlan) planFollowedCount++;
    if (trade.fomoTrade) fomoTradeCount++;
    if (trade.revengeTrade) revengeTradeCount++;
  });

  // Calculate current streak from the end of sorted list
  if (sorted.length > 0) {
    const lastTrade = sorted[sorted.length - 1];
    if (lastTrade.outcome === 'WIN') {
      currentStreakType = 'WIN';
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].outcome === 'WIN') currentStreakCount++;
        else break;
      }
    } else if (lastTrade.outcome === 'LOSS') {
      currentStreakType = 'LOSS';
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].outcome === 'LOSS') currentStreakCount++;
        else break;
      }
    }
  }

  const closedCount = totalTrades;
  const winRate = closedCount > 0 ? (winCount / closedCount) * 100 : 0;
  const avgWin = winCount > 0 ? grossProfit / winCount : 0;
  const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? avgWin : 0;
  const avgRMultiple = closedCount > 0 ? totalRMultiple / closedCount : 0;
  const avgRiskReward = closedCount > 0 ? totalPlannedRR / closedCount : 0;
  
  // Mathematical Expectancy per trade: (Win Rate * Avg Win) - (Loss Rate * Avg Loss)
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
  const planAdherenceRate = totalTrades > 0 ? (planFollowedCount / totalTrades) * 100 : 0;

  return {
    netPnL: Math.round(netPnL * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    totalTrades,
    winCount,
    lossCount,
    breakevenCount,
    winRate: Math.round(winRate * 10) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    winLossRatio: Math.round(winLossRatio * 100) / 100,
    avgRMultiple: Math.round(avgRMultiple * 100) / 100,
    avgRiskReward: Math.round(avgRiskReward * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    maxDrawdownMonetary: Math.round(maxDrawdownMonetary * 100) / 100,
    maxDrawdownPercentage: Math.round(maxDrawdownPercentage * 100) / 100,
    currentStreak: {
      type: currentStreakType,
      count: currentStreakCount,
    },
    bestWinStreak,
    worstLossStreak,
    planAdherenceRate: Math.round(planAdherenceRate * 10) / 10,
    fomoTradeCount,
    revengeTradeCount,
  };
}

/**
 * Builds cumulative equity and daily P&L series for Recharts.
 */
export function buildEquityCurve(trades: Trade[], startingBalance: number = 50000) {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => {
    const tA = new Date(`${a.entryDate}T${a.entryTime || '00:00'}`).getTime();
    const tB = new Date(`${b.entryDate}T${b.entryTime || '00:00'}`).getTime();
    return tA - tB;
  });

  let runningEquity = startingBalance;
  let runningPnL = 0;

  // Group or sequential mapping
  return sorted.map((trade, idx) => {
    runningPnL += trade.netPnL;
    runningEquity += trade.netPnL;

    return {
      index: idx + 1,
      date: trade.entryDate,
      time: trade.entryTime,
      instrument: trade.instrument,
      pnl: trade.netPnL,
      cumulativePnL: Math.round(runningPnL * 100) / 100,
      equity: Math.round(runningEquity * 100) / 100,
      outcome: trade.outcome,
    };
  });
}

/**
 * Groups trades by calendar day for Daily PnL bar chart.
 */
export function buildDailyPnLSeries(trades: Trade[]) {
  const dailyMap: { [date: string]: { pnl: number; count: number; wins: number; losses: number } } = {};

  trades.forEach((t) => {
    if (!dailyMap[t.entryDate]) {
      dailyMap[t.entryDate] = { pnl: 0, count: 0, wins: 0, losses: 0 };
    }
    dailyMap[t.entryDate].pnl += t.netPnL;
    dailyMap[t.entryDate].count += 1;
    if (t.outcome === 'WIN') dailyMap[t.entryDate].wins += 1;
    if (t.outcome === 'LOSS') dailyMap[t.entryDate].losses += 1;
  });

  const dates = Object.keys(dailyMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return dates.map((date) => {
    const item = dailyMap[date];
    const roundedPnL = Math.round(item.pnl * 100) / 100;
    return {
      date,
      displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: roundedPnL,
      count: item.count,
      wins: item.wins,
      losses: item.losses,
      isPositive: roundedPnL >= 0,
    };
  });
}

/**
 * Breakdown analytics by dimension (instrument, session, strategy, weekday, etc.)
 */
export function buildCategoryBreakdown(trades: Trade[], key: 'instrument' | 'session' | 'strategy' | 'timeframe') {
  const map: { [val: string]: { name: string; pnl: number; trades: number; wins: number; losses: number } } = {};

  trades.forEach((t) => {
    const val = t[key] || 'Unspecified';
    if (!map[val]) {
      map[val] = { name: val, pnl: 0, trades: 0, wins: 0, losses: 0 };
    }
    map[val].pnl += t.netPnL;
    map[val].trades += 1;
    if (t.outcome === 'WIN') map[val].wins += 1;
    if (t.outcome === 'LOSS') map[val].losses += 1;
  });

  return Object.values(map)
    .map((item) => ({
      ...item,
      pnl: Math.round(item.pnl * 100) / 100,
      winRate: item.trades > 0 ? Math.round((item.wins / item.trades) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

/**
 * Performance comparison when following trading plan vs breaking plan.
 */
export function buildPlanAdherenceComparison(trades: Trade[]) {
  const followed = trades.filter((t) => t.followedPlan);
  const broken = trades.filter((t) => !t.followedPlan);

  const calcGroup = (group: Trade[], label: string) => {
    const count = group.length;
    if (count === 0) return { label, count: 0, netPnL: 0, winRate: 0, avgR: 0 };
    const pnl = group.reduce((sum, t) => sum + t.netPnL, 0);
    const wins = group.filter((t) => t.outcome === 'WIN').length;
    const avgR = group.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / count;
    return {
      label,
      count,
      netPnL: Math.round(pnl * 100) / 100,
      winRate: Math.round((wins / count) * 1000) / 10,
      avgR: Math.round(avgR * 100) / 100,
    };
  };

  return {
    followed: calcGroup(followed, 'Followed Rules'),
    broken: calcGroup(broken, 'Deviated / Discretionary'),
  };
}

/**
 * Generates dynamic, realistic trader insights based on the actual trade records.
 */
export function generateTraderInsights(trades: Trade[]) {
  if (trades.length < 3) {
    return [
      {
        type: 'info',
        title: 'Gathering Trading Data',
        description: 'Log at least 3 trades to activate algorithmic edge analysis and behavioral insights.',
        impact: 'neutral' as const,
      },
    ];
  }

  const insights = [];

  // 1. Highest winning trade and biggest loss
  const sortedPnL = [...trades].sort((a, b) => b.netPnL - a.netPnL);
  const biggestWin = sortedPnL[0];
  const biggestLoss = sortedPnL[sortedPnL.length - 1];

  if (biggestWin && biggestWin.netPnL > 0) {
    insights.push({
      type: 'trophy',
      title: `Top Winning Trade: +$${biggestWin.netPnL.toLocaleString()} (${biggestWin.instrument})`,
      description: `Executed during ${biggestWin.session} session using "${biggestWin.strategy}". R-Multiple was +${biggestWin.rMultiple?.toFixed(2)}R.`,
      impact: 'positive' as const,
    });
  }

  // 2. Best-performing session
  const sessionBreakdown = buildCategoryBreakdown(trades, 'session');
  if (sessionBreakdown.length > 0 && sessionBreakdown[0].pnl > 0) {
    const bestSession = sessionBreakdown[0];
    insights.push({
      type: 'session',
      title: `Prime Execution Window: ${bestSession.name} Session`,
      description: `Generated $${bestSession.pnl.toLocaleString()} with a ${bestSession.winRate}% win rate across ${bestSession.trades} trades.`,
      impact: 'positive' as const,
    });
  }

  // 3. Best setup/strategy
  const strategyBreakdown = buildCategoryBreakdown(trades, 'strategy');
  if (strategyBreakdown.length > 0) {
    const bestStrat = strategyBreakdown[0];
    insights.push({
      type: 'strategy',
      title: `Highest Edge Setup: ${bestStrat.name}`,
      description: `Net return of $${bestStrat.pnl.toLocaleString()} (${bestStrat.winRate}% win rate across ${bestStrat.trades} executions).`,
      impact: 'positive' as const,
    });
  }

  // 4. Discipline & Rule Adherence Impact
  const planStats = buildPlanAdherenceComparison(trades);
  if (planStats.broken.count > 0) {
    const pnlDiff = planStats.followed.netPnL - planStats.broken.netPnL;
    insights.push({
      type: 'discipline',
      title: `Discipline Tax: Broken Plan Impact`,
      description: `Following your trading plan yielded $${planStats.followed.netPnL.toLocaleString()} (${planStats.followed.winRate}% WR), while unplanned trades generated $${planStats.broken.netPnL.toLocaleString()} (${planStats.broken.winRate}% WR).`,
      impact: pnlDiff > 0 ? ('negative' as const) : ('neutral' as const),
    });
  }

  // 5. Emotional state correlation
  const emotionalTrades = trades.filter((t) => t.fomoTrade || t.revengeTrade);
  if (emotionalTrades.length > 0) {
    const fomoPnL = emotionalTrades.reduce((acc, t) => acc + t.netPnL, 0);
    insights.push({
      type: 'psychology',
      title: `Impulse Drag: ${emotionalTrades.length} Emotional Trades`,
      description: `FOMO and revenge entries resulted in ${fomoPnL >= 0 ? '+' : ''}$${fomoPnL.toLocaleString()} P&L. Eliminate emotional chases to preserve capital.`,
      impact: 'negative' as const,
    });
  }

  // 6. Day of week consistency
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayMap: { [day: string]: { pnl: number; count: number } } = {};
  trades.forEach((t) => {
    const day = weekdayNames[new Date(t.entryDate).getDay()];
    if (!dayMap[day]) dayMap[day] = { pnl: 0, count: 0 };
    dayMap[day].pnl += t.netPnL;
    dayMap[day].count += 1;
  });

  const bestDay = Object.entries(dayMap).sort((a, b) => b[1].pnl - a[1].pnl)[0];
  if (bestDay && bestDay[1].pnl > 0) {
    insights.push({
      type: 'timing',
      title: `Most Consistent Day: ${bestDay[0]}`,
      description: `Highest net performance with +$${Math.round(bestDay[1].pnl).toLocaleString()} over ${bestDay[1].count} sessions.`,
      impact: 'positive' as const,
    });
  }

  return insights;
}

/**
 * Instrument contract specification helper to calculate estimated PnL and tick values.
 */
export function estimateTradePnL(params: {
  instrument: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  positionSize: number; // lot size
  commission?: number;
  swap?: number;
}): { grossPnL: number; netPnL: number; pipsOrPoints: number } {
  const { instrument, direction, entryPrice, exitPrice, positionSize, commission = 0, swap = 0 } = params;

  if (!entryPrice || !exitPrice || !positionSize) {
    return { grossPnL: 0, netPnL: 0, pipsOrPoints: 0 };
  }

  const isBuy = direction === 'BUY';
  const priceDiff = isBuy ? exitPrice - entryPrice : entryPrice - exitPrice;
  const upper = instrument.toUpperCase();

  let multiplier = 100000; // standard forex lot
  let pipsOrPoints = priceDiff;

  if (upper.includes('XAU') || upper.includes('GOLD')) {
    // Gold: 1 standard lot = 100 oz. $1 price movement = $100 per lot.
    const gross = priceDiff * 100 * positionSize;
    pipsOrPoints = priceDiff; // points
    const net = gross - commission - swap;
    return {
      grossPnL: Math.round(gross * 100) / 100,
      netPnL: Math.round(net * 100) / 100,
      pipsOrPoints: Math.round(pipsOrPoints * 100) / 100,
    };
  } else if (upper.includes('JPY')) {
    // JPY pairs: 1 pip = 0.01
    pipsOrPoints = priceDiff * 100;
    const gross = priceDiff * 1000 * positionSize; // approximate USD conversion
    const net = gross - commission - swap;
    return {
      grossPnL: Math.round(gross * 100) / 100,
      netPnL: Math.round(net * 100) / 100,
      pipsOrPoints: Math.round(pipsOrPoints * 10) / 10,
    };
  } else if (upper.includes('NAS') || upper.includes('US100') || upper.includes('SPX') || upper.includes('US500') || upper.includes('US30')) {
    // Indices
    const pointValue = upper.includes('US30') ? 5 : 20;
    const gross = priceDiff * pointValue * positionSize;
    pipsOrPoints = priceDiff;
    const net = gross - commission - swap;
    return {
      grossPnL: Math.round(gross * 100) / 100,
      netPnL: Math.round(net * 100) / 100,
      pipsOrPoints: Math.round(pipsOrPoints * 100) / 100,
    };
  } else if (upper.includes('BTC') || upper.includes('ETH')) {
    // Crypto
    const gross = priceDiff * positionSize;
    const net = gross - commission - swap;
    return {
      grossPnL: Math.round(gross * 100) / 100,
      netPnL: Math.round(net * 100) / 100,
      pipsOrPoints: Math.round(priceDiff * 100) / 100,
    };
  } else {
    // Standard FX (EURUSD, GBPUSD, AUDUSD, etc.): 1 pip = 0.0001 = $10/lot
    pipsOrPoints = priceDiff * 10000;
    const gross = priceDiff * multiplier * positionSize;
    const net = gross - commission - swap;
    return {
      grossPnL: Math.round(gross * 100) / 100,
      netPnL: Math.round(net * 100) / 100,
      pipsOrPoints: Math.round(pipsOrPoints * 10) / 10,
    };
  }
}

/**
 * Derives every computed trade field (P&L, risk, R-multiple, outcome, ROI)
 * from the raw inputs a CSV import (or any non-form trade source) provides.
 * Mirrors the logic AddTradeModal uses inline for manually-logged trades.
 */
export function computeTradeDerivedFields(params: {
  instrument: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  commission?: number;
  swap?: number;
  startingBalance?: number;
}) {
  const {
    instrument,
    direction,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    positionSize,
    commission = 0,
    swap = 0,
    startingBalance = 100000,
  } = params;

  const est = estimateTradePnL({ instrument, direction, entryPrice, exitPrice, positionSize, commission, swap });

  const riskAmount = stopLoss
    ? Math.abs(estimateTradePnL({ instrument, direction, entryPrice, exitPrice: stopLoss, positionSize }).grossPnL)
    : 0;
  const potentialReward = takeProfit
    ? Math.abs(estimateTradePnL({ instrument, direction, entryPrice, exitPrice: takeProfit, positionSize }).grossPnL)
    : 0;

  const rMultiple = riskAmount > 0 ? Math.round((est.netPnL / riskAmount) * 100) / 100 : 0;
  const plannedRR = riskAmount > 0 ? Math.round((potentialReward / riskAmount) * 100) / 100 : 0;

  let outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' = 'BREAKEVEN';
  if (est.netPnL > 10) outcome = 'WIN';
  else if (est.netPnL < -10) outcome = 'LOSS';

  const roiPercentage = startingBalance > 0 ? Math.round((est.netPnL / startingBalance) * 10000) / 100 : 0;

  return {
    grossPnL: est.grossPnL,
    netPnL: est.netPnL,
    riskAmount,
    potentialReward,
    rMultiple,
    plannedRR,
    outcome,
    roiPercentage,
  };
}

/**
 * Serialize trades to CSV for journal/report export.
 */
export function exportTradesToCSV(trades: Trade[]): string {
  if (trades.length === 0) return '';

  const headers = [
    'Trade ID',
    'Date',
    'Time',
    'Instrument',
    'Direction',
    'Entry Price',
    'Exit Price',
    'Stop Loss',
    'Take Profit',
    'Position Size',
    'Risk Amount',
    'Net PnL',
    'Outcome',
    'R-Multiple',
    'Strategy',
    'Session',
    'Timeframe',
    'Followed Plan',
    'Mood Before',
    'Notes',
  ];

  const rows = trades.map((t) => [
    t.id,
    t.entryDate,
    t.entryTime,
    t.instrument,
    t.direction,
    t.entryPrice,
    t.exitPrice,
    t.stopLoss,
    t.takeProfit,
    t.positionSize,
    t.riskAmount,
    t.netPnL,
    t.outcome,
    t.rMultiple,
    `"${t.strategy}"`,
    t.session,
    t.timeframe,
    t.followedPlan ? 'YES' : 'NO',
    t.moodBefore,
    `"${(t.entryReason || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
