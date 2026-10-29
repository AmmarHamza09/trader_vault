export type AccountType = 'live' | 'prop_firm' | 'demo';
export type Direction = 'BUY' | 'SELL';
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN';
export type TradingSession = 'Asian' | 'London' | 'New York' | 'Overlap';
export type Mood = 'Calm' | 'Anxious' | 'Excited' | 'Overconfident' | 'Fatigued' | 'Neutral';
export type EmotionDuring = 'Disciplined' | 'Greedy' | 'Fearful' | 'Impatient' | 'Hesitant';
export type DateRange = 'today' | '7d' | '30d' | '90d' | 'ytd' | 'all';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  preferredInstruments: string[];
  defaultAccountId: string;
  currency: string;
  timezone: string;
  defaultRiskPercentage: number;
  defaultAccountBalance: number;
  theme: 'dark' | 'light' | 'system';
  leaderboardVisible: boolean;
  isAdmin?: boolean;
  isBlocked?: boolean;
}

export interface TradingAccount {
  id: string;
  userId: string;
  name: string;
  broker: string;
  type: AccountType;
  currency: string;
  startingBalance: number;
  currentBalance: number;
  isDefault?: boolean;
}

export interface TradeScreenshot {
  id: string;
  type: 'entry' | 'exit' | 'analysis';
  url: string;
  /** Convex file-storage id. Present once the image has been uploaded. */
  storageId?: string;
  caption?: string;
}

export interface Trade {
  id: string;
  userId: string;
  accountId: string;
  instrument: string;
  direction: Direction;

  // Timing
  entryDate: string; // YYYY-MM-DD
  entryTime: string; // HH:mm
  exitDate: string; // YYYY-MM-DD
  exitTime: string; // HH:mm

  // Execution Pricing
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number; // lots or contracts

  // Financials & Risk
  riskAmount: number; // $ at risk based on SL
  potentialReward: number; // $ reward based on TP
  grossPnL: number;
  commission: number;
  swap: number;
  netPnL: number;
  outcome: TradeOutcome;
  rMultiple: number; // realized PnL / initial risk
  plannedRR: number;
  roiPercentage: number;

  // Analysis & Strategy
  strategy: string;
  timeframe: string;
  session: TradingSession;
  setupType: string;
  marketConditions?: string;
  entryReason: string;
  exitReason: string;
  mistakesMade?: string;
  lessonsLearned?: string;
  tags: string[];

  // Psychology & Discipline
  moodBefore: Mood;
  confidenceLevel: 1 | 2 | 3 | 4 | 5;
  emotionDuring: EmotionDuring;
  followedPlan: boolean;
  revengeTrade: boolean;
  fomoTrade: boolean;

  // Screenshots
  screenshots: TradeScreenshot[];

  createdAt: string;
  updatedAt: string;
}

export type GoalCategory =
  | 'profit'
  | 'winrate'
  | 'risk_reward'
  | 'max_daily_loss'
  | 'max_drawdown'
  | 'plan_adherence'
  | 'max_trades_day'
  | 'no_revenge';

export interface Goal {
  /** Empty string for a goal that has not been saved yet. */
  id: string;
  userId: string;
  title: string;
  category: GoalCategory;
  targetValue: number;
  currentValue: number;
  unit: '$' | '%' | 'R' | 'trades';
  period: 'monthly' | 'weekly' | 'challenge';
  deadline?: string;
  completed: boolean;
  notes?: string;
  isHardRiskLimit?: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar: string;
  accountType: AccountType;
  returnPercentage: number;
  netPnL: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  bestStreak: number;
  rankChange: number; // +2, 0, -1
  rank: number;
  favoriteInstrument: string;
  consistencyScore: number; // 0-100
}

export type CompetitionStatus = 'upcoming' | 'active' | 'ended';
export type CompetitionTargetMetric = 'netPnL' | 'returnPercentage';

export interface Competition {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  creatorName: string;
  participantCount: number;
  isJoined: boolean;
  status: CompetitionStatus;
  targetMetric?: CompetitionTargetMetric;
  targetValue?: number;
}

export interface CompetitionLeaderboardEntry {
  userId: string;
  name: string;
  avatar: string;
  netPnL: number;
  returnPercentage: number;
  winRate: number;
  totalTrades: number;
  rank: number;
}

export interface CompetitionLeaderboardResult {
  entries: CompetitionLeaderboardEntry[];
  targetMetric: CompetitionTargetMetric | null;
  targetValue: number | null;
  winnerUserId: string | null;
}

export interface MetricCardData {
  label: string;
  value: string | number;
  delta?: {
    value: string;
    isPositive: boolean;
    neutral?: boolean;
    periodLabel: string;
  };
  subtext?: string;
  sparkline?: number[];
  tone?: 'profit' | 'loss' | 'neutral';
}

export interface TraderStats {
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  avgRMultiple: number;
  avgRiskReward: number;
  expectancy: number;
  maxDrawdownMonetary: number;
  maxDrawdownPercentage: number;
  currentStreak: {
    type: 'WIN' | 'LOSS' | 'NONE';
    count: number;
  };
  bestWinStreak: number;
  worstLossStreak: number;
  planAdherenceRate: number;
  fomoTradeCount: number;
  revengeTradeCount: number;
}