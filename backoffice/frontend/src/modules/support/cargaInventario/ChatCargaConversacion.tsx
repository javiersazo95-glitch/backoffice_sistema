import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as cargaApi from '@/api/supportCargaInventario';
import type { EstadoChatEditable, MensajeChat, TarjetaChat } from '@/api/supportCargaInventario';
import AuthedImage from '@/components/shared/AuthedImage';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { EstadoChatBadge, nombreTienda } from './ChatCargaTarjeta';
import {
  ESTADOS_EDITABLES,
  ESTADO_LABELS,
  MOTIVO_LABELS,
  describirContexto,
  formatCierreAutomatico,
  formatFechaHora,
  formatHora,
  isChatCerrado,
  mensajeDeError,
} from './cargaInventarioLabels';

export const CARGA_CHATS_KEY = 'support-carga-chats';
export const CARGA_RESUMEN_KEY = 'support-carga-resumen';
const CHAT_KEY = 'support-carga-chat';
const MENSAJES_KEY = 'support-carga-chat-mensajes';

const MAX_TEXTO = 2000;
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
/** Tope de mensajes por respuesta del backend; si llega lleno se pide el siguiente tramo. */
const LOTE_MENSAJES = 200;

function mergeMensajes(actuales: MensajeChat[], nuevos: MensajeChat[]): MensajeChat[] {
  if (!nuevos.length) return actuales;
  const porId = new Map<number, MensajeChat>();
  for (const mensaje of actuales) porId.set(mensaje.id, mensaje);
  for (const mensaje of nuevos) porId.set(mensaje.id, mensaje);
  return Array.from(porId.values()).sort((a, b) => a.id - b.id);
}

function ultimoId(mensajes: MensajeChat[] | undefined): number | undefined {
  if (!mensajes || !mensajes.length) return undefined;
  return mensajes[mensajes.length - 1]?.id;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImagenLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="carga-chat-lightbox" role="dialog" aria-modal="true" aria-label="Imagen ampliada" onClick={onClose}>
      <button className="carga-chat-lightbox-close" type="button" onClick={onClose} aria-label="Cerrar imagen">
        <UiIcon name="close" />
      </button>
      <AuthedImage src={src} alt="Imagen enviada en la conversación" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

function MensajeBurbuja({
  mensaje,
  tienda,
  onAbrirImagen,
  onImagenCargada,
}: {
  mensaje: MensajeChat;
  tienda: string;
  onAbrirImagen: (src: string) => void;
  onImagenCargada: () => void;
}) {
  if (mensaje.autor === 'SISTEMA') {
    return (
      <div className="carga-chat-system" role="note">
        <span>{mensaje.texto}</span>
        <time dateTime={mensaje.createdAt}>{formatFechaHora(mensaje.createdAt)}</time>
      </div>
    );
  }

  const esSoporte = mensaje.autor === 'SOPORTE';
  const lado = esSoporte ? 'outgoing' : 'incoming';
  const autor = mensaje.autorNombre?.trim() || (esSoporte ? 'Soporte' : tienda);

  return (
    <div className={`chat-bubble-row ${lado}`}>
      <div className={`chat-bubble ${lado} blue carga-chat-bubble`}>
        <div className="chat-bubble-meta">
          <strong>{esSoporte ? `${autor} · Soporte` : autor}</strong>
        </div>
        {mensaje.imagenUrl ? (
          <button
            className="carga-chat-image"
            type="button"
            onClick={() => onAbrirImagen(mensaje.imagenUrl as string)}
            aria-label="Ver imagen en grande"
          >
            <AuthedImage src={mensaje.imagenUrl} alt="Imagen adjunta" loading="lazy" onLoad={onImagenCargada} />
          </button>
        ) : null}
        {mensaje.texto ? <p>{mensaje.texto}</p> : null}
        <span title={formatFechaHora(mensaje.createdAt)}>{formatHora(mensaje.createdAt)}</span>
      </div>
    </div>
  );
}

interface ChatCargaConversacionProps {
  chatId: number;
  /** Tarjeta de la bandeja para pintar la cabecera mientras llega el detalle. */
  inicial?: TarjetaChat;
  /** En móvil: vuelve a la lista. */
  onBack?: () => void;
}

export default function ChatCargaConversacion({ chatId, inicial, onBack }: ChatCargaConversacionProps) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [imagen, setImagen] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const cercaDelFinalRef = useRef(true);
  const scrollInicialRef = useRef(false);
  const ultimoVendedorRef = useRef<number | undefined>(undefined);

  const invalidarBandeja = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CARGA_CHATS_KEY] });
    queryClient.invalidateQueries({ queryKey: [CARGA_RESUMEN_KEY] });
  }, [queryClient]);

  const { data: chat } = useQuery({
    queryKey: [CHAT_KEY, chatId],
    queryFn: () => cargaApi.getChat(chatId),
    placeholderData: inicial,
    refetchInterval: 10000,
  });

  const mensajesKey = useMemo(() => [MENSAJES_KEY, chatId] as const, [chatId]);

  // Sondeo incremental: la primera carga trae todo y las siguientes solo lo posterior al ultimo id.
  const { data: mensajes = [], isLoading: cargandoMensajes, isError: errorMensajes } = useQuery({
    queryKey: mensajesKey,
    queryFn: async () => {
      let acumulado = queryClient.getQueryData<MensajeChat[]>(mensajesKey) ?? [];
      for (let vuelta = 0; vuelta < 20; vuelta += 1) {
        const lote = await cargaApi.getMensajes(chatId, ultimoId(acumulado));
        acumulado = mergeMensajes(acumulado, lote);
        if (lote.length < LOTE_MENSAJES) break;
      }
      return acumulado;
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const cerrado = chat ? isChatCerrado(chat.estado) : false;
  const tienda = chat ? nombreTienda(chat) : 'Vendedor';

  const marcarLeidoMutation = useMutation({
    mutationFn: () => cargaApi.marcarLeido(chatId),
    onSuccess: () => {
      queryClient.setQueryData<TarjetaChat>([CHAT_KEY, chatId], (actual) => (actual ? { ...actual, noLeidos: 0 } : actual));
      invalidarBandeja();
    },
  });
  const marcarLeido = marcarLeidoMutation.mutate;

  // Al abrir la conversación se marca como leída (el padre la monta con key={chatId}).
  useEffect(() => {
    marcarLeido();
  }, [chatId, marcarLeido]);

  // Si el vendedor escribe mientras la conversación está abierta, también se da por leída.
  const ultimoDelVendedor = useMemo(() => {
    for (let i = mensajes.length - 1; i >= 0; i -= 1) {
      const mensaje = mensajes[i];
      if (mensaje?.autor === 'VENDEDOR') return mensaje.id;
    }
    return undefined;
  }, [mensajes]);

  useEffect(() => {
    if (ultimoDelVendedor === undefined) return;
    const anterior = ultimoVendedorRef.current;
    ultimoVendedorRef.current = ultimoDelVendedor;
    if (anterior !== undefined && anterior !== ultimoDelVendedor) marcarLeido();
  }, [ultimoDelVendedor, marcarLeido]);

  const scrollAlFinal = useCallback(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, []);

  const ultimoMensajeId = ultimoId(mensajes);
  useLayoutEffect(() => {
    if (ultimoMensajeId === undefined) return;
    if (!scrollInicialRef.current || cercaDelFinalRef.current) {
      scrollAlFinal();
      scrollInicialRef.current = true;
    }
  }, [ultimoMensajeId, scrollAlFinal]);

  const onImagenCargada = useCallback(() => {
    if (cercaDelFinalRef.current) scrollAlFinal();
  }, [scrollAlFinal]);

  const onScrollThread = () => {
    const thread = threadRef.current;
    if (!thread) return;
    cercaDelFinalRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
  };

  // Vista previa local de la imagen elegida; se libera al cambiarla o al salir.
  useEffect(() => {
    if (!imagen) {
      setImagenPreview(null);
      return;
    }
    const url = URL.createObjectURL(imagen);
    setImagenPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imagen]);

  const enviarMutation = useMutation({
    mutationFn: ({ contenido, archivo }: { contenido: string; archivo: File | null }) => (
      archivo ? cargaApi.sendImagen(chatId, archivo, contenido) : cargaApi.sendMensaje(chatId, contenido)
    ),
    onSuccess: (mensaje) => {
      queryClient.setQueryData<MensajeChat[]>(mensajesKey, (actuales) => mergeMensajes(actuales ?? [], [mensaje]));
      cercaDelFinalRef.current = true;
      setTexto('');
      setImagen(null);
      queryClient.invalidateQueries({ queryKey: [CHAT_KEY, chatId] });
      invalidarBandeja();
    },
    onError: (error) => {
      showToast(mensajeDeError(error, 'No se pudo enviar el mensaje. Intenta de nuevo.'));
    },
  });

  const estadoMutation = useMutation({
    mutationFn: (estado: EstadoChatEditable) => cargaApi.cambiarEstado(chatId, estado),
    onSuccess: (actualizado) => {
      queryClient.setQueryData([CHAT_KEY, chatId], actualizado);
      invalidarBandeja();
      showToast(`Estado actualizado: ${ESTADO_LABELS[actualizado.estado]}`);
    },
    onError: (error) => {
      showToast(mensajeDeError(error, 'No se pudo cambiar el estado.'));
    },
  });

  const puedeEnviar = !cerrado && !enviarMutation.isPending && (texto.trim().length > 0 || imagen !== null);

  const enviar = () => {
    if (!puedeEnviar) return;
    enviarMutation.mutate({ contenido: texto.trim(), archivo: imagen });
  };

  const onKeyDownTexto = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      enviar();
    }
  };

  const onElegirImagen = (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0] ?? null;
    // Se limpia el input para poder volver a elegir el mismo archivo tras un error.
    event.target.value = '';
    if (!archivo) return;
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      showToast('Solo puedes adjuntar imágenes JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > MAX_IMAGEN_BYTES) {
      showToast('La imagen supera los 5 MB. Elige una más liviana.');
      return;
    }
    setImagen(archivo);
  };

  const contexto = describirContexto(chat?.contexto);
  const estadoEditable = chat && !cerrado && ESTADOS_EDITABLES.some((opcion) => opcion.value === chat.estado)
    ? (chat.estado as EstadoChatEditable)
    : '';

  return (
    <section className="mediation-chat-card carga-chat-conversation" aria-label={`Conversación con ${tienda}`}>
      <header className="carga-chat-conv-head">
        {onBack ? (
          <button className="carga-chat-back" type="button" onClick={onBack} aria-label="Volver a la lista">
            <UiIcon name="arrowLeft" />
          </button>
        ) : null}
        <span className="mediation-chat-icon"><UiIcon name="store" /></span>
        <div className="carga-chat-conv-title">
          <h3>{tienda}</h3>
          <div className="carga-chat-conv-ids">
            {chat?.tienda.rut ? <span>RUT {chat.tienda.rut}</span> : null}
            {chat?.tienda.email ? <a href={`mailto:${chat.tienda.email}`}>{chat.tienda.email}</a> : null}
            {chat?.tienda.telefono ? <span>{chat.tienda.telefono}</span> : null}
            {chat?.tienda.contacto ? <span>Contacto: {chat.tienda.contacto}</span> : null}
          </div>
        </div>
        {chat ? <EstadoChatBadge estado={chat.estado} /> : null}
      </header>

      {chat ? (
        <div className="carga-chat-conv-info">
          <div className="carga-chat-conv-facts">
            <span><strong>Motivo:</strong> {MOTIVO_LABELS[chat.motivo]}</span>
            <span><strong>Abierta:</strong> {formatFechaHora(chat.createdAt)}</span>
            {chat.atendidoPor ? <span><strong>Atiende:</strong> {chat.atendidoPor}</span> : null}
          </div>
          {contexto ? (
            <div className="carga-chat-contexto">
              <UiIcon name="info" />
              <span>
                <strong>Estaba en:</strong>{' '}
                {[contexto.flujo, contexto.detalle].filter(Boolean).join(' — ')}
              </span>
            </div>
          ) : null}
          <label className="carga-chat-estado">
            <span>Estado</span>
            <select
              value={estadoEditable}
              disabled={cerrado || estadoMutation.isPending}
              onChange={(event) => {
                const valor = event.target.value as EstadoChatEditable;
                if (valor && valor !== chat.estado) estadoMutation.mutate(valor);
              }}
            >
              {estadoEditable === '' ? <option value="">{ESTADO_LABELS[chat.estado]}</option> : null}
              {ESTADOS_EDITABLES.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {chat && cerrado ? (
        <div className="carga-chat-banner closed" role="status">
          <UiIcon name="lock" />
          <span>
            {chat.estado === 'CERRADO_POR_VENDEDOR'
              ? 'El vendedor cerró esta conversación'
              : 'Esta conversación se cerró por inactividad'}
            {chat.cerradoAt ? ` el ${formatFechaHora(chat.cerradoAt)}` : ''}. Ya no se pueden enviar mensajes; si necesita más ayuda, el vendedor puede abrir una nueva.
          </span>
        </div>
      ) : chat ? (
        <div className="carga-chat-banner" role="note">
          <UiIcon name="info" />
          <span>
            Solo el vendedor puede cerrar la conversación.
            {chat.cierreAutomaticoAt
              ? ` Si no responde, se cierra sola ${formatCierreAutomatico(chat.cierreAutomaticoAt)}.`
              : ' Se cierra sola si no responde en 24 horas después de tu último mensaje.'}
          </span>
        </div>
      ) : null}

      <div className="mediation-chat-thread carga-chat-thread" ref={threadRef} onScroll={onScrollThread} aria-live="polite">
        {cargandoMensajes ? (
          <div className="mediation-chat-empty"><p>Cargando mensajes…</p></div>
        ) : errorMensajes && !mensajes.length ? (
          <div className="mediation-chat-empty">
            <UiIcon name="alert" />
            <p>No se pudieron cargar los mensajes. Se volverá a intentar en unos segundos.</p>
          </div>
        ) : mensajes.length ? (
          mensajes.map((mensaje) => (
            <MensajeBurbuja
              key={mensaje.id}
              mensaje={mensaje}
              tienda={tienda}
              onAbrirImagen={setLightboxSrc}
              onImagenCargada={onImagenCargada}
            />
          ))
        ) : (
          <div className="mediation-chat-empty">
            <UiIcon name="message" />
            <p>Aún no hay mensajes en esta conversación.</p>
          </div>
        )}
      </div>

      {imagen && imagenPreview ? (
        <div className="carga-chat-attachment">
          <img src={imagenPreview} alt="Imagen por enviar" />
          <div>
            <strong>{imagen.name}</strong>
            <span>{formatBytes(imagen.size)}</span>
          </div>
          <button type="button" onClick={() => setImagen(null)} aria-label="Quitar imagen" disabled={enviarMutation.isPending}>
            <UiIcon name="close" />
          </button>
        </div>
      ) : null}

      <div className="carga-chat-composer">
        <textarea
          className="carga-chat-textarea"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={onKeyDownTexto}
          maxLength={MAX_TEXTO}
          rows={2}
          disabled={cerrado || enviarMutation.isPending}
          placeholder={cerrado ? 'Conversación cerrada' : imagen ? 'Agrega un comentario a la imagen (opcional)' : 'Escribe tu respuesta… (Ctrl + Enter para enviar)'}
          aria-label={`Mensaje para ${tienda}`}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={onElegirImagen}
        />
        <button
          className="mediation-chat-send blue"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={cerrado || enviarMutation.isPending}
          aria-label="Adjuntar imagen"
          title="Adjuntar imagen (JPG, PNG o WEBP, máx. 5 MB)"
        >
          <UiIcon name="upload" />
        </button>
        <button
          className="carga-chat-send"
          type="button"
          onClick={enviar}
          disabled={!puedeEnviar}
          aria-label="Enviar mensaje"
        >
          <UiIcon name="arrowRight" />
          <span>{enviarMutation.isPending ? 'Enviando…' : 'Enviar'}</span>
        </button>
      </div>
      {!cerrado && texto.length > MAX_TEXTO - 200 ? (
        <span className="carga-chat-counter">{texto.length}/{MAX_TEXTO}</span>
      ) : null}

      {lightboxSrc ? <ImagenLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} /> : null}
    </section>
  );
}
