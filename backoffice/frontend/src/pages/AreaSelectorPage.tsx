import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import UiIcon from '@/components/shared/UiIcon';
import { Role } from '@/types/auth';

type AreaKey = 'administracion' | 'soporte' | 'confianza';

interface AreaCard {
  key: AreaKey;
  title: string;
  description: string;
  icon: 'wallet' | 'headset' | 'scale';
  path: string;
  accent: 'emerald' | 'sky' | 'violet';
}

const areas: AreaCard[] = [
  {
    key: 'administracion',
    title: 'Administración Contable',
    description: 'Gestión financiera, usuarios y configuración del sistema.',
    icon: 'wallet',
    path: '/administracion',
    accent: 'emerald',
  },
  {
    key: 'soporte',
    title: 'Soporte',
    description: 'Gestión de tickets, casos y atención a vendedores.',
    icon: 'headset',
    path: '/soporte',
    accent: 'sky',
  },
  {
    key: 'confianza',
    title: 'Confianza y Mediación',
    description: 'Revisión, mediación y resolución de casos y disputas.',
    icon: 'scale',
    path: '/confianza',
    accent: 'violet',
  },
];

function getRoleLabel(role?: Role | null): string {
  if (role === Role.SUPER_ADMIN) return 'Super administrador';
  if (role === Role.ADMIN) return 'Administrador';
  if (role === Role.OPERATOR) return 'Operador';
  return 'Backoffice';
}

function AccessIcon({ name }: { name: AreaCard['icon'] }) {
  if (name === 'wallet') {
    return (
      <svg className="area-selector-svg-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16.5 22.5h28.8c4.1 0 7.2 3.1 7.2 7.2v15.8c0 3.1-2.5 5.5-5.5 5.5H16.5c-3.1 0-5.5-2.5-5.5-5.5V28c0-3.1 2.5-5.5 5.5-5.5Z" />
        <path d="M16.5 22.5 39.4 14c2.8-1.1 5.8 1 5.8 4v4.5" />
        <path d="M42 33.3h10.5v11.4H42c-3.1 0-5.7-2.5-5.7-5.7s2.6-5.7 5.7-5.7Z" />
        <path d="M44.2 39h.1" />
      </svg>
    );
  }

  if (name === 'headset') {
    return (
      <svg className="area-selector-svg-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M13.5 38.5v-6.2c0-10.8 8-19.3 18.5-19.3s18.5 8.5 18.5 19.3v6.2" />
        <path d="M13.5 36.5h5.2c2.3 0 4.2 1.9 4.2 4.2v9.1h-5.2c-2.3 0-4.2-1.9-4.2-4.2v-9.1Z" />
        <path d="M50.5 36.5h-5.2c-2.3 0-4.2 1.9-4.2 4.2v9.1h5.2c2.3 0 4.2-1.9 4.2-4.2v-9.1Z" />
        <path d="M41.1 50c0 3.3-3.8 5.4-8.7 5.4" />
      </svg>
    );
  }

  return (
    <svg className="area-selector-svg-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 12v40" />
      <path d="M16 22h32" />
      <path d="M24 22 14 44" />
      <path d="M24 22l10 22" />
      <path d="M40 22 30 44" />
      <path d="M40 22l10 22" />
      <path d="M10.5 44h27c-2 4.9-6.7 8-13.5 8s-11.5-3.1-13.5-8Z" />
      <path d="M26.5 44h27c-2 4.9-6.7 8-13.5 8s-11.5-3.1-13.5-8Z" />
      <path d="M23 56h18" />
    </svg>
  );
}

function BrandIllustration() {
  return (
    <img className="area-selector-illustration" src="/assets/home-dashboard-illustration.png" alt="" aria-hidden="true" />
  );
}

