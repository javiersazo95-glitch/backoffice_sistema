import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserSummaryResponse } from '@/types/auth';
import UiIcon from '@/components/shared/UiIcon';
import { Role } from '@/types/auth';
import { hasBackofficePermission } from '@/hooks/usePermissions';


interface SidebarProps {
  user: UserSummaryResponse | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navSections = [
  {
    title: 'Backoffice',
    items: [
      { path: '/', label: 'Inicio', badge: 0, icon: 'dashboard', exact: true },
      { path: '/administracion', label: 'Administración Contable', badge: 0, icon: 'wallet' },
      { path: '/soporte', label: 'Soporte', badge: 0, icon: 'message' },
    ],
  },
  {
    title: 'Soporte Técnico',
    items: [
      { path: '/soporte', label: 'Resumen', badge: 0, icon: 'dashboard', exact: true },
      { path: '/soporte/tickets', label: 'Tickets', badge: 0, icon: 'message' },
      { path: '/soporte/qa-reports', label: 'Reportes QA', badge: 0, icon: 'alert' },
    ],
  },
  {
    title: 'Administración Contable',
    items: [
      { path: '/administracion/resumen', label: 'Resumen', badge: 0, icon: 'dashboard', exact: true },
      { path: '/administracion/pedidos', label: 'Pedidos', badge: 0, icon: 'wallet' },
      { path: '/administracion/liquidaciones', label: 'Liquidaciones', badge: 0, icon: 'clipboard' },
      { path: '/administracion/gastos', label: 'Caja y gastos', badge: 0, icon: 'receipt' },
      { path: '/administracion/pago-proveedores', label: 'Pago a proveedores', badge: 0, icon: 'wallet' },
      { path: '/administracion/pago-captadores', label: 'Pago a captadores', badge: 0, icon: 'users' },
      { path: '/administracion/boletas', label: 'Boletas de venta', badge: 0, icon: 'fileCheck' },
    ],
  },
  {
    title: 'Gestión de Confianza',
    items: [
      { path: '/confianza', label: 'Resumen', badge: 0, icon: 'shield', exact: true },
      { path: '/confianza/validations', label: 'Validaciones', badge: 0, icon: 'fileCheck' },
      { path: '/confianza/mediations', label: 'Mediaciones', badge: 0, icon: 'scale' },
      { path: '/confianza/sellers', label: 'Vendedores', badge: 0, icon: 'store' },
      { path: '/confianza/captadores', label: 'Captadores', badge: 0, icon: 'users' },
      { path: '/confianza/reports', label: 'Reportes', badge: 0, icon: 'flag' },
    ],
  },
];

export default function Sidebar({ user, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isConfianza = location.pathname.startsWith('/confianza');
  const isAdmin = location.pathname.startsWith('/administracion');
  const isSupport = location.pathname.startsWith('/soporte');

  const visibleSections = useMemo(() => {
    const isAdminOrSuper = user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
    const canAdmin = isAdminOrSuper || hasBackofficePermission(user, 'ADMINISTRACION_CONTABLE');
    const canConfianza = isAdminOrSuper || hasBackofficePermission(user, 'MEDIACION_CONFIANZA');
    const canSoporte = isAdminOrSuper || hasBackofficePermission(user, 'SOPORTE');

    let sections = navSections;

    if (!canAdmin) {
      sections = sections.filter((s) => s.title !== 'Administración Contable');
    }
    if (!canConfianza) {
      sections = sections.filter((s) => s.title !== 'Gestión de Confianza');
    }

    if (isConfianza) {
      return sections.filter((s) => s.title === 'Gestión de Confianza');
    } else if (isAdmin) {
      return sections.filter((s) => s.title === 'Administración Contable');
    } else if (isSupport) {
      return sections.filter((s) => s.title === 'Soporte Técnico');
    } else {
      if (!isAdminOrSuper) {
        return sections.map((s) => {
          if (s.title === 'Backoffice') {
            return {
              ...s,
              items: s.items.filter((item) => {
                if (item.path === '/') return true;
                if (item.path.startsWith('/soporte')) return canSoporte;
                if (item.path.startsWith('/administracion')) return canAdmin;
                if (item.path.startsWith('/confianza')) return canConfianza;
                return false;
              }),
            };
          }
          return s;
        });
      }
      return sections.filter((s) => s.title !== 'Soporte Técnico');
    }
  }, [isConfianza, isAdmin, isSupport, user]);

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
