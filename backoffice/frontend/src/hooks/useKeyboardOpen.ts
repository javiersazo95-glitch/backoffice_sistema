import { useSyncExternalStore } from 'react';

const hasViewport = () => typeof window !== 'undefined' && !!window.visualViewport;

function subscribe(onChange: () => void) {
  if (!hasViewport()) return () => {};
  const vv = window.visualViewport!;
  vv.addEventListener('resize', onChange);
  return () => vv.removeEventListener('resize', onChange);
}

function getSnapshot() {
  if (!hasViewport()) return false;
  return window.visualViewport!.height < window.innerHeight * 0.75;
}

/** true mientras el teclado virtual ocupa una parte relevante de la pantalla. */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
