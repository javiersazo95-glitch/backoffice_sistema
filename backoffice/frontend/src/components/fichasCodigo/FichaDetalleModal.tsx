import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as fichasApi from '@/api/fichasCodigo';
import { mensajeDeError } from '@/api/client';
import Modal from '@/components/shared/Modal';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import type { FichaDetalle, FichaResultado, GrupoCorreccion } from '@/types/fichaCodigo';
import EditorVehiculos, { nuevaClave, type VehiculoEditable } from './EditorVehiculos';
import { estadoPill, fechaCorta } from './utils';

interface Props {
  fichaId: number | null;
  onClose: () => void;
}

const aEditables = (d: FichaDetalle): VehiculoEditable[] => d.compatibilidad.grupos.map((g) => ({
  clave: nuevaClave(),
  marca: g.marca,
  modelo: g.modelo,
  anioDesde: g.anioDesde,
  anioHasta: g.anioHasta,
  motor: g.motor,
  vehiculoCatalogoIds: g.vehiculoCatalogoIds,
  resumenVersiones: `${g.vehiculoCatalogoIds.length} ${g.vehiculoCatalogoIds.length === 1 ? 'versión' : 'versiones'}${g.segura ? '' : ' · sin confirmar'}`,
}));

const aPeticion = (v: VehiculoEditable): GrupoCorreccion => ({
  marca: v.marca, modelo: v.modelo, anioDesde: v.anioDesde, anioHasta: v.anioHasta, motor: v.motor, vehiculoCatalogoIds: v.vehiculoCatalogoIds ?? null,
});

const firma = (nombre: string, sub: number | null, v: VehiculoEditable[]) =>
  JSON.stringify([nombre, sub, v.map((x) => [x.marca, x.modelo, x.anioDesde, x.anioHasta, x.motor, x.vehiculoCatalogoIds ?? null])]);

