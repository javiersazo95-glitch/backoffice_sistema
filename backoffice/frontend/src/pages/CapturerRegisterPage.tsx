import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import apiClient from '@/api/client';
import { formatRut, validateRut } from '@/utils/rut';
import { formatChileanPhone, toInternationalChileanPhone } from '@/utils/phone';
import DocumentUploader, { DocumentUploadItem } from '@/components/capturer/DocumentUploader';
import { useAuth } from '@/context/AuthContext';

type Place = { id: string | number; nombre: string };

function registrationErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    if (typeof error.response?.data?.message === 'string') return error.response.data.message;
    if (!error.response) return 'No hubo respuesta del servidor. Revisa la conexión con el backend de dev e intenta nuevamente.';
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

interface CapturerFormState {
  nombre: string;
  rut: string;
  email: string;
  telefono: string;
  regionId: string;
  comunaId: string;
  alias: string;
  password: string;
  acceptsTerms: boolean;
}

export default function CapturerRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();

  // Si ya inició sesión como empleado del backoffice, advertir inmediatamente
  useEffect(() => {
    if (user && user.role !== 'CAPTADOR') {
      setError('Has iniciado sesión como parte del personal de RepuesTop. No está permitido registrarse como captador.');
    }
  }, [user]);

  // Estados de catálogo geográfico
  const [regions, setRegions] = useState<Place[]>([]);
  const [communes, setCommunes] = useState<Place[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  // Estados de formulario
  const [form, setForm] = useState<CapturerFormState>({
    nombre: '',
    rut: '',
    email: '',
    telefono: '',
    regionId: '',
    comunaId: '',
    alias: '',
    password: '',
    acceptsTerms: false,
  });

  // Documentos requeridos
  const [antecedentesDoc, setAntecedentesDoc] = useState<DocumentUploadItem>({ file: null, previewUrl: null });
  const [carnetFrenteDoc, setCarnetFrenteDoc] = useState<DocumentUploadItem>({ file: null, previewUrl: null });
  const [carnetReversoDoc, setCarnetReversoDoc] = useState<DocumentUploadItem>({ file: null, previewUrl: null });

  // Estados de interfaz y verificación
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(() => searchParams.get('email')?.trim().toLowerCase() || '');
  const [code, setCode] = useState('');
  const [localVerificationCode, setLocalVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Carga de catálogo de Regiones de Chile
  useEffect(() => {
    let isMounted = true;
    setLoadingGeo(true);
    apiClient
      .get<Array<{ id: string | number; nombre: string }>>('/geografia/paises')
      .then(async (r) => {
        const chile =
          r.data.find((p) => p.nombre.trim().toLowerCase() === 'chile') ??
          r.data.find((p) => String(p.id).toUpperCase() === 'CL');
        if (!chile) throw new Error('No se encontró Chile en el catálogo geográfico.');
        const regionsRes = await apiClient.get<Place[]>(`/geografia/paises/${chile.id}/regiones`);
        if (isMounted) {
          setRegions(regionsRes.data);
        }
      })
      .catch(() => {
        if (isMounted) setError('No se pudieron cargar las regiones de Chile. Intente recargar la página.');
      })
      .finally(() => {
        if (isMounted) setLoadingGeo(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Carga de catálogo de Comunas al cambiar Región
  useEffect(() => {
    setCommunes([]);
    setForm((f) => ({ ...f, comunaId: '' }));
    if (form.regionId) {
      apiClient
        .get<Place[]>(`/geografia/regiones/${form.regionId}/comunas`)
        .then((r) => setCommunes(r.data))
        .catch(() => setError('No se pudieron cargar las comunas para la región seleccionada.'));
    }
  }, [form.regionId]);

  // Manejo de cooldown para reenvío de código
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const update = (key: keyof CapturerFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Manejador del campo RUT con autocompletado en tiempo real
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRut(e.target.value);
    update('rut', formatted);
  };

  // Manejador del campo Teléfono con formato chileno en tiempo real
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatChileanPhone(e.target.value);
    update('telefono', formatted);
  };

  const isRutValid = form.rut.length >= 8 ? validateRut(form.rut) : null;

  // Contador de documentos listos
  const docsUploadedCount =
    (antecedentesDoc.file ? 1 : 0) +
    (carnetFrenteDoc.file ? 1 : 0) +
    (carnetReversoDoc.file ? 1 : 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validaciones previas
    if (!validateRut(form.rut)) {
      setError('El RUT ingresado no es válido. Verifica el número y dígito verificador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!form.regionId || !form.comunaId) {
      setError('Por favor selecciona tu Región y Comuna.');
      return;
    }

    if (!antecedentesDoc.file) {
      setError('Falta adjuntar el Certificado de Antecedentes en la Sección 3.');
      return;
    }

    if (!carnetFrenteDoc.file) {
      setError('Falta adjuntar el Carnet de Identidad (Lado Frontal) en la Sección 3.');
      return;
    }

    if (!carnetReversoDoc.file) {
      setError('Falta adjuntar el Carnet de Identidad (Lado Reverso) en la Sección 3.');
      return;
    }

    if (user && user.role !== 'CAPTADOR') {
      setError('Ya formas parte del equipo de RepuesTop. No está permitido ser empleado y captador a la vez.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!form.acceptsTerms) {
      setError('Debes aceptar los términos y condiciones para continuar.');
      return;
    }

    setBusy(true);
    try {
      const phonePayload = toInternationalChileanPhone(form.telefono);
      const payload = {
        ...form,
        telefono: phonePayload || form.telefono,
        regionId: Number(form.regionId),
        comunaId: Number(form.comunaId),
      };

      const requestData = new FormData();
      requestData.append('data', JSON.stringify(payload));
      requestData.append('antecedentes', antecedentesDoc.file);
      requestData.append('carnetFrente', carnetFrenteDoc.file);
      requestData.append('carnetReverso', carnetReversoDoc.file);

      const response = await apiClient.post<{
        verificationCode?: string;
        pendingEmailVerification?: boolean;
        emailSent?: boolean;
        existingAccount?: boolean;
        email?: string;
        message?: string;
      }>(
        '/auth/register/capturer',
        requestData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      if (response.data.pendingEmailVerification === false) {
        const email = response.data.email || form.email.trim().toLowerCase();
        // La postulación puede reutilizar una identidad Google. El formulario de
        // captador ya validó/definió su contraseña, por lo que abrimos su estado
        // de inmediato en vez de expulsarlo al login otra vez.
        try {
          await login(email, form.password, false, 'CAPTADOR');
          navigate('/captador/estado', { replace: true });
        } catch (loginError: unknown) {
          setError(`La postulación fue registrada, pero no pudimos abrir tu estado automáticamente. ${registrationErrorMessage(loginError, 'Ingresa al portal de captadores con la contraseña de tu postulación.')}`);
        }
        return;
      }
      setLocalVerificationCode(response.data.verificationCode || '');
      setPendingEmail(form.email.trim().toLowerCase());
      if (response.data.emailSent === false) {
        setError(response.data.message || 'La postulación se registró, pero no pudimos enviar el código de verificación.');
      }
    } catch (err: unknown) {
      setError(registrationErrorMessage(err, 'No se pudo completar el registro de postulación.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendCooldown > 0) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiClient.post<{ verificationCode?: string; emailSent?: boolean; message?: string }>('/auth/register/resend-code', {
        email: pendingEmail,
      });
      setLocalVerificationCode(response.data.verificationCode || '');
      setResendCooldown(60);
      if (response.data.emailSent === false) setError(response.data.message || 'No se pudo reenviar el código de verificación.');
    } catch (err: unknown) {
      setError(registrationErrorMessage(err, 'No se pudo reenviar el código de verificación.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/auth/register/verify-email', {
        email: pendingEmail,
        code: code.trim(),
      });
      // Inicia sesión automáticamente para mostrar la vista de estado de la postulación.
      try {
        await login(pendingEmail, form.password, false, 'CAPTADOR');
        navigate('/captador/estado', { replace: true });
      } catch {
        navigate('/login?type=capturer&verified=1', { replace: true });
      }
    } catch (err: unknown) {
      setError(registrationErrorMessage(err, 'Código de verificación inválido o vencido.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #07173e 0%, #0d286d 50%, #06143b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(20px, 4vw, 48px) 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Luces sutiles de fondo */}
      <div
        style={{
          position: 'fixed',
          top: '5%',
          left: '5%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '5%',
          right: '5%',
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 30px 70px rgba(0, 15, 45, 0.35), 0 0 1px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: pendingEmail ? 540 : 860,
          padding: 'clamp(24px, 4.5vw, 42px)',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
          margin: 'auto',
        }}
      >
        {/* Barra superior de navegación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => navigate('/login?type=capturer')}
            style={{
              border: 'none',
              background: '#f1f5f9',
              color: '#1e293b',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
          >
            <span>←</span> Volver al inicio de sesión
          </button>

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#2563eb',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '5px 12px',
              borderRadius: 99,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚡</span> Portal de Postulación
          </span>
        </div>

        {/* Encabezado principal */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/assets/repuestop-logo.jpg"
            alt="RepuesTop"
            style={{ height: 64, width: 'auto', objectFit: 'contain', marginBottom: 10 }}
          />
          <h1
            style={{
              margin: '6px 0 8px',
              fontSize: 'clamp(23px, 3.2vw, 30px)',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            {pendingEmail ? 'Verificación de Correo Electrónico' : 'Postula como Captador Oficial'}
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14.5, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.45 }}>
            {pendingEmail
              ? `Ingresa el código de 6 dígitos que enviamos a tu correo ${pendingEmail}`
              : 'Ingresa tus datos personales, ubicación y sube tus documentos oficiales para que el equipo valide y active tu cuenta.'}
          </p>
        </div>

        {/* Indicador de pasos */}
        {!pendingEmail && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              background: '#f8fafc',
              padding: '6px',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              marginBottom: 28,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Datos de Acceso</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0284c7', color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Contacto & Zona</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1d4ed8', color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e40af' }}>Documentos ({docsUploadedCount}/3)</span>
            </div>
          </div>
        )}

        {/* Alerta de Error Global */}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1.5px solid #fca5a5',
              borderRadius: 12,
              padding: '14px 16px',
              color: '#b91c1c',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: -2 }}>⚠️</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        {/* Estado: Verificación OTP */}
        {pendingEmail ? (
          <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {localVerificationCode && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: '#eff6ff',
                  border: '1px solid #93c5fd',
                  color: '#1e40af',
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Código de desarrollo local:</span>
                <strong style={{ fontSize: 18, letterSpacing: 3, background: '#dbeafe', padding: '3px 10px', borderRadius: 6, color: '#1d4ed8' }}>
                  {localVerificationCode}
                </strong>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#334151', marginBottom: 8 }}>
                Código de verificación (6 dígitos)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                maxLength={6}
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px',
                  border: '2px solid #cbd5e1',
                  borderRadius: 12,
                  fontSize: 24,
                  fontWeight: 800,
                  textAlign: 'center',
                  letterSpacing: '10px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={resend}
                disabled={busy || resendCooldown > 0}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: resendCooldown > 0 ? '#94a3b8' : '#2563eb',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  padding: 0,
                }}
              >
                {resendCooldown > 0
                  ? `Reenviar código en ${resendCooldown}s`
                  : '¿No recibiste el código? Reenviar'}
              </button>

              <button
                type="button"
                onClick={() => { setPendingEmail(''); setCode(''); }}
                style={{ border: 'none', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
              >
                Modificar correo
              </button>
            </div>

            <button
              type="submit"
              disabled={busy || code.length < 4}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: 12,
                background: busy || code.length < 4
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 700,
                cursor: busy || code.length < 4 ? 'not-allowed' : 'pointer',
                boxShadow: busy || code.length < 4 ? 'none' : '0 6px 18px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s',
              }}
            >
              {busy ? 'Verificando...' : 'Verificar y Finalizar'}
            </button>
          </form>
        ) : (
          /* State: Formulario de Registro */
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* SECCIÓN 1: Datos Personales y Acceso */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 18,
                padding: '22px 24px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
              }}
            >
              {/* Header Sección 1 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                  paddingBottom: 12,
                  borderBottom: '1.5px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: '#2563eb',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    1
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Datos Personales y Acceso
                    </h2>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Información básica para tu cuenta</span>
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 10px', borderRadius: 99 }}>
                  Paso 1 de 3
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Nombre completo */}
                <div>
                  <label style={fieldLabelStyle}>
                    Nombre completo <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => update('nombre', e.target.value)}
                    placeholder="Ej. Juan Pérez Soto"
                    required
                    style={fieldInputStyle}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                {/* RUT con autocompletado y formato en vivo */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={fieldLabelStyle}>
                      RUT <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {isRutValid !== null && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: isRutValid ? '#059669' : '#dc2626',
                          background: isRutValid ? '#d1fae5' : '#fee2e2',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {isRutValid ? '✓ RUT válido' : '✗ RUT inválido'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={form.rut}
                    onChange={handleRutChange}
                    placeholder="12.345.678-K"
                    required
                    maxLength={12}
                    style={{
                      ...fieldInputStyle,
                      borderColor:
                        isRutValid === true
                          ? '#10b981'
                          : isRutValid === false
                          ? '#f87171'
                          : '#cbd5e1',
                    }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                {/* Correo electrónico */}
                <div>
                  <label style={fieldLabelStyle}>
                    Correo electrónico <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="juan.perez@ejemplo.com"
                    required
                    autoComplete="email"
                    style={fieldInputStyle}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                {/* Contraseña */}
                <div>
                  <label style={fieldLabelStyle}>
                    Contraseña <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      style={{ ...fieldInputStyle, paddingRight: 40 }}
                      onFocus={inputFocus}
                      onBlur={inputBlur}
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

                {/* Alias público */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={fieldLabelStyle}>
                      Alias público <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Nombre visible en tus rankings y chats comerciales</span>
                  </div>
                  <input
                    type="text"
                    value={form.alias}
                    onChange={(e) => update('alias', e.target.value)}
                    placeholder="Ej. JuanRepuestosPro"
                    required
                    style={fieldInputStyle}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: Contacto y Localización Territorial */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 18,
                padding: '22px 24px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
              }}
            >
              {/* Header Sección 2 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                  paddingBottom: 12,
                  borderBottom: '1.5px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    2
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Contacto y Ubicación Territorial
                    </h2>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Datos geográficos y número móvil oficial</span>
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0284c7', background: '#f0f9ff', padding: '3px 10px', borderRadius: 99 }}>
                  Paso 2 de 3
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Teléfono con bandera chilena y prefijo +56 */}
                <div>
                  <label style={fieldLabelStyle}>
                    Teléfono celular <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
                    {/* Chile Flag & Prefix Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        borderRight: 'none',
                        borderTopLeftRadius: 10,
                        borderBottomLeftRadius: 10,
                        padding: '10px 12px',
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#0f172a',
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                    >
                      <ChileFlagIcon />
                      <span>+56</span>
                    </div>

                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={handlePhoneChange}
                      placeholder="9 1234 5678"
                      required
                      maxLength={11}
                      style={{
                        ...fieldInputStyle,
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        flex: 1,
                      }}
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                </div>

                {/* Región */}
                <div>
                  <label style={fieldLabelStyle}>
                    Región <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={form.regionId}
                    onChange={(e) => update('regionId', e.target.value)}
                    required
                    disabled={loadingGeo || regions.length === 0}
                    style={fieldSelectStyle}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  >
                    <option value="">
                      {loadingGeo ? 'Cargando regiones...' : 'Selecciona tu región'}
                    </option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Comuna */}
                <div>
                  <label style={fieldLabelStyle}>
                    Comuna <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={form.comunaId}
                    onChange={(e) => update('comunaId', e.target.value)}
                    required
                    disabled={!form.regionId || communes.length === 0}
                    style={{
                      ...fieldSelectStyle,
                      background: !form.regionId ? '#f1f5f9' : '#ffffff',
                      cursor: !form.regionId ? 'not-allowed' : 'pointer',
                    }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  >
                    <option value="">
                      {!form.regionId ? 'Primero elige una región' : 'Selecciona tu comuna'}
                    </option>
                    {communes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: Documentación de Verificación (REMARCADA Y ELEGANTE) */}
            <div
              style={{
                background: '#f8fafc',
                border: '2px solid #cbd5e1',
                borderRadius: 20,
                padding: '24px 26px',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
                position: 'relative',
              }}
            >
              {/* Banner Encabezado Destacado de Sección 3 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: '1.5px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                    }}
                  >
                    🛡️
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                        Sección 3: Documentos Obligatorios de Verificación
                      </h2>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#475569' }}>
                      Requeridos por normativa comercial para la habilitación de tu cuenta
                    </p>
                  </div>
                </div>

                {/* Badge de Progreso de Documentos */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 12,
                    padding: '6px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                    Progreso: <strong>{docsUploadedCount} de 3</strong> subidos
                  </span>
                  <div style={{ width: 48, height: 7, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(docsUploadedCount / 3) * 100}%`,
                        height: '100%',
                        background: docsUploadedCount === 3 ? '#10b981' : '#2563eb',
                        borderRadius: 99,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Caja Explicativa de Requisitos */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: 20,
                  fontSize: 12.5,
                  color: '#334151',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontSize: 16, marginTop: -1 }}>ℹ️</span>
                <div>
                  <strong>Instrucciones de carga:</strong> Asegúrate de que las fotos o documentos sean legibles, sin reflejos ni cortes. Los archivos son confidenciales y se almacenan de manera segura bajo encriptación.
                </div>
              </div>

              {/* Lista de Documentos Separados en Tarjetas Individuales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Documento 1: Certificado de Antecedentes */}
                <div>
                  <DocumentUploader
                    id="doc-antecedentes"
                    stepNumber="3.1"
                    badgeText="Documento Legal"
                    title="Certificado de Antecedentes"
                    subtitle="Certificado oficial para fines especiales emitido por el Servicio de Registro Civil e Identificación de Chile."
                    recommendationText="Debe contar con código de verificación o vigencia no mayor a 60 días."
                    icon="certificate"
                    value={antecedentesDoc}
                    onChange={setAntecedentesDoc}
                    required
                    accentColor="#4f46e5"
                    headerBg="#f5f3ff"
                  />
                </div>

                {/* Separador de Cédula de Identidad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                  <div style={{ height: 1, background: '#cbd5e1', flex: 1 }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#334151', background: '#e2e8f0', padding: '3px 12px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🪪 Cédula de Identidad (Ambos Lados)
                  </span>
                  <div style={{ height: 1, background: '#cbd5e1', flex: 1 }} />
                </div>

                {/* Documentos 2 y 3: Carnet Frente y Reverso claramente diferenciados */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 18,
                  }}
                >
                  {/* Carnet Frente */}
                  <DocumentUploader
                    id="doc-carnet-frente"
                    stepNumber="3.2"
                    badgeText="Lado Frontal"
                    title="Cédula - Frente"
                    subtitle="Fotografía o escaneo nítido del frente de tu cédula chilena vigente."
                    recommendationText="Debe verse claramente tu fotografía, nombre y RUT."
                    icon="id-front"
                    value={carnetFrenteDoc}
                    onChange={setCarnetFrenteDoc}
                    required
                    accentColor="#0284c7"
                    headerBg="#f0f9ff"
                  />

                  {/* Carnet Reverso */}
                  <DocumentUploader
                    id="doc-carnet-reverso"
                    stepNumber="3.3"
                    badgeText="Lado Posterior"
                    title="Cédula - Reverso"
                    subtitle="Fotografía o escaneo nítido del reverso de tu cédula chilena vigente."
                    recommendationText="Debe verse el código de barras, huella y firma."
                    icon="id-back"
                    value={carnetReversoDoc}
                    onChange={setCarnetReversoDoc}
                    required
                    accentColor="#0284c7"
                    headerBg="#f0f9ff"
                  />
                </div>
              </div>
            </div>

            {/* Términos y condiciones */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '16px 18px',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: 14,
              }}
            >
              <input
                type="checkbox"
                id="terms"
                checked={form.acceptsTerms}
                onChange={(e) => update('acceptsTerms', e.target.checked)}
                required
                style={{ width: 20, height: 20, accentColor: '#2563eb', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
              />
              <label htmlFor="terms" style={{ fontSize: 13.5, color: '#334151', cursor: 'pointer', lineHeight: 1.5 }}>
                Acepto los <strong style={{ color: '#0f172a' }}>términos y condiciones del programa de captadores</strong> y declaro bajo juramento que los antecedentes y documentos suministrados son fidedignos para la revisión de mi postulación.
              </label>
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '16px',
                border: 'none',
                borderRadius: 14,
                background: busy
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: 16.5,
                fontWeight: 800,
                cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: busy ? 'none' : '0 8px 24px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {busy ? (
                <>
                  <SpinnerIcon />
                  <span>Procesando y enviando postulación...</span>
                </>
              ) : (
                <>
                  <span>Enviar Postulación de Captador</span>
                  <span style={{ fontSize: 20 }}>→</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

// Estilos compartidos de inputs
const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#334151',
  marginBottom: 6,
};

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  border: '1.5px solid #cbd5e1',
  borderRadius: 10,
  fontSize: 14,
  color: '#0f172a',
  background: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const fieldSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  border: '1.5px solid #cbd5e1',
  borderRadius: 10,
  fontSize: 14,
  color: '#0f172a',
  background: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box',
  cursor: 'pointer',
  transition: 'border-color 0.2s',
};

function inputFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#2563eb';
}

function inputBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#cbd5e1';
}

// Íconos SVG auxiliares
function ChileFlagIcon() {
  return (
    <svg width="20" height="15" viewBox="0 0 600 400" style={{ borderRadius: 2, display: 'block', flexShrink: 0, boxShadow: '0 0 2px rgba(0,0,0,0.2)' }}>
      {/* Red bottom stripe */}
      <rect width="600" height="200" y="200" fill="#D52B1E" />
      {/* White top stripe */}
      <rect width="600" height="200" fill="#FFFFFF" />
      {/* Blue canton */}
      <rect width="200" height="200" fill="#0039A6" />
      {/* White 5-pointed star */}
      <polygon
        points="100,45 116,92 165,92 125,121 140,168 100,139 60,168 75,121 35,92 84,92"
        fill="#FFFFFF"
      />
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
