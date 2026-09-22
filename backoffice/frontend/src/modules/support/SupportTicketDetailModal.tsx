import { useEffect, useMemo, useRef, useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { formatDateTime } from '@/utils/formatters';
import type {
  ReporterType,
  TicketCategory,
  TicketPlatform,
  TicketPriority,
  TicketResponse,
  TicketStatus,
  TicketMessage,
  TicketAttachment,
} from '@/api/support';
import * as supportApi from '@/api/support';
import * as permissionsApi from '@/api/permissions';
import type { PermissionUser } from '@/api/permissions';
import { downloadDocument, getDocumentFileName, previewDocument, resolveDocumentUrl } from '@/utils/documentUrls';
import { resolveProfileImageUrl } from '@/api/client';
import { useAuth } from '@/context/AuthContext';

const PLATFORM_LABELS: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App Mobile RepuesTop',
  SOPORTE: 'Soporte',
  SITIO_WEB: 'Sitio Web',
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
const FINISHED_STATUS = new Set<TicketStatus>(['RESUELTO', 'CERRADO', 'CANCELADO']);

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

function Avatar({ name, size = 24, imageUrl }: { name: string; size?: number; imageUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedUrl = !imageFailed ? resolveProfileImageUrl(imageUrl) : null;

  if (resolvedUrl) {
    return (
      <img
        className="jira-avatar jira-avatar-image"
        style={{ width: size, height: size }}
        src={resolvedUrl}
        alt={name}
        title={name}
        onError={() => setImageFailed(true)}
      />
    );
  }

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
  onAttachDocument?: (file: File) => void;
  onMessageSent?: () => void;
  embedded?: boolean;
}

export default function SupportTicketDetailModal({
  ticket, isLoading, isUpdating, notes, onNotesChange, onClose, onStatusChange, statusContext, reviewFile, onReviewFileChange, onAttachDocument, onMessageSent, embedded = false,
}: Props) {
  const { user } = useAuth();
  const isQa = ticket.origin === 'QA';
  const isFinished = FINISHED_STATUS.has(ticket.status);
  const resolvedStatusContext = statusContext ?? (isQa ? 'qa' : 'support');
  const canQaReview = isQa && resolvedStatusContext === 'qa' && ticket.status === 'PENDIENTE_VENDEDOR';
  const currentActorName = user?.fullName || (isQa ? 'QA RepuesTop' : 'Soporte RepuesTop');
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [supportOperators, setSupportOperators] = useState<PermissionUser[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  // Se distingue "no hay operadores" de "no puedo consultarlos": el backend exige SUPER_ADMIN
  // en /backoffice/permissions/**, asi que un operador de SOPORTE recibe 403 al abrir esta
  // lista. Mostrarle "No hay operadores de soporte" seria decirle algo falso.
  const [operatorsForbidden, setOperatorsForbidden] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<PermissionUser | null>(() => getStoredAssignee(ticket.id));
  const [reviewPopupOpen, setReviewPopupOpen] = useState(false);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const assigneeMenuRef = useRef<HTMLDivElement>(null);

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
    async function loadAttachments() {
      setAttachmentsLoading(true);
      try {
        const data = await supportApi.getTicketAttachments(ticket.id);
        setAttachments(data);
      } catch {
        setAttachments([]);
      } finally {
        setAttachmentsLoading(false);
      }
    }
    void loadAttachments();
  }, [ticket.id, ticket.documentoUrl]);


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
      .then((response) => {
        setSupportOperators(response.content ?? []);
        setOperatorsForbidden(false);
      })
      .catch((error: unknown) => {
        setSupportOperators([]);
        const status = (error as { response?: { status?: number } })?.response?.status;
        setOperatorsForbidden(status === 403);
      })
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
      onMessageSent?.();
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

            {(attachmentsLoading || attachments.length > 0 || onAttachDocument) && (
              <section className="jira-section">
                <h2 className="jira-section-title">Adjuntos <span className="jira-count-badge">{attachments.length}</span></h2>
                {attachmentsLoading ? (
                  <div className="jira-empty-text">Cargando adjuntos…</div>
                ) : (
                  attachments.map((attachment, index) => {
                    const resolvedUrl = resolveDocumentUrl(attachment.url);
                    const rawName = attachment.nombreArchivo || getDocumentFileName(attachment.url, 'documento');
                    const fileName = rawName.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
                    if (!resolvedUrl) return null;
                    return (
                      <div
                        key={attachment.id}
                        className="jira-attachment-card"
                        style={{ marginTop: index > 0 ? 8 : 0 }}
                        onClick={() => void previewDocument(attachment.url)}
                      >
                        <span className="jira-attachment-icon"><UiIcon name="document" /></span>
                        <span className="jira-attachment-meta">
                          <strong>{fileName}</strong>
                          <span>{attachment.descripcion || 'Documento de evidencia'} · Bucket privado</span>
                        </span>
                        <div className="jira-attachment-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="jira-attachment-action-btn"
                            title="Visualizar archivo"
                            onClick={() => void previewDocument(attachment.url)}
                          >
                            <UiIcon name="eye" />
                          </button>
                          <button
                            type="button"
                            className="jira-attachment-action-btn"
                            title="Descargar archivo"
                            onClick={() => void downloadDocument(attachment.url, fileName)}
                          >
                            <UiIcon name="download" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                {onAttachDocument && (
                  <label className="jira-file-control" style={{ marginTop: attachmentsLoading || attachments.length > 0 ? 12 : 0 }}>
                    <span>Adjuntar documento</span>
                    <input
                      type="file"
                      disabled={isUpdating}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onAttachDocument(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                )}
              </section>
            )}

            <section className="jira-section">
              <div className="jira-activity-tabs">
                <button type="button" className="jira-activity-tab active">
                  Comentarios <span className="jira-count-badge">{visibleMessages.length}</span>
                </button>
              </div>

              {isFinished ? (
                <div className="jira-qa-review-result s-closed">
                  <UiIcon name="check" />
                  <div>
                    <strong>Consulta finalizada</strong>
                    <p>El chat está cerrado y ya no admite nuevos mensajes.</p>
                  </div>
                </div>
              ) : (
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
              )}

              <div className="jira-comment-list">
                {messagesLoading ? (
                  <div className="jira-comment-empty">Cargando comentarios…</div>
                ) : visibleMessages.length === 0 ? (
                  <div className="jira-comment-empty">Todavía no hay comentarios en este issue.</div>
                ) : (
                  [...visibleMessages].reverse().map((msg) => {
                    const authorName = msg.autorNombre || (msg.autorTipo === 'SOPORTE' ? (isQa ? 'QA RepuesTop' : 'Soporte') : 'Usuario');
                    const roleLabel = msg.autorRol || (msg.autorTipo === 'SOPORTE' ? (isQa ? 'QA' : 'Equipo') : null);
                    return (
                      <div key={msg.id} className="jira-comment">
                        <Avatar name={authorName} size={32} imageUrl={msg.autorAvatarUrl} />
                        <div className="jira-comment-content">
                          <div className="jira-comment-head">
                            <strong>{authorName}</strong>
                            {roleLabel && (
                              <span className={`jira-role-chip ${msg.autorTipo === 'SOPORTE' ? '' : 'jira-role-chip-user'}`}>{roleLabel}</span>
                            )}
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
            {/* Los tickets de soporte cambian de estado solo por acciones del flujo. QA mantiene su selector propio. */}
            <div className="jira-status-block" ref={statusMenuRef}>
              {canQaReview || !isQa ? (
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
                      ) : operatorsForbidden ? (
                        <div className="jira-assignee-menu-empty">Tu cuenta no puede consultar la lista de operadores. Pide a un super administrador que asigne el ticket.</div>
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
                <span className="jira-assignee"><Avatar name={ticket.reporterName || 'Usuario'} size={20} /> <FounderSellerName name={ticket.reporterName || 'No informado'} founder={ticket.reporterType === 'VENDEDOR' && ticket.sellerFounder} /></span>
              </SidebarField>
              {ticket.correoContacto && (
                <SidebarField icon="mail" label="Correo">
                  <a href={`mailto:${ticket.correoContacto}`} style={{ color: '#0052CC', textDecoration: 'none' }}>{ticket.correoContacto}</a>
                </SidebarField>
              )}
              {ticket.telefonoContacto && (
                <SidebarField icon="phone" label="Teléfono">
                  {ticket.telefonoContacto}
                </SidebarField>
              )}
              {ticket.regionContacto && (
                <SidebarField icon="map-pin" label="Ubicación">
                  {ticket.comunaContacto}, {ticket.regionContacto}
                </SidebarField>
              )}
              {!isQa && (
                <SidebarField icon="target" label="Tipo de reportante">
                  {ticket.platform === 'SITIO_WEB' ? 'Consulta web' : REPORTER_LABELS[ticket.reporterType]}
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
