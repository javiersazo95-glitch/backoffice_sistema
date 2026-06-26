import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as supportApi from '@/api/support';
import * as sellersApi from '@/api/sellers';
import UiIcon from '@/components/shared/UiIcon';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import Badge from '@/components/shared/Badge';
import SupportTicketDetailModal from './SupportTicketDetailModal';
import { showToast } from '@/components/layout/Toast';
import { PAGE_SIZES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import type { TicketResponse, TicketStatus, TicketPriority, TicketCategory, ReporterType, TicketPlatform } from '@/api/support';

const PLATFORM_LABELS: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App Mobile RepuesTop',
};

const PLATFORM_TONES: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'green',
  MEDIACION_CONFIANZA: 'violet',
  APP_MOBILE: 'blue',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  FALLA_TECNICA: 'Falla Técnica',
  SOLICITUD_AYUDA: 'Ayuda',
  CONSULTA: 'Consulta',
};

const REPORTER_LABELS: Record<ReporterType, string> = {
  COMPRADOR: 'Comprador',
  VENDEDOR: 'Vendedor',
  INTERNO: 'Interno',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  PENDIENTE_VENDEDOR: 'Pendiente vendedor',
  PENDIENTE_COMPRADOR: 'Pendiente comprador',
  SLA_VENCIDO: 'SLA vencido',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
};

const STATUS_TONES: Record<TicketStatus, string> = {
  ABIERTO: 'blue',
  EN_PROCESO: 'amber',
  PENDIENTE_VENDEDOR: 'violet',
  PENDIENTE_COMPRADOR: 'violet',
  SLA_VENCIDO: 'red',
  RESUELTO: 'green',
  CERRADO: 'green',
  CANCELADO: 'red',
};

const PRIORITY_TONES: Record<TicketPriority, string> = {
  CRITICA: 'red',
  ALTA: 'red',
  MEDIA: 'amber',
  BAJA: 'green',
};

const CATEGORY_TONES: Record<TicketCategory, string> = {
  FALLA_TECNICA: 'red',
  SOLICITUD_AYUDA: 'amber',
  CONSULTA: 'blue',
};

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('es-CL').format(value);
}

function isTicketSelected(ticket: TicketResponse | null): ticket is TicketResponse {
  return ticket !== null;
}

function showLegacyTicketModal() {
  return false;
}

function ReportMetricRow({ icon, label, detail, value, total, tone }: {
  icon: string;
  label: string;
  detail: string;
  value: number;
  total: number;
  tone: string;
}) {
  const width = percent(value, total);
  return (
    <div className={`support-report-metric-row tone-${tone}`}>
      <span className="support-report-metric-icon"><UiIcon name={icon} /></span>
      <div className="support-report-metric-copy">
        <div className="support-report-metric-label">
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>
        <div className="support-report-metric-track"><span style={{ width: `${width}%` }} /></div>
      </div>
      <strong className="support-report-metric-value">{compactNumber(value)}</strong>
      <span className="support-report-metric-percent">{width}%</span>
    </div>
  );
}

function ReportMetricCard({ icon, title, total, children, tooltipTitle, tooltipText, tone = 'blue' }: {
  icon: string;
  title: string;
  total: number;
  children: React.ReactNode;
  tooltipTitle: string;
  tooltipText: string;
  tone?: string;
}) {
  return (
    <article className={`support-report-card tone-${tone}`}>
      <header className="support-report-card-header">
        <span className="support-report-card-icon"><UiIcon name={icon} /></span>
        <h3>{title}</h3>
        <button className="support-report-card-info" type="button" aria-label={`Información sobre ${title}`}>
          <UiIcon name="info" />
          <span className="support-report-tooltip" role="tooltip">
            <strong>{tooltipTitle}</strong>
            <span>{tooltipText}</span>
          </span>
        </button>
      </header>
      <div className="support-report-card-body">{children}</div>
      <footer className="support-report-card-footer">
        <UiIcon name="trendUp" />
        <span>Total: <strong>{compactNumber(total)}</strong> {total === 1 ? 'reporte' : 'reportes'}</span>
      </footer>
    </article>
  );
}

