import { useNavigate } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionItem {
  id: 'administracion' | 'soporte' | 'confianza';
  area: string;
  description: string;
}

const permissionItems: PermissionItem[] = [
  {
    id: 'administracion',
    area: 'Administración Contable',
    description: 'Gestión financiera, usuarios y configuración del sistema',
  },
  {
    id: 'soporte',
    area: 'Soporte',
    description: 'Gestión de tickets, casos y atención a vendedores',
  },
  {
    id: 'confianza',
    area: 'Confianza y Mediación',
    description: 'Revisión, mediación y resolución de casos y disputas',
  },
];

export default function PermissionsConfigPage() {
  const navigate = useNavigate();
  const { permissions, toggleRole, save, reset } = usePermissions();

  const handleSave = () => {
    save();
    navigate('/');
  };

  const handleCancel = () => {
    reset();
    navigate('/');
  };

  return (
    <section className="permissions-config-shell">
      <header className="permissions-config-topbar">
        <button
          className="ghost-button"
          onClick={handleCancel}
        >
          <UiIcon name="arrowRight" className="rotate-180" />
          Volver
        </button>
        <h1>Configuración de Permisos</h1>
        <div />
      </header>

      <div className="permissions-config-content">
        <div className="permissions-config-header">
          <h2>Permisos por Área</h2>
          <p>Configura qué roles tienen acceso a cada área del sistema</p>
        </div>

        <div className="permissions-config-grid">
          {permissionItems.map((item) => (
            <article key={item.id} className="permissions-config-card">
              <div className="permissions-config-card-header">
                <h3>{item.area}</h3>
                <p>{item.description}</p>
              </div>

              <div className="permissions-config-card-roles">
                <div className="role-toggle">
                  <label className="role-toggle-label">
                    <input
                      type="checkbox"
                      checked={permissions[item.id].includes('ADMIN')}
                      onChange={() => toggleRole(item.id, 'ADMIN')}
                    />
                    <span className="role-toggle-switch" />
                    <span className="role-toggle-text">
                      <UiIcon name="lock" />
                      Administrador
                    </span>
                  </label>
                </div>

                <div className="role-toggle">
                  <label className="role-toggle-label">
                    <input
                      type="checkbox"
                      checked={permissions[item.id].includes('OPERATOR')}
                      onChange={() => toggleRole(item.id, 'OPERATOR')}
                    />
                    <span className="role-toggle-switch" />
                    <span className="role-toggle-text">
                      <UiIcon name="headset" />
                      Operador
                    </span>
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="permissions-config-actions">
          <button className="secondary-button" onClick={handleCancel}>
            Cancelar
          </button>
          <button className="primary-button" onClick={handleSave}>
            Guardar Cambios
          </button>
        </div>
      </div>
    </section>
  );
}
