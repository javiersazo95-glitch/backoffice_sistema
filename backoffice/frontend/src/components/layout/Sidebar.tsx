import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserSummaryResponse } from '@/types/auth';
import { FLAG_NAV_MANTENEDOR } from '@/types/remoteConfig';
import UiIcon from '@/components/shared/UiIcon';
import { MANTENEDOR_URL } from '@/components/shared/mantenedorUrl';
import { useFlag } from '@/hooks/useRemoteConfig';
import { getMantenedorNavItem, getVisibleSections } from './navConfig';


interface SidebarProps {
  user: UserSummaryResponse | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ user, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  const visibleSections = useMemo(
    () => getVisibleSections(user, location.pathname),
    [location.pathname, user],
  );

  // Enlace al Mantenedor común: solo SUPER_ADMIN y solo si el flag `backoffice.nav.mantenedor`
  // sigue encendido (sin bootstrap se asume encendido, como hoy).
  const mantenedorHabilitado = useFlag(FLAG_NAV_MANTENEDOR, true);
  const mantenedorItem = getMantenedorNavItem(user, MANTENEDOR_URL, mantenedorHabilitado);

  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-header">
        <Link to="/" className="brand" onClick={onMobileClose}>
          <img src="/assets/repuestop-logo-cropped.jpg" alt="RepuesTop" />
        </Link>
        <button
          className="mobile-sidebar-close"
          type="button"
          aria-label="Cerrar menú"
          onClick={onMobileClose}
        >
          ×
        </button>
      </div>

      <nav className="main-nav" onClick={onMobileClose}>
        {isHome ? (
          <Link to="/" className="nav-link active">
            <span className="nav-icon"><UiIcon name="dashboard" /></span>
            Inicio
          </Link>
        ) : (
          visibleSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <span className="nav-section-title">{section.title}</span>
              {section.items.map((item) => {
                const queryIdx = item.path.indexOf('?');
                const basePath = queryIdx >= 0 ? item.path.slice(0, queryIdx) : item.path;
                const searchQuery = queryIdx >= 0 ? '?' + item.path.slice(queryIdx + 1) : '';
                const isActive = item.exact
                  ? location.pathname === basePath && (!searchQuery || location.search === searchQuery)
                  : location.pathname.startsWith(basePath) && (!searchQuery || location.search === searchQuery);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-link${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon"><UiIcon name={item.icon} /></span>
                    {item.label}
                    {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))
        )}

        {mantenedorItem && (
          <div className="nav-section" key={mantenedorItem.path}>
            <span className="nav-section-title">Configuración</span>
            {/* App aparte: se abre en otra pestaña para no perder lo que se estaba haciendo aquí. */}
            <a className="nav-link" href={mantenedorItem.href} target="_blank" rel="noopener noreferrer">
              <span className="nav-icon"><UiIcon name={mantenedorItem.icon} /></span>
              {mantenedorItem.label}
            </a>
          </div>
        )}
      </nav>

    </aside>
  );
}
