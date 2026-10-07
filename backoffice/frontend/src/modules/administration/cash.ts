import { formatOrderNumber } from '@/utils/orderNumber';
import type { AdvertisingOrder, CashIncomeEntry, Order, Settlement } from './types';
import { chileDay, formatMoney, isWithinRange } from './utils';

/**
 * Ingresos reales de RepuesTop en un rango de fechas: la ganancia neta de cada pedido
 * finalizado (`netSettlement`, ya sin IVA ni pasarela) mas la de cada compra de Monedas
 * (`montoNeto`). De cada entrada el 70% va a caja operativa y el 30% a socios.
 *
 * Es una funcion pura para que la vista Caja y el Resumen usen exactamente la misma cuenta:
 * antes el Resumen sumaba `commission` (comision + IVA + pasarela del vendedor) y daba otra
 * "ganancia" que la de Caja.
 */
export function buildCashEntries(
  settlements: Settlement[],
  ads: AdvertisingOrder[],
  orders: Order[],
  start: string,
  end: string,
): CashIncomeEntry[] {
  const ordersMap = new Map<string, Order>(orders.map((order) => [order.id, order]));

  const pedidosEntries: CashIncomeEntry[] = settlements
    .filter((settlement) => isWithinRange(settlement.date, start, end))
    .map((settlement) => {
      const order = ordersMap.get(settlement.orderId) || ordersMap.get(settlement.id);
      const commissionLabel = settlement.sellerFounder && Math.round(settlement.serviceCommissionRate * 100) === 5
        ? 'Tarifa Fundador (5%)'
        : `Comisión RepuesTop (${Math.round(settlement.serviceCommissionRate * 100)}%)`;
      const netProfit = settlement.netSettlement;
      return {
        id: settlement.orderId,
        type: 'pedido',
        date: settlement.date,
        concept: order?.product ? `Repuesto: ${order.product}` : `Pedido ${formatOrderNumber(settlement.orderId)}`,
        buyer: order?.buyer || 'Cliente',
        sellerOrPack: settlement.seller,
        sellerFounder: settlement.sellerFounder,
        totalSale: settlement.saleTotal,
        commissionOrDeduction: commissionLabel,
        commissionAmount: settlement.commission,
        netProfit,
        cashAmount: Math.round(netProfit * 0.7),
        orderId: settlement.orderId,
        originalOrder: order,
        originalSettlement: settlement,
      };
    });

  const publicidadEntries: CashIncomeEntry[] = ads
    // O77 (27-sep): el dia de la compra en hora de Chile, no el de la marca UTC.
    .filter((ad) => isWithinRange(chileDay(ad.fecha), start, end))
    .map((ad) => {
      const netProfit = ad.montoNeto;
      return {
        id: ad.codigo,
        type: 'publicidad',
        date: ad.fecha,
        concept: ad.pack ? `Fichas Mural: ${ad.pack} (${ad.cantidadFichas.toLocaleString('es-CL')} fichas)` : `Compra Fichas (${ad.cantidadFichas.toLocaleString('es-CL')})`,
        buyer: ad.comprador ? `${ad.comprador}${ad.correo ? ` (${ad.correo})` : ''}` : (ad.correo || 'Avisador'),
        sellerOrPack: ad.pack || 'Fichas Mural',
        sellerFounder: false,
        totalSale: ad.montoPagado,
        commissionOrDeduction: `Comisión Flow (-${formatMoney(ad.comisionPasarela)})`,
        commissionAmount: ad.comisionPasarela,
        netProfit,
        cashAmount: Math.round(netProfit * 0.7),
        originalAdvertising: ad,
      };
    });

  return [...pedidosEntries, ...publicidadEntries].sort((a, b) => b.date.localeCompare(a.date));
}

export interface CashSummary {
  totalProfit: number;
  totalCaja: number;
  totalCount: number;
  pedidosProfit: number;
  pedidosCaja: number;
  pedidosCount: number;
  publicidadProfit: number;
  publicidadCaja: number;
  publicidadCount: number;
}

/** Totales de las tarjetas de Caja y del Resumen a partir de las entradas de ingreso. */
export function summarizeCash(entries: CashIncomeEntry[]): CashSummary {
  const pedidosEntries = entries.filter((entry) => entry.type === 'pedido');
  const publicidadEntries = entries.filter((entry) => entry.type === 'publicidad');
  const sum = (items: CashIncomeEntry[], pick: (item: CashIncomeEntry) => number) =>
    items.reduce((total, item) => total + (pick(item) || 0), 0);

  const pedidosProfit = sum(pedidosEntries, (entry) => entry.netProfit);
  const pedidosCaja = sum(pedidosEntries, (entry) => entry.cashAmount);
  const publicidadProfit = sum(publicidadEntries, (entry) => entry.netProfit);
  const publicidadCaja = sum(publicidadEntries, (entry) => entry.cashAmount);

  return {
    totalProfit: pedidosProfit + publicidadProfit,
    totalCaja: pedidosCaja + publicidadCaja,
    totalCount: entries.length,
    pedidosProfit,
    pedidosCaja,
    pedidosCount: pedidosEntries.length,
    publicidadProfit,
    publicidadCaja,
    publicidadCount: publicidadEntries.length,
  };
}
