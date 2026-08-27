import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as api from '@/api/capturers';
import { useAuth } from '@/context/AuthContext';
import type { CapturerStatus } from '@/types/capturer';

const PAGE_BG = 'linear-gradient(145deg, #07173e 0%, #0d286d 50%, #06143b 100%)';

function formatDateTime(d: Date): string {
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function CapturerStatusPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const statusQuery = useQuery({
    queryKey: ['capturer-status'],
    queryFn: api.getStatus,
    refetchInterval: (query) => (query.state.data?.estado === 'PENDIENTE' ? 15000 : false),
  });

  const estado: CapturerStatus | undefined = statusQuery.data?.estado;

  useEffect(() => {
    if (statusQuery.dataUpdatedAt) setLastChecked(new Date(statusQuery.dataUpdatedAt));
  }, [statusQuery.dataUpdatedAt]);

  // Si ya fue aprobado, llevar al panel automáticamente tras un instante.
  useEffect(() => {
    if (estado !== 'APROBADO') return;
    const t = window.setTimeout(() => navigate('/captador', { replace: true }), 2500);
    return () => window.clearTimeout(t);
  }, [estado, navigate]);

  async function goToLogin() {
    await logout();
    navigate('/login?type=capturer', { replace: true });
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: PAGE_BG,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'clamp(20px, 5vh, 56px) 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <style>{`@keyframes cap-status-pulse {0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.45)}50%{box-shadow:0 0 0 10px rgba(37,99,235,0)}}`}</style>

      <div
        style={{
          background: '#ffffff',
          borderRadius: 22,
          boxShadow: '0 30px 70px rgba(0, 15, 45, 0.35)',
          width: '100%',
          maxWidth: 560,
          padding: 'clamp(24px, 4.5vw, 40px)',
          boxSizing: 'border-box',
          margin: 'auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/assets/repuestop-logo.jpg" alt="RepuesTop" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        </div>

        {statusQuery.isLoading ? (
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>Cargando el estado de tu postulación…</p>
        ) : statusQuery.isError || !statusQuery.data ? (
          <ErrorState onRetry={() => statusQuery.refetch()} onLogin={goToLogin} />
        ) : estado === 'APROBADO' ? (
          <ApprovedState onEnter={() => navigate('/captador', { replace: true })} />
        ) : estado === 'RECHAZADO' ? (
          <RejectedState
            motivo={statusQuery.data.motivoRechazo}
            onReapply={() => navigate('/registro-captador')}
            onLogin={goToLogin}
          />
        ) : (
          <PendingState
            data={statusQuery.data}
            lastChecked={lastChecked}
            refreshing={statusQuery.isFetching}
            onRefresh={() => statusQuery.refetch()}
            onLogin={goToLogin}
          />
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Badge({ tone, children }: { tone: 'amber' | 'green' | 'red'; children: React.ReactNode }) {
  const map = {
    amber: { bg: '#fef3c7', fg: '#92400e' },
    green: { bg: '#dcfce7', fg: '#166534' },
    red: { bg: '#fee2e2', fg: '#991b1b' },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: map.bg, color: map.fg, padding: '4px 12px', borderRadius: 999 }}>
      {children}
    </span>
  );
}

function PendingState({
  data,
  lastChecked,
  refreshing,
  onRefresh,
  onLogin,
}: {
  data: { nombre: string; alias: string; rut: string; email: string; comuna: string; region: string; createdAt: string };
  lastChecked: Date;
  refreshing: boolean;
  onRefresh: () => void;
  onLogin: () => void;
}) {
  const steps = [
    { title: 'Postulación enviada', desc: 'Recibimos tus datos y documentos.', state: 'done' as const },
    { title: 'Revisión de antecedentes y documentos', desc: 'Nuestro equipo está validando la información entregada.', state: 'active' as const },
    { title: 'Cuenta activada', desc: 'Podrás ingresar a tu panel y empezar a captar.', state: 'pending' as const },
  ];

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            animation: 'cap-status-pulse 2.4s ease-in-out infinite',
          }}
        >
          <ClockIcon />
        </div>
        <Badge tone="amber">
          <Dot /> En revisión
        </Badge>
        <h1 style={{ margin: '12px 0 6px', fontSize: 'clamp(20px, 3vw, 25px)', fontWeight: 800, color: '#0f172a' }}>
          Estamos revisando tus documentos
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
          Tu postulación de captador quedó registrada. El equipo de RepuesTop revisará tus antecedentes y te avisará
          por correo cuando exista una resolución. Normalmente demora entre 1 y 3 días hábiles.
        </p>
      </div>

      <ol style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'grid', gap: 4 }}>
        {steps.map((step, i) => (
          <li key={step.title} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  background: step.state === 'done' ? '#16a34a' : step.state === 'active' ? '#2563eb' : '#e2e8f0',
                  color: step.state === 'pending' ? '#94a3b8' : '#ffffff',
                }}
              >
                {step.state === 'done' ? <CheckIcon /> : i + 1}
              </span>
              {i < steps.length - 1 && <span style={{ flex: 1, width: 2, minHeight: 22, background: step.state === 'done' ? '#16a34a' : '#e2e8f0', marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: step.state === 'pending' ? '#94a3b8' : '#0f172a' }}>
                {step.title}
                {step.state === 'active' && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 8px', borderRadius: 999 }}>
                    En curso
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, lineHeight: 1.45 }}>{step.desc}</div>
            </div>
          </li>
        ))}
      </ol>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'grid',
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#334151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Datos de tu postulación
        </div>
        <SummaryRow label="Nombre" value={data.nombre} />
        <SummaryRow label="Alias" value={`@${data.alias}`} />
        <SummaryRow label="RUT" value={data.rut} />
        <SummaryRow label="Correo" value={data.email} />
        <SummaryRow label="Zona" value={[data.comuna, data.region].filter(Boolean).join(', ') || '—'} />
        <SummaryRow label="Fecha de postulación" value={formatDate(data.createdAt)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: 12,
            background: refreshing ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
            color: '#ffffff',
            fontSize: 14.5,
            fontWeight: 700,
            cursor: refreshing ? 'not-allowed' : 'pointer',
          }}
        >
          {refreshing ? 'Actualizando…' : 'Actualizar estado'}
        </button>
        <button
          type="button"
          onClick={onLogin}
          style={{
            width: '100%',
            padding: '11px',
            border: '1.5px solid #cbd5e1',
            borderRadius: 12,
            background: '#ffffff',
            color: '#334151',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Volver al inicio de sesión
        </button>
        <p style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8', margin: '2px 0 0' }}>
          Última actualización: {formatDateTime(lastChecked)}
        </p>
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <strong style={{ color: '#0f172a', textAlign: 'right', wordBreak: 'break-word' }}>{value}</strong>
    </div>
  );
}

