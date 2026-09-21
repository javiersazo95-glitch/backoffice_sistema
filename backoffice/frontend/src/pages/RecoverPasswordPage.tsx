import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '@/api/client';

/**
 * Mensaje a mostrar ante un error.
 *
 * Devuelve siempre el texto fijo de esta pantalla, nunca el del servidor. La recuperacion de
 * contrasena se alcanza sin sesion: si el mensaje distingue "ese correo no existe" de "codigo
 * incorrecto", cualquiera puede enumerar cuentas validas del backoffice antes de intentar fuerza
 * bruta sobre el codigo de seis digitos.
 */
function message(_error: unknown, fallback: string) {
  return fallback;
}

export default function RecoverPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isCapturer = params.get('type') === 'capturer';
  const role = isCapturer ? 'CAPTADOR' : 'BACKOFFICE';
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setLoading(true); setError('');
    try { await apiClient.post('/auth/recover-password/send-code', { email: email.trim(), rol: role }); setStep(2); }
    catch (err) { setError(message(err, 'No se pudo enviar el código.')); }
    finally { setLoading(false); }
  };
  const verifyCode = async () => {
    setLoading(true); setError('');
    try { await apiClient.post('/auth/recover-password/verify-code', { email: email.trim(), rol: role, code: code.trim() }); setStep(3); }
    catch (err) { setError(message(err, 'El código no es válido o expiró.')); }
    finally { setLoading(false); }
  };
  const resetPassword = async () => {
    if (password.trim().length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setLoading(true); setError('');
    try { await apiClient.post('/auth/recover-password/reset', { email: email.trim(), rol: role, code: code.trim(), newPassword: password }); navigate(`/login?type=${isCapturer ? 'capturer' : 'staff'}&reset=1`, { replace: true }); }
    catch (err) { setError(message(err, 'No se pudo restablecer la contraseña.')); }
    finally { setLoading(false); }
  };

  const card: React.CSSProperties = { width: 'min(440px, calc(100vw - 32px))', padding: 32, borderRadius: 16, background: '#fff', boxShadow: '0 20px 60px rgba(15, 45, 90, .18)' };
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 };
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'linear-gradient(135deg, #eaf3ff, #f8fbff)' }}><section style={card}>
    <button type="button" onClick={() => navigate(`/login?type=${isCapturer ? 'capturer' : 'staff'}`)} style={{ border: 0, background: 'transparent', padding: 0, color: '#0b5ee8', cursor: 'pointer' }}>← Volver al inicio de sesión</button>
    <p style={{ margin: '26px 0 6px', color: '#0b5ee8', fontSize: 12, fontWeight: 800, letterSpacing: '.08em' }}>RECUPERACIÓN DE ACCESO</p>
    <h1 style={{ margin: '0 0 10px', color: '#172741', fontSize: 25 }}>{step === 1 ? 'Recupera tu contraseña' : step === 2 ? 'Verifica tu código' : 'Crea una contraseña nueva'}</h1>
    <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>{step === 1 ? 'Te enviaremos un código de seis dígitos al correo asociado a tu cuenta.' : step === 2 ? `Ingresa el código que enviamos a ${email}.` : 'Usa al menos 6 caracteres y no repitas tu contraseña anterior.'}</p>
    {step === 1 && <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={input} />}
    {step === 2 && <input autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="000000" style={{ ...input, letterSpacing: 8, textAlign: 'center' }} />}
    {step === 3 && <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña" style={input} />}
    {error && <p style={{ color: '#b42318', fontSize: 13 }}>{error}</p>}
    <button type="button" disabled={loading || !email.trim() || (step === 2 && code.length !== 6)} onClick={step === 1 ? sendCode : step === 2 ? verifyCode : resetPassword} style={{ width: '100%', marginTop: 20, padding: 12, border: 0, borderRadius: 8, color: '#fff', background: '#0b5ee8', fontWeight: 700, cursor: 'pointer', opacity: loading ? .7 : 1 }}>{loading ? 'Procesando…' : step === 1 ? 'Enviar código' : step === 2 ? 'Verificar código' : 'Guardar nueva contraseña'}</button>
  </section></main>;
}
