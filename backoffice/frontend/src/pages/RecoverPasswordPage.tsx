import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import apiClient from '@/api/client';

/**
 * Longitud minima de contrasena que exige el servidor, segun si la cuenta puede entrar al
 * backoffice. Son los mismos valores que AuthService: 12 para cuentas con acceso al backoffice y
 * 8 para el resto.
 *
 * Aqui se decide por la pestana desde la que se entro, que es lo unico que el cliente sabe antes
 * de tener respuesta. No siempre acierta: una cuenta de captador que ademas tenga acceso al
 * backoffice necesita 12 y este lado solo le exigira 8. Por eso el paso 3 muestra el mensaje real
 * del servidor (ver mensajeDeReset): la validacion de aqui evita el viaje en el caso comun, y el
 * mensaje del servidor cubre el caso que el cliente no puede prever.
 */
const MINIMO_PASSWORD = { BACKOFFICE: 12, CAPTADOR: 8 } as const;

/**
 * Mensaje de error de los pasos 1 y 2.
 *
 * Devuelve siempre el texto fijo de la pantalla y nunca el del servidor. En esos dos pasos la
 * persona todavia no ha demostrado nada: si el mensaje distinguiera "ese correo no existe" de
 * "codigo incorrecto", cualquiera podria enumerar cuentas validas antes de intentar fuerza bruta
 * sobre el codigo de seis digitos. El propio backend responde igual exista o no el identificador
 * por esta misma razon.
 */
function mensajeGenerico(_error: unknown, fallback: string) {
  return fallback;
}

/**
 * Mensaje de error del paso 3, donde SI se muestra el del servidor.
 *
 * Aqui el criterio cambia porque la situacion cambio: la persona ya demostro posesion del codigo
 * que llego a su correo, asi que el mensaje no le revela nada a un atacante que no supiera ya.
 * Y es la diferencia entre alguien que corrige su contrasena y alguien que se queda trabado
 * reintentando: el servidor puede rechazarla por reglas que este lado no conoce, como exigir 12
 * caracteres a una cuenta de captador que ademas tiene acceso al backoffice.
 */
function mensajeDeReset(error: unknown, fallback: string) {
  if (isAxiosError(error) && typeof error.response?.data?.message === 'string') {
    return error.response.data.message;
  }
  return fallback;
}

