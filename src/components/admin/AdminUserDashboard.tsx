import React, { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { ArrowLeft, Eye } from 'lucide-react';
import { AppShell, NavTab } from '../layout/AppShell';
import { OverviewView } from '../dashboard/OverviewView';
import { JournalView } from '../journal/JournalView';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { CalendarView } from '../calendar/CalendarView';
import { GoalsView } from '../goals/GoalsView';
import { ReportsView } from '../reports/ReportsView';
import { TradeDetailModal } from '../journal/TradeDetailModal';
import { useToast } from '../common/Toast';
import { calculateTraderStats, filterTradesByDateRange } from '../../lib/calculations';
import { Trade, DateRange, User, TradingAccount, Goal } from '../../types';

const READ_ONLY_MESSAGE = "Admin view is read-only — this user's data can't be changed from here.";

interface AdminUserDashboardProps {
  userId?: Id<'users'>;
  /** Public share link mode: no login, one account only. */
  shareToken?: string;
  onBack: () => void;
}

export const AdminUserDashboard: React.FC<AdminUserDashboardProps> = ({ userId, shareToken, onBack }) => {
  const { toast } = useToast();
  const adminData = useQuery(api.admin.getUserFullDashboard, userId && !shareToken ? { userId } : 'skip');
  const sharedData = useQuery(api.share.getSharedDashboard, shareToken ? { token: shareToken } : 'skip');
  const data: any = shareToken ? sharedData : adminData;

  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('all');
  const [currentAccountId, setCurrentAccountId] = useState<string>('');
  const [detailTrade, setDetailTrade] = useState<Trade | null>(null);

  const blocked = () => toast({ type: 'info', title: 'Read-only', message: READ_ONLY_MESSAGE });

  const handleNavigate = (tab: NavTab) => {
    if (tab === 'add-trade' || tab === 'settings' || tab === 'leaderboard' || tab === 'competitions' || tab === 'coach' || tab === 'backtest' || tab === 'livechart' || (shareToken && (tab === 'goals' || tab === 'reports'))) {
      blocked();
      return;
    }
    setCurrentTab(tab);
  };

  const frontendUser: User | null = useMemo(() => {
    if (!data?.user) return null;
    const u = data.user;
    return {
      id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar || '',
      bio: u.bio || '',
      preferredInstruments: u.preferredInstruments,
      defaultAccountId: u.defaultAccountId || '',
      currency: u.currency,
      timezone: u.timezone,
      defaultRiskPercentage: u.defaultRiskPercentage,
      defaultAccountBalance: u.defaultAccountBalance,
      theme: 'light',
      leaderboardVisible: u.leaderboardVisible,
      isAdmin: !!u.isAdmin,
      isBlocked: !!u.isBlocked,
    };
  }, [data?.user]);

  const frontendAccounts: TradingAccount[] = useMemo(
    () =>
      (data?.accounts ?? []).map((acc: any) => ({
        id: acc._id,
        userId: acc.userId,
        name: acc.name,
        broker: acc.broker,
        type: acc.type,
        currency: acc.currency,
        startingBalance: acc.startingBalance,
        currentBalance: acc.currentBalance,
        isDefault: acc.isDefault,
      })),
    [data?.accounts]
  );

  const frontendGoals: Goal[] = useMemo(
    () =>
      (data?.goals ?? []).map((goal: any) => ({
        id: goal._id,
        userId: goal.userId,
        title: goal.title,
        category: goal.category,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        unit: goal.unit,
        period: goal.period,
        deadline: goal.deadline,
        completed: goal.completed,
        notes: goal.notes,
        isHardRiskLimit: goal.isHardRiskLimit,
      })),
    [data?.goals]
  );

  const frontendTrades: Trade[] = useMemo(
    () =>
      (data?.trades ?? []).map((trade: any) => ({
        id: trade._id,
        userId: trade.userId,
        accountId: trade.accountId,
        instrument: trade.instrument,
        direction: trade.direction,
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
        outcome: trade.outcome,
        rMultiple: trade.rMultiple,
        plannedRR: trade.plannedRR,
        roiPercentage: trade.roiPercentage,
        strategy: trade.strategy,
        timeframe: trade.timeframe,
        session: trade.session,
        setupType: trade.setupType,
        marketConditions: trade.marketConditions,
        entryReason: trade.entryReason,
        exitReason: trade.exitReason,
        mistakesMade: trade.mistakesMade,
        lessonsLearned: trade.lessonsLearned,
        tags: trade.tags ?? [],
        moodBefore: trade.moodBefore,
        confidenceLevel: trade.confidenceLevel,
        emotionDuring: trade.emotionDuring,
        followedPlan: trade.followedPlan,
        revengeTrade: trade.revengeTrade,
        fomoTrade: trade.fomoTrade,
        screenshots: (trade.screenshots ?? []).map((s: any) => ({
          id: s.id,
          type: s.type,
          url: s.url ?? '',
          storageId: s.storageId,
          caption: s.caption,
        })),
        createdAt: new Date(trade._creationTime).toISOString(),
        updatedAt: new Date(trade._creationTime).toISOString(),
      })),
    [data?.trades]
  );

  const effectiveAccountId = currentAccountId || frontendAccounts.find((a) => a.isDefault)?.id || frontendAccounts[0]?.id || '';
  const currentAccount = frontendAccounts.find((a) => a.id === effectiveAccountId) || null;

  const accountTrades = useMemo(
    () => frontendTrades.filter((t) => t.accountId === effectiveAccountId),
    [frontendTrades, effectiveAccountId]
  );
  const filteredTrades = useMemo(
    () => filterTradesByDateRange(accountTrades, selectedDateRange),
    [accountTrades, selectedDateRange]
  );
  const traderStats = useMemo(
    () => calculateTraderStats(filteredTrades, currentAccount?.startingBalance || 50000),
    [filteredTrades, currentAccount]
  );

  if (data === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">
        Loading dashboard…
      </div>
    );
  }
  if (data === null || !frontendUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">
        This share link is invalid or has been turned off.
      </div>
    );
  }

  return (
    <div>
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
          <Eye className="w-3.5 h-3.5" />
          {shareToken ? `Shared dashboard — ${frontendUser.name} (read-only)` : `Admin view — viewing ${frontendUser.name}'s dashboard (read-only)`}
        </div>
        {!shareToken && <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Admin
        </button>}
      </div>

      <AppShell
        currentTab={currentTab}
        onTabChange={handleNavigate}
        currentUser={frontendUser}
        currentAccount={currentAccount}
        accounts={frontendAccounts}
        selectedDateRange={selectedDateRange}
        onDateRangeChange={setSelectedDateRange}
        onAccountChange={setCurrentAccountId}
        onAddAccount={blocked}
        onEditAccount={blocked}
        onOpenAuthModal={() => {}}
        onSignOut={onBack}
        isDarkMode={false}
        onToggleTheme={() => {}}
      >
        {currentTab === 'overview' && (
          <OverviewView
            currentUser={frontendUser}
            currentAccount={currentAccount}
            accounts={frontendAccounts}
            selectedDateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
            onAccountChange={setCurrentAccountId}
            stats={traderStats}
            trades={filteredTrades}
            onOpenAddTrade={blocked}
            onSelectTrade={setDetailTrade}
            onNavigateToJournal={() => setCurrentTab('journal')}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'journal' && (
          <JournalView
            trades={filteredTrades}
            onOpenAddTrade={blocked}
            onOpenImport={blocked}
            onSelectTrade={setDetailTrade}
            onEditTrade={blocked}
            onDeleteTrade={blocked}
          />
        )}

        {currentTab === 'analytics' && <AnalyticsView trades={filteredTrades} stats={traderStats} />}

        {currentTab === 'calendar' && <CalendarView trades={filteredTrades} onSelectTrade={setDetailTrade} />}

        {currentTab === 'goals' && (
          <GoalsView currentUser={frontendUser} goals={frontendGoals} accounts={frontendAccounts} currentAccountId={effectiveAccountId} readOnly onSaveGoal={blocked} onDeleteGoal={blocked} />
        )}

        {currentTab === 'reports' && (
          <ReportsView currentUser={frontendUser} currentAccount={currentAccount} trades={filteredTrades} stats={traderStats} />
        )}

        <TradeDetailModal
          trade={detailTrade}
          allTrades={filteredTrades}
          isOpen={!!detailTrade}
          onClose={() => setDetailTrade(null)}
          onEdit={blocked}
          onTradeDeleted={blocked}
          onSelectTrade={setDetailTrade}
        />
      </AppShell>
    </div>
  );
};
