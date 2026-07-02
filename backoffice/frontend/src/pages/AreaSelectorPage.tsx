import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import UiIcon from '@/components/shared/UiIcon';
import { Role } from '@/types/auth';

type AreaKey = 'administracion' | 'soporte' | 'confianza' | 'permisos';

interface AreaCard {
  key: AreaKey;
  title: string;
  description: string;
  icon: string;
  path: string;
  accent: string;
}

const areas: AreaCard[] = [
  {
    key: 'administracion',
    title: 'Administracion Contable',
    description: 'Gestion financiera, usuarios y configuracion del sistema.',
    icon: 'wallet',
    path: '/administracion',
    accent: 'emerald',
  },
  {
    key: 'soporte',
    title: 'Soporte',
    description: 'Gestion de tickets, casos y atencion a vendedores.',
    icon: 'headset',
    path: '/soporte',
    accent: 'sky',
  },
  {
    key: 'confianza',
    title: 'Confianza y Mediacion',
    description: 'Revision, mediacion y resolucion de casos y disputas.',
    icon: 'scale',
    path: '/confianza',
    accent: 'violet',
  },
  {
    key: 'permisos',
    title: 'Gestión de Permisos',
    description: 'Administra accesos por correo, área y ranura operativa.',
    icon: 'shield',
    path: '/configuracion',
    accent: 'amber',
  },
];

function getRoleLabel(role?: Role | null): string {
  if (role === Role.SUPER_ADMIN) return 'Super administrador';
  if (role === Role.ADMIN) return 'Administrador';
  if (role === Role.OPERATOR) return 'Operador';
  return 'Backoffice';
}

export default function AreaSelectorPage() {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isAreaEnabled } = usePermissions();
  const profileMenuRef = useRef<HTMLDivElement>(null);

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
  };

  return (
    <section className="area-selector-shell">
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
              <span className="profile-badge">{user?.initials ?? 'SP'}</span>
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
          <h1>Bienvenido a RepuesTop BackOffice</h1>
          <p>Selecciona un área para continuar. Las áreas sin permiso aparecen bloqueadas.</p>
        </div>

        <div className={`area-selector-grid ${user?.role === Role.SUPER_ADMIN ? 'super-admin-grid' : ''}`}>
          {areas
            .filter((area) => user?.role === Role.SUPER_ADMIN || area.key !== 'permisos')
            .map((area) => {
            const enabled = isAreaEnabled(area.key, user);
            return (
              <article className={`area-selector-card ${enabled ? 'enabled' : 'disabled'}`} key={area.key}>
                <div className="area-selector-icon-wrap">
                  <span className={`area-selector-icon ${enabled ? area.accent : 'locked'}`}>
                    <UiIcon name={enabled ? area.icon : 'lock'} />
                  </span>
                </div>

                <h2>{area.title}</h2>
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

        <footer className="area-selector-footer">© 2025 RepuesTop. Todos los derechos reservados.</footer>
      </div>
    </section>
  );
}
