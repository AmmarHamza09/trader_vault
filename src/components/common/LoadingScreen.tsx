import React from 'react';

// Same markup and styles as the splash in index.html (critical CSS lives there), so the hand-off from
// the pre-React splash to this screen is seamless — no flash, no restart of the animation.
export const LoadingScreen: React.FC = () => (
  <div className="tv-splash" role="status" aria-label="Loading TraderVault">
    <div className="tv-logo"><img src="/logo.png" alt="" /></div>
  </div>
);
