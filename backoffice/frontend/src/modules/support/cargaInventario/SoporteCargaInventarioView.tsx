import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as cargaApi from '@/api/supportCargaInventario';
import type { FiltroEstadoChat, TarjetaChat } from '@/api/supportCargaInventario';
import UiIcon from '@/components/shared/UiIcon';
import { EmptyState, RecordCard, RecordList } from '@/components/mobile';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useBackToClose } from '@/hooks/useBackToClose';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import ChatCargaTarjeta, { EstadoChatBadge, nombreTienda, previewUltimoMensaje } from './ChatCargaTarjeta';
import ChatCargaConversacion, { CARGA_CHATS_KEY, CARGA_RESUMEN_KEY } from './ChatCargaConversacion';
import { FILTROS_ESTADO, MOTIVO_LABELS, contarFiltro, formatCierreAutomatico, formatRelativo } from './cargaInventarioLabels';

const PAGE_SIZE = 20;

/** Resumen de la bandeja (abiertas, no leídas y conteo por estado). Lo comparte el tab de SupportPage. */
export function useResumenCargaInventario(enabled = true) {
  return useQuery({
    queryKey: [CARGA_RESUMEN_KEY],
    queryFn: cargaApi.getResumen,
    enabled,
    refetchInterval: 15000,
  });
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Conversacion a pantalla completa en el telefono, al estilo de una app de mensajeria: la
 * pagina de fondo no se mueve y el alto sigue al area visible (visualViewport), asi el
 * teclado no tapa el campo de texto ni empuja la cabecera fuera de la pantalla.
 */
function ConversacionMovil({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLockBodyScroll(true);

  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const ajustar = () => {
      el.style.height = `${vv.height}px`;
      el.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : '';
    };
    ajustar();
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    return () => {
      vv.removeEventListener('resize', ajustar);
      vv.removeEventListener('scroll', ajustar);
    };
  }, []);

  return createPortal(
    <div ref={ref} className="carga-chat-mobile-detail" role="dialog" aria-modal="true" aria-label="Conversación de soporte">
      {children}
    </div>,
    document.body,
  );
}