export default function RecoverPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isCapturer = params.get('type') === 'capturer';
  const role = isCapturer ? 'CAPTADOR' : 'BACKOFFICE';
  const minimoPassword = MINIMO_PASSWORD[role];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // El correo llega por estado de navegacion y no por la URL: un correo en una cadena de consulta
  // acaba en registros de servidor, en el historial del navegador y en la cabecera Referer.
  const [email, setEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? '');
  /**
   * Identificador opaco de la solicitud, que sustituye al correo en los pasos 2 y 3.
   *
   * Se guarda EXACTAMENTE como llega. Es base64 url-safe y distingue mayusculas: cualquier
   * normalizacion --un toLowerCase, un trim -- lo vuelve irresoluble, y el servidor responde
   * "codigo invalido o expiro", que apunta al lado equivocado y cuesta horas de depuracion.
   */
  const [solicitudId, setSolicitudId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** Vuelve al paso 1 pidiendo una solicitud nueva: la anterior es de un solo uso y puede caducar. */
  const empezarDeNuevo = () => {
    setSolicitudId('');
    setCode('');
    setPassword('');
    setError('');
    setStep(1);
  };

  const sendCode = async () => {
    setLoading(true); setError('');
    try {
      const respuesta = await apiClient.post<{ solicitudId?: string }>(
        '/auth/recover-password/send-code',
        { email: email.trim(), rol: role },
      );

      // El servidor responde igual exista o no la cuenta, asi que siempre debe venir un
      // solicitudId. Si falta, no es que la cuenta no exista: es que el backend todavia no tiene
      // el contrato nuevo. Se dice claro en vez de mandar peticiones sin identificador, que
      // fallarian como "codigo invalido" y apuntarian al lado equivocado.
      if (!respuesta.data?.solicitudId) {
        setError('El servidor no entregó un identificador de solicitud. Avisa al equipo técnico.');
        return;
      }

      setSolicitudId(respuesta.data.solicitudId);
      setStep(2);
    } catch (err) {
      setError(mensajeGenerico(err, 'No se pudo enviar el código.'));
    } finally { setLoading(false); }
  };

  const verifyCode = async () => {
    setLoading(true); setError('');
    try {
      await apiClient.post('/auth/recover-password/verify-code', { solicitudId, rol: role, code: code.trim() });
      setStep(3);
    } catch (err) {
      setError(mensajeGenerico(err, 'El código no es válido o expiró.'));
    } finally { setLoading(false); }
  };

  const resetPassword = async () => {
    if (password.length < minimoPassword) {
      setError(`La contraseña debe tener al menos ${minimoPassword} caracteres.`);
      return;
    }
    setLoading(true); setError('');
    try {
      await apiClient.post('/auth/recover-password/reset', {
        solicitudId,
        rol: role,
        code: code.trim(),
        newPassword: password,
      });
      navigate(`/login?type=${isCapturer ? 'capturer' : 'staff'}&reset=1`, { replace: true });
    } catch (err) {
      setError(mensajeDeReset(err, 'No se pudo restablecer la contraseña.'));
    } finally { setLoading(false); }
  };

  const card: React.CSSProperties = { width: 'min(440px, calc(100vw - 32px))', padding: 32, borderRadius: 16, background: '#fff', boxShadow: '0 20px 60px rgba(15, 45, 90, .18)' };
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 };
  const enlaceSecundario: React.CSSProperties = { border: 0, background: 'transparent', padding: 0, marginTop: 14, color: '#0b5ee8', fontSize: 13, cursor: 'pointer' };

  const puedeEnviar = step === 1
    ? Boolean(email.trim())
    : step === 2
      ? code.length === 6
      : password.length > 0;

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'linear-gradient(135deg, #eaf3ff, #f8fbff)' }}><section style={card}>
    <button type="button" onClick={() => navigate(`/login?type=${isCapturer ? 'capturer' : 'staff'}`)} style={{ border: 0, background: 'transparent', padding: 0, color: '#0b5ee8', cursor: 'pointer' }}>← Volver al inicio de sesión</button>
    <p style={{ margin: '26px 0 6px', color: '#0b5ee8', fontSize: 12, fontWeight: 800, letterSpacing: '.08em' }}>RECUPERACIÓN DE ACCESO</p>
    <h1 style={{ margin: '0 0 10px', color: '#172741', fontSize: 25 }}>{step === 1 ? 'Recupera tu contraseña' : step === 2 ? 'Verifica tu código' : 'Crea una contraseña nueva'}</h1>
    <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>{step === 1
      ? 'Te enviaremos un código de seis dígitos al correo asociado a tu cuenta.'
      : step === 2
        ? `Ingresa el código que enviamos a ${email}.`
        // El requisito se dice ANTES de que la persona escriba, no despues de que el servidor la rechace.
        : `Usa al menos ${minimoPassword} caracteres y no repitas tu contraseña anterior.`}</p>
    {step === 1 && <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={input} />}
    {step === 2 && <input autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="000000" style={{ ...input, letterSpacing: 8, textAlign: 'center' }} />}
    {step === 3 && <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={minimoPassword} placeholder={`Nueva contraseña (mínimo ${minimoPassword} caracteres)`} style={input} />}
    {error && <p style={{ color: '#b42318', fontSize: 13 }}>{error}</p>}
    <button type="button" disabled={loading || !puedeEnviar} onClick={step === 1 ? sendCode : step === 2 ? verifyCode : resetPassword} style={{ width: '100%', marginTop: 20, padding: 12, border: 0, borderRadius: 8, color: '#fff', background: '#0b5ee8', fontWeight: 700, cursor: 'pointer', opacity: loading ? .7 : 1 }}>{loading ? 'Procesando…' : step === 1 ? 'Enviar código' : step === 2 ? 'Verificar código' : 'Guardar nueva contraseña'}</button>
    {/* La solicitud es de un solo uso y caduca. Sin esta salida, quien se topa con una caducada
        queda atrapado en el paso 2 o 3 reintentando un código que ya no puede funcionar. */}
    {step !== 1 && <button type="button" onClick={empezarDeNuevo} style={enlaceSecundario}>Empezar de nuevo y pedir otro código</button>}
  </section></main>;
}
