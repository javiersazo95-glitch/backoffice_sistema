import type { SellerDetailResponse } from '@/types/seller';
import type { ImpactMediation } from '@/types/cases';
import type { MediationSummaryResponse } from '@/types/mediation';
import type { AlertResponse } from '@/types/alert';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { applyManualMediationStatus, useManualMediationStatusOverrides } from '@/utils/manualMediationStatus';
import { useManualMediationAdminMode } from '@/utils/manualMediationAdminMode';

interface SellerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerDetailResponse | null;
  onOpenDocuments?: (sellerId: number) => void;
  onOpenMediation?: (sellerId: number) => void;
  onSuspend?: (sellerId: number) => void;
}

function formatDate(date: string, locale: Intl.LocalesArgument = 'es-CL') {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function badgeTone(value: string) {
  const slug = value.toLowerCase();
  if (slug.includes('verific')) return 'green';
  if (slug.includes('pend')) return 'amber';
  if (slug.includes('suspend') || slug.includes('bloque')) return 'red';
  return 'blue';
}

function sellerLetterAvatar(name: string) {
  return name.substring(0, 2).toUpperCase();
}

function SectionHeader({
  icon,
  title,
  count,
  tone = 'blue',
}: {
  icon: string;
  title: string;
  count?: string;
  tone?: 'blue' | 'violet' | 'red' | 'green' | 'amber';
}) {
  return (
    <div className="seller-profile-section-header">
      <span className={`seller-profile-section-icon ${tone}`}>
        <UiIcon name={icon} />
      </span>
      <h3>{title}</h3>
      {count ? <span className="seller-profile-section-count">{count}</span> : null}
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return <h3 className="seller-profile-panel-title">{title}</h3>;
}

function InfoStat({
  label,
  value,
  sub,
  className = '',
}: {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`seller-profile-info-stat ${className}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function DocumentTable({ documents }: { documents: SellerDetailResponse['documents'] }) {
  if (!documents.length) {
    return <p className="row-sub">No hay documentos disponibles para este vendedor.</p>;
  }

  return (
    <div className="table-wrap seller-profile-documents-wrap">
      <table className="wide-table seller-profile-table">
        <colgroup>
          <col className="seller-profile-document-name-col" />
          <col className="seller-profile-document-status-col" />
          <col className="seller-profile-document-date-col" />
        </colgroup>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Estado</th>
            <th>Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.documentType}</td>
              <td><Badge text={doc.status} variant={doc.status} /></td>
              <td>{formatDate(doc.dueAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MediationCard({ mediation }: { mediation: MediationSummaryResponse | ImpactMediation }) {
  return (
    <div className="seller-profile-case-card">
      <div className="seller-profile-case-icon">
        <UiIcon name="scale" />
      </div>
      <div className="seller-profile-case-copy">
        <strong>{mediation.reason}</strong>
        <span>Pedido {mediation.orderId}</span>
        {'amount' in mediation ? <small>Monto {mediation.amount}</small> : null}
      </div>
      <Badge text={mediation.status} variant="violet" />
    </div>
  );
}

function riskTone(severity?: AlertResponse['severity']) {
  if (severity === 'CRITICA') return 'red';
  if (severity === 'ALTA') return 'amber';
  return 'blue';
}

function RiskCard({ risk }: { risk: AlertResponse | any }) {
  return (
    <div className="seller-profile-risk-card">
      <div className="seller-profile-risk-icon">
        <UiIcon name="clock" />
      </div>
      <div className="seller-profile-risk-copy">
        <strong>{risk.signalType || risk.reason || 'Esperando al vendedor'}</strong>
        <span>{risk.evidence || risk.impact || risk.orderId || risk.stage || 'Pendiente de respuesta'}</span>
      </div>
      <Badge text={risk.severity || risk.status || 'Esperando'} variant={riskTone(risk.severity)} />
    </div>
  );
}

function ActivityCard({
  icon,
  title,
  detail,
  date,
  tone = 'blue',
}: {
  icon: string;
  title: string;
  detail: string;
  date: string;
  tone?: 'blue' | 'violet' | 'red' | 'green' | 'amber';
}) {
  return (
    <div className="seller-profile-activity-item">
      <span className={`seller-profile-activity-icon ${tone}`}>
        <UiIcon name={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <time>{date}</time>
    </div>
  );
}

export default function SellerProfileModal({
  isOpen,
  onClose,
  seller,
  onOpenDocuments,
  onOpenMediation,
  onSuspend,
}: SellerProfileModalProps) {
  const [manualStatusOverrides] = useManualMediationStatusOverrides();
  const [adminMode] = useManualMediationAdminMode();
  const effectiveManualStatusOverrides = adminMode ? manualStatusOverrides : {};

  if (!isOpen || !seller) return null;

  const mediatedCases = seller.mediations.map((mediation) => applyManualMediationStatus(mediation, effectiveManualStatusOverrides));
  const activeMediations = mediatedCases.filter((m) => m.status !== 'RESUELTA' && m.status !== 'CERRADA');
  const waitingSellerCases = seller.risks as any[];
  const documents = seller.documents;
  const latestActivityDate = seller.lastActivityAt ? formatDate(seller.lastActivityAt) : 'Sin datos';
  const recentActivity: Array<{ icon: string; title: string; detail: string; date: string; tone: 'blue' | 'violet' | 'red' | 'green' | 'amber' }> = [
    ...waitingSellerCases.slice(0, 2).map((risk) => ({
      icon: 'alert',
      title: 'Esperando al vendedor',
      detail: risk.signalType || risk.reason || 'Pendiente de respuesta',
      date: formatDate(risk.createdAt || risk.updated || new Date().toISOString()),
      tone: 'amber' as const,
    })),
    ...mediatedCases.slice(0, 2).map((mediation) => ({
      icon: 'scale',
      title: 'Mediación iniciada',
      detail: mediation.reason,
      date: formatDate(mediation.updatedAt),
      tone: 'violet' as const,
    })),
    ...seller.documents.slice(0, 2).map((doc) => ({
      icon: 'document',
      title: `Documento "${doc.documentType}" actualizado`,
      detail: `Estado: ${doc.status}`,
      date: formatDate(doc.uploadedAt),
      tone: 'amber' as const,
    })),
    ...seller.tickets.slice(0, 2).map((ticket) => ({
      icon: 'users',
      title: 'Ticket abierto',
      detail: ticket.reason,
      date: formatDate(ticket.updatedAt),
      tone: 'blue' as const,
    })),
  ].slice(0, 6);

  return (
    <div className="case-modal-backdrop seller-profile-backdrop" onClick={onClose}>
      <div className="seller-profile-modal" onClick={(event) => event.stopPropagation()}>
        <button className="seller-profile-close" type="button" onClick={onClose} aria-label="Cerrar">
          <UiIcon name="close" />
        </button>
        <div className="seller-profile-layout">
          <aside className="seller-profile-sidebar">
            <div className="seller-profile-breadcrumbs">
              <span>Vendedores</span>
              <UiIcon name="arrowRight" />
              <strong>{seller.storeName}</strong>
            </div>

            <div className="seller-profile-card">
              <div className={`seller-profile-avatar logo-${seller.id % 8}`}>
                {sellerLetterAvatar(seller.storeName)}
              </div>
              <h2>{seller.storeName}</h2>
              <span className="seller-profile-id">{seller.externalId}</span>

              <div className="seller-profile-subinfo">
                <span><UiIcon name="users" /> RUT {seller.rut}</span>
                <span><UiIcon name="home" /> {seller.city}</span>
              </div>

              <div className="seller-profile-badges">
                <Badge text={seller.status} variant={seller.status} />
                <Badge text={seller.trustLevel} variant={badgeTone(seller.trustLevel)} />
              </div>
            </div>

            <div className="seller-profile-quick-panel">
              <SectionHeader icon="shield" title="Resumen rápido" tone="violet" />
              <InfoStat label="Nivel de confianza" value={`${seller.trustLevel} ${seller.trustScore}%`} />
              <InfoStat label="Mediaciones activas" value={activeMediations.length} />
              <InfoStat label="Esperando al vendedor" value={waitingSellerCases.length} />
              <InfoStat label="Tickets abiertos" value={seller.tickets.filter((ticket) => ticket.status !== 'RESUELTO' && ticket.status !== 'CERRADO').length} />
              <InfoStat label="Boletas pendientes" value={seller.pendingReceipts} />
            </div>

            <div className="seller-profile-quick-panel seller-profile-links">
              <button type="button" onClick={() => onOpenDocuments?.(seller.id)}>
                <UiIcon name="document" />
                <span>Documentos</span>
                <UiIcon name="arrowRight" />
              </button>
              <button type="button" onClick={() => onOpenMediation?.(seller.id)}>
                <UiIcon name="scale" />
                <span>Mediaciones</span>
                <UiIcon name="arrowRight" />
              </button>
              <button type="button" onClick={() => onSuspend?.(seller.id)}>
                <UiIcon name="shieldX" />
                <span>Bloqueo disciplinario</span>
                <UiIcon name="arrowRight" />
              </button>
            </div>

            <div className="seller-profile-footer-info">
              <span>Creado el {formatDate(seller.lastActivityAt || new Date().toISOString())}</span>
              <strong>ID externo</strong>
            </div>
          </aside>

          <main className="seller-profile-main">
            <div className="seller-profile-top-actions">
              <button className="secondary-button" type="button" onClick={() => onOpenDocuments?.(seller.id)}>
                <UiIcon name="fileCheck" /> Ver documentación
              </button>
              <button className="secondary-button mediation-button" type="button" onClick={() => onOpenMediation?.(seller.id)}>
                <UiIcon name="scale" /> Ver mediación en curso
              </button>
              <button className="danger-button" type="button" onClick={() => onSuspend?.(seller.id)}>
                <UiIcon name="shieldX" /> Bloquear por fraude o falta grave
              </button>
            </div>

            <section className="seller-profile-metric-strip">
              <InfoStat className="seller-profile-metric-stat" label="Estado actual" value={seller.status} sub={`Desde ${latestActivityDate}`} />
              <InfoStat className="seller-profile-metric-stat" label="Nivel de confianza" value={seller.trustLevel} sub={`${seller.trustScore}%`} />
              <InfoStat className="seller-profile-metric-stat" label="Última actividad" value={latestActivityDate} sub={seller.responseTime} />
              <InfoStat className="seller-profile-metric-stat" label="Reclamos" value={seller.claimsCount} sub="Total" />
              <InfoStat className="seller-profile-metric-stat" label="Devoluciones" value={seller.returnsCount} sub="Total" />
              <InfoStat className="seller-profile-metric-stat" label="Boletas pendientes" value={seller.pendingReceipts} sub="Sin requerimiento" />
            </section>

            <section className="seller-profile-content-grid">
              <div className="seller-profile-panel documents-panel">
                <PanelTitle title="Documentos del vendedor" />
                <DocumentTable documents={documents} />
                <button className="profile-inline-link" type="button" onClick={() => onOpenDocuments?.(seller.id)}>
                  Ver todos los documentos <UiIcon name="arrowRight" />
                </button>
              </div>

              <div className="seller-profile-panel mediation-panel">
                <SectionHeader icon="scale" title="Casos en mediación" count={`${activeMediations.length} activos`} tone="violet" />
                <div className="seller-profile-list">
                  {activeMediations.length ? activeMediations.map((mediation) => <MediationCard key={mediation.id} mediation={mediation} />) : <p className="row-sub">No hay casos en mediación.</p>}
                </div>
                <button className="profile-inline-link" type="button" onClick={() => onOpenMediation?.(seller.id)}>
                  Ver todos los casos en mediación <UiIcon name="arrowRight" />
                </button>
              </div>

              <div className="seller-profile-panel risks-panel">
                <SectionHeader icon="clock" title="Esperando al vendedor" count={`${waitingSellerCases.length}`} tone="amber" />
                <div className="seller-profile-list">
                  {waitingSellerCases.length ? waitingSellerCases.map((risk) => <RiskCard key={risk.id} risk={risk} />) : <p className="row-sub">No hay casos esperando al vendedor.</p>}
                </div>
                <button className="profile-inline-link" type="button">
                  Ver todos los casos esperando al vendedor <UiIcon name="arrowRight" />
                </button>
              </div>

              <div className="seller-profile-panel info-panel">
                <PanelTitle title="Información adicional" />
                <div className="seller-profile-additional-grid">
                  <InfoStat label="Nivel de confianza" value={`${seller.trustLevel} (${seller.trustScore}%)`} />
                  <InfoStat label="Cuenta bancaria" value={seller.bankStatus} />
                  <InfoStat label="Esperando al vendedor" value={waitingSellerCases.length} />
                  <InfoStat label="Mediaciones activas" value={activeMediations.length} />
                  <InfoStat label="Reclamos" value={seller.claimsCount} />
                  <InfoStat label="Devoluciones" value={seller.returnsCount} />
                  <InfoStat label="Boletas pendientes" value={seller.pendingReceipts} />
                  <InfoStat label="Última actividad" value={latestActivityDate} />
                </div>
              </div>

              <div className="seller-profile-panel activity-panel">
                <PanelTitle title="Actividad reciente" />
                <div className="seller-profile-activity">
                  {recentActivity.length ? recentActivity.map((activity, index) => <ActivityCard key={`${activity.title}-${index}`} {...activity} />) : <p className="row-sub">No hay actividad reciente.</p>}
                </div>
                <button className="profile-inline-link" type="button">
                  Ver toda la actividad <UiIcon name="arrowRight" />
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
