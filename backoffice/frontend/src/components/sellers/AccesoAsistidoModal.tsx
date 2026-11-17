import { useEffect, useRef, useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { mensajeDeError } from '@/api/client';
import type { AccesoAsistido, EstadoAcceso, NivelAcceso } from '@/api/accesoAsistido';
import { useAccionesAcceso, useCuentaRegresiva, useDetalleAcceso } from '@/hooks/useAccesoAsistido';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { useIsMobile } from '@/hooks/useIsMobile';
import { urlDeEntradaAlPanel } from '@/utils/panelUrl';
import { previewDocument } from '@/utils/documentUrls';
import { CambiosAcceso, CifrasAcceso, cambiosDe, fechaHora } from './AccesoAsistidoCambios';
import './AccesoAsistidoModal.css';

export const MOTIVO_ACCESO_MIN = 10;
export const MOTIVO_ACCESO_MAX = 500;

export const TITULO_NIVEL: Record<NivelAcceso, string> = {
  BASICO: 'Carga uno a uno',
  MEDIO: 'Carga uno a uno y precios',
  COMPLETO: 'Carga completa con Excel',
};

const NIVELES: { valor: NivelAcceso; icono: string; detalle: string; incluye: string[] }[] = [
  { valor: 'BASICO', icono: 'plus', detalle: 'Crear repuestos nuevos con el formulario.', incluye: ['Ver el inventario', 'Crear uno a uno'] },
  { valor: 'MEDIO', icono: 'percent', detalle: 'Además, cambiar precios de lo que ya existe.', incluye: ['Todo lo básico', 'Precios (no stock)'] },
  { valor: 'COMPLETO', icono: 'upload', detalle: 'Además, subir repuestos nuevos con un Excel.', incluye: ['Todo lo anterior', 'Carga masiva'] },
];

export const TEXTO_ESTADO: Record<EstadoAcceso, string> = {
  PENDIENTE_VENDEDOR: 'Esperando al vendedor',
  PENDIENTE_SOPORTE: 'El vendedor pidió ayuda',
  ACTIVO: 'Acceso activo',
  RECHAZADO: 'Rechazado por el vendedor',
  REVOCADO: 'Cortado por el vendedor',
  EXPIRADO: 'Venció',
  CANCELADO: 'Cancelado',
  FINALIZADO: 'Terminado por soporte',
};

/** Color de cada estado: ámbar espera, violeta pide ayuda, verde activo, gris/rojo cerrado. */
const TONO_ESTADO: Record<EstadoAcceso, 'ambar' | 'violeta' | 'verde' | 'rojo' | 'gris'> = {
  PENDIENTE_VENDEDOR: 'ambar',
  PENDIENTE_SOPORTE: 'violeta',
  ACTIVO: 'verde',
  RECHAZADO: 'rojo',
  REVOCADO: 'rojo',
  EXPIRADO: 'gris',
  CANCELADO: 'gris',
  FINALIZADO: 'gris',
};

/** Las cuatro etapas de un acceso, para la línea de avance del estado vivo. */
function etapaDe(acceso: AccesoAsistido): number {
  if (acceso.estado === 'ACTIVO') return 2;
  return 1; // pendiente: el correo (o la solicitud del vendedor) ya existe; falta la respuesta
}

function Pildora({ estado }: { estado: EstadoAcceso }) {
  return <span className={`aam-pildora ${TONO_ESTADO[estado]}`}>{TEXTO_ESTADO[estado]}</span>;
}

interface Props {
  isOpen: boolean;
  proveedorId: number | null;
  storeName?: string | null;
  onClose: () => void;
}

/**
 * "Ayuda con la carga" de una tienda (acceso asistido): pedir entrar a su panel como invitado, esperar y ver la
 * respuesta del vendedor, ver su solicitud de ayuda (con el adjunto), abrir el panel cuando el acceso está ACTIVO,
 * y revisar qué cargó soporte en cada acceso. Todo pasa por un ticket de un solo uso; el vendedor siempre autoriza
 * (o es él quien pidió la ayuda).
 */
export default function AccesoAsistidoModal({ isOpen, proveedorId, storeName, onClose }: Props) {
  const isMobile = useIsMobile();
  useLockBodyScroll(isOpen && isMobile);
  const [tab, setTab] = useState<'acceso' | 'historial'>('acceso');
  const detalle = useDetalleAcceso(proveedorId, isOpen);
  const acciones = useAccionesAcceso(proveedorId);
  const [nivel, setNivel] = useState<NivelAcceso>('BASICO');
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const actual = detalle.data?.actual ?? null;
  const serverTime = detalle.data?.serverTime ?? null;
  const historial = detalle.data?.historial ?? [];
  const cerrados = historial.filter((a) => a.id !== actual?.id);
  const ocupado = Object.values(acciones).some((m) => m.isPending);

  /**
   * Respuesta del vendedor mientras soporte espera en este mismo popup (sondeo cada 5 s): si autoriza, se avisa y
   * se habilita "Ingresar al panel"; si rechaza, vence o se cancela, la solicitud deja de estar viva y se explica
   * por qué con lo que quedó en el historial.
   */
  const [respuesta, setRespuesta] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
  const esperando = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen) {
      esperando.current = null;
      setRespuesta(null);
      setConfirmando(false);
      setTab('acceso');
      return;
    }
    if (!detalle.data) return;
    const vivo = detalle.data.actual;
    const idEsperado = esperando.current;
    if (vivo?.estado === 'PENDIENTE_VENDEDOR') {
      esperando.current = vivo.id;
      setRespuesta(null);
      return;
    }
    if (idEsperado == null) return;
    esperando.current = null;
    if (vivo?.id === idEsperado && vivo.estado === 'ACTIVO') {
      setRespuesta({
        tono: 'ok',
        texto: `${storeName ?? 'El vendedor'} autorizó el acceso${vivo.duracionHoras ? ` por ${vivo.duracionHoras} h` : ''} (${TITULO_NIVEL[vivo.nivel ?? vivo.nivelSolicitado]}). Ya puedes ingresar al panel.`,
      });
      return;
    }
    const cerrado = detalle.data.historial.find((a) => a.id === idEsperado);
    if (!cerrado) return;
    const textos: Partial<Record<EstadoAcceso, string>> = {
      RECHAZADO: `El vendedor rechazó la solicitud${cerrado.comentarioRechazo ? `: «${cerrado.comentarioRechazo}»` : '.'}`,
      EXPIRADO: 'La solicitud venció sin respuesta del vendedor. Puedes solicitarla de nuevo.',
      CANCELADO: 'La solicitud se canceló.',
    };
    const texto = textos[cerrado.estado];
    if (texto) setRespuesta({ tono: 'error', texto });
  }, [isOpen, detalle.data, storeName]);

  if (!isOpen) return null;

  /**
   * Abre el panel del vendedor en una ventana nueva. La ventana se abre ANTES de pedir el ticket (con el clic del
   * operador) para que el navegador no la bloquee; después se le pone la dirección con el ticket.
   */
  const abrirPanel = async (accesoId: number, aceptarAntes = false) => {
    const ventana = window.open('', '_blank');
    if (ventana) ventana.opener = null;
    try {
      if (aceptarAntes) await acciones.aceptar.mutateAsync(accesoId);
      const { ticket } = await acciones.emitirTicket.mutateAsync(accesoId);
      if (ventana) ventana.location.href = urlDeEntradaAlPanel(ticket);
      else showToast('El navegador bloqueó la ventana nueva. Permite ventanas emergentes para este sitio.');
    } catch (err) {
      ventana?.close();
      showToast(mensajeDeError(err));
    }
  };

  const ejecutar = async (tarea: () => Promise<unknown>, exito: string) => {
    try {
      await tarea();
      showToast(exito);
    } catch (err) {
      showToast(mensajeDeError(err));
    }
  };

  const motivoLargo = motivo.trim().length;
  const motivoOk = motivoLargo >= MOTIVO_ACCESO_MIN;

  const confirmarSolicitud = async () => {
    setConfirmando(false);
    if (proveedorId == null) return;
    try {
      // Soporte espera aquí mismo: el panel se abre recién cuando el vendedor autoriza ("Ingresar al panel").
      const creado = await acciones.solicitar.mutateAsync({ nivel, motivo: motivo.trim() });
      esperando.current = creado.id;
      setMotivo('');
      showToast('Solicitud enviada. Le avisamos al vendedor por correo.');
    } catch (err) {
      showToast(mensajeDeError(err));
    }
  };

  const subtitulo = !detalle.data
    ? 'Cargando…'
    : actual
      ? TEXTO_ESTADO[actual.estado]
      : 'Sin acceso en curso';

  /** Botones del pie según la pestaña y el estado del acceso vivo. */
  const pie = () => {
    if (tab !== 'acceso' || !detalle.data) return null;
    if (!actual) {
      return (
        <button className="aam-boton primario" type="submit" form="aam-form" disabled={!motivoOk || ocupado}>
          <UiIcon name="mail" /> Solicitar acceso al panel
        </button>
      );
    }
    if (actual.estado === 'PENDIENTE_VENDEDOR') {
      return (
        <>
          <button className="aam-boton" type="button" disabled={ocupado} onClick={() => void ejecutar(() => acciones.cancelar.mutateAsync(actual.id), 'Solicitud cancelada.')}>Cancelar solicitud</button>
          <button className="aam-boton" type="button" disabled={ocupado} onClick={() => void ejecutar(() => acciones.reenviar.mutateAsync(actual.id), 'Correo reenviado al vendedor.')}>
            <UiIcon name="refresh" /> Reenviar correo
          </button>
          <button className="aam-boton primario" type="button" disabled title="Se activa cuando el vendedor autorice">
            <UiIcon name="lock" /> Ingresar al panel
          </button>
        </>
      );
    }
    if (actual.estado === 'PENDIENTE_SOPORTE') {
      return (
        <button className="aam-boton primario" type="button" disabled={ocupado} onClick={() => void abrirPanel(actual.id, true)}>
          <UiIcon name="shieldCheck" /> Aceptar e ingresar al panel
        </button>
      );
    }
    if (actual.estado === 'ACTIVO') {
      return (
        <button className="aam-boton primario verde" type="button" disabled={ocupado} onClick={() => void abrirPanel(actual.id)}>
          <UiIcon name="monitor" /> Ingresar al panel
        </button>
      );
    }
    return null;
  };

  const botones = pie();

  return (
    <div className="case-modal-backdrop aam-fondo" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="aam" role="dialog" aria-modal="true" aria-labelledby="aam-titulo" onClick={(e) => e.stopPropagation()}>
        <header className={`aam-cabecera ${actual ? TONO_ESTADO[actual.estado] : 'neutro'}`}>
          <span className="aam-cabecera-icono"><UiIcon name="headset" /></span>
          <div className="aam-cabecera-texto">
            <span className="aam-antetitulo">Ayuda con la carga</span>
            <h2 id="aam-titulo">{storeName ?? 'Tienda'}</h2>
            <p>{subtitulo}</p>
          </div>
          <button className="aam-cerrar" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
          </button>
        </header>

        <nav className="aam-pestanas" role="tablist" aria-label="Secciones del acceso asistido">
          <button type="button" role="tab" aria-selected={tab === 'acceso'} className={tab === 'acceso' ? 'activa' : ''} onClick={() => setTab('acceso')}>
            <UiIcon name="shield" /> Acceso
          </button>
          <button type="button" role="tab" aria-selected={tab === 'historial'} className={tab === 'historial' ? 'activa' : ''} onClick={() => setTab('historial')}>
            <UiIcon name="clock" /> Historial <span className="aam-cuenta">{historial.length}</span>
          </button>
        </nav>

        <div className="aam-cuerpo">
          {detalle.isLoading && <div className="aam-cargando"><span className="aam-spinner" aria-hidden="true" /> Cargando…</div>}
          {detalle.isError && !detalle.data && <div className="aam-aviso error" role="alert"><UiIcon name="alert" /> No se pudo cargar el acceso asistido.</div>}

          {tab === 'acceso' && detalle.data && (
            <>
              {respuesta && (
                <div className={`aam-aviso ${respuesta.tono}`} role="status" aria-live="polite">
                  <UiIcon name={respuesta.tono === 'ok' ? 'check' : 'alert'} />
                  <span>{respuesta.texto}</span>
                </div>
              )}

              {actual ? (
                <AccesoVivo acceso={actual} serverTime={serverTime} storeName={storeName ?? null} />
              ) : (
                <form id="aam-form" className="aam-form" onSubmit={(e) => { e.preventDefault(); if (motivoOk) setConfirmando(true); }}>
                  <ul className="aam-garantias">
                    <li><UiIcon name="shieldCheck" /><span><strong>Con permiso</strong>El vendedor autoriza por correo y elige por cuánto tiempo.</span></li>
                    <li><UiIcon name="lock" /><span><strong>Solo crear</strong>Soporte nunca edita ni elimina repuestos.</span></li>
                    <li><UiIcon name="audit" /><span><strong>Todo registrado</strong>Cada ingreso y repuesto queda en el historial.</span></li>
                  </ul>

                  <fieldset className="aam-niveles">
                    <legend>¿Qué necesitas hacer?</legend>
                    {NIVELES.map((n) => (
                      <label key={n.valor} className={`aam-nivel ${nivel === n.valor ? 'activo' : ''}`}>
                        <input type="radio" name="nivelAcceso" checked={nivel === n.valor} onChange={() => setNivel(n.valor)} />
                        <span className="aam-nivel-icono"><UiIcon name={n.icono as never} /></span>
                        <strong>{TITULO_NIVEL[n.valor]}</strong>
                        <small>{n.detalle}</small>
                        <span className="aam-nivel-incluye">{n.incluye.map((x) => <em key={x}>{x}</em>)}</span>
                      </label>
                    ))}
                  </fieldset>

                  <label className="aam-campo">
                    <span>Motivo <small>— se lo mostramos al vendedor en el correo</small></span>
                    <textarea
                      value={motivo}
                      maxLength={MOTIVO_ACCESO_MAX}
                      rows={3}
                      placeholder="Ej: Cargar los 300 repuestos nuevos de frenos que nos envió por correo."
                      onChange={(e) => setMotivo(e.target.value)}
                    />
                    <span className={`aam-contador ${motivoLargo > 0 && !motivoOk ? 'falta' : ''}`}>
                      {motivoLargo > 0 && !motivoOk ? `Faltan ${MOTIVO_ACCESO_MIN - motivoLargo} caracteres` : `Mínimo ${MOTIVO_ACCESO_MIN} caracteres`}
                      <span>{motivoLargo}/{MOTIVO_ACCESO_MAX}</span>
                    </span>
                  </label>
                </form>
              )}
            </>
          )}

          {tab === 'historial' && detalle.data && <Historial accesos={cerrados} vivo={actual} onVerVivo={() => setTab('acceso')} />}
        </div>

        {botones && <footer className="aam-pie">{botones}</footer>}

        {confirmando && (
          <div className="aam-confirmar-fondo" onClick={() => setConfirmando(false)}>
            <div className="aam-confirmar" role="alertdialog" aria-modal="true" aria-labelledby="aam-confirmar-titulo" onClick={(e) => e.stopPropagation()}>
              <span className="aam-confirmar-icono"><UiIcon name="mail" /></span>
              <h3 id="aam-confirmar-titulo">¿Solicitar acceso al panel de {storeName ?? 'la tienda'}?</h3>
              <p>
                Le enviaremos un correo al vendedor. Espera aquí su respuesta: cuando lo autorice se activará
                «Ingresar al panel».
              </p>
              <dl>
                <dt>Permiso</dt><dd>{TITULO_NIVEL[nivel]}</dd>
                <dt>Motivo</dt><dd>{motivo.trim()}</dd>
              </dl>
              <div className="aam-confirmar-botones">
                <button className="aam-boton" type="button" onClick={() => setConfirmando(false)}>Volver</button>
                <button className="aam-boton primario" type="button" onClick={() => void confirmarSolicitud()}>Enviar solicitud</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccesoVivo({ acceso, serverTime, storeName }: { acceso: AccesoAsistido; serverTime: string | null; storeName: string | null }) {
  const activo = acceso.estado === 'ACTIVO';
  const fin = activo ? acceso.expiraEn : acceso.solicitudExpiraEn;
  const inicio = activo ? acceso.iniciaEn : acceso.creadoEn;
  const restante = useCuentaRegresiva(fin, serverTime);
  const total = fin && inicio ? Date.parse(fin) - Date.parse(inicio) : 0;
  const avance = total > 0 ? Math.min(100, Math.max(0, 100 - (restante.ms / total) * 100)) : 0;
  const etapa = etapaDe(acceso);
  const delVendedor = acceso.origen === 'VENDEDOR';
  const etapas = delVendedor
    ? ['El vendedor pide ayuda', 'Soporte acepta', 'Soporte carga', 'Termina']
    : ['Correo al vendedor', 'El vendedor autoriza', 'Soporte carga', 'Termina'];

  return (
    <div className="aam-vivo">
      <section className={`aam-reloj ${restante.tono}`} aria-label="Tiempo restante">
        <div className="aam-reloj-fila">
          <div>
            <span className="aam-reloj-rotulo">
              {activo ? 'El acceso vence en' : delVendedor ? 'La solicitud del vendedor vence en' : 'La solicitud vence en'}
            </span>
            <strong className="aam-reloj-tiempo" role="timer">{restante.texto}</strong>
          </div>
          <Pildora estado={acceso.estado} />
        </div>
        <div className="aam-barra" aria-hidden="true"><span style={{ width: `${avance}%` }} /></div>
        <small className="aam-reloj-pie">{activo ? `Hasta el ${fechaHora(fin)}` : `Vence el ${fechaHora(fin)} si nadie responde`}</small>
      </section>

      <ol className="aam-etapas" aria-label="Avance del acceso">
        {etapas.map((texto, i) => (
          <li key={texto} className={i < etapa ? 'hecha' : i === etapa ? 'actual' : ''}>
            <span className="aam-etapa-punto">{i < etapa ? <UiIcon name="check" /> : i + 1}</span>
            <span>{texto}</span>
          </li>
        ))}
      </ol>

      {acceso.estado === 'PENDIENTE_VENDEDOR' && (
        <div className="aam-aviso espera" role="status">
          <span className="aam-pulso" aria-hidden="true" />
          <span>
            Esperando que {storeName ?? 'el vendedor'} autorice. Le enviamos un correo el {fechaHora(acceso.creadoEn)}; esta
            ventana se actualiza sola y «Ingresar al panel» se activa apenas responda.
          </span>
        </div>
      )}
      {acceso.estado === 'PENDIENTE_SOPORTE' && (
        <div className="aam-aviso pide" role="status">
          <UiIcon name="bell" />
          <span>{storeName ?? 'El vendedor'} pidió que soporte le cargue repuestos. Al aceptar, el contador parte desde ese momento.</span>
        </div>
      )}

      <dl className="aam-datos">
        <div><dt>Permiso</dt><dd>{TITULO_NIVEL[acceso.nivel ?? acceso.nivelSolicitado]}{!activo && !delVendedor ? <small> pedido</small> : null}</dd></div>
        <div><dt>Duración</dt><dd>{acceso.duracionHoras != null ? `${acceso.duracionHoras} h` : <small>la elige el vendedor</small>}</dd></div>
        <div><dt>{delVendedor ? 'Pedido por' : 'Solicitado por'}</dt><dd>{acceso.solicitadoPorNombre ?? '—'}</dd></div>
        <div><dt>Operador</dt><dd>{acceso.operadorNombre ?? <small>sin asignar</small>}</dd></div>
      </dl>

      {acceso.justificacion && (
        <blockquote className="aam-cita">
          <span>{delVendedor ? 'Justificación del vendedor' : 'Motivo enviado al vendedor'}</span>
          <p>{acceso.justificacion}</p>
        </blockquote>
      )}

      {acceso.adjuntoUrl && (
        <button
          type="button"
          className="aam-adjunto"
          onClick={() => {
            // fetch + blob: /api/v1/uploads/r2/** exige el token (un <a href> no lo lleva). Excel se descarga.
            void previewDocument(acceso.adjuntoUrl ?? undefined).catch((e: unknown) => showToast(mensajeDeError(e)));
          }}
        >
          <span className="aam-adjunto-icono"><UiIcon name="document" /></span>
          <span><strong>Lista de repuestos del vendedor</strong><small>Abrir el adjunto</small></span>
          <UiIcon name="eye" />
        </button>
      )}

      {activo && (
        <section className="aam-seccion">
          <h3>Lo que lleva cargado soporte</h3>
          <CifrasAcceso acceso={acceso} />
          <CambiosAcceso acceso={acceso} />
        </section>
      )}
    </div>
  );
}

function Historial({ accesos, vivo, onVerVivo }: { accesos: AccesoAsistido[]; vivo: AccesoAsistido | null; onVerVivo: () => void }) {
  const [abierto, setAbierto] = useState<number | null>(accesos[0]?.id ?? null);
  return (
    <div className="aam-historial">
      {vivo && (
        <button type="button" className="aam-historial-vivo" onClick={onVerVivo}>
          <Pildora estado={vivo.estado} /> Hay un acceso en curso · ver en la pestaña Acceso <UiIcon name="arrowRight" />
        </button>
      )}
      {accesos.length === 0 ? (
        <div className="aam-vacio-grande">
          <UiIcon name="clock" />
          <strong>Sin accesos anteriores</strong>
          <p>Cuando soporte entre al panel de esta tienda, aquí quedará qué cargó y cuándo.</p>
        </div>
      ) : (
        <ul className="aam-tarjetas">
          {accesos.map((a) => {
            const resumenCambios = cambiosDe(a);
            const creados = resumenCambios.totalCreados;
            const precios = resumenCambios.precios.length;
            const abiertoAhora = abierto === a.id;
            return (
              <li key={a.id} className={abiertoAhora ? 'abierta' : ''}>
                <button type="button" className="aam-tarjeta-cabeza" onClick={() => setAbierto(abiertoAhora ? null : a.id)} aria-expanded={abiertoAhora}>
                  <span className="aam-tarjeta-fecha">
                    <strong>{fechaHora(a.creadoEn)}</strong>
                    <small>
                      {a.origen === 'VENDEDOR' ? 'Pedido por el vendedor' : 'Pedido por soporte'}
                      {a.operadorNombre ? ` · ${a.operadorNombre}` : ''}
                    </small>
                  </span>
                  <Pildora estado={a.estado} />
                  <span className="aam-tarjeta-chips">
                    <em>{TITULO_NIVEL[a.nivel ?? a.nivelSolicitado]}</em>
                    {a.duracionHoras != null && <em>{a.duracionHoras} h</em>}
                    <em className="azul">{creados} {creados === 1 ? 'repuesto' : 'repuestos'}</em>
                    <em className="violeta">{precios} {precios === 1 ? 'precio' : 'precios'}</em>
                  </span>
                  <span className={`aam-flecha ${abiertoAhora ? 'abierta' : ''}`}><UiIcon name="chevronDown" /></span>
                </button>
                {abiertoAhora && (
                  <div className="aam-tarjeta-detalle">
                    {a.comentarioRechazo && (
                      <blockquote className="aam-cita rojo"><span>Comentario del vendedor</span><p>{a.comentarioRechazo}</p></blockquote>
                    )}
                    {a.justificacion && (
                      <blockquote className="aam-cita"><span>{a.origen === 'VENDEDOR' ? 'Justificación del vendedor' : 'Motivo'}</span><p>{a.justificacion}</p></blockquote>
                    )}
                    <CambiosAcceso acceso={a} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
