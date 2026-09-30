import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import type { EstadoChat, TarjetaChat } from '@/api/supportCargaInventario';
import { ESTADO_LABELS, ESTADO_TONES, MOTIVO_LABELS, formatCierreAutomatico, formatFechaHora, formatRelativo } from './cargaInventarioLabels';

/** Badge del estado de la conversación; el cierre por inactividad va en gris. */
export function EstadoChatBadge({ estado }: { estado: EstadoChat }) {
  const tone = ESTADO_TONES[estado];
  if (!tone) return <span className="badge carga-badge-neutral">{ESTADO_LABELS[estado]}</span>;
  return <Badge text={ESTADO_LABELS[estado]} variant={tone} />;
}

export function nombreTienda(chat: TarjetaChat): string {
  return chat.tienda.nombreTienda?.trim() || `Tienda #${chat.tienda.proveedorId}`;
}

export function previewUltimoMensaje(chat: TarjetaChat): string {
  const texto = chat.ultimoMensajePreview?.trim();
  if (!texto) return chat.motivoDetalle;
  if (chat.ultimoMensajeAutor === 'SOPORTE') return `Soporte: ${texto}`;
  return texto;
}

interface ChatCargaTarjetaProps {
  chat: TarjetaChat;
  selected: boolean;
  onSelect: () => void;
}

/** Tarjeta de la bandeja (escritorio): tienda, motivo, estado, último mensaje y no leídos. */
export default function ChatCargaTarjeta({ chat, selected, onSelect }: ChatCargaTarjetaProps) {
  const { tienda } = chat;
  const tieneNoLeidos = chat.noLeidos > 0;

  return (
    <button
      type="button"
      className={`carga-chat-card${selected ? ' selected' : ''}${tieneNoLeidos ? ' unread' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Conversación con ${nombreTienda(chat)}${tieneNoLeidos ? `, ${chat.noLeidos} sin leer` : ''}`}
    >
      <div className="carga-chat-card-head">
        <strong className="carga-chat-card-store">{nombreTienda(chat)}</strong>
        <span className="carga-chat-card-time" title={formatFechaHora(chat.ultimoMensajeAt ?? chat.createdAt)}>
          {formatRelativo(chat.ultimoMensajeAt ?? chat.createdAt)}
        </span>
      </div>

      <div className="carga-chat-card-ids">
        {tienda.rut ? <span>{tienda.rut}</span> : null}
        {tienda.email ? <span>{tienda.email}</span> : null}
        {tienda.telefono ? <span>{tienda.telefono}</span> : null}
        {tienda.contacto ? <span>{tienda.contacto}</span> : null}
      </div>

      <div className="carga-chat-card-motivo">
        <EstadoChatBadge estado={chat.estado} />
        <span className="carga-chat-card-motivo-label">{MOTIVO_LABELS[chat.motivo]}</span>
      </div>

      {chat.motivoDetalle ? <p className="carga-chat-card-detalle">{chat.motivoDetalle}</p> : null}

      <div className="carga-chat-card-foot">
        <span className="carga-chat-card-preview">{previewUltimoMensaje(chat)}</span>
        {tieneNoLeidos ? <span className="carga-chat-unread" aria-hidden="true">{chat.noLeidos > 99 ? '99+' : chat.noLeidos}</span> : null}
      </div>

      {chat.cierreAutomaticoAt ? (
        <span className="carga-chat-card-cierre">
          <UiIcon name="clock" />
          Se cierra sola {formatCierreAutomatico(chat.cierreAutomaticoAt)}
        </span>
      ) : null}
    </button>
  );
}
