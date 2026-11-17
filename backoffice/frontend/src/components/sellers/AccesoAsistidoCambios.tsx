import { useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import type { AccesoAsistido } from '@/api/accesoAsistido';

/** Fecha y hora cortas en formato chileno; raya si no hay. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

/** Precio en pesos chilenos ("$12.990"), o una raya si no hay. */
export function pesos(valor: number | null | undefined): string {
  return valor == null || Number.isNaN(Number(valor)) ? '—' : `$${Number(valor).toLocaleString('es-CL')}`;
}

export const TEXTO_EVENTO: Record<string, string> = {
  SOLICITADO: 'Solicitó el acceso',
  REENVIADO: 'Reenvió el correo',
  AUTORIZADO: 'El vendedor autorizó',
  ACEPTADO: 'Soporte aceptó la solicitud',
  RECHAZADO: 'El vendedor rechazó',
  CANCELADO: 'Cancelado',
  INGRESO: 'Ingresó al panel',
  PRODUCTO_CREADO: 'Creó un repuesto',
  PRECIO_ACTUALIZADO: 'Cambió un precio',
  EXCEL_CARGADO: 'Cargó un Excel',
  FOTOS_AGREGADAS: 'Agregó fotos',
  REVOCADO: 'El vendedor cortó el acceso',
  FINALIZADO: 'Salió del panel',
  EXPIRADO: 'Venció',
};

const ICONO_EVENTO: Record<string, string> = {
  SOLICITADO: 'mail', REENVIADO: 'mail', AUTORIZADO: 'shieldCheck', ACEPTADO: 'shieldCheck', RECHAZADO: 'shieldX',
  CANCELADO: 'close', INGRESO: 'monitor', PRODUCTO_CREADO: 'plus', PRECIO_ACTUALIZADO: 'percent',
  EXCEL_CARGADO: 'upload', FOTOS_AGREGADAS: 'upload', REVOCADO: 'lock', FINALIZADO: 'logout', EXPIRADO: 'clock',
};

function detalleEvento(detalle: string | null): string {
  if (!detalle) return '';
  try {
    const d = JSON.parse(detalle) as Record<string, unknown>;
    if (d.nombre) return `${String(d.nombre)}${d.sku ? ` (${String(d.sku)})` : ''}`;
    if (d.sku) return `SKU ${String(d.sku)}${d.precioAntes != null ? ` · ${pesos(Number(d.precioAntes))} → ${pesos(Number(d.precioDespues))}` : ''}${d.fotos != null ? ` · ${String(d.fotos)} ${Number(d.fotos) === 1 ? 'foto' : 'fotos'}` : ''}`;
    if (d.cargados != null) return `${d.archivo ? `${String(d.archivo)}: ` : ''}${String(d.cargados)} de ${String(d.filas)} filas`;
  } catch {
    // Detalle ilegible: se omite.
  }
  return '';
}

function leerDetalle(detalle: string | null): Record<string, unknown> {
  try {
    return detalle ? (JSON.parse(detalle) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const numero = (v: unknown): number | null => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const textoDe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

/**
 * Lo que cambió soporte en un acceso. Si el backend no manda `cambios` (uno compilado antes de que existiera), se
 * arma con la actividad registrada, para que el contador y la lista digan siempre lo mismo. Lo creado por Excel no
 * deja un evento por repuesto: queda contado en `totalCreados` y detallado en la pestaña Excel.
 */
export function cambiosDe(acceso: AccesoAsistido): CambiosAccesoDatos {
  if (acceso.cambios) return { ...acceso.cambios, sinDetalle: 0 };
  const eventos = acceso.eventos ?? [];
  const creados: CambiosAccesoDatos['creados'] = [];
  const precios: CambiosAccesoDatos['precios'] = [];
  const cargas: CambiosAccesoDatos['cargas'] = [];
  for (const e of eventos) {
    const d = leerDetalle(e.detalle);
    if (e.tipo === 'PRODUCTO_CREADO') {
      creados.push({ productoId: numero(d.productoId), sku: textoDe(d.sku), nombre: textoDe(d.nombre), precio: numero(d.precio), desdeExcel: false, eliminado: false, creadoEn: e.creadoEn });
    } else if (e.tipo === 'PRECIO_ACTUALIZADO') {
      precios.push({ productoId: numero(d.productoId), sku: textoDe(d.sku), nombre: textoDe(d.nombre), precioAntes: numero(d.precioAntes), precioDespues: numero(d.precioDespues), cambiadoEn: e.creadoEn });
    } else if (e.tipo === 'EXCEL_CARGADO') {
      cargas.push({ cargaId: numero(d.cargaId), archivo: textoDe(d.archivo), filas: numero(d.filas) ?? 0, cargados: numero(d.cargados) ?? 0, conError: numero(d.conError) ?? 0, cargadoEn: e.creadoEn });
    }
  }
  creados.reverse();
  precios.reverse();
  cargas.reverse();
  const totalCreados = Math.max(creados.length, acceso.resumen.productosCreados);
  return { creados, totalCreados, precios, cargas, sinDetalle: totalCreados - creados.length };
}

type CambiosAccesoDatos = NonNullable<AccesoAsistido['cambios']> & {
  /** Repuestos contados que no traen detalle uno a uno (los de un Excel cuando el backend no manda `cambios`). */
  sinDetalle: number;
};

/** Las tres cifras de lo que hizo soporte en un acceso. */
export function CifrasAcceso({ acceso }: { acceso: AccesoAsistido }) {
  const c = cambiosDe(acceso);
  const creados = c.totalCreados;
  const precios = c.precios.length;
  const cargas = c.cargas.length;
  const cifras = [
    { tono: 'azul', icono: 'cube', valor: creados, texto: creados === 1 ? 'repuesto creado' : 'repuestos creados' },
    { tono: 'violeta', icono: 'percent', valor: precios, texto: precios === 1 ? 'precio cambiado' : 'precios cambiados' },
    { tono: 'verde', icono: 'upload', valor: cargas, texto: cargas === 1 ? 'Excel cargado' : 'Excel cargados' },
  ];
  return (
    <div className="aam-cifras">
      {cifras.map((cifra) => (
        <div key={cifra.texto} className={`aam-cifra ${cifra.tono}`}>
          <span className="aam-cifra-icono"><UiIcon name={cifra.icono as never} /></span>
          <strong>{cifra.valor}</strong>
          <small>{cifra.texto}</small>
        </div>
      ))}
    </div>
  );
}

type Pestana = 'creados' | 'precios' | 'cargas' | 'actividad';

/**
 * Todo lo que cambió soporte en un acceso, por pestañas: repuestos creados (formulario o Excel), precios con el
 * valor anterior y el nuevo, cargas de Excel y la actividad completa con quién hizo qué.
 */
export function CambiosAcceso({ acceso }: { acceso: AccesoAsistido }) {
  const cambios = cambiosDe(acceso);
  const eventos = acceso.eventos ?? [];
  const pestanas: { id: Pestana; titulo: string; cantidad: number }[] = [
    { id: 'creados', titulo: 'Repuestos', cantidad: cambios.totalCreados },
    { id: 'precios', titulo: 'Precios', cantidad: cambios.precios.length },
    { id: 'cargas', titulo: 'Excel', cantidad: cambios.cargas.length },
    { id: 'actividad', titulo: 'Actividad', cantidad: eventos.length },
  ];
  const [pestana, setPestana] = useState<Pestana>(
    pestanas.find((p) => p.cantidad > 0 && p.id !== 'actividad')?.id ?? 'actividad',
  );

  return (
    <div className="aam-cambios">
      <div className="aam-segmento" role="tablist" aria-label="Cambios de soporte">
        {pestanas.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} className={pestana === p.id ? 'activa' : ''} onClick={() => setPestana(p.id)}>
            {p.titulo} <span className="aam-cuenta">{p.cantidad}</span>
          </button>
        ))}
      </div>

      {pestana === 'creados' && (cambios.creados.length === 0 ? (
        <p className="aam-vacio">
          {cambios.totalCreados > 0
            ? `Soporte creó ${cambios.totalCreados} ${cambios.totalCreados === 1 ? 'repuesto' : 'repuestos'} con Excel: el detalle está en la pestaña Excel.`
            : 'Soporte no creó repuestos en este acceso.'}
        </p>
      ) : (
        <>
          <ul className="aam-lista">
            {cambios.creados.map((c, i) => (
              <li key={`${c.productoId ?? 'x'}-${i}`} className={c.eliminado ? 'eliminado' : ''}>
                <div className="aam-lista-texto">
                  <strong>{c.nombre || 'Repuesto sin nombre'}</strong>
                  <small>{c.sku ? `SKU ${c.sku}` : 'Sin SKU'} · {fechaHora(c.creadoEn)}</small>
                </div>
                <div className="aam-lista-lado">
                  <span className="aam-precio">{pesos(c.precio)}</span>
                  <span className={`aam-etiqueta ${c.desdeExcel ? 'verde' : 'azul'}`}>{c.desdeExcel ? 'Excel' : 'Formulario'}</span>
                  {c.eliminado && <span className="aam-etiqueta gris">Eliminado por el vendedor</span>}
                </div>
              </li>
            ))}
          </ul>
          {cambios.sinDetalle > 0 ? (
            <p className="aam-vacio">Los otros {cambios.sinDetalle} se crearon con Excel: el detalle está en la pestaña Excel.</p>
          ) : cambios.totalCreados > cambios.creados.length && (
            <p className="aam-vacio">Se muestran los {cambios.creados.length} más recientes de {cambios.totalCreados}.</p>
          )}
        </>
      ))}

      {pestana === 'precios' && (cambios.precios.length === 0 ? (
        <p className="aam-vacio">Soporte no cambió precios en este acceso.</p>
      ) : (
        <ul className="aam-lista">
          {cambios.precios.map((p, i) => (
            <li key={`${p.productoId ?? 'x'}-${i}`}>
              <div className="aam-lista-texto">
                <strong>{p.nombre || (p.sku ? `SKU ${p.sku}` : 'Repuesto')}</strong>
                <small>{p.sku ? `SKU ${p.sku} · ` : ''}{fechaHora(p.cambiadoEn)}</small>
              </div>
              <div className="aam-lista-lado">
                <span className="aam-precio-antes">{pesos(p.precioAntes)}</span>
                <UiIcon name="arrowRight" />
                <span className="aam-precio">{pesos(p.precioDespues)}</span>
              </div>
            </li>
          ))}
        </ul>
      ))}

      {pestana === 'cargas' && (cambios.cargas.length === 0 ? (
        <p className="aam-vacio">Soporte no cargó archivos Excel en este acceso.</p>
      ) : (
        <ul className="aam-lista">
          {cambios.cargas.map((c, i) => (
            <li key={`${c.cargaId ?? 'x'}-${i}`}>
              <div className="aam-lista-texto">
                <strong>{c.archivo || 'Archivo Excel'}</strong>
                <small>{fechaHora(c.cargadoEn)} · {c.filas} {c.filas === 1 ? 'fila' : 'filas'}</small>
              </div>
              <div className="aam-lista-lado">
                <span className="aam-etiqueta verde">{c.cargados} cargados</span>
                {c.conError > 0 && <span className="aam-etiqueta rojo">{c.conError} con error</span>}
              </div>
            </li>
          ))}
        </ul>
      ))}

      {pestana === 'actividad' && (eventos.length === 0 ? (
        <p className="aam-vacio">Sin actividad registrada.</p>
      ) : (
        <ol className="aam-linea">
          {eventos.map((e) => (
            <li key={e.id}>
              <span className="aam-linea-icono"><UiIcon name={(ICONO_EVENTO[e.tipo] ?? 'dots') as never} /></span>
              <div>
                <strong>{TEXTO_EVENTO[e.tipo] ?? e.tipo}</strong>
                <small>{fechaHora(e.creadoEn)} · {e.actorNombre}{detalleEvento(e.detalle) ? ` · ${detalleEvento(e.detalle)}` : ''}</small>
              </div>
            </li>
          ))}
        </ol>
      ))}
    </div>
  );
}
