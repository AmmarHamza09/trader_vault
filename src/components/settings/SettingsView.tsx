import React, { useState } from 'react';
import {
  User as UserIcon,
  Coins,
  Palette,
  Save,
} from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { User, TradingAccount } from '../../types';
import { useToast } from '../common/Toast';
import { ImageUploader } from '../common/ImageUploader';
import { Mt5SyncCard } from './Mt5SyncCard';
import { ShareCard } from './ShareCard';
import { TradingViewCard } from './TradingViewCard';
import { AlertsCard } from './AlertsCard';
import { TimezoneCard } from './TimezoneCard';
import { PlanCard } from './PlanCard';

interface SettingsViewProps {
  currentUser: User;
  accounts: TradingAccount[];
  onUserUpdated: (user: User) => void | Promise<void>;
  onThemeToggle: () => void;
  isDarkMode: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  accounts,
  onUserUpdated,
  onThemeToggle,
  isDarkMode,
}) => {
  const { toast } = useToast();
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setAvatarFromUpload = useMutation(api.users.setAvatarFromUpload);
  const [name, setName] = useState(currentUser.name);
  const [email] = useState(currentUser.email);
  const [bio, setBio] = useState(currentUser.bio);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [currency, setCurrency] = useState(currentUser.currency);
  const [timezone, setTimezone] = useState(currentUser.timezone);
  const [riskPercent, setRiskPercent] = useState(currentUser.defaultRiskPercentage.toString());
  const [leaderboardVisible, setLeaderboardVisible] = useState(currentUser.leaderboardVisible);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAvatarUploaded = async (storageId: any) => {
    try {
      const url = await setAvatarFromUpload({ storageId });
      setAvatar(url);
      await onUserUpdated({ ...currentUser, avatar: url });
      toast({
        type: 'success',
        title: 'Profile Photo Updated',
        message: 'Your new avatar has been saved.',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Could not save your new avatar.',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const updated: User = {
        ...currentUser,
        name,
        bio,
        avatar,
        currency,
        timezone,
        defaultRiskPercentage: parseFloat(riskPercent) || 1.0,
        leaderboardVisible,
      };
      await onUserUpdated(updated);
      toast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Your profile and risk preferences have been updated.',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Save Failed',
        message: err instanceof Error ? err.message : 'Could not save your changes. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[26px] sm:text-[30px] leading-tight font-medium tracking-tight text-black">
          ⚙️ Trader Profile & Preferences
        </h2>
        <p className="text-xs text-slate-500">
          Configure execution risk parameters, display preferences, and account privacy
        </p>
      </div>

      {/* Main Settings Form */}
      <PlanCard />
      <ShareCard accounts={accounts} />
      <TimezoneCard />
      <AlertsCard />
      <TradingViewCard />
      <Mt5SyncCard />

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Details */}
        <div className="bg-white  rounded-2xl border border-slate-200/80  p-4 sm:p-6 shadow-inner-card space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <UserIcon className="w-4 h-4 text-emerald-500" /> Personal Profile
          </h3>

          <div className="flex items-center gap-4 pb-2">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-lg font-bold flex items-center justify-center shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Profile Photo
              </label>
              <ImageUploader
                compact
                label="Upload new photo"
                generateUploadUrl={() => generateAvatarUploadUrl()}
                onUploaded={handleAvatarUploaded}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700  mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700  mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                readOnly
                disabled
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Linked to your sign-in account and can't be changed here.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700  mb-1">
                Trader Bio & Trading Style
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Risk & Account Settings */}
        <div className="bg-white  rounded-2xl border border-slate-200/80  p-4 sm:p-6 shadow-inner-card space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-emerald-500" /> Risk Management & Regional Defaults
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700  mb-1">
                Base Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700  mb-1">
                Market Timezone
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700  mb-1">
                Default Risk per Trade (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200  bg-white  text-slate-800  focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Display & Privacy Settings */}
        <div className="bg-white  rounded-2xl border border-slate-200/80  p-4 sm:p-6 shadow-inner-card space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-emerald-500" /> Interface & Privacy
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200  bg-slate-50 ">
              <div>
                <span className="text-xs font-semibold block text-slate-800 ">
                  Visual Theme (Dark Mode)
                </span>
                <span className="text-[11px] text-slate-500">
                  Current: {isDarkMode ? 'Dark Charcoal Interface' : 'Light Clean Studio'}
                </span>
              </div>
              <button
                type="button"
                onClick={onThemeToggle}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200  bg-white  text-slate-800  hover:bg-slate-100 transition-colors"
              >
                Toggle Theme
              </button>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200  bg-slate-50  cursor-pointer">
              <div>
                <span className="text-xs font-semibold block text-slate-800 ">
                  Global Leaderboard Participation
                </span>
                <span className="text-[11px] text-slate-500">
                  Allow your anonymous percentage return to be listed in trader benchmarks
                </span>
              </div>
              <input
                type="checkbox"
                checked={leaderboardVisible}
                onChange={(e) => setLeaderboardVisible(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-inner-card transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
