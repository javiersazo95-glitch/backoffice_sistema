import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '@/api/client';

export default function ActivateEmployeePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmation) return setError('Las contraseñas no coinciden.');
    setSaving(true);
    try {
      await apiClient.post('/auth/backoffice/activate', { email, code, newPassword: password });
      navigate('/login?activated=1', { replace: true });
    } catch {
      // Mensaje fijo: esta pantalla se alcanza sin sesion y el detalle del servidor permitiria
      // distinguir "ese correo no tiene invitacion" de "el codigo no es correcto", que es
      // justo lo que necesita quien recorre el espacio de codigos de seis digitos.
      setError('No se pudo activar la cuenta. Revisa el enlace e inténtalo nuevamente.');
    } finally { setSaving(false); }
  };

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f1f5f9' }}>
    <form onSubmit={activate} style={{ width: 'min(100%, 420px)', background: '#fff', padding: 30, borderRadius: 14, boxShadow: '0 12px 35px #0f172a18' }}>
      <h1 style={{ margin: '0 0 8px', color: '#0f172a' }}>Activa tu cuenta</h1>
      <p style={{ margin: '0 0 22px', color: '#64748b' }}>Define tu contraseña para ingresar al Backoffice de RepuesTop.</p>
      <label style={label}>Correo<input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label style={label}>Código de invitación<input style={input} value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" maxLength={6} required /></label>
      <label style={label}>Nueva contraseña<input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required /></label>
      <label style={label}>Confirma contraseña<input style={input} type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={8} required /></label>
      {error && <p style={{ color: '#b42318', fontSize: 14 }}>{error}</p>}
      <button disabled={saving} style={{ width: '100%', padding: 12, border: 0, borderRadius: 8, color: '#fff', background: '#0b5ee8', fontWeight: 700 }}>{saving ? 'Activando…' : 'Activar cuenta'}</button>
    </form>
  </main>;
}
const label: React.CSSProperties = { display: 'grid', gap: 6, marginBottom: 14, color: '#334155', fontSize: 14, fontWeight: 600 };
const input: React.CSSProperties = { padding: 10, borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 15 };
