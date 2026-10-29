import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConvexAppProvider } from './convex/client';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { UpdateWatcher, OfflineBanner } from './components/common/AppWatchers';
import { installGlobalHandlers } from './lib/errorReporting';

installGlobalHandlers();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ConvexAppProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConvexAppProvider>
    <UpdateWatcher />
    <OfflineBanner />
  </ErrorBoundary>
);

// Service worker (installable PWA + basic offline app shell) — production
// builds only, so it never interferes with Vite's dev-server HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
