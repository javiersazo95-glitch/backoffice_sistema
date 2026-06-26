import { useEffect, useState } from 'react';

const STORAGE_KEY = 'repuestop.manual-mediation-admin-mode';
const SYNC_EVENT = 'repuestop:manual-mediation-admin-mode-changed';

function readAdminMode(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAdminMode(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function useManualMediationAdminMode() {
  const [enabled, setEnabled] = useState<boolean>(() => readAdminMode());

  useEffect(() => {
    const sync = () => setEnabled(readAdminMode());
    window.addEventListener('storage', sync);
    window.addEventListener(SYNC_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SYNC_EVENT, sync);
    };
  }, []);

  const setAdminMode = (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    writeAdminMode(nextEnabled);
  };

  return [enabled, setAdminMode] as const;
}
