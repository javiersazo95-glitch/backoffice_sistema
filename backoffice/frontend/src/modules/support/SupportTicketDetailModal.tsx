import { useEffect, useMemo, useRef, useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import { formatDateTime } from '@/utils/formatters';
import type {
  ReporterType,
  TicketCategory,
  TicketPlatform,
  TicketPriority,
  TicketResponse,
  TicketStatus,
  TicketMessage,
} from '@/api/support';
import * as supportApi from '@/api/support';
import * as permissionsApi from '@/api/permissions';
import type { PermissionUser } from '@/api/permissions';
import { resolveDocumentUrl } from '@/utils/documentUrls';

const PLATFORM_LABELS: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App Mobile RepuesTop',
  SOPORTE: 'Soporte',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICA: 'Highest', ALTA: 'High', MEDIA: 'Medium', BAJA: 'Low',
};

const PRIORITY_ICON: Record<TicketPriority, { icon: string; tone: string }> = {
  CRITICA: { icon: 'trendUp', tone: 'p-critica' },
  ALTA: { icon: 'trendUp', tone: 'p-alta' },
  MEDIA: { icon: 'minus', tone: 'p-media' },
  BAJA: { icon: 'trendDown', tone: 'p-baja' },
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  FALLA_TECNICA: 'Bug', SOLICITUD_AYUDA: 'Task de soporte', CONSULTA: 'Consulta',
};

const REPORTER_LABELS: Record<ReporterType, string> = {
  COMPRADOR: 'Comprador', VENDEDOR: 'Vendedor', INTERNO: 'Interno',
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

const QA_STATUS_LABELS: Partial<Record<TicketStatus, string>> = {
  ABIERTO: 'Pendiente',
  EN_PROCESO: 'En revisión',
  PENDIENTE_VENDEDOR: 'Listo para revisión',
  PENDIENTE_COMPRADOR: 'Con observaciones',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
};

export function getStatusLabel(status: TicketStatus, isQa: boolean): string {
  if (isQa) return QA_STATUS_LABELS[status] ?? STATUS_LABELS[status];
  return STATUS_LABELS[status];
}

const STATUS_TONE_CLASS: Record<TicketStatus, string> = {
  ABIERTO: 's-todo', EN_PROCESO: 's-progress', PENDIENTE_VENDEDOR: 's-review',
  PENDIENTE_COMPRADOR: 's-overdue', SLA_VENCIDO: 's-overdue', RESUELTO: 's-done',
  CERRADO: 's-closed', CANCELADO: 's-overdue',
};

const SUPPORT_STATUS_OPTIONS: TicketStatus[] = [
  'ABIERTO',
  'EN_PROCESO',
  'PENDIENTE_VENDEDOR',
  'PENDIENTE_COMPRADOR',
  'SLA_VENCIDO',
  'RESUELTO',
  'CERRADO',
  'CANCELADO',
];

const QA_SUPPORT_STATUS_OPTIONS: TicketStatus[] = ['ABIERTO', 'EN_PROCESO', 'PENDIENTE_VENDEDOR'];
const QA_REVIEW_STATUS_OPTIONS: TicketStatus[] = ['PENDIENTE_COMPRADOR', 'RESUELTO'];

const ASSIGNEE_STORAGE_KEY = 'repuestop.backoffice.support-assignees';

const AVATAR_PALETTE = ['#0052CC', '#00875A', '#DE350B', '#5243AA', '#FF8B00', '#00A3BF', '#403294', '#006644'];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
}

function avatarColor(name: string): string {
  return AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length]!;
}

