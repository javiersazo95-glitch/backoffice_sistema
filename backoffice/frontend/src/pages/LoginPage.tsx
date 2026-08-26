import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { isAxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types/auth';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.message === 'string') {
    return error.response.data.message;
  }
  return fallback;
}

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

/* ── Lock document scroll when on login page ── */
html:has(.login-wrapper),
body:has(.login-wrapper) {
  overflow: hidden !important;
  height: 100vh !important;
  height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* ── Layout ── */
.login-wrapper {
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  max-width: 100%;
  max-height: 100vh;
  max-height: 100dvh;
  display: flex;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  box-sizing: border-box;
}

.login-left {
  flex: 1;
  height: 100%;
  max-height: 100%;
  background: linear-gradient(135deg, #0b1d5a 0%, #0d2370 50%, #091548 100%);
  background-size: 200% 200%;
  animation: gradientShift 8s ease infinite;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 3vh, 40px) clamp(20px, 3vw, 40px);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.login-left-inner {
  max-width: 460px;
  width: 100%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  max-height: 100%;
}

.login-right {
  width: min(480px, 45vw);
  min-width: 360px;
  height: 100%;
  max-height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 2.5vh, 40px) clamp(20px, 3vw, 40px);
  box-shadow: -8px 0 40px rgba(0,0,0,0.12);
  overflow: hidden;
  box-sizing: border-box;
}

.login-right-inner {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  max-height: 100%;
}

.login-brand-logo {
  width: auto;
  max-width: min(260px, 65vw);
  height: auto;
  max-height: clamp(52px, 9.5vh, 88px);
  object-fit: contain;
  display: block;
}

/* ── Mobile & Small Screens ── */
@media (max-width: 768px) {
  .login-left {
    display: none;
  }
  .login-right {
    width: 100%;
    min-width: 0;
    padding: clamp(16px, 3vh, 32px) clamp(16px, 4vw, 24px);
    box-shadow: none;
    background: linear-gradient(160deg, #f0f4ff 0%, #fff 60%);
    justify-content: center;
    align-items: center;
  }
  .login-right-inner {
    max-width: 400px;
    width: 100%;
  }
}

@media (max-height: 650px) {
  .login-right-inner {
    transform: scale(0.92);
    transform-origin: center center;
  }
  .login-left-inner {
    transform: scale(0.92);
    transform-origin: center center;
  }
}

@media (max-height: 550px) {
  .login-right-inner {
    transform: scale(0.82);
    transform-origin: center center;
  }
  .login-left-inner {
    transform: scale(0.82);
    transform-origin: center center;
  }
}
`;

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [accessType, setAccessType] = useState<'staff' | 'capturer'>(searchParams.get('type') === 'capturer' ? 'capturer' : 'staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepSession, setKeepSession] = useState(false);
  const { login, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(username, password, keepSession);
      if (accessType === 'capturer' && loggedUser.role !== Role.CAPTADOR) {
        await logout();
        throw new Error('Esta cuenta pertenece al personal. Selecciona “Personal de la empresa”.');
      }
      if (accessType === 'staff' && loggedUser.role === Role.CAPTADOR) {
        await logout();
        throw new Error('Esta cuenta es de captador. Selecciona “Captadores”.');
      }
      navigate(loggedUser.role === Role.CAPTADOR ? '/captador' : '/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : extractErrorMessage(err, 'Credenciales inválidas. Intente nuevamente.');
      if (accessType === 'capturer' && /verificar.*correo|correo.*verific/i.test(message)) {
        navigate(`/registro-captador?email=${encodeURIComponent(username.trim().toLowerCase())}`, { replace: true });
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential?: string) => {
    if (!credential) {
      setError('No se pudo obtener la credencial de Google.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const loggedUser = await loginWithGoogle(credential, keepSession);
      navigate(loggedUser.role === Role.CAPTADOR ? '/captador' : '/', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'No se pudo iniciar sesión con Google. Verifica que tu cuenta esté habilitada.'));
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

        <div className="login-left-inner">
          {/* Status badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(8px, 2vh, 24px)' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 14px',
              border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: 999,
              color: '#60A5FA',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
              Sistema Activo
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            textAlign: 'center',
            fontSize: 'clamp(22px, 3.8vh, 36px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 'clamp(4px, 0.8vh, 10px)',
            lineHeight: 1.2,
          }}>
            RepuesTop <span style={{ color: '#38bdf8' }}>BackOffice</span>
          </h1>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(12px, 1.6vh, 15px)', marginBottom: 'clamp(14px, 3vh, 32px)' }}>
            Tres sistemas, un solo acceso
          </p>

          {/* Module cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.4vh, 12px)' }}>
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
            <div style={{ animation: 'cardFloat 4s ease-in-out infinite 3.2s' }}>
              <ModuleCard
                icon={<UsersIcon />}
                iconBg="linear-gradient(135deg, #f59e0b, #f97316)"
                title="Captadores"
                desc="Seguimiento de referidos, comisiones y gestión comercial"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-right-inner">
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'clamp(8px, 2vh, 24px)' }}>
            <img
              className="login-brand-logo"
              src="/assets/repuestop-logo.jpg"
              alt="RepuesTop"
            />
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: 'clamp(20px, 2.8vh, 24px)', fontWeight: 700, color: '#0f172a', marginBottom: 4, textAlign: 'center' }}>
            Bienvenido de nuevo
          </h2>
          <p style={{ color: '#64748b', fontSize: 'clamp(12px, 1.5vh, 14px)', marginBottom: 'clamp(10px, 2vh, 22px)', textAlign: 'center' }}>
            Selecciona el tipo de acceso para continuar
          </p>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',padding:4,border:'1px solid #dbe3ef',borderRadius:10,marginBottom:16,background:'#f8fafc'}}>
            <button type="button" onClick={()=>{setAccessType('staff');setError('')}} style={accessType==='staff'?accessButtonActive:accessButton}>Personal de la empresa</button>
            <button type="button" onClick={()=>{setAccessType('capturer');setError('')}} style={accessType==='capturer'?accessButtonActive:accessButton}>Captadores</button>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 'clamp(8px, 1.5vh, 16px)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            {/* Email */}
            <div style={{ marginBottom: 'clamp(8px, 1.5vh, 16px)' }}>
              <label style={{ display: 'block', fontSize: 'clamp(12px, 1.4vh, 13.5px)', fontWeight: 500, color: '#374151', marginBottom: 4 }}>
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
                    padding: 'clamp(8px, 1.2vh, 10px) 14px clamp(8px, 1.2vh, 10px) 40px',
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
            <div style={{ marginBottom: 'clamp(8px, 1.5vh, 16px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 'clamp(12px, 1.4vh, 13.5px)', fontWeight: 500, color: '#374151' }}>
                  Contraseña
                </label>
                <a href="#" style={{ fontSize: 'clamp(11px, 1.3vh, 13px)', color: '#2563EB', textDecoration: 'none' }}
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
                    padding: 'clamp(8px, 1.2vh, 10px) 14px clamp(8px, 1.2vh, 10px) 40px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'clamp(10px, 1.8vh, 18px)' }}>
              <input
                type="checkbox"
                id="keepSession"
                checked={keepSession}
                onChange={(e) => setKeepSession(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2563EB', cursor: 'pointer' }}
              />
              <label htmlFor="keepSession" style={{ fontSize: 'clamp(12px, 1.4vh, 13.5px)', color: '#374151', cursor: 'pointer' }}>
                Mantener sesión iniciada
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: 'clamp(9px, 1.3vh, 12px)',
                background: loading ? '#93c5fd' : '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                marginBottom: 'clamp(10px, 1.6vh, 16px)',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#1d4ed8'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#2563EB'; }}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            {accessType === 'staff' ? <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'clamp(10px, 1.6vh, 16px)' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>o continúa con</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin theme="outline" shape="rectangular" size="large" width="100%" text="continue_with" onSuccess={(credentialResponse) => handleGoogleSuccess(credentialResponse.credential)} onError={() => setError('No se pudo iniciar sesión con Google. Intenta nuevamente.')} />
              </div>
            </> : <div style={{border:'1px solid #bfdbfe',background:'#eff6ff',borderRadius:10,padding:12,textAlign:'center'}}>
              <strong style={{display:'block',fontSize:13,color:'#153e75'}}>¿Aún no eres captador?</strong>
              <button type="button" onClick={()=>navigate('/registro-captador')} style={{...accessButtonActive,width:'100%',marginTop:9,border:'1px solid #2563eb'}}>Registrarse como captador</button>
            </div>}
          </form>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 'clamp(12px, 2vh, 24px)', flexShrink: 0 }}>
            © 2025 RepuesTop · Panel Administrativo · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}

const accessButton: React.CSSProperties = {border:0,background:'transparent',padding:'10px 8px',borderRadius:8,color:'#64748b',fontWeight:600,cursor:'pointer'};
const accessButtonActive: React.CSSProperties = {...accessButton,background:'#2563eb',color:'#fff',boxShadow:'0 3px 8px rgba(37,99,235,.2)'};

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
      gap: 14,
      padding: 'clamp(8px, 1.3vh, 14px) clamp(12px, 1.8vw, 18px)',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 'clamp(34px, 4vh, 42px)',
        height: 'clamp(34px, 4vh, 42px)',
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
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 'clamp(12.5px, 1.5vh, 14px)', marginBottom: 2 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(11px, 1.3vh, 12px)' }}>{desc}</div>
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

function UsersIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
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
