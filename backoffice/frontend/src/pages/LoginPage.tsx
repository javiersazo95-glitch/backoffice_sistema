import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const loginStyles = `
@keyframes floatUp {
  0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
  50% { transform: translateY(-18px) scale(1.15); opacity: 1; }
}
@keyframes floatDown {
  0%, 100% { transform: translateY(0px) scale(1); opacity: 0.5; }
  50% { transform: translateY(14px) scale(0.85); opacity: 0.8; }
}
@keyframes floatSide {
  0%, 100% { transform: translateX(0px) translateY(0px); opacity: 0.4; }
  50% { transform: translateX(10px) translateY(-8px); opacity: 0.7; }
}
@keyframes rotateSlow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes rotateReverse {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
  50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
}
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes cardFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}
@keyframes orbitDot {
  0% { transform: rotate(0deg) translateX(120px) rotate(0deg); }
  100% { transform: rotate(360deg) translateX(120px) rotate(-360deg); }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 0.9; transform: scale(1.3); }
}

/* ── Layout ── */
.login-wrapper {
  min-height: 100vh;
  display: flex;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.login-left {
  flex: 1;
  background: linear-gradient(135deg, #0b1d5a 0%, #0d2370 50%, #091548 100%);
  background-size: 200% 200%;
  animation: gradientShift 8s ease infinite;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  position: relative;
  overflow: hidden;
}
.login-right {
  width: min(480px, 45vw);
  min-width: 360px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  box-shadow: -8px 0 40px rgba(0,0,0,0.12);
}
.login-right-inner {
  width: 100%;
  max-width: 380px;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .login-left {
    display: none;
  }
  .login-right {
    width: 100%;
    min-width: 0;
    padding: 40px 24px;
    box-shadow: none;
    background: linear-gradient(160deg, #f0f4ff 0%, #fff 60%);
    justify-content: flex-start;
    padding-top: 56px;
  }
  .login-right-inner {
    max-width: 100%;
  }
}

@media (max-width: 400px) {
  .login-right {
    padding: 40px 20px 32px;
  }
}
`;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepSession, setKeepSession] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch {
      setError('Credenciales inválidas. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <style>{loginStyles}</style>
      {/* Left panel */}
      <div className="login-left">
        {/* Background decorative gears - animated */}
        <div style={{ position: 'absolute', top: 30, right: 60, opacity: 0.1, width: 120, height: 120, animation: 'rotateSlow 20s linear infinite' }}>
          <GearIcon />
        </div>
        <div style={{ position: 'absolute', bottom: 40, left: 20, opacity: 0.08, width: 90, height: 90, animation: 'rotateReverse 15s linear infinite' }}>
          <GearIcon />
        </div>
        <div style={{ position: 'absolute', top: '45%', right: '5%', opacity: 0.05, width: 60, height: 60, animation: 'rotateSlow 25s linear infinite' }}>
          <GearIcon />
        </div>
        {/* Floating dots - animated */}
        <span style={{ position: 'absolute', top: '20%', left: '8%', width: 8, height: 8, borderRadius: '50%', background: '#2563EB', animation: 'floatUp 3.5s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', top: '55%', left: '15%', width: 5, height: 5, borderRadius: '50%', background: '#60A5FA', animation: 'floatDown 4.2s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', top: '35%', right: '10%', width: 6, height: 6, borderRadius: '50%', background: '#2563EB', animation: 'floatSide 3.8s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', bottom: '30%', right: '8%', width: 7, height: 7, borderRadius: '50%', background: '#60A5FA', animation: 'floatUp 5s ease-in-out infinite 1s' }} />
        <span style={{ position: 'absolute', top: '68%', left: '8%', width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', animation: 'floatDown 3.2s ease-in-out infinite 0.5s' }} />
        <span style={{ position: 'absolute', top: '10%', left: '35%', width: 4, height: 4, borderRadius: '50%', background: '#a78bfa', animation: 'twinkle 2.8s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', bottom: '15%', right: '25%', width: 4, height: 4, borderRadius: '50%', background: '#34d399', animation: 'twinkle 3.6s ease-in-out infinite 1.2s' }} />
        <span style={{ position: 'absolute', top: '80%', left: '40%', width: 3, height: 3, borderRadius: '50%', background: '#60A5FA', animation: 'twinkle 4s ease-in-out infinite 0.8s' }} />

        <div style={{ maxWidth: 480, width: '100%', zIndex: 1 }}>
          {/* Status badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: 999,
              color: '#60A5FA',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
              Sistema Activo
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            textAlign: 'center',
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 12,
            lineHeight: 1.2,
          }}>
            RepuesTop <span style={{ color: '#38bdf8' }}>BackOffice</span>
          </h1>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 15, marginBottom: 40 }}>
            Tres sistemas, un solo acceso
          </p>

          {/* Module cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ animation: 'cardFloat 4s ease-in-out infinite' }}>
              <ModuleCard
                icon={<ChartIcon />}
                iconBg="linear-gradient(135deg, #10b981, #059669)"
                title="Administración Contable"
                desc="Gestión financiera, usuarios y configuración del sistema"
              />
            </div>
            <div style={{ animation: 'cardFloat 4s ease-in-out infinite 1.3s' }}>
              <ModuleCard
                icon={<HeadphonesIcon />}
                iconBg="linear-gradient(135deg, #06b6d4, #0284c7)"
                title="Soporte"
                desc="Gestión de tickets, casos y atención a vendedores"
              />
            </div>
            <div style={{ animation: 'cardFloat 4s ease-in-out infinite 2.6s' }}>
              <ModuleCard
                icon={<ShieldIcon />}
                iconBg="linear-gradient(135deg, #a855f7, #7c3aed)"
                title="Mediación y Confianza"
                desc="Revisión, mediación y resolución de casos y disputas"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-right-inner">
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
            <img
              src="/assets/repuestop-logo-cropped.jpg"
              alt="RepuesTop"
              style={{ height: 64, objectFit: 'contain', marginBottom: 8 }}
            />
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Bienvenido de nuevo
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32 }}>
            Inicia sesión para acceder al panel de administración
          </p>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Correo electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: '#94a3b8', display: 'flex',
                }}>
                  <EmailIcon />
                </span>
                <input
                  type="email"
                  placeholder="admin@repuestop.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 40px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
                  Contraseña
                </label>
                <a href="#" style={{ fontSize: 13, color: '#2563EB', textDecoration: 'none' }}
                  onClick={(e) => e.preventDefault()}>
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: '#94a3b8', display: 'flex',
                }}>
                  <LockIcon />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 40px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>

            {/* Keep session */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <input
                type="checkbox"
                id="keepSession"
                checked={keepSession}
                onChange={(e) => setKeepSession(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2563EB', cursor: 'pointer' }}
              />
              <label htmlFor="keepSession" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>
                Mantener sesión iniciada
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? '#93c5fd' : '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                marginBottom: 20,
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#1d4ed8'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#2563EB'; }}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>o continua con</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* Google button */}
            <button
              type="button"
              style={{
                width: '100%',
                padding: '11px',
                background: '#fff',
                color: '#374151',
                border: '1.5px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              <GoogleIcon />
              Continuar con Google
            </button>
          </form>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 36 }}>
            © 2025 RepuesTop · Panel Administrativo · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ icon, iconBg, title, desc }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 20px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{desc}</div>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" color="#60A5FA">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1.08s.03.74.07 1.08l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z"/>
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
