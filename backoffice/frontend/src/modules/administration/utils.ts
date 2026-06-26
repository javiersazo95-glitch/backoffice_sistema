import {
  COMMISSION_RATE,
  MAX_COMMISSION,
  MIN_COMMISSION,
  GATEWAY_RATE,
  GATEWAY_IVA,
  RECEIPT_TYPES,
  MAX_RECEIPT_SIZE,
} from './constants';
import { PARTNERS } from './constants';
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

export function formatDate(dateValue: string): string {
  const [year = '', month = '', day = ''] = dateValue.split('-');
  if (!year || !month || !day) return dateValue;
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateValue: string): string {
  const [date = '', time = '00:00'] = dateValue.split('T');
  return `${formatDate(date)} ${time.slice(0, 5)}`;
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
  return order.date.slice(0, 10);
}

export function isWithinRange(dateValue: string, start: string, end: string): boolean {
  if (!dateValue) return false;
  if (start && dateValue < start) return false;
  if (end && dateValue > end) return false;
  return true;
}

export function getSettlementId(orderId: string): string {
  return `LQ-${orderId.replace(/^PED-/, '')}`;
}

export function getSettlements(orders: Order[], statuses: Record<string, SettlementStatus>): Settlement[] {
  return orders
    .filter((order) => order.status === 'Recibido')
    .map((order) => {
      const subtotal = order.total;
      const buyerCommission = Math.min(MAX_COMMISSION, Math.max(MIN_COMMISSION, Math.round(subtotal * COMMISSION_RATE)));
      const sellerCommission = Math.min(MAX_COMMISSION, Math.max(MIN_COMMISSION, Math.round(subtotal * COMMISSION_RATE)));
      const totalCommission = buyerCommission + sellerCommission;
      const saleTotal = subtotal + buyerCommission;
      const gatewayRate = GATEWAY_RATE * (1 + GATEWAY_IVA);
      const gatewayFee = Math.round(saleTotal * gatewayRate);
      const netSettlement = totalCommission - gatewayFee;
      const paidAmount = subtotal - sellerCommission;
      const settlementId = getSettlementId(order.id);
      return {
        id: settlementId,
        date: orderDate(order),
        seller: order.seller,
        orderId: order.id,
        saleTotal,
        commission: totalCommission,
        buyerCommission,
        sellerCommission,
        gatewayFee,
        netSettlement,
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
