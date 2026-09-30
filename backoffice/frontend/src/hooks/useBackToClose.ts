import { useEffect, useRef } from 'react';
import { useIsMobile } from './useIsMobile';

/**
 * Hace que el boton "atras" del telefono (o el gesto de retroceso) cierre el sheet abierto en
 * lugar de abandonar la pagina. Al abrir se empuja una entrada de historial marcada con el id
 * del sheet; un popstate que la retira dispara onClose. Si el sheet se cierra por codigo y la
 * entrada sigue arriba de la pila, se retira con history.back() para no dejar entradas fantasma.
 *
 * El retroceso del cierre se difiere un tick y se cancela si el efecto vuelve a montarse: en
 * modo estricto React monta, desmonta y vuelve a montar, y un back() inmediato llegaba despues
 * del segundo pushState y cerraba el sheet recien abierto.
 */
export function useBackToClose(open: boolean, onClose: () => void, id: string) {
  const isMobile = useIsMobile();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const generationRef = useRef(0);

  useEffect(() => {
    if (!isMobile || !open || typeof window === 'undefined') return;
    const generation = ++generationRef.current;

    if (window.history.state?.mbSheet !== id) {
      const previous = (window.history.state && typeof window.history.state === 'object') ? window.history.state : {};
      window.history.pushState({ ...previous, mbSheet: id }, '');
    }

    const handlePop = () => {
      // Seguimos parados en nuestra entrada (p. ej. se cerro un sheet anidado encima): nada que hacer.
      if (window.history.state?.mbSheet === id) return;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePop);

    return () => {
      window.removeEventListener('popstate', handlePop);
      window.setTimeout(() => {
        if (generationRef.current !== generation) return;
        if (window.history.state?.mbSheet === id) window.history.back();
      }, 0);
    };
  }, [open, id, isMobile]);
}