export default function AreaSelectorPage() {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isAreaEnabled } = usePermissions();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <section className="area-selector-shell">
      <aside className="area-selector-brand">
        <div className="area-selector-brand-top">
          <div className="area-selector-brand-logo">
            <img className="area-selector-brand-logo-image" src="/assets/repuestop-logo.jpg" alt="RepuesTop" />
          </div>

          <h1 className="area-selector-brand-title">
            Bienvenido a<br />
            RepuesTop <span>BackOffice</span>
          </h1>
          <p className="area-selector-brand-text">
            Desde aquí puedes acceder a todas las herramientas para gestionar tu operación de forma segura, eficiente y centralizada.
          </p>
          <span className="area-selector-brand-divider" />

          <BrandIllustration />
        </div>

        <div className="area-selector-brand-footer">
          <span className="area-selector-brand-shield">
            <UiIcon name="shieldCheck" />
          </span>
          <div>
            <strong>Plataforma segura</strong>
            <p>Tus datos y operaciones están protegidos con los más altos estándares de seguridad.</p>
          </div>
        </div>
      </aside>

      <div className="area-selector-main">
        <header className="area-selector-topbar">
          <div />
          <div className="area-selector-topbar-actions">
            <div className="profile-menu-wrapper" ref={profileMenuRef}>
              <button
                className={`profile-pill ${profileMenuOpen ? 'open' : ''}`}
                type="button"
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                onClick={() => setProfileMenuOpen((current) => !current)}
              >
                <span className="profile-badge">{user?.initials ?? 'AR'}</span>
                <span>Perfil: {getRoleLabel(user?.role)}</span>
                <UiIcon name="chevronDown" />
              </button>

              {profileMenuOpen && (
                <div className="user-dropdown-menu area-selector-profile-menu" role="menu">
                  <button className="user-dropdown-item user-dropdown-item--danger" type="button" role="menuitem" onClick={handleLogout}>
                    <UiIcon name="logout" style={{ width: 16, height: 16 }} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="area-selector-content">
          <div className="area-selector-copy">
            <h2>
              <UiIcon name="dashboard" />
              Accesos principales
            </h2>
            <p>Ingresa a los sistemas más utilizados.</p>
          </div>

          <div className="area-selector-grid">
            {areas.map((area) => {
              const enabled = isAreaEnabled(area.key, user);
              return (
                <article className={`area-selector-card ${area.accent} ${enabled ? 'enabled' : 'disabled'}`} key={area.key}>
                  <span className="area-selector-card-grip">
                    <UiIcon name="grip" />
                  </span>

                  <span className={`area-selector-icon ${enabled ? area.accent : 'locked'}`}>
                    {enabled ? <AccessIcon name={area.icon} /> : <UiIcon name="lock" />}
                  </span>
                  <span className={`area-selector-icon-underline ${enabled ? area.accent : 'locked'}`} />

                  <h3>{area.title}</h3>
                  <p>{area.description}</p>

                  <button
                    className={enabled ? 'primary-button area-selector-action' : 'secondary-button area-selector-action disabled-button'}
                    type="button"
                    disabled={!enabled}
                    onClick={() => navigate(area.path)}
                  >
                    {enabled ? 'Ingresar al sistema' : 'Sin acceso'}
                    {enabled ? <UiIcon name="arrowRight" /> : <UiIcon name="lock" />}
                  </button>
                </article>
              );
            })}
          </div>

          {isSuperAdmin && (
            <article className="area-selector-banner">
              <span className="area-selector-banner-icon">
                <UiIcon name="shieldCheck" />
              </span>
              <div className="area-selector-banner-copy">
                <h3>Gestión de Permisos</h3>
                <p>Administra accesos por correo, área y ranura operativa.</p>
              </div>
              <button className="secondary-button area-selector-banner-action" type="button" onClick={() => navigate('/configuracion')}>
                Ir a Gestión de Permisos
                <UiIcon name="arrowRight" />
              </button>
            </article>
          )}

          <footer className="area-selector-footer">© 2025 RepuesTop. Todos los derechos reservados.</footer>
        </div>
      </div>
    </section>
  );
}
