import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function wasDismissed() {
  try { return localStorage.getItem('bt_install_dismissed') === '1'; } catch { return false; }
}
function rememberDismissed() {
  try { localStorage.setItem('bt_install_dismissed', '1'); } catch { /* ignore */ }
}

export default function InstallPrompt() {
  const location = useLocation();
  const [deferred, setDeferred] = useState(null);
  const [hidden, setHidden] = useState(wasDismissed());

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Not shown when already installed, dismissed, or while chatting
  if (hidden || isStandalone() || location.pathname.startsWith('/messages/')) return null;
  if (!deferred && !isIos()) return null;

  async function install() {
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }
  function dismiss() {
    rememberDismissed();
    setHidden(true);
  }

  return (
    <div className="install-bar" role="dialog" aria-label="Install BarterTrade">
      <img src="/icon-192.png" alt="" width="40" height="40" />
      <div className="grow">
        <strong>Get the BarterTrade app</strong>
        <div className="meta">
          {deferred ? 'Open it from your home screen, like any app.' : 'Tap Share, then "Add to Home Screen".'}
        </div>
      </div>
      {deferred && <button type="button" onClick={install}>Install</button>}
      <button type="button" className="install-close" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}