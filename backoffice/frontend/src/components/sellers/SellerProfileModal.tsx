import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSellerBlockHistory, getSellerReports, getSellerRetiros, getSellerSales } from '@/api/sellers';
import type { SellerBlockHistoryResponse, SellerDetailResponse, SellerRetiroResponse, SellerSaleResponse } from '@/types/seller';
import type { ReportResponse } from '@/types/report';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { resolveProfileImageUrl } from '@/api/client';

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

function formatCLP(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

function retiroEstadoLabel(estado: string) {
  return estado?.toUpperCase() === 'PAGADO' ? 'Depositado' : 'Solicitado';
}

function retiroEstadoVariant(estado: string) {
  return estado?.toUpperCase() === 'PAGADO' ? 'green' : 'amber';
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

function ProfilePagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination compact-pagination seller-profile-pagination">
      <div className="page-buttons">
        <button className="page-button page-prev" type="button" onClick={() => onPageChange(page - 1)} disabled={page === 0} aria-label="Página anterior"><UiIcon name="arrowRight" /></button>
        {Array.from({ length: totalPages }, (_, index) => index).map((item) => (
          <button key={item} className={`page-button ${item === page ? 'active' : ''}`} type="button" onClick={() => onPageChange(item)}>{item + 1}</button>
        ))}
        <button className="page-button" type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages - 1} aria-label="Página siguiente"><UiIcon name="arrowRight" /></button>
      </div>
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

function SalesTable({ sales, isLoading }: { sales: SellerSaleResponse[]; isLoading: boolean }) {
  if (isLoading) return <p className="row-sub">Cargando ventas...</p>;
  if (!sales.length) return <p className="row-sub">La tienda aún no registra ventas.</p>;

  return (
    <div className="table-wrap seller-profile-sales-wrap">
      <table className="wide-table seller-profile-table seller-profile-sales-table">
        <thead>
          <tr>
            <th>ID de venta</th>
            <th>Producto</th>
            <th>Comprador</th>
            <th>Monto</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const products = sale.items.map((item) => item.name).filter(Boolean).join(', ') || 'Producto no informado';
            const saleId = sale.items.find((item) => item.codigoVendedor)?.codigoVendedor || sale.codigoSoporte || `#${sale.id}`;
            const amount = sale.totalSeller ?? sale.total ?? 0;
            return (
              <tr key={sale.id}>
                <td><strong>{saleId}</strong></td>
                <td>{products}</td>
                <td>{sale.buyerName || 'No informado'}</td>
                <td>{formatCLP(amount)}</td>
                <td>{formatDate(sale.createdAt)}</td>
                <td><Badge text={sale.status} variant={sale.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RetiroCard({ retiro }: { retiro: SellerRetiroResponse }) {
  const isPagado = retiro.estado?.toUpperCase() === 'PAGADO';
  return (
    <div className="seller-profile-case-card">
      <div
        className="seller-profile-case-icon"
        style={isPagado ? { backgroundColor: '#e6f4ea', color: '#137333' } : { backgroundColor: '#fef3c7', color: '#d97706' }}
      >
        <UiIcon name="bank" />
      </div>
      <div className="seller-profile-case-copy">
        <strong>{formatCLP(retiro.montoTotal)}</strong>
        <span>{retiro.cantidadPedidos} pedido{retiro.cantidadPedidos === 1 ? '' : 's'} · Solicitado el {formatDate(retiro.fechaSolicitud)}</span>
        <small>Pago estimado: {formatDate(retiro.fechaEfectiva)}</small>
      </div>
      <Badge text={retiroEstadoLabel(retiro.estado)} variant={retiroEstadoVariant(retiro.estado)} />
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
              <p><FounderSellerName name={seller.storeName} founder={seller.founder} /> · {seller.externalId}</p>
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
            <div className="table-wrap seller-reports-table-wrap">
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
              <p><FounderSellerName name={seller.storeName} founder={seller.founder} /> · {seller.externalId}</p>
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

export function SellerReportsModal({ isOpen, onClose, seller, reports, isLoading }: SellerReportsModalProps) {
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
              <p><FounderSellerName name={seller.storeName} founder={seller.founder} /> · {seller.externalId}</p>
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

interface SellerRetirosModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerDetailResponse | null;
  retiros: SellerRetiroResponse[];
  isLoading: boolean;
}

function SellerRetirosModal({ isOpen, onClose, seller, retiros, isLoading }: SellerRetirosModalProps) {
  if (!isOpen || !seller) return null;

  return (
    <div className="case-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="seller-documents-modal seller-active-mediations-modal" style={{ maxWidth: '950px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className="seller-documents-icon" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
              <UiIcon name="bank" />
            </span>
            <div className="seller-documents-title">
              <h2>Historial de retiros</h2>
              <p><FounderSellerName name={seller.storeName} founder={seller.founder} /> · {seller.externalId}</p>
            </div>
          </div>
          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section className="seller-active-mediations-content" style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto' }}>
          {isLoading ? (
            <p className="row-sub">Cargando retiros...</p>
          ) : retiros.length ? (
            <div className="table-wrap" style={{ marginTop: '10px' }}>
              <table className="wide-table seller-profile-table">
                <thead>
                  <tr>
                    <th>Fecha de solicitud</th>
                    <th>Pedidos</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Fecha estimada de pago</th>
                  </tr>
                </thead>
                <tbody>
                  {retiros.map((retiro) => (
                    <tr key={retiro.retiroId}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(retiro.fechaSolicitud)}</td>
                      <td>{retiro.cantidadPedidos}</td>
                      <td><strong>{formatCLP(retiro.montoTotal)}</strong></td>
                      <td>
                        <Badge text={retiroEstadoLabel(retiro.estado)} variant={retiroEstadoVariant(retiro.estado)} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(retiro.fechaEfectiva)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="row-sub" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              La tienda no registra retiros de dinero.
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

  const [isBlockHistoryOpen, setIsBlockHistoryOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isRetirosModalOpen, setIsRetirosModalOpen] = useState(false);
  const [salesPage, setSalesPage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);

  useEffect(() => {
    setSalesPage(0);
    setActivityPage(0);
  }, [seller?.id, isOpen]);

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

  const { data: sellerRetiros = [], isLoading: isSellerRetirosLoading } = useQuery({
    queryKey: ['seller-retiros', seller?.id],
    queryFn: () => getSellerRetiros(seller!.id),
    enabled: isOpen && !!seller,
  });

  const { data: sellerSales, isLoading: isSellerSalesLoading } = useQuery({
    queryKey: ['seller-sales', seller?.id, salesPage],
    queryFn: () => getSellerSales(seller!.id, salesPage, 5),
    enabled: isOpen && !!seller,
  });

  if (!isOpen || !seller) return null;

  const mediatedCases = seller.mediations;
  const inProgressMediations = mediatedCases.filter((m) => m.status === 'EN_MEDIACION');
  const documents = seller.documents;

  const sellerRetirosSorted = [...sellerRetiros].sort(
    (a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime()
  );
  const sellerRetirosRecent = sellerRetirosSorted.slice(0, 3);

  const recentActivityRaw: Array<{ icon: string; title: string; detail: string; date: string; timestamp: number; tone: 'blue' | 'violet' | 'red' | 'green' | 'amber' }> = [
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
  const activityPageSize = 5;
  const activityTotalPages = Math.max(1, Math.ceil(recentActivityRawSorted.length / activityPageSize));
  const currentActivityPage = Math.min(activityPage, activityTotalPages - 1);
  const recentActivity = recentActivityRawSorted.slice(currentActivityPage * activityPageSize, (currentActivityPage + 1) * activityPageSize);

  const latestActivityDate = recentActivityRawSorted[0] ? recentActivityRawSorted[0].date : (seller.lastActivityAt ? formatDate(seller.lastActivityAt) : 'Sin datos');

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
                <strong><FounderSellerName name={seller.storeName} founder={seller.founder} /></strong>
              </div>

              <div className="seller-profile-card">
                <div className={`seller-profile-avatar logo-${seller.id % 8}`}>
                  {seller.userProfileUrl ? (
                    <img src={resolveProfileImageUrl(seller.userProfileUrl) ?? undefined} alt={seller.storeName} />
                  ) : (
                    sellerLetterAvatar(seller.storeName)
                  )}
                </div>
                <h2><FounderSellerName name={seller.storeName} founder={seller.founder} /></h2>
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
                  {seller.founder ? <span className="founder-badge"><UiIcon name="crown" />Fundador</span> : null}
                </div>
              </div>

              <div className="seller-profile-quick-panel">
                <SectionHeader icon="shield" title="Resumen rápido" tone="violet" />
                <InfoStat label="Mediaciones activas" value={inProgressMediations.length} />
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
                <InfoStat className="seller-profile-metric-stat" label="Mediaciones" value={inProgressMediations.length} sub="Activas" />
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

                <div className="seller-profile-panel retiros-panel">
                  <SectionHeader icon="bank" title="Historial de retiros" count={`${sellerRetiros.length}`} tone="green" />
                  <div className="seller-profile-list">
                    {isSellerRetirosLoading ? (
                      <p className="row-sub">Cargando retiros...</p>
                    ) : sellerRetirosRecent.length ? (
                      sellerRetirosRecent.map((retiro) => <RetiroCard key={retiro.retiroId} retiro={retiro} />)
                    ) : (
                      <p className="row-sub">La tienda no registra retiros de dinero.</p>
                    )}
                  </div>
                  <button className="profile-inline-link" type="button" onClick={() => setIsRetirosModalOpen(true)}>
                    Ver todos los retiros <UiIcon name="arrowRight" />
                  </button>
                </div>

                <div className="seller-profile-panel sales-panel">
                  <SectionHeader icon="cart" title="Ventas realizadas" count={`${sellerSales?.totalElements ?? 0}`} tone="green" />
                  <SalesTable sales={sellerSales?.content ?? []} isLoading={isSellerSalesLoading} />
                  <ProfilePagination page={salesPage} totalPages={sellerSales?.totalPages ?? 0} onPageChange={setSalesPage} />
                </div>

                <div className="seller-profile-panel activity-panel">
                  <PanelTitle title="Actividad reciente" />
                  <div className="seller-profile-activity">
                    {recentActivity.length ? recentActivity.map((activity, index) => <ActivityCard key={`${activity.title}-${index}`} {...activity} />) : <p className="row-sub">No hay actividad reciente.</p>}
                  </div>
                  <ProfilePagination page={currentActivityPage} totalPages={activityTotalPages} onPageChange={setActivityPage} />
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

      <SellerRetirosModal
        isOpen={isRetirosModalOpen}
        onClose={() => setIsRetirosModalOpen(false)}
        seller={seller}
        retiros={sellerRetirosSorted}
        isLoading={isSellerRetirosLoading}
      />
    </>
  );
}