export default function FichaDetalleModal({ fichaId, onClose }: Props) {
  const queryClient = useQueryClient();
  const detalleQuery = useQuery({ queryKey: ['fichas-codigo', 'detalle', fichaId], queryFn: () => fichasApi.getFicha(fichaId as number), enabled: fichaId != null });
  const subcategorias = useQuery({ queryKey: ['fichas-codigo', 'subcategorias'], queryFn: fichasApi.getSubcategorias, staleTime: 3_600_000, enabled: fichaId != null });
  const detalle = detalleQuery.data;

  const [nombre, setNombre] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState<number | null>(null);
  const [vehiculos, setVehiculos] = useState<VehiculoEditable[]>([]);
  const [motivo, setMotivo] = useState('');
  const [avisar, setAvisar] = useState(true);
  const [rechazando, setRechazando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = (d: FichaDetalle) => {
    setNombre(d.resumen.nombre);
    setSubcategoriaId(d.subcategoriaId);
    setVehiculos(aEditables(d));
    setMotivo('');
    setRechazando(false);
  };

  useEffect(() => {
    if (detalle) cargar(detalle);
    // Solo al cambiar de ficha o cuando el servidor devuelve otra version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle?.resumen.id, detalle?.resumen.actualizadaEn, detalle?.resumen.estado]);

  useEffect(() => { setMensaje(null); }, [fichaId]);

  const original = useMemo(() => (detalle ? firma(detalle.resumen.nombre, detalle.subcategoriaId, aEditables(detalle)) : ''), [detalle]);
  const cambiado = detalle != null && firma(nombre, subcategoriaId, vehiculos) !== original;

  const alTerminar = (r: FichaResultado, texto: string) => {
    queryClient.setQueryData(['fichas-codigo', 'detalle', r.detalle.resumen.id], r.detalle);
    void queryClient.invalidateQueries({ queryKey: ['fichas-codigo', 'cola'] });
    void queryClient.invalidateQueries({ queryKey: ['fichas-codigo', 'uso'] });
    const extra = [r.avisados > 0 ? `${r.avisados} ${r.avisados === 1 ? 'tienda avisada' : 'tiendas avisadas'}` : '', ...r.advertencias].filter(Boolean).join(' · ');
    setMensaje({ tono: 'ok', texto: extra ? `${texto} ${extra}` : texto });
  };
  const alFallar = (e: unknown) => setMensaje({ tono: 'error', texto: mensajeDeError(e, 'No se pudo completar la acción.') });

  const verificar = useMutation({ mutationFn: () => fichasApi.verificarFicha(fichaId as number, avisar), onSuccess: (r) => alTerminar(r, 'Ficha verificada.'), onError: alFallar });
  const rechazar = useMutation({ mutationFn: () => fichasApi.rechazarFicha(fichaId as number, motivo.trim()), onSuccess: (r) => alTerminar(r, 'Ficha rechazada.'), onError: alFallar });
  const restaurar = useMutation({ mutationFn: () => fichasApi.restaurarFicha(fichaId as number), onSuccess: (r) => alTerminar(r, 'Ficha restaurada: vuelve a la cola sin verificar.'), onError: alFallar });
  const avisarTiendas = useMutation({ mutationFn: () => fichasApi.avisarTiendas(fichaId as number), onSuccess: (r) => alTerminar(r, r.avisados === 0 ? 'No hay tiendas con una publicación distinta que avisar.' : 'Aviso enviado.'), onError: alFallar });
  const corregir = useMutation({
    mutationFn: () => fichasApi.corregirFicha(fichaId as number, {
      nombre: nombre.trim(),
      subcategoriaId,
      grupos: vehiculos.map(aPeticion),
      motivo: motivo.trim(),
      avisar,
    }),
    onSuccess: (r) => alTerminar(r, 'Corrección guardada. La ficha quedó verificada.'),
    onError: alFallar,
  });

  const ocupado = verificar.isPending || rechazar.isPending || restaurar.isPending || corregir.isPending || avisarTiendas.isPending;
  const r = detalle?.resumen;
  const tienenDiferencia = (detalle?.publicaciones ?? []).some((p) => p.faltan > 0 || p.sobran > 0);
  const rechazada = r?.estado === 'RECHAZADA';

  return (
    <Modal isOpen={fichaId != null} onClose={onClose} title={r ? `Ficha ${r.codigo} · ${r.marca}` : 'Ficha por código'} wide>
      {detalleQuery.isLoading && <p className="panel-hint">Cargando…</p>}
      {detalleQuery.isError && <QueryErrorNotice error={detalleQuery.error} what="la ficha" onRetry={() => detalleQuery.refetch()} />}
      {detalle && r && (
        <div className="fc-detalle">
          <div className="fc-estado-fila">
            {estadoPill(r.estado)}
            <span className="status-pill">{r.confianza === 'ALTA' ? 'Confianza alta' : r.confianza === 'MEDIA' ? 'Confianza media' : r.confianza}</span>
            {r.corregida && <span className="status-pill tone-blue">Corregida por soporte</span>}
            {r.reportes > 0 && <span className="status-pill tone-red">{r.reportes} {r.reportes === 1 ? 'reporte' : 'reportes'}</span>}
            <span className="panel-hint">Fuente {r.fuente} · vence {fechaCorta(r.venceEn)}</span>
          </div>
          {detalle.verificadaPor && (
            <p className="panel-hint">{rechazada ? 'Rechazada' : 'Revisada'} por {detalle.verificadaPor} el {fechaCorta(detalle.verificadaEn)}.</p>
          )}
          {rechazada && detalle.motivoRechazo && <div className="notice"><p>Motivo del rechazo: {detalle.motivoRechazo}</p></div>}
          {mensaje && <div className={`notice${mensaje.tono === 'error' ? ' error' : ''}`} role="status"><p>{mensaje.texto}</p></div>}

          <section className="fc-seccion">
            <h3>Datos del repuesto</h3>
            <label className="fc-campo">Nombre
              <input className="input" value={nombre} maxLength={200} disabled={ocupado} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="fc-campo">Categoría
              <select className="select" value={subcategoriaId ?? ''} disabled={ocupado}
                onChange={(e) => setSubcategoriaId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{detalle.categoriaExterna ? `Sin asignar (el catálogo dice «${detalle.categoriaExterna}»)` : 'Sin asignar'}</option>
                {(subcategorias.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.categoriaNombre} › {s.nombre}</option>)}
              </select>
            </label>
            {detalle.fotos.length > 0 && (
              <div className="fc-fotos">
                {detalle.fotos.slice(0, 6).map((f) => f.url && (
                  <a key={f.clave ?? f.url} href={f.url} target="_blank" rel="noreferrer" title={f.descripcion ?? f.tipo}>
                    <img src={f.url} alt={f.descripcion ?? f.tipo} loading="lazy" referrerPolicy="no-referrer" />
                  </a>
                ))}
              </div>
            )}
            {detalle.originales.length > 0 && <p className="panel-hint">Códigos originales: {detalle.originales.slice(0, 12).join(' · ')}</p>}
          </section>

          <section className="fc-seccion">
            <h3>Vehículos compatibles <span className="fc-contador">{vehiculos.length}</span></h3>
            <EditorVehiculos vehiculos={vehiculos} onChange={setVehiculos} disabled={ocupado} />
            {detalle.compatibilidad.fueraDeCatalogo.length > 0 && (
              <div className="fc-fuera">
                <strong>Fuera de nuestro catálogo ({detalle.compatibilidad.fueraDeCatalogo.length})</strong>
                <p className="panel-hint">{detalle.compatibilidad.fueraDeCatalogo.slice(0, 20).join(' · ')}</p>
                <p className="panel-hint">Resuélvelos en «Modelos y categorías» y la ficha se rehace sola mientras no esté verificada.</p>
              </div>
            )}
          </section>

          <section className="fc-seccion">
            <h3>Publicaciones que la usan <span className="fc-contador">{detalle.publicacionesTotal}</span></h3>
            {detalle.publicaciones.length === 0 ? <p className="panel-hint">Ninguna tienda la ha publicado todavía.</p> : (
              <div className="table-scroll">
                <table className="wide-table">
                  <thead><tr><th>Tienda</th><th>Publicación</th><th>Vehículos</th><th /></tr></thead>
                  <tbody>
                    {detalle.publicaciones.map((p) => (
                      <tr key={p.productoId}>
                        <td>{p.tienda}</td>
                        <td>{p.nombre}<div className="panel-hint">{p.sku ?? ''} {p.condicion ? `· ${p.condicion}` : ''} {p.activa ? '' : '· inactiva'}</div></td>
                        <td>
                          {p.faltan === 0 && p.sobran === 0
                            ? <span className="status-pill tone-green">Igual a la ficha</span>
                            : <span className="status-pill tone-amber">Distinta</span>}
                          <div className="panel-hint">{p.vehiculosPublicados} publicadas{p.faltan > 0 ? ` · faltan ${p.faltan}` : ''}{p.sobran > 0 ? ` · sobran ${p.sobran}` : ''}</div>
                          {p.faltanEjemplos.length > 0 && <div className="panel-hint">Faltan: {p.faltanEjemplos.join('; ')}</div>}
                          {p.sobranEjemplos.length > 0 && <div className="panel-hint">Sobran: {p.sobranEjemplos.join('; ')}</div>}
                        </td>
                        <td>{p.origen === 'CODIGO_EDITADO' ? <span className="status-pill tone-amber">Editada por la tienda</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {detalle.publicacionesTotal > detalle.publicaciones.length && <p className="panel-hint">Se muestran las {detalle.publicaciones.length} más recientes.</p>}
          </section>

          {detalle.reportes.length > 0 && (
            <section className="fc-seccion">
              <h3>Errores reportados por compradores <span className="fc-contador">{detalle.reportes.length}</span></h3>
              <ul className="fc-reportes">
                {detalle.reportes.map((x) => (
                  <li key={x.id}><span className="panel-hint">{fechaCorta(x.fecha)} · producto #{x.productoId}</span><div>{x.descripcion ?? 'Sin detalle'}</div></li>
                ))}
              </ul>
            </section>
          )}

          <section className="fc-seccion fc-acciones">
            <h3>Decisión de soporte</h3>
            {!rechazada && (
              <label className="fc-campo">Qué corregiste y por qué {cambiado ? '(obligatorio)' : '(solo si cambias algo)'}
                <input className="input" value={motivo} maxLength={300} disabled={ocupado} placeholder="Ej.: faltaba el Corolla 2014 según el manual del fabricante"
                  onChange={(e) => setMotivo(e.target.value)} />
              </label>
            )}
            {(tienenDiferencia || detalle.publicacionesTotal > 0) && !rechazada && (
              <label className="fc-check">
                <input type="checkbox" checked={avisar} disabled={ocupado} onChange={(e) => setAvisar(e.target.checked)} />
                Avisar a las tiendas cuya publicación quede distinta (solo avisa, no les cambia nada)
              </label>
            )}
            {rechazando && (
              <label className="fc-campo">Motivo del rechazo (queda en la bitácora)
                <input className="input" value={motivo} maxLength={300} disabled={ocupado} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: la ficha corresponde a otro repuesto" />
              </label>
            )}
            <div className="fc-botones">
              {rechazada ? (
                <button type="button" className="primary-button" disabled={ocupado} onClick={() => restaurar.mutate()}>Restaurar ficha</button>
              ) : rechazando ? (
                <>
                  <button type="button" className="danger-button" disabled={ocupado || motivo.trim().length < 5} onClick={() => rechazar.mutate()}>Confirmar rechazo</button>
                  <button type="button" className="ghost-button" disabled={ocupado} onClick={() => { setRechazando(false); setMotivo(''); }}>Cancelar</button>
                </>
              ) : (
                <>
                  {cambiado ? (
                    <button type="button" className="primary-button" disabled={ocupado || motivo.trim().length < 5 || vehiculos.length === 0} onClick={() => corregir.mutate()}>
                      Guardar corrección y verificar
                    </button>
                  ) : (
                    <button type="button" className="primary-button" disabled={ocupado || r.estado === 'VERIFICADA'} onClick={() => verificar.mutate()}>
                      {r.estado === 'VERIFICADA' ? 'Ya está verificada' : 'Verificar ficha'}
                    </button>
                  )}
                  {cambiado && <button type="button" className="ghost-button" disabled={ocupado} onClick={() => cargar(detalle)}>Deshacer cambios</button>}
                  <button type="button" className="secondary-button" disabled={ocupado || !tienenDiferencia} onClick={() => avisarTiendas.mutate()}
                    title={tienenDiferencia ? 'Avisa a las tiendas con una publicación distinta' : 'Ninguna publicación difiere de la ficha'}>
                    Avisar a las tiendas
                  </button>
                  <button type="button" className="danger-button" disabled={ocupado} onClick={() => { setRechazando(true); setMotivo(''); }}>Rechazar ficha</button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
