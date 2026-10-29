import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { ToastProvider } from './components/common/Toast';
import { AppShell, NavTab } from './components/layout/AppShell';
import { OverviewView } from './components/dashboard/OverviewView';
import { JournalView } from './components/journal/JournalView';
import { AddTradeModal } from './components/journal/AddTradeModal';
import { ImportTradesModal } from './components/journal/ImportTradesModal';
import { TradeDetailModal } from './components/journal/TradeDetailModal';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { CalendarView } from './components/calendar/CalendarView';
import { LeaderboardView } from './components/leaderboard/LeaderboardView';
import { CompetitionsView } from './components/competitions/CompetitionsView';
import { GoalsView } from './components/goals/GoalsView';
import { CoachView } from './components/coach/CoachView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { AuthModal } from './components/auth/AuthModal';
import { LandingRoute } from './components/landing/LandingRoute';
import { PlanIntent } from './components/settings/PlanIntent';
import { AccountModal, AccountFormData } from './components/AccountModel';
import { LoadingScreen } from './components/common/LoadingScreen';
import { AlertNotifier } from './components/common/AlertNotifier';
import { AdminPage } from './components/admin/AdminPage';
import { SharedPage } from './components/share/SharedPage';
import { BacktestView } from './components/backtest/BacktestView';
const LiveChartView = lazy(() => import('./components/livechart/LiveChartView'));
import { useAuth } from './contexts/AuthContext';

import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../convex/_generated/api.js';
import { calculateTraderStats, filterTradesByDateRange } from './lib/calculations';
import { Trade, DateRange, User, TradingAccount, Goal, LeaderboardEntry } from './types';

