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

const PLATFORM_LABELS: Record<TicketPlatform, string> = {
  ADMINISTRACION_CONTABLE: 'Administración Contable',
  MEDIACION_CONFIANZA: 'Mediación y Confianza',
  APP_MOBILE: 'App Mobile RepuesTop',
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
          <span className="support-ticket-detail-main-icon"><UiIcon name="message" /></span>
          <div className="support-ticket-detail-heading">
            <span>Detalle del reporte · {ticket.externalId}</span>
            <h2 id="support-ticket-detail-title">{ticket.reason}</h2>
          </div>
          <div className="support-ticket-detail-badges">
            <span className={`support-ticket-pill tone-${STATUS_TONES[ticket.status]}`}><i /> {STATUS_LABELS[ticket.status]}</span>
            <span className={`support-ticket-pill tone-${PRIORITY_TONES[ticket.priority]}`}><UiIcon name="flag" /> {PRIORITY_LABELS[ticket.priority]}</span>
            <span className="support-ticket-pill tone-cyan"><UiIcon name="clock" /> {ticket.sla || 'SLA no informado'}</span>
          </div>
          <button className="support-ticket-close" type="button" onClick={onClose} aria-label="Cerrar detalle del ticket">
            <UiIcon name="close" /><span>Cerrar</span>
          </button>
        </header>

        <div className="support-ticket-detail-content">
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

          <main className="support-ticket-detail-main">
            {isLoading && <div className="support-ticket-detail-loading">Actualizando datos desde el backend...</div>}

            <section className="support-ticket-detail-panel">
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
                      placeholder="Escribe una respuesta para el usuario..."
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
                  <UiIcon name="clock" /> Atender e iniciar proceso
                </button>
              )}
              {!isFinished && (
                <button className="support-ticket-action resolve" type="button" disabled={isUpdating} onClick={() => onStatusChange('RESUELTO')}>
                  <UiIcon name="check" /> Resolver ticket
                </button>
              )}
              {ticket.status !== 'CERRADO' && ticket.status !== 'CANCELADO' && (
                <button className="support-ticket-action close" type="button" disabled={isUpdating} onClick={() => onStatusChange('CERRADO')}>
                  <UiIcon name="close" /> Cerrar ticket
                </button>
              )}
            </footer>
          </main>
        </div>
      </section>
    </div>
  );
}
