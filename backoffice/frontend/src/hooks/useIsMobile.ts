import { useSyncExternalStore } from 'react';

/**
 * Breakpoint unico de la experiencia movil: telefonos en vertical (hasta 768px de ancho) y
 * telefonos en horizontal (pantalla tactil de poca altura). En horizontal un telefono mide mas de
 * 768px de ancho y recibia el diseno de escritorio, que fija el home al alto de la pantalla y lo
 * cortaba. Un computador con mouse nunca cumple la segunda condicion, asi que escritorio y tablets
 * se renderizan exactamente como antes.
 * Debe coincidir con las media queries de src/styles/mobile.css.
 */
export const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse) and (max-height: 520px)';

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
