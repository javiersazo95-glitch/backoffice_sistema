import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as mediationsApi from '@/api/mediations';
import * as receiptsApi from '@/api/receipts';
import * as validationsApi from '@/api/validations';
import { useDashboardSummary } from '@/hooks/useDashboard';
import Badge from '@/components/shared/Badge';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import UiIcon from '@/components/shared/UiIcon';
import { MediationStatus } from '@/types/mediation';
import { formatCurrency, formatDate, formatDateTime, mediationStatusDisplay, trustLevelToSpanish } from '@/utils/formatters';
import type { MediationResponse } from '@/types/mediation';
import type { ReceiptFollowupResponse } from '@/types/receipt';
import type { ValidationResponse } from '@/types/validation';

const PREVIEW_SIZE = 5;

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

  const { data: mediationsData, isLoading: isLoadingMediations } = useQuery({
    queryKey: ['dashboard-mediations-preview'],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.EN_MEDIACION, page: 0, size: PREVIEW_SIZE }),
  });

  const { data: escalationsData, isLoading: isLoadingEscalations } = useQuery({
    queryKey: ['dashboard-escalations-preview'],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.ESPERANDO_VENDEDOR, page: 0, size: PREVIEW_SIZE }),
  });

  const { data: validationsData, isLoading: isLoadingValidations } = useQuery({
    queryKey: ['dashboard-validations-preview'],
    queryFn: () => validationsApi.getValidations(0, 50),
  });

  const { data: receiptsData, isLoading: isLoadingReceipts } = useQuery({
    queryKey: ['dashboard-receipts-preview'],
    queryFn: () => receiptsApi.getReceipts(0, PREVIEW_SIZE),
  });

  const trustScore = data?.trustScore ?? 0;
  const currentTrustTone = trustTone(trustScore);
  const trustLevel = trustLevelToSpanish(data?.trustLevel ?? 'MEDIO');
  const validationTotal = (data?.validationsApproved ?? 0) + (data?.validationsPending ?? 0) + (data?.validationsRejected ?? 0);
  const pressureCount = (data?.openMediations ?? 0) + (data?.pendingValidation ?? 0) + (data?.receiptFollowups ?? 0);

  const mediations = mediationsData?.content ?? [];
  const escalations = escalationsData?.content ?? [];
  const validations = validationsData?.content ?? [];
  const receipts = receiptsData?.content ?? [];
  const escalatedCount = escalationsData?.totalElements ?? 0;
  const inMediationCount = mediationsData?.totalElements ?? 0;
  const reviewedDocsCount = (data?.validationsApproved ?? 0) + (data?.validationsRejected ?? 0);
  const pendingDocsCount = data?.validationsPending ?? 0;
  const activeSellers = data?.activeSellers ?? 0;
  const openMediations = data?.openMediations ?? 0;
  const criticalAlerts = data?.criticalAlerts ?? 0;
  const operationalSummary = `${compactNumber(activeSellers)} vendedores activos, ${compactNumber(openMediations)} casos abiertos y ${compactNumber(criticalAlerts)} alertas críticas requieren seguimiento operativo.`;

  const hasPreviewLoading = isLoadingMediations || isLoadingEscalations || isLoadingValidations || isLoadingReceipts;

  return (
    <>
      <section className={`trust-command-hero tone-${currentTrustTone}`}>
        <div className="trust-command-copy">
          <span className="trust-hero-eyebrow">
            <UiIcon name="scale" />
            Mediacion y confianza
          </span>
          <h1>Estado operativo</h1>
          <p>{operationalSummary}</p>
          <div className="trust-hero-kpis" aria-label="Indicadores principales">
            <div className="trust-hero-kpi">
              <span className="trust-hero-kpi-icon"><UiIcon name="users" /></span>
              <div><span>Vendedores activos</span><strong>{compactNumber(activeSellers)}</strong></div>
            </div>
            <div className="trust-hero-kpi">
              <span className="trust-hero-kpi-icon"><UiIcon name="document" /></span>
              <div><span>Casos abiertos</span><strong>{compactNumber(openMediations)}</strong></div>
            </div>
            <div className="trust-hero-kpi">
              <span className="trust-hero-kpi-icon"><UiIcon name="alert" /></span>
              <div><span>Alertas criticas</span><strong>{compactNumber(criticalAlerts)}</strong></div>
            </div>
          </div>
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
          <section className="trust-summary-grid" aria-label="Resumen operativo">
            <SummaryCard icon="users" tone="blue" label="Vendedores monitoreados" value={data?.activeSellers ?? 0} detail={`${data?.suspendedSellers ?? 0} suspendidos bajo revisión`} />
            <SummaryCard icon="clock" tone="amber" label="Esperando al vendedor" value={escalatedCount} detail="Pendientes de respuesta o gestión del vendedor" />
            <SummaryCard icon="scale" tone="violet" label="En mediación" value={inMediationCount} detail="Casos ya en curso y en seguimiento" />
            <SummaryCard icon="fileCheck" tone="green" label="Documentación revisada" value={reviewedDocsCount} detail={`${pendingDocsCount} pendientes de aceptar o rechazar`} />
          </section>

          <section className="trust-dashboard-grid">
            <TrustPulsePanel
              trustScore={trustScore}
              trustLevel={trustLevel}
              validationTotal={validationTotal}
              corrections={data?.validationsCorrection ?? 0}
              pending={data?.validationsPending ?? 0}
              rejected={data?.validationsRejected ?? 0}
              pressureCount={pressureCount}
              expiringDocuments={data?.expiringDocuments ?? 0}
            />
          </section>

          <section className="trust-mini-grid">
            <MediationsPanel items={mediations} loading={hasPreviewLoading} expanded={expandedPanels.mediations} onToggle={() => togglePanel('mediations')} />
            <EscalationsPanel items={escalations} loading={hasPreviewLoading} expanded={expandedPanels.alerts} onToggle={() => togglePanel('alerts')} />
          </section>

          <section className="trust-mini-grid">
            <ValidationsPanel items={validations} loading={hasPreviewLoading} expanded={expandedPanels.validations} onToggle={() => togglePanel('validations')} />
            <ReceiptsPanel items={receipts} loading={hasPreviewLoading} expanded={expandedPanels.receipts} onToggle={() => togglePanel('receipts')} />
          </section>
        </>
      )}
    </>
  );
}

