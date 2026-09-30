import { useSyncExternalStore } from 'react';

/**
 * Breakpoint unico de la experiencia movil. Todo lo que este por debajo (telefonos en vertical
 * y horizontal) recibe el shell movil, las listas de tarjetas y los bottom sheets; por encima
 * (tablets y escritorio) la aplicacion se renderiza exactamente como antes.
 * Debe coincidir con la media query de src/styles/mobile.css.
 */
export const MOBILE_QUERY = '(max-width: 768px)';

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

function subscribe(onChange: () => void) {
  if (!canMatch()) return () => {};
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  return canMatch() ? window.matchMedia(MOBILE_QUERY).matches : false;
}

const getServerSnapshot = () => false;

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
