import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserSummaryResponse } from '@/types/auth';
import UiIcon from '@/components/shared/UiIcon';
import { getVisibleSections } from './navConfig';


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
      </nav>

    </aside>
  );
}
