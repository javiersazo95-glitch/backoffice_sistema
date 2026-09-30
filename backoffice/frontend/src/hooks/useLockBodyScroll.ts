import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;

/**
 * Bloquea el scroll del documento mientras un sheet o modal movil esta abierto.
 * Usa position:fixed sobre body (unico metodo fiable en iOS Safari) y un contador para que
 * varios sheets anidados no se pisen al restaurar.
 */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const body = document.body;
    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.classList.add('mb-scroll-locked');
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount > 0) return;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      body.classList.remove('mb-scroll-locked');
      window.scrollTo(0, savedScrollY);
    };
  }, [active]);
}
