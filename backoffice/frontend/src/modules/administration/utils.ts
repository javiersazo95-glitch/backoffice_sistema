import {
  RECEIPT_TYPES,
  MAX_RECEIPT_SIZE,
} from './constants';
import { PARTNERS } from './constants';
import { toChileIso } from '@/utils/formatters';
import type { Expense, Order, Settlement, SettlementStatus, Withdrawal } from './types';

const moneyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatMoney(value: number): string {
  return moneyFormatter.format(Number(value) || 0);
}

/**
 * O77 (pruebas de lanzamiento, 27-sep): formatDate y formatDateTime cortan el texto ISO; un valor con
 * zona (la fecha de pago de un retiro, una compra de publicidad) se pasa antes a hora de Chile, o se
 * veia la hora UTC y, de noche, el dia siguiente. Las fechas de los pedidos ya llegan en hora de Chile.
 */
export function formatDate(dateValue: string): string {
  const [year = '', month = '', day = ''] = toChileIso(dateValue ?? '').slice(0, 10).split('-');
  if (!year || !month || !day) return dateValue;
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateValue: string): string {
  const [date = '', time = '00:00'] = toChileIso(dateValue ?? '').split('T');
  return `${formatDate(date)} ${time.slice(0, 5)}`;
}

/** Dia "YYYY-MM-DD" en hora de Chile, para filtrar por rango un valor que puede traer zona. */
export function chileDay(dateValue: string | null | undefined): string {
  return toChileIso(dateValue ?? '').slice(0, 10);
}

/**
 * Fecha y hora en hora de Chile, sea cual sea el huso del navegador (O77, 27-sep). Una fecha sin
 * hora se muestra sin hora: antes `new Date("2026-09-27")` salia "26-09-2026, 21:00" en Chile.
 */
export function formatDateTimeLocal(dateValue: string): string {
  if (!dateValue) return dateValue;
  const iso = toChileIso(dateValue);
  return iso.includes('T') ? formatDateTime(iso) : formatDate(iso);
}

const monthFormatter = new Intl.DateTimeFormat('es-CL', { month: 'long' });