function RejectedState({ motivo, onReapply, onLogin }: { motivo?: string | null; onReapply: () => void; onLogin: () => void }) {
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <XIcon />
        </div>
        <Badge tone="red">Postulación rechazada</Badge>
        <h1 style={{ margin: '12px 0 6px', fontSize: 'clamp(20px, 3vw, 25px)', fontWeight: 800, color: '#0f172a' }}>
          Tu postulación no fue aprobada
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
          Puedes corregir lo observado y volver a postular cuando quieras.
        </p>
      </div>

      {motivo && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>Motivo informado por el equipo</div>
          <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>{motivo}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={onReapply}
          style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
        >
          Postular nuevamente
        </button>
        <button
          type="button"
          onClick={onLogin}
          style={{ width: '100%', padding: '11px', border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', color: '#334151', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
        >
          Volver al inicio de sesión
        </button>
      </div>
    </>
  );
}

function ApprovedState({ onEnter }: { onEnter: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <CheckIcon big />
      </div>
      <Badge tone="green">Cuenta activada</Badge>
      <h1 style={{ margin: '12px 0 6px', fontSize: 'clamp(20px, 3vw, 25px)', fontWeight: 800, color: '#0f172a' }}>
        ¡Tu cuenta de captador fue aprobada!
      </h1>
      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
        Ya puedes ingresar a tu panel para compartir tu código de referido y seguir tus comisiones. Te estamos
        redirigiendo…
      </p>
      <button
        type="button"
        onClick={onEnter}
        style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
      >
        Entrar a mi panel
      </button>
    </div>
  );
}

function ErrorState({ onRetry, onLogin }: { onRetry: () => void; onLogin: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ margin: '4px 0 6px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>No pudimos cargar tu estado</h1>
      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
        Revisa tu conexión e inténtalo nuevamente.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={onRetry} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 12, background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Reintentar
        </button>
        <button type="button" onClick={onLogin} style={{ width: '100%', padding: '11px', border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', color: '#334151', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- icons ------------------------------- */

function Dot() {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />;
}
function ClockIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function CheckIcon({ big = false }: { big?: boolean }) {
  const s = big ? 30 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={big ? 2 : 3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
