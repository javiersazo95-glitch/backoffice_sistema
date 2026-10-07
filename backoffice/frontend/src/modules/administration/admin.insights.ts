import type { Insight } from '@/components/dashboard/kit';
import { formatMoney } from './utils';

export interface AdminInsightInput {
  criticalOrders: number;
  warningOrders: number;
  withdrawalsToPay: number;
  withdrawalsToPayAmount: number;
  withdrawalsWithoutDocument: number;
  withdrawalsRetained: number;
  /** 0 = domingo … 6 = sabado, en hora de Chile. El ciclo de pago cierra el miercoles. */
  weekday: number;
  pendingSettlements: number;
  pendingSettlementsAmount: number;
  rechargesWithoutDocument: number;
  expensesWithoutReceipt: number;
  cashAvailable: number;
  partnerWithdrawalsPending: number;
  isSuperAdmin: boolean;
}

const plural = (n: number, singular: string, pluralForm: string) => (n === 1 ? singular : pluralForm);

/** Sugerencias del dia para Administracion Contable, de lo que mueve plata a lo informativo. */
export function buildAdminInsights(input: AdminInsightInput): Insight[] {
  const items: Insight[] = [];

  if (input.withdrawalsRetained > 0) {
    items.push({
      id: 'retenidos',
      tone: 'warn',
      text: `${input.withdrawalsRetained} ${plural(input.withdrawalsRetained, 'retiro tiene', 'retiros tienen')} los fondos retenidos porque la tienda está suspendida. No entran a la nómina hasta que Mediación y Confianza la reactive.`,
      actionLabel: 'Ver retiros',
      to: '/administracion/pago-proveedores',
    });
  }

  if (input.withdrawalsWithoutDocument > 0) {
    const closingSoon = input.weekday === 2 || input.weekday === 3;
    items.push({
      id: 'sin-documento',
      tone: closingSoon ? 'alert' : 'warn',
      text: `${input.withdrawalsWithoutDocument} ${plural(input.withdrawalsWithoutDocument, 'retiro no tiene', 'retiros no tienen')} su boleta o factura de liquidación registrada y sin ella no se puede pagar.${closingSoon ? ' El ciclo de pago cierra este miércoles: regularízalo hoy.' : ''}`,
      actionLabel: 'Registrar documentos',
      to: '/administracion/pago-proveedores',
    });
  } else if (input.withdrawalsToPay > 0) {
    items.push({
      id: 'por-pagar',
      tone: 'ok',
      text: `${input.withdrawalsToPay} ${plural(input.withdrawalsToPay, 'retiro listo', 'retiros listos')} para pagar por ${formatMoney(input.withdrawalsToPayAmount)}. Genera la nómina BCI el jueves y marca el pago cuando el banco confirme.`,
      actionLabel: 'Ir a Pago a proveedores',
      to: '/administracion/pago-proveedores',
    });
  }

  if (input.criticalOrders > 0) {
    items.push({
      id: 'pedidos-criticos',
      tone: 'alert',
      text: `${input.criticalOrders} ${plural(input.criticalOrders, 'pedido lleva', 'pedidos llevan')} demasiado tiempo sin avanzar de estado. Contacta al vendedor o registra la incidencia para que el comprador no quede sin respuesta.`,
      actionLabel: 'Ver pedidos atrasados',
      to: '/administracion/pedidos?criticidad=critical',
    });
  } else if (input.warningOrders > 0) {
    items.push({
      id: 'pedidos-atencion',
      tone: 'warn',
      text: `${input.warningOrders} ${plural(input.warningOrders, 'pedido se acerca', 'pedidos se acercan')} al límite de tiempo de su etapa. Un recordatorio al vendedor hoy evita que pasen a críticos.`,
      actionLabel: 'Ver pedidos',
      to: '/administracion/pedidos?criticidad=warning',
    });
  }

  if (input.rechargesWithoutDocument > 0) {
    items.push({
      id: 'recargas',
      tone: 'warn',
      text: `${input.rechargesWithoutDocument} ${plural(input.rechargesWithoutDocument, 'compra de Monedas no tiene', 'compras de Monedas no tienen')} boleta o factura emitida. Emítela en el Portal MIPYME y súbela a la recarga.`,
      actionLabel: 'Ver recargas',
      to: '/administracion/pedidos?tab=publicidad',
    });
  }

  if (input.cashAvailable < 0) {
    items.push({
      id: 'caja-negativa',
      tone: 'alert',
      text: `Los gastos del periodo superan la caja operativa en ${formatMoney(Math.abs(input.cashAvailable))}. Frena los gastos no esenciales hasta que entren nuevas liquidaciones.`,
      actionLabel: 'Revisar gastos',
      to: '/administracion/gastos?tab=gastos',
    });
  }

  if (input.expensesWithoutReceipt > 0) {
    items.push({
      id: 'gastos-sin-comprobante',
      tone: 'warn',
      text: `${input.expensesWithoutReceipt} ${plural(input.expensesWithoutReceipt, 'gasto no tiene', 'gastos no tienen')} comprobante adjunto. Súbelo para que la caja cuadre con la contabilidad.`,
      actionLabel: 'Ver gastos',
      to: '/administracion/gastos?tab=gastos',
    });
  }

  if (input.pendingSettlements > 0) {
    items.push({
      id: 'liquidaciones',
      tone: 'ok',
      text: `${input.pendingSettlements} ${plural(input.pendingSettlements, 'venta finalizada acumula', 'ventas finalizadas acumulan')} ${formatMoney(input.pendingSettlementsAmount)} por liquidar a vendedores. Se pagan cuando cada tienda solicite su retiro.`,
      actionLabel: 'Ver liquidaciones',
      to: '/administracion/liquidaciones',
    });
  }

  if (input.partnerWithdrawalsPending > 0 && input.isSuperAdmin) {
    items.push({
      id: 'socios',
      tone: 'ok',
      text: `${input.partnerWithdrawalsPending} ${plural(input.partnerWithdrawalsPending, 'retiro de socio espera', 'retiros de socios esperan')} pago en la nómina de socios.`,
      actionLabel: 'Ver retiros de socios',
      to: '/retiros',
    });
  }

  if (items.length === 0) {
    items.push({ id: 'ok', tone: 'ok', text: 'Todo al día: no hay retiros bloqueados, pedidos atrasados ni documentos pendientes. Revisa el resultado del mes más abajo.' });
  }

  return items.slice(0, 4);
}