export function TradeVaultApp() {
  const { userId, isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(!isAuthenticated && !authLoading);

  // Force pure light theme: Never use dark mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('tv_theme', 'light');
  }, []);

  // Fetch data from Convex (memoized so the arrays keep a stable identity)
  const accountsQuery = useQuery(
    api.accounts.getUserAccounts,
    userId ? {} : 'skip'
  );
  const accounts = useMemo(() => accountsQuery ?? [], [accountsQuery]);

  const tradesQuery = useQuery(
    api.trades.getUserTrades,
    userId ? {} : 'skip'
  );
  const allUserTrades = useMemo(() => tradesQuery ?? [], [tradesQuery]);

  const goalsQuery = useQuery(
    api.goals.getUserGoals,
    userId ? {} : 'skip'
  );
  const goals = useMemo(() => goalsQuery ?? [], [goalsQuery]);

  const leaderboardQuery = useQuery(api.leaderboard.getLeaderboard);
  const leaderboard = useMemo(() => leaderboardQuery ?? [], [leaderboardQuery]);

  const competitionsQuery = useQuery(
    api.competitions.listCompetitions,
    userId ? {} : 'skip'
  );
  const competitions = useMemo(() => competitionsQuery ?? [], [competitionsQuery]);

  const convexClient = useConvex();
  const createCompetitionMutation = useMutation(api.competitions.createCompetition);
  const joinCompetitionMutation = useMutation(api.competitions.joinCompetition);
  const leaveCompetitionMutation = useMutation(api.competitions.leaveCompetition);

  const updateUserMutation = useMutation(api.users.updateUser);
  const createTradeMutation = useMutation(api.trades.createTrade);
  const updateTradeMutation = useMutation(api.trades.updateTrade);
  const deleteTradeMutation = useMutation(api.trades.deleteTrade);
  const createGoalMutation = useMutation(api.goals.createGoal);
  const updateGoalMutation = useMutation(api.goals.updateGoal);
  const deleteGoalMutation = useMutation(api.goals.deleteGoal);
  const createAccountMutation = useMutation(api.accounts.createAccount);
  const updateAccountMutation = useMutation(api.accounts.updateAccount);
  const deleteAccountMutation = useMutation(api.accounts.deleteAccount);

  // Navigation & Filter State
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('all');

  // Account state
  const [currentAccountId, setCurrentAccountId] = useState<string>(
    () => localStorage.getItem('tv_current_account_id') || ''
  );

  // Resolve the selected account once accounts load, preferring a persisted
  // selection if it's still valid; otherwise fall back to the default account.
  useEffect(() => {
    if (!accounts.length) return;
    const stillValid = accounts.some((a: any) => a._id === currentAccountId);
    if (stillValid) return;
    const defaultAcc = accounts.find((a: any) => a.isDefault);
    setCurrentAccountId(defaultAcc?._id || accounts[0]?._id || '');
  }, [accounts, currentAccountId]);

  // Modals
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [detailTrade, setDetailTrade] = useState<Trade | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // Convert Convex trades to frontend Trade type (id instead of _id, etc.)
  const frontendTrades: Trade[] = useMemo(
    () =>
      allUserTrades.map((trade: any) => ({
        id: trade._id,
        userId: trade.userId,
        accountId: trade.accountId,
        instrument: trade.instrument,
        direction: trade.direction as any,
        entryDate: trade.entryDate,
        entryTime: trade.entryTime,
        exitDate: trade.exitDate,
        exitTime: trade.exitTime,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        positionSize: trade.positionSize,
        riskAmount: trade.riskAmount,
        potentialReward: trade.potentialReward,
        grossPnL: trade.grossPnL,
        commission: trade.commission,
        swap: trade.swap,
        netPnL: trade.netPnL,
        outcome: trade.outcome as any,
        rMultiple: trade.rMultiple,
        plannedRR: trade.plannedRR,
        roiPercentage: trade.roiPercentage,
        strategy: trade.strategy,
        timeframe: trade.timeframe,
        session: trade.session as any,
        setupType: trade.setupType,
        marketConditions: trade.marketConditions,
        entryReason: trade.entryReason,
        exitReason: trade.exitReason,
        mistakesMade: trade.mistakesMade,
        lessonsLearned: trade.lessonsLearned,
        tags: trade.tags ?? [],
        moodBefore: trade.moodBefore as any,
        confidenceLevel: trade.confidenceLevel as any,
        emotionDuring: trade.emotionDuring as any,
        followedPlan: trade.followedPlan,
        revengeTrade: trade.revengeTrade,
        fomoTrade: trade.fomoTrade,
        screenshots: (trade.screenshots ?? []).map((s: any) => ({
          id: s.id,
          type: s.type as any,
          url: s.url ?? '',
          storageId: s.storageId,
          caption: s.caption,
        })),
        createdAt: new Date(trade._creationTime).toISOString(),
        updatedAt: new Date(trade._creationTime).toISOString(),
      })),
    [allUserTrades]
  );

  // Trades scoped to the currently selected account
  const accountTrades = useMemo(() => {
    return frontendTrades.filter((t) => t.accountId === currentAccountId);
  }, [frontendTrades, currentAccountId]);

  // Filtered trades by date range, scoped to the selected account
  const filteredTrades = useMemo(() => {
    return filterTradesByDateRange(accountTrades, selectedDateRange);
  }, [accountTrades, selectedDateRange]);

  // Current selected account object
  const currentAccount = useMemo(() => {
    return (
      accounts.find((a: any) => a._id === currentAccountId) || accounts[0] || null
    );
  }, [accounts, currentAccountId]);

  // Rigorous trader statistics
  const traderStats = useMemo(() => {
    const startingBal = currentAccount?.startingBalance || 50000;
    return calculateTraderStats(filteredTrades, startingBal);
  }, [filteredTrades, currentAccount]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingTrade(null);
        setAddTradeOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setAddTradeOpen(true);
    setDetailTrade(null);
  };

  const handleSelectTrade = (trade: Trade) => {
    setDetailTrade(trade);
  };

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'add-trade') {
      setEditingTrade(null);
      setAddTradeOpen(true);
    } else {
      setCurrentTab(tab);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setCurrentAccountId(accountId);
    localStorage.setItem('tv_current_account_id', accountId);
  };

  const handleTradeSaved = async (trade: Trade) => {
    // Strip client-only fields; Convex rejects unknown fields.
    const {
      id: _id,
      userId: _userId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      accountId,
      screenshots,
      ...fields
    } = trade as any;

    // Only screenshots that finished uploading (have a storageId) are
    // persisted; the schema stores Convex storage ids, not raw urls.
    const persistedScreenshots = (screenshots ?? [])
      .filter((s: any) => s.storageId)
      .map((s: any) => ({
        id: s.id,
        type: s.type,
        storageId: s.storageId,
        caption: s.caption,
      }));

    const payload = { ...fields, accountId, screenshots: persistedScreenshots };

    if (editingTrade) {
      await updateTradeMutation({
        tradeId: editingTrade.id,
        ...payload,
      } as any);
    } else {
      await createTradeMutation(payload as any);
    }
    setAddTradeOpen(false);
    setEditingTrade(null);
  };

  const handleTradeDeleted = async (tradeId: string) => {
    await deleteTradeMutation({ tradeId } as any);
  };

  const handleGoalSaved = async (goal: Goal) => {
    const { id, userId: _userId, ...fields } = goal;
    if (id) {
      await updateGoalMutation({ goalId: id, ...fields } as any);
    } else {
      await createGoalMutation(fields as any);
    }
  };

  const handleGoalDeleted = async (goalId: string) => {
    await deleteGoalMutation({ goalId } as any);
  };

  const handleAccountSaved = async (data: AccountFormData) => {
    if (editingAccountId) {
      await updateAccountMutation({ accountId: editingAccountId, ...data } as any);
    } else {
      const newAccountId = await createAccountMutation(data as any);
      handleAccountChange(newAccountId as unknown as string);
    }
  };

  const handleAccountDeleted = async (accountId: string) => {
    await deleteAccountMutation({ accountId } as any);
    if (currentAccountId === accountId) {
      localStorage.removeItem('tv_current_account_id');
    }
  };

  const handleUserUpdated = async (updatedUser: Partial<User>) => {
    if (!user || !userId) return;
    const {
      name,
      avatar,
      bio,
      preferredInstruments,
      currency,
      timezone,
      defaultRiskPercentage,
      defaultAccountBalance,
      theme,
      leaderboardVisible,
      defaultAccountId,
    } = updatedUser;
    await updateUserMutation({
      name,
      avatar,
      bio,
      preferredInstruments,
      currency,
      timezone,
      defaultRiskPercentage,
      defaultAccountBalance,
      theme,
      leaderboardVisible,
      defaultAccountId,
    } as any);
  };

  // Convert Convex user to frontend User type
  const currentUser: User | null = user
    ? {
        id: (user as any)._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        bio: user.bio || '',
        preferredInstruments: user.preferredInstruments,
        defaultAccountId: (user as any).defaultAccountId || '',
        currency: user.currency,
        timezone: user.timezone,
        defaultRiskPercentage: user.defaultRiskPercentage,
        defaultAccountBalance: user.defaultAccountBalance,
        theme: user.theme as 'dark' | 'light' | 'system',
        leaderboardVisible: user.leaderboardVisible,
        isAdmin: !!(user as any).isAdmin,
        isBlocked: !!(user as any).isBlocked,
      }
    : null;

  // Convert Convex accounts to frontend TradingAccount type
  const frontendAccounts: TradingAccount[] = accounts.map((acc: any) => ({
    id: acc._id,
    userId: acc.userId,
    name: acc.name,
    broker: acc.broker,
    type: acc.type as any,
    currency: acc.currency,
    startingBalance: acc.startingBalance,
    currentBalance: acc.currentBalance,
    isDefault: acc.isDefault,
  }));

  // Convert Convex goals to frontend Goal type
  const frontendGoals: Goal[] = goals.map((goal: any) => ({
    id: goal._id,
    userId: goal.userId,
    title: goal.title,
    category: goal.category as any,
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    unit: goal.unit as any,
    period: goal.period as any,
    deadline: goal.deadline,
    completed: goal.completed,
    notes: goal.notes,
    isHardRiskLimit: goal.isHardRiskLimit,
  }));

  // Convert Convex leaderboard to frontend LeaderboardEntry type
  const frontendLeaderboard: LeaderboardEntry[] = leaderboard.map((entry: any) => ({
    userId: entry.userId,
    name: entry.name,
    avatar: entry.avatar || '',
    accountType: entry.accountType as any,
    returnPercentage: entry.returnPercentage,
    netPnL: entry.netPnL,
    winRate: entry.winRate,
    totalTrades: entry.totalTrades,
    profitFactor: entry.profitFactor,
    bestStreak: entry.bestStreak,
    rankChange: entry.rankChange,
    rank: entry.rank,
    favoriteInstrument: entry.favoriteInstrument,
    consistencyScore: entry.consistencyScore,
  }));

  const frontendCompetitions = competitions.map((comp: any) => ({
    id: comp.id,
    title: comp.title,
    description: comp.description,
    startDate: comp.startDate,
    endDate: comp.endDate,
    createdBy: comp.createdBy,
    creatorName: comp.creatorName,
    participantCount: comp.participantCount,
    isJoined: comp.isJoined,
    status: comp.status,
    targetMetric: comp.targetMetric,
    targetValue: comp.targetValue,
  }));

  const handleCreateCompetition = async (data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    targetMetric?: 'netPnL' | 'returnPercentage';
    targetValue?: number;
  }) => {
    await createCompetitionMutation(data as any);
  };

  const handleJoinCompetition = async (competitionId: string) => {
    await joinCompetitionMutation({ competitionId } as any);
  };

  const handleLeaveCompetition = async (competitionId: string) => {
    await leaveCompetitionMutation({ competitionId } as any);
  };

  const handleGetCompetitionLeaderboard = async (competitionId: string) => {
    const result = await convexClient.query(api.competitions.getCompetitionLeaderboard, {
      competitionId,
    } as any);
    return {
      entries: result.entries.map((entry: any) => ({
        userId: entry.userId,
        name: entry.name,
        avatar: entry.avatar || '',
        netPnL: entry.netPnL,
        returnPercentage: entry.returnPercentage,
        winRate: entry.winRate,
        totalTrades: entry.totalTrades,
        rank: entry.rank,
      })),
      targetMetric: result.targetMetric,
      targetValue: result.targetValue,
      winnerUserId: result.winnerUserId,
    };
  };

  const currentAccountForUi: TradingAccount | null = currentAccount
    ? {
        id: currentAccount._id,
        userId: currentAccount.userId,
        name: currentAccount.name,
        broker: currentAccount.broker,
        type: currentAccount.type as any,
        currency: currentAccount.currency,
        startingBalance: currentAccount.startingBalance,
        currentBalance: currentAccount.currentBalance,
        isDefault: currentAccount.isDefault,
      }
    : null;

  // --- Auth gates (all hooks are above this line) ---
  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LandingRoute />;
  }

  if (currentUser?.isBlocked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
          <h1 className="text-lg font-bold text-slate-800 mb-2">Account Blocked</h1>
          <p className="text-sm text-slate-500 mb-6">
            Your account has been blocked by an administrator. If you believe this is a mistake, please contact support.
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AlertNotifier />
      <PlanIntent />
      <AppShell
        currentTab={currentTab}
        onTabChange={handleTabChange}
        currentUser={currentUser!}
        currentAccount={currentAccountForUi}
        accounts={frontendAccounts}
        selectedDateRange={selectedDateRange}
        onDateRangeChange={setSelectedDateRange}
        onAccountChange={handleAccountChange}
        onAddAccount={() => {
          setEditingAccountId(null);
          setAccountModalOpen(true);
        }}
        onEditAccount={() => {
          if (currentAccountForUi) {
            setEditingAccountId(currentAccountForUi.id);
            setAccountModalOpen(true);
          }
        }}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onSignOut={logout}
        isDarkMode={false}
        onToggleTheme={() => {}}
      >
        {/* Dynamic View Routing */}
        {currentTab === 'overview' && (
          <OverviewView
            currentUser={currentUser!}
            currentAccount={currentAccountForUi}
            accounts={frontendAccounts}
            selectedDateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
            onAccountChange={handleAccountChange}
            stats={traderStats}
            trades={filteredTrades}
            onOpenAddTrade={() => {
              setEditingTrade(null);
              setAddTradeOpen(true);
            }}
            onSelectTrade={handleSelectTrade}
            onNavigateToJournal={() => setCurrentTab('journal')}
            onNavigate={handleTabChange}
          />
        )}

        {currentTab === 'journal' && (
          <JournalView
            trades={filteredTrades}
            onOpenAddTrade={() => {
              setEditingTrade(null);
              setAddTradeOpen(true);
            }}
            onOpenImport={() => setImportOpen(true)}
            onSelectTrade={handleSelectTrade}
            onEditTrade={handleEditTrade}
            onDeleteTrade={handleTradeDeleted}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView trades={filteredTrades} stats={traderStats} />
        )}

        {currentTab === 'calendar' && (
          <CalendarView trades={filteredTrades} onSelectTrade={handleSelectTrade} />
        )}

        {currentTab === 'leaderboard' && (
          <LeaderboardView entries={frontendLeaderboard} currentUser={currentUser!} />
        )}

        {currentTab === 'competitions' && (
          <CompetitionsView
            competitions={frontendCompetitions}
            currentUser={currentUser!}
            onCreate={handleCreateCompetition}
            onJoin={handleJoinCompetition}
            onLeave={handleLeaveCompetition}
            getLeaderboard={handleGetCompetitionLeaderboard}
          />
        )}

        {currentTab === 'backtest' && <BacktestView />}
        {currentTab === 'livechart' && (
          <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading chart…</div>}>
            <LiveChartView />
          </Suspense>
        )}

        {currentTab === 'coach' && <CoachView key={currentAccount?._id} currentUser={currentUser!} currentAccountId={currentAccount?._id ?? ''} accountName={currentAccount?.name} />}

        {currentTab === 'goals' && (
          <GoalsView
            currentUser={currentUser!}
            goals={frontendGoals}
            accounts={frontendAccounts}
            currentAccountId={currentAccountId}
            onSaveGoal={handleGoalSaved}
            onDeleteGoal={handleGoalDeleted}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsView
            currentUser={currentUser!}
            currentAccount={currentAccountForUi}
            trades={filteredTrades}
            stats={traderStats}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            currentUser={currentUser!}
            accounts={frontendAccounts}
            onUserUpdated={handleUserUpdated}
            onThemeToggle={() => {}}
            isDarkMode={false}
          />
        )}

        {/* Global Modals */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode="signup"
        />

        {accountModalOpen && (
          <AccountModal
            isOpen={accountModalOpen}
            onClose={() => setAccountModalOpen(false)}
            account={
              editingAccountId
                ? frontendAccounts.find((a) => a.id === editingAccountId) ?? null
                : null
            }
            canDelete={frontendAccounts.length > 1}
            onSave={handleAccountSaved}
            onDelete={handleAccountDeleted}
          />
        )}

        {/* Mounted only while open so the form resets each time */}
        {addTradeOpen && (
          <AddTradeModal
            isOpen={addTradeOpen}
            onClose={() => {
              setAddTradeOpen(false);
              setEditingTrade(null);
            }}
            initialTrade={editingTrade}
            onTradeSaved={handleTradeSaved}
            currentUser={currentUser!}
            accounts={frontendAccounts}
            currentAccountId={currentAccountId}
          />
        )}

        {importOpen && (
          <ImportTradesModal
            isOpen={importOpen}
            onClose={() => setImportOpen(false)}
            currentAccount={currentAccountForUi}
            onImported={() => {}}
          />
        )}

        <TradeDetailModal
          trade={detailTrade}
          allTrades={filteredTrades}
          isOpen={!!detailTrade}
          onClose={() => setDetailTrade(null)}
          onEdit={handleEditTrade}
          onTradeDeleted={() => {
            if (detailTrade) {
              handleTradeDeleted(detailTrade.id);
              setDetailTrade(null);
            }
          }}
          onSelectTrade={setDetailTrade}
        />
      </AppShell>
    </ToastProvider>
  );
}

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/s/')) {
    return <SharedPage token={window.location.pathname.split('/')[2] || ''} />;
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return <AdminPage />;
  }
  if (typeof window !== 'undefined' && /^\/(home|landing)\/?$/.test(window.location.pathname)) {
    return <LandingRoute />;
  }
  return <TradeVaultApp />;
}