import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '@/api/client';

export default function ActivateEmployeePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const initialEmail = (params.get('email') ?? '').trim();
  const initialCode = (params.get('code') ?? '').trim();

  // El correo y código provienen del enlace de activación y están estrictamente bloqueados (solo lectura)
  const email = initialEmail;
  const code = initialCode;

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isMissingParams = !email || !code;

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail || !cleanCode) {
      return setError('El enlace no contiene el correo o código de activación. Abre el enlace directamente desde tu correo.');
    }
    if (password.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres.');
    }
    if (password !== confirmation) {
      return setError('Las contraseñas no coinciden.');
    }

    setSaving(true);
    try {
      await apiClient.post('/auth/backoffice/activate', {
        email: cleanEmail,
        code: cleanCode,
        newPassword: password,
      });

      navigate(`/login?activated=1&email=${encodeURIComponent(cleanEmail)}`, { replace: true });
    } catch (requestError: any) {
      const serverMessage = requestError.response?.data?.message;
      setError(serverMessage || 'No se pudo activar la cuenta. Verifica que el enlace no haya vencido e inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={mainContainerStyle}>
      <div style={cardStyle}>
        {/* Encabezado con Logo y Branding */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <img
              src="/assets/repuestop-logo.jpg"
              alt="RepuesTop"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              style={{ height: 44, objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Crea tu contraseña de acceso
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13.5, lineHeight: 1.45 }}>
            Ingresa tu nueva contraseña para activar tu cuenta de empleado en <strong>RepuesTop</strong>.
          </p>
        </div>

        {/* Alerta si el enlace está incompleto */}
        {isMissingParams && (
          <div style={errorBoxStyle}>
            <span style={{ fontWeight: 700, marginRight: 6 }}>⚠️</span>
            <span>
              Enlace incompleto: Falta el correo o código de activación. Por favor abre el enlace que recibiste en tu correo electrónico.
            </span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={errorBoxStyle}>
            <span style={{ fontWeight: 700, marginRight: 6 }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={activate}>
          {/* Correo (Bloqueado) */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              Correo electrónico
              <span style={lockedTagStyle}>🔒 Bloqueado</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={lockedInputStyle}
                type="email"
                value={email || 'Sin correo en el enlace'}
                readOnly
                disabled
                tabIndex={-1}
              />
              <span style={lockIconStyle}>🔒</span>
            </div>
            <span style={fieldHelpStyle}>
              Tu cuenta de empleado quedará vinculada a esta dirección.
            </span>
          </div>

          {/* Código de activación (Bloqueado) */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              Código de activación
              <span style={lockedTagStyle}>🔒 Bloqueado</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...lockedInputStyle, letterSpacing: '4px', fontWeight: 700, fontFamily: 'monospace' }}
                type="text"
                value={code || '••••••'}
                readOnly
                disabled
                tabIndex={-1}
              />
              <span style={lockIconStyle}>🔒</span>
            </div>
            <span style={fieldHelpStyle}>
              Código de seguridad verificado automáticamente desde tu enlace de invitación.
            </span>
          </div>

          {/* Divisor */}
          <div style={{ margin: '20px 0 16px', borderTop: '1px solid #f1f5f9' }} />

          {/* Nueva Contraseña (Editable) */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              Nueva contraseña <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 40 }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                disabled={isMissingParams || saving}
                required
                autoFocus={!isMissingParams}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={eyeButtonStyle}
                tabIndex={-1}
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
            <span style={fieldHelpStyle}>
              Debe tener un mínimo de 8 caracteres.
            </span>
          </div>

          {/* Confirmar Contraseña (Editable) */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              Confirma tu nueva contraseña <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{
                  ...inputStyle,
                  paddingRight: 40,
                  borderColor: password && confirmation && password !== confirmation ? '#ef4444' : '#cbd5e1',
                }}
                type={showConfirmation ? 'text' : 'password'}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                minLength={8}
                placeholder="Repite tu contraseña"
                disabled={isMissingParams || saving}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmation(!showConfirmation)}
                style={eyeButtonStyle}
                tabIndex={-1}
                title={showConfirmation ? 'Ocultar' : 'Mostrar'}
              >
                {showConfirmation ? '👁️' : '🔒'}
              </button>
            </div>
            {password && confirmation && password !== confirmation && (
              <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block', fontWeight: 500 }}>
                Las contraseñas no coinciden.
              </span>
            )}
          </div>

          {/* Botón principal */}
          <button
            type="submit"
            disabled={saving || isMissingParams || password.length < 8 || password !== confirmation}
            style={{
              ...primaryButtonStyle,
              opacity: (saving || isMissingParams || password.length < 8 || password !== confirmation) ? 0.6 : 1,
              cursor: saving ? 'wait' : (isMissingParams || password.length < 8 || password !== confirmation) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Guardando contraseña y activando…' : 'Crear contraseña y activar cuenta'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link
            to="/login"
            style={{ color: '#0b5ee8', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}
          >
            ¿Ya activaste tu cuenta? Inicia sesión aquí
          </Link>
        </div>
      </div>
    </main>
  );
}

const mainContainerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px 16px',
  background: '#f8fafc',
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: 'min(100%, 430px)',
  background: '#ffffff',
  padding: '32px 28px',
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
};

const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '10px 14px',
  borderRadius: 10,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  fontSize: 13,
  lineHeight: 1.4,
  marginBottom: 18,
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
  color: '#334155',
  fontSize: 13,
  fontWeight: 600,
};

const lockedTagStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#64748b',
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  padding: '1px 6px',
  borderRadius: 4,
};

const lockedInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 36px 10px 14px',
  borderRadius: 8,
  border: '1.5px solid #e2e8f0',
  background: '#f8fafc',
  fontSize: 14,
  color: '#64748b',
  fontWeight: 500,
  cursor: 'not-allowed',
  outline: 'none',
  boxSizing: 'border-box',
};

const lockIconStyle: React.CSSProperties = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 13,
  opacity: 0.5,
  pointerEvents: 'none',
};

const fieldHelpStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  color: '#64748b',
  marginTop: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1.5px solid #cbd5e1',
  fontSize: 14,
  color: '#0f172a',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
};

const eyeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  fontSize: 14,
  opacity: 0.7,
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 18px',
  border: 0,
  borderRadius: 9,
  color: '#ffffff',
  background: '#0b5ee8',
  fontWeight: 700,
  fontSize: 14.5,
  boxShadow: '0 4px 12px rgba(11, 94, 232, 0.28)',
  transition: 'all 0.15s ease',
  marginTop: 6,
};
