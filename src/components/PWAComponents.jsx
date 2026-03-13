import { useState, useEffect } from 'react';

/* ── Install Prompt Banner ── */
export function PWAInstallBanner() {
  const [prompt, setPrompt]     = useState(null);
  const [show, setShow]         = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS]       = useState(false);
  const [showIOS, setShowIOS]   = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) { setInstalled(true); return; }

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);
    if (ios) {
      const dismissed = localStorage.getItem('ohc_ios_prompt_dismissed');
      if (!dismissed) setTimeout(() => setShowIOS(true), 3000);
      return;
    }

    // Android/Desktop beforeinstallprompt
    const handler = (e) => { e.preventDefault(); setPrompt(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstalled(true); setShow(false); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setShow(false);
  };

  const dismissIOS = () => { localStorage.setItem('ohc_ios_prompt_dismissed', '1'); setShowIOS(false); };

  if (installed) return null;

  // iOS instructions
  if (showIOS) return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-border p-4 max-w-sm mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center flex-shrink-0 text-xl">🏥</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text text-sm">Install OHC Command</div>
          <div className="text-xs text-muted mt-1">
            Tap <span className="inline-flex items-center gap-0.5 text-blue-600 font-medium">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 1v10M4 5l4-4 4 4M2 13h12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Share
            </span> then <strong>"Add to Home Screen"</strong>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <div className="w-2 h-2 rounded-full bg-sage"/>
            <div className="w-2 h-2 rounded-full bg-border"/>
            <div className="w-2 h-2 rounded-full bg-border"/>
          </div>
        </div>
        <button onClick={dismissIOS} className="w-6 h-6 rounded-full bg-surface2 flex items-center justify-center text-muted flex-shrink-0">✕</button>
      </div>
    </div>
  );

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-border p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sage flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
            <path d="M12 2L12 14M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 16v4h16v-4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text text-sm">Install OHC Command</div>
          <div className="text-xs text-muted">Works offline • Fast • No app store</div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShow(false)} className="px-2.5 py-1.5 rounded-lg text-xs text-muted hover:bg-surface2">Later</button>
          <button onClick={handleInstall} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sage text-white hover:bg-sage2">Install</button>
        </div>
      </div>
    </div>
  );
}

/* ── Offline Indicator ── */
export function OfflineIndicator() {
  const [online, setOnline]   = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const goOnline  = () => { setOnline(true);  if (wasOffline) { setShowBack(true); setTimeout(() => setShowBack(false), 3000); } };
    const goOffline = () => { setOnline(false); setWasOffline(true); };
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [wasOffline]);

  if (online && !showBack) return null;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
      online ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'
    }`}>
      {online ? (
        <><span className="w-2 h-2 rounded-full bg-white animate-pulse"/>Back online</>
      ) : (
        <><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>Offline — cached data shown</>
      )}
    </div>
  );
}

/* ── Update Available Toast ── */
export function PWAUpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Listen for service worker update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => setShow(true));
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-slate-800 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <span className="text-xl">🔄</span>
        <div className="flex-1">
          <div className="text-sm font-semibold">Update available</div>
          <div className="text-xs text-slate-300">New version of OHC Command is ready</div>
        </div>
        <button onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-sage rounded-lg text-xs font-semibold">Reload</button>
      </div>
    </div>
  );
}