export default function SupportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = useMemo(() => {
    return location.pathname.endsWith('/tickets') ? 'tickets' : 'resumen';
  }, [location.pathname]);

  const { data: workspaceData = {
    newTickets: 0, openTickets: 0, urgentTickets: 0, expiredSlaTickets: 0,
    totalTickets: 0, technicalFailureTickets: 0, helpRequestTickets: 0, inquiryTickets: 0,
    buyerReporterTickets: 0, sellerReporterTickets: 0, internalReporterTickets: 0,
    accountingPlatformTickets: 0, trustPlatformTickets: 0, mobilePlatformTickets: 0,
  } } = useQuery({
    queryKey: ['support-workspace'],
    queryFn: supportApi.getWorkspace,
  });

  const resolutionRate = useMemo(() => {
    const total = workspaceData.openTickets + workspaceData.expiredSlaTickets;
    if (!total) return 0;
    return Math.round((workspaceData.expiredSlaTickets / total) * 100);
  }, [workspaceData.openTickets, workspaceData.expiredSlaTickets]);
  
  // Filtros de Tickets
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [platformFilter, setPlatformFilter] = useState<TicketPlatform | 'All'>('All');
  const [page, setPage] = useState(0);

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketResponse | null>(null);
  const [nextActionNotes, setNextActionNotes] = useState('');

  // Formulario nuevo ticket
  const [newReason, setNewReason] = useState('');
  const [newLastMessage, setNewLastMessage] = useState('');
  const [newCategory, setNewCategory] = useState<TicketCategory>('FALLA_TECNICA');
  const [newPriority, setNewPriority] = useState<TicketPriority>('MEDIA');
  const [newReporterType, setNewReporterType] = useState<ReporterType>('COMPRADOR');
  const [newReporterName, setNewReporterName] = useState('');
  const [newSellerId, setNewSellerId] = useState<number | null>(null);
  const [newPlatform, setNewPlatform] = useState<TicketPlatform | ''>('');
  const isInternalTicketPlatform = newPlatform === 'ADMINISTRACION_CONTABLE' || newPlatform === 'MEDIACION_CONFIANZA';

  const queryClient = useQueryClient();

  const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
    queryKey: ['support-tickets', search, statusFilter, priorityFilter, categoryFilter, platformFilter, page],
    queryFn: () => supportApi.getTickets({
      search: search || undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
      priority: priorityFilter !== 'All' ? priorityFilter : undefined,
      category: categoryFilter !== 'All' ? categoryFilter : undefined,
      platform: platformFilter !== 'All' ? platformFilter : undefined,
      page,
      size: 10,
    }),
  });

  // Query de sellers para el selector del nuevo ticket
  const { data: sellersData } = useQuery({
    queryKey: ['support-sellers-lookup'],
    queryFn: () => sellersApi.getSellers({ page: 0, size: PAGE_SIZES.MAX }),
  });

  // Query global para dashboard (distribuciones)
  const { data: globalTicketsData } = useQuery({
    queryKey: ['support-tickets-global'],
    queryFn: () => supportApi.getTickets({ page: 0, size: 100 }),
    enabled: activeTab === 'resumen',
  });

  const sellers = sellersData?.content ?? [];
  const globalTickets = globalTicketsData?.content ?? [];

  const reportStats = useMemo(() => {
    const count = (predicate: (ticket: TicketResponse) => boolean) => globalTickets.filter(predicate).length;
    const backendTotal = workspaceData.totalTickets;

    return {
      total: backendTotal ?? globalTicketsData?.totalElements ?? globalTickets.length,
      technicalFailures: workspaceData.technicalFailureTickets ?? count((ticket) => ticket.category === 'FALLA_TECNICA'),
      helpRequests: workspaceData.helpRequestTickets ?? count((ticket) => ticket.category === 'SOLICITUD_AYUDA'),
      inquiries: workspaceData.inquiryTickets ?? count((ticket) => ticket.category === 'CONSULTA'),
      buyers: workspaceData.buyerReporterTickets ?? count((ticket) => ticket.reporterType === 'COMPRADOR'),
      sellers: workspaceData.sellerReporterTickets ?? count((ticket) => ticket.reporterType === 'VENDEDOR'),
      internal: workspaceData.internalReporterTickets ?? count((ticket) => ticket.reporterType === 'INTERNO'),
      accounting: workspaceData.accountingPlatformTickets ?? count((ticket) => ticket.platform === 'ADMINISTRACION_CONTABLE'),
      trust: workspaceData.trustPlatformTickets ?? count((ticket) => ticket.platform === 'MEDIACION_CONFIANZA'),
      mobile: workspaceData.mobilePlatformTickets ?? count((ticket) => ticket.platform === 'APP_MOBILE' || !ticket.platform),
    };
  }, [globalTickets, globalTicketsData?.totalElements, workspaceData]);

  const { data: selectedTicketDetail, isFetching: isLoadingTicketDetail } = useQuery({
    queryKey: ['support-ticket-detail', selectedTicket?.id],
    queryFn: () => supportApi.getTicketById(selectedTicket!.id),
    enabled: selectedTicket !== null,
    placeholderData: selectedTicket ?? undefined,
  });

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-global'] });
      setCreateModalOpen(false);
      resetCreateForm();
      showToast('Ticket creado exitosamente');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error al crear ticket');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, nextAction }: { id: number; status: TicketStatus; nextAction?: string }) =>
      supportApi.updateTicketStatus(id, { status, nextAction }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['support-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-global'] });
      queryClient.setQueryData(['support-ticket-detail', updated.id], updated);
      setSelectedTicket((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
      setNextActionNotes('');
      showToast('Estado del ticket actualizado');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error al actualizar ticket');
    },
  });

  // Funciones control de formulario
  function resetCreateForm() {
    setNewReason('');
    setNewLastMessage('');
    setNewCategory('FALLA_TECNICA');
    setNewPriority('MEDIA');
    setNewReporterType('COMPRADOR');
    setNewReporterName('');
    setNewSellerId(null);
    setNewPlatform('');
  }

  function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newReason.trim() || !newLastMessage.trim() || !newReporterName.trim()) {
      showToast('Por favor completa todos los campos requeridos');
      return;
    }
    createMutation.mutate({
      reason: newReason,
      lastMessage: newLastMessage,
      category: newCategory,
      priority: newPriority,
      reporterType: newReporterType,
      reporterName: newReporterName,
      sellerId: newReporterType === 'VENDEDOR' ? newSellerId : null,
      platform: newPlatform || null,
    });
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setPlatformFilter('All');
    setPage(0);
  }

  // Cálculos estadísticas del Dashboard
  const stats = useMemo(() => {
    const criticalTickets = [...globalTickets]
      .filter(t => t.status !== 'RESUELTO' && t.status !== 'CERRADO' && (t.priority === 'CRITICA' || t.priority === 'ALTA'))
      .slice(0, 5);

    return { criticalTickets };
  }, [globalTickets]);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Soporte Técnico</h1>
          <p>Mesa de ayuda MVP para incidencias operativas y consultas de uso</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={() => setCreateModalOpen(true)}>
            <UiIcon name="plus" />
            Crear ticket
          </button>
          <AreaHomeShortcut />
        </div>
      </div>

      <nav className="module-tabs" aria-label="Vistas de soporte">
        <button
          className={activeTab === 'resumen' ? 'active' : ''}
          onClick={() => navigate('/soporte')}
          type="button"
        >
          <UiIcon name="dashboard" />
          Resumen
        </button>
        <button
          className={activeTab === 'tickets' ? 'active' : ''}
          onClick={() => navigate('/soporte/tickets')}
          type="button"
        >
          <UiIcon name="message" />
          Tickets
        </button>
      </nav>

      {activeTab === 'resumen' ? (
        /* VISTA: RESUMEN / DASHBOARD */
        <div style={{ marginTop: '24px' }}>
          {/* Hero de Comando de Soporte */}
          <section className="trust-command-hero" style={{ '--tone': 'var(--blue)', '--tone-soft': '#eef5ff', marginBottom: '24px' } as React.CSSProperties}>
            <div className="trust-command-copy">
              <span className="trust-hero-eyebrow">
                <UiIcon name="message" />
                Mesa de Operaciones
              </span>
              <h1>Control de Soporte</h1>
              <p>Monitoreo en tiempo real de fallas técnicas de la aplicación, dudas operativas y consultas generales de usuarios.</p>
              <div className="trust-hero-kpis" aria-label="Indicadores principales">
                <div className="trust-hero-kpi">
                  <span className="trust-hero-kpi-icon" style={{ color: 'var(--blue)', background: '#eef5ff' }}><UiIcon name="message" /></span>
                  <div><span>Por responder</span><strong>{workspaceData.newTickets}</strong></div>
                </div>
                <div className="trust-hero-kpi">
                  <span className="trust-hero-kpi-icon" style={{ color: 'var(--amber)', background: '#fff6e8' }}><UiIcon name="clock" /></span>
                  <div><span>Bandeja activa</span><strong>{workspaceData.openTickets}</strong></div>
                </div>
                <div className="trust-hero-kpi">
                  <span className="trust-hero-kpi-icon" style={{ color: 'var(--red)', background: '#fff0ef' }}><UiIcon name="alert" /></span>
                  <div><span>SLA crítico</span><strong>{workspaceData.urgentTickets}</strong></div>
                </div>
              </div>
            </div>

            <div className="trust-command-actions">
              <AreaHomeShortcut />
              <div className="trust-command-score" aria-label={`Tasa de resolución ${resolutionRate}%`}>
                <div className="trust-score-orbit" style={{ background: `conic-gradient(var(--blue) 0 ${resolutionRate}%, rgba(37,99,235,.08) ${resolutionRate}% 100%)` }}>
                  <div className="trust-score-core">
                    <strong>{resolutionRate}%</strong>
                  </div>
                </div>
                <div className="trust-score-summary">
                  <span className="trust-score-summary-icon" style={{ background: 'var(--blue)' }}><UiIcon name="check" /></span>
                  <strong>Tasa de Resolución</strong>
                  <Badge text={resolutionRate >= 80 ? 'Excelente' : resolutionRate >= 50 ? 'Estable' : 'Crítico'} variant={resolutionRate >= 80 ? 'green' : resolutionRate >= 50 ? 'amber' : 'red'} />
                </div>
              </div>
            </div>
          </section>

          {/* Layout de Distribuciones y Feed Crítico */}
          <div className="module-layout wide-main">
            <div className="validation-detail-stack" style={{ display: 'grid', gap: '16px' }}>
              <section className="support-report-metrics" aria-label="Estadísticas de reportes">
                <ReportMetricCard
                  icon="dashboard"
                  title="Por categoría"
                  total={reportStats.total}
                  tooltipTitle="Clasificación del motivo"
                  tooltipText="Agrupa los tickets según el tipo de necesidad reportada. Permite al encargado de soporte distinguir fallas técnicas que requieren diagnóstico, solicitudes de ayuda operativa y consultas generales de funcionamiento."
                >
                  <ReportMetricRow icon="alert" label="Fallas técnicas" detail="Errores / Bugs" value={reportStats.technicalFailures} total={reportStats.total} tone="red" />
                  <ReportMetricRow icon="help" label="Solicitudes de ayuda" detail="Asistencia operativa" value={reportStats.helpRequests} total={reportStats.total} tone="amber" />
                  <ReportMetricRow icon="message" label="Consultas" detail="Funcionamiento" value={reportStats.inquiries} total={reportStats.total} tone="blue" />
                </ReportMetricCard>

                <ReportMetricCard
                  icon="users"
                  title="Por tipo de reportante"
                  total={reportStats.total}
                  tone="violet"
                  tooltipTitle="Origen del solicitante"
                  tooltipText="Muestra quién generó los tickets: compradores de la aplicación, vendedores o tiendas, y personal interno. Ayuda a priorizar la atención y adaptar la respuesta al perfil del usuario afectado."
                >
                  <ReportMetricRow icon="users" label="Compradores" detail="Usuarios" value={reportStats.buyers} total={reportStats.total} tone="blue" />
                  <ReportMetricRow icon="cart" label="Vendedores" detail="Tiendas" value={reportStats.sellers} total={reportStats.total} tone="green" />
                  <ReportMetricRow icon="shield" label="Interno" detail="Staff / Monitores" value={reportStats.internal} total={reportStats.total} tone="violet" />
                </ReportMetricCard>

                <ReportMetricCard
                  icon="monitor"
                  title="Por plataforma"
                  total={reportStats.total}
                  tooltipTitle="Área del sistema afectada"
                  tooltipText="Distribuye los tickets por el área donde ocurrió el problema: Administración Contable para operaciones financieras, Mediación y Confianza para disputas y validaciones, y App Mobile para la experiencia de compradores y vendedores."
                >
                  <ReportMetricRow icon="barChart" label="Administración" detail="Contable" value={reportStats.accounting} total={reportStats.total} tone="blue" />
                  <ReportMetricRow icon="handshake" label="Mediación y" detail="Confianza" value={reportStats.trust} total={reportStats.total} tone="violet" />
                  <ReportMetricRow icon="smartphone" label="App Mobile" detail="RepuesTop" value={reportStats.mobile} total={reportStats.total} tone="green" />
                </ReportMetricCard>
              </section>

              <div className="trust-pulse-note" style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}>
                <UiIcon name="alert" />
                <span><strong>Flujo Operativo de Soporte:</strong> Las fallas técnicas de prioridad crítica tienen un SLA de 2 horas. Si un ticket reporta problemas con pasarelas de pago o autenticación, notifica de inmediato al canal #infraestructura.</span>
              </div>
            </div>

            <aside className="side-panel" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <article className="trust-panel" style={{ height: '100%' }}>
                <div className="trust-panel-head">
                  <div>
                    <span>Bandeja Crítica</span>
                    <h2>Tickets Urgentes Activos</h2>
                  </div>
                  <Badge text={`${stats.criticalTickets.length} críticos`} variant="red" />
                </div>
                <div className="trust-feed" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {stats.criticalTickets.length === 0 ? (
                    <div className="trust-empty-state" style={{ padding: '32px' }}>
                      <UiIcon name="check" />
                      <span>No hay tickets críticos o urgentes activos.</span>
                    </div>
                  ) : (
                    stats.criticalTickets.map((ticket) => (
                      <div className="trust-feed-item" key={ticket.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className={`trust-feed-icon ${ticket.priority === 'CRITICA' ? 'red' : 'amber'}`} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                              <UiIcon name="alert" />
                            </span>
                            <strong>{ticket.externalId}</strong>
                          </div>
                          <Badge text={STATUS_LABELS[ticket.status]} variant={STATUS_TONES[ticket.status]} />
                        </div>
                        
                        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)' }}>{ticket.reason}</span>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                          <span>Por: {ticket.reporterName}</span>
                          <span>SLA: {ticket.sla}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--soft-line)' }}>
                          <Badge text={PRIORITY_LABELS[ticket.priority]} variant={PRIORITY_TONES[ticket.priority]} />
                          <button className="primary-button" type="button" onClick={() => setSelectedTicket(ticket)} style={{ minHeight: '28px', height: '28px', padding: '0 10px', fontSize: '11px', borderRadius: '4px' }}>
                            <UiIcon name="arrowRight" />
                            Atender
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </aside>
          </div>
        </div>
      ) : (
        /* VISTA: TICKETS (LISTADO Y FILTROS) */
        <div className="support-tickets-layout" style={{ marginTop: '24px' }}>
          <div className="validation-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', minHeight: 'auto', padding: '16px 20px', alignItems: 'center' }}>
            <label className="validation-search-field" style={{ flex: '2 1 280px', margin: 0 }}>
              <UiIcon name="search" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por ID, reportante o motivo..."
              />
            </label>

            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Estado</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">Todos</option>
                {Object.entries(STATUS_LABELS)
                  .filter(([val]) => val !== 'PENDIENTE_VENDEDOR' && val !== 'PENDIENTE_COMPRADOR')
                  .map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                  ))}
              </select>
            </label>

            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Prioridad</span>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="All">Todas</option>
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>

            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Categoría</span>
              <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}>
                <option value="All">Todas</option>
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>

            <label className="validation-filter-field" style={{ flex: '1 1 190px', margin: 0 }}>
              <span>Plataforma</span>
              <select value={platformFilter} onChange={(e) => {
                setPlatformFilter(e.target.value as TicketPlatform | 'All');
                setPage(0);
              }}>
                <option value="All">Todas</option>
                <option value="ADMINISTRACION_CONTABLE">Administración Contable</option>
                <option value="MEDIACION_CONFIANZA">Mediación y Confianza</option>
                <option value="APP_MOBILE">App Mobile RepuesTop</option>
              </select>
            </label>

            <button className="validation-clear-button" type="button" onClick={clearFilters} style={{ flex: '0 0 auto', margin: 0 }}>
              <UiIcon name="filter" />
              Limpiar
            </button>
          </div>

          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Ticket</th>
                    <th style={{ width: '120px' }}>Fecha</th>
                    <th style={{ width: '130px' }}>Reportante</th>
                    <th style={{ width: '100px' }}>Tipo</th>
                    <th style={{ width: '160px' }}>Plataforma</th>
                    <th style={{ width: '130px' }}>Categoría</th>
                    <th>Asunto / Falla</th>
                    <th style={{ width: '100px' }}>Prioridad</th>
                    <th style={{ width: '120px' }}>Estado</th>
                    <th style={{ width: '100px' }}>SLA</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTickets ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '32px' }}>Cargando tickets...</td>
                    </tr>
                  ) : !ticketsData || ticketsData.content.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No se encontraron tickets con los filtros seleccionados.</td>
                    </tr>
                  ) : (
                    ticketsData.content.map((ticket) => (
                      <tr key={ticket.id}>
                        <td><strong>{ticket.externalId}</strong></td>
                        <td>{formatDate(ticket.createdAt)}</td>
                        <td>{ticket.reporterName}</td>
                        <td>{REPORTER_LABELS[ticket.reporterType]}</td>
                        <td>
                          {ticket.platform ? (
                            <Badge text={PLATFORM_LABELS[ticket.platform]} variant={PLATFORM_TONES[ticket.platform]} />
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>General / App</span>
                          )}
                        </td>
                        <td>
                          <Badge text={CATEGORY_LABELS[ticket.category]} variant={CATEGORY_TONES[ticket.category]} />
                        </td>
                        <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.reason}
                        </td>
                        <td>
                          <Badge text={PRIORITY_LABELS[ticket.priority]} variant={PRIORITY_TONES[ticket.priority]} />
                        </td>
                        <td>
                          <Badge text={STATUS_LABELS[ticket.status]} variant={STATUS_TONES[ticket.status]} />
                        </td>
                        <td><small>{ticket.sla || 'N/A'}</small></td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="seller-actions" style={{ minWidth: 'auto', justifyContent: 'center' }}>
                            <button className="row-action" type="button" onClick={() => setSelectedTicket(ticket)} title="Ver detalles">
                              <UiIcon name="arrowRight" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {ticketsData && ticketsData.totalPages > 1 && (
              <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', alignItems: 'center' }}>
                <span>Mostrando página {page + 1} de {ticketsData.totalPages} ({ticketsData.totalElements} tickets)</span>
                <div className="page-buttons">
                  <button className="page-button" disabled={page === 0} onClick={() => setPage(page - 1)} type="button">Anterior</button>
                  <button className="page-button" disabled={page === ticketsData.totalPages - 1} onClick={() => setPage(page + 1)} type="button">Siguiente</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE TICKET */}
      {selectedTicket && (
        <SupportTicketDetailModal
          ticket={selectedTicketDetail ?? selectedTicket}
          isLoading={isLoadingTicketDetail}
          isUpdating={updateStatusMutation.isPending}
          notes={nextActionNotes}
          onNotesChange={setNextActionNotes}
          onClose={() => {
            setSelectedTicket(null);
            setNextActionNotes('');
          }}
          onStatusChange={(status) => updateStatusMutation.mutate({
            id: selectedTicket.id,
            status,
            nextAction: nextActionNotes.trim() || undefined,
          })}
        />
      )}

      {isTicketSelected(selectedTicket) && showLegacyTicketModal() && (
        <div className="case-modal-backdrop" onClick={() => setSelectedTicket(null)}>
          <div className="case-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="case-modal-header" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
              <div className="case-modal-icon blue" style={{ width: '48px', height: '48px', borderRadius: '12px' }}>
                <UiIcon name="message" />
              </div>
              <div className="case-modal-title">
                <span className="case-modal-kicker">Detalle del reporte · {selectedTicket.externalId}</span>
                <h2>{selectedTicket.reason}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setSelectedTicket(null)}>Cerrar</button>
            </div>

            <div className="case-modal-body" style={{ padding: '24px 0' }}>
              <div className="case-modal-grid" style={{ marginBottom: '24px' }}>
                <div className="modal-field wide">
                  <span>Reportante</span>
                  <strong>{selectedTicket.reporterName}</strong>
                </div>
                <div className="modal-field">
                  <span>Tipo de Usuario</span>
                  <strong>{REPORTER_LABELS[selectedTicket.reporterType]}</strong>
                </div>
                <div className="modal-field">
                  <span>Fecha de Creación</span>
                  <strong>{formatDate(selectedTicket.createdAt)}</strong>
                </div>
                <div className="modal-field">
                  <span>Categoría</span>
                  <Badge text={CATEGORY_LABELS[selectedTicket.category]} variant={CATEGORY_TONES[selectedTicket.category]} />
                </div>
                <div className="modal-field">
                  <span>Prioridad</span>
                  <Badge text={PRIORITY_LABELS[selectedTicket.priority]} variant={PRIORITY_TONES[selectedTicket.priority]} />
                </div>
                <div className="modal-field">
                  <span>Estado actual</span>
                  <Badge text={STATUS_LABELS[selectedTicket.status]} variant={STATUS_TONES[selectedTicket.status]} />
                </div>
                <div className="modal-field">
                  <span>SLA / Tiempo Restante</span>
                  <strong>{selectedTicket.sla || 'No especificado'}</strong>
                </div>
                <div className="modal-field">
                  <span>Plataforma Origen</span>
                  <strong>{selectedTicket.platform ? PLATFORM_LABELS[selectedTicket.platform] : 'App Mobile / General'}</strong>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Descripción de la Falla / Consulta</span>
                <div style={{ padding: '16px', background: 'var(--soft)', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {selectedTicket.lastMessage}
                </div>
              </div>

              {selectedTicket.nextAction && (
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Nota / Acción de Resolución Interna</span>
                  <div style={{ padding: '16px', background: '#dff5e9', border: '1px solid #159447', borderRadius: '12px', color: '#116630', fontSize: '13px', lineHeight: '1.5' }}>
                    {selectedTicket.nextAction}
                  </div>
                </div>
              )}

              {/* Formulario nota resolución */}
              {selectedTicket.status !== 'RESUELTO' && selectedTicket.status !== 'CERRADO' && (
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label htmlFor="nextActionNotes" style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Notas Técnicas de Solución (Opcional)</label>
                  <textarea
                    id="nextActionNotes"
                    value={nextActionNotes}
                    onChange={(e) => setNextActionNotes(e.target.value)}
                    placeholder="Describe los pasos de resolución, respuesta entregada o siguientes acciones..."
                    rows={3}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                {selectedTicket.status === 'ABIERTO' && (
                  <button
                    className="validation-action-button approve"
                    type="button"
                    onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'EN_PROCESO', nextAction: nextActionNotes })}
                    disabled={updateStatusMutation.isPending}
                    style={{ background: 'var(--blue)', color: '#fff' }}
                  >
                    <UiIcon name="clock" />
                    Atender e iniciar proceso
                  </button>
                )}
                {selectedTicket.status !== 'RESUELTO' && selectedTicket.status !== 'CERRADO' && (
                  <button
                    className="validation-action-button approve"
                    type="button"
                    onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'RESUELTO', nextAction: nextActionNotes })}
                    disabled={updateStatusMutation.isPending}
                    style={{ background: '#159447', color: '#fff' }}
                  >
                    <UiIcon name="check" />
                    Resolver ticket
                  </button>
                )}
                {selectedTicket.status !== 'CERRADO' && (
                  <button
                    className="validation-action-button reject"
                    type="button"
                    onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'CERRADO', nextAction: nextActionNotes })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <UiIcon name="close" />
                    Cerrar ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR TICKET */}
      {createModalOpen && (
        <div className="case-modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="case-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="case-modal-header" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
              <div className="case-modal-icon blue" style={{ width: '48px', height: '48px', borderRadius: '12px' }}>
                <UiIcon name="plus" />
              </div>
              <div className="case-modal-title">
                <h2>Crear Nuevo Ticket de Soporte</h2>
                <p>Ingresa una falla técnica, consulta o solicitud de ayuda</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setCreateModalOpen(false)}>Cerrar</button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Tipo de Reportante</span>
                  <select value={newReporterType} disabled={isInternalTicketPlatform} onChange={(e) => {
                    setNewReporterType(e.target.value as ReporterType);
                    setNewSellerId(null);
                  }}>
                    {Object.entries(REPORTER_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  {isInternalTicketPlatform && (
                    <small style={{ color: 'var(--blue)', lineHeight: 1.35 }}>
                      Los tickets de esta área corresponden siempre a staff o monitores internos.
                    </small>
                  )}
                </label>

                <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Nombre del Reportante</span>
                  <input
                    type="text"
                    value={newReporterName}
                    onChange={(e) => setNewReporterName(e.target.value)}
                    placeholder="Ej. Juan Pérez, Tienda NeoMotor"
                    required
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              {/* Selector de Tienda (Solo si reportante es Vendedor) */}
              {newReporterType === 'VENDEDOR' && !isInternalTicketPlatform && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span>Tienda asociada (Opcional)</span>
                    <select value={newSellerId ?? ''} onChange={(e) => setNewSellerId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Seleccionar tienda...</option>
                      {sellers.map((s) => (
                        <option key={s.id} value={s.id}>{s.storeName} (RUT: {s.rut})</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Categoría</span>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as TicketCategory)}>
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Prioridad</span>
                  <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TicketPriority)}>
                    {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Plataforma Origen (Opcional)</span>
                  <select value={newPlatform} onChange={(e) => {
                    const platform = e.target.value as TicketPlatform | '';
                    setNewPlatform(platform);
                    if (platform === 'ADMINISTRACION_CONTABLE' || platform === 'MEDIACION_CONFIANZA') {
                      setNewReporterType('INTERNO');
                      setNewSellerId(null);
                    }
                  }}>
                    <option value="">General / App Mobile</option>
                    {Object.entries(PLATFORM_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Asunto o Título de la Incidencia</span>
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Ej. Problemas de carga en menú de configuración"
                    required
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="validation-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>Descripción del Reporte / Mensaje Inicial</span>
                  <textarea
                    value={newLastMessage}
                    onChange={(e) => setNewLastMessage(e.target.value)}
                    placeholder="Describe los detalles de la falla, pasos de reproducción o la ayuda solicitada..."
                    rows={4}
                    required
                    style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--line)', resize: 'vertical' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                <button className="ghost-button" type="button" onClick={() => setCreateModalOpen(false)}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={createMutation.isPending}>
                  <UiIcon name="check" />
                  Guardar ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
