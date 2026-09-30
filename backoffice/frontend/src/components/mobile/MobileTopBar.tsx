import type { ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';

interface MobileTopBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** 'back' muestra una flecha (usa onBack); 'area' muestra el icono del area; o un nodo propio. */
  leading?: 'back' | 'area' | ReactNode;
  areaIcon?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  className?: string;
}

/** Barra superior fija de la experiencia movil (56px + safe-area). */
export default function MobileTopBar({ title, subtitle, leading = 'area', areaIcon = 'dashboard', onBack, trailing, className = '' }: MobileTopBarProps) {
  let leadingNode: ReactNode = leading;
  if (leading === 'back') {
    leadingNode = (
      <button type="button" className="mb-topbar-btn" onClick={onBack} aria-label="Volver">
        <UiIcon name="arrowLeft" />
      </button>
    );
  } else if (leading === 'area') {
    leadingNode = (
      <span className="mb-topbar-area" aria-hidden="true">
        <UiIcon name={areaIcon} />
      </span>
    );
  }

  return (
    <header className={`mb-topbar ${className}`.trim()}>
      {leadingNode}
      <div className="mb-topbar-titles">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {trailing && <div className="mb-topbar-trailing">{trailing}</div>}
    </header>
  );
}
