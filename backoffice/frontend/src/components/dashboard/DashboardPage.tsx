import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as mediationsApi from '@/api/mediations';
import * as reportsApi from '@/api/reports';
import * as validationsApi from '@/api/validations';
import { useDashboardSummary } from '@/hooks/useDashboard';
import Badge from '@/components/shared/Badge';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import UiIcon from '@/components/shared/UiIcon';
import { MediationStatus } from '@/types/mediation';
import { formatCurrency, formatDate, formatDateTime, mediationStatusDisplay, trustLevelToSpanish } from '@/utils/formatters';
import type { MediationResponse } from '@/types/mediation';
import type { ReportResponse } from '@/types/report';
import type { ValidationResponse } from '@/types/validation';

const PAGE_SIZE = 5;

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function trustTone(score: number) {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('es-CL').format(value);
}

function parseAgeDays(item: { createdAt: string; elapsed?: string }) {
  const createdAtMs = Date.parse(item.createdAt);
  if (!Number.isNaN(createdAtMs)) {
    return Math.max(0, Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)));
  }
  const elapsed = item.elapsed?.toLowerCase() ?? '';
  const match = elapsed.match(/(\d+)\s*(?:d|día|dias|dias habiles|días|days)/);
  if (match) return Number(match[1]);
  return 0;
}

function escalationTone(days: number) {
  if (days >= 5) return 'red';
  if (days >= 2) return 'amber';
  return 'blue';
}

function escalationLevel(days: number) {
  if (days >= 5) return 'Crítica';
  if (days >= 2) return 'Alta';
  return 'Media';
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();
  const [expandedPanels, setExpandedPanels] = useState({
    mediations: false,
    alerts: false,
    validations: false,
    receipts: false,
  });

  const togglePanel = (panel: keyof typeof expandedPanels) => {
    setExpandedPanels((current) => ({ ...current, [panel]: !current[panel] }));
  };

  // Minimal queries just for hero KPI totals
  const { data: mediationsTotalData } = useQuery({
    queryKey: ['dashboard-mediations-total'],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.EN_MEDIACION, page: 0, size: 1 }),
  });
  const { data: reportsTotalData } = useQuery({
    queryKey: ['dashboard-reports-total'],
    queryFn: () => reportsApi.getReports({ page: 0, size: 1 }),
  });

  const trustScore = data?.trustScore ?? 0;
  const currentTrustTone = trustTone(trustScore);
  const trustLevel = trustLevelToSpanish(data?.trustLevel ?? 'MEDIO');
  const validationTotal = (data?.validationsApproved ?? 0) + (data?.validationsPending ?? 0) + (data?.validationsRejected ?? 0);


  const escalatedCount = data?.unansweredClaims ?? 0;
  const inMediationCount = mediationsTotalData?.totalElements ?? 0;
  const reportsCount = reportsTotalData?.totalElements ?? 0;

  return (
    <>
      <section className={`trust-command-hero tone-${currentTrustTone}`}>
        <div className="trust-command-copy">
          <span className="trust-hero-eyebrow">
            <UiIcon name="scale" />
            Mediacion y confianza
          </span>
          <h1>Estado operativo</h1>

          {isLoading ? (
            <p>Cargando datos...</p>
          ) : (
            <div className="trust-hero-kpis" aria-label="Indicadores principales">
              <div className="trust-hero-kpi">
                <span className="trust-hero-kpi-icon"><UiIcon name="clock" /></span>
                <div><span>Esperando al vendedor</span><strong>{compactNumber(escalatedCount)}</strong></div>
              </div>
              <div className="trust-hero-kpi">
                <span className="trust-hero-kpi-icon"><UiIcon name="scale" /></span>
                <div><span>En mediación</span><strong>{compactNumber(inMediationCount)}</strong></div>
              </div>
              <div className="trust-hero-kpi">
                <span className="trust-hero-kpi-icon"><UiIcon name="flag" /></span>
                <div><span>Reportes</span><strong>{compactNumber(reportsCount)}</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className="trust-command-actions">
          <AreaHomeShortcut />
          <div className="trust-command-score" aria-label={`Nivel de confianza ${trustScore}%`}>
            <div className="trust-score-orbit" style={{ background: `conic-gradient(var(--tone) 0 ${trustScore}%, rgba(37,99,235,.08) ${trustScore}% 100%)` }}>
              <div className="trust-score-core">
                <strong>{trustScore}%</strong>
              </div>
            </div>
            <div className="trust-score-summary">
              <span className="trust-score-summary-icon"><UiIcon name="scale" /></span>
              <strong>Confianza {trustLevel}</strong>
              <Badge text={`Nivel ${trustLevel}`} variant={data?.trustLevel ?? 'MEDIO'} />
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="trust-loading">
          <UiIcon name="clock" />
          Cargando resumen de mediacion y confianza...
        </div>
      ) : (
        <>
          <section className="trust-dashboard-grid">
            <TrustPulsePanel
              trustScore={trustScore}
              trustLevel={trustLevel}
              validationTotal={validationTotal}
              corrections={data?.validationsCorrection ?? 0}
              pending={data?.validationsPending ?? 0}
              rejected={data?.validationsRejected ?? 0}
              openMediations={data?.openMediations ?? 0}
              pendingValidation={data?.pendingValidation ?? 0}
              criticalAlerts={data?.criticalAlerts ?? 0}
              expiringDocuments={data?.expiringDocuments ?? 0}
              sellerRisks={data?.sellerRisks ?? 0}
              unansweredClaims={data?.unansweredClaims ?? 0}
            />
          </section>

          <section className="trust-mini-grid">
            <MediationsPanel expanded={expandedPanels.mediations} onToggle={() => togglePanel('mediations')} />
            <EscalationsPanel expanded={expandedPanels.alerts} onToggle={() => togglePanel('alerts')} />
          </section>

          <section className="trust-mini-grid">
            <ValidationsPanel expanded={expandedPanels.validations} onToggle={() => togglePanel('validations')} />
            <ReceiptsPanel expanded={expandedPanels.receipts} onToggle={() => togglePanel('receipts')} />
          </section>
        </>
      )}
    </>
  );
}

