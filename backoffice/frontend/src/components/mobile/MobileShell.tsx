import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types/auth';
import NotificationBell from '@/components/layout/NotificationBell';
import HelpSupportWidget from '@/components/shared/HelpSupportWidget';
import { getMobileNav, isNavItemActive } from '@/components/layout/navConfig';
import MobileTopBar from './MobileTopBar';
import TabBar, { type TabItem } from './TabBar';
import MoreSheet, { type MoreAction } from './MoreSheet';

interface MobileShellContextValue {
  openMore: () => void;
  openHelp: () => void;
}

const MobileShellContext = createContext<MobileShellContextValue | null>(null);

export function useMobileShell() {
  return useContext(MobileShellContext);
}

/** Ruta "profunda": muestra flecha de volver en lugar del icono del area. */
function getBackTarget(pathname: string): string | null {
  const mediation = pathname.match(/^\/confianza\/mediations\/[^/]+$/);
  if (mediation) return '/confianza/mediations';
  if (pathname === '/retiros') return '/administracion/resumen';
  return null;
}

/**
 * Shell movil del backoffice: barra superior fija, contenido, barra inferior con las secciones
 * del area y hoja "Mas". Reemplaza al sidebar + topbar de escritorio por debajo de 768px.
 */
export default function MobileShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const nav = useMemo(() => getMobileNav(user, location.pathname), [user, location.pathname]);

  // Al navegar se cierra cualquier hoja abierta y se vuelve arriba (nueva pantalla).
  useEffect(() => {
    setMoreOpen(false);
    setHelpOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const backTarget = getBackTarget(location.pathname);
  const activeItem = nav
    ? [...nav.primary, ...nav.more].find((item) => isNavItemActive(item, location.pathname, location.search))
    : undefined;
  const title = activeItem?.label ?? nav?.areaTitle ?? 'RepuesTop';
  const subtitle = nav && activeItem && activeItem.label !== nav.areaTitle ? nav.areaTitle : undefined;
  const activeInMore = Boolean(nav?.more.some((item) => isNavItemActive(item, location.pathname, location.search)));

  const tabItems: TabItem[] = (nav?.primary ?? []).map((item) => ({
    key: item.path,
    label: item.shortLabel ?? item.label,
    icon: item.icon,
    to: item.path,
    exact: item.exact,
    aliases: item.aliases,
    badge: item.badge,
  }));

  const accountActions: MoreAction[] = [
    { key: 'home', label: 'Cambiar de área', icon: 'home', hint: 'Volver al selector de sistemas', onPress: () => { setMoreOpen(false); navigate('/'); } },
    { key: 'help', label: 'Ayuda e incidencias', icon: 'help', hint: 'Preguntas frecuentes y reporte de fallas', onPress: () => { setMoreOpen(false); setHelpOpen(true); } },
  ];
  if (user?.role === Role.SUPER_ADMIN) {
    if (nav?.area !== 'administracion') {
      accountActions.push({ key: 'withdrawals', label: 'Retirar dinero', icon: 'wallet', onPress: () => { setMoreOpen(false); navigate('/retiros'); } });
    }
    accountActions.push({ key: 'permissions', label: 'Gestión de permisos', icon: 'shieldCheck', onPress: () => { setMoreOpen(false); navigate('/configuracion'); } });
  }

  const handleLogout = async () => {
    setMoreOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const contextValue = useMemo<MobileShellContextValue>(() => ({
    openMore: () => setMoreOpen(true),
    openHelp: () => setHelpOpen(true),
  }), []);

  return (
    <MobileShellContext.Provider value={contextValue}>
      <div className={`mb-shell${nav ? ' mb-shell--tabs' : ''}`}>
        <MobileTopBar
          title={title}
          subtitle={subtitle}
          leading={backTarget ? 'back' : 'area'}
          areaIcon={nav?.areaIcon}
          onBack={() => navigate(backTarget ?? '/')}
          trailing={(
            <>
              <NotificationBell user={user} />
              <button type="button" className="mb-avatar-btn" onClick={() => setMoreOpen(true)} aria-label="Cuenta y más opciones" aria-haspopup="dialog">
                {user?.initials ?? '?'}
              </button>
            </>
          )}
        />

        <main className="content mb-content">{children}</main>

        {nav && (
          <TabBar items={tabItems} onMore={() => setMoreOpen(true)} moreActive={moreOpen || activeInMore} />
        )}

        <MoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          user={user}
          items={nav?.more ?? []}
          accountActions={accountActions}
          onLogout={handleLogout}
        />

        <HelpSupportWidget isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </MobileShellContext.Provider>
  );
}
