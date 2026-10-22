import type { SellerCancellationRate, SellerSaleResponse } from '@/types/seller';
import { LISTA_MOTIVO_CANCELACION_PEDIDO } from '@/types/remoteConfig';
import { remoteConfig } from '@/utils/remoteConfigStore';

export type CancellationLevel = 'none' | 'warn' | 'high';

/** Rojo: pasa el umbral. Ámbar: canceló algo sin pasarlo. Gris: no canceló. */
export function cancellationLevel(rate: SellerCancellationRate): CancellationLevel {
  if (rate.superaUmbral) return 'high';
  return rate.canceladas > 0 ? 'warn' : 'none';
}

/**
 * Etiquetas de MotivoCancelacionPedido. El backend guarda el código y cada cliente arma el texto,
 * igual que con los estados de mediación.
 *
 * 20-oct (Mantenedor común): la etiqueta se toma primero de la lista `MOTIVO_CANCELACION_PEDIDO`
 * (lista `sistema`: el mantenedor solo edita texto/orden/visibilidad, los valores siguen siendo
 * los del enum del backend). Este mapa queda como fallback para cuando no hay bootstrap, y para
 * motivos que el mantenedor haya ocultado pero que una venta antigua todavía tenga guardados.
 */
const MOTIVO_LABEL_FALLBACK: Record<string, string> = {
  SIN_STOCK: 'Sin stock',
  ERROR_PRECIO: 'Error de precio',
  PRODUCTO_NO_DISPONIBLE: 'Producto no disponible',
  IMPOSIBILIDAD_DESPACHO: 'Imposibilidad de despacho',
  // 8-oct: el vendedor comprobó en el paso de compatibilidad que el repuesto no sirve al vehículo.
  INCOMPATIBLE_VEHICULO: 'Incompatible con el vehículo del comprador',
  EXPIRACION_PAGO: 'No se completó el pago a tiempo',
  BLOQUEO_VENDEDOR: 'Tienda suspendida o bloqueada',
  SOLICITUD_DEL_COMPRADOR: 'Lo pidió el comprador',
  PAGO_TARDIO_SIN_STOCK: 'Pago tardío sin stock',
  OTRO: 'Otro motivo',
};

const ORIGEN_LABEL: Record<string, string> = {
  VENDEDOR: 'la tienda',
  COMPRADOR: 'el comprador',
  SISTEMA: 'el sistema',
};

const ORIGEN_POR_ESTADO_ITEM: Record<string, string> = {
  CANCELADO_VENDEDOR: 'VENDEDOR',
  CANCELADO_COMPRADOR: 'COMPRADOR',
  CANCELADO_EXPIRACION_PAGO: 'SISTEMA',
  CANCELADO_BLOQUEO_VENDEDOR: 'SISTEMA',
};

export function motivoCancelacionLabel(codigo?: string | null): string {
  if (!codigo) return 'Sin motivo registrado';
  const clave = codigo.toUpperCase();
  return remoteConfig.etiquetaDeLista(LISTA_MOTIVO_CANCELACION_PEDIDO, clave) ?? MOTIVO_LABEL_FALLBACK[clave] ?? codigo;
}

export function origenCancelacionLabel(origen?: string | null): string | null {
  return origen ? ORIGEN_LABEL[origen.toUpperCase()] ?? null : null;
}

export interface SaleCancellation {
  motivo: string;
  detalle: string | null;
  origen: string | null;
  fecha: string | null;
}

/**
 * Motivo de una venta cancelada. En un carrito de varias tiendas el pedido sigue vivo y el motivo
 * queda solo en los ítems de la tienda que canceló, así que se busca primero ahí.
 */
export function cancelacionDeVenta(sale: SellerSaleResponse): SaleCancellation | null {
  if (String(sale.status).toUpperCase() !== 'CANCELADO') return null;
  const item = sale.items.find((candidate) => candidate.estado?.toUpperCase().startsWith('CANCELADO'));
  const codigo = item?.motivoCancelacionCodigo ?? sale.motivoCancelacion ?? null;
  const origen = (item?.estado ? ORIGEN_POR_ESTADO_ITEM[item.estado.toUpperCase()] : null) ?? sale.canceladoPor ?? null;
  return {
    motivo: motivoCancelacionLabel(codigo),
    detalle: (codigo?.toUpperCase() === 'OTRO' ? item?.detalleCancelacion ?? sale.detalleCancelacion : null) ?? null,
    origen: origenCancelacionLabel(origen),
    fecha: item?.cancelledAt ?? sale.canceladoEn ?? null,
  };
}
