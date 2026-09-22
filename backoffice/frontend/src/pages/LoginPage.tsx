import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { isAxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types/auth';

/**
 * Mensajes fijos de esta pantalla.
 *
 * Son constantes a proposito: el detalle que devuelve el servidor no se muestra nunca en una
 * pantalla sin sesion. Distinguir "esa cuenta no existe" de "contrasena incorrecta" permite
 * enumerar cuentas validas del backoffice, que es el trabajo previo de cualquier ataque de
 * fuerza bruta contra los flujos de activacion y recuperacion.
 */
const ERROR_CREDENCIALES = 'Credenciales inválidas. Intente nuevamente.';
const ERROR_GOOGLE = 'No se pudo iniciar sesión con Google. Verifica que tu cuenta esté habilitada.';

/**
 * Marcador neutro para el campo de correo del personal. Antes decia "admin@repuestop.com", lo que
 * regalaba el patron de las cuentas administrativas a cualquier visitante sin sesion.
 */
const PLACEHOLDER_CORREO_PERSONAL = 'correo@empresa.cl';

/**
 * ¿El acceso fallo porque el captador todavia no verifico su correo?
 *
 * Es la unica razon por la que esta pantalla mira el cuerpo del error: para desviar a esa
 * persona al alta en vez de dejarla con un mensaje generico. Lo que se pinta en pantalla siempre
 * es una de las constantes de arriba.
 *
 * Acepta las dos formas a proposito. La preferida es el campo estructurado
 * pendingEmailVerification, que es lo que el backend puede empezar a devolver cuando quiera; el
 * respaldo es buscar la frase en el mensaje, que es lo que hay hoy y es fragil porque depende de
 * como este redactado. Aceptando ambas, el backend puede anadir el campo sin coordinar nada y
 * esto sigue funcionando antes y despues.
 */
function faltaVerificarCorreo(error: unknown): boolean {
  if (!isAxiosError(error)) return false;

  const cuerpo = error.response?.data as { pendingEmailVerification?: unknown; message?: unknown } | undefined;
  if (cuerpo?.pendingEmailVerification === true) return true;

  return typeof cuerpo?.message === 'string' && /verificar.*correo|correo.*verific/i.test(cuerpo.message);
}

/**
 * A donde ir tras un acceso correcto, o que decirle a quien uso la puerta equivocada.
 *
 * En el acceso de PERSONAL no se comprueba el rol. Quien autoriza esa puerta es el servidor, y
 * lo hace por PERMISOS de backoffice, no por rol: si devolvio sesion, la persona puede entrar
 * aunque su rol sea CAPTADOR, porque alguien puede ser captador y ademas tener un area asignada.
 * Antes se rechazaba aqui por rol, y eso dejaba fuera justo a esa persona: era un fallo del
 * cliente, no del servidor (SEC-BACKOFFICE-009). Una identidad sin permisos de backoffice ni
 * siquiera llega hasta aqui: el servidor no emite sesion.
 *
 * En el acceso de CAPTADORES si se comprueba, porque esa puerta no otorga permisos de backoffice
 * y el portal exige rol CAPTADOR: sin el, la persona entraria a una pantalla que no puede usar.
 */
function destinoTrasAcceso(
  accessType: 'staff' | 'capturer',
  usuario: { role: Role },
): { destino: string } | { error: string } {
  if (accessType === 'capturer') {
    if (usuario.role !== Role.CAPTADOR) {
      return { error: 'Esta cuenta pertenece al personal. Selecciona “Personal de la empresa”.' };
    }
    return { destino: '/captador' };
  }

  return { destino: '/' };
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
  background: linear-gradient(135deg, #07173e 0%, #0d276b 50%, #091548 100%);
  background-size: 200% 200%;
  animation: gradientShift 10s ease infinite;
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
  max-width: 480px;
  width: 100%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  max-height: 100%;
}

.login-right {
  width: min(500px, 46vw);
  min-width: 360px;
  height: 100%;
  max-height: 100%;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 2.5vh, 40px) clamp(24px, 3.5vw, 44px);
  box-shadow: -8px 0 40px rgba(0,0,0,0.08);
  overflow-y: auto;
  box-sizing: border-box;
  position: relative;
}

.login-right-inner {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100%;
  padding: 12px 0;
  box-sizing: border-box;
}

.login-brand-logo {
  width: auto;
  max-width: min(230px, 58vw);
  height: auto;
  max-height: clamp(46px, 8vh, 72px);
  object-fit: contain;
  display: block;
}

/* ── Segmented Control Tabs (Sober & Clean) ── */
.access-switcher {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: clamp(14px, 2.2vh, 22px);
  gap: 4px;
}

.access-tab-btn {
  border: none;
  background: transparent;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  user-select: none;
}

.access-tab-btn:hover:not(.active) {
  color: #0f172a;
}

.access-tab-btn.active {
  background: #ffffff;
  color: #0b5ee8;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* ── Mobile & Small Screens ── */
@media (max-width: 820px) {
  .login-left {
    display: none;
  }
  .login-right {
    width: 100%;
    min-width: 0;
    padding: clamp(16px, 3vh, 32px) clamp(16px, 4vw, 24px);
    box-shadow: none;
    background: #ffffff;
    justify-content: center;
    align-items: center;
  }
  .login-right-inner {
    max-width: 400px;
    width: 100%;
  }
}

@media (max-height: 700px) {
  .login-right-inner {
    transform: scale(0.95);
    transform-origin: center center;
  }
}
`;

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const isActivatedParam = searchParams.get('activated') === '1';
  const [accessType, setAccessType] = useState<'staff' | 'capturer'>(() => {
    if (searchParams.get('activated') === '1') return 'staff';
    return searchParams.get('type') === 'capturer' ? 'capturer' : 'staff';
  });
  const [username, setUsername] = useState(() => searchParams.get('email')?.trim().toLowerCase() || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepSession, setKeepSession] = useState(false);
  const { login, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  const isVerifiedParam = searchParams.get('verified') === '1';
  const applicationReceived = searchParams.get('application') === 'received';
  const existingCapturerAccount = searchParams.get('existing') === '1';


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Evita reutilizar un token de captador cuando se cambia al acceso de personal.
      await logout();
      const loggedUser = await login(username, password, keepSession, accessType === 'staff' ? 'BACKOFFICE' : 'CAPTADOR');
      const resultado = destinoTrasAcceso(accessType, loggedUser);
      if ('error' in resultado) {
        await logout();
        throw new Error(resultado.error);
      }
      navigate(resultado.destino, { replace: true });
    } catch (err) {
      if (accessType === 'capturer' && faltaVerificarCorreo(err)) {
        navigate(`/registro-captador?email=${encodeURIComponent(username.trim().toLowerCase())}`, { replace: true });
        return;
      }
      // Los errores lanzados por esta misma pantalla (tipo de acceso equivocado) son nuestros y
      // si se muestran; los del servidor se reemplazan por el mensaje generico.
      setError(!isAxiosError(err) && err instanceof Error ? err.message : ERROR_CREDENCIALES);
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
      // Google también debe comenzar desde una sesión limpia al cambiar de tipo de acceso.
      await logout();
      const loggedUser = await loginWithGoogle(credential, keepSession, accessType === 'staff' ? 'BACKOFFICE' : 'CAPTADOR');
      const resultado = destinoTrasAcceso(accessType, loggedUser);
      if ('error' in resultado) {
        await logout();
        throw new Error(resultado.error);
      }
      navigate(resultado.destino, { replace: true });
    } catch (err) {
      // Mismo criterio que en el acceso con contrasena: lo nuestro se muestra, lo del servidor no.
      setError(!isAxiosError(err) && err instanceof Error ? err.message : ERROR_GOOGLE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <style>{loginStyles}</style>

      {/* Panel izquierdo informativo */}
      <div className="login-left">
        {/* Engranajes decorativos sobrios */}
        <div style={{ position: 'absolute', top: 30, right: 60, opacity: 0.08, width: 120, height: 120, animation: 'rotateSlow 20s linear infinite' }}>
          <GearIcon />
        </div>
        <div style={{ position: 'absolute', bottom: 40, left: 20, opacity: 0.06, width: 90, height: 90, animation: 'rotateReverse 15s linear infinite' }}>
          <GearIcon />
        </div>

        {/* Puntos de acento azul / verde sutil */}
        <span style={{ position: 'absolute', top: '20%', left: '8%', width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', animation: 'floatUp 3.5s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', top: '55%', left: '15%', width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', animation: 'floatDown 4.2s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', bottom: '30%', right: '8%', width: 6, height: 6, borderRadius: '50%', background: '#93c5fd', animation: 'floatUp 5s ease-in-out infinite 1s' }} />

        <div className="login-left-inner">
          {/* Badge de estado del sistema */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(8px, 2vh, 20px)' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 14px',
              border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: 999,
              color: '#93c5fd',
              background: 'rgba(15, 23, 42, 0.4)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
              Sistema Activo
            </span>
          </div>

          {/* Título principal */}
          <h1 style={{
            textAlign: 'center',
            fontSize: 'clamp(22px, 3.6vh, 34px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 'clamp(4px, 0.8vh, 8px)',
            lineHeight: 1.2,
          }}>
            RepuesTop <span style={{ color: '#38bdf8' }}>BackOffice</span>
          </h1>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(12px, 1.5vh, 14.5px)', marginBottom: 'clamp(14px, 2.8vh, 28px)' }}>
            Plataforma centralizada de gestión y comisiones
          </p>

          {/* Tarjetas de módulos del sistema */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.3vh, 12px)' }}>
            <div style={{ animation: 'cardFloat 4s ease-in-out infinite' }}>
              <ModuleCard
                icon={<ChartIcon />}
                iconBg="linear-gradient(135deg, #10b981, #059669)"
                title="Administración Contable"
                desc="Gestión financiera, liquidaciones y configuración del sistema"
              />
            </div>
            <div style={{ animation: 'cardFloat 4s ease-in-out infinite 1.3s' }}>
              <ModuleCard
                icon={<HeadphonesIcon />}
                iconBg="linear-gradient(135deg, #06b6d4, #0284c7)"
                title="Soporte"
                desc="Gestión de tickets, casos y atención integral a vendedores"
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
                iconBg="linear-gradient(135deg, #0b5ee8, #1d4ed8)"
                title="Captadores"
                desc="Seguimiento de referidos, ranking de comisiones y catálogo"
                activeGlow={accessType === 'capturer'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho del login */}
      <div className="login-right">
        <div className="login-right-inner">
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'clamp(12px, 2vh, 22px)' }}>
            <img
              className="login-brand-logo"
              src="/assets/repuestop-logo.jpg"
              alt="RepuesTop"
            />
          </div>

          {/* Switcher de Pestañas Rediseñado y Sobrio */}
          <div className="access-switcher" role="tablist" aria-label="Tipo de acceso">
            <button
              type="button"
              role="tab"
              aria-selected={accessType === 'staff'}
              onClick={() => { setAccessType('staff'); setError(''); }}
              className={`access-tab-btn ${accessType === 'staff' ? 'active' : ''}`}
            >
              Personal de la empresa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={accessType === 'capturer'}
              onClick={() => { setAccessType('capturer'); setError(''); }}
              className={`access-tab-btn ${accessType === 'capturer' ? 'active' : ''}`}
            >
              Captadores
            </button>
          </div>

          {/* Encabezado contextual según la pestaña */}
          {accessType === 'capturer' ? (
            <div style={{ textAlign: 'center', marginBottom: 'clamp(12px, 2vh, 20px)' }}>
              <h2 style={{ fontSize: 'clamp(19px, 2.6vh, 23px)', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
                Acceso Captadores
              </h2>
              <p style={{ color: '#64748b', fontSize: 'clamp(12.5px, 1.4vh, 14px)', margin: 0 }}>
                Gestiona tus referidos y revisa tus comisiones
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 'clamp(12px, 2vh, 20px)' }}>
              <h2 style={{ fontSize: 'clamp(19px, 2.6vh, 23px)', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
                Iniciar Sesión
              </h2>
              <p style={{ color: '#64748b', fontSize: 'clamp(12.5px, 1.4vh, 14px)', margin: 0 }}>
                Ingresa con tu correo corporativo autorizado
              </p>
            </div>
          )}

          {isVerifiedParam && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#047857',
              fontSize: 13,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>✓ Correo verificado con éxito. Ya puedes ingresar.</span>
            </div>
          )}

          {isActivatedParam && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 8,
              padding: '12px 14px',
              color: '#047857',
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <div>
                <strong>¡Cuenta activada exitosamente!</strong> Tu contraseña ha sido creada. Ingresa a continuación para acceder al Backoffice.
              </div>
            </div>
          )}

          {applicationReceived && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#1d4ed8',
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 14,
            }}>
              {existingCapturerAccount
                ? '✓ Postulación registrada en tu cuenta existente. Ingresa con la contraseña que ya usabas; la contraseña del formulario fue validada, no reemplazada.'
                : '✓ Postulación registrada. Ingresa para revisar su estado.'}
            </div>
          )}

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            {/* Correo electrónico */}
            <div style={{ marginBottom: 'clamp(10px, 1.6vh, 16px)' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334151', marginBottom: 5 }}>
                Correo electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: '#94a3b8', display: 'flex', pointerEvents: 'none',
                }}>
                  <EmailIcon />
                </span>
                <input
                  type="email"
                  placeholder={accessType === 'capturer' ? 'tu-correo@ejemplo.com' : PLACEHOLDER_CORREO_PERSONAL}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0b5ee8'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: 'clamp(10px, 1.6vh, 16px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334151' }}>
                  Contraseña
                </label>
                <a
                  href="#"
                  style={{ fontSize: 12, color: '#0b5ee8', textDecoration: 'none', fontWeight: 500 }}
                  onClick={(e) => { e.preventDefault(); navigate(`/recuperar-contrasena?type=${accessType}&email=${encodeURIComponent(username.trim())}`); }}
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: '#94a3b8', display: 'flex', pointerEvents: 'none',
                }}>
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 38px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0b5ee8'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Mantener sesión */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'clamp(12px, 1.8vh, 18px)' }}>
              <input
                type="checkbox"
                id="keepSession"
                checked={keepSession}
                onChange={(e) => setKeepSession(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: '#0b5ee8',
                  cursor: 'pointer',
                }}
              />
              <label htmlFor="keepSession" style={{ fontSize: 13, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                Mantener sesión iniciada
              </label>
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                background: loading ? '#93c5fd' : '#0b5ee8',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14.5,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
                marginBottom: 'clamp(12px, 1.8vh, 18px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#094ec2'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#0b5ee8'; }}
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <span>{accessType === 'capturer' ? 'Ingresar como Captador' : 'Iniciar Sesión'}</span>
              )}
            </button>

            {/* Acciones inferiores según la pestaña */}
            {accessType === 'staff' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'clamp(10px, 1.6vh, 16px)' }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>o continúa con</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <GoogleLogin
                    theme="outline"
                    shape="rectangular"
                    size="large"
                    width="100%"
                    text="continue_with"
                    onSuccess={(credentialResponse) => handleGoogleSuccess(credentialResponse.credential)}
                    onError={() => setError('No se pudo iniciar sesión con Google. Intenta nuevamente.')}
                  />
                </div>
              </>
            ) : (
              /* Sección de registro para captadores sobria y elegante */
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '14px 16px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>
                  ¿Aún no eres captador?
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>
                  Postula para integrarte a la red comercial y comenzar a generar comisiones.
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/registro-captador')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#ffffff',
                    color: '#0b5ee8',
                    border: '1.5px solid #0b5ee8',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  Registrarse como captador →
                </button>
              </div>
            )}
          </form>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8', marginTop: 'clamp(14px, 2vh, 24px)', marginBottom: 0 }}>
            © {new Date().getFullYear()} RepuesTop · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({
  icon,
  iconBg,
  title,
  desc,
  activeGlow = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  activeGlow?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: 'clamp(9px, 1.4vh, 14px) clamp(12px, 1.8vw, 18px)',
      background: activeGlow ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
      border: activeGlow ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      backdropFilter: 'blur(6px)',
      boxShadow: activeGlow ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none',
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        width: 'clamp(36px, 4.2vh, 44px)',
        height: 'clamp(36px, 4.2vh, 44px)',
        borderRadius: 10,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 'clamp(13px, 1.5vh, 14.5px)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(11px, 1.3vh, 12px)', lineHeight: 1.3 }}>
          {desc}
        </div>
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
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
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

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'rotateSlow 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
