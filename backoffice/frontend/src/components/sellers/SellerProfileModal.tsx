import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSellerBlockHistory, getSellerReports } from '@/api/sellers';
import type { SellerBlockHistoryResponse, SellerDetailResponse } from '@/types/seller';
import type { ImpactMediation } from '@/types/cases';
import type { MediationSummaryResponse } from '@/types/mediation';
import type { ReportResponse } from '@/types/report';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { applyManualMediationStatus, useManualMediationStatusOverrides } from '@/utils/manualMediationStatus';
import { resolveProfileImageUrl } from '@/api/client';
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
  const countStyle = tone === 'amber'
    ? { backgroundColor: '#fef3c7', color: '#d97706' }
    : tone === 'red'
    ? { backgroundColor: '#fee2e2', color: '#dc2626' }
    : tone === 'violet'
    ? { backgroundColor: '#f4efff', color: '#7c3aed' }
    : undefined;

  return (
    <div className="seller-profile-section-header">
      <span className={`seller-profile-section-icon ${tone}`}>
        <UiIcon name={icon} />
      </span>
      <h3>{title}</h3>
      {count ? (
        <span className="seller-profile-section-count" style={countStyle}>
          {count}
        </span>
      ) : null}
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
        </colgroup>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.documentType}</td>
              <td><Badge text={doc.status} variant={doc.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MediationCard({ mediation, iconName = 'scale' }: { mediation: MediationSummaryResponse | ImpactMediation; iconName?: string }) {
  const isWaiting = iconName === 'clock' || mediation.status === 'ESPERANDO_VENDEDOR' || mediation.status === 'ESCALADO';
  
  return (
    <div className="seller-profile-case-card">
      <div 
        className="seller-profile-case-icon"
        style={isWaiting ? { backgroundColor: '#fef3c7', color: '#d97706' } : undefined}
      >
        <UiIcon name={iconName} />
      </div>
      <div className="seller-profile-case-copy">
        <strong>{mediation.reason}</strong>
        <span>Pedido {mediation.orderId}</span>
        {'amount' in mediation ? <small>Monto {mediation.amount}</small> : null}
      </div>
      <Badge text={mediation.status} variant={isWaiting ? 'amber' : 'violet'} />
    </div>
  );
}

function ReportCard({ report }: { report: ReportResponse }) {
  return (
    <div className="seller-profile-case-card">
      <div className="seller-profile-case-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
        <UiIcon name="flag" />
      </div>
      <div className="seller-profile-case-copy">
        <strong>{report.motivo}</strong>
        <span>{report.idExterno || `#${report.id}`}</span>
        <small>{report.descripcion || 'Sin descripción registrada'}</small>
      </div>
      <Badge text={report.reportanteType === 'VENDEDOR' ? 'Reporta tienda' : 'Reporta comprador'} variant="red" />
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

export interface SellerBlockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerDetailResponse | null;
  blockHistory: SellerBlockHistoryResponse[];
  isLoading: boolean;
  onSuspend?: (sellerId: number) => void;
}

export function SellerBlockHistoryModal({ isOpen, onClose, seller, blockHistory, isLoading, onSuspend }: SellerBlockHistoryModalProps) {
  if (!isOpen || !seller) return null;

  return (
    <div className="case-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="seller-documents-modal seller-active-mediations-modal" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <header className="seller-documents-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="seller-documents-heading">
            <span className="seller-documents-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
              <UiIcon name="shieldX" />
            </span>
            <div className="seller-documents-title">
              <h2>Historial de bloqueos</h2>
              <p>{seller.storeName} · {seller.externalId}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="danger-button" type="button" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => onSuspend?.(seller.id)}>
              <UiIcon name="shieldX" /> Bloquear tienda
            </button>
            <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar" style={{ margin: 0 }}>
              <UiIcon name="close" />
              <span>Cerrar</span>
            </button>
          </div>
        </header>

        <section className="seller-active-mediations-content" style={{ padding: '20px' }}>
          {isLoading ? (
            <p className="row-sub">Cargando historial de bloqueos...</p>
          ) : blockHistory.length ? (
            <div className="table-wrap" style={{ marginTop: '10px' }}>
              <table className="wide-table seller-profile-table">
                <thead>
                  <tr>
                    <th style={{ padding: '12px 8px' }}>Fecha</th>
                    <th style={{ padding: '12px 8px' }}>Acción</th>
                    <th style={{ padding: '12px 8px' }}>Origen</th>
                    <th style={{ padding: '12px 8px' }}>Operador</th>
                    <th style={{ padding: '12px 8px' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {blockHistory.map((log) => (
                    <tr key={log.id}>
                      <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>{formatDate(log.createdAt)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <Badge 
                          text={log.action} 
                          variant={log.action.toLowerCase().includes('reactiv') ? 'green' : 'red'} 
                        />
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{log.source}</span>
                        {log.externalId ? <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>{log.externalId}</span> : null}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <strong>{log.operator || 'Sistema'}</strong>
                        {log.status ? <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{log.status}</span> : null}
                      </td>
                      <td style={{ padding: '12px 8px' }}>{log.detail || log.reason || 'Sin detalle registrado.'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="row-sub" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              La tienda no registra antecedentes de bloqueos o sanciones disciplinarias.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

interface SellerTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerDetailResponse | null;
  recentActivity: Array<{ icon: string; title: string; detail: string; date: string; tone: 'blue' | 'violet' | 'red' | 'green' | 'amber' }>;
}

function SellerTimelineModal({ isOpen, onClose, seller, recentActivity }: SellerTimelineModalProps) {
  if (!isOpen || !seller) return null;

  return (
    <div className="case-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="seller-documents-modal seller-active-mediations-modal" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className="seller-documents-icon" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
              <UiIcon name="clock" />
            </span>
            <div className="seller-documents-title">
              <h2>Línea de tiempo completa</h2>
              <p>{seller.storeName} · {seller.externalId}</p>
            </div>
          </div>
          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section className="seller-active-mediations-content" style={{ padding: '20px', maxHeight: '450px', overflowY: 'auto' }}>
          <div className="seller-profile-activity" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recentActivity.map((activity, index) => (
              <div key={index} className="seller-profile-activity-item" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', display: 'flex', alignItems: 'center' }}>
                <span className={`seller-profile-activity-icon ${activity.tone}`} style={{ marginRight: '12px' }}>
                  <UiIcon name={activity.icon} />
                </span>
                <div>
                  <strong>{activity.title}</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>{activity.detail}</p>
                </div>
                <time style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{activity.date}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

interface SellerReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerDetailResponse | null;
  reports: ReportResponse[];
  isLoading: boolean;
}

function SellerReportsModal({ isOpen, onClose, seller, reports, isLoading }: SellerReportsModalProps) {
  if (!isOpen || !seller) return null;

  return (
    <div className="case-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="seller-documents-modal seller-active-mediations-modal" style={{ maxWidth: '950px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className="seller-documents-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
              <UiIcon name="flag" />
            </span>
            <div className="seller-documents-title">
              <h2>Casos de reporte</h2>
              <p>{seller.storeName} · {seller.externalId}</p>
            </div>
          </div>
          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section className="seller-active-mediations-content" style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto' }}>
          {isLoading ? (
            <p className="row-sub">Cargando reportes...</p>
          ) : reports.length ? (
            <div className="table-wrap" style={{ marginTop: '10px' }}>
              <table className="wide-table seller-profile-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Reportante</th>
                    <th>Reportado</th>
                    <th>Motivo</th>
                    <th>Descripción</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td style={{ whiteSpace: 'nowrap' }}><strong>{report.idExterno || `#${report.id}`}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <strong>{report.reportanteName}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{report.reportanteEmail}</span>
                          <Badge
                            text={report.reportanteType === 'VENDEDOR' ? 'TIENDA' : 'COMPRADOR'}
                            variant={report.reportanteType === 'COMPRADOR' ? 'blue' : 'amber'}
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <strong>{report.reportadoName}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{report.reportadoEmail}</span>
                          <Badge
                            text={report.reportadoType === 'VENDEDOR' ? 'TIENDA' : 'COMPRADOR'}
                            variant={report.reportadoType === 'COMPRADOR' ? 'blue' : 'amber'}
                          />
                        </div>
                      </td>
                      <td>
                        <strong>{report.motivo}</strong>
                      </td>
                      <td>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 250,
                            fontSize: '13px'
                          }}
                        >
                          {report.descripcion}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(report.fechaCreacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="row-sub" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              La tienda no registra reportes en chats.
            </p>
          )}
        </section>
      </div>
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

  const [isBlockHistoryOpen, setIsBlockHistoryOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);

  const { data: blockHistory = [], isLoading: isBlockHistoryLoading } = useQuery({
    queryKey: ['seller-block-history', seller?.id],
    queryFn: () => getSellerBlockHistory(seller!.id),
    enabled: isOpen && !!seller,
  });

  const { data: sellerReports = [], isLoading: isSellerReportsLoading } = useQuery({
    queryKey: ['seller-reports', seller?.id],
    queryFn: () => getSellerReports(seller!.id),
    enabled: isOpen && !!seller,
  });

  if (!isOpen || !seller) return null;

  const mediatedCases = seller.mediations.map((mediation) => applyManualMediationStatus(mediation, effectiveManualStatusOverrides));
  const inProgressMediations = mediatedCases.filter((m) => m.status === 'EN_MEDIACION');
  const waitingSellerMediations = mediatedCases.filter((m) => m.status === 'ESPERANDO_VENDEDOR' || m.status === 'ESCALADO');
  const documents = seller.documents;

  const recentActivityRaw: Array<{ icon: string; title: string; detail: string; date: string; timestamp: number; tone: 'blue' | 'violet' | 'red' | 'green' | 'amber' }> = [
    ...waitingSellerMediations.map((mediation) => ({
      icon: 'clock',
      title: 'Esperando al vendedor',
      detail: mediation.reason,
      date: formatDate(mediation.updatedAt),
      timestamp: new Date(mediation.updatedAt).getTime(),
      tone: 'amber' as const,
    })),
    ...inProgressMediations.map((mediation) => ({
      icon: 'scale',
      title: 'Mediación iniciada',
      detail: mediation.reason,
      date: formatDate(mediation.updatedAt),
      timestamp: new Date(mediation.updatedAt).getTime(),
      tone: 'violet' as const,
    })),
    ...sellerReports.map((report) => ({
      icon: 'flag',
      title: 'Reporte registrado',
      detail: `${report.motivo}${report.descripcion ? ` · ${report.descripcion}` : ''}`,
      date: formatDate(report.fechaCreacion),
      timestamp: new Date(report.fechaCreacion).getTime(),
      tone: 'red' as const,
    })),
    ...blockHistory.map((event) => ({
      icon: event.action.toLowerCase().includes('reactiv') ? 'check' : 'shieldX',
      title: event.action,
      detail: event.detail || event.reason || event.externalId || 'Sin detalle registrado.',
      date: formatDate(event.createdAt),
      timestamp: new Date(event.createdAt).getTime(),
      tone: event.action.toLowerCase().includes('reactiv') ? 'green' as const : 'red' as const,
    })),
    ...seller.documents.map((doc) => ({
      icon: 'document',
      title: `Documento "${doc.documentType}" actualizado`,
      detail: `Estado: ${doc.status}`,
      date: formatDate(doc.uploadedAt),
      timestamp: new Date(doc.uploadedAt).getTime(),
      tone: 'amber' as const,
    })),
    ...seller.tickets.map((ticket) => ({
      icon: 'users',
      title: 'Ticket abierto',
      detail: ticket.reason,
      date: formatDate(ticket.updatedAt),
      timestamp: new Date(ticket.updatedAt).getTime(),
      tone: 'blue' as const,
    })),
  ];

  const recentActivityRawSorted = [...recentActivityRaw].sort((a, b) => b.timestamp - a.timestamp);
  const recentActivity = recentActivityRawSorted.slice(0, 6);

  const latestActivityDate = recentActivity[0] ? recentActivity[0].date : (seller.lastActivityAt ? formatDate(seller.lastActivityAt) : 'Sin datos');

  return (
    <>
      <div className="case-modal-backdrop seller-profile-backdrop" onClick={onClose}>
        <div className="seller-profile-modal" onClick={(event) => event.stopPropagation()}>
          <button className="seller-profile-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
          </button>
          <div className="seller-profile-layout">
            <aside className="seller-profile-sidebar">
              <div className="seller-profile-breadcrumbs">
                <span>Tiendas</span>
                <UiIcon name="arrowRight" />
                <strong>{seller.storeName}</strong>
              </div>

              <div className="seller-profile-card">
                <div className={`seller-profile-avatar logo-${seller.id % 8}`}>
                  {seller.userProfileUrl ? (
                    <img src={resolveProfileImageUrl(seller.userProfileUrl) ?? undefined} alt={seller.storeName} />
                  ) : (
                    sellerLetterAvatar(seller.storeName)
                  )}
                </div>
                <h2>{seller.storeName}</h2>
                <span className="seller-profile-id">{seller.externalId}</span>

                <div className="seller-profile-subinfo">
                  <span><UiIcon name="users" /> RUT {seller.rut}</span>
                  <span><UiIcon name="home" /> {seller.city}</span>
                  {seller.email && (
                    <span><UiIcon name="mail" /> {seller.email}</span>
                  )}
                  {seller.owner && (
                    <span><UiIcon name="users" /> Responsable: {seller.owner}</span>
                  )}
                  {seller.phone && (
                    <span><UiIcon name="smartphone" /> Teléfono: {seller.phone}</span>
                  )}
                </div>

                <div className="seller-profile-badges">
                  <Badge text={seller.status} variant={seller.status} />
                </div>
              </div>

              <div className="seller-profile-quick-panel">
                <SectionHeader icon="shield" title="Resumen rápido" tone="violet" />
                <InfoStat label="Mediaciones activas" value={inProgressMediations.length} />
                <InfoStat label="Esperando al vendedor" value={waitingSellerMediations.length} />
                <InfoStat label="Tickets abiertos" value={seller.tickets.filter((ticket) => ticket.status !== 'RESUELTO' && ticket.status !== 'CERRADO').length} />
                <InfoStat label="Reportes" value={sellerReports.length || seller.pendingReceipts} />
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
                <button type="button" onClick={() => setIsBlockHistoryOpen(true)}>
                  <UiIcon name="shieldX" />
                  <span>Historial de bloqueos</span>
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
                <button className="secondary-button" type="button" onClick={() => setIsBlockHistoryOpen(true)}>
                  <UiIcon name="shieldX" /> Historial de bloqueos
                </button>
                <button className="secondary-button mediation-button" type="button" onClick={() => onOpenMediation?.(seller.id)}>
                  <UiIcon name="scale" /> Ver mediación en curso
                </button>
              </div>

              <section className="seller-profile-metric-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                <InfoStat className="seller-profile-metric-stat" label="Estado actual" value={seller.status} sub={`Desde ${latestActivityDate}`} />
                <InfoStat className="seller-profile-metric-stat" label="Última actividad" value={latestActivityDate} sub={seller.responseTime} />
                <InfoStat className="seller-profile-metric-stat" label="Reclamos" value={seller.claimsCount} sub="Total" />
                <InfoStat className="seller-profile-metric-stat" label="Reportes" value={sellerReports.length || seller.pendingReceipts} sub="Total" />
              </section>

              <section className="seller-profile-content-grid">
                <div className="seller-profile-panel documents-panel">
                  <PanelTitle title="Documentos de la tienda" />
                  <DocumentTable documents={documents} />
                  <button className="profile-inline-link" type="button" onClick={() => onOpenDocuments?.(seller.id)}>
                    Ver todos los documentos <UiIcon name="arrowRight" />
                  </button>
                </div>

                <div className="seller-profile-panel mediation-panel">
                  <SectionHeader icon="scale" title="Casos en mediación" count={`${inProgressMediations.length} activos`} tone="violet" />
                  <div className="seller-profile-list">
                    {inProgressMediations.length ? inProgressMediations.map((mediation) => <MediationCard key={mediation.id} mediation={mediation} />) : <p className="row-sub">No hay casos en mediación.</p>}
                  </div>
                  <button className="profile-inline-link" type="button" onClick={() => onOpenMediation?.(seller.id)}>
                    Ver todos los casos en mediación <UiIcon name="arrowRight" />
                  </button>
                </div>

                <div className="seller-profile-panel risks-panel">
                  <SectionHeader icon="clock" title="Esperando al vendedor" count={`${waitingSellerMediations.length}`} tone="amber" />
                  <div className="seller-profile-list">
                    {waitingSellerMediations.length ? waitingSellerMediations.map((mediation) => <MediationCard key={mediation.id} mediation={mediation} iconName="clock" />) : <p className="row-sub">No hay casos esperando al vendedor.</p>}
                  </div>
                  <button className="profile-inline-link" type="button" onClick={() => onOpenMediation?.(seller.id)}>
                    Ver todos los casos esperando al vendedor <UiIcon name="arrowRight" />
                  </button>
                </div>

                <div className="seller-profile-panel info-panel">
                  <SectionHeader icon="alert" title="Reportes de la tienda" count={`${sellerReports.length}`} tone="red" />
                  <div className="seller-profile-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {isSellerReportsLoading ? (
                      <p className="row-sub">Cargando reportes...</p>
                    ) : sellerReports.length ? (
                      sellerReports.map((report) => <ReportCard key={report.id} report={report} />)
                    ) : (
                      <p className="row-sub">No hay reportes registrados para esta tienda.</p>
                    )}
                  </div>
                  <button className="profile-inline-link" type="button" onClick={() => setIsReportsModalOpen(true)}>
                    Ver todos los casos de reporte <UiIcon name="arrowRight" />
                  </button>
                </div>

                <div className="seller-profile-panel activity-panel">
                  <PanelTitle title="Actividad reciente" />
                  <div className="seller-profile-activity">
                    {recentActivity.length ? recentActivity.map((activity, index) => <ActivityCard key={`${activity.title}-${index}`} {...activity} />) : <p className="row-sub">No hay actividad reciente.</p>}
                  </div>
                  <button className="profile-inline-link" type="button" onClick={() => setIsTimelineOpen(true)}>
                    Ver toda la actividad <UiIcon name="arrowRight" />
                  </button>
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>

      <SellerBlockHistoryModal
        isOpen={isBlockHistoryOpen}
        onClose={() => setIsBlockHistoryOpen(false)}
        seller={seller}
        blockHistory={blockHistory}
        isLoading={isBlockHistoryLoading}
        onSuspend={(sellerId) => {
          onSuspend?.(sellerId);
          setIsBlockHistoryOpen(false);
        }}
      />

      <SellerTimelineModal
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        seller={seller}
        recentActivity={recentActivityRawSorted}
      />

      <SellerReportsModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        seller={seller}
        reports={sellerReports}
        isLoading={isSellerReportsLoading}
      />
    </>
  );
}
