import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration skipped gracefully if unsupported
    });
  });
}

function RootShell() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <>
      {isOffline && (
        <div
          role="status"
          className="fixed bottom-24 inset-x-3 z-[95] mx-auto max-w-md rounded-xl border border-[#9E6A03] bg-[#3B2E0B] px-3.5 py-2.5 text-center text-xs font-mono font-bold text-[#D29922] shadow-lg lg:bottom-4"
        >
          Offline mode active — reconnect to sync live bookings &amp; voice replies.
        </div>
      )}
      <App />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<RootShell />);
