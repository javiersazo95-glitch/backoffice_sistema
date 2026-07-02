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
import { useAuth } from '@/context/AuthContext';
import { hasBackofficePermission } from '@/hooks/usePermissions';
import { resolveDocumentUrl } from '@/utils/documentUrls';

const PLATFORM_LABELS: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App Mobile RepuesTop',
  SOPORTE: 'Soporte',
};

const PLATFORM_TONES: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'green',
  MEDIACION_CONFIANZA: 'violet',
  APP_MOBILE: 'blue',
  SOPORTE: 'amber',
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



function SupportQaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [qaTab, setQaTab] = useState<'defectos' | 'resueltos'>('defectos');
  const [search, setSearch] = useState('');
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);

  // States for creating a defect
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPlatform, setNewPlatform] = useState<TicketPlatform>('APP_MOBILE');
  const [newPriority, setNewPriority] = useState<TicketPriority>('MEDIA');
  const [newEntorno, setNewEntorno] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);

  // States for review
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFile, setReviewFile] = useState<File | null>(null);

  // Fetch bugs
  const { data: qaReportsData, isLoading } = useQuery({
    queryKey: ['qa-reports'],
    queryFn: () => supportApi.getQaReports({ page: 0, size: 200 }),
  });

  const qaReports = qaReportsData?.content ?? [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => {
      setNewTitle('');
      setNewDescription('');
      setNewEntorno('');
      setNewFile(null);
      setNewPlatform('APP_MOBILE');
      setNewPriority('MEDIA');
      setCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['qa-reports'] });
      showToast('Defecto registrado con éxito');
    },
    onError: (error: any) => showToast(error.message || 'No se pudo registrar el defecto'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ status, nextAction, file }: { status: TicketStatus; nextAction: string; file: File | null }) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-reports'] });
      setReviewComment('');
      setReviewFile(null);
      showToast('Revisión registrada con éxito');
    },
    onError: (error: any) => showToast(error.message || 'No se pudo registrar la revisión'),
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
        return !isResolved;
      } else {
        return isResolved;
      }
    });
  }, [qaReports, search, qaTab]);

  const activeBugs = useMemo(() => {
    return filteredBugs;
  }, [filteredBugs]);

  const resolvedBugs = useMemo(() => {
    return filteredBugs;
  }, [filteredBugs]);

  const selectedBug = useMemo(() => {
    return qaReports.find(b => b.id === selectedBugId) || null;
  }, [qaReports, selectedBugId]);

  const getDefectStatusLabel = (status: TicketStatus): string => {
    if (status === 'ABIERTO') return 'Pendiente';
    if (status === 'EN_PROCESO') return 'Listo para revisar';
    if (status === 'PENDIENTE_VENDEDOR') return 'Con observación';
    if (status === 'RESUELTO') return 'Resuelto';
    return STATUS_LABELS[status] ?? status;
  };

  const getDefectStatusTone = (status: TicketStatus): string => {
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
          onClick={() => { setQaTab('defectos'); setSelectedBugId(null); }}
          type="button"
        >
          <UiIcon name="alert" />
          Defectos
        </button>
        <button
          className={qaTab === 'resueltos' ? 'active' : ''}
          onClick={() => { setQaTab('resueltos'); setSelectedBugId(null); }}
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
                      <span>
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

            <main className="validation-detail-stack">
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
                              onClick={() => {
                                const url = resolveDocumentUrl(selectedBug.documentoUrl);
                                if (url) window.open(url, '_blank');
                              }}
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

                  {selectedBug.status === 'EN_PROCESO' && (
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
                            onClick={() => updateMutation.mutate({ status: 'PENDIENTE_VENDEDOR', nextAction: reviewComment, file: reviewFile })}
                          >
                            <UiIcon name="alert" />
                            Con observación
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
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>Documento</th>
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
                  <td style={{ padding: '12px 8px' }}>
                    {bug.documentoUrl ? (
                      <button
                        className="link-button"
                        type="button"
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--blue)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => {
                          const url = resolveDocumentUrl(bug.documentoUrl);
                          if (url) window.open(url, '_blank');
                        }}
                      >
                        Ver adjunto
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                if (!newTitle.trim() || !newDescription.trim() || !newEntorno.trim()) {
                  showToast('Por favor completa los campos obligatorios');
                  return;
                }

                try {
                  let docUrl = undefined;
                  if (newFile) {
                    const uploadResult = await supportApi.uploadDocument(newFile);
                    docUrl = uploadResult.url;
                  }

                  createMutation.mutate({
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
                  showToast(error.message || 'Error al subir el archivo');
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Entorno *</span>
                  <input
                    type="text"
                    value={newEntorno}
                    onChange={e => setNewEntorno(e.target.value)}
                    placeholder="Ej: Staging, Producción, Local"
                    required
                    style={{ padding: '10px', border: '1px solid #d9e3f0', borderRadius: '8px', font: 'inherit' }}
                  />
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
                  disabled={createMutation.isPending}
                >
                  <UiIcon name="alert" />
                  {createMutation.isPending ? 'Registrando...' : 'Registrar Defecto'}
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
    enabled: isSupportOperator,
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
    enabled: isSupportOperator && activeTab === 'tickets',
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

  // Query de sellers para el selector del nuevo ticket
  const { data: sellersData } = useQuery({
    queryKey: ['support-sellers-lookup'],
    queryFn: () => sellersApi.getSellers({ page: 0, size: PAGE_SIZES.MAX }),
    enabled: isSupportOperator,
  });

  // Query global para dashboard (distribuciones)
  const { data: globalTicketsData } = useQuery({
    queryKey: ['support-tickets-global'],
    queryFn: () => supportApi.getTickets({ page: 0, size: 100 }),
    enabled: isSupportOperator && activeTab === 'resumen',
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
    enabled: isSupportOperator && selectedTicket !== null,
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
      ) : activeTab === 'qa-reports' ? (
        <div className="support-tickets-layout" style={{ marginTop: '24px' }}>
          <div className="validation-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', minHeight: 'auto', padding: '16px 20px', alignItems: 'center' }}>
            <label className="validation-search-field" style={{ flex: '2 1 280px', margin: 0 }}>
              <UiIcon name="search" />
              <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar reporte QA..." />
            </label>
            <label className="validation-filter-field" style={{ flex: '1 1 170px', margin: 0 }}>
              <span>Estado</span>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                <option value="All">Todos</option>
                {Object.entries(STATUS_LABELS)
                  .filter(([val]) => val !== 'PENDIENTE_VENDEDOR' && val !== 'PENDIENTE_COMPRADOR')
                  .map(([val, label]) => <option key={val} value={val}>{label}</option>)}
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

          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="table-wrap">
              <table style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>Reporte</th>
                    <th style={{ width: '10%' }}>Fecha</th>
                    <th style={{ width: '15%' }}>QA</th>
                    <th style={{ width: '18%' }}>Plataforma</th>
                    <th style={{ width: '27%' }}>Bug reportado</th>
                    <th style={{ width: '10%' }}>Prioridad</th>
                    <th style={{ width: '10%' }}>Estado</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingQaReports ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>Cargando reportes QA...</td></tr>
                  ) : !qaReportsData || qaReportsData.content.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No hay reportes QA para los filtros seleccionados.</td></tr>
                  ) : qaReportsData.content.map((ticket) => (
                    <tr key={ticket.id}>
                      <td><strong>{ticket.externalId}</strong></td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td>{ticket.reporterName}</td>
                      <td>{ticket.platform ? <Badge text={PLATFORM_LABELS[ticket.platform]} variant={PLATFORM_TONES[ticket.platform]} /> : 'General'}</td>
                      <td style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.reason}</td>
                      <td><Badge text={PRIORITY_LABELS[ticket.priority]} variant={PRIORITY_TONES[ticket.priority]} /></td>
                      <td><Badge text={STATUS_LABELS[ticket.status]} variant={STATUS_TONES[ticket.status]} /></td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="row-action" type="button" onClick={() => setSelectedTicket(ticket)} title="Ver detalles">
                          <UiIcon name="arrowRight" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                        <td style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
