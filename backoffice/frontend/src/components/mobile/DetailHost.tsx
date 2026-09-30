import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import DetailSheet from './DetailSheet';

interface DetailHostProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  embedded?: boolean;
  flush?: boolean;
}

/**
 * Anfitrion de un panel de detalle maestro/detalle: en escritorio devuelve los children tal
 * cual (sin DOM adicional); en telefonos los muestra dentro de un DetailSheet a pantalla
 * completa con boton "Volver".
 */
export default function DetailHost({ open, onClose, title, subtitle, actions, children, id, embedded = true, flush = true }: DetailHostProps) {
  const isMobile = useIsMobile();
  if (!isMobile) return <>{children}</>;
  return (
    <DetailSheet open={open} onClose={onClose} title={title} subtitle={subtitle} actions={actions} id={id} embedded={embedded} flush={flush}>
      {children}
    </DetailSheet>
  );
}
