import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import UiIcon from './UiIcon';
import HelpSupportWidget from './HelpSupportWidget';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types/auth';

interface AreaHomeShortcutProps {
  className?: string;
}

export default function AreaHomeShortcut({ className = '' }: AreaHomeShortcutProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { user, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    setConfirmLogout(false);
    await logout();
  };

  const openHelp = () => {
    setUserMenuOpen(false);
    setHelpOpen(true);
  };

  const openLogoutConfirm = () => {
    setUserMenuOpen(false);
    setConfirmLogout(true);
  };

  return (
    <>
      <div className={`area-home-shortcut-group ${className}`.trim()}>
        {/* Home icon */}
        <Link
          to="/"
          className="area-home-shortcut"
          aria-label="Volver al selector de áreas"
          title="Volver al selector de áreas"
        >
          <UiIcon name="home" />
        </Link>

        {/* User icon with dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            className="area-home-shortcut area-user-shortcut"
            type="button"
            aria-label="Menú de usuario"
            title="Menú de usuario"
            onClick={() => setUserMenuOpen((prev) => !prev)}
          >
            <UiIcon name="user" />
          </button>

          {userMenuOpen && (
            <div className="user-dropdown-menu">
              {/* User info */}
              <div className="user-dropdown-info">
                <div className="user-dropdown-avatar">
                  {user?.initials ?? '?'}
                </div>
                <div>
                  <strong className="user-dropdown-name">{user?.fullName ?? 'Operador'}</strong>
                  <span className="user-dropdown-role">
                    {user?.role === Role.SUPER_ADMIN ? 'Super administrador' : user?.role === Role.ADMIN ? 'Administrador' : 'Operador'}
                  </span>
                </div>
              </div>

              <div className="user-dropdown-divider" />

              {/* Help */}
              <button
                className="user-dropdown-item"
                type="button"
                onClick={openHelp}
              >
                <UiIcon name="help" style={{ width: 16, height: 16 }} />
                Ayuda e Incidencias
              </button>

              <div className="user-dropdown-divider" />

              {/* Logout */}
              <button
                className="user-dropdown-item user-dropdown-item--danger"
                type="button"
                onClick={openLogoutConfirm}
              >
                <UiIcon name="logout" style={{ width: 16, height: 16 }} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>

        <HelpSupportWidget isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>

      {/* Logout confirmation modal */}
      {confirmLogout && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setConfirmLogout(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, padding: '28px 32px',
              width: 'min(380px, 90vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#dc2626',
            }}>
              <UiIcon name="logout" style={{ width: 24, height: 24 }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                ¿Cerrar sesión?
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                Tu sesión actual será finalizada. Deberás iniciar sesión nuevamente para acceder al sistema.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                type="button"
                style={{
                  flex: 1, padding: '10px', border: '1.5px solid #e2e8f0',
                  borderRadius: 8, background: '#fff', color: '#374151',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
                onClick={() => setConfirmLogout(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{
                  flex: 1, padding: '10px', border: 'none',
                  borderRadius: 8, background: '#dc2626', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
                onClick={handleLogout}
              >
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