function timeAgo(isoDate?: string): string {
  if (!isoDate) return 'sin fecha';
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 'sin fecha';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return 'hace un momento';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays} d`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `hace ${diffMonths} mes${diffMonths === 1 ? '' : 'es'}`;
  const diffYears = Math.floor(diffMonths / 12);
  return `hace ${diffYears} año${diffYears === 1 ? '' : 's'}`;
}

function normalizeCommentText(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function loadStoredAssignees(): Record<string, PermissionUser> {
  try {
    const raw = localStorage.getItem(ASSIGNEE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredAssignee(ticketId: number): PermissionUser | null {
  return loadStoredAssignees()[String(ticketId)] ?? null;
}

function storeAssignee(ticketId: number, user: PermissionUser | null) {
  const assignees = loadStoredAssignees();
  if (user) {
    assignees[String(ticketId)] = user;
  } else {
    delete assignees[String(ticketId)];
  }
  localStorage.setItem(ASSIGNEE_STORAGE_KEY, JSON.stringify(assignees));
}

interface StatusOption {
  value: TicketStatus;
  label: string;
}

type StatusContext = 'support' | 'qa';

function getStatusOptions(ticket: TicketResponse, statusContext: StatusContext): StatusOption[] {
  const isQa = ticket.origin === 'QA';
  const label = (status: TicketStatus) => getStatusLabel(status, isQa);
  const options: StatusOption[] = [{ value: ticket.status, label: label(ticket.status) }];

  if (isQa) {
    if (statusContext === 'support') {
      QA_SUPPORT_STATUS_OPTIONS.forEach((status) => {
        options.push({ value: status, label: label(status) });
      });
    } else if (ticket.status === 'PENDIENTE_VENDEDOR' || ticket.status === 'PENDIENTE_COMPRADOR') {
      QA_REVIEW_STATUS_OPTIONS.forEach((status) => {
        options.push({ value: status, label: label(status) });
      });
    }
  } else {
    SUPPORT_STATUS_OPTIONS.forEach((status) => {
      options.push({ value: status, label: label(status) });
    });
  }

  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="jira-avatar"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4), background: avatarColor(name) }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

function SidebarField({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="jira-field-row">
      <span className="jira-field-label"><UiIcon name={icon} /> {label}</span>
      <div className="jira-field-value">{children}</div>
    </div>
  );
}

interface Props {
  ticket: TicketResponse;
  isLoading: boolean;
  isUpdating: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onStatusChange: (status: TicketStatus) => void;
  statusContext?: StatusContext;
  reviewFile?: File | null;
  onReviewFileChange?: (file: File | null) => void;
  embedded?: boolean;
}

export default function SupportTicketDetailModal({
  ticket, isLoading, isUpdating, notes, onNotesChange, onClose, onStatusChange, statusContext, reviewFile, onReviewFileChange, embedded = false,
}: Props) {
  const isQa = ticket.origin === 'QA';
  const resolvedStatusContext = statusContext ?? (isQa ? 'qa' : 'support');
  const canQaReview = isQa && resolvedStatusContext === 'qa' && ticket.status === 'PENDIENTE_VENDEDOR';
  const currentActorName = isQa && resolvedStatusContext === 'qa' ? 'QA RepuesTop' : 'Soporte RepuesTop';
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [supportOperators, setSupportOperators] = useState<PermissionUser[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<PermissionUser | null>(() => getStoredAssignee(ticket.id));
  const [reviewPopupOpen, setReviewPopupOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const assigneeMenuRef = useRef<HTMLDivElement>(null);
  const originalDocUrlRef = useRef<string | undefined>(ticket.documentoUrl);

  useEffect(() => {
    async function loadMessages() {
      setMessagesLoading(true);
      try {
        const data = await supportApi.getTicketMessages(ticket.id);
        setMessages(data);
      } catch {
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    }
    void loadMessages();
  }, [ticket.id]);


  useEffect(() => {
    setSelectedAssignee(getStoredAssignee(ticket.id));
  }, [ticket.id]);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusMenuOpen]);

  useEffect(() => {
    if (!assigneeMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(event.target as Node)) {
        setAssigneeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assigneeMenuOpen]);

  useEffect(() => {
    if (!assigneeMenuOpen || supportOperators.length > 0 || operatorsLoading) return;
    setOperatorsLoading(true);
    permissionsApi.listPermissionUsers({
      area: 'SOPORTE',
      slot: 'OPERADOR',
      page: 0,
      size: 100,
    })
      .then((response) => setSupportOperators(response.content ?? []))
      .catch(() => setSupportOperators([]))
      .finally(() => setOperatorsLoading(false));
  }, [assigneeMenuOpen, operatorsLoading, supportOperators.length]);

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const msg = await supportApi.sendTicketMessage(ticket.id, {
        autorTipo: 'SOPORTE',
        autorNombre: currentActorName,
        mensaje: text,
      });
      setMessages((prev) => [...prev, msg]);
      setReplyText('');
    } catch {
      // error handling
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSendReply();
    }
  };

  const visibleMessages = useMemo(() => {
    if (!isQa) return messages;
    const descriptionText = normalizeCommentText(ticket.lastMessage);
    const reasonText = normalizeCommentText(ticket.reason);
    return messages.filter((message) => {
      const text = normalizeCommentText(message.mensaje);
      return text && text !== descriptionText && text !== reasonText;
    });
  }, [isQa, messages, ticket.lastMessage, ticket.reason]);

  const statusOptions = getStatusOptions(ticket, resolvedStatusContext);
  const priorityMeta = PRIORITY_ICON[ticket.priority];
  const projectLabel = isQa ? 'Soporte QA' : 'Mesa de Soporte';
  const issueTypeLabel = isQa ? CATEGORY_LABELS.FALLA_TECNICA : CATEGORY_LABELS[ticket.category];

  const content = (
      <section className={`jira-modal ${embedded ? 'jira-modal-embedded' : ''}`} role="dialog" aria-modal={!embedded} aria-labelledby="jira-issue-title" onClick={(event) => event.stopPropagation()}>
        <div className="jira-topbar">
          <nav className="jira-breadcrumb" aria-label="breadcrumb">
            <UiIcon name={isQa ? 'shield' : 'headset'} />
            <span>{projectLabel}</span>
            <span className="jira-breadcrumb-sep">/</span>
            <span className="jira-breadcrumb-key">{ticket.externalId}</span>
          </nav>
          <div className="jira-topbar-actions">
            {isLoading && <span className="jira-syncing">Sincronizando…</span>}
            <button className="jira-icon-button" type="button" onClick={onClose} aria-label="Cerrar">
              <UiIcon name="close" />
            </button>
          </div>
        </div>

        <div className="jira-body">
          <main className="jira-main">
            <div className="jira-issue-heading">
              <span className={`jira-type-chip ${isQa ? 'bug' : 'task'}`}>
                <UiIcon name={isQa ? 'alert' : 'message'} />
                {issueTypeLabel}
              </span>
              <span className="jira-issue-key">{ticket.externalId}</span>
            </div>
            <h1 id="jira-issue-title" className="jira-issue-title">{ticket.reason}</h1>

            <section className="jira-section">
              <h2 className="jira-section-title">Descripción</h2>
              <div className="jira-description">
                {ticket.lastMessage || <span className="jira-empty-text">Sin descripción detallada.</span>}
              </div>
            </section>

            {isQa && ticket.nextAction && (ticket.status === 'PENDIENTE_COMPRADOR' || ticket.status === 'RESUELTO') && (
              <section className="jira-section">
                <h2 className="jira-section-title">
                  <UiIcon name="alert" style={{ color: ticket.status === 'RESUELTO' ? '#00875A' : '#FF8B00' }} />
                  Revisión QA
                </h2>
                <div className={`jira-qa-review-result ${ticket.status === 'RESUELTO' ? 's-done' : 's-overdue'}`}>
                  <div className="jira-qa-review-verdict">
                    {ticket.status === 'RESUELTO' ? '✓ Resuelto' : '⚠ Con observación'}
                  </div>
                  <p>{ticket.nextAction}</p>
                </div>
              </section>
            )}

            {(() => {
              const currentDocUrl = ticket.documentoUrl ? resolveDocumentUrl(ticket.documentoUrl) : null;
              const currentDocName = ticket.documentoUrl ? ticket.documentoUrl.split('/').pop() || 'evidencia.pdf' : null;
              const originalResolvedUrl = originalDocUrlRef.current ? resolveDocumentUrl(originalDocUrlRef.current) : null;
              const originalDocName = originalDocUrlRef.current ? originalDocUrlRef.current.split('/').pop() || 'evidencia-original.pdf' : null;
              const hasReviewDoc = currentDocUrl && originalDocUrlRef.current && originalDocUrlRef.current !== ticket.documentoUrl;
              const totalDocs = (currentDocUrl ? 1 : 0) + (hasReviewDoc ? 1 : 0);
              if (!currentDocUrl && !originalResolvedUrl) return null;
              return (
                <section className="jira-section">
                  <h2 className="jira-section-title">Adjuntos <span className="jira-count-badge">{totalDocs}</span></h2>
                  {currentDocUrl && (
                    <button type="button" className="jira-attachment-card" onClick={() => window.open(currentDocUrl, '_blank')}>
                      <span className="jira-attachment-icon"><UiIcon name="document" /></span>
                      <span className="jira-attachment-meta">
                        <strong>{currentDocName}</strong>
                        <span>{hasReviewDoc ? 'Evidencia de revisión QA · Bucket privado' : 'Documento de evidencia · Bucket privado'}</span>
                      </span>
                      <span className="jira-attachment-download"><UiIcon name="download" /></span>
                    </button>
                  )}
                  {hasReviewDoc && originalResolvedUrl && (
                    <button type="button" className="jira-attachment-card" style={{ marginTop: 8 }} onClick={() => window.open(originalResolvedUrl, '_blank')}>
                      <span className="jira-attachment-icon"><UiIcon name="document" /></span>
                      <span className="jira-attachment-meta">
                        <strong>{originalDocName}</strong>
                        <span>Evidencia original del defecto · Bucket privado</span>
                      </span>
                      <span className="jira-attachment-download"><UiIcon name="download" /></span>
                    </button>
                  )}
                </section>
              );
            })()}

            <section className="jira-section">
              <div className="jira-activity-tabs">
                <button type="button" className="jira-activity-tab active">
                  Comentarios <span className="jira-count-badge">{visibleMessages.length}</span>
                </button>
              </div>

              <div className="jira-comment-composer">
                <Avatar name={currentActorName} size={32} />
                <div className="jira-comment-composer-body">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isQa ? 'Añade un comentario o nota de revisión…' : 'Añade un comentario para el usuario…'}
                    rows={3}
                    disabled={sending}
                  />
                  <div className="jira-comment-composer-actions">
                    <span className="jira-hint">Ctrl/Cmd + Enter para enviar</span>
                    <button
                      type="button"
                      className="jira-primary-button"
                      disabled={!replyText.trim() || sending}
                      onClick={handleSendReply}
                    >
                      {sending ? 'Enviando…' : 'Comentar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="jira-comment-list">
                {messagesLoading ? (
                  <div className="jira-comment-empty">Cargando comentarios…</div>
                ) : visibleMessages.length === 0 ? (
                  <div className="jira-comment-empty">Todavía no hay comentarios en este issue.</div>
                ) : (
                  [...visibleMessages].reverse().map((msg) => {
                    const authorName = msg.autorNombre || (msg.autorTipo === 'SOPORTE' ? 'Soporte' : 'Usuario');
                    return (
                      <div key={msg.id} className="jira-comment">
                        <Avatar name={authorName} size={32} />
                        <div className="jira-comment-content">
                          <div className="jira-comment-head">
                            <strong>{authorName}</strong>
                            {msg.autorTipo === 'SOPORTE' && <span className="jira-role-chip">Equipo</span>}
                            <span className="jira-comment-time" title={formatDateTime(msg.createdAt)}>{timeAgo(msg.createdAt)}</span>
                          </div>
                          <div className="jira-comment-text">{msg.mensaje}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </main>

          <aside className="jira-sidebar" aria-label="Detalles del issue">
            {/* Estado: etiqueta fija cuando canQaReview, dropdown cuando no */}
            <div className="jira-status-block" ref={statusMenuRef}>
              {canQaReview ? (
                <span className={`jira-status-lozenge jira-status-label ${STATUS_TONE_CLASS[ticket.status]}`}>
                  {getStatusLabel(ticket.status, isQa)}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className={`jira-status-lozenge ${STATUS_TONE_CLASS[ticket.status]}`}
                    onClick={() => setStatusMenuOpen((open) => !open)}
                    disabled={isUpdating}
                    aria-haspopup="menu"
                    aria-expanded={statusMenuOpen}
                  >
                    {getStatusLabel(ticket.status, isQa)}
                    <UiIcon name="chevronDown" />
                  </button>
                  {statusMenuOpen && (
                    <div className="jira-status-menu" role="menu">
                      {statusOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitem"
                          className={`jira-status-menu-item ${option.value === ticket.status ? 'current' : ''}`}
                          disabled={isUpdating || option.value === ticket.status}
                          onClick={() => {
                            setStatusMenuOpen(false);
                            if (option.value !== ticket.status) onStatusChange(option.value);
                          }}
                        >
                          <span className={`jira-status-dot ${STATUS_TONE_CLASS[option.value]}`} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {canQaReview && (
              <button
                type="button"
                className="jira-qa-review-btn"
                onClick={() => setReviewPopupOpen(true)}
                disabled={isUpdating}
              >
                <UiIcon name="alert" />
                Revisión QA
              </button>
            )}

            <div className="jira-sidebar-divider" />

            <h3 className="jira-sidebar-title">Detalles</h3>
            <div className="jira-field-list">
              <SidebarField icon="user" label="Asignado a">
                <div className="jira-assignee-picker" ref={assigneeMenuRef}>
                  <button
                    type="button"
                    className={`jira-assignee-trigger ${selectedAssignee ? '' : 'jira-unassigned'}`}
                    onClick={() => setAssigneeMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={assigneeMenuOpen}
                  >
                    <Avatar name={selectedAssignee?.fullName || '?'} size={20} />
                    <span>{selectedAssignee?.fullName || 'Sin asignar'}</span>
                    <UiIcon name="chevronDown" />
                  </button>

                  {assigneeMenuOpen && (
                    <div className="jira-assignee-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className={`jira-assignee-menu-item ${!selectedAssignee ? 'current' : ''}`}
                        onClick={() => {
                          setSelectedAssignee(null);
                          storeAssignee(ticket.id, null);
                          setAssigneeMenuOpen(false);
                        }}
                      >
                        <Avatar name="?" size={20} />
                        Sin asignar
                      </button>
                      {operatorsLoading ? (
                        <div className="jira-assignee-menu-empty">Cargando operadores...</div>
                      ) : supportOperators.length === 0 ? (
                        <div className="jira-assignee-menu-empty">No hay operadores de soporte</div>
                      ) : supportOperators.map((operator) => (
                        <button
                          type="button"
                          role="menuitem"
                          className={`jira-assignee-menu-item ${selectedAssignee?.id === operator.id ? 'current' : ''}`}
                          key={operator.id}
                          onClick={() => {
                            setSelectedAssignee(operator);
                            storeAssignee(ticket.id, operator);
                            setAssigneeMenuOpen(false);
                          }}
                        >
                          <Avatar name={operator.fullName} size={20} />
                          <span>
                            <strong>{operator.fullName}</strong>
                            <small>{operator.email}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </SidebarField>
              <SidebarField icon="users" label="Reportado por">
                <span className="jira-assignee"><Avatar name={ticket.reporterName || 'Usuario'} size={20} /> {ticket.reporterName || 'No informado'}</span>
              </SidebarField>
              {!isQa && (
                <SidebarField icon="target" label="Tipo de reportante">
                  {REPORTER_LABELS[ticket.reporterType]}
                </SidebarField>
              )}
              <SidebarField icon="flag" label="Prioridad">
                <span className={`jira-priority ${priorityMeta.tone}`}>
                  <UiIcon name={priorityMeta.icon} /> {PRIORITY_LABELS[ticket.priority]}
                </span>
              </SidebarField>
              <SidebarField icon="dashboard" label="Componente">
                <span className="jira-label-chip">{ticket.platform ? PLATFORM_LABELS[ticket.platform] : 'General'}</span>
              </SidebarField>
              {isQa ? (
                <SidebarField icon="monitor" label="Entorno">
                  {ticket.entorno || 'No especificado'}
                </SidebarField>
              ) : (
                <SidebarField icon="clock" label="SLA">
                  {ticket.sla || 'No especificado'}
                </SidebarField>
              )}
              <div className="jira-field-divider" />
              <SidebarField icon="calendar" label="Creado">
                <span title={formatDateTime(ticket.createdAt)}>{timeAgo(ticket.createdAt)}</span>
              </SidebarField>
              <SidebarField icon="refresh" label="Actualizado">
                <span title={formatDateTime(ticket.updatedAt)}>{timeAgo(ticket.updatedAt)}</span>
              </SidebarField>
            </div>

          </aside>
        </div>

        {reviewPopupOpen && (
          <div className="jira-review-popup-overlay" onClick={() => setReviewPopupOpen(false)}>
            <div className="jira-review-popup" onClick={(e) => e.stopPropagation()}>
              <div className="jira-review-popup-header">
                <UiIcon name="alert" />
                <h3>Revisión QA</h3>
                <button type="button" className="jira-icon-button" onClick={() => setReviewPopupOpen(false)} aria-label="Cerrar">
                  <UiIcon name="close" />
                </button>
              </div>

              <div className="jira-review-popup-body">
                <label className="jira-review-popup-label">Observaciones / Validación</label>
                <textarea
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Describe los hallazgos, observaciones o validación del defecto..."
                  rows={5}
                  disabled={isUpdating}
                  autoFocus
                />

                <label className="jira-file-control">
                  <span>Adjuntar evidencia (opcional)</span>
                  <input
                    type="file"
                    onChange={(event) => onReviewFileChange?.(event.target.files?.[0] ?? null)}
                    disabled={isUpdating}
                  />
                </label>
                {reviewFile && <small className="jira-selected-file">{reviewFile.name}</small>}
              </div>

              <div className="jira-review-popup-actions">
                <button
                  type="button"
                  className="jira-review-btn-observation"
                  disabled={!notes.trim() || isUpdating}
                  onClick={() => {
                    setReviewPopupOpen(false);
                    onStatusChange('PENDIENTE_COMPRADOR');
                  }}
                >
                  <UiIcon name="alert" />
                  Con observación
                </button>
                <button
                  type="button"
                  className="jira-review-btn-resolved"
                  disabled={!notes.trim() || isUpdating}
                  onClick={() => {
                    setReviewPopupOpen(false);
                    onStatusChange('RESUELTO');
                  }}
                >
                  <UiIcon name="check" />
                  Resuelto
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
  );

  if (embedded) return content;

  return (
    <div className="jira-backdrop" onClick={onClose}>
      {content}
    </div>
  );
}
