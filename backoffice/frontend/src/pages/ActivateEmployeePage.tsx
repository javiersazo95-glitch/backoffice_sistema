import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '@/api/client';

export default function ActivateEmployeePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const initialEmail = (params.get('email') ?? '').trim();
  const initialCode = (params.get('code') ?? '').trim();

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      return setError('Por favor ingresa tu correo electrónico.');
    }
    if (!cleanCode || cleanCode.length < 6) {
      return setError('El código de invitación debe tener 6 dígitos.');
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
            Activa tu cuenta de empleado
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13.5, lineHeight: 1.45 }}>
            Define tu nueva contraseña para ingresar al Backoffice de <strong>RepuesTop</strong>.
          </p>
        </div>

        {/* Mensaje de código detectado */}
        {initialCode && (
          <div style={noticeBoxStyle}>
            <span style={{ fontSize: 16 }}>🔑</span>
            <span>Código de invitación cargado automáticamente desde tu enlace.</span>
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
          {/* Correo */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Correo electrónico</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-correo@repuestop.cl"
              required
            />
          </div>

          {/* Código */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Código de invitación (6 dígitos)</label>
            <input
              style={{ ...inputStyle, letterSpacing: '2px', fontWeight: 700 }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              required
            />
          </div>

          {/* Nueva Contraseña */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Nueva contraseña (mínimo 8 caracteres)</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 40 }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="••••••••"
                required
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
          </div>

          {/* Confirmar Contraseña */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Confirma tu nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 40 }}
                type={showConfirmation ? 'text' : 'password'}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                minLength={8}
                placeholder="••••••••"
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
              <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>
                Las contraseñas no coinciden.
              </span>
            )}
          </div>

          {/* Botón principal */}
          <button
            type="submit"
            disabled={saving}
            style={{
              ...primaryButtonStyle,
              opacity: saving ? 0.75 : 1,
              cursor: saving ? 'wait' : 'pointer',
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

const noticeBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 10,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1e40af',
  fontSize: 12.5,
  lineHeight: 1.4,
  marginBottom: 18,
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
  display: 'block',
  marginBottom: 6,
  color: '#334155',
  fontSize: 13,
  fontWeight: 600,
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