/** Nombre del mes de un "YYYY-MM", por ejemplo "Julio". El año va en su propio filtro. */
export function formatMonthName(month: string): string {
  const [year = '', monthPart = ''] = month.split('-');
  const yearNumber = Number(year);
  const monthNumber = Number(monthPart);
  if (!yearNumber || !monthNumber) return month;
  const label = monthFormatter.format(new Date(yearNumber, monthNumber - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Primer y ultimo dia de un mes "YYYY-MM". Se calcula sobre fechas locales y se
 * arma el string a mano (no toISOString) para no correr un dia por zona horaria.
 */
export function getMonthRange(month: string): { start: string; end: string } {
  const [year = '', monthPart = ''] = month.split('-');
  const yearNumber = Number(year);
  const monthNumber = Number(monthPart);
  if (!yearNumber || !monthNumber) return { start: month, end: month };
  const lastDay = new Date(yearNumber, monthNumber, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function slug(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function orderDate(order: Order): string {
  return chileDay(order.date);
}

export function isWithinRange(dateValue: string, start: string, end: string): boolean {
  if (!dateValue) return false;
  if (start && dateValue < start) return false;
  if (end && dateValue > end) return false;
  return true;
}

/**
 * O72 (pruebas de lanzamiento, 25-sep): el id del pedido ya es su numero publico ("4827193600",
 * o "4827193600-2" para la fila de la segunda tienda), asi que la liquidacion queda "LQ-4827193600-2".
 * El `replace` conserva la forma de los ids antiguos ("PED-0000025" -> "LQ-0000025").
 */
export function getSettlementId(orderId: string): string {
  return `LQ-${orderId.replace(/^PED-/, '').replace(/\s/g, '')}`;
}

export function getSettlements(orders: Order[], statuses: Record<string, SettlementStatus>): Settlement[] {
  return orders
    .filter((order) => order.status === 'Finalizado')
    .map((order) => {
      const subtotal = Number(order.subtotalPublicado ?? order.total);
      const descuento = Number(order.descuento ?? 0);
      const saleTotal = Number(order.total ?? (Math.max(0, subtotal - descuento) + Number(order.costoEnvio ?? 0)));
      const serviceCommission = Number(order.comisionServicio ?? 0);
      const serviceCommissionRate = Number(order.comisionServicioPorcentaje ?? (order.sellerFounder ? 0.05 : subtotal > 250000 ? 0.05 : subtotal > 100000 ? 0.07 : 0.10));
      const serviceCommissionIva = Number(order.ivaComisionServicio ?? 0);
      const gatewayFeeSeller = Number(order.comisionPagoFlowVendedor ?? 0);
      const gatewayFeeRepuestop = Number(order.comisionPagoFlowRepuestop ?? 0);
      const grossEarnings = Number(order.descuentosVendedor ?? serviceCommission + serviceCommissionIva + gatewayFeeSeller);
      const netSettlement = Number(order.liquidacionServicio ?? serviceCommission + serviceCommissionIva);
      const baseComisiones = Math.max(0, subtotal - descuento) + Number(order.costoEnvio ?? 0);
      const paidAmount = baseComisiones - grossEarnings;
      const sellerPayout = Number(order.montoPagarVendedor ?? paidAmount);
      const settlementId = getSettlementId(order.id);
      return {
        id: settlementId,
        date: orderDate(order),
        seller: order.seller,
        sellerFounder: order.sellerFounder,
        sellerTaxId: order.sellerTaxId,
        sellerLegalName: order.sellerLegalName,
        sellerEmail: order.sellerEmail,
        orderId: order.id,
        saleTotal,
        descuento,
        saleDetail: order.totalVentaDetalle ?? {
          'Valor publicado por el vendedor': subtotal,
          ...(descuento > 0 ? { 'Descuento en cotización': -descuento } : {}),
          'Costo de despacho': Number(order.costoEnvio ?? 0),
        },
        saleTooltip: order.totalVentaTooltip,
        commission: grossEarnings,
        serviceCommission,
        serviceCommissionRate,
        serviceCommissionIva,
        gatewayFeeSeller,
        gatewayFeeRepuestop,
        gatewayTooltip: order.comisionPagoTooltip,
        netSettlement,
        sellerPayout,
        liquidationStatus: order.estadoLiquidacion ?? 'PENDIENTE_LIQUIDACION',
        paidAmount,
        status: statuses[settlementId] ?? 'Completada',
      };
    });
}

export function getCashAllocation(totalCommission: number): { cashFund: number; withdrawalAvailable: number } {
  const cashFund = Math.round(totalCommission * 0.7);
  return { cashFund, withdrawalAvailable: totalCommission - cashFund };
}

export function getExpenseTotal(source: Expense[]): number {
  return source.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

export function getPercent(value: number, total: number): number {
  return total ? Math.round((Number(value || 0) / Number(total || 0)) * 100) : 0;
}

export function getBarWidth(value: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(6, getPercent(value, total)));
}

export function getPartnerBalances(withdrawals: Withdrawal[], partnerPool: number, start: string, end: string): Record<string, number> {
  const partnerShare = Math.floor(partnerPool / PARTNERS.length);
  return Object.fromEntries(PARTNERS.map((partner) => {
    const withdrawn = withdrawals
      .filter((withdrawal) => withdrawal.type === 'partner' && withdrawal.beneficiary === partner && isWithinRange(withdrawal.date, start, end))
      .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0);
    return [partner, partnerShare - withdrawn];
  }));
}

export function validateReceipt(file?: File): string {
  if (!file) return '';
  const extension = file.name.split('.').pop()?.toLowerCase();
  const validExtension = ['pdf', 'jpg', 'jpeg', 'png'].includes(extension ?? '');
  const validType = RECEIPT_TYPES.includes(file.type) || validExtension;
  if (!validType) return 'El comprobante debe ser PDF, JPG o PNG.';
  if (file.size > MAX_RECEIPT_SIZE) return 'El comprobante no puede superar 5MB.';
  return '';
}

export function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char ?? '';
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function normalizeHeader(value: string): string {
  const normalized = slug(value).replace(/-/g, '_');
  const aliases: Record<string, string> = {
    id_pedido: 'order_id',
    fecha: 'date',
    comprador: 'buyer_name',
    vendedor: 'seller_name',
    producto_resumen: 'product_summary',
    producto: 'product_summary',
    total: 'total_amount',
    estado: 'status',
    ultima_actualizacion: 'updated_at',
  };
  return aliases[normalized] ?? normalized;
}

export function normalizeCsvDate(value: string): string {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [date = '', time = '00:00'] = text.replace('T', ' ').split(' ');
    return `${date}T${time.slice(0, 5)}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) {
    const [datePart = '', timePart = '00:00'] = text.split(' ');
    const [day = '', month = '', year = ''] = datePart.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart.slice(0, 5)}`;
  }
  return '';
}

export function downloadFile(fileName: string, content: BlobPart, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Ciclo semanal de pago a proveedores y socios: de jueves a miercoles. Los retiros solicitados
 * dentro del ciclo se pagan el jueves siguiente con la nomina BCI.
 */
export function getCurrentCycleRange(today = new Date()): { start: Date; end: Date } {
  const day = today.getDay(); // 0: domingo, 3: miercoles, 4: jueves
  const start = new Date(today);
  const diffToThursday = day >= 4 ? day - 4 : day + 3;
  start.setDate(today.getDate() - diffToThursday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
