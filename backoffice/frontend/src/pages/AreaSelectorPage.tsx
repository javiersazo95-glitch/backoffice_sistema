import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import UiIcon from '@/components/shared/UiIcon';

type AreaKey = 'administracion' | 'soporte' | 'confianza';

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
];

function getProfileLabel(role?: string | null): string {
  if (role === 'ADMIN') return 'Administración Contable';
  if (role === 'OPERATOR') return 'Soporte';
  return 'Backoffice';
}

export default function AreaSelectorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAreaEnabled } = usePermissions();

  return (
    <section className="area-selector-shell">
      <header className="area-selector-topbar">
        <div />
        <div className="area-selector-topbar-actions">
          <button
            className="config-icon-button"
            onClick={() => navigate('/configuracion')}
            title="Configuración de permisos"
          >
            <UiIcon name="settings" />
          </button>
          <div className="profile-pill">
            <div className="profile-badge">{user?.initials ?? 'SP'}</div>
            <span>Perfil: {getProfileLabel(user?.role)}</span>
            <UiIcon name="chevronDown" />
          </div>
        </div>
      </header>

      <div className="area-selector-content">
        <div className="area-selector-copy">
          <h1>Bienvenido a RepuesTop BackOffice</h1>
          <p>Selecciona un área para continuar. Las áreas sin permiso aparecen bloqueadas.</p>
        </div>

        <div className="area-selector-grid">
          {areas.map((area) => {
            const enabled = isAreaEnabled(area.key, user?.role);
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
