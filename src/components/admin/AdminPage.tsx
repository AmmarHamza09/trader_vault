import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Shield, Ban, CheckCircle2, Trash2, X, TrendingUp, Search, LogOut, LayoutDashboard, Settings2, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ToastProvider, useToast } from '../common/Toast';
import { LoadingScreen } from '../common/LoadingScreen';
import { AuthModal } from '../auth/AuthModal';
import { AdminUserDashboard } from './AdminUserDashboard';
import { HealthPanel } from './HealthPanel';
import { MarketingPanel } from './MarketingPanel';

const AdminUserDetail: React.FC<{
  userId: Id<'users'>;
  onClose: () => void;
  onChanged: () => void;
}> = ({ userId, onClose, onChanged }) => {
  const { toast } = useToast();
  const { userId: viewerUserId } = useAuth();
  const detail = useQuery(api.admin.getUserDetail, { userId });
  const blockUser = useMutation(api.admin.blockUser);
  const unblockUser = useMutation(api.admin.unblockUser);
  const deleteUser = useMutation(api.admin.deleteUser);
  const setAdmin = useMutation(api.admin.setAdmin);
  const setSuperUser = useMutation(api.billing.setSuperUser);
  const setPlanManual = useMutation(api.billing.setPlanManual);
  const [busy, setBusy] = useState(false);

  if (detail === undefined) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-sm text-slate-500">Loading user…</div>
      </div>
    );
  }
  if (detail === null) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-sm text-slate-500">User not found.</div>
      </div>
    );
  }

  const { user, accounts, trades, goals } = detail;

  const handleBlockToggle = async () => {
    setBusy(true);
    try {
      if (user.isBlocked) {
        await unblockUser({ userId });
        toast({ type: 'success', title: 'User unblocked' });
      } else {
        await blockUser({ userId });
        toast({ type: 'success', title: 'User blocked' });
      }
      onChanged();
    } catch (err: any) {
      toast({ type: 'error', title: 'Action failed', message: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminToggle = async () => {
    const makingAdmin = !user.isAdmin;
    if (!makingAdmin && !window.confirm(`Remove admin access from ${user.name}?`)) {
      return;
    }
    setBusy(true);
    try {
      await setAdmin({ userId, isAdmin: makingAdmin });
      toast({ type: 'success', title: makingAdmin ? 'Granted admin access' : 'Removed admin access' });
      onChanged();
    } catch (err: any) {
      toast({ type: 'error', title: 'Action failed', message: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete ${user.name} (${user.email}) and all their trading data? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteUser({ userId });
      toast({ type: 'success', title: 'User deleted' });
      onChanged();
      onClose();
    } catch (err: any) {
      toast({ type: 'error', title: 'Delete failed', message: err?.message });
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-semibold">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">{user.name}</h2>
                {user.isAdmin && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                    Admin
                  </span>
                )}
                {user.isBlocked && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                    Blocked
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{trades.length}</p>
            <p className="text-[11px] text-slate-400">Trades (recent)</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{accounts.length}</p>
            <p className="text-[11px] text-slate-400">Accounts</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{goals.length}</p>
            <p className="text-[11px] text-slate-400">Goals</p>
          </div>
        </div>

        <div className="px-6 pb-4">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">Profile</h3>
          <dl className="text-xs text-slate-600 grid grid-cols-2 gap-y-1.5">
            <dt className="text-slate-400">Bio</dt>
            <dd>{user.bio || '—'}</dd>
            <dt className="text-slate-400">Currency</dt>
            <dd>{user.currency}</dd>
            <dt className="text-slate-400">Timezone</dt>
            <dd>{user.timezone}</dd>
            <dt className="text-slate-400">Default risk %</dt>
            <dd>{user.defaultRiskPercentage}%</dd>
            <dt className="text-slate-400">Joined</dt>
            <dd>{new Date(user._creationTime).toLocaleDateString()}</dd>
          </dl>
        </div>

        <div className="px-6 pb-4">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">Accounts</h3>
          <div className="space-y-1.5">
            {accounts.length === 0 && <p className="text-xs text-slate-400">No accounts.</p>}
            {accounts.map((a: any) => (
              <div key={a._id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium text-slate-700">{a.name} · {a.broker}</span>
                <span className="font-mono text-slate-500">{a.currency} {a.currentBalance.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-4">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">Recent Trades</h3>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {trades.length === 0 && <p className="text-xs text-slate-400">No trades.</p>}
            {trades.map((t: any) => (
              <div key={t._id} className="flex items-center justify-between text-xs px-3 py-1.5 border-b border-slate-50">
                <span className="text-slate-600">{t.instrument} · {t.direction} · {t.entryDate}</span>
                <span className={`font-mono font-semibold ${t.netPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {t.netPnL >= 0 ? '+' : ''}{t.netPnL.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 pt-4 border-t border-slate-100">
          <button
            disabled={busy || (user.isAdmin && userId === viewerUserId)}
            onClick={handleAdminToggle}
            title={user.isAdmin && userId === viewerUserId ? "You can't remove your own admin access" : undefined}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {user.isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
          </button>
        </div>

        <div className="px-6 pb-2 space-y-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setSuperUser({ userId, superUser: !user.superUser });
                toast({ type: 'success', title: user.superUser ? 'Super user removed' : 'Super user granted (free full access)' });
                onChanged();
              } catch (err: any) {
                toast({ type: 'error', title: 'Action failed', message: err?.message });
              } finally { setBusy(false); }
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            ⭐ {user.superUser ? 'Remove Super User' : 'Make Super User (free full access)'}
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 shrink-0">Plan:</span>
            <select
              disabled={busy}
              value={user.subStatus === 'comped' ? user.plan ?? '' : user.plan && user.subStatus ? 'paid' : ''}
              onChange={async (e) => {
                const v = e.target.value;
                if (v === 'paid') return;
                setBusy(true);
                try {
                  await setPlanManual({ userId, plan: v === 'pro' || v === 'elite' ? v : null });
                  toast({ type: 'success', title: v ? `Comped ${v}` : 'Plan cleared' });
                  onChanged();
                } catch (err: any) {
                  toast({ type: 'error', title: 'Action failed', message: err?.message });
                } finally { setBusy(false); }
              }}
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Free (Starter)</option>
              <option value="pro">Comp: Pro</option>
              <option value="elite">Comp: Elite</option>
              {user.plan && user.subStatus && user.subStatus !== 'comped' && <option value="paid">Paid: {user.plan} ({user.subStatus})</option>}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4">
          <button
            disabled={busy}
            onClick={handleBlockToggle}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {user.isBlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
            {user.isBlocked ? 'Unblock User' : 'Block User'}
          </button>
          <button
            disabled={busy}
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
};

const ACTION_LABELS: Record<string, string> = {
  block_user: 'Blocked user',
  unblock_user: 'Unblocked user',
  delete_user: 'Deleted user',
  grant_admin: 'Granted admin',
  revoke_admin: 'Revoked admin',
};

const AuditLogPanel: React.FC = () => {
  const logs = useQuery(api.admin.listAuditLogs, {});

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="py-3 px-4 font-semibold">When</th>
              <th className="py-3 px-4 font-semibold">Admin</th>
              <th className="py-3 px-4 font-semibold">Action</th>
              <th className="py-3 px-4 font-semibold">Target</th>
              <th className="py-3 px-4 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs === undefined && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Loading audit log…
                </td>
              </tr>
            )}
            {logs !== undefined && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No admin actions recorded yet.
                </td>
              </tr>
            )}
            {logs?.map((log) => (
              <tr key={log._id}>
                <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                  {new Date(log._creationTime).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-slate-600">{log.actorEmail}</td>
                <td className="py-3 px-4">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      log.action === 'delete_user' || log.action === 'block_user'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    }`}
                  >
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-600">{log.targetEmail || '—'}</td>
                <td className="py-3 px-4 text-slate-400">{log.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { logout, user } = useAuth();
  const users = useQuery(api.admin.listUsers, {});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<'users' | 'audit' | 'health' | 'marketing'>('users');
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(null);
  const [dashboardUserId, setDashboardUserId] = useState<Id<'users'> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const filtered = (users ?? []).filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (dashboardUserId) {
    return <AdminUserDashboard userId={dashboardUserId} onBack={() => setDashboardUserId(null)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="TraderVault" className="h-7 w-auto object-contain" />
          <div>
            <h1 className="text-sm font-extrabold text-slate-800 flex items-center gap-1">
              TraderVault <span className="text-emerald-600">Admin</span>
            </h1>
            <p className="text-[11px] text-slate-400">Signed in as {user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          <button
            onClick={() => setPage('users')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              page === 'users' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setPage('audit')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              page === 'audit' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Audit Log
          </button>
          <button
            onClick={() => setPage('health')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              page === 'health' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            System Health
          </button>
          <button
            onClick={() => setPage('marketing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              page === 'marketing' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📣 Marketing
          </button>
        </div>

        {page === 'marketing' ? (
          <MarketingPanel />
        ) : page === 'health' ? (
          <HealthPanel />
        ) : page === 'audit' ? (
          <AuditLogPanel />
        ) : (
        <>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800">Users ({filtered.length})</h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Trades</th>
                  <th className="py-3 px-4 font-semibold">Accounts</th>
                  <th className="py-3 px-4 font-semibold">Net P&amp;L</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users === undefined && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading users…
                    </td>
                  </tr>
                )}
                {users !== undefined && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr
                    key={u._id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setDashboardUserId(u._id)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-400">
                            {u.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-700">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                        {u.isAdmin && (
                          <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                            ADMIN
                          </span>
                        )}
                        {!u.isAdmin && (
                          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded border ${u.superUser ? 'bg-amber-50 text-amber-700 border-amber-200' : (u.plan ?? 'starter') !== 'starter' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                            {u.superUser ? 'SUPER' : (u.plan ?? 'starter') === 'starter' ? 'FREE' : String(u.plan).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.tradeCount}</td>
                    <td className="py-3 px-4 text-slate-600">{u.accountCount}</td>
                    <td className={`py-3 px-4 font-mono font-semibold ${u.totalNetPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {u.totalNetPnL >= 0 ? '+' : ''}
                      {u.totalNetPnL.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      {u.isBlocked ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                          Blocked
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDashboardUserId(u._id);
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          <LayoutDashboard className="w-3 h-3" />
                          Dashboard
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserId(u._id);
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                        >
                          <Settings2 className="w-3 h-3" />
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </main>

      {selectedUserId && (
        <AdminUserDetail
          key={refreshKey}
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <AuthModal isOpen={true} onClose={() => {}} initialMode="login" />
      </ToastProvider>
    );
  }

  if (!(user as any)?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">Access Denied</h1>
          <p className="text-sm text-slate-500 mb-6">
            This account doesn't have admin access.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Back to TraderVault
          </a>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AdminDashboard />
    </ToastProvider>
  );
};
