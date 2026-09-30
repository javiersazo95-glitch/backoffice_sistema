import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';

interface StickyActionBarProps {
  children: ReactNode;
  /** Dentro de un sheet se ancla al pie del sheet en lugar de sobre la barra inferior. */
  inSheet?: boolean;
  hideWhenKeyboard?: boolean;
  className?: string;
}

/** Barra de acciones primarias fija al alcance del pulgar (sobre la barra inferior). */
export default function StickyActionBar({ children, inSheet = false, hideWhenKeyboard = true, className = '' }: StickyActionBarProps) {
  const keyboardOpen = useKeyboardOpen();
  const hidden = hideWhenKeyboard && keyboardOpen;

  useEffect(() => {
    if (inSheet) return;
    document.body.classList.add('mb-has-actionbar');
    return () => document.body.classList.remove('mb-has-actionbar');
  }, [inSheet]);

  return (
    <div className={`mb-actionbar${inSheet ? ' mb-actionbar--in-sheet' : ''}${hidden ? ' mb-actionbar--hidden' : ''} ${className}`.trim()}>
      {children}
    </div>
  );
}
