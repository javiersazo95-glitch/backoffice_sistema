import { useState, useMemo, useEffect } from 'react';
import { KpiTile, ActionQueue, InsightList, MiniBars } from '@/components/dashboard/kit';
import { summarizeTickets, PLATFORM_LABELS as DASH_PLATFORM_LABELS } from './support.metrics';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import { buildSupportInsights } from './support.insights';
import { formatAge, hoursSince, ageTone } from '@/utils/age';
import { fetchAllPages } from '@/utils/pagination';
import { mensajeDeError } from '@/api/client';
import CapturerAvatar from '@/components/capturers/CapturerAvatar';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as supportApi from '@/api/support';
import UiIcon from '@/components/shared/UiIcon';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import Badge from '@/components/shared/Badge';
import FounderSellerName from '@/components/shared/FounderSellerName';
import SupportTicketDetailModal, { getStatusLabel } from './SupportTicketDetailModal';
import { showToast } from '@/components/layout/Toast';
import { formatDate } from '@/utils/formatters';
import type { TicketResponse, TicketStatus, TicketPriority, TicketCategory, ReporterType, TicketPlatform, TicketMessage } from '@/api/support';
import { useAuth } from '@/context/AuthContext';
import { hasBackofficePermission } from '@/hooks/usePermissions';
import { previewDocument } from '@/utils/documentUrls';
import { useIsMobile } from '@/hooks/useIsMobile';
import { RecordCard, RecordList, EmptyState, FilterSheet, FilterTrigger, DetailHost } from '@/components/mobile';
import { countActiveFilters } from '@/utils/filters';
import SoporteCargaInventarioView, { useResumenCargaInventario } from './cargaInventario/SoporteCargaInventarioView';

const PLATFORM_LABELS: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App Mobile RepuesTop',
  SOPORTE: 'Soporte',
  SITIO_WEB: 'Sitio Web',
};

const PLATFORM_TONES: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'green',
  MEDIACION_CONFIANZA: 'violet',
  APP_MOBILE: 'blue',
  SOPORTE: 'amber',
  SITIO_WEB: 'orange',
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

const QA_STATUS_FILTER_OPTIONS: Array<{ value: TicketStatus; label: string }> = [
  { value: 'ABIERTO', label: 'Pendiente' },
  { value: 'EN_PROCESO', label: 'En revisión' },
  { value: 'PENDIENTE_VENDEDOR', label: 'Listo para revisión' },
  { value: 'PENDIENTE_COMPRADOR', label: 'Con observaciones' },
  { value: 'RESUELTO', label: 'Resuelto' },
];

const SUPPORT_QA_STATUS_FILTER_OPTIONS = QA_STATUS_FILTER_OPTIONS.filter((option) => option.value !== 'RESUELTO');