// ─── Pagination control ───────────────────────────────────────────────────────

function PanelPagination({ page, totalPages, onPrev, onNext }: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="trust-panel-pagination">
      <button type="button" onClick={onPrev} disabled={page === 0} className="trust-page-btn">
        <UiIcon name="arrowLeft" />
      </button>
      <span>Página {page + 1} de {totalPages}</span>
      <button type="button" onClick={onNext} disabled={page >= totalPages - 1} className="trust-page-btn">
        <UiIcon name="arrowRight" />
      </button>
    </div>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────────────

function MediationsPanel({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [page, setPage] = useState(0);

  const { data: totalData } = useQuery({
    queryKey: ['dashboard-mediations-panel-total'],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.EN_MEDIACION, page: 0, size: 1 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-mediations-panel', page],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.EN_MEDIACION, page, size: PAGE_SIZE }),
    enabled: expanded,
  });

  const items: MediationResponse[] = data?.content ?? [];
  const total = totalData?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Mediaciones"
        title="Casos en mediación"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${total} activos`} variant="EN_MEDIACION" />}
      />
      {expanded && (
        <>
          <div className="trust-feed">
            {isLoading && <EmptyState text="Actualizando mediaciones..." />}
            {!isLoading && items.length === 0 && <EmptyState text="No hay casos activos en mediación." />}
            {!isLoading && items.map((item) => (
              <div className="trust-feed-item" key={item.id}>
                <span className="trust-feed-icon violet"><UiIcon name="scale" /></span>
                <div className="trust-feed-copy">
                  <strong>{item.externalId} · Pedido {item.orderId}</strong>
                  <span>{item.reason || item.title}</span>
                  <small>Vendedor: {item.sellerName}</small>
                  <small>Texto de inicio: {item.escalationReason || item.nextAction || 'Sin texto registrado'}</small>
                  <small>Días hábiles transcurridos: {item.elapsed || 'Sin dato disponible'}</small>
                </div>
                <div className="trust-feed-side">
                  <Badge text={mediationStatusDisplay(item.status, false)} variant={item.status} />
                  <b>{formatCurrency(item.amount)}</b>
                </div>
              </div>
            ))}
          </div>
          <PanelPagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </>
      )}
    </article>
  );
}

function EscalationsPanel({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [page, setPage] = useState(0);

  const { data: totalData } = useQuery({
    queryKey: ['dashboard-escalations-panel-total'],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.ESPERANDO_VENDEDOR, page: 0, size: 1 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-escalations-panel', page],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.ESPERANDO_VENDEDOR, page, size: PAGE_SIZE }),
    enabled: expanded,
  });

  const items: MediationResponse[] = (data?.content ?? [])
    .filter((item) => !item.accountBlocked)
    .sort((a, b) => parseAgeDays(b) - parseAgeDays(a));
  const total = totalData?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Seguimiento"
        title="Últimos esperando al vendedor"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${total} casos`} variant="ESPERANDO_VENDEDOR" />}
      />
      {expanded && (
        <>
          <div className="trust-feed">
            {isLoading && <EmptyState text="Actualizando casos esperando al vendedor..." />}
            {!isLoading && items.length === 0 && <EmptyState text="Sin casos esperando al vendedor." />}
            {!isLoading && items.map((item) => {
              const ageDays = parseAgeDays(item);
              const tone = escalationTone(ageDays);
              const level = escalationLevel(ageDays);
              return (
                <div className="trust-feed-item" key={item.id}>
                  <span className={`trust-feed-icon ${tone}`}>
                    <UiIcon name={tone === 'red' ? 'alert' : 'clock'} />
                  </span>
                  <div className="trust-feed-copy">
                    <strong>{item.externalId} · {item.sellerName}</strong>
                    <span>{item.reason || item.title}</span>
                    <small>Esperando hace {ageDays} d · {item.elapsed || 'sin antigüedad calculada'}</small>
                    <small>Última actualización: {formatDateTime(item.updatedAt)}</small>
                  </div>
                  <div className="trust-feed-side">
                    <Badge text={level} variant={tone === 'red' ? 'RECHAZADO' : tone === 'amber' ? 'PENDIENTE' : 'APROBADO'} />
                    <Badge text={item.status} variant={item.status} />
                  </div>
                </div>
              );
            })}
          </div>
          <PanelPagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </>
      )}
    </article>
  );
}

