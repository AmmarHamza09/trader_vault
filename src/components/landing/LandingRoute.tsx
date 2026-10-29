import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ToastProvider } from '../common/Toast';
import { AuthModal } from '../auth/AuthModal';

// The landing page (and its CSS) is its own chunk, so it never adds to the dashboard's load time.
const LandingPage = lazy(() => import('./LandingPage'));

const initialMode = (): 'login' | 'signup' | null => {
  const p = window.location.pathname;
  return p.startsWith('/signup') ? 'signup' : p.startsWith('/login') ? 'login' : null;
};

export const LandingRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | null>(initialMode);
  const wasAuthed = useRef(isAuthenticated);

  // Signed in from /home (or /login) → go to the app.
  useEffect(() => {
    if (isAuthenticated && !wasAuthed.current && window.location.pathname !== '/') window.location.replace('/');
    wasAuthed.current = isAuthenticated;
  }, [isAuthenticated]);

  const show = (m: 'login' | 'signup' | null) => {
    setMode(m);
    window.history.replaceState({}, '', m ? `/${m}` : window.location.pathname === '/login' || window.location.pathname === '/signup' ? '/' : window.location.pathname);
  };

  return (
    <ToastProvider>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f4f4f5' }} />}>
        <LandingPage authed={isAuthenticated} onLogin={() => show('login')} onSignup={() => show('signup')} />
      </Suspense>
      {!isAuthenticated && mode && <AuthModal key={mode} isOpen onClose={() => show(null)} initialMode={mode} />}
    </ToastProvider>
  );
};
