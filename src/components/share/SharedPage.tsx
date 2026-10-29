import React from 'react';
import { ToastProvider } from '../common/Toast';
import { AdminUserDashboard } from '../admin/AdminUserDashboard';

export const SharedPage: React.FC<{ token: string }> = ({ token }) => (
  <ToastProvider>
    <AdminUserDashboard shareToken={token} onBack={() => { window.location.href = '/'; }} />
  </ToastProvider>
);