export default function SoporteCargaInventarioView() {
  const isMobile = useIsMobile();
  const [filtro, setFiltro] = useState<FiltroEstadoChat>('ABIERTOS');
  const [busqueda, setBusqueda] = useState('');
  const q = useDebouncedValue(busqueda.trim(), 350);
  const [page, setPage] = useState(0);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);

  const cerrarConversacion = useCallback(() => setSeleccionadoId(null), []);
  useBackToClose(isMobile && seleccionadoId !== null, cerrarConversacion, 'soporte-carga-conversacion');

  useEffect(() => {
    setPage(0);
  }, [filtro, q]);

  const { data: resumen } = useResumenCargaInventario();

  const { data: pagina, isLoading, isError, isFetching } = useQuery({
    queryKey: [CARGA_CHATS_KEY, filtro, q, page],
    queryFn: () => cargaApi.listChats({ estado: filtro, q: q || undefined, page, size: PAGE_SIZE }),
    refetchInterval: 10000,
    placeholderData: keepPreviousData,
  });

  const chats = pagina?.content ?? [];
  const totalPages = pagina?.totalPages ?? 0;
  const seleccionado: TarjetaChat | undefined = chats.find((chat) => chat.id === seleccionadoId);

  const chips = (
    <div className="carga-chat-chips" role="tablist" aria-label="Filtrar por estado">
      {FILTROS_ESTADO.map((opcion) => {
        const cantidad = contarFiltro(resumen, opcion.value);
        const activo = filtro === opcion.value;
        return (
          <button
            key={opcion.value}
            type="button"
            role="tab"
            aria-selected={activo}
            className={`carga-chat-chip${activo ? ' active' : ''}`}
            onClick={() => setFiltro(opcion.value)}
          >
            {opcion.label}
            {cantidad !== null ? <span className="carga-chat-chip-count">{cantidad}</span> : null}
          </button>
        );
      })}
    </div>
  );

  const buscador = (
    <label className="carga-chat-search">
      <UiIcon name="search" />
      <input
        className="input"
        type="search"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar por tienda, RUT o correo"
        aria-label="Buscar conversación por tienda, RUT o correo"
      />
    </label>
  );

  const vacio = q
    ? 'No hay conversaciones que coincidan con la búsqueda.'
    : filtro === 'CERRADOS'
      ? 'Todavía no hay conversaciones cerradas.'
      : 'No hay conversaciones en este estado.';

  const paginacion = totalPages > 1 ? (
    <div className="carga-chat-pagination">
      <button className="page-button" type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</button>
      <span>Página {page + 1} de {totalPages}</span>
      <button className="page-button" type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
    </div>
  ) : null;

  const intro = (
    <div className="carga-chat-intro">
      <div>
        <h2>Soporte carga de inventario</h2>
        <p>Vendedores que piden ayuda para cargar su inventario. Solo el vendedor puede cerrar la conversación; se cierra sola si no responde en 24 horas.</p>
      </div>
      {resumen ? (
        <div className="carga-chat-intro-kpis">
          <span><strong>{resumen.abiertos}</strong> abiertas</span>
          <span className={resumen.noLeidos > 0 ? 'unread' : undefined}><strong>{resumen.noLeidos}</strong> sin leer</span>
        </div>
      ) : null}
    </div>
  );

  if (isMobile) {
    if (seleccionadoId !== null) {
      return (
        <ConversacionMovil>
          <ChatCargaConversacion key={seleccionadoId} chatId={seleccionadoId} inicial={seleccionado} onBack={cerrarConversacion} />
        </ConversacionMovil>
      );
    }

    return (
      <div className="carga-chat-view">
        {intro}
        {chips}
        <div className="mb-filter-row">{buscador}</div>
        <RecordList
          loading={isLoading}
          ariaLabel="Conversaciones de soporte de carga"
          empty={isError
            ? <EmptyState tone="error" icon="alert" title="No se pudieron cargar las conversaciones" description="Se volverá a intentar en unos segundos." />
            : <EmptyState icon="message" title="Sin conversaciones" description={vacio} />}
        >
          {chats.map((chat) => (
            <RecordCard
              key={chat.id}
              title={nombreTienda(chat)}
              subtitle={[chat.tienda.rut, MOTIVO_LABELS[chat.motivo]].filter(Boolean).join(' · ')}
              badge={<EstadoChatBadge estado={chat.estado} />}
              tone={chat.noLeidos > 0 ? 'warning' : 'default'}
              onPress={() => setSeleccionadoId(chat.id)}
              ariaLabel={`Conversación con ${nombreTienda(chat)}`}
              meta={[
                { label: 'Último mensaje', value: previewUltimoMensaje(chat), wide: true },
                { label: 'Hora', value: formatRelativo(chat.ultimoMensajeAt ?? chat.createdAt) },
                { label: 'Sin leer', value: chat.noLeidos > 0 ? <span className="carga-chat-unread">{chat.noLeidos}</span> : '0' },
                ...(chat.tienda.email ? [{ label: 'Correo', value: chat.tienda.email }] : []),
                ...(chat.tienda.telefono ? [{ label: 'Teléfono', value: chat.tienda.telefono }] : []),
              ]}
              footer={chat.cierreAutomaticoAt ? (
                <span className="carga-chat-card-cierre">
                  <UiIcon name="clock" />
                  Se cierra sola {formatCierreAutomatico(chat.cierreAutomaticoAt)}
                </span>
              ) : undefined}
            />
          ))}
        </RecordList>
        {paginacion}
      </div>
    );
  }

  return (
    <div className="carga-chat-view">
      {intro}
      <div className="carga-chat-toolbar">
        {chips}
        {buscador}
      </div>

      <div className="carga-chat-layout">
        <aside className="carga-chat-list" aria-label="Conversaciones" aria-busy={isFetching}>
          {isLoading ? (
            <div className="carga-chat-list-empty"><p>Cargando conversaciones…</p></div>
          ) : isError && !chats.length ? (
            <div className="carga-chat-list-empty">
              <UiIcon name="alert" />
              <p>No se pudieron cargar las conversaciones. Se volverá a intentar en unos segundos.</p>
            </div>
          ) : chats.length ? (
            chats.map((chat) => (
              <ChatCargaTarjeta
                key={chat.id}
                chat={chat}
                selected={chat.id === seleccionadoId}
                onSelect={() => setSeleccionadoId(chat.id)}
              />
            ))
          ) : (
            <div className="carga-chat-list-empty">
              <UiIcon name="message" />
              <p>{vacio}</p>
            </div>
          )}
          {paginacion}
        </aside>

        {seleccionadoId !== null ? (
          <ChatCargaConversacion key={seleccionadoId} chatId={seleccionadoId} inicial={seleccionado} />
        ) : (
          <section className="mediation-chat-card carga-chat-conversation carga-chat-placeholder">
            <div className="mediation-chat-empty">
              <UiIcon name="message" />
              <p>Elige una conversación de la lista para verla y responder.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