function ValidationsPanel({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [page, setPage] = useState(0);

  const { data: totalData } = useQuery({
    queryKey: ['dashboard-validations-panel-total'],
    queryFn: () => validationsApi.getValidations(0, PAGE_SIZE),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-validations-panel', page],
    queryFn: () => validationsApi.getValidations(page, PAGE_SIZE),
    enabled: expanded,
  });

  const allItems: ValidationResponse[] = data?.content ?? [];
  const items = allItems.filter((item) => item.status === 'RECHAZADA' || item.status === 'POR_CORREGIR');
  const totalFiltered = (totalData?.content ?? []).filter((item: ValidationResponse) => item.status === 'RECHAZADA' || item.status === 'POR_CORREGIR').length;
  const total = data ? items.length : totalFiltered;
  const totalPages = data?.totalPages ?? 0;

  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Documentacion"
        title="Validaciones recientes"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${total} observaciones`} variant="RECHAZADO" />}
      />
      {expanded && (
        <>
          <div className="trust-document-list">
            {isLoading && <EmptyState text="Actualizando validaciones..." />}
            {!isLoading && items.length === 0 && <EmptyState text="Sin validaciones rechazadas ni por corregir." />}
            {!isLoading && items.map((item) => {
              const isRejected = item.status === 'RECHAZADA';
              const isCorrection = item.status === 'POR_CORREGIR';

              let badgeText = 'Rechazado';
              let badgeVariant = 'RECHAZADO';
              let iconClass = 'rejected';
              let customIcon = <RejectedIcon />;

              if (isCorrection) {
                badgeText = 'Por corregir';
                badgeVariant = 'PENDIENTE';
                iconClass = 'correction';
                customIcon = <CorrectionIcon />;
              } else if (!isRejected) {
                badgeText = 'Aceptado';
                badgeVariant = 'APROBADO';
                iconClass = 'approved';
                customIcon = <ApprovedIcon />;
              }

              return (
                <div className={`trust-document-row state-${iconClass}`} key={item.id}>
                  <span className={`trust-document-icon ${iconClass}`}>{customIcon}</span>
                  <div className="trust-document-copy">
                    <strong>{item.documentType}</strong>
                    <span>{item.sellerName}</span>
                    <small>Responsable: {item.owner || 'Sin responsable'} · Subido: {formatDate(item.uploadedAt)}</small>
                    <small>Vence {formatDate(item.dueAt)}</small>
                    {item.notes && <small>{item.notes}</small>}
                  </div>
                  <Badge text={badgeText} variant={badgeVariant} />
                </div>
              );
            })}
          </div>
          <PanelPagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </>
      )}
    </article>
  );
}

function ReceiptsPanel({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [page, setPage] = useState(0);

  const { data: totalData } = useQuery({
    queryKey: ['dashboard-reports-panel-total'],
    queryFn: () => reportsApi.getReports({ page: 0, size: 1 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-reports-panel', page],
    queryFn: () => reportsApi.getReports({ page, size: PAGE_SIZE }),
    enabled: expanded,
  });

  const items = (data?.content ?? []) as unknown as ReportResponse[];
  const total = totalData?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Confianza"
        title="Reportes recientes"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${total} en total`} variant="PENDIENTE" />}
      />
      {expanded && (
        <>
          <div className="trust-receipt-list">
            {isLoading && <EmptyState text="Actualizando reportes..." />}
            {!isLoading && items.length === 0 && <EmptyState text="Sin reportes." />}
            {!isLoading && items.map((item) => (
              <div className="trust-receipt-row" key={item.id}>
                <div>
                  <strong>{item.idExterno || `REP-${item.id}`}</strong>
                  <span>Reportante: {item.reportanteName} ({item.reportanteType})</span>
                  <small>Reportado: {item.reportadoName} ({item.reportadoType})</small>
                </div>
                <div>
                  <b>{item.motivo}</b>
                  <Badge text="REPORTE" variant="RECHAZADA" />
                </div>
              </div>
            ))}
          </div>
          <PanelPagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </>
      )}
    </article>
  );
}

// ─── TrustPulsePanel ─────────────────────────────────────────────────────────

function TrustPulsePanel({
  trustScore, trustLevel, validationTotal, corrections, pending, rejected,
  openMediations, pendingValidation, criticalAlerts, expiringDocuments, sellerRisks, unansweredClaims,
}: {
  trustScore: number; trustLevel: string; validationTotal: number;
  corrections: number; pending: number; rejected: number;
  openMediations: number; pendingValidation: number; criticalAlerts: number;
  expiringDocuments: number; sellerRisks: number; unansweredClaims: number;
}) {
  const tone = trustTone(trustScore);
  return (
    <article className="trust-panel trust-panel-large">
      <div className="trust-panel-head">
        <div><span>Estado general</span><h2>Pulso operativo</h2></div>
        <div className="trust-panel-actions">
          <Badge text={`Confianza ${trustLevel}`} variant={tone} />
        </div>
      </div>
      <div className="trust-pulse-body">
        <div className={`trust-pulse-score tone-${tone}`}>
          <div className="trust-score-orbit" style={{ background: `conic-gradient(var(--tone) 0 ${trustScore}%, #e9eef6 ${trustScore}% 100%)` }}>
            <div className="trust-score-core">
              <strong>{trustScore}%</strong>
              <span>Indice global</span>
            </div>
          </div>
          <PressureSummary openMediations={openMediations} pendingValidation={pendingValidation} criticalAlerts={criticalAlerts} />
        </div>
        <div className="trust-progress-list">
          <ProgressRow label="Solicitudes de corrección" value={corrections} total={validationTotal} tone="yellow" />
          <ProgressRow label="Validaciones pendientes" value={pending} total={validationTotal} tone="amber" />
          <ProgressRow label="Rechazos documentales" value={rejected} total={validationTotal} tone="red" />
<div className="trust-cycle-strip" aria-label="Flujo de mediación">
            <span>Esperando al vendedor ({unansweredClaims})</span>
            <UiIcon name="arrowRight" />
            <span>En mediación</span>
            <UiIcon name="arrowRight" />
            <span>Resuelta o cuenta bloqueada</span>
          </div>
          <PulseNote
            expiringDocuments={expiringDocuments}
            unansweredClaims={unansweredClaims}
            sellerRisks={sellerRisks}
          />
        </div>
      </div>
    </article>
  );
}

function PressureSummary({ openMediations, pendingValidation, criticalAlerts }: {
  openMediations: number;
  pendingValidation: number;
  criticalAlerts: number;
}) {
  const parts: string[] = [];
  if (openMediations > 0) parts.push(`${openMediations} mediación${openMediations > 1 ? 'es' : ''} abierta${openMediations > 1 ? 's' : ''}`);
  if (pendingValidation > 0) parts.push(`${pendingValidation} validación${pendingValidation > 1 ? 'es' : ''} pendiente${pendingValidation > 1 ? 's' : ''}`);
  if (criticalAlerts > 0) parts.push(`${criticalAlerts} alerta${criticalAlerts > 1 ? 's' : ''} crítica${criticalAlerts > 1 ? 's' : ''}`);

  if (parts.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Sin elementos pendientes de atención.</p>;
  }

  const text = parts.length === 1
    ? parts[0]
    : parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];

  return (
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
      Hay <strong style={{ color: 'var(--ink)' }}>{text}</strong> que requieren atención operativa.
    </p>
  );
}

function PulseNote({ expiringDocuments, unansweredClaims, sellerRisks }: {
  expiringDocuments: number;
  unansweredClaims: number;
  sellerRisks: number;
}) {
  const parts: { icon: string; text: string; tone: 'ok' | 'warn' | 'alert' }[] = [];

  if (expiringDocuments > 0) {
    parts.push({ icon: 'calendar', text: `${expiringDocuments} documento${expiringDocuments > 1 ? 's' : ''} próximo${expiringDocuments > 1 ? 's' : ''} a vencer — requiere revisión urgente.`, tone: 'alert' });
  } else {
    parts.push({ icon: 'calendar', text: 'Sin documentos próximos a vencer.', tone: 'ok' });
  }

  if (unansweredClaims > 0) {
    parts.push({ icon: 'clock', text: `${unansweredClaims} reclamo${unansweredClaims > 1 ? 's' : ''} sin respuesta del vendedor.`, tone: unansweredClaims >= 5 ? 'alert' : 'warn' });
  }

  if (sellerRisks > 0) {
    parts.push({ icon: 'alert', text: `${sellerRisks} alerta${sellerRisks > 1 ? 's' : ''} de riesgo sin revisar.`, tone: 'alert' });
  }

  const toneColor = { ok: 'var(--green, #059669)', warn: 'var(--amber, #d97706)', alert: '#dc2626' };

  return (
    <div className="trust-pulse-note-list">
      {parts.map((p, i) => (
        <div key={i} className="trust-pulse-note" style={{ borderLeftColor: toneColor[p.tone] }}>
          <UiIcon name={p.icon} style={{ color: toneColor[p.tone], flexShrink: 0 }} />
          <span style={{ color: p.tone === 'ok' ? 'var(--text-secondary)' : toneColor[p.tone] }}>{p.text}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const width = percent(value, total);
  return (
    <div className={`trust-progress-row tone-${tone}`}>
      <div><span>{label}</span><strong>{compactNumber(value)}</strong></div>
      <div className="trust-progress-track"><span style={{ width: `${width}%` }} /></div>
      <small>{width}%</small>
    </div>
  );
}

// ─── Shared panel header ──────────────────────────────────────────────────────

function CollapsiblePanelHead({ eyebrow, title, action, expanded, onToggle }: {
  eyebrow: string; title: string; action: ReactNode; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="trust-panel-head">
      <div><span>{eyebrow}</span><h2>{title}</h2></div>
      <div className="trust-panel-actions">
        {action}
        <button
          className={`trust-panel-toggle ${expanded ? 'open' : ''}`}
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Ocultar' : 'Mostrar'} ${title}`}
          onClick={onToggle}
        >
          <UiIcon name="chevronDown" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="trust-empty-state">
      <UiIcon name="clock" />
      <span>{text}</span>
    </div>
  );
}

// ─── Validation icons ─────────────────────────────────────────────────────────

function ApprovedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" className="premium-svg">
      <defs>
        <linearGradient id="approveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <filter id="approveShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#059669" floodOpacity="0.3" />
        </filter>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#approveGrad)" filter="url(#approveShadow)" />
      <circle cx="12" cy="12" r="8.5" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
      <path d="m8.5 12.5 2.5 2.5 5-5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RejectedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" className="premium-svg">
      <defs>
        <linearGradient id="rejectGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f87171" /><stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <filter id="rejectShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#dc2626" floodOpacity="0.3" />
        </filter>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#rejectGrad)" filter="url(#rejectShadow)" />
      <circle cx="12" cy="12" r="8.5" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
      <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CorrectionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" className="premium-svg">
      <defs>
        <linearGradient id="correctionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="correctionShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#d97706" floodOpacity="0.3" />
        </filter>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#correctionGrad)" filter="url(#correctionShadow)" />
      <circle cx="12" cy="12" r="8.5" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
      <path d="M15.5 6.5l2 2-7.5 7.5H8v-2l7.5-7.5z" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 7.5l2 2" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
