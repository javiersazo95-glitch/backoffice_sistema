import { useEffect, useRef, useState, type ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import { formatDate, formatDateTime } from '@/utils/formatters';
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
import { resolveDocumentUrl } from '@/utils/documentUrls';

const PLATFORM_LABELS: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App Mobile RepuesTop',
  SOPORTE: 'Soporte',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  FALLA_TECNICA: 'Falla técnica', SOLICITUD_AYUDA: 'Solicitud de ayuda', CONSULTA: 'Consulta',
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

const STATUS_TONES: Record<TicketStatus, string> = {
  ABIERTO: 'green', EN_PROCESO: 'blue', PENDIENTE_VENDEDOR: 'violet',
  PENDIENTE_COMPRADOR: 'violet', SLA_VENCIDO: 'red', RESUELTO: 'green',
  CERRADO: 'neutral', CANCELADO: 'red',
};

const PRIORITY_TONES: Record<TicketPriority, string> = {
  CRITICA: 'red', ALTA: 'red', MEDIA: 'violet', BAJA: 'green',
};

function DetailItem({ icon, label, children, tone = 'blue' }: {
  icon: string;
  label: string;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className="support-ticket-detail-item">
      <span className={`support-ticket-detail-item-icon tone-${tone}`}><UiIcon name={icon} /></span>
      <div><span>{label}</span><strong>{children}</strong></div>
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
}

export default function SupportTicketDetailModal({
  ticket, isLoading, isUpdating, notes: _notes, onNotesChange: _onNotesChange, onClose, onStatusChange,
}: Props) {
  const isFinished = ['RESUELTO', 'CERRADO', 'CANCELADO'].includes(ticket.status);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const msg = await supportApi.sendTicketMessage(ticket.id, {
        autorTipo: 'SOPORTE',
        autorNombre: 'Soporte RepuesTop',
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendReply();
    }
  };

  return (
    <div className="case-modal-backdrop support-ticket-detail-backdrop" onClick={onClose}>
      <section className="support-ticket-detail-modal" role="dialog" aria-modal="true" aria-labelledby="support-ticket-detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="support-ticket-detail-header">
          <span className="support-ticket-detail-main-icon">
            <UiIcon name={ticket.origin === 'QA' ? 'alert' : 'message'} />
          </span>
          <div className="support-ticket-detail-heading">
            <span>{ticket.origin === 'QA' ? 'Detalle del Defecto QA' : 'Detalle del reporte'} · {ticket.externalId}</span>
            <h2 id="support-ticket-detail-title">{ticket.reason}</h2>
          </div>
          <div className="support-ticket-detail-badges">
            <span className={`support-ticket-pill tone-${STATUS_TONES[ticket.status]}`}><i /> {STATUS_LABELS[ticket.status]}</span>
            <span className={`support-ticket-pill tone-${PRIORITY_TONES[ticket.priority]}`}><UiIcon name="flag" /> {PRIORITY_LABELS[ticket.priority]}</span>
            {ticket.origin !== 'QA' ? (
              <span className="support-ticket-pill tone-cyan"><UiIcon name="clock" /> {ticket.sla || 'SLA no informado'}</span>
            ) : ticket.entorno ? (
              <span className="support-ticket-pill tone-cyan"><UiIcon name="dashboard" /> Entorno: {ticket.entorno}</span>
            ) : null}
          </div>
          <button className="support-ticket-close" type="button" onClick={onClose} aria-label="Cerrar detalle del ticket">
            <UiIcon name="close" /><span>Cerrar</span>
          </button>
        </header>

        <div className="support-ticket-detail-content">
          {ticket.origin === 'QA' ? (
            <aside className="support-ticket-detail-sidebar" aria-label="Información del defecto QA">
              <DetailItem icon="users" label="Reportado por (QA)">{ticket.reporterName || 'QA RepuesTop'}</DetailItem>
              <DetailItem icon="calendar" label="Fecha de registro">{formatDate(ticket.createdAt)}</DetailItem>
              <div className="support-ticket-detail-divider" />
              <DetailItem icon="settings" label="Área" tone="violet">{ticket.platform ? PLATFORM_LABELS[ticket.platform] : 'Soporte'}</DetailItem>
              <DetailItem icon="flag" label="Criticidad" tone="red">{PRIORITY_LABELS[ticket.priority]}</DetailItem>
              <DetailItem icon="wallet" label="Estado actual" tone="green">{STATUS_LABELS[ticket.status]}</DetailItem>
              <DetailItem icon="dashboard" label="Entorno" tone="cyan">{ticket.entorno || 'No especificado'}</DetailItem>
              {ticket.documentoUrl && (
                <>
                  <div className="support-ticket-detail-divider" />
                  <DetailItem icon="file" label="Documento Adjunto" tone="violet">
                    <button
                      className="link-button"
                      type="button"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--blue)', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
                      onClick={() => {
                        const url = resolveDocumentUrl(ticket.documentoUrl);
                        if (url) window.open(url, '_blank');
                      }}
                    >
                      Ver evidencia
                    </button>
                  </DetailItem>
                </>
              )}
            </aside>
          ) : (
            <aside className="support-ticket-detail-sidebar" aria-label="Información del ticket">
              <DetailItem icon="users" label="Reportante">{ticket.reporterName || 'No informado'}</DetailItem>
              <DetailItem icon="users" label="Tipo de usuario" tone="cyan">{REPORTER_LABELS[ticket.reporterType]}</DetailItem>
              <DetailItem icon="calendar" label="Fecha de creación">{formatDate(ticket.createdAt)}</DetailItem>
              <div className="support-ticket-detail-divider" />
              <DetailItem icon="settings" label="Categoría" tone="violet">{CATEGORY_LABELS[ticket.category]}</DetailItem>
              <DetailItem icon="flag" label="Prioridad" tone="violet">{PRIORITY_LABELS[ticket.priority]}</DetailItem>
              <DetailItem icon="wallet" label="Estado actual" tone="green">{STATUS_LABELS[ticket.status]}</DetailItem>
              <DetailItem icon="clock" label="SLA / tiempo restante" tone="cyan">{ticket.sla || 'No especificado'}</DetailItem>
              <div className="support-ticket-detail-divider" />
              <DetailItem icon="dashboard" label="Plataforma origen">{ticket.platform ? PLATFORM_LABELS[ticket.platform] : 'General / no informada'}</DetailItem>
            </aside>
          )}

          <main className="support-ticket-detail-main">
            {isLoading && <div className="support-ticket-detail-loading">Actualizando datos desde el backend...</div>}

            {ticket.origin === 'QA' && (
              <section className="support-ticket-detail-panel" style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#1e293b' }}>Descripción del Defecto</h3>
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', color: '#334155', fontSize: '13px', lineHeight: '1.5' }}>
                  {ticket.lastMessage || 'Sin descripción detallada.'}
                </div>
                {ticket.documentoUrl && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', border: '1px dashed #bbf7d0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UiIcon name="file" style={{ color: '#16a34a' }} />
                    <div style={{ flex: 1, fontSize: '12.5px' }}>
                      <strong style={{ color: '#14532d' }}>Documento de evidencia adjunto</strong>
                      <div style={{ color: '#15803d', fontSize: '11px' }}>Sube tu reporte o captura para revisión</div>
                    </div>
                    <button
                      type="button"
                      className="page-button"
                      style={{ minHeight: '30px', padding: '0 12px', borderColor: '#bbf7d0', color: '#16a34a' }}
                      onClick={() => {
                        const url = resolveDocumentUrl(ticket.documentoUrl);
                        if (url) window.open(url, '_blank');
                      }}
                    >
                      Abrir documento
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="support-ticket-detail-panel">
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', color: '#1e293b' }}>
                {ticket.origin === 'QA' ? 'Historial de revisiones y comentarios' : 'Conversación de soporte'}
              </h3>
              <div className="support-ticket-chat">
                {messagesLoading ? (
                  <div className="support-ticket-chat-loading">Cargando conversación...</div>
                ) : messages.length === 0 ? (
                  <div className="support-ticket-chat-empty">No hay mensajes en este ticket.</div>
                ) : (
                  <div className="support-ticket-chat-messages">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`support-ticket-chat-bubble ${msg.autorTipo === 'SOPORTE' ? 'soporte' : 'usuario'}`}>
                        <div className="support-ticket-chat-bubble-header">
                          <strong>{msg.autorNombre || (msg.autorTipo === 'SOPORTE' ? 'Soporte' : 'Usuario')}</strong>
                          <span>{formatDateTime(msg.createdAt)}</span>
                        </div>
                        <div className="support-ticket-chat-bubble-text">{msg.mensaje}</div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {!isFinished && (
                  <div className="support-ticket-chat-reply">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={ticket.origin === 'QA' ? "Escribe un comentario o revisión..." : "Escribe una respuesta para el usuario..."}
                      rows={2}
                      disabled={sending}
                    />
                    <button
                      className="support-ticket-action start"
                      type="button"
                      disabled={!replyText.trim() || sending}
                      onClick={handleSendReply}
                    >
                      <UiIcon name="send" />
                      {sending ? 'Enviando...' : 'Enviar respuesta'}
                    </button>
                  </div>
                )}
              </div>
            </section>

            <footer className="support-ticket-detail-actions">
              {ticket.status === 'ABIERTO' && (
                <button className="support-ticket-action start" type="button" disabled={isUpdating} onClick={() => onStatusChange('EN_PROCESO')}>
                  <UiIcon name="clock" /> {ticket.origin === 'QA' ? 'Atender y revisar defecto' : 'Atender e iniciar proceso'}
                </button>
              )}
              {!isFinished && (
                <button className="support-ticket-action resolve" type="button" disabled={isUpdating} onClick={() => onStatusChange('RESUELTO')}>
                  <UiIcon name="check" /> {ticket.origin === 'QA' ? 'Marcar como Corregido' : 'Resolver ticket'}
                </button>
              )}
              {ticket.status !== 'CERRADO' && ticket.status !== 'CANCELADO' && (
                <button className="support-ticket-action close" type="button" disabled={isUpdating} onClick={() => onStatusChange('CERRADO')}>
                  <UiIcon name="close" /> {ticket.origin === 'QA' ? 'Cerrar reporte' : 'Cerrar ticket'}
                </button>
              )}
            </footer>
          </main>
        </div>
      </section>
    </div>
  );
}