function SummaryCard({ icon, tone, label, value, detail }: { icon: string; tone: string; label: string; value: number; detail: string }) {
  return (
    <article className={`trust-summary-card tone-${tone}`}>
      <span className="trust-summary-icon">
        <UiIcon name={icon} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{compactNumber(value)}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function TrustPulsePanel({
  trustScore,
  trustLevel,
  validationTotal,
  corrections,
  pending,
  rejected,
  pressureCount,
  expiringDocuments,
}: {
  trustScore: number;
  trustLevel: string;
  validationTotal: number;
  corrections: number;
  pending: number;
  rejected: number;
  pressureCount: number;
  expiringDocuments: number;
}) {
  const tone = trustTone(trustScore);

  return (
    <article className="trust-panel trust-panel-large">
      <div className="trust-panel-head">
        <div>
          <span>Estado general</span>
          <h2>Pulso operativo</h2>
        </div>
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
          <p>{pressureCount} frentes requieren seguimiento operativo entre mediaciones, boletas y documentos.</p>
        </div>
        <div className="trust-progress-list">
          <ProgressRow label="Solicitudes de corrección" value={corrections} total={validationTotal} tone="yellow" />
          <ProgressRow label="Validaciones pendientes" value={pending} total={validationTotal} tone="amber" />
          <ProgressRow label="Rechazos documentales" value={rejected} total={validationTotal} tone="red" />
          <div className="trust-cycle-strip" aria-label="Flujo de mediación">
            <span>Esperando al vendedor</span>
            <UiIcon name="arrowRight" />
            <span>En mediación</span>
            <UiIcon name="arrowRight" />
            <span>Resuelta o cuenta bloqueada</span>
          </div>
          <div className="trust-pulse-note">
            <UiIcon name="calendar" />
            <span>{expiringDocuments} documentos proximos a vencer dentro del flujo de confianza. Un caso en mediación no debe verse como esperando al vendedor ni bloqueado al mismo tiempo.</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProgressRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const width = percent(value, total);

  return (
    <div className={`trust-progress-row tone-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{compactNumber(value)}</strong>
      </div>
      <div className="trust-progress-track">
        <span style={{ width: `${width}%` }} />
      </div>
      <small>{width}%</small>
    </div>
  );
}

function MediationsPanel({ items, loading, expanded, onToggle }: { items: MediationResponse[]; loading: boolean; expanded: boolean; onToggle: () => void }) {
  const activeMediations = items.filter((item) => item.status === MediationStatus.EN_MEDIACION && !item.accountBlocked);

  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Mediaciones"
        title="Casos en mediación"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${activeMediations.length} activos`} variant="EN_MEDIACION" />}
      />
      {expanded && (
        <div className="trust-feed">
          {loading && <EmptyState text="Actualizando mediaciones..." />}
          {!loading && activeMediations.length === 0 && <EmptyState text="No hay casos activos en mediación para mostrar." />}
          {!loading && activeMediations.map((item) => (
            <div className="trust-feed-item" key={item.id}>
              <span className="trust-feed-icon violet">
                <UiIcon name="scale" />
              </span>
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
      )}
    </article>
  );
}

function EscalationsPanel({ items, loading, expanded, onToggle }: { items: MediationResponse[]; loading: boolean; expanded: boolean; onToggle: () => void }) {
  const escalations = items
    .filter((item) => item.status === MediationStatus.ESPERANDO_VENDEDOR && !item.accountBlocked)
    .sort((a, b) => parseAgeDays(b) - parseAgeDays(a));

  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Seguimiento"
        title="Últimos esperando al vendedor"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${escalations.length} casos`} variant="ESPERANDO_VENDEDOR" />}
      />
      {expanded && (
        <div className="trust-feed">
          {loading && <EmptyState text="Actualizando casos esperando al vendedor..." />}
          {!loading && escalations.length === 0 && <EmptyState text="Sin casos esperando al vendedor recientes." />}
          {!loading && escalations.map((item) => {
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
      )}
    </article>
  );
}

function ApprovedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" className="premium-svg">
      <defs>
        <linearGradient id="approveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
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
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
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
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
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

function ValidationsPanel({ items, loading, expanded, onToggle }: { items: ValidationResponse[]; loading: boolean; expanded: boolean; onToggle: () => void }) {
  const reviewedItems = items
    .filter(
      (item) =>
        item.status === 'RECHAZADA' ||
        (item.status === 'PENDIENTE' && item.notes && item.notes.trim())
    )
    .slice(0, 5);

  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Documentacion"
        title="Validaciones recientes"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${reviewedItems.length} observaciones`} variant="RECHAZADO" />}
      />
      {expanded && (
        <div className="trust-document-list">
          {loading && <EmptyState text="Actualizando validaciones..." />}
          {!loading && reviewedItems.length === 0 && <EmptyState text="Sin validaciones aceptadas o rechazadas." />}
          {!loading && reviewedItems.map((item) => {
            const isRejected = item.status === 'RECHAZADA';
            const isCorrection = item.status === 'PENDIENTE' && item.notes;

            let badgeText = 'Aceptado';
            let badgeVariant = 'APROBADO';
            let iconClass = 'approved';
            let customIcon = <ApprovedIcon />;

            if (isRejected) {
              badgeText = 'Rechazado';
              badgeVariant = 'RECHAZADO';
              iconClass = 'rejected';
              customIcon = <RejectedIcon />;
            } else if (isCorrection) {
              badgeText = 'Por corregir';
              badgeVariant = 'PENDIENTE';
              iconClass = 'correction';
              customIcon = <CorrectionIcon />;
            }

            return (
              <div className={`trust-document-row state-${iconClass}`} key={item.id}>
                <span className={`trust-document-icon ${iconClass}`}>
                  {customIcon}
                </span>
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
      )}
    </article>
  );
}

function ReceiptsPanel({ items, loading, expanded, onToggle }: { items: ReceiptFollowupResponse[]; loading: boolean; expanded: boolean; onToggle: () => void }) {
  return (
    <article className="trust-panel">
      <CollapsiblePanelHead
        eyebrow="Cumplimiento"
        title="Boletas pendientes"
        expanded={expanded}
        onToggle={onToggle}
        action={<Badge text={`${items.length} últimas`} variant="PENDIENTE" />}
      />
      {expanded && (
        <div className="trust-receipt-list">
          {loading && <EmptyState text="Actualizando boletas..." />}
          {!loading && items.length === 0 && <EmptyState text="Sin boletas pendientes." />}
          {!loading && items.map((item) => (
            <div className="trust-receipt-row" key={item.id}>
              <div>
                <strong>{item.orderId}</strong>
                <span>{item.sellerName}</span>
                <small>{item.dueInfo || item.detail}</small>
              </div>
              <div>
                <b>{formatCurrency(item.amount)}</b>
                <Badge text={item.status} variant={item.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function CollapsiblePanelHead({
  eyebrow,
  title,
  action,
  expanded,
  onToggle,
}: {
  eyebrow: string;
  title: string;
  action: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="trust-panel-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
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
