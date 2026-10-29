import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  BarChart2,
  Calendar as CalendarIcon,
  Trophy,
  Target,
  FileText,
  Settings,
  ChevronDown,
  Menu,
  Search,
  X,
  Sliders,
  Plus,
  Pencil,
  Swords,
} from 'lucide-react';
import { User, TradingAccount, DateRange } from '../../types';

export type NavTab =
  | 'overview'
  | 'journal'
  | 'add-trade'
  | 'analytics'
  | 'calendar'
  | 'leaderboard'
  | 'competitions'
  | 'goals'
  | 'reports'
  | 'coach'
  | 'backtest'
  | 'livechart'
  | 'settings';

interface AppShellProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentUser: User;
  currentAccount: TradingAccount | null;
  accounts: TradingAccount[];
  selectedDateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onAccountChange: (accountId: string) => void;
  onAddAccount: () => void;
  onEditAccount: () => void;
  onOpenAuthModal: (mode?: 'switch' | 'login' | 'signup') => void;
  onSignOut?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  currentAccount,
  accounts,
  selectedDateRange,
  onDateRangeChange,
  onAccountChange,
  onAddAccount,
  onEditAccount,
  onOpenAuthModal,
  onSignOut,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Compact 5-slot bottom tab bar for mobile — the full nav (all sections)
  // stays reachable via the "More" slot, which opens the existing drawer.
  const mobileTabBarItems: {
    id: NavTab | 'more';
    label: string;
    icon: typeof LayoutDashboard;
    primary?: boolean;
    emoji?: string;
  }[] = [
    { id: 'overview', label: 'Home', icon: LayoutDashboard, emoji: '🏠' },
    { id: 'journal', label: 'Journal', icon: BookOpen, emoji: '📓' },
    { id: 'add-trade', label: 'Log', icon: Plus, primary: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart2, emoji: '📊' },
    { id: 'more', label: 'More', icon: Menu, emoji: '🧩' },
  ];

  // Grouped Navigation hierarchy for TraderVault Trading SaaS
  const navSections = [
    {
      group: 'TRADING',
      items: [
        { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard, emoji: '🏠' },
        { id: 'journal' as NavTab, label: 'Trade Journal', icon: BookOpen, emoji: '📓' },
        { id: 'add-trade' as NavTab, label: 'Log Execution', icon: PlusCircle, emoji: '✍️', badge: 'New' },
        { id: 'coach' as NavTab, label: 'AI Coach', icon: LayoutDashboard, emoji: '🤖', badge: 'AI' },
        { id: 'analytics' as NavTab, label: 'Analytics & Edge', icon: BarChart2, emoji: '📊' },
        { id: 'calendar' as NavTab, label: 'Trading Calendar', icon: CalendarIcon, emoji: '📅' },
        { id: 'livechart' as NavTab, label: 'Live Chart', icon: BarChart2, emoji: '📈', badge: 'Live' },
        { id: 'backtest' as NavTab, label: 'Backtesting', icon: BarChart2, emoji: '🧪' },
      ],
    },
    {
      group: 'PERFORMANCE',
      items: [
        { id: 'leaderboard' as NavTab, label: 'Leaderboard', icon: Trophy, emoji: '🏆', badge: 'Live' },
        { id: 'competitions' as NavTab, label: 'Competitions', icon: Swords, emoji: '⚔️', badge: 'New' },
        { id: 'goals' as NavTab, label: 'Goals & Risk Rules', icon: Target, emoji: '🎯' },
      ],
    },
    {
      group: 'MANAGEMENT',
      items: [
        { id: 'reports' as NavTab, label: 'Audit Statements', icon: FileText, emoji: '🧾' },
        { id: 'settings' as NavTab, label: 'Settings & Risk', icon: Settings, emoji: '⚙️' },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-800 font-sans">
      {/* 1. All-Light Sidebar with Tactile Inner Shadows & Zero Dark Colors */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white border-r border-slate-200/90 shadow-inner-card shrink-0 select-none text-slate-700">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-center px-5 border-b border-slate-100 shadow-inner-card">
          <a href="/home" title="Home"><img src="/logo.png" alt="TraderVault" className="h-9 w-auto object-contain" /></a>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navSections.map((section) => (
            <div key={section.group} className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {section.group}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={`${section.group}-${item.label}`}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 shadow-inner-emerald'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none shrink-0">{item.emoji}</span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono shadow-inner-soft ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 border border-slate-200 text-slate-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Profile Card at bottom (Light Card with Inset Subtle Shadow) */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 shadow-inner-soft relative">
          <div
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 shadow-sm cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 shadow-inner-soft"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0 shadow-inner-soft">
                  {currentUser?.name?.charAt(0).toUpperCase() || 'T'}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {currentUser?.name || 'Trader'}
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-1.5 py-0.2 rounded shadow-inner-emerald">
                    Trader
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate font-mono">
                  {currentUser?.email || ''}
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </div>

          {/* User Switcher Dropdown */}
          {userDropdownOpen && (
            <div className="absolute bottom-16 left-3 right-3 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 text-xs shadow-inner-card">
              <div className="p-2 border-b border-slate-100 text-slate-500 text-[11px]">
                Active Profile: <strong className="text-slate-800">{currentUser?.name || 'Trader'}</strong>
              </div>
              <button
                onClick={() => {
                  onTabChange('settings');
                  setUserDropdownOpen(false);
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-colors"
              >
                <Sliders className="w-4 h-4 text-slate-400" />
                Profile & Risk Settings
              </button>
              {onSignOut && (
                <button
                  onClick={() => {
                    onSignOut();
                    setUserDropdownOpen(false);
                  }}
                  className="w-full text-left p-2 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Sign Out
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar: search / account / avatar */}
        <header className="lg:hidden flex items-center justify-between px-4 pt-3 pb-2 bg-[#f4f4f5]">
          <button type="button" onClick={() => onTabChange('journal')} className="w-10 h-10 flex items-center justify-center text-slate-600" aria-label="Search journal">
            <Search className="w-6 h-6" />
          </button>
          <div className="text-center min-w-0">
            <p className="text-sm font-light text-slate-400 leading-none">account:</p>
            <div className="relative">
              <select
                value={currentAccount?.id || ''}
                onChange={(e) => onAccountChange(e.target.value)}
                className="appearance-none bg-transparent text-center text-base font-medium text-black focus:outline-none max-w-[170px] truncate cursor-pointer"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="relative w-10 h-10" aria-label="Menu">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <span className="w-10 h-10 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
                {currentUser?.name?.charAt(0).toUpperCase() || 'T'}
              </span>
            )}
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#f4f4f5]" />
          </button>
        </header>

        {/* Top Header Bar for Desktop */}
        
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200/90 shadow-inner-card px-3 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-800 capitalize">
                {currentTab === 'livechart' ? 'Live Chart' : currentTab === 'backtest' ? 'Backtesting' : currentTab.replace('-', ' ')}
              </h2>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                TraderVault Institutional Journal & Analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {/* Account Selector in Header */}
            {currentAccount && (
              <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
                <select
                  value={currentAccount.id}
                  onChange={(e) => onAccountChange(e.target.value)}
                  className="max-w-[120px] sm:max-w-none px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none shadow-inner-soft cursor-pointer hover:bg-white transition-colors truncate"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (${a.currentBalance?.toLocaleString()})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onEditAccount}
                  title="Edit current account"
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onAddAccount}
                  title="Add new account"
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Sign Out Button */}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
                title="Sign out"
              >
                <X className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-slate-800/20 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 bg-white p-4 flex flex-col justify-between z-50 overflow-y-auto shadow-2xl shadow-inner-card">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <a href="/home" title="Home"><img src="/logo.png" alt="TraderVault" className="h-7 w-auto object-contain" /></a>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {navSections.map((sec) => (
                  <div key={sec.group} className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400">{sec.group}</div>
                    {sec.items.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => {
                          onTabChange(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-between ${
                          currentTab === item.id
                            ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{item.emoji} {item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 text-slate-600">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400">ACCOUNTS</div>
                  <button
                    onClick={() => { setMobileMenuOpen(false); onAddAccount(); }}
                    className="w-full text-left py-2 px-3 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                  >
                    ➕ Add new account
                  </button>
                  {currentAccount && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); onEditAccount(); }}
                      className="w-full text-left py-2 px-3 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
                    >
                      ✏️ Edit "{currentAccount.name}"
                    </button>
                  )}
                </div>
                {onSignOut && (
                  <button
                    onClick={() => { setMobileMenuOpen(false); onSignOut(); }}
                    className="w-full text-left py-2 px-3 rounded-xl text-xs text-rose-600 hover:bg-rose-50"
                  >
                    🚪 Sign out
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Workspace (Light with inner-shadow accents) */}
        <main className="flex-1 p-3.5 pb-24 sm:p-6 sm:pb-24 lg:p-10 max-w-7xl w-full mx-auto overflow-y-auto">
          <div key={currentTab} className="animate-viewIn">
            {(currentTab === 'journal' || currentTab === 'calendar') && (
              <h2 className="text-[28px] lg:text-[34px] leading-tight font-medium tracking-tight text-black mb-4 px-0.5">
                {currentTab === 'journal' ? '📓 Trade Journal' : '📅 Trading Calendar'}
              </h2>
            )}
            {children}
          </div>
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-stretch shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
          {mobileTabBarItems.map((item) => {
            const Icon = item.icon;
            if (item.id === 'more') {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-500"
                >
                  <span className="text-xl leading-none">{item.emoji}</span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }
            if (item.primary) {
              return (
                <button
                  key="primary"
                  type="button"
                  onClick={() => onTabChange(item.id as NavTab)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5"
                >
                  <div className="w-10 h-10 -mt-3 rounded-full bg-emerald-600 flex items-center justify-center shadow-md shadow-inner-btn text-white">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{item.label}</span>
                </button>
              );
            }
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id as NavTab)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-slate-500'
                }`}
              >
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};