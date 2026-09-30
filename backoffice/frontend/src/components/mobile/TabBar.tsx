import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';
import { isNavItemActive } from '@/components/layout/navConfig';

export interface TabItem {
  key: string;
  label: string;
  /** Nombre de UiIcon o un nodo propio. */
  icon: string | ReactNode;
  to?: string;
  exact?: boolean;
  aliases?: string[];
  badge?: number;
  onPress?: () => void;
  /** Fuerza el estado activo (para items sin ruta). */
  active?: boolean;
}

interface TabBarProps {
  items: TabItem[];
  onMore?: () => void;
  moreActive?: boolean;
  moreLabel?: string;
  ariaLabel?: string;
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <rect x="3" y="4" width="18" height="16" rx="4" />
    </svg>
  );
}

/** Barra de navegacion inferior fija (hasta 4 destinos + "Mas"). */
export default function TabBar({ items, onMore, moreActive = false, moreLabel = 'Más', ariaLabel = 'Secciones' }: TabBarProps) {
  const location = useLocation();

  const renderIcon = (icon: string | ReactNode) => (typeof icon === 'string' ? <UiIcon name={icon} /> : icon);

  return (
    <nav className="mb-tabbar" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.active ?? (item.to ? isNavItemActive({ path: item.to, exact: item.exact, aliases: item.aliases }, location.pathname, location.search) : false);
        const className = `mb-tab${active ? ' active' : ''}`;
        const content = (
          <>
            <span className="mb-tab-icon">
              {renderIcon(item.icon)}
              {item.badge ? <span className="mb-tab-badge">{item.badge > 99 ? '99+' : item.badge}</span> : null}
            </span>
            <span className="mb-tab-label">{item.label}</span>
          </>
        );
        if (item.to) {
          return (
            <Link key={item.key} to={item.to} className={className} aria-current={active ? 'page' : undefined} onClick={item.onPress}>
              {content}
            </Link>
          );
        }
        return (
          <button key={item.key} type="button" className={className} onClick={item.onPress} aria-pressed={active || undefined}>
            {content}
          </button>
        );
      })}
      {onMore && (
        <button type="button" className={`mb-tab${moreActive ? ' active' : ''}`} onClick={onMore} aria-haspopup="dialog" aria-expanded={moreActive}>
          <span className="mb-tab-icon"><MoreIcon /></span>
          <span className="mb-tab-label">{moreLabel}</span>
        </button>
      )}
    </nav>
  );
}
