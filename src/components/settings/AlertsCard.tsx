import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '../common/Toast';
import { isSoundOn, playChime, setSoundOn, ChimeKind } from '../../lib/alertSound';

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const AlertsCard: React.FC = () => {
  const { toast } = useToast();
  const vapid = useQuery(api.push.getPublicKey, {});
  const save = useMutation(api.push.saveSubscription);
  const remove = useMutation(api.push.removeSubscription);

  const [sound, setSound] = useState(isSoundOn());
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .getRegistration('/sw.js')
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => setPushOn(!!s && Notification.permission === 'granted'))
      .catch(() => {});
  }, [supported]);

  const enablePush = async () => {
    if (!vapid) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast({ type: 'error', title: 'Notifications blocked', message: 'Allow notifications for this site in your browser settings, then try again.' });
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapid) }));
      const j = sub.toJSON();
      await save({ endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
      setPushOn(true);
      playChime('test', true);
      toast({ type: 'success', title: 'Alerts enabled on this device' });
    } catch (e: any) {
      toast({ type: 'error', title: 'Could not enable alerts', message: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await remove({ endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setPushOn(false);
  };

  const sounds: [ChimeKind, string][] = [
    ['entry', '🟢 Entry'],
    ['win', '✅ Profit'],
    ['loss', '❌ Loss'],
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-inner-card space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">🔔 Alert Notifications</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Get a pop-up and a sound the moment a TradingView or MT5 alert hits. Turn on device notifications to be alerted even when
        TraderVault is closed.
      </p>

      <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm">
        <span>🔊 Play sound while TraderVault is open</span>
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => {
            setSound(e.target.checked);
            setSoundOn(e.target.checked);
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {sounds.map(([k, label]) => (
          <button key={k} type="button" onClick={() => playChime(k, true)} className="px-4 py-2 rounded-full text-xs bg-white border border-slate-200 text-slate-700">
            ▶ {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-slate-50 p-3 space-y-2">
        <p className="text-sm font-medium text-slate-900">📱 Device notifications {pushOn ? '· on' : ''}</p>
        {!supported ? (
          <p className="text-xs text-slate-500">
            This browser can't show push notifications. On iPhone: open TraderVault in Safari → Share → <b>Add to Home Screen</b>, open it
            from the home screen, then enable here.
          </p>
        ) : pushOn ? (
          <button type="button" onClick={disablePush} className="px-4 py-2 rounded-full text-xs bg-white border border-slate-200 text-rose-600">
            Turn off on this device
          </button>
        ) : (
          <button type="button" disabled={busy || !vapid} onClick={enablePush} className="px-4 py-2 rounded-full text-xs bg-black text-white disabled:opacity-50">
            {busy ? 'Enabling…' : 'Enable device notifications'}
          </button>
        )}
        <p className="text-[11px] text-slate-400">Closed-app notifications use your device's own notification sound.</p>
      </div>
    </div>
  );
};