const QA_STATUS_TONE_CLASSES: Record<TicketStatus, string> = {
  ABIERTO: 's-todo',
  EN_PROCESO: 's-progress',
  PENDIENTE_VENDEDOR: 's-review',
  PENDIENTE_COMPRADOR: 's-overdue',
  SLA_VENCIDO: 's-overdue',
  RESUELTO: 's-done',
  CERRADO: 's-closed',
  CANCELADO: 's-overdue',
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

function normalizeMessageText(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}



function SupportQaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [qaTab, setQaTab] = useState<'defectos' | 'resueltos'>('defectos');
  const [search, setSearch] = useState('');
  const [defectStatusFilter, setDefectStatusFilter] = useState<TicketStatus | 'All'>('All');
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);

  // States for creating a defect
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPlatform, setNewPlatform] = useState<TicketPlatform>('APP_MOBILE');
  const [newPriority, setNewPriority] = useState<TicketPriority>('MEDIA');
  const [newEntorno, setNewEntorno] = useState('Entorno QA');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isCreatingDefect, setIsCreatingDefect] = useState(false);

  // States for review
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFile, setReviewFile] = useState<File | null>(null);

  // Fetch bugs
  const { data: qaReportsData, isLoading } = useQuery({
    queryKey: ['qa-reports'],
    queryFn: () => fetchAllPages((page, size) => supportApi.getQaReports({ page, size })),
  });

  const qaReports = qaReportsData?.content ?? [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => {
      setNewTitle('');
      setNewDescription('');
      setNewEntorno('Entorno QA');
      setNewFile(null);
      setNewPlatform('APP_MOBILE');
      setNewPriority('MEDIA');
      setCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['qa-reports'] });
      showToast('Defecto registrado con éxito');
    },
    onError: (error: any) => showToast(mensajeDeError(error, 'No se pudo registrar el defecto')),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ status, nextAction, file }: { status: TicketStatus; nextAction?: string; file: File | null }) => {
      let docUrl = undefined;
      if (file) {
        const uploadResult = await supportApi.uploadDocument(file);
        docUrl = uploadResult.url;
      }
      if (!selectedBugId) throw new Error('No hay defecto seleccionado');
      return supportApi.updateTicketStatus(selectedBugId, {
        status,
        nextAction,
        documentoUrl: docUrl
      });
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(['support-ticket-detail', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['qa-reports'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket-detail', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket-messages', updated.id] });
      setSelectedBugId(updated.id);
      if (qaTab === 'defectos' && defectStatusFilter !== 'All' && updated.status !== defectStatusFilter) {
        setDefectStatusFilter('All');
      }
      setReviewComment('');
      setReviewFile(null);
      showToast(variables.nextAction ? 'Revisión registrada con éxito' : 'Documento adjuntado con éxito');
    },
    onError: (error: any) => showToast(mensajeDeError(error, 'No se pudo registrar la revisión')),
  });

  // Client-side filtering & search
  const filteredBugs = useMemo(() => {
    return qaReports.filter(bug => {
      // Matches search term
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesSearch = bug.reason.toLowerCase().includes(term) ||
          bug.externalId.toLowerCase().includes(term) ||
          (bug.lastMessage && bug.lastMessage.toLowerCase().includes(term));
        if (!matchesSearch) return false;
      }
      // Matches tab
      const isResolved = bug.status === 'RESUELTO' || bug.status === 'CERRADO' || bug.status === 'CANCELADO';
      if (qaTab === 'defectos') {
        return !isResolved && (defectStatusFilter === 'All' || bug.status === defectStatusFilter);
      } else {
        return isResolved;
      }
    });
  }, [qaReports, search, qaTab, defectStatusFilter]);

  const activeBugs = useMemo(() => {
    return filteredBugs;
  }, [filteredBugs]);

  const resolvedBugs = useMemo(() => {
    return filteredBugs;
  }, [filteredBugs]);

  const selectedBug = useMemo(() => {
    return qaReports.find(b => b.id === selectedBugId) || null;
  }, [qaReports, selectedBugId]);

  const { data: selectedBugDetail, isFetching: isLoadingSelectedBugDetail } = useQuery({
    queryKey: ['support-ticket-detail', selectedBugId],
    queryFn: () => supportApi.getTicketById(selectedBugId!),
    enabled: selectedBugId !== null,
    placeholderData: selectedBug ?? undefined,
  });

  const selectedBugView = selectedBugDetail ?? selectedBug;

  const { data: selectedBugMessages = [], isFetching: isLoadingSelectedBugMessages } = useQuery<TicketMessage[]>({
    queryKey: ['support-ticket-messages', selectedBugId],
    queryFn: () => supportApi.getTicketMessages(selectedBugId!),
    enabled: selectedBugId !== null,
  });

  const visibleSelectedBugMessages = useMemo(() => {
    if (!selectedBugView) return [];
    const descriptionText = normalizeMessageText(selectedBugView.lastMessage);
    const reasonText = normalizeMessageText(selectedBugView.reason);
    return selectedBugMessages.filter((message) => {
      const text = normalizeMessageText(message.mensaje);
      return text && text !== descriptionText && text !== reasonText;
    });
  }, [selectedBugMessages, selectedBugView]);

  const getDefectStatusLabel = (status: string): string => {
    if (status === 'EN_PROCESO') return 'En revisión';
    if (status === 'PENDIENTE_VENDEDOR') return 'Listo para revisión';
    if (status === 'PENDIENTE_COMPRADOR') return 'Con observaciones';
    if (status === 'ABIERTO') return 'Pendiente';
    if (status === 'PENDIENTE_VENDEDOR') return 'Con observación';
    if (status === 'RESUELTO') return 'Resuelto';
    return STATUS_LABELS[status as TicketStatus] ?? status;
  };

  const getDefectStatusTone = (status: string): string => {
    if (status === 'ABIERTO') return 'gray';
    if (status === 'EN_PROCESO') return 'blue';
    if (status === 'PENDIENTE_COMPRADOR') return 'red';
    if (status === 'ABIERTO') return 'blue';
    if (status === 'EN_PROCESO') return 'amber';
    if (status === 'PENDIENTE_VENDEDOR') return 'violet';
    if (status === 'RESUELTO') return 'green';
    return 'blue';
  };

  return (
    <div className="support-qa-page">
      <div className="page-header">
        <div className="page-title">
          <h1>Registro QA</h1>
          <p>Registra y gestiona los defectos del sistema.</p>
        </div>
        <div className="header-actions">
          <AreaHomeShortcut />
        </div>
      </div>

      <nav className="module-tabs" aria-label="Bugs" style={{ marginBottom: '20px' }}>
        <button
          className={qaTab === 'defectos' ? 'active' : ''}
          onClick={() => { setQaTab('defectos'); setSelectedBugId(null); setDefectStatusFilter('All'); }}
          type="button"
        >
          <UiIcon name="alert" />
          Defectos
        </button>
        <button
          className={qaTab === 'resueltos' ? 'active' : ''}
          onClick={() => { setQaTab('resueltos'); setSelectedBugId(null); setDefectStatusFilter('All'); }}
          type="button"
        >
          <UiIcon name="fileCheck" />
          Bugs Resueltos
        </button>
      </nav>

      {qaTab === 'defectos' ? (
        <>
          <div className="validation-filters" style={{ marginBottom: '20px' }}>
            <label className="validation-search-field">
              <UiIcon name="search" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o descripción..."
              />
            </label>

            <label className="validation-filter-field" style={{ minWidth: '220px' }}>
              <span>Estado</span>
              <select
                value={defectStatusFilter}
                onChange={(e) => {
                  setDefectStatusFilter(e.target.value as TicketStatus | 'All');
                  setSelectedBugId(null);
                }}
              >
                <option value="All">Todos</option>
                {SUPPORT_QA_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <button
              className="primary-button"
              style={{ marginLeft: 'auto' }}
              type="button"
              onClick={() => setCreateModalOpen(true)}
            >
              <UiIcon name="plus" />
              Registrar Defecto
            </button>
          </div>

          <div className="validation-content-grid">
            <aside className="validation-request-list" style={{ minHeight: '400px' }}>
              {isLoading && <div className="validation-empty-state">Cargando defectos...</div>}
              {!isLoading && activeBugs.length === 0 && (
                <div className="validation-empty-state">No hay defectos registrados.</div>
              )}
              {activeBugs.map(bug => {
                const isSelected = bug.id === selectedBugId;
                return (
                  <button
                    key={bug.id}
                    className={`validation-request-card ${isSelected ? 'active' : ''}`}
                    type="button"
                    onClick={() => setSelectedBugId(bug.id)}
                  >
                    <span className="validation-request-title-row">
                      <strong>{bug.reason}</strong>
                      <span className={`status-pill tone-${getDefectStatusTone(bug.status)}`}>
                        {getDefectStatusLabel(bug.status)}
                      </span>
                    </span>
                    <span className="validation-request-meta">
                      <UiIcon name="dashboard" />
                      {PLATFORM_LABELS[bug.platform as TicketPlatform] || bug.platform}
                    </span>
                    <span className="validation-request-date">
                      <UiIcon name="calendar" />
                      {formatDate(bug.createdAt)}
                    </span>
                    <span className="validation-request-footer">
                      <span className={`validation-request-environment${bug.entorno?.toLowerCase().includes('qa') ? ' env-qa' : bug.entorno?.toLowerCase().includes('producci') ? ' env-prod' : ''}`}>
                        <UiIcon name="shield" />
                        {bug.entorno || 'No especificado'}
                      </span>
                      <span className={`status-pill tone-${PRIORITY_TONES[bug.priority]}`}>
                        {PRIORITY_LABELS[bug.priority]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </aside>

            <DetailHost
              open={Boolean(selectedBugView)}
              onClose={() => {
                setSelectedBugId(null);
                setReviewComment('');
                setReviewFile(null);
              }}
              title={selectedBugView?.reason ?? 'Defecto'}
              subtitle={selectedBugView ? getDefectStatusLabel(selectedBugView.status) : undefined}
              id="mb-qa-detail"
            >
            <main className="validation-detail-stack">
              {selectedBugView ? (
                <SupportTicketDetailModal
                  ticket={selectedBugView}
                  isLoading={isLoading || isLoadingSelectedBugDetail}
                  isUpdating={updateMutation.isPending}
                  notes={reviewComment}
                  onNotesChange={setReviewComment}
                  onClose={() => {
                    setSelectedBugId(null);
                    setReviewComment('');
                    setReviewFile(null);
                  }}
                  onStatusChange={(status) => updateMutation.mutate({
                    status,
                    nextAction: reviewComment,
                    file: reviewFile,
                  })}
                  statusContext="qa"
                  reviewFile={reviewFile}
                  onReviewFileChange={setReviewFile}
                  onAttachDocument={(file) => updateMutation.mutate({
                    status: selectedBugView.status,
                    file,
                  })}
                  embedded
                />
              ) : (
                <div className="validation-empty-state large">
                  Selecciona un defecto para revisar sus detalles.
                </div>
              )}
            </main>
            </DetailHost>

            <main className="validation-detail-stack" style={{ display: 'none' }}>
              {selectedBug ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <section className="validation-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{selectedBug.reason}</h2>
                      <span className={`status-pill tone-${getDefectStatusTone(selectedBug.status)}`}>
                        {getDefectStatusLabel(selectedBug.status)}
                      </span>
                    </div>

                    <div className="validation-info-grid">
                      <div className="validation-info-box">
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#5b6b84', display: 'block' }}>ID Externo</span>
                          <strong>{selectedBug.externalId}</strong>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#5b6b84', display: 'block' }}>Área</span>
                          <strong>{PLATFORM_LABELS[selectedBug.platform as TicketPlatform] || selectedBug.platform}</strong>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#5b6b84', display: 'block' }}>Entorno</span>
                          <strong>{selectedBug.entorno || 'No especificado'}</strong>
                        </div>
                      </div>

                      <div className="validation-info-box">
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#5b6b84', display: 'block' }}>Criticidad</span>
                          <strong>{PRIORITY_LABELS[selectedBug.priority] || selectedBug.priority}</strong>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#5b6b84', display: 'block' }}>Fecha Registro</span>
                          <strong>{formatDate(selectedBug.createdAt)}</strong>
                        </div>
                        {selectedBug.documentoUrl && (
                          <div style={{ marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#5b6b84', display: 'block' }}>Documento Adjunto</span>
                            <button
                              className="link-button"
                              type="button"
                              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--blue)', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
                              onClick={() => void previewDocument(selectedBug.documentoUrl)}
                            >
                              Ver Documento Adjunto
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="validation-panel">
                    <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px 0' }}>Descripción del Defecto</h3>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', color: '#334155' }}>
                      {selectedBug.lastMessage}
                    </div>
                  </section>

                  <section className="validation-panel">
                    <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px 0' }}>Comentarios y contexto de Soporte</h3>
                    {isLoadingSelectedBugMessages ? (
                      <div className="validation-empty-state">Cargando comentarios...</div>
                    ) : visibleSelectedBugMessages.length === 0 ? (
                      <div className="validation-empty-state">Sin comentarios de soporte registrados.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '12px' }}>
                        {visibleSelectedBugMessages.map((message) => (
                          <article key={message.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#fff' }}>
                            <strong style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', marginBottom: '4px' }}>
                              <CapturerAvatar
                                nombre={message.autorNombre || (message.autorTipo === 'SOPORTE' ? 'Soporte RepuesTop' : selectedBug.reporterName)}
                                fotoPerfil={message.autorAvatarUrl ?? (message.autorTipo === 'SOPORTE' ? null : selectedBug.reporterPhoto)}
                                size={24}
                              />
                              <FounderSellerName
                                name={message.autorNombre || (message.autorTipo === 'SOPORTE' ? (selectedBug.origin === 'QA' ? 'QA RepuesTop' : 'Soporte RepuesTop') : selectedBug.reporterName)}
                                founder={message.autorTipo !== 'SOPORTE' && selectedBug.reporterType === 'VENDEDOR' && selectedBug.sellerFounder}
                              />
                            </strong>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#334155' }}>{message.mensaje}</p>
                            <small style={{ display: 'block', marginTop: '8px', color: '#64748b' }}>{formatDate(message.createdAt)}</small>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  {selectedBug.status === 'PENDIENTE_VENDEDOR' && (
                    <section className="validation-panel">
                      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px 0' }}>Registrar revisión de QA</h3>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <label style={{ display: 'grid', gap: '6px' }}>
                          <span style={{ fontSize: '13px', color: '#334765', fontWeight: 'bold' }}>Comentario de revisión</span>
                          <textarea
                            value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}
                            placeholder="Escribe aquí las observaciones o confirmación de la corrección..."
                            rows={4}
                            style={{ width: '100%', padding: '12px', border: '1px solid #d9e3f0', borderRadius: '8px', font: 'inherit' }}
                          />
                        </label>

                        <label style={{ display: 'grid', gap: '6px' }}>
                          <span style={{ fontSize: '13px', color: '#334765', fontWeight: 'bold' }}>Documento adjunto (opcional)</span>
                          <input
                            type="file"
                            onChange={e => setReviewFile(e.target.files?.[0] || null)}
                            style={{ fontSize: '13px' }}
                          />
                        </label>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                          <button
                            className="primary-button"
                            type="button"
                            style={{ backgroundColor: 'var(--violet)' }}
                            disabled={updateMutation.isPending || !reviewComment.trim()}
                            onClick={() => updateMutation.mutate({ status: 'PENDIENTE_COMPRADOR', nextAction: reviewComment, file: reviewFile })}
                          >
                            <UiIcon name="alert" />
                            Con observaciones
                          </button>
                          <button
                            className="primary-button"
                            type="button"
                            style={{ backgroundColor: 'var(--green)' }}
                            disabled={updateMutation.isPending || !reviewComment.trim()}
                            onClick={() => updateMutation.mutate({ status: 'RESUELTO', nextAction: reviewComment, file: reviewFile })}
                          >
                            <UiIcon name="check" />
                            Corregido
                          </button>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="validation-empty-state large">
                  Selecciona un defecto para revisar sus detalles.
                </div>
              )}
            </main>
          </div>
        </>
      ) : (
        <div className="panel" style={{ padding: '18px', overflowX: 'auto' }}>
          <div className="validation-filters" style={{ marginBottom: '20px' }}>
            <label className="validation-search-field" style={{ maxWidth: '400px' }}>
              <UiIcon name="search" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
              />
            </label>
          </div>

          <table className="users-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>ID Externo</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>Nombre del Defecto</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>Área</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>Entorno</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>Criticidad</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>Fecha Creación</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    Cargando bugs resueltos...
                  </td>
                </tr>
              )}
              {!isLoading && resolvedBugs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    No hay bugs resueltos.
                  </td>
                </tr>
              )}
              {!isLoading && resolvedBugs.map(bug => (
                <tr key={bug.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{bug.externalId}</td>
                  <td style={{ padding: '12px 8px' }}>{bug.reason}</td>
                  <td style={{ padding: '12px 8px' }}>{PLATFORM_LABELS[bug.platform as TicketPlatform] || bug.platform}</td>
                  <td style={{ padding: '12px 8px' }}>{bug.entorno || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`status-pill tone-${PRIORITY_TONES[bug.priority]}`}>
                      {PRIORITY_LABELS[bug.priority] || bug.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>{formatDate(bug.createdAt)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <button
                      className="row-action"
                      type="button"
                      onClick={() => setSelectedBugId(bug.id)}
                      title="Ver detalles"
                    >
                      <UiIcon name="arrowRight" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qaTab === 'resueltos' && selectedBugView && (
        <SupportTicketDetailModal
          ticket={selectedBugView}
          isLoading={isLoading || isLoadingSelectedBugDetail}
          isUpdating={updateMutation.isPending}
          notes={reviewComment}
          onNotesChange={setReviewComment}
          onClose={() => {
            setSelectedBugId(null);
            setReviewComment('');
            setReviewFile(null);
          }}
          onStatusChange={(status) => updateMutation.mutate({
            status,
            nextAction: reviewComment,
            file: reviewFile,
          })}
          statusContext="qa"
          reviewFile={reviewFile}
          onReviewFileChange={setReviewFile}
          onAttachDocument={(file) => updateMutation.mutate({
            status: selectedBugView.status,
            file,
          })}
        />
      )}

      {createModalOpen && (
        <div className="case-modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="case-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="case-modal-header" style={{ gridTemplateColumns: '42px 1fr auto' }}>
              <div className="case-modal-icon red">
                <UiIcon name="alert" />
              </div>
              <div className="case-modal-title">
                <h2 style={{ margin: 0 }}>Registrar Nuevo Defecto</h2>
                <p style={{ margin: 0 }}>Ingresa los detalles del bug encontrado.</p>
              </div>
              <button
                className="close-button"
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setCreateModalOpen(false)}
              >
                <UiIcon name="close" style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isCreatingDefect || createMutation.isPending) return;
                if (!newTitle.trim() || !newDescription.trim() || !newEntorno.trim()) {
                  showToast('Por favor completa los campos obligatorios');
                  return;
                }

                setIsCreatingDefect(true);
                let didStartCreate = false;
                try {
                  let docUrl = undefined;
                  if (newFile) {
                    const uploadResult = await supportApi.uploadDocument(newFile);
                    docUrl = uploadResult.url;
                  }

                  didStartCreate = true;
                  await createMutation.mutateAsync({
                    reason: newTitle.trim(),
                    lastMessage: newDescription.trim(),
                    category: 'FALLA_TECNICA',
                    priority: newPriority,
                    reporterType: 'INTERNO',
                    reporterName: user?.fullName ?? 'QA RepuesTop',
                    platform: newPlatform,
                    contexto: 'QA',
                    origen: 'QA',
                    documentoUrl: docUrl,
                    entorno: newEntorno.trim()
                  });
                } catch (error: any) {
                  if (!didStartCreate) {
                    showToast(mensajeDeError(error, 'Error al registrar el defecto'));
                  }
                } finally {
                  setIsCreatingDefect(false);
                }
              }}
              style={{ padding: '20px', display: 'grid', gap: '14px' }}
            >
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Nombre del defecto *</span>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ej: Error al procesar pago duplicado"
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid #d9e3f0', borderRadius: '8px', font: 'inherit' }}
                />
              </label>

              <div className="mb-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Área *</span>
                  <select
                    value={newPlatform}
                    onChange={e => setNewPlatform(e.target.value as TicketPlatform)}
                    style={{ padding: '10px', border: '1px solid #d9e3f0', borderRadius: '8px', font: 'inherit' }}
                  >
                    <option value="ADMINISTRACION_CONTABLE">Administración Contable</option>
                    <option value="SOPORTE">Soporte</option>
                    <option value="MEDIACION_CONFIANZA">Mediación y Confianza</option>
                    <option value="APP_MOBILE">Aplicación móvil</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Criticidad *</span>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as TicketPriority)}
                    style={{ padding: '10px', border: '1px solid #d9e3f0', borderRadius: '8px', font: 'inherit' }}
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica</option>
                  </select>
                </label>
              </div>

              <div className="mb-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Entorno *</span>
                  <select
                    value={newEntorno}
                    onChange={e => setNewEntorno(e.target.value)}
                    required
                    style={{ padding: '10px', border: '1px solid #d9e3f0', borderRadius: '8px', font: 'inherit' }}
                  >
                    <option value="Entorno QA">Entorno QA</option>
                    <option value="Local">Local</option>
                    <option value="Producción">Producción</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Documento adjunto (opcional)</span>
                  <input
                    type="file"
                    onChange={e => setNewFile(e.target.files?.[0] || null)}
                    style={{ padding: '6px 0', font: 'inherit' }}
                  />
                </label>
              </div>

              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Descripción *</span>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Detalla los pasos para reproducir el bug y el resultado esperado..."
                  rows={4}
                  required
                  style={{ width: '100%', padding: '12px', border: '1px solid #d9e3f0', borderRadius: '8px', font: 'inherit' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="page-button"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isCreatingDefect || createMutation.isPending}
                >
                  <UiIcon name="alert" />
                  {isCreatingDefect || createMutation.isPending ? 'Registrando...' : 'Registrar Defecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
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
  const { user } = useAuth();
  const isSupportOperator = hasBackofficePermission(user, 'SOPORTE', 'OPERADOR');
  const isSupportQa = hasBackofficePermission(user, 'SOPORTE', 'QA');
  const activeTab = useMemo(() => {
    if (location.pathname.endsWith('/qa-reports')) return 'qa-reports';
    if (location.pathname.endsWith('/carga-inventario')) return 'carga-inventario';
    return location.pathname.endsWith('/tickets') ? 'tickets' : 'resumen';
  }, [location.pathname]);

  const { data: workspaceData = {
    newTickets: 0, openTickets: 0, urgentTickets: 0, expiredSlaTickets: 0,
    totalTickets: 0, technicalFailureTickets: 0, helpRequestTickets: 0, inquiryTickets: 0,
    buyerReporterTickets: 0, sellerReporterTickets: 0, internalReporterTickets: 0,
    accountingPlatformTickets: 0, trustPlatformTickets: 0, mobilePlatformTickets: 0,
  }, isLoading: workspaceLoading, isError: workspaceError, error: workspaceErrorDetail, refetch: refetchWorkspace } = useQuery({
    queryKey: ['support-workspace'],
    queryFn: supportApi.getWorkspace,
    enabled: isSupportOperator,
    refetchInterval: 15000,
  });

  // Contador del tab "Soporte carga de inventario" (conversaciones abiertas y mensajes sin leer).
  const { data: cargaResumen, isLoading: cargaLoading, isError: cargaError, error: cargaErrorDetail, refetch: refetchCarga } = useResumenCargaInventario(isSupportOperator);

  // Filtros de Tickets
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [platformFilter, setPlatformFilter] = useState<TicketPlatform | 'All'>('All');
  const [page, setPage] = useState(0);
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchParams] = useSearchParams();

  // Enlaces profundos desde el resumen: /soporte/tickets?status=ABIERTO&priority=CRITICA llega
  // con la bandeja ya filtrada. Los valores son los mismos de los selectores.
  useEffect(() => {
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const platform = searchParams.get('platform');
    if (!status && !priority && !platform) return;
    setStatusFilter(status ?? 'All');
    setPriorityFilter(priority ?? 'All');
    setPlatformFilter((platform as TicketPlatform | null) ?? 'All');
    setPage(0);
  }, [searchParams]);

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
      excludeClosed: true,
      page,
      size: 10,
    }),
    enabled: isSupportOperator && activeTab === 'tickets',
    refetchInterval: 15000,
  });

  const { data: qaReportsData, isLoading: isLoadingQaReports } = useQuery({
    queryKey: ['support-qa-reports', search, statusFilter, priorityFilter, platformFilter, page],
    queryFn: () => supportApi.getQaReports({
      search: search || undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
      priority: priorityFilter !== 'All' ? priorityFilter : undefined,
      platform: platformFilter !== 'All' ? platformFilter : undefined,
      page,
      size: 10,
    }),
    enabled: isSupportOperator && activeTab === 'qa-reports',
  });

  const visibleSupportQaReports = useMemo(() => {
    return qaReportsData?.content.filter((ticket) => ticket.status !== 'RESUELTO') ?? [];
  }, [qaReportsData]);

  // Query de sellers para el selector del nuevo ticket
  const { data: sellersData } = useQuery({
    queryKey: ['support-stores-lookup'],
    queryFn: () => supportApi.getSupportStores(),
    enabled: isSupportOperator,
  });

  // Query global para dashboard (distribuciones)
  const { data: globalTicketsData, isLoading: globalLoading, isError: globalError, error: globalErrorDetail, refetch: refetchGlobal } = useQuery({
    queryKey: ['support-tickets-global'],
    queryFn: () => fetchAllPages((page, size) => supportApi.getTickets({ page, size })),
    enabled: isSupportOperator && activeTab === 'resumen',
    staleTime: 60_000,
  });

  // Defectos de QA completos, para contar los pendientes y los criticos en el resumen.
  const { data: qaAllData, isLoading: qaAllLoading, isError: qaAllError, error: qaAllErrorDetail, refetch: refetchQaAll } = useQuery({
    queryKey: ['support-qa-reports-all'],
    queryFn: () => fetchAllPages((page, size) => supportApi.getQaReports({ page, size })),
    enabled: isSupportOperator && activeTab === 'resumen',
    staleTime: 60_000,
  });

  const sellers = sellersData ?? [];
  const globalTickets = globalTicketsData?.content ?? [];

  const supportMetrics = useMemo(() => summarizeTickets(globalTickets), [globalTickets]);
  const qaAll = qaAllData?.content ?? [];
  const qaPending = qaAll.filter((t) => t.status !== 'RESUELTO' && t.status !== 'CERRADO' && t.status !== 'CANCELADO');
  const qaCritical = qaPending.filter((t) => t.priority === 'CRITICA').length;
  const cargaEsperando = cargaResumen?.porEstado?.ESPERANDO_SOPORTE ?? 0;
  const supportInsights = useMemo(() => buildSupportInsights({
    unanswered: supportMetrics.unanswered.length,
    unansweredOver24h: supportMetrics.unansweredOver24h,
    slaBreached: supportMetrics.slaBreached,
    slaBreachedByCategory: supportMetrics.slaBreachedByCategory,
    criticalUnanswered: supportMetrics.criticalUnanswered,
    cargaEsperando,
    cargaNoLeidos: cargaResumen?.noLeidos ?? 0,
    qaPending: qaPending.length,
    qaCritical,
  }), [supportMetrics, cargaEsperando, cargaResumen?.noLeidos, qaPending.length, qaCritical]);

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
    enabled: isSupportOperator && selectedTicket !== null,
    placeholderData: selectedTicket ?? undefined,
    refetchInterval: 10000,
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
      showToast(mensajeDeError(err, 'Error al crear ticket'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, nextAction, file }: { id: number; status: TicketStatus; nextAction?: string; file?: File }) => {
      let docUrl = undefined;
      if (file) {
        const uploadResult = await supportApi.uploadDocument(file);
        docUrl = uploadResult.url;
      }
      return supportApi.updateTicketStatus(id, { status, nextAction, documentoUrl: docUrl });
    },
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-global'] });
      queryClient.invalidateQueries({ queryKey: ['support-qa-reports'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket-messages', updated.id] });
      queryClient.setQueryData(['support-ticket-detail', updated.id], updated);
      setSelectedTicket((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
      setNextActionNotes('');
      showToast(variables.file ? 'Documento adjuntado con éxito' : 'Estado del ticket actualizado');
    },
    onError: (err: any) => {
      showToast(mensajeDeError(err, 'Error al actualizar ticket'));
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

  if (isSupportQa && !isSupportOperator) {
    return <SupportQaPage />;
  }

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
        <button
          className={activeTab === 'qa-reports' ? 'active' : ''}
          onClick={() => navigate('/soporte/qa-reports')}
          type="button"
        >
          <UiIcon name="alert" />
          Reportes QA
        </button>
        <button
          className={activeTab === 'carga-inventario' ? 'active' : ''}
          onClick={() => navigate('/soporte/carga-inventario')}
          type="button"
          title={cargaResumen ? `${cargaResumen.abiertos} abiertas · ${cargaResumen.noLeidos} mensajes sin leer` : undefined}
        >
          <UiIcon name="upload" />
          Soporte carga de inventario
          {cargaResumen && cargaResumen.abiertos > 0 ? (
            <span className="module-tab-count" aria-label={`${cargaResumen.abiertos} abiertas`}>{cargaResumen.abiertos}</span>
          ) : null}
          {cargaResumen && cargaResumen.noLeidos > 0 ? (
            <span className="module-tab-count unread" aria-label={`${cargaResumen.noLeidos} mensajes sin leer`}>{cargaResumen.noLeidos} sin leer</span>
          ) : null}
        </button>
      </nav>

      {activeTab === 'resumen' ? (
        /* VISTA: RESUMEN / DASHBOARD */
        <div style={{ marginTop: '24px' }}>
          {workspaceError && <QueryErrorNotice error={workspaceErrorDetail} what="los contadores de soporte" onRetry={refetchWorkspace} />}

          <section className="trust-command-hero" style={{ '--tone': 'var(--blue)', '--tone-soft': '#eef5ff', marginBottom: '24px' } as React.CSSProperties}>
            <div className="trust-command-copy">
              <span className="trust-hero-eyebrow"><UiIcon name="headset" /> Mesa de Soporte</span>
              <h1>Qué atender hoy</h1>
              <p>Cada número es un caso que espera a alguien de soporte. Haz clic para ir a la bandeja ya filtrada; el icono <UiIcon name="info" /> explica qué hacer con él.</p>
            </div>
            <div className="trust-command-actions">
              <AreaHomeShortcut />
              <div className="trust-command-score" aria-label="Respondidos a tiempo en 30 días">
                <div className="trust-score-orbit" style={{ background: `conic-gradient(var(--blue) 0 ${supportMetrics.onTime.rate ?? 0}%, rgba(37,99,235,.08) ${supportMetrics.onTime.rate ?? 0}% 100%)` }}>
                  <div className="trust-score-core"><strong>{globalLoading ? '…' : supportMetrics.onTime.rate === null ? '—' : `${supportMetrics.onTime.rate}%`}</strong></div>
                </div>
                <div className="trust-score-summary">
                  <span className="trust-score-summary-icon" style={{ background: 'var(--blue)' }}><UiIcon name="check" /></span>
                  <strong>Respondidos a tiempo</strong>
                  <span className="metric-info-tooltip" tabIndex={0}><UiIcon name="info" /><span className="metric-info-tooltip-content"><strong>Últimos 30 días</strong><p>De los tickets creados en los últimos 30 días que ya tienen respuesta o vencieron, qué porcentaje recibió su primera respuesta dentro del plazo de su categoría: 24 h fallas técnicas, 48 h solicitudes de ayuda, 72 h consultas.</p><div className="metric-info-tooltip-row"><span>A tiempo</span><b>{supportMetrics.onTime.ok}</b></div><div className="metric-info-tooltip-row"><span>Tarde o vencidos</span><b>{supportMetrics.onTime.late}</b></div></span></span>
                  {supportMetrics.onTime.rate !== null && <Badge text={supportMetrics.onTime.rate >= 90 ? 'Excelente' : supportMetrics.onTime.rate >= 70 ? 'Aceptable' : 'Mejorar'} variant={supportMetrics.onTime.rate >= 90 ? 'green' : supportMetrics.onTime.rate >= 70 ? 'amber' : 'red'} />}
                </div>
              </div>
            </div>
          </section>

          <div className="dash-row-title"><h2>Pendientes ahora</h2><span>Ordenados por urgencia</span></div>
          <section className="dash-kpi-row" aria-label="Pendientes de soporte">
            <KpiTile
              label="Sin responder"
              value={globalTicketsData ? supportMetrics.unanswered.length : workspaceData.newTickets}
              tone="red"
              urgent
              iconName="message"
              to="/soporte/tickets?status=ABIERTO"
              secondary={globalTicketsData ? `${supportMetrics.unansweredOver24h} con más de 24 horas` : undefined}
              loading={globalLoading && workspaceLoading}
              error={globalError && workspaceError ? globalErrorDetail : undefined}
              onRetry={() => { void refetchGlobal(); void refetchWorkspace(); }}
              infoContent={<><strong>Qué hacer</strong><p>Tickets que nunca han recibido una respuesta de soporte. Abre el más antiguo (lista de abajo), lee el motivo y responde por el chat; al responder pasa automáticamente a "En proceso".</p></>}
            />
            <KpiTile
              label="Fuera de plazo"
              value={globalTicketsData ? supportMetrics.slaBreached : null}
              tone="red"
              urgent
              iconName="clock"
              to="/soporte/tickets?status=ABIERTO"
              loading={globalLoading}
              error={globalError ? globalErrorDetail : undefined}
              onRetry={refetchGlobal}
              infoContent={<><strong>Qué hacer</strong><p>Sin respuesta y ya pasó el plazo de su categoría: 24 horas una falla técnica, 48 una solicitud de ayuda, 72 una consulta. Son los que más molestan al usuario: respóndelos aunque sea para decir que lo estás revisando.</p></>}
            />
            <KpiTile
              label="Urgentes activos"
              value={workspaceData.urgentTickets}
              tone="amber"
              iconName="alert"
              to="/soporte/tickets?priority=CRITICA"
              secondary={globalTicketsData ? `${supportMetrics.criticalUnanswered} críticos sin responder` : undefined}
              loading={workspaceLoading}
              error={workspaceError ? workspaceErrorDetail : undefined}
              onRetry={refetchWorkspace}
              infoContent={<><strong>Qué hacer</strong><p>Tickets abiertos con prioridad crítica o alta. Si describen un problema de pago, de acceso o de pedidos que no llegan, avisa de inmediato al canal de infraestructura además de responder.</p></>}
            />
            <KpiTile
              label="Chats de carga esperando"
              value={cargaResumen ? cargaEsperando : null}
              tone="violet"
              urgent
              iconName="upload"
              to="/soporte/carga-inventario"
              secondary={cargaResumen ? `${cargaResumen.noLeidos} mensajes sin leer · ${cargaResumen.abiertos} chats abiertos` : undefined}
              loading={cargaLoading}
              error={cargaError ? cargaErrorDetail : undefined}
              onRetry={refetchCarga}
              infoContent={<><strong>Qué hacer</strong><p>Vendedores que pidieron ayuda para subir su inventario y están esperando a soporte. Responde en el chat; si el vendedor no contesta en 24 horas tras tu respuesta, el chat se cierra solo.</p></>}
            />
            <KpiTile
              label="Defectos QA pendientes"
              value={qaAllData ? qaPending.length : null}
              tone="blue"
              iconName="shieldCheck"
              to="/soporte/qa-reports"
              secondary={qaAllData ? `${qaCritical} críticos` : undefined}
              loading={qaAllLoading}
              error={qaAllError ? qaAllErrorDetail : undefined}
              onRetry={refetchQaAll}
              infoContent={<><strong>Qué hacer</strong><p>Fallas que el equipo de QA encontró probando la aplicación. Los críticos pueden estar afectando a usuarios reales: confírmalo y márcalos "Listo para revisión" cuando el equipo los corrija.</p></>}
            />
            <KpiTile
              label="Resueltos por cerrar"
              value={globalTicketsData ? supportMetrics.resolvedPendingClose : null}
              tone="green"
              iconName="check"
              to="/soporte/tickets?status=RESUELTO"
              secondary={globalTicketsData ? `${supportMetrics.autoCloseToday} se cierran solos hoy` : undefined}
              loading={globalLoading}
              error={globalError ? globalErrorDetail : undefined}
              onRetry={refetchGlobal}
              infoContent={<><strong>Qué hacer</strong><p>Nada, salvo que el usuario vuelva a escribir (entonces se reabre). Un ticket resuelto se cierra solo a los 7 días sin respuesta del usuario.</p></>}
            />
          </section>

          <InsightList items={supportInsights} loading={globalLoading} />

          <section className="dash-grid">
            <ActionQueue
              title="Más antiguos sin respuesta"
              help={<><strong>Por dónde empezar</strong><p>Los cinco tickets sin ninguna respuesta de soporte que llevan más tiempo esperando. El color indica si ya se acerca o pasó su plazo.</p></>}
              items={supportMetrics.unanswered.slice(0, 5).map((ticket) => {
                const hours = hoursSince(ticket.createdAt) ?? 0;
                const sla = ticket.sla ? Number.parseInt(ticket.sla, 10) || 48 : 48;
                return {
                  id: ticket.id,
                  title: `${ticket.externalId} · ${ticket.reason}`,
                  subtitle: `${ticket.reporterName}${ticket.sellerName ? ` · ${ticket.sellerName}` : ''}`,
                  ageLabel: formatAge(ticket.createdAt),
                  ageTone: ageTone(hours, sla * 0.75, sla),
                  badge: <Badge text={PRIORITY_LABELS[ticket.priority] ?? ticket.priority} variant={PRIORITY_TONES[ticket.priority] ?? 'amber'} />,
                  onOpen: () => setSelectedTicket(ticket),
                  openLabel: 'Atender',
                };
              })}
              loading={globalLoading}
              error={globalError ? globalErrorDetail : undefined}
              onRetry={refetchGlobal}
              what="los tickets"
              emptyText="Todos los tickets tienen al menos una respuesta."
              seeAllTo="/soporte/tickets?status=ABIERTO"
            />
            <MiniBars
              title="Bandeja activa por prioridad"
              help={<p>Tickets abiertos (sin resolver ni cerrar) según su prioridad. Haz clic en una barra para ver esos tickets.</p>}
              loading={globalLoading}
              items={(['CRITICA', 'ALTA', 'MEDIA', 'BAJA'] as const).map((priority) => ({
                key: priority,
                label: PRIORITY_LABELS[priority],
                value: supportMetrics.openByPriority[priority] ?? 0,
                tone: priority === 'CRITICA' || priority === 'ALTA' ? 'red' : priority === 'MEDIA' ? 'amber' : 'green',
                to: `/soporte/tickets?priority=${priority}`,
              }))}
              emptyText="No hay tickets abiertos."
            />
          </section>

          <section className="dash-grid">
            <MiniBars
              title="Bandeja activa por plataforma"
              help={<p>Desde qué parte del sistema vienen los tickets abiertos. Si una plataforma concentra muchos, suele ser una falla común y no casos aislados.</p>}
              loading={globalLoading}
              items={Object.entries(supportMetrics.openByPlatform)
                .sort(([, a], [, b]) => b - a)
                .map(([platform, value]) => ({ key: platform, label: DASH_PLATFORM_LABELS[platform] ?? platform, value, tone: 'blue' as const, to: platform === 'SIN_PLATAFORMA' ? '/soporte/tickets' : `/soporte/tickets?platform=${platform}` }))}
              emptyText="No hay tickets abiertos."
            />
            <MiniBars
              title="Tickets creados por día (14 días)"
              help={<p>Cuántos tickets entraron cada día, de hace 14 días a hoy. Un salto brusco suele coincidir con una falla general.</p>}
              loading={globalLoading}
              items={supportMetrics.createdByDay.map((day) => ({ key: day.key, label: day.label, value: day.value, tone: 'blue' as const }))}
              emptyText="No entraron tickets en las últimas dos semanas."
            />
          </section>

          <section className="dash-grid">
            <ReportMetricCard
              icon="dashboard"
              title="Por categoría"
              total={reportStats.total}
              tooltipTitle="Clasificación del motivo"
              tooltipText="Agrupa todos los tickets según el tipo de necesidad: fallas técnicas (plazo 24 h), solicitudes de ayuda (48 h) y consultas (72 h)."
            >
              <ReportMetricRow icon="alert" label="Fallas técnicas" detail="Plazo 24 h" value={reportStats.technicalFailures} total={reportStats.total} tone="red" />
              <ReportMetricRow icon="help" label="Solicitudes de ayuda" detail="Plazo 48 h" value={reportStats.helpRequests} total={reportStats.total} tone="amber" />
              <ReportMetricRow icon="message" label="Consultas" detail="Plazo 72 h" value={reportStats.inquiries} total={reportStats.total} tone="blue" />
            </ReportMetricCard>
            <MiniBars
              title="Chats de carga de inventario por estado"
              loading={cargaLoading}
              items={[
                { key: 'esperando', label: 'Esperando soporte', value: cargaResumen?.porEstado?.ESPERANDO_SOPORTE ?? 0, tone: 'amber', to: '/soporte/carga-inventario' },
                { key: 'atencion', label: 'En atención', value: cargaResumen?.porEstado?.EN_ATENCION ?? 0, tone: 'blue', to: '/soporte/carga-inventario' },
                { key: 'vendedor', label: 'Esperando al vendedor', value: cargaResumen?.porEstado?.ESPERANDO_VENDEDOR ?? 0, tone: 'violet', to: '/soporte/carga-inventario' },
              ]}
              emptyText="No hay chats de carga abiertos."
            />
          </section>
        </div>
      ) : activeTab === 'carga-inventario' ? (
        <div style={{ marginTop: '24px' }}>
          {isSupportOperator ? (
            <SoporteCargaInventarioView />
          ) : (
            <p className="carga-chat-sin-permiso">Necesitas el permiso de operador de soporte para ver estas conversaciones.</p>
          )}
        </div>
      ) : activeTab === 'qa-reports' ? (
        <div className="support-tickets-layout" style={{ marginTop: '24px' }}>
          {isMobile ? (
            <>
              <div className="mb-filter-row">
                <input className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar reporte QA..." />
                <FilterTrigger count={countActiveFilters({ statusFilter, priorityFilter, platformFilter }, { statusFilter: 'All', priorityFilter: 'All', platformFilter: 'All' })} onClick={() => setFiltersOpen(true)} />
              </div>
              <FilterSheet
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                title="Filtrar reportes QA"
                activeCount={countActiveFilters({ statusFilter, priorityFilter, platformFilter }, { statusFilter: 'All', priorityFilter: 'All', platformFilter: 'All' })}
                onClear={clearFilters}
              >

            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Estado</span>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                <option value="All">Todos</option>
                {SUPPORT_QA_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Prioridad</span>
              <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(0); }}>
                <option value="All">Todas</option>
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </label>
            <label className="validation-filter-field" style={{ flex: '1 1 190px', margin: 0 }}>
              <span>Plataforma</span>
              <select value={platformFilter} onChange={(e) => { setPlatformFilter(e.target.value as TicketPlatform | 'All'); setPage(0); }}>
                <option value="All">Todas</option>
                <option value="ADMINISTRACION_CONTABLE">Administración Contable</option>
                <option value="MEDIACION_CONFIANZA">Mediación y Confianza</option>
                <option value="APP_MOBILE">App Mobile RepuesTop</option>
              </select>
            </label>
              </FilterSheet>
            </>
          ) : (
          <div className="validation-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', minHeight: 'auto', padding: '16px 20px', alignItems: 'center' }}>
            <label className="validation-search-field" style={{ flex: '2 1 280px', margin: 0 }}>
              <UiIcon name="search" />
              <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar reporte QA..." />
            </label>
            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Estado</span>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                <option value="All">Todos</option>
                {SUPPORT_QA_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Prioridad</span>
              <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(0); }}>
                <option value="All">Todas</option>
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </label>
            <label className="validation-filter-field" style={{ flex: '1 1 190px', margin: 0 }}>
              <span>Plataforma</span>
              <select value={platformFilter} onChange={(e) => { setPlatformFilter(e.target.value as TicketPlatform | 'All'); setPage(0); }}>
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
          )}

          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="table-wrap">
              {isMobile ? (
                <RecordList
                  loading={isLoadingQaReports}
                  ariaLabel="Reportes QA"
                  empty={<EmptyState icon="alert" title="Sin reportes QA" description="No hay reportes QA para los filtros seleccionados." />}
                >
                  {visibleSupportQaReports.map((ticket) => (
                    <RecordCard
                      key={ticket.id}
                      leading={<CapturerAvatar nombre={ticket.reporterName} fotoPerfil={ticket.reporterPhoto} size={40} />}
                      title={ticket.reason}
                      clampTitle
                      badgePlacement="below"
                      subtitle={`${ticket.externalId} · ${formatDate(ticket.createdAt)}`}
                      badge={(
                        <>
                          <span className={`support-qa-status-badge ${QA_STATUS_TONE_CLASSES[ticket.status]}`}>{getStatusLabel(ticket.status, true)}</span>
                          <Badge text={PRIORITY_LABELS[ticket.priority]} variant={PRIORITY_TONES[ticket.priority]} />
                        </>
                      )}
                      tone={ticket.priority === 'CRITICA' ? 'danger' : ticket.priority === 'ALTA' ? 'warning' : 'default'}
                      meta={[
                        { label: 'QA', value: <FounderSellerName name={ticket.reporterName} founder={ticket.reporterType === 'VENDEDOR' && ticket.sellerFounder} /> },
                        { label: 'Plataforma', value: ticket.platform ? PLATFORM_LABELS[ticket.platform] : 'General' },
                      ]}
                      onPress={() => setSelectedTicket(ticket)}
                      actions={(
                        <button type="button" className="mb-action mb-action--primary" onClick={() => setSelectedTicket(ticket)}>
                          <UiIcon name="arrowRight" />
                          Ver reporte
                        </button>
                      )}
                    />
                  ))}
                </RecordList>
              ) : (
              <table className="support-qa-table">
                <colgroup>
                  {Array.from({ length: 8 }).map((_, index) => <col key={index} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th>Reporte</th>
                    <th>Fecha</th>
                    <th>QA</th>
                    <th>Plataforma</th>
                    <th>Bug reportado</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th className="support-qa-actions-heading">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingQaReports ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>Cargando reportes QA...</td></tr>
                  ) : visibleSupportQaReports.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No hay reportes QA para los filtros seleccionados.</td></tr>
                  ) : visibleSupportQaReports.map((ticket) => (
                    <tr key={ticket.id}>
                      <td><strong>{ticket.externalId}</strong></td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}><CapturerAvatar nombre={ticket.reporterName} fotoPerfil={ticket.reporterPhoto} size={26} /><FounderSellerName name={ticket.reporterName} founder={ticket.reporterType === 'VENDEDOR' && ticket.sellerFounder} /></span></td>
                      <td>{ticket.platform ? <Badge text={PLATFORM_LABELS[ticket.platform]} variant={PLATFORM_TONES[ticket.platform]} /> : 'General'}</td>
                      <td><span className="support-qa-truncate" title={ticket.reason}>{ticket.reason}</span></td>
                      <td><Badge text={PRIORITY_LABELS[ticket.priority]} variant={PRIORITY_TONES[ticket.priority]} /></td>
                      <td className="support-qa-status-cell">
                        <span className={`support-qa-status-badge ${QA_STATUS_TONE_CLASSES[ticket.status]}`}>
                          {getStatusLabel(ticket.status, true)}
                        </span>
                      </td>
                      <td className="support-qa-actions-cell">
                        <button className="row-action" type="button" onClick={() => setSelectedTicket(ticket)} title="Ver detalles">
                          <UiIcon name="arrowRight" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </div>

          {qaReportsData && qaReportsData.totalPages > 1 && (
            <div className="table-pagination">
              <span>Mostrando página {page + 1} de {qaReportsData.totalPages} ({qaReportsData.totalElements} reportes)</span>
              <div>
                <button className="page-button" disabled={page === 0} onClick={() => setPage(page - 1)} type="button">Anterior</button>
                <button className="page-button" disabled={page === qaReportsData.totalPages - 1} onClick={() => setPage(page + 1)} type="button">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VISTA: TICKETS (LISTADO Y FILTROS) */
        <div className="support-tickets-layout" style={{ marginTop: '24px' }}>
          {isMobile ? (
            <>
              <div className="mb-filter-row">
                <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ID, reportante o motivo..." />
                <FilterTrigger count={countActiveFilters({ statusFilter, priorityFilter, categoryFilter, platformFilter }, { statusFilter: 'All', priorityFilter: 'All', categoryFilter: 'All', platformFilter: 'All' })} onClick={() => setFiltersOpen(true)} />
              </div>
              <FilterSheet
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                title="Filtrar tickets"
                activeCount={countActiveFilters({ statusFilter, priorityFilter, categoryFilter, platformFilter }, { statusFilter: 'All', priorityFilter: 'All', categoryFilter: 'All', platformFilter: 'All' })}
                onClear={clearFilters}
              >


            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Estado</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">Sin cerrar</option>
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
                {Object.entries(PLATFORM_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>
              </FilterSheet>
            </>
          ) : (
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
                <option value="All">Sin cerrar</option>
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
                {Object.entries(PLATFORM_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>

            <button className="validation-clear-button" type="button" onClick={clearFilters} style={{ flex: '0 0 auto', margin: 0 }}>
              <UiIcon name="filter" />
              Limpiar
            </button>
          </div>
          )}

          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="table-wrap">
              {isMobile ? (
                <RecordList
                  loading={isLoadingTickets}
                  ariaLabel="Tickets de soporte"
                  empty={<EmptyState icon="message" title="Sin tickets" description="No se encontraron tickets con los filtros seleccionados." />}
                >
                  {(ticketsData?.content ?? []).map((ticket) => (
                    <RecordCard
                      key={ticket.id}
                      leading={<CapturerAvatar nombre={ticket.reporterName} fotoPerfil={ticket.reporterPhoto} size={40} />}
                      title={ticket.reason}
                      clampTitle
                      badgePlacement="below"
                      subtitle={`${ticket.externalId} · ${formatDate(ticket.createdAt)}`}
                      badge={(
                        <>
                          <Badge text={getStatusLabel(ticket.status, ticket.origin === 'QA')} variant={STATUS_TONES[ticket.status]} />
                          <Badge text={PRIORITY_LABELS[ticket.priority]} variant={PRIORITY_TONES[ticket.priority]} />
                        </>
                      )}
                      tone={ticket.priority === 'CRITICA' ? 'danger' : ticket.priority === 'ALTA' ? 'warning' : 'default'}
                      meta={[
                        { label: 'Reportante', value: <FounderSellerName name={ticket.reporterName} founder={ticket.reporterType === 'VENDEDOR' && ticket.sellerFounder} /> },
                        { label: 'Tipo', value: ticket.platform === 'SITIO_WEB' ? 'Consulta web' : REPORTER_LABELS[ticket.reporterType] },
                        { label: 'Plataforma', value: ticket.platform ? PLATFORM_LABELS[ticket.platform] : 'General / App' },
                        { label: 'Categoría', value: <>{CATEGORY_LABELS[ticket.category]}{ticket.origin === 'GARANTIA_LEGAL' ? ' · Garantía legal' : ''}</> },
                        { label: 'SLA', value: ticket.sla || 'N/A' },
                      ]}
                      onPress={() => setSelectedTicket(ticket)}
                      actions={(
                        <button type="button" className="mb-action mb-action--primary" onClick={() => setSelectedTicket(ticket)}>
                          <UiIcon name="arrowRight" />
                          Atender ticket
                        </button>
                      )}
                    />
                  ))}
                </RecordList>
              ) : (
              <table style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>Ticket</th>
                    <th style={{ width: '8%' }}>Fecha</th>
                    <th style={{ width: '10%' }}>Reportante</th>
                    <th style={{ width: '6%' }}>Tipo</th>
                    <th style={{ width: '12%' }}>Plataforma</th>
                    <th style={{ width: '10%' }}>Categoría</th>
                    <th style={{ width: '20%' }}>Asunto / Falla</th>
                    <th style={{ width: '6%' }}>Prioridad</th>
                    <th style={{ width: '6%' }}>Estado</th>
                    <th style={{ width: '6%' }}>SLA</th>
                    <th style={{ width: '6%', textAlign: 'center' }}>Acciones</th>
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
                        <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}><CapturerAvatar nombre={ticket.reporterName} fotoPerfil={ticket.reporterPhoto} size={26} /><FounderSellerName name={ticket.reporterName} founder={ticket.reporterType === 'VENDEDOR' && ticket.sellerFounder} /></span></td>
                        <td>{ticket.platform === 'SITIO_WEB' ? 'Consulta web' : REPORTER_LABELS[ticket.reporterType]}</td>
                        <td>
                          {ticket.platform ? (
                            <Badge text={PLATFORM_LABELS[ticket.platform]} variant={PLATFORM_TONES[ticket.platform]} />
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>General / App</span>
                          )}
                        </td>
                        <td>
                          <Badge text={CATEGORY_LABELS[ticket.category]} variant={CATEGORY_TONES[ticket.category]} />
                          {/* O63 (pruebas de lanzamiento, 25-sep): pedido de ayuda por garantía legal desde el caso. */}
                          {ticket.origin === 'GARANTIA_LEGAL' && <> <Badge text="Garantía legal" variant="violet" /></>}
                        </td>
                        <td style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.reason}
                        </td>
                        <td>
                          <Badge text={PRIORITY_LABELS[ticket.priority]} variant={PRIORITY_TONES[ticket.priority]} />
                        </td>
                        <td>
                          <Badge text={getStatusLabel(ticket.status, ticket.origin === 'QA')} variant={STATUS_TONES[ticket.status]} />
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
              )}
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
          onAttachDocument={(file) => updateStatusMutation.mutate({
            id: selectedTicket.id,
            status: (selectedTicketDetail ?? selectedTicket).status,
            file,
          })}
          onMessageSent={() => {
            queryClient.invalidateQueries({ queryKey: ['support-workspace'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-ticket-detail', selectedTicket.id] });
          }}
          statusContext="support"
        />
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
              <div className="mb-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
                        <option key={s.id} value={s.id}>{s.nombreTienda}{s.rut ? ` (RUT: ${s.rut})` : ''}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="mb-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
