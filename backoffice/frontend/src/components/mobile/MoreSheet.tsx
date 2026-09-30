import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';
import type { UserSummaryResponse } from '@/types/auth';
import { Role } from '@/types/auth';
import { isNavItemActive, type NavItem } from '@/components/layout/navConfig';
import BottomSheet from './BottomSheet';

export interface MoreAction {
  key: string;
  label: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
  hint?: string;
}

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  user: UserSummaryResponse | null;
  /** Secciones del area que no caben en la barra inferior. */
  items?: NavItem[];
  /** Acciones adicionales de cuenta (ayuda, cambio de area, etc.). */
  accountActions?: MoreAction[];
  onLogout: () => Promise<void> | void;
  /** Titulo de la primera seccion (por defecto "Secciones"). */
  sectionsTitle?: string;
  /** Contenido extra bajo la cabecera del usuario. */
  header?: ReactNode;
}

export function getRoleLabel(role?: Role | null): string {
  if (role === Role.SUPER_ADMIN) return 'Super administrador';
  if (role === Role.ADMIN) return 'Administrador';
  if (role === Role.CAPTADOR) return 'Captador';
  if (role === Role.OPERATOR) return 'Operador';
  return 'Backoffice';
}

/** Hoja "Mas": resto de secciones, accesos de cuenta y cierre de sesion. */
export default function MoreSheet({ open, onClose, user, items = [], accountActions = [], onLogout, sectionsTitle = 'Secciones', header }: MoreSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleClose = () => {
    setConfirmLogout(false);
    onClose();
  };

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title="Más opciones" height="auto" flush id="mb-more">
      <div className="mb-more">
        <div className="mb-more-user">
          <span className="mb-more-avatar">{user?.initials ?? '?'}</span>
          <div className="mb-more-user-text">
            <strong>{user?.fullName ?? 'Usuario'}</strong>
            <span>{getRoleLabel(user?.role)}</span>
          </div>
        </div>
        {header}

        {items.length > 0 && (
          <section className="mb-more-section">
            <h3 className="mb-more-section-title">{sectionsTitle}</h3>
            {items.map((item) => {
              const active = isNavItemActive(item, location.pathname, location.search);
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`mb-more-item${active ? ' active' : ''}`}
                  onClick={() => go(item.path)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="mb-more-item-icon"><UiIcon name={item.icon} /></span>
                  <span className="mb-more-item-label">{item.label}</span>
                  {item.badge > 0 && <span className="mb-more-item-badge">{item.badge}</span>}
                  <UiIcon name="arrowRight" className="mb-more-item-chevron" />
                </button>
              );
            })}
          </section>
        )}

        {accountActions.length > 0 && (
          <section className="mb-more-section">
            <h3 className="mb-more-section-title">Cuenta</h3>
            {accountActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={`mb-more-item${action.danger ? ' mb-more-item--danger' : ''}`}
                onClick={action.onPress}
              >
                <span className="mb-more-item-icon"><UiIcon name={action.icon} /></span>
                <span className="mb-more-item-label">
                  {action.label}
                  {action.hint && <small>{action.hint}</small>}
                </span>
                <UiIcon name="arrowRight" className="mb-more-item-chevron" />
              </button>
            ))}
          </section>
        )}

        <section className="mb-more-section mb-more-section--session">
          {confirmLogout ? (
            <div className="mb-more-confirm" role="alertdialog" aria-label="Confirmar cierre de sesión">
              <p>¿Cerrar la sesión en este dispositivo?</p>
              <div className="mb-more-confirm-actions">
                <button type="button" className="mb-action" onClick={() => setConfirmLogout(false)} disabled={loggingOut}>Cancelar</button>
                <button type="button" className="mb-action mb-action--danger" onClick={handleLogout} disabled={loggingOut}>
                  {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="mb-more-item mb-more-item--danger" onClick={() => setConfirmLogout(true)}>
              <span className="mb-more-item-icon"><UiIcon name="logout" /></span>
              <span className="mb-more-item-label">Cerrar sesión</span>
            </button>
          )}
        </section>
      </div>
    </BottomSheet>
  );
}
