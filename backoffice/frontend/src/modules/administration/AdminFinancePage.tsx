import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import MetricCard from '@/components/shared/MetricCard';
import UiIcon from '@/components/shared/UiIcon';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import FounderSellerName from '@/components/shared/FounderSellerName';
import FounderSellerList from '@/components/shared/FounderSellerList';
import SellerListTooltip from '@/components/shared/SellerListTooltip';
import * as administrationApi from '@/api/administration';
import {
  BANCOS_BCI,
  EXPENSE_CATEGORIES,
  ORDER_STATUS_OPTIONS,
  PARTNERS,
  TIPO_CUENTA_OPTIONS,
  TODAY,
  WITHDRAWAL_REASON_ACCUMULATED,
  WITHDRAWAL_REASON_MONTHLY,
  WITHDRAWAL_REASON_OPTIONS,
} from './constants';
import {
  initialActivity,
  initialExpenses,
  initialFilters,
  initialImports,
  initialOrders,
  initialSelectedRows,
  initialStatusHistory,
  initialWithdrawals,
} from './data';
import type {
  ActivityLog,
  AdminView,
  AdvertisingOrder,
  CashIncomeEntry,
  PartnerIncomeEntry,
  DateFilter,
  Expense,
  ImportRecord,
  IssuedDocument,
  Order,
  OrderStatus,
  SelectedRows,
  Settlement,
  SettlementStatus,
  LiquidationStatus,
  PagoProveedorResponse,
  RetiroAdminResponse,
  RetiroDetalleResponse,
  Socio,
  StatusHistoryItem,
  Withdrawal,
} from './types';
import {
  createId,
  csvCell,
  downloadFile,
  formatDate,
  formatDateTime,
  formatDateTimeLocal,
  formatMonthName,
  formatMoney,
  getBarWidth,
  getCashAllocation,
  getExpenseTotal,
  getMonthRange,
  getPartnerBalances,
  getPercent,
  getSettlements,
  isWithinRange,
  normalizeCsvDate,
  normalizeHeader,
  normalizeText,
  orderDate,
  parseCsv,
  slug,
  validateReceipt,
} from './utils';

type SelectableView = 'pedidos' | 'liquidaciones' | 'gastos';
type PageView = SelectableView | 'retiros' | 'ingresos' | 'caja';
/** Pestañas de la vista exclusiva de socios (/retiros). */
type PartnerTab = 'ingresos' | 'retiros';
/** Pestañas del menú Caja y gastos (/administracion/gastos). */
type CajaExpenseTab = 'caja' | 'gastos';
/** Filtro de origen de ingresos en la tabla de Caja. */
type CajaSourceFilter = 'todos' | 'pedidos' | 'publicidad';

const serviceCommissionLabel = (settlement: Settlement) =>
  settlement.sellerFounder && Math.round(settlement.serviceCommissionRate * 100) === 5
    ? 'Tarifa RepuesTop Fundador (5%)'
    : `Comisión RepuesTop (${Math.round(settlement.serviceCommissionRate * 100)}%)`;

/** El despacho integra la venta gravada: todos los cobros siguientes usan esta base. */
const SettlementSaleBreakdown = ({ settlement }: { settlement: Settlement }) => {
  const hasDiscount = Object.entries(settlement.saleDetail).some(([label, value]) => value < 0 || label.toLowerCase().includes('descuento'));
  return (
    <>
      {Object.entries(settlement.saleDetail).map(([label, value]) => (
        <div className="tooltip-row" key={label}>
          <span>{label}</span>
          <span style={value < 0 ? { color: '#dc2626', fontWeight: 600 } : undefined}>
            {value < 0 ? `-${formatMoney(Math.abs(value))}` : formatMoney(value)}
          </span>
        </div>
      ))}
      <div className="tooltip-divider" />
      <div className="tooltip-row total">
        <span>Base de comisiones: {hasDiscount ? 'productos + despacho - descuento' : 'productos + despacho'}</span>
        <span>{formatMoney(settlement.saleTotal)}</span>
      </div>
    </>
  );
};

const SettlementFeeBreakdown = ({ settlement }: { settlement: Settlement }) => {
  const hasDiscount = Boolean(settlement.descuento && settlement.descuento > 0);
  return (
    <>
      <div className="tooltip-row">
        <span>Base de cálculo: {hasDiscount ? 'productos + despacho - descuento' : 'productos + despacho'}</span>
        <span>{formatMoney(settlement.saleTotal)}</span>
      </div>
      <div className="tooltip-row"><span>{serviceCommissionLabel(settlement)}</span><span>{formatMoney(settlement.serviceCommission)}</span></div>
      <div className="tooltip-row"><span>IVA de tarifa de servicio</span><span>{formatMoney(settlement.serviceCommissionIva)}</span></div>
      <div className="tooltip-row"><span>Comisión PagoFlow sobre venta total</span><span>{formatMoney(settlement.gatewayFeeSeller)}</span></div>
      <div className="tooltip-divider" />
      <div className="tooltip-row total"><span>Total descuentos al vendedor</span><span>{formatMoney(settlement.commission)}</span></div>
    </>
  );
};

const SettlementNetBreakdown = ({ settlement }: { settlement: Settlement }) => <>
  <div className="tooltip-row"><span>Tarifa de servicio cobrada</span><span>{formatMoney(settlement.commission)}</span></div>
  <div className="tooltip-row"><span>IVA de tarifa de servicio</span><span>-{formatMoney(settlement.serviceCommissionIva)}</span></div>
  <div className="tooltip-row"><span>Comisión PagoFlow sobre productos + despacho</span><span>-{formatMoney(settlement.gatewayFeeSeller)}</span></div>
  <div className="tooltip-divider" />
  <div className="tooltip-row total"><span>Ganancia neta RepuesTop</span><span>{formatMoney(settlement.netSettlement)}</span></div>
</>;

interface PaginationState {
  page: number;
  pageSize: number;
}

type OrderCriticalityLevel = 'normal' | 'warning' | 'critical' | 'not-applicable';

interface OrderCriticality {
  level: OrderCriticalityLevel;
  label: string;
  elapsedHours: number | null;
  reason: string;
  expectedAction: string;
}

interface LiquidationSellerGroup {
  key: string;
  seller: string;
  sellerFounder?: boolean;
  rut: string;
  legalName: string;
  email: string;
  settlements: Settlement[];
  total: number;
  iva: number;
  retiroId: number | null;
}

interface ExpenseDraft {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: string;
  receipt: string;
  receiptUrl: string;
  receiptType: string;
}

interface OrderDraft {
  id: string;
  date: string;
  buyer: string;
  seller: string;
  product: string;
  total: string;
  status: OrderStatus;
}

interface DocumentDraft {
  orderId: string;
  orderIds: string[];
  retiroId: number | null;
  isEditing: boolean;
  type: string;
  rut: string;
  name: string;
  email: string;
  detail: string;
  ivaLiquidado: string;
  pdfName?: string;
  pdfUrl?: string;
  pdfFile?: File;
  originalPdfName?: string;
}

interface RegisteredDocumentPreview {
  orderId: string;
  document: IssuedDocument;
}

interface PaidDocumentPreview {
  fileName: string;
  fileUrl: string;
}

function isIssuedDocumentComplete(document?: IssuedDocument): boolean {
  if (!document) return false;
  return Boolean(
    document.type.trim()
    && document.rut.trim()
    && document.name.trim()
    && document.email.trim()
    && document.detail.trim()
    && document.ivaLiquidado?.trim()
    && document.pdfName?.trim(),
  );
}

function getOrderCriticality(order: Order): OrderCriticality {
  const updatedAt = Date.parse(order.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return {
      level: 'warning',
      label: 'Revisar fecha',
      elapsedHours: null,
      reason: 'El pedido no tiene una fecha de última actualización válida.',
      expectedAction: 'Registrar o corregir la última actualización del pedido.',
    };
  }

  const elapsedHours = Math.max(0, (Date.now() - updatedAt) / (1000 * 60 * 60));
  const terminalStatuses: OrderStatus[] = ['Finalizado', 'Cancelado', 'Cancelado parcialmente', 'En mediación'];
  if (terminalStatuses.includes(order.status)) {
    return {
      level: 'not-applicable',
      label: 'Sin seguimiento',
      elapsedHours,
      reason: order.status === 'En mediación'
        ? 'El caso está bajo seguimiento de mediación.'
        : `El pedido está ${order.status.toLowerCase()}.`,
      expectedAction: 'No requiere avance operativo automático.',
    };
  }

  const ruleByStatus: Record<Exclude<OrderStatus, 'Finalizado' | 'Cancelado' | 'Cancelado parcialmente' | 'En mediación'>, { warning: number; critical: number; action: string }> = {
    Pendiente: { warning: 24, critical: 48, action: 'Confirmar y avanzar la preparación del pedido.' },
    Preparando: { warning: 48, critical: 72, action: 'Despachar el pedido o registrar el motivo del retraso.' },
    Enviado: { warning: 72, critical: 120, action: 'Revisar transporte y confirmar la entrega al comprador.' },
    Recibido: { warning: 48, critical: 72, action: 'Finalizar el pedido o registrar una incidencia.' },
  };
  const rule = ruleByStatus[order.status as keyof typeof ruleByStatus];
  if (!rule) {
    return {
      level: 'not-applicable',
      label: 'Sin seguimiento',
      elapsedHours,
      reason: `El pedido está ${order.status}.`,
      expectedAction: 'No requiere avance operativo automático.',
    };
  }

  if (elapsedHours >= rule.critical) {
    return { level: 'critical', label: 'Crítico', elapsedHours, reason: `Lleva ${formatElapsedHours(elapsedHours)} sin pasar de “${order.status}”; supera el límite de ${rule.critical} h.`, expectedAction: rule.action };
  }
  if (elapsedHours >= rule.warning) {
    return { level: 'warning', label: 'Atención', elapsedHours, reason: `Lleva ${formatElapsedHours(elapsedHours)} sin pasar de “${order.status}”; se acerca al límite de ${rule.critical} h.`, expectedAction: rule.action };
  }
  return { level: 'normal', label: 'En plazo', elapsedHours, reason: `Lleva ${formatElapsedHours(elapsedHours)} en “${order.status}”, dentro del plazo operativo.`, expectedAction: rule.action };
}

function formatElapsedHours(hours: number): string {
  if (hours < 24) return `${Math.max(0, Math.floor(hours))} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return `${days} d${remainingHours ? ` ${remainingHours} h` : ''}`;
}

interface WithdrawalDraft {
  date: string;
  beneficiary: string;
  reason: string;
  amount: string;
}

/** BO-SOCIOS-001: formulario de datos bancarios de un socio. */
interface SocioBancoDraft {
  nombre: string;
  rut: string;
  banco: string;
  bankCode: number | null;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string;
  email: string;
}

const DATE_PRESETS = [
  { label: 'Hoy', start: TODAY, end: TODAY },
  { label: '7 días', start: 'last7', end: TODAY },
  { label: '30 días', start: 'last30', end: TODAY },
  { label: 'Mes actual', start: 'month', end: 'month' },
  { label: 'Todo', start: '', end: '' },
] as const;

const paginationDefaults: Record<PageView, PaginationState> = {
  pedidos: { page: 1, pageSize: 5 },
  liquidaciones: { page: 1, pageSize: 5 },
  gastos: { page: 1, pageSize: 5 },
  retiros: { page: 1, pageSize: 5 },
  ingresos: { page: 1, pageSize: 5 },
  caja: { page: 1, pageSize: 10 },
};

function emptyExpenseDraft(): ExpenseDraft {
  return {
    id: '',
    date: TODAY,
    category: EXPENSE_CATEGORIES[0] ?? 'Otros',
    description: '',
    amount: '',
    receipt: '',
    receiptUrl: '',
    receiptType: '',
  };
}



function getPage<T>(source: T[], pagination: PaginationState): { rows: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(source.length / pagination.pageSize));
  const page = Math.min(Math.max(1, pagination.page), totalPages);
  const start = (page - 1) * pagination.pageSize;
  return { rows: source.slice(start, start + pagination.pageSize), totalPages };
}

function selectMetricRows<T>(source: T[], selected: Set<string>, getId: (row: T) => string): T[] {
  const selectedRows = source.filter((row) => selected.has(getId(row)));
  return selectedRows.length ? selectedRows : source;
}

function getLiquidationPeriod(dateValue: string): string {
  const [year, month, day] = (dateValue.split('T')[0] ?? '').split('-').map(Number);
  if (!year || !month || !day) return dateValue;
  const start = new Date(year, month - 1, day);
  start.setDate(start.getDate() - ((start.getDay() - 4 + 7) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const toDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${formatDate(toDateString(start))} - ${formatDate(toDateString(end))}`;
}

function getPaymentPeriod(dateValue: string): { start: string; end: string } {
  const [year, month, day] = (dateValue.split('T')[0] ?? '').split('-').map(Number);
  if (!year || !month || !day) return { start: dateValue, end: dateValue };
  const start = new Date(year, month - 1, day);
  start.setDate(start.getDate() - ((start.getDay() - 4 + 7) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  subtitle,
  badges,
  children,
  onClose,
}: {
  title: ReactNode;
  subtitle?: string;
  badges?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Detalle'} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-block">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {badges && <div className="modal-header-badges">{badges}</div>}
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function DateRangeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateFilter;
  onChange: (next: Partial<DateFilter>) => void;
}) {
  const [open, setOpen] = useState(false);

  const summary = value.start && value.end
    ? `${formatDate(value.start)} - ${formatDate(value.end)}`
    : value.start
      ? `Desde ${formatDate(value.start)}`
      : value.end
        ? `Hasta ${formatDate(value.end)}`
        : 'Todo el periodo';

  function applyPreset(preset: typeof DATE_PRESETS[number]): void {
    if (preset.start === 'last7') {
      const start = new Date(`${TODAY}T00:00:00`);
      start.setDate(start.getDate() - 6);
      onChange({ start: start.toISOString().slice(0, 10), end: TODAY });
    } else if (preset.start === 'last30') {
      const start = new Date(`${TODAY}T00:00:00`);
      start.setDate(start.getDate() - 29);
      onChange({ start: start.toISOString().slice(0, 10), end: TODAY });
    } else if (preset.start === 'month') {
      const base = new Date(`${TODAY}T00:00:00`);
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      onChange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    } else {
      onChange({ start: preset.start, end: preset.end });
    }
    setOpen(false);
  }

  return (
    <div className="date-range-control">
      <button
        className="date-range-trigger"
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="date-range-trigger-icon"><UiIcon name="calendar" /></span>
        <span className="date-range-trigger-copy">
          <strong>{label}</strong>
          <small>{summary}</small>
        </span>
        <UiIcon name="chevronDown" className={`date-range-chevron${open ? ' open' : ''}`} />
      </button>

      {open && (
        <div className="date-range-popover" role="dialog" aria-label={`${label} - filtro de fecha`}>
          <div className="date-range-popover-head">
            <div>
              <strong>Filtrar por fecha</strong>
              <span>Aplica solo a la vista de Administración Contable activa.</span>
            </div>
            <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Cerrar filtro">
              <UiIcon name="close" />
            </button>
          </div>

          <div className="date-range-presets">
            {DATE_PRESETS.map((preset) => (
              <button key={preset.label} type="button" className="date-range-preset" onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="date-range-fields">
            <FieldLabel label="Inicio">
              <input className="input" type="date" value={value.start} onChange={(event) => onChange({ start: event.target.value })} />
            </FieldLabel>
            <FieldLabel label="Fin">
              <input className="input" type="date" value={value.end} onChange={(event) => onChange({ end: event.target.value })} />
            </FieldLabel>
          </div>

          <div className="date-range-actions">
            <button className="secondary-button" type="button" onClick={() => onChange({ start: '', end: '' })}>Limpiar</button>
            <button className="primary-button" type="button" onClick={() => setOpen(false)}>Listo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionHeader({
  view,
  sourceIds,
  selected,
  onToggle,
}: {
  view: SelectableView;
  sourceIds: string[];
  selected: Set<string>;
  onToggle: (view: SelectableView, ids: string[]) => void;
}) {
  const allSelected = sourceIds.length > 0 && sourceIds.every((id) => selected.has(id));
  return (
    <th className="selection-cell selection-heading">
      <span>Sel.</span>
      <button
        className="selection-icon-button"
        type="button"
        title={allSelected ? 'Limpiar selección masiva' : 'Seleccionar masivo'}
        onClick={() => onToggle(view, sourceIds)}
        disabled={!sourceIds.length}
      >
        <UiIcon name={allSelected ? 'clearSelection' : 'selectAll'} />
      </button>
    </th>
  );
}

function TablePager({
  view,
  state,
  totalPages,
  onPage,
  onPageSize,
}: {
  view: PageView;
  state: PaginationState;
  totalPages: number;
  onPage: (view: PageView, direction: 'prev' | 'next') => void;
  onPageSize: (view: PageView, pageSize: number) => void;
}) {
  return (
    <div className="table-pager">
      <div className="pagination subtle">
        <button type="button" onClick={() => onPage(view, 'prev')} disabled={state.page <= 1}>‹</button>
        <span>Página {state.page} de {totalPages}</span>
        <button type="button" onClick={() => onPage(view, 'next')} disabled={state.page >= totalPages}>›</button>
      </div>
      <select className="select page-size-select" value={state.pageSize} onChange={(event) => onPageSize(view, Number(event.target.value))} aria-label="Registros por página">
        {[5, 10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </div>
  );
}

export default function AdminFinancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const orderImportRef = useRef<HTMLInputElement | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedRef = useRef(false);

  const pathSegments = location.pathname.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
  const activeView: AdminView = (['resumen', 'pedidos', 'liquidaciones', 'gastos', 'retiros'].includes(lastSegment) ? lastSegment : 'resumen') as AdminView;
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
  const [updatedAtOrder, setUpdatedAtOrder] = useState<'asc' | 'desc'>('asc');
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(initialWithdrawals);
  const [, setImports] = useState<ImportRecord[]>(initialImports);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(initialActivity);
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState<Record<PageView, PaginationState>>(paginationDefaults);
  const [selectedRows, setSelectedRows] = useState<SelectedRows>(initialSelectedRows);
  const [statusHistory, setStatusHistory] = useState<Record<string, StatusHistoryItem[]>>(initialStatusHistory);
  const [settlementStatuses, setSettlementStatuses] = useState<Record<string, SettlementStatus>>({});
  const [liquidationTab, setLiquidationTab] = useState<LiquidationStatus>('PENDIENTE_LIQUIDACION');
  /** Tab del menú Pedidos: ventas de repuestos o compras de publicidad. */
  const [searchParams] = useSearchParams();
  /** Tab del menú Pedidos: ventas de repuestos o compras de publicidad. */
  const [ordersTab, setOrdersTab] = useState<'pedidos' | 'publicidad'>(() => searchParams.get('tab') === 'publicidad' ? 'publicidad' : 'pedidos');
  /** Tab del menú Caja y gastos: 'caja' o 'gastos'. */
  const [cajaExpenseTab, setCajaExpenseTab] = useState<CajaExpenseTab>('caja');
  const [cajaSourceFilter, setCajaSourceFilter] = useState<CajaSourceFilter>('todos');
  const [cajaQuery, setCajaQuery] = useState('');
  const [advertisingQuery, setAdvertisingQuery] = useState('');
  /**
   * Filtro de documento tributario del tab Publicidad. Arranca en 'sin' porque lo accionable
   * es el pendiente: la lista completa no le sirve a nadie para emitir.
   */
  const [advertisingDocFilter, setAdvertisingDocFilter] = useState<'todas' | 'sin' | 'con'>('sin');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'publicidad') {
      setOrdersTab('publicidad');
      setAdvertisingDocFilter('sin');
    } else if (tabParam === 'pedidos') {
      setOrdersTab('pedidos');
    }
  }, [searchParams]);
  const [docRecargaDraft, setDocRecargaDraft] = useState<{
    compraId: number; codigo: string; comprador: string; tipo: string; folio: string;
    rut: string; razonSocial: string; archivo: File | null; yaCargado: boolean;
    // Lo que hay que tipear en el Portal MIPYME, para no ir a buscarlo a otra pantalla.
    email: string; giro: string; direccion: string; detalle: string;
    neto: number; iva: number; total: number;
    /** Lo que el comprador pidio al recargar. Null si no eligio. */
    solicitado: string | null;
  } | null>(null);
  const [docRecargaCopiado, setDocRecargaCopiado] = useState(false);
  const [docRecargaBusy, setDocRecargaBusy] = useState(false);
  const [docRecargaError, setDocRecargaError] = useState('');
  const [selectedAdvertisingOrder, setSelectedAdvertisingOrder] = useState<AdvertisingOrder | null>(null);
  const [partnerTab, setPartnerTab] = useState<PartnerTab>('ingresos');
  const [partnerIncomeFilter, setPartnerIncomeFilter] = useState<'todos' | 'pedidos' | 'publicidad'>('todos');
  const [expandedLiquidationSellers, setExpandedLiquidationSellers] = useState<Set<string>>(new Set());
  const [selectedLiquidationSeller, setSelectedLiquidationSeller] = useState<LiquidationSellerGroup | null>(null);
  const [selectedPaidPeriod, setSelectedPaidPeriod] = useState<string>('');
  const [selectedPaidPayment, setSelectedPaidPayment] = useState<PagoProveedorResponse | null>(null);
  const [paidDocumentsPayment, setPaidDocumentsPayment] = useState<PagoProveedorResponse | null>(null);
  const [paidDetailQuery, setPaidDetailQuery] = useState('');
  const [paidDetailSeller, setPaidDetailSeller] = useState('');
  const [issuedDocuments, setIssuedDocuments] = useState<Record<string, IssuedDocument>>({});
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [withdrawalDraft, setWithdrawalDraft] = useState<WithdrawalDraft | null>(null);
  const [withdrawalError, setWithdrawalError] = useState('');
  const [socioBancoDraft, setSocioBancoDraft] = useState<SocioBancoDraft | null>(null);
  const [socioBancoError, setSocioBancoError] = useState('');

  const [documentDraft, setDocumentDraft] = useState<DocumentDraft | null>(null);
  const [registeredDocumentPreview, setRegisteredDocumentPreview] = useState<RegisteredDocumentPreview | null>(null);
  const [paidDocumentPreview, setPaidDocumentPreview] = useState<PaidDocumentPreview | null>(null);
  const [receiptExpense, setReceiptExpense] = useState<Expense | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);
  const [selectedDetailSettlement, setSelectedDetailSettlement] = useState<Settlement | null>(null);
  const [selectedHistoryOrderId, setSelectedHistoryOrderId] = useState<string | null>(null);
  const [selectedOrderCriticality, setSelectedOrderCriticality] = useState<Order | null>(null);
  const [backendWorkspace, setBackendWorkspace] = useState<{ module: string; status: string; views: string[]; persistenceMode: string } | null>(null);

  const { data: bootstrap } = useQuery({
    queryKey: ['administration-bootstrap'],
    queryFn: administrationApi.getBootstrap,
  });
  const { data: adminWithdrawals = [] } = useQuery<RetiroAdminResponse[]>({
    queryKey: ['admin-withdrawals'],
    queryFn: administrationApi.getWithdrawals,
  });
  const { data: paidPayments = [] } = useQuery({ queryKey: ['withdrawal-payments'], queryFn: administrationApi.getWithdrawalPayments });
  // Compras de fichas para publicidad: se muestran en su propio tab de Pedidos
  // para no mezclarlas con las ventas de repuestos.
  const { data: advertising, refetch: refetchAdvertising } = useQuery({
    queryKey: ['advertising-orders'],
    queryFn: administrationApi.getAdvertisingOrders,
  });
  const { data: socios = [], refetch: refetchSocios } = useQuery<Socio[]>({
    queryKey: ['administration-socios'],
    queryFn: administrationApi.getSocios,
  });
  const { data: paidPaymentDetails = [] } = useQuery<RetiroDetalleResponse[]>({
    queryKey: ['withdrawal-payment-details', selectedPaidPayment?.pagoId],
    queryFn: () => Promise.all((selectedPaidPayment?.retiros ?? []).map((retiro) => administrationApi.getWithdrawalDetails(retiro.retiroId))),
    enabled: Boolean(selectedPaidPayment),
  });

  const settlements = useMemo(() => getSettlements(orders, settlementStatuses), [orders, settlementStatuses]);

  useEffect(() => {
    if (!bootstrap || hydratedRef.current) return;
    hydratedRef.current = true;
    setOrders(bootstrap.orders);
    setExpenses(bootstrap.expenses);
    setWithdrawals(bootstrap.withdrawals);
    setActivityLogs(bootstrap.activityLogs);
    setFilters(bootstrap.filters);
    setPagination((current) => ({ ...current, ...bootstrap.pagination }));
    setStatusHistory(bootstrap.statusHistory);
    setSettlementStatuses(bootstrap.settlementStatuses);
    setIssuedDocuments(bootstrap.issuedDocuments);
    setImports(bootstrap.imports);
    setBackendWorkspace(bootstrap.workspace);
  }, [bootstrap]);

  /** Compras de publicidad que calzan con la búsqueda del tab. */
  const filteredAdvertisingOrders = useMemo(() => {
    let rows = advertising?.compras ?? [];
    if (advertisingDocFilter === 'sin') rows = rows.filter((row) => !row.documentoCargado);
    else if (advertisingDocFilter === 'con') rows = rows.filter((row) => row.documentoCargado);

    const term = normalizeText(advertisingQuery);
    if (!term) return rows;
    return rows.filter((row) => [row.codigo, row.comprador, row.correo, row.pack, row.metodoPago]
      .some((value) => normalizeText(value ?? '').includes(term)));
  }, [advertising, advertisingQuery, advertisingDocFilter]);

  /** Cuantas recargas siguen sin su documento, sobre el total y no sobre lo filtrado. */
  const advertisingSinDocumento = useMemo(
    () => (advertising?.compras ?? []).filter((row) => !row.documentoCargado).length,
    [advertising?.compras],
  );

  /**
   * Las tarjetas siguen a lo que se está viendo: si hay búsqueda se recalculan
   * sobre lo filtrado, para que el monto de arriba cuadre con la tabla.
   */
  const advertisingMetrics = useMemo(() => {
    const rows = filteredAdvertisingOrders;
    const sum = (pick: (row: AdvertisingOrder) => number) => rows.reduce((total, row) => total + (pick(row) || 0), 0);
    return {
      cantidad: rows.length,
      monto: sum((row) => row.montoPagado),
      ganancia: sum((row) => row.montoNeto),
      comision: sum((row) => row.comisionPasarela),
      fichas: sum((row) => row.cantidadFichas),
    };
  }, [filteredAdvertisingOrders]);

  const filteredOrders = useMemo(() => {
    const filter = filters.pedidos;
    const query = normalizeText(filter.query);
    return orders.filter((order) => {
      // Los pedidos finalizados pasan a liquidaciones: no requieren gestión ni alerta en esta vista.
      if (order.status === 'Finalizado') return false;
      const matchesDate = isWithinRange(orderDate(order), filter.start, filter.end);
      const matchesQuery = !query || [order.id, order.buyer, order.seller, order.product].some((value) => normalizeText(value).includes(query));
      const matchesStatus = !selectedStatusFilter || order.status === selectedStatusFilter;
      return matchesDate && matchesQuery && matchesStatus;
    }).sort((first, second) => {
      const firstUpdatedAt = Date.parse(first.updatedAt);
      const secondUpdatedAt = Date.parse(second.updatedAt);
      const firstTime = Number.isNaN(firstUpdatedAt) ? 0 : firstUpdatedAt;
      const secondTime = Number.isNaN(secondUpdatedAt) ? 0 : secondUpdatedAt;
      return updatedAtOrder === 'asc' ? firstTime - secondTime : secondTime - firstTime;
    });
  }, [filters.pedidos, orders, selectedStatusFilter, updatedAtOrder]);

  const summaryOrders = useMemo(
    () => orders.filter((order) => isWithinRange(orderDate(order), filters.resumen.start, filters.resumen.end)),
    [filters.resumen, orders],
  );

  const filteredSettlements = useMemo(() => {
    const filter = filters.liquidaciones;
    const query = normalizeText(filter.query);
    return settlements.filter((settlement) => {
      const matchesDate = isWithinRange(settlement.date, filter.start, filter.end);
      const matchesQuery = !query || [settlement.id, settlement.seller, settlement.orderId].some((value) => normalizeText(value).includes(query));
      return matchesDate && matchesQuery && settlement.liquidationStatus === liquidationTab;
    });
  }, [filters.liquidaciones, liquidationTab, settlements]);

  const filteredExpenses = useMemo(() => {
    const filter = filters.gastos;
    const query = normalizeText(filter.query);
    return expenses.filter((expense) => {
      const matchesDate = isWithinRange(expense.date, filter.start, filter.end);
      const matchesQuery = !query || [expense.category, expense.description, expense.receipt, formatMoney(expense.amount)].some((value) => normalizeText(value).includes(query));
      return matchesDate && matchesQuery;
    });
  }, [expenses, filters.gastos]);

  /** Pedidos finalizados dentro del periodo de filtro de Caja y gastos. */
  const cajaPeriodSettlements = useMemo(() => {
    return settlements.filter((settlement) => isWithinRange(settlement.date, filters.gastos.start, filters.gastos.end));
  }, [filters.gastos.start, filters.gastos.end, settlements]);

  /** Compras de fichas para publicidad dentro del periodo de filtro de Caja y gastos. */
  const cajaPeriodAds = useMemo(() => {
    const rows = advertising?.compras ?? [];
    return rows.filter((row) => isWithinRange((row.fecha ?? '').slice(0, 10), filters.gastos.start, filters.gastos.end));
  }, [advertising?.compras, filters.gastos.start, filters.gastos.end]);

  /**
   * Convergencia total de ingresos (pedidos y publicidad):
   * - Pedidos: ganancia neta (5% tarifa fundador o 10%/7%/5% normal menos pasarela/IVA) -> 70% a caja.
   * - Publicidad: total de la venta menos comisión pasarela Flow -> 70% a caja.
   */
  const cajaEntriesAll = useMemo<CashIncomeEntry[]>(() => {
    const ordersMap = new Map<string, Order>(orders.map((o) => [o.id, o]));

    const pedidosEntries: CashIncomeEntry[] = cajaPeriodSettlements.map((settlement) => {
      const order = ordersMap.get(settlement.orderId) || ordersMap.get(settlement.id);
      const commissionLabel = settlement.sellerFounder && Math.round(settlement.serviceCommissionRate * 100) === 5
        ? 'Tarifa Fundador (5%)'
        : `Comisión RepuesTop (${Math.round(settlement.serviceCommissionRate * 100)}%)`;
      const netProfit = settlement.netSettlement;
      const cashAmount = Math.round(netProfit * 0.7);

      return {
        id: settlement.orderId,
        type: 'pedido',
        date: settlement.date,
        concept: order?.product ? `Repuesto: ${order.product}` : `Pedido ${settlement.orderId}`,
        buyer: order?.buyer || 'Cliente',
        sellerOrPack: settlement.seller,
        sellerFounder: settlement.sellerFounder,
        totalSale: settlement.saleTotal,
        commissionOrDeduction: commissionLabel,
        commissionAmount: settlement.commission,
        netProfit,
        cashAmount,
        orderId: settlement.orderId,
        originalOrder: order,
        originalSettlement: settlement,
      };
    });

    const publicidadEntries: CashIncomeEntry[] = cajaPeriodAds.map((ad) => {
      const netProfit = ad.montoNeto;
      const cashAmount = Math.round(netProfit * 0.7);

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
        cashAmount,
        originalAdvertising: ad,
      };
    });

    return [...pedidosEntries, ...publicidadEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [cajaPeriodSettlements, cajaPeriodAds, orders]);

  /** Métricas de las 3 tarjetas superiores de la vista Caja. */
  const cajaMetrics = useMemo(() => {
    const pedidosEntries = cajaEntriesAll.filter((e) => e.type === 'pedido');
    const publicidadEntries = cajaEntriesAll.filter((e) => e.type === 'publicidad');

    const sum = (items: CashIncomeEntry[], pick: (item: CashIncomeEntry) => number) =>
      items.reduce((total, item) => total + (pick(item) || 0), 0);

    const pedidosProfit = sum(pedidosEntries, (e) => e.netProfit);
    const pedidosCaja = sum(pedidosEntries, (e) => e.cashAmount);
    const publicidadProfit = sum(publicidadEntries, (e) => e.netProfit);
    const publicidadCaja = sum(publicidadEntries, (e) => e.cashAmount);

    const totalProfit = pedidosProfit + publicidadProfit;
    const totalCaja = pedidosCaja + publicidadCaja;

    return {
      totalProfit,
      totalCaja,
      totalCount: cajaEntriesAll.length,
      pedidosProfit,
      pedidosCaja,
      pedidosCount: pedidosEntries.length,
      publicidadProfit,
      publicidadCaja,
      publicidadCount: publicidadEntries.length,
    };
  }, [cajaEntriesAll]);

  /**
   * Abre el formulario del documento de una recarga. Si todavia no se emitio, precarga lo que
   * corresponde: FACTURA con el RUT de la tienda cuando el comprador tiene RUT de empresa
   * -- quien recarga es casi siempre un vendedor con giro y necesita el credito fiscal -- y
   * BOLETA cuando no.
   */
  async function abrirDocumentoRecarga(row: AdvertisingOrder) {
    setDocRecargaError('');
    let sugerencia = {
      tipo: 'BOLETA', rut: '', razonSocial: '', email: '', giro: '', direccion: '',
      detalle: '', neto: 0, iva: 0, total: row.montoPagado,
      solicitado: null as string | null,
    };
    try {
      const datos = await administrationApi.getDocumentoRecargaSugerencia(row.id);
      sugerencia = {
        tipo: datos.tipo ?? 'BOLETA',
        rut: datos.rut ?? '',
        razonSocial: datos.razonSocial ?? '',
        email: datos.email ?? '',
        giro: datos.giro ?? '',
        direccion: datos.direccion ?? '',
        detalle: datos.detalle ?? '',
        neto: datos.neto ?? 0,
        iva: datos.iva ?? 0,
        total: datos.total ?? row.montoPagado,
        solicitado: datos.solicitadoPorElComprador ?? null,
      };
    } catch {
      // Sin sugerencia igual se puede emitir: el administrador escribe los datos a mano.
    }
    setDocRecargaDraft({
      compraId: row.id,
      codigo: row.codigo,
      comprador: row.comprador ?? sugerencia.email ?? 'Sin registrar',
      tipo: row.documentoTipo ?? sugerencia.tipo,
      folio: row.documentoFolio ?? '',
      rut: sugerencia.rut,
      razonSocial: sugerencia.razonSocial,
      archivo: null,
      yaCargado: row.documentoDescargable,
      email: sugerencia.email,
      giro: sugerencia.giro,
      direccion: sugerencia.direccion,
      detalle: sugerencia.detalle,
      neto: sugerencia.neto,
      iva: sugerencia.iva,
      total: sugerencia.total,
      solicitado: sugerencia.solicitado,
    });
    setDocRecargaCopiado(false);
  }

  async function guardarDocumentoRecarga() {
    if (!docRecargaDraft || docRecargaBusy) return;
    if (!docRecargaDraft.archivo) {
      setDocRecargaError('Adjunta el PDF del documento emitido.');
      return;
    }
    setDocRecargaBusy(true);
    setDocRecargaError('');
    try {
      const form = new FormData();
      form.append('archivo', docRecargaDraft.archivo);
      form.append('tipo', docRecargaDraft.tipo);
      if (docRecargaDraft.folio.trim()) form.append('folio', docRecargaDraft.folio.trim());
      if (docRecargaDraft.rut.trim()) form.append('rut', docRecargaDraft.rut.trim());
      if (docRecargaDraft.razonSocial.trim()) form.append('razonSocial', docRecargaDraft.razonSocial.trim());
      await administrationApi.registrarDocumentoRecarga(docRecargaDraft.compraId, form);
      await refetchAdvertising();
      setDocRecargaDraft(null);
    } catch (error) {
      setDocRecargaError(
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'No se pudo registrar el documento.');
    } finally {
      setDocRecargaBusy(false);
    }
  }

  async function verDocumentoRecarga(compraId: number) {
    try {
      const url = await administrationApi.getDocumentoRecargaUrl(compraId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.alert('No se pudo abrir el documento.');
    }
  }

  /** Entradas filtradas por el filtro de 3 botones (Todos, Pedidos, Publicidad) y buscador. */
  const filteredCajaEntries = useMemo(() => {
    let list = cajaEntriesAll;
    if (cajaSourceFilter === 'pedidos') {
      list = list.filter((e) => e.type === 'pedido');
    } else if (cajaSourceFilter === 'publicidad') {
      list = list.filter((e) => e.type === 'publicidad');
    }

    const term = normalizeText(cajaQuery);
    if (!term) return list;

    return list.filter((item) =>
      [item.id, item.concept, item.buyer, item.sellerOrPack, item.commissionOrDeduction, formatMoney(item.totalSale), formatMoney(item.cashAmount)]
        .some((val) => normalizeText(val ?? '').includes(term))
    );
  }, [cajaEntriesAll, cajaQuery, cajaSourceFilter]);

  const activeWithdrawals = useMemo(
    () => adminWithdrawals.filter((withdrawal) => withdrawal.estado === 'SOLICITADO'),
    [adminWithdrawals],
  );

  function findActiveWithdrawalId(seller: string, rut?: string, email?: string): number | null {
    const normalizedRut = normalizeText(rut).replace(/[^0-9k]/g, '');
    const normalizedEmail = normalizeText(email);
    const normalizedSeller = normalizeText(seller);

    const withdrawal = (normalizedEmail
      ? activeWithdrawals.find((candidate) => normalizeText(candidate.email) === normalizedEmail)
      : undefined)
      ?? (normalizedRut
        ? activeWithdrawals.find((candidate) => normalizeText(candidate.rut).replace(/[^0-9k]/g, '') === normalizedRut)
        : undefined)
      ?? (normalizedSeller
        ? activeWithdrawals.find((candidate) => normalizeText(candidate.nombreTienda) === normalizedSeller)
        : undefined);

    return withdrawal?.retiroId ?? null;
  }

  const enLiquidationGroups = useMemo(() => {
    const groups = new Map<string, LiquidationSellerGroup>();
    filteredSettlements.forEach((settlement) => {
      const key = settlement.sellerEmail || settlement.sellerTaxId || settlement.seller;
      const current = groups.get(key) ?? {
        key,
        seller: settlement.seller,
        sellerFounder: settlement.sellerFounder,
        rut: settlement.sellerTaxId || 'Sin RUT',
        legalName: settlement.sellerLegalName || settlement.seller,
        email: settlement.sellerEmail || 'Sin correo',
        settlements: [],
        total: 0,
        iva: 0,
        retiroId: findActiveWithdrawalId(
          settlement.seller,
          settlement.sellerTaxId,
          settlement.sellerEmail,
        ),
      };
      current.settlements.push(settlement);
      current.total += settlement.sellerPayout;
      current.iva += settlement.serviceCommissionIva;
      groups.set(key, current);
    });
    return [...groups.values()];
  }, [activeWithdrawals, filteredSettlements]);
  const paidPeriods = useMemo(() => [...new Map(paidPayments.map((payment) => {
    const period = getPaymentPeriod(payment.fechaPago);
    const key = `${period.start}|${period.end}`;
    return [key, { key, ...period }];
  })).values()], [paidPayments]);
  const activePaidPeriod = selectedPaidPeriod || paidPeriods[0]?.key || '';
  const paidPaymentsForPeriod = useMemo(() => paidPayments.filter((payment) => {
    const period = getPaymentPeriod(payment.fechaPago);
    return `${period.start}|${period.end}` === activePaidPeriod;
  }), [activePaidPeriod, paidPayments]);
  const paidRetiroIds = useMemo(() => new Set(paidPaymentsForPeriod.flatMap((payment) => payment.retiros.map((retiro) => retiro.retiroId))), [paidPaymentsForPeriod]);
  const paidPeriodSettlements = useMemo(() => settlements.filter((settlement) => settlement.liquidationStatus === 'LIQUIDADO' && paidRetiroIds.size && settlement.id && isWithinRange(settlement.date, paidPeriods.find((period) => period.key === activePaidPeriod)?.start.slice(0, 10) ?? '', paidPeriods.find((period) => period.key === activePaidPeriod)?.end.slice(0, 10) ?? '')), [activePaidPeriod, paidPeriods, paidRetiroIds, settlements]);

  const filteredWithdrawals = useMemo(
    () => withdrawals
      .filter((withdrawal) => withdrawal.type === 'partner' && isWithinRange(withdrawal.date, filters.retiros.start, filters.retiros.end))
      .sort((first, second) => second.date.localeCompare(first.date)),
    [filters.retiros, withdrawals],
  );

  /** Pedidos finalizados dentro del periodo de filtro de Retiros/Socios. */
  const periodPartnerSettlements = useMemo(() => {
    return settlements.filter((settlement) => isWithinRange(settlement.date, filters.retiros.start, filters.retiros.end));
  }, [filters.retiros.start, filters.retiros.end, settlements]);

  /** Compras de publicidad dentro del periodo de filtro de Retiros/Socios. */
  const periodPartnerAds = useMemo(() => {
    const rows = advertising?.compras ?? [];
    return rows.filter((row) => isWithinRange((row.fecha ?? '').slice(0, 10), filters.retiros.start, filters.retiros.end));
  }, [advertising?.compras, filters.retiros.start, filters.retiros.end]);

  /**
   * Ingresos de socios: Convergencia de pedidos finalizados y compras de fichas de publicidad.
   * De cada ingreso neto, el 30% corresponde al pool repartible de los socios.
   */
  const partnerIncomesAll = useMemo<PartnerIncomeEntry[]>(() => {
    const ordersMap = new Map<string, Order>(orders.map((o) => [o.id, o]));

    const pedidosEntries: PartnerIncomeEntry[] = periodPartnerSettlements.map((settlement) => {
      const order = ordersMap.get(settlement.orderId) || ordersMap.get(settlement.id);
      const commissionLabel = settlement.sellerFounder && Math.round(settlement.serviceCommissionRate * 100) === 5
        ? 'Tarifa Fundador (5%)'
        : `Comisión (${Math.round(settlement.serviceCommissionRate * 100)}%)`;
      const netProfit = settlement.netSettlement;
      const partnerShare = Math.round(netProfit * 0.3);

      return {
        id: settlement.orderId,
        type: 'pedido',
        date: settlement.date,
        concept: order?.product ? `Repuesto: ${order.product}` : `Pedido ${settlement.orderId}`,
        sellerOrPack: settlement.seller,
        sellerFounder: settlement.sellerFounder,
        commissionLabel,
        gatewayFee: settlement.gatewayFeeSeller + settlement.gatewayFeeRepuestop,
        iva: settlement.serviceCommissionIva,
        netProfit,
        partnerShare,
        originalSettlement: settlement,
      };
    });

    const publicidadEntries: PartnerIncomeEntry[] = periodPartnerAds.map((ad) => {
      const netProfit = ad.montoNeto;
      const partnerShare = Math.round(netProfit * 0.3);

      return {
        id: ad.codigo,
        type: 'publicidad',
        date: ad.fecha,
        concept: ad.pack ? `Fichas Mural: ${ad.pack} (${ad.cantidadFichas.toLocaleString('es-CL')} fichas)` : `Compra Fichas (${ad.cantidadFichas.toLocaleString('es-CL')})`,
        sellerOrPack: ad.pack || 'Fichas Mural',
        sellerFounder: false,
        commissionLabel: `Comisión Flow (-${formatMoney(ad.comisionPasarela)})`,
        gatewayFee: ad.comisionPasarela,
        iva: 0,
        netProfit,
        partnerShare,
        originalAdvertising: ad,
      };
    });

    return [...pedidosEntries, ...publicidadEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [periodPartnerSettlements, periodPartnerAds, orders]);

  /** Métricas para las 3 tarjetas del tab Ingresos de socios. */
  const partnerIncomeMetrics = useMemo(() => {
    const pedidosEntries = partnerIncomesAll.filter((e) => e.type === 'pedido');
    const publicidadEntries = partnerIncomesAll.filter((e) => e.type === 'publicidad');

    const sum = (items: PartnerIncomeEntry[], pick: (item: PartnerIncomeEntry) => number) =>
      items.reduce((total, item) => total + (pick(item) || 0), 0);

    const pedidosNet = sum(pedidosEntries, (e) => e.netProfit);
    const pedidosShare = sum(pedidosEntries, (e) => e.partnerShare);
    const publicidadNet = sum(publicidadEntries, (e) => e.netProfit);
    const publicidadShare = sum(publicidadEntries, (e) => e.partnerShare);

    const totalNet = pedidosNet + publicidadNet;
    const totalShare = pedidosShare + publicidadShare;

    return {
      totalNet,
      totalShare,
      totalCount: partnerIncomesAll.length,
      pedidosNet,
      pedidosShare,
      pedidosCount: pedidosEntries.length,
      publicidadNet,
      publicidadShare,
      publicidadCount: publicidadEntries.length,
    };
  }, [partnerIncomesAll]);

  /** Entradas filtradas por el filtro rápido de 3 botones (Todos, Pedidos, Publicidad). */
  const filteredPartnerIncomes = useMemo(() => {
    let list = partnerIncomesAll;
    if (partnerIncomeFilter === 'pedidos') {
      list = list.filter((e) => e.type === 'pedido');
    } else if (partnerIncomeFilter === 'publicidad') {
      list = list.filter((e) => e.type === 'publicidad');
    }
    return list;
  }, [partnerIncomesAll, partnerIncomeFilter]);

  // Los filtros de año y mes escriben sobre el mismo rango que ya usa la vista, para
  // que tabla y metricas queden siempre sincronizadas con el periodo elegido. El año
  // se deriva del mes seleccionado, asi no existe combinacion año/mes invalida.
  const selectedIncomeMonth = filters.retiros.start.slice(0, 7);
  const selectedIncomeYear = selectedIncomeMonth.slice(0, 4);
  const incomeMonthsWithSales = useMemo(() => {
    const months = new Set([
      ...settlements.map((settlement) => settlement.date.slice(0, 7)),
      ...(advertising?.compras ?? []).map((ad) => (ad.fecha ?? '').slice(0, 7)),
    ].filter(Boolean));
    if (selectedIncomeMonth) months.add(selectedIncomeMonth);
    // "YYYY-MM" con cero a la izquierda ordena cronologicamente incluso al cambiar de año.
    return [...months].sort((first, second) => second.localeCompare(first));
  }, [advertising?.compras, selectedIncomeMonth, settlements]);
  const incomeYearOptions = useMemo(
    () => [...new Set(incomeMonthsWithSales.map((month) => month.slice(0, 4)))]
      .sort((first, second) => second.localeCompare(first)),
    [incomeMonthsWithSales],
  );
  const incomeMonthOptions = useMemo(
    () => incomeMonthsWithSales.filter((month) => month.startsWith(selectedIncomeYear)),
    [incomeMonthsWithSales, selectedIncomeYear],
  );

  // Filtros de mes y año para la pestaña Caja (sincronizados con filters.gastos)
  const selectedCajaMonth = filters.gastos.start.slice(0, 7);
  const selectedCajaYear = selectedCajaMonth.slice(0, 4);
  const cajaMonthsWithSales = useMemo(() => {
    const months = new Set([
      ...settlements.map((settlement) => settlement.date.slice(0, 7)),
      ...(advertising?.compras ?? []).map((ad) => (ad.fecha ?? '').slice(0, 7)),
    ].filter(Boolean));
    if (selectedCajaMonth) months.add(selectedCajaMonth);
    return [...months].sort((first, second) => second.localeCompare(first));
  }, [advertising?.compras, selectedCajaMonth, settlements]);
  const cajaYearOptions = useMemo(
    () => [...new Set(cajaMonthsWithSales.map((month) => month.slice(0, 4)))]
      .sort((first, second) => second.localeCompare(first)),
    [cajaMonthsWithSales],
  );
  const cajaMonthOptions = useMemo(
    () => cajaMonthsWithSales.filter((month) => month.startsWith(selectedCajaYear)),
    [cajaMonthsWithSales, selectedCajaYear],
  );

  // Pedidos usa exactamente el mismo par de selectores mes/año de Caja y gastos.
  // El período se guarda en filters.pedidos para que métricas y tabla compartan el filtro.
  const selectedOrderMonth = filters.pedidos.start.slice(0, 7);
  const selectedOrderYear = selectedOrderMonth.slice(0, 4);
  const orderMonthsWithSales = useMemo(() => {
    const months = new Set(orders.map((order) => orderDate(order).slice(0, 7)).filter(Boolean));
    if (selectedOrderMonth) months.add(selectedOrderMonth);
    return [...months].sort((first, second) => second.localeCompare(first));
  }, [orders, selectedOrderMonth]);
  const orderYearOptions = useMemo(
    () => [...new Set(orderMonthsWithSales.map((month) => month.slice(0, 4)))]
      .sort((first, second) => second.localeCompare(first)),
    [orderMonthsWithSales],
  );
  const orderMonthOptions = useMemo(
    () => orderMonthsWithSales.filter((month) => month.startsWith(selectedOrderYear)),
    [orderMonthsWithSales, selectedOrderYear],
  );

  function pushActivity(iconName: string, title: string, description: string): void {
    setActivityLogs((current) => [{ id: createId(), iconName, title, description, time: 'Ahora' }, ...current]);
  }

  function updateFilter(view: AdminView, next: Partial<DateFilter>): void {
    setFilters((current) => ({ ...current, [view]: { ...current[view], ...next } }));
    if (view !== 'resumen') {
      setPagination((current) => ({ ...current, [view]: { ...current[view], page: 1 } }));
    }
  }

  function toggleSelection(view: SelectableView, id: string): void {
    setSelectedRows((current) => {
      const nextSet = new Set(current[view]);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return { ...current, [view]: nextSet };
    });
  }

  function toggleMassSelection(view: SelectableView, ids: string[]): void {
    setSelectedRows((current) => {
      const nextSet = new Set(current[view]);
      const allSelected = ids.length > 0 && ids.every((id) => nextSet.has(id));
      ids.forEach((id) => {
        if (allSelected) nextSet.delete(id);
        else nextSet.add(id);
      });
      return { ...current, [view]: nextSet };
    });
  }

  function updatePage(view: PageView, direction: 'prev' | 'next'): void {
    setPagination((current) => {
      const totalByView: Record<PageView, number> = {
        pedidos: filteredOrders.length,
        liquidaciones: filteredSettlements.length,
        gastos: filteredExpenses.length,
        retiros: filteredWithdrawals.length,
        ingresos: filteredPartnerIncomes.length,
        caja: filteredCajaEntries.length,
      };
      const state = current[view];
      const totalPages = Math.max(1, Math.ceil((totalByView[view] ?? 0) / state.pageSize));
      const page = direction === 'prev' ? Math.max(1, state.page - 1) : Math.min(totalPages, state.page + 1);
      return { ...current, [view]: { ...state, page } };
    });
  }

  function updatePageSize(view: PageView, pageSize: number): void {
    setPagination((current) => ({ ...current, [view]: { page: 1, pageSize } }));
  }

  function selectIncomeMonth(month: string): void {
    updateFilter('retiros', getMonthRange(month));
    setPagination((current) => ({ ...current, ingresos: { ...current.ingresos, page: 1 } }));
  }

  function selectIncomeYear(year: string): void {
    // incomeMonthsWithSales viene ordenado desc, asi que el primero del año elegido
    // es su mes con ventas mas reciente. Si ese año no tiene ventas, cae a enero.
    const latestMonth = incomeMonthsWithSales.find((month) => month.startsWith(year));
    selectIncomeMonth(latestMonth ?? `${year}-01`);
  }

  function selectCajaMonth(month: string): void {
    updateFilter('gastos', getMonthRange(month));
    setPagination((current) => ({ ...current, caja: { ...current.caja, page: 1 } }));
  }

  function selectCajaYear(year: string): void {
    const latestMonth = cajaMonthsWithSales.find((month) => month.startsWith(year));
    selectCajaMonth(latestMonth ?? `${year}-01`);
  }

  function selectOrderMonth(month: string): void {
    updateFilter('pedidos', getMonthRange(month));
  }

  function selectOrderYear(year: string): void {
    const latestMonth = orderMonthsWithSales.find((month) => month.startsWith(year));
    selectOrderMonth(latestMonth ?? `${year}-01`);
  }



  function openExpense(expense?: Expense): void {
    setExpenseDraft(expense
      ? {
          id: expense.id,
          date: expense.date,
          category: expense.category,
          description: expense.description,
          amount: String(expense.amount),
          receipt: expense.receipt ?? '',
          receiptUrl: expense.receiptUrl ?? '',
          receiptType: expense.receiptType ?? '',
        }
      : emptyExpenseDraft());
  }

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    const validation = validateReceipt(file);
    if (validation) {
      window.alert(validation);
      event.target.value = '';
      return;
    }
    if (file) {
      setExpenseDraft((current) => current ? { ...current, receipt: file.name, receiptType: file.type } : current);
    }
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!expenseDraft) return;
    const file = receiptInputRef.current?.files?.[0];
    const validation = validateReceipt(file);
    const amount = Number(expenseDraft.amount);
    if (validation) {
      window.alert(validation);
      return;
    }
    if (!expenseDraft.date || !expenseDraft.category || !expenseDraft.description.trim() || !amount || amount <= 0) {
      window.alert('Completa fecha, categoría, descripción y un monto mayor a cero.');
      return;
    }

    const exists = Boolean(expenseDraft.id);
    const requestPayload = {
      date: expenseDraft.date,
      category: expenseDraft.category,
      description: expenseDraft.description.trim(),
      amount,
      eliminarReceipt: false,
    };

    try {
      const saved = exists
        ? await administrationApi.updateExpense(expenseDraft.id, requestPayload, file)
        : await administrationApi.createExpense(requestPayload, file);
      setExpenses((current) => exists ? current.map((expense) => (expense.id === saved.id ? saved : expense)) : [saved, ...current]);
      pushActivity('wallet', exists ? 'Gasto actualizado' : 'Gasto registrado', `${saved.category} - ${saved.description}`);
      setExpenseDraft(null);
    } catch (err) {
      window.alert('No se pudo guardar el gasto: ' + (err instanceof Error ? err.message : 'Error desconocido.'));
    }
  }

  function saveOrder(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!orderDraft) return;
    const total = Number(orderDraft.total);
    if (!orderDraft.id.trim() || !orderDraft.date || !orderDraft.buyer.trim() || !orderDraft.seller.trim() || !orderDraft.product.trim() || !total || total <= 0) {
      window.alert('Completa todos los campos del pedido con un total mayor a cero.');
      return;
    }
    if (orders.some((order) => order.id === orderDraft.id.trim())) {
      window.alert('Ya existe un pedido con ese ID. No se crearán duplicados.');
      return;
    }
    const nextOrder: Order = {
      id: orderDraft.id.trim(),
      date: orderDraft.date,
      buyer: orderDraft.buyer.trim(),
      seller: orderDraft.seller.trim(),
      product: orderDraft.product.trim(),
      total,
      status: orderDraft.status,
      updatedAt: orderDraft.date,
    };
    setOrders((current) => [nextOrder, ...current]);
    setStatusHistory((current) => ({
      ...current,
      [nextOrder.id]: [{
        from: '',
        to: nextOrder.status,
        changedAt: nextOrder.updatedAt,
        actor: 'Administrador',
        source: 'Registro manual',
        note: 'Estado inicial registrado al crear el pedido.',
      }],
    }));
    pushActivity('wallet', 'Pedido registrado', `Pedido ${nextOrder.id} agregado manualmente`);
    setOrderDraft(null);
    navigate('/administracion/pedidos');
  }

  function openDocument(order: Order, isEditing = false): void {
    const existing = issuedDocuments[order.id];
    if (existing && isIssuedDocumentComplete(existing) && !isEditing) {
      setRegisteredDocumentPreview({ orderId: order.id, document: existing });
      return;
    }
    setDocumentDraft({
      orderId: order.id,
      orderIds: [order.id],
      retiroId: findActiveWithdrawalId(order.seller, order.sellerTaxId, order.sellerEmail),
      isEditing: Boolean(existing),
      type: existing?.type ?? 'Boleta',
      rut: existing?.rut ?? order.sellerTaxId ?? '',
      name: existing?.name ?? order.sellerLegalName ?? order.seller,
      email: existing?.email ?? order.sellerEmail ?? '',
      detail: existing?.detail ?? `Comisión de servicio RepuesTop del pedido ${order.id}`,
      ivaLiquidado: existing?.ivaLiquidado ?? String(order.ivaComisionServicio ?? 0),
      pdfName: existing?.pdfName ?? '',
      pdfUrl: existing?.pdfUrl,
      originalPdfName: existing?.pdfName,
    });
  }

  function getGroupDocument(group: LiquidationSellerGroup): RegisteredDocumentPreview | null {
    for (const settlement of group.settlements) {
      const document = issuedDocuments[settlement.orderId];
      if (document) return { orderId: settlement.orderId, document };
    }
    const withdrawal = activeWithdrawals.find((candidate) => candidate.retiroId === group.retiroId);
    if (withdrawal && (
      withdrawal.documentoLiquidacionNombre
      || withdrawal.documentoLiquidacionTipo
      || withdrawal.documentoLiquidacionRut
      || withdrawal.documentoLiquidacionRazonSocial
      || withdrawal.documentoLiquidacionEmail
      || withdrawal.documentoLiquidacionDetalle
      || withdrawal.documentoLiquidacionIva != null
    )) {
      return {
        orderId: group.settlements[0]?.orderId ?? '',
        document: {
          type: withdrawal.documentoLiquidacionTipo ?? '',
          rut: withdrawal.documentoLiquidacionRut ?? '',
          name: withdrawal.documentoLiquidacionRazonSocial ?? '',
          email: withdrawal.documentoLiquidacionEmail ?? '',
          detail: withdrawal.documentoLiquidacionDetalle ?? '',
          ivaLiquidado: withdrawal.documentoLiquidacionIva != null ? String(withdrawal.documentoLiquidacionIva) : '',
          sentAt: withdrawal.fecha,
          pdfName: withdrawal.documentoLiquidacionNombre,
        },
      };
    }
    return null;
  }

  async function openGroupDocument(group: LiquidationSellerGroup, isEditing = false): Promise<void> {
    const orderId = group.settlements[0]?.orderId ?? '';
    const existing = getGroupDocument(group)?.document;
    if (existing && isIssuedDocumentComplete(existing) && !isEditing) {
      let document = existing;
      if (!document.pdfUrl && group.retiroId !== null) {
        try {
          document = { ...document, pdfUrl: await administrationApi.getLiquidationDocumentFile(group.retiroId) };
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'No se pudo cargar el PDF registrado.');
        }
      }
      setRegisteredDocumentPreview({ orderId, document });
      return;
    }
    setDocumentDraft({
      orderId,
      orderIds: group.settlements.map((settlement) => settlement.orderId),
      retiroId: group.retiroId,
      isEditing: Boolean(existing),
      type: existing?.type ?? 'Boleta',
      rut: existing?.rut ?? (group.rut === 'Sin RUT' ? '' : group.rut),
      name: existing?.name ?? group.legalName,
      email: existing?.email ?? (group.email === 'Sin correo' ? '' : group.email),
      detail: existing?.detail ?? `Comisión de servicio RepuesTop de ${group.settlements.length} liquidación${group.settlements.length === 1 ? '' : 'es'}`,
      ivaLiquidado: existing?.ivaLiquidado ?? String(Math.round(group.iva)),
      pdfName: existing?.pdfName ?? '',
      pdfUrl: existing?.pdfUrl,
      originalPdfName: existing?.pdfName,
    });
  }

  async function openPartnerWithdrawalDocument(withdrawal: Withdrawal, isEditing = false): Promise<void> {
    const socio = socioPorNombre(withdrawal.beneficiary);
    const existingDoc: IssuedDocument | null = (withdrawal.documentoLiquidacionNombre || withdrawal.documentoLiquidacionRut) ? {
      type: withdrawal.documentoLiquidacionTipo ?? 'Boleta de Honorarios',
      rut: withdrawal.documentoLiquidacionRut ?? socio?.rut ?? '',
      name: withdrawal.documentoLiquidacionRazonSocial ?? socio?.titular ?? withdrawal.beneficiary,
      email: withdrawal.documentoLiquidacionEmail ?? socio?.email ?? withdrawal.email ?? '',
      detail: withdrawal.documentoLiquidacionDetalle ?? `Retiro de libre disposición socio - ${withdrawal.beneficiary}`,
      ivaLiquidado: withdrawal.documentoLiquidacionIva != null ? String(withdrawal.documentoLiquidacionIva) : '0',
      sentAt: withdrawal.date,
      pdfName: withdrawal.documentoLiquidacionNombre ?? '',
    } : null;

    if (existingDoc && isIssuedDocumentComplete(existingDoc) && !isEditing) {
      let document = existingDoc;
      if (!document.pdfUrl && withdrawal.id) {
        try {
          document = { ...document, pdfUrl: await administrationApi.getLiquidationDocumentFile(Number(withdrawal.id)) };
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'No se pudo cargar el PDF registrado.');
        }
      }
      setRegisteredDocumentPreview({ orderId: withdrawal.codigoRetiro || `SOCIO-${withdrawal.id}`, document });
      return;
    }

    setDocumentDraft({
      orderId: withdrawal.codigoRetiro || `SOCIO-${withdrawal.id}`,
      orderIds: [withdrawal.codigoRetiro || `SOCIO-${withdrawal.id}`],
      retiroId: Number(withdrawal.id),
      isEditing: Boolean(existingDoc),
      type: existingDoc?.type ?? 'Boleta de Honorarios',
      rut: existingDoc?.rut ?? (socio?.rut ?? ''),
      name: existingDoc?.name ?? (socio?.titular ?? withdrawal.beneficiary),
      email: existingDoc?.email ?? (socio?.email ?? withdrawal.email ?? ''),
      detail: existingDoc?.detail ?? `Retiro de libre disposición socio - ${withdrawal.beneficiary}`,
      ivaLiquidado: existingDoc?.ivaLiquidado ?? '0',
      pdfName: existingDoc?.pdfName ?? '',
      pdfUrl: undefined,
      originalPdfName: existingDoc?.pdfName,
    });
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!documentDraft) return;
    const hasRequiredData = documentDraft.rut.trim()
      && documentDraft.name.trim()
      && documentDraft.email.trim()
      && documentDraft.detail.trim()
      && documentDraft.ivaLiquidado.trim()
      && documentDraft.pdfName?.trim();
    if (!documentDraft.orderId || (!documentDraft.isEditing && !hasRequiredData)) {
      window.alert('Completa los datos y adjunta el nombre del archivo de la boleta o factura.');
      return;
    }
    if (documentDraft.retiroId === null) {
      window.alert('No se encontró una solicitud de retiro activa para este registro. Actualiza la página y verifica que el retiro siga activo.');
      return;
    }
    try {
      await administrationApi.saveLiquidationDocument({
        retiroId: documentDraft.retiroId,
        tipoDocumento: documentDraft.type.trim(),
        rut: documentDraft.rut.trim(),
        razonSocial: documentDraft.name.trim(),
        email: documentDraft.email.trim(),
        detalle: documentDraft.detail.trim(),
        ivaLiquidado: documentDraft.ivaLiquidado.trim() ? Number(documentDraft.ivaLiquidado) : null,
        eliminarDocumento: Boolean(documentDraft.originalPdfName && !documentDraft.pdfName),
      }, documentDraft.pdfFile);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo registrar la boleta o factura.');
      return;
    }
    const savedDocument: IssuedDocument = {
      type: documentDraft.type,
      rut: documentDraft.rut.trim(),
      name: documentDraft.name.trim(),
      email: documentDraft.email.trim(),
      detail: documentDraft.detail.trim(),
      ivaLiquidado: documentDraft.ivaLiquidado,
      sentAt: 'Ahora',
      pdfName: documentDraft.pdfName,
      pdfUrl: documentDraft.pdfUrl,
    };
    setIssuedDocuments((current) => documentDraft.orderIds.reduce(
      (next, orderId) => ({ ...next, [orderId]: savedDocument }),
      current,
    ));
    setWithdrawals((current) => current.map((w) => {
      if (Number(w.id) === documentDraft.retiroId) {
        return {
          ...w,
          documentoLiquidacionNombre: documentDraft.pdfName,
          documentoLiquidacionTipo: documentDraft.type.trim(),
          documentoLiquidacionRut: documentDraft.rut.trim(),
          documentoLiquidacionRazonSocial: documentDraft.name.trim(),
          documentoLiquidacionEmail: documentDraft.email.trim(),
          documentoLiquidacionDetalle: documentDraft.detail.trim(),
          documentoLiquidacionIva: documentDraft.ivaLiquidado.trim() ? Number(documentDraft.ivaLiquidado) : 0,
          documentoLiquidacionCompleto: Boolean(
            documentDraft.rut.trim() &&
            documentDraft.name.trim() &&
            documentDraft.email.trim() &&
            documentDraft.detail.trim() &&
            documentDraft.pdfName?.trim()
          ),
        };
      }
      return w;
    }));
    pushActivity('receipt', `${documentDraft.type} ${documentDraft.isEditing ? 'actualizada' : 'registrada'}`, `Documento ${documentDraft.orderId} enviado a ${documentDraft.email.trim()}`);
    setDocumentDraft(null);
  }

  async function previewPaidDocument(retiroId: number, fileName?: string): Promise<void> {
    if (!fileName) return;
    try {
      const fileUrl = await administrationApi.getLiquidationDocumentFile(retiroId);
      setPaidDocumentPreview({ fileName, fileUrl });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo cargar el PDF registrado.');
    }
  }

  function closePaidDocumentPreview(): void {
    if (paidDocumentPreview?.fileUrl.startsWith('blob:')) {
      URL.revokeObjectURL(paidDocumentPreview.fileUrl);
    }
    setPaidDocumentPreview(null);
  }


  function showOrderDetail(order: Order): void {
    setSelectedDetailOrder(order);
  }

  function showOrderHistory(orderId: string): void {
    setSelectedHistoryOrderId(orderId);
  }

  function showSettlementDetail(settlement: Settlement): void {
    setSelectedDetailSettlement(settlement);
  }

  function showWithdrawalDetail(withdrawal: Withdrawal): void {
    const partnerPool = partnerIncomeMetrics.totalShare;
    const balances = getPartnerBalances(withdrawals, partnerPool, filters.retiros.start, filters.retiros.end);
    window.alert([
      `Detalle retiro ${formatDate(withdrawal.date)}`,
      `Socio: ${withdrawal.beneficiary}`,
      `Motivo: ${withdrawal.reason}`,
      `Monto retirado: ${formatMoney(withdrawal.amount)}`,
      `Saldo anterior: ${formatMoney(withdrawal.balanceBefore)}`,
      `Saldo actual del socio: ${formatMoney(balances[withdrawal.beneficiary] ?? withdrawal.balanceAfter)}`,
    ].join('\n'));
  }

  function socioPorNombre(nombre: string): Socio | undefined {
    return socios.find((socio) => socio.nombre.toLowerCase() === nombre.toLowerCase());
  }

  /** BO-SOCIOS-001: un socio no puede solicitar un retiro nuevo si ya tiene uno pendiente. */
  function tieneRetiroEnCurso(partner: string): boolean {
    return withdrawals.some((w) => w.beneficiary === partner && (w.estado ?? 'PENDIENTE') === 'PENDIENTE');
  }

  /**
   * BO-SOCIOS-001: cada motivo precarga un monto distinto.
   * - Mensual: lo acumulado del socio en el periodo filtrado.
   * - Acumulado: todo su saldo historico.
   * - Parcial: vacio, lo escribe el socio.
   */
  function montoSugeridoPorMotivo(partner: string, reason: string): string {
    if (reason === WITHDRAWAL_REASON_MONTHLY) {
      return String(Math.max(0, Math.round(withdrawalPartnerBalances[partner] ?? 0)));
    }
    if (reason === WITHDRAWAL_REASON_ACCUMULATED) {
      return String(Math.max(0, Math.round(allTimePartnerBalances[partner] ?? 0)));
    }
    return '';
  }

  /** Tope real que el socio puede retirar segun el motivo elegido. */
  function saldoDisponible(partner: string, reason: string): number {
    const balance = reason === WITHDRAWAL_REASON_ACCUMULATED
      ? allTimePartnerBalances[partner] ?? 0
      : withdrawalPartnerBalances[partner] ?? 0;
    return Math.max(0, Math.round(balance));
  }

  function openWithdrawal(): void {
    const partner = PARTNERS[0] ?? '';
    const reason = WITHDRAWAL_REASON_MONTHLY;
    setWithdrawalError('');
    setWithdrawalDraft({
      date: filters.retiros.end || TODAY,
      beneficiary: partner,
      reason,
      amount: montoSugeridoPorMotivo(partner, reason),
    });
  }

  function updateWithdrawalDraft(next: Partial<WithdrawalDraft>): void {
    setWithdrawalError('');
    setWithdrawalDraft((current) => {
      if (!current) return current;
      const merged = { ...current, ...next };
      // Al cambiar de socio o de motivo se recalcula el monto sugerido, salvo en
      // "parcial" donde el monto siempre lo escribe el socio.
      if (next.beneficiary !== undefined || next.reason !== undefined) {
        merged.amount = montoSugeridoPorMotivo(merged.beneficiary, merged.reason);
      }
      return merged;
    });
  }

  function openSocioBanco(partner: string): void {
    const socio = socioPorNombre(partner);
    setSocioBancoError('');
    setSocioBancoDraft({
      nombre: partner,
      rut: socio?.rut ?? '',
      banco: socio?.banco ?? '',
      bankCode: socio?.bankCode ?? null,
      tipoCuenta: socio?.tipoCuenta ?? TIPO_CUENTA_OPTIONS[0],
      numeroCuenta: socio?.numeroCuenta ?? '',
      titular: socio?.titular ?? partner,
      email: socio?.email ?? '',
    });
  }

  async function saveSocioBanco(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!socioBancoDraft) return;
    if (!socioBancoDraft.rut.trim() || !socioBancoDraft.banco.trim() || !socioBancoDraft.numeroCuenta.trim()) {
      setSocioBancoError('RUT, banco y número de cuenta son obligatorios para poder pagar por la nómina BCI.');
      return;
    }
    try {
      await administrationApi.saveSocio(socioBancoDraft.nombre, {
        rut: socioBancoDraft.rut.trim(),
        banco: socioBancoDraft.banco.trim(),
        bankCode: socioBancoDraft.bankCode,
        tipoCuenta: socioBancoDraft.tipoCuenta,
        numeroCuenta: socioBancoDraft.numeroCuenta.trim(),
        titular: socioBancoDraft.titular.trim() || socioBancoDraft.nombre,
        email: socioBancoDraft.email.trim(),
      });
      await refetchSocios();
      pushActivity('wallet', 'Datos bancarios actualizados', `Cuenta de ${socioBancoDraft.nombre} guardada`);
      setSocioBancoDraft(null);
    } catch (err) {
      setSocioBancoError('No se pudieron guardar los datos bancarios: ' + (err instanceof Error ? err.message : 'error desconocido.'));
    }
  }

  async function saveWithdrawal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!withdrawalDraft) return;
    const amount = Number(withdrawalDraft.amount);
    if (!withdrawalDraft.date || !withdrawalDraft.beneficiary || !withdrawalDraft.reason) {
      setWithdrawalError('Completa fecha, socio y motivo.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawalError('El monto debe ser mayor a cero.');
      return;
    }

    // BO-SOCIOS-001: sin datos bancarios el retiro no puede pagarse por la nomina BCI.
    const socio = socioPorNombre(withdrawalDraft.beneficiary);
    if (!socio?.tieneDatosBancarios) {
      setWithdrawalError(`${withdrawalDraft.beneficiary} no tiene datos bancarios registrados. Regístralos desde su tarjeta antes de retirar.`);
      return;
    }

    // BO-SOCIOS-001: no se puede solicitar un retiro nuevo mientras haya uno sin pagar.
    if (tieneRetiroEnCurso(withdrawalDraft.beneficiary)) {
      setWithdrawalError(`${withdrawalDraft.beneficiary} ya tiene una solicitud de retiro en curso. Debe esperar a que se procese antes de solicitar otra.`);
      return;
    }

    // Tope duro: un socio nunca puede retirar mas de su saldo disponible.
    const disponible = saldoDisponible(withdrawalDraft.beneficiary, withdrawalDraft.reason);
    if (amount > disponible) {
      setWithdrawalError(
        `Fondos insuficientes: ${withdrawalDraft.beneficiary} tiene ${formatMoney(disponible)} disponibles y se intenta retirar ${formatMoney(amount)}.`,
      );
      return;
    }

    const requestPayload = {
      period: withdrawalDraft.date.slice(0, 7),
      date: withdrawalDraft.date,
      beneficiary: withdrawalDraft.beneficiary,
      reason: withdrawalDraft.reason,
      amount,
      balanceBefore: disponible,
      balanceAfter: disponible - amount,
    };

    try {
      const saved = await administrationApi.createPartnerWithdrawal(requestPayload);
      setWithdrawals((current) => [saved, ...current]);
      setPagination((current) => ({ ...current, retiros: { ...current.retiros, page: 1 } }));
      pushActivity('wallet', 'Retiro registrado', `${saved.beneficiary} retiró ${formatMoney(saved.amount)}`);
      setWithdrawalDraft(null);
      setWithdrawalError('');
    } catch (err) {
      // El backend revalida el tope; su mensaje es el que manda.
      const apiMessage = isAxiosError(err) && typeof err.response?.data?.message === 'string'
        ? err.response.data.message
        : err instanceof Error ? err.message : 'Error desconocido.';
      setWithdrawalError('No se pudo registrar el retiro: ' + apiMessage);
    }
  }

  async function deleteExpense(expenseId: string): Promise<void> {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
    try {
      await administrationApi.deleteExpense(expenseId);
      setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
      setSelectedRows((current) => {
        const next = new Set(current.gastos);
        next.delete(expenseId);
        return { ...current, gastos: next };
      });
      pushActivity('wallet', 'Gasto eliminado', 'Se eliminó un gasto registrado');
    } catch (err) {
      window.alert('No se pudo eliminar el gasto: ' + (err instanceof Error ? err.message : 'Error desconocido.'));
    }
  }


  function exportExpensesCsv(): void {
    const header = ['Fecha', 'Categoría', 'Descripción', 'Monto', 'Comprobante'];
    const rows = filteredExpenses.map((expense) => [
      formatDate(expense.date),
      expense.category,
      expense.description,
      Number(expense.amount || 0),
      expense.receipt || 'Sin archivo',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    downloadFile(`gastos-repuestop-${filters.gastos.start}-${filters.gastos.end}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  }

  function includeImportedDates(importedDates: string[]): void {
    const dates = importedDates.filter(Boolean);
    if (!dates.length) return;
    setFilters((current) => {
      const next = { ...current };
      (['pedidos', 'liquidaciones', 'gastos'] as const).forEach((view) => {
        const existing = next[view];
        next[view] = {
          ...existing,
          start: existing.start && existing.start < dates.reduce((min, value) => value < min ? value : min, dates[0] ?? existing.start) ? existing.start : dates.reduce((min, value) => value < min ? value : min, dates[0] ?? existing.start),
          end: existing.end && existing.end > dates.reduce((max, value) => value > max ? value : max, dates[0] ?? existing.end) ? existing.end : dates.reduce((max, value) => value > max ? value : max, dates[0] ?? existing.end),
        };
      });
      return next;
    });
  }

  function importCsvFile(file: File, content: string): void {
    const rows = parseCsv(content);
    if (rows.length < 2) {
      window.alert('El archivo CSV no contiene registros procesables.');
      return;
    }
    const [rawHeaders = [], ...records] = rows;
    const headers = rawHeaders.map(normalizeHeader);
    const required = ['order_id', 'date', 'buyer_name', 'seller_name', 'product_summary', 'total_amount', 'status', 'updated_at'];
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length) {
      window.alert(`El archivo no tiene las columnas requeridas: ${missing.join(', ')}`);
      return;
    }

    let imported = 0;
    let updated = 0;
    let errors = 0;
    const importedDates: string[] = [];
    const nextHistory: Record<string, StatusHistoryItem[]> = { ...statusHistory };
    const nextOrders = [...orders];

    records.forEach((row) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
      const id = String(record.order_id ?? '').trim();
      const date = normalizeCsvDate(String(record.date ?? ''));
      const updatedAt = normalizeCsvDate(String(record.updated_at ?? '')) || date;
      const total = Number(String(record.total_amount ?? '').replace(/\./g, '').replace(',', '.'));
      const status = String(record.status ?? '').trim() as OrderStatus;
      const isStatusValid = ORDER_STATUS_OPTIONS.includes(status);

      if (!id || !date || !record.buyer_name || !record.seller_name || !record.product_summary || !total || !isStatusValid || !updatedAt) {
        errors += 1;
        return;
      }

      const nextOrder: Order = {
        id,
        date,
        buyer: String(record.buyer_name).trim(),
        seller: String(record.seller_name).trim(),
        product: String(record.product_summary).trim(),
        total,
        status,
        updatedAt,
      };
      importedDates.push(orderDate(nextOrder));
      const existingIndex = nextOrders.findIndex((order) => order.id === id);

      if (existingIndex >= 0) {
        const current = nextOrders[existingIndex];
        if (!current) return;
        if (nextOrder.updatedAt >= current.updatedAt) {
          nextOrders[existingIndex] = nextOrder;
          if (current.status !== nextOrder.status) {
            nextHistory[id] = [
              ...(nextHistory[id] ?? []),
              {
                from: current.status,
                to: nextOrder.status,
                changedAt: updatedAt,
                actor: 'Sistema',
                source: `Importación CSV: ${file.name}`,
                note: 'Estado actualizado desde archivo importado.',
              },
            ];
          }
          updated += 1;
        }
        return;
      }

      nextOrders.unshift(nextOrder);
      nextHistory[id] = [{
        from: '',
        to: nextOrder.status,
        changedAt: updatedAt,
        actor: 'Sistema',
        source: `Importación CSV: ${file.name}`,
        note: 'Estado registrado al importar el pedido.',
      }];
      imported += 1;
    });

    const importRecord: ImportRecord = {
      id: createId(),
      fileName: file.name,
      importedAt: formatDateTime(`${TODAY}T09:00`),
      processed: records.length,
      imported,
      updated,
      errors,
      status: errors ? 'Completada con errores' : 'Completada',
    };

    setOrders(nextOrders);
    setStatusHistory(nextHistory);
    setImports((current) => [importRecord, ...current]);
    includeImportedDates(importedDates);
    pushActivity('upload', 'Importación de pedidos desde CSV', `Archivo: ${file.name} (${imported} nuevos, ${updated} actualizados, ${errors} con error)`);
    window.alert(`Importación finalizada\nProcesados: ${importRecord.processed}\nImportados: ${imported}\nActualizados: ${updated}\nCon error: ${errors}`);
  }

  function handleOrderImport(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(extension ?? '')) {
      window.alert('El archivo debe ser CSV, XLS o XLSX.');
      return;
    }
    if (extension !== 'csv') {
      window.alert('La importación Excel queda preparada para backend. En este MVP local, sube un CSV con las columnas definidas.');
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => importCsvFile(file, String(reader.result || '')));
    reader.addEventListener('error', () => window.alert('No se pudo leer el archivo.'));
    reader.readAsText(file, 'UTF-8');
  }

  const selectedOrderRows = selectMetricRows(filteredOrders, selectedRows.pedidos, (order) => order.id);
  const selectedSettlementRows = selectMetricRows(filteredSettlements, selectedRows.liquidaciones, (settlement) => settlement.id);
  const selectedExpenseRows = selectMetricRows(filteredExpenses, selectedRows.gastos, (expense) => expense.id);
  const orderPage = getPage(filteredOrders, pagination.pedidos);
  const settlementPage = getPage(filteredSettlements, pagination.liquidaciones);
  const expensePage = getPage(filteredExpenses, pagination.gastos);
  const cajaPage = getPage(filteredCajaEntries, pagination.caja);
  const withdrawalPage = getPage(filteredWithdrawals, pagination.retiros);
  const partnerIncomePage = getPage(filteredPartnerIncomes, pagination.ingresos);

  function exportCajaCsv(): void {
    const rows = [
      ['Tipo', 'Código', 'Fecha', 'Concepto', 'Comprador', 'Vendedor / Pack', 'Venta Total', 'Comisión / Retención', 'Ganancia Neta RepuesTop', 'Aporte Caja 70% (Sueldos y Operación)'],
      ...filteredCajaEntries.map((entry) => [
        entry.type === 'pedido' ? 'Pedido Repuesto' : 'Publicidad Fichas',
        entry.id,
        formatDateTimeLocal(entry.date),
        entry.concept,
        entry.buyer,
        entry.sellerOrPack,
        entry.totalSale,
        entry.commissionOrDeduction,
        entry.netProfit,
        entry.cashAmount,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    downloadFile(`caja-repuestop-${filters.gastos.start}-${filters.gastos.end}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  }
  // La ganancia neta del backend ya viene con la comisión de pasarela absorbida por
  // RepuesTop descontada y sin el IVA de la comisión (que se entera al SII).
  // Para los socios corresponde el 30% del total convergente (pedidos y publicidad).
  const partnerIncomeShare = partnerIncomeMetrics.totalShare;
  const summarySettlements = getSettlements(summaryOrders, settlementStatuses);
  const summaryExpenses = expenses
    .filter((expense) => isWithinRange(expense.date, filters.resumen.start, filters.resumen.end))
    .sort((first, second) => second.date.localeCompare(first.date));
  const completedSummaryOrders = summaryOrders.filter((order) => order.status === 'Recibido');
  const cancelledSummaryOrders = summaryOrders.filter((order) => order.status === 'Finalizado');
  const pendingSummaryOrders = summaryOrders.filter((order) => !['Recibido', 'Finalizado'].includes(order.status));
  const totalCollected = summaryOrders.reduce((sum, order) => sum + order.total, 0);
  const summaryCommission = summarySettlements.reduce((sum, settlement) => sum + settlement.commission, 0);
  const { cashFund: summaryCashFund, withdrawalAvailable: summaryWithdrawalAvailable } = getCashAllocation(summaryCommission);
  const summaryExpenseTotal = getExpenseTotal(summaryExpenses);
  const summaryCashAvailable = summaryCashFund - summaryExpenseTotal;
  const summaryPartnerWithdrawn = withdrawals
    .filter((withdrawal) => withdrawal.type === 'partner' && isWithinRange(withdrawal.date, filters.resumen.start, filters.resumen.end))
    .reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  const summaryPartnerAvailable = summaryWithdrawalAvailable - summaryPartnerWithdrawn;
  const summaryPartnerBalances = getPartnerBalances(withdrawals, summaryWithdrawalAvailable, filters.resumen.start, filters.resumen.end);
  const summaryPartnerRows = PARTNERS
    .map((partner) => ({ partner, balance: summaryPartnerBalances[partner] ?? 0 }))
    .sort((first, second) => second.balance - first.balance);
  const lowestPartner = summaryPartnerRows[summaryPartnerRows.length - 1] ?? { partner: 'Sin datos', balance: 0 };
  const topSeller = [...summaryOrders.reduce((acc, order) => {
    const current = acc.get(order.seller) ?? { seller: order.seller, sellerFounder: order.sellerFounder, total: 0, count: 0 };
    current.total += order.total;
    current.count += 1;
    acc.set(order.seller, current);
    return acc;
  }, new Map<string, { seller: string; sellerFounder?: boolean; total: number; count: number }>()).values()]
    .sort((first, second) => second.total - first.total)[0] ?? { seller: 'Sin ventas', total: 0, count: 0 };
  const avgTicket = summaryOrders.length ? Math.round(totalCollected / summaryOrders.length) : 0;
  const completionRate = getPercent(completedSummaryOrders.length, summaryOrders.length);
  const commissionRate = getPercent(summaryCommission, totalCollected);
  const flowMax = Math.max(summaryCashFund, summaryExpenseTotal, summaryWithdrawalAvailable, summaryPartnerWithdrawn, Math.abs(summaryCashAvailable), 1);
  const cashCoverage = summaryExpenseTotal ? getPercent(summaryCashFund, summaryExpenseTotal) : summaryCashFund ? 100 : 0;
  const healthScore = Math.max(0, Math.min(100, Math.round((completionRate * 0.45) + (Math.min(cashCoverage, 100) * 0.35) + ((pendingSummaryOrders.length ? 55 : 100) * 0.2))));
  const healthTone = summaryCashAvailable < 0 ? 'red' : pendingSummaryOrders.length ? 'orange' : 'green';
  const healthLabel = summaryCashAvailable < 0 ? 'Caja bajo presión' : pendingSummaryOrders.length ? 'Periodo activo' : 'Periodo sano';
  const statusRows = ORDER_STATUS_OPTIONS
    .map((status) => ({ status, count: summaryOrders.filter((order) => order.status === status).length }))
    .filter((row) => row.count > 0);
  const focusItems = [
    summaryCashAvailable < 0
      ? { title: 'Recuperar caja operacional', detail: `Faltan ${formatMoney(Math.abs(summaryCashAvailable))} para cubrir gastos del periodo.` }
      : { title: 'Caja operativa protegida', detail: `Quedan ${formatMoney(summaryCashAvailable)} disponibles después de gastos.` },
    pendingSummaryOrders.length
      ? { title: 'Cerrar pedidos pendientes', detail: `${pendingSummaryOrders.length} pedidos siguen abiertos y pueden liberar comisión.` }
      : { title: 'Pedidos del periodo cerrados', detail: 'No hay pedidos operativos pendientes en este rango.' },
    lowestPartner.balance < 0
      ? { title: 'Regularizar saldo de socios', detail: `${lowestPartner.partner} presenta ${formatMoney(Math.abs(lowestPartner.balance))} en negativo.` }
      : { title: 'Socios al día', detail: `Saldo total de socios: ${formatMoney(summaryPartnerAvailable)}.` },
  ];
  const totalGenerated = selectedSettlementRows.reduce((sum, settlement) => sum + settlement.saleTotal, 0);
  const totalCommission = selectedSettlementRows.reduce((sum, settlement) => sum + settlement.netSettlement, 0);
  const totalIvaAccumulated = selectedSettlementRows.reduce((sum, settlement) => sum + settlement.serviceCommissionIva, 0);
  const paidTotal = paidPaymentsForPeriod.reduce((sum, payment) => sum + payment.montoTotal, 0);
  const paidNetProfit = paidPeriodSettlements.reduce((sum, settlement) => sum + settlement.netSettlement, 0);
  const paidIva = paidPeriodSettlements.reduce((sum, settlement) => sum + settlement.serviceCommissionIva, 0);
  const selectedLiquidationPeriod = selectedLiquidationSeller?.settlements[0] ? getLiquidationPeriod(selectedLiquidationSeller.settlements[0].date) : '';
  const activeLiquidationPeriod = liquidationTab === 'EN_LIQUIDACION' && filteredSettlements[0] ? getLiquidationPeriod(filteredSettlements[0].date) : '';
  const { cashFund } = getCashAllocation(totalCommission);
  const expenseTotal = getExpenseTotal(selectedExpenseRows);
  const totalCajaIncome = cajaMetrics.totalCaja;
  const cashBalance = totalCajaIncome - expenseTotal;
  // BO-SOCIOS-001: el pool de socios se calcula sobre los ingresos del periodo de ESTA
  // vista (filters.retiros). Antes salia de filteredSettlements, que depende del filtro y
  // del sub-tab de Liquidaciones, por lo que las tarjetas mostraban $0 salvo que el tab
  // de Liquidaciones estuviera justo en el estado que coincidia con los datos.
  const withdrawalPartnerBalances = getPartnerBalances(withdrawals, partnerIncomeShare, filters.retiros.start, filters.retiros.end);
  // Saldo historico (sin filtro de fecha) para el motivo "Retiro de saldo acumulado",
  // considerando todas las ventas de repuestos y compras de fichas de publicidad.
  const allTimePartnerBalances = useMemo(() => {
    const ordersNet = settlements.reduce((sum, settlement) => sum + settlement.netSettlement, 0);
    const adsNet = (advertising?.compras ?? []).reduce((sum, ad) => sum + ad.montoNeto, 0);
    const totalNet = ordersNet + adsNet;
    return getPartnerBalances(withdrawals, Math.round(totalNet * 0.3), '', '');
  }, [advertising?.compras, settlements, withdrawals]);
  return (
    <>
      <input ref={orderImportRef} type="file" hidden accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleOrderImport} />

      <div className="page-header">
        <div className="page-title">
          {activeView === 'retiros' ? (
            <>
              <h1>Retiro de Socios</h1>
              <p>Vista exclusiva para socios: historial y registro de retiros de libre disposición.</p>
            </>
          ) : (
            <>
              <h1>Administración Contable</h1>
              <p>{backendWorkspace ? `${backendWorkspace.status} · Pedidos, comisiones, liquidaciones y gastos.` : 'Pedidos, comisiones, liquidaciones y gastos internos de RepuesTop.'}</p>
            </>
          )}
        </div>
        <div className="header-actions">
          <DateRangeControl label="Rango activo" value={filters[activeView]} onChange={(next) => updateFilter(activeView, next)} />
          <AreaHomeShortcut />
        </div>
      </div>

      {activeView === 'resumen' && (
        <>
          <section className={`summary-hero tone-${healthTone}`}>
            <div>
              <div className="summary-status-line">
                <span className="summary-eyebrow">{healthLabel}</span>
                <button className="summary-focus-trigger" type="button" aria-label="Ver foco recomendado">
                  <UiIcon name={summaryCashAvailable < 0 || lowestPartner.balance < 0 ? 'alert' : pendingSummaryOrders.length ? 'clock' : 'check'} />
                  <span className="summary-focus-popover" role="tooltip">
                    <strong>Foco recomendado</strong>
                    {focusItems.map((item) => (
                      <span key={item.title}>
                        <b>{item.title}</b>
                        <small>{item.detail}</small>
                      </span>
                    ))}
                  </span>
                </button>
              </div>
              <h2>{formatMoney(summaryCashAvailable)} de saldo operacional</h2>
              <p>{summaryOrders.length} pedidos generados por el backend producen {formatMoney(summaryCommission)} de comisión. La caja cubre {cashCoverage}% de los gastos del periodo y deja {formatMoney(summaryPartnerAvailable)} de saldo total para socios.</p>
            </div>
            <div className="summary-health">
              <span>Salud del periodo</span>
              <strong>{healthScore}%</strong>
              <div className="summary-health-track"><i style={{ width: `${healthScore}%` }} /></div>
            </div>
            <div className="summary-hero-actions">
              <button className="secondary-button" type="button" onClick={() => navigate('/administracion/liquidaciones')}><UiIcon name="clipboard" />Liquidaciones</button>
              <button className="secondary-button" type="button" onClick={() => navigate('/administracion/gastos')}><UiIcon name="wallet" />Caja y gastos</button>
            </div>
          </section>

          <section className="summary-kpi-grid">
            <article className="summary-kpi tone-blue"><span><UiIcon name="wallet" />Ventas</span><strong>{formatMoney(totalCollected)}</strong><p>{summaryOrders.length} pedidos · promedio por pedido {formatMoney(avgTicket)}</p></article>
            <article className="summary-kpi tone-green"><span><UiIcon name="percent" />Ganancias</span><strong>{formatMoney(summaryCommission)}</strong><p>{summarySettlements.length} liquidaciones · {commissionRate}% del vendido</p></article>
            <article className={`summary-kpi tone-${summaryCashAvailable < 0 ? 'red' : 'cyan'}`}><span><UiIcon name="bank" />Caja</span><strong>{formatMoney(summaryCashAvailable)}</strong><p>{formatMoney(summaryCashFund)} base · {formatMoney(summaryExpenseTotal)} gastos</p></article>
            <article className="summary-kpi tone-purple"><span><UiIcon name="wallet" />Socios</span><strong>{formatMoney(summaryPartnerAvailable)}</strong><p>Saldo total socios · retirado {formatMoney(summaryPartnerWithdrawn)}</p></article>
          </section>

          <section className="summary-layout">
            <section className="summary-panel summary-panel-wide">
              <div className="panel-title"><h2>Flujo de caja del periodo</h2><span className="summary-panel-note">70% caja · 30% socios</span></div>
              <div className="cash-flow-list">
                <article><div><span>Ganancia neta</span><strong>{formatMoney(summaryCommission)}</strong></div><i><b style={{ width: `${getBarWidth(summaryCommission, Math.max(summaryCommission, flowMax))}%` }} /></i></article>
                <article><div><span>Caja para operar</span><strong>{formatMoney(summaryCashFund)}</strong></div><i><b style={{ width: `${getBarWidth(summaryCashFund, flowMax)}%` }} /></i></article>
                <article className="danger"><div><span>Gastos del periodo</span><strong>{formatMoney(summaryExpenseTotal)}</strong></div><i><b style={{ width: `${getBarWidth(summaryExpenseTotal, flowMax)}%` }} /></i></article>
                <article className={summaryCashAvailable < 0 ? 'danger' : 'success'}><div><span>Saldo operacional</span><strong>{formatMoney(summaryCashAvailable)}</strong></div><i><b style={{ width: `${getBarWidth(Math.abs(summaryCashAvailable), flowMax)}%` }} /></i></article>
              </div>
            </section>

            <section className="summary-panel">
              <div className="panel-title"><h2>Operación</h2><span className="summary-panel-note">{completionRate}% completado</span></div>
              <div className="operation-snapshot">
                <div><strong>{completedSummaryOrders.length}</strong><span>Recibidos</span></div>
                <div><strong>{pendingSummaryOrders.length}</strong><span>Pendientes</span></div>
                <div><strong>{cancelledSummaryOrders.length}</strong><span>Finalizados</span></div>
              </div>
              <div className="status-stack">
                {statusRows.length ? statusRows.map((row) => (
                  <article key={row.status}><div><span>{row.status}</span><strong>{row.count}</strong></div><i><b style={{ width: `${getBarWidth(row.count, summaryOrders.length)}%` }} /></i></article>
                )) : <div className="empty-state">No hay pedidos en este periodo.</div>}
              </div>
            </section>

            <section className="summary-panel">
              <div className="panel-title"><h2>Mejor frente comercial</h2><span className="summary-panel-note">{topSeller.count} pedidos</span></div>
              <div className="seller-highlight"><span><UiIcon name="wallet" /></span><div><strong><FounderSellerName name={topSeller.seller} founder={topSeller.sellerFounder} /></strong><p>{formatMoney(topSeller.total)} vendido en el rango activo.</p></div></div>
              <dl className="compact-info-list">
                <div><dt>Promedio por pedido</dt><dd>{formatMoney(avgTicket)}</dd></div>
                <div><dt>Pedidos activos</dt><dd>{pendingSummaryOrders.length}</dd></div>
                <div><dt>Liquidaciones cerradas</dt><dd>{summarySettlements.length}</dd></div>
              </dl>
            </section>

            <section className="summary-panel">
              <div className="panel-title"><h2>Historial de gastos</h2><span className="summary-panel-note">Últimos 5</span></div>
              <div className="premium-expense-list">
                {summaryExpenses.slice(0, 5).length ? summaryExpenses.slice(0, 5).map((expense, index) => (
                  <article className="premium-expense-item" key={expense.id}>
                    <div className="premium-expense-rank">{index + 1}</div>
                    <div><strong>{expense.category}</strong><p>{expense.description}</p></div>
                    <div className="premium-expense-meta"><span>{formatDate(expense.date)}</span><strong>{formatMoney(expense.amount)}</strong></div>
                  </article>
                )) : <div className="empty-state">No hay gastos registrados en este periodo.</div>}
              </div>
              <dl className="compact-info-list expense-summary-strip">
                <div><dt><UiIcon name="clipboard" />Gasto del periodo</dt><dd>{formatMoney(summaryExpenseTotal)}</dd></div>
                <div><dt><UiIcon name="wallet" />Saldo operacional</dt><dd>{formatMoney(summaryCashAvailable)}</dd></div>
              </dl>
            </section>

            <section className="summary-panel">
              <div className="panel-title"><h2>Socios</h2><span className="summary-panel-note">{PARTNERS.length} partes</span></div>
              <div className="partner-pool"><strong>{formatMoney(summaryPartnerAvailable)}</strong><span>Saldo total de socios después de retiros</span></div>
              <div className="partner-share-list">
                {summaryPartnerRows.map(({ partner, balance }) => (
                  <article key={partner} className={balance < 0 ? 'balance-negative' : ''}><span>{partner}</span><strong>{formatMoney(balance)}</strong></article>
                ))}
              </div>
              <div className="empty-state compact-empty">Los saldos pueden ser positivos o negativos según los retiros registrados de cada socio.</div>
            </section>

            <section className="summary-panel summary-panel-wide">
              <div className="panel-title"><h2>Actividad reciente</h2></div>
              <div className="activity-list compact compact-activity-list">
                {activityLogs.slice(0, 4).map((item) => (
                  <article className="activity-item" key={item.id}>
                    <span className="activity-icon"><UiIcon name={item.iconName} /></span>
                    <div><strong>{item.title}</strong><p>{item.description}</p></div>
                    <time>{item.time}</time>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      )}

      {activeView === 'pedidos' && (
        <>
          {/* Pedidos de repuestos y compras de publicidad viven en tabs
              separados para no confundir una cosa con la otra. */}
          <div className="module-tabs" role="tablist" aria-label="Tipo de pedido">
            {([
              ['pedidos', 'Pedidos'],
              ['publicidad', 'Publicidad'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={ordersTab === tab}
                className={ordersTab === tab ? 'active' : undefined}
                onClick={() => setOrdersTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {activeView === 'pedidos' && ordersTab === 'publicidad' && (
        <>
          <div className="metric-grid compact publicidad-metric-grid">
            <MetricCard
              label="Compras de fichas"
              value={advertisingMetrics.cantidad}
              tone="amber"
              description={`${advertisingMetrics.fichas.toLocaleString('es-CL')} fichas vendidas`}
              iconName="upload"
            />
            <MetricCard
              label="Monto acumulado"
              value={formatMoney(advertisingMetrics.monto)}
              tone="blue"
              description="Total pagado por los avisadores"
              iconName="wallet"
            />
            <MetricCard
              label="Ganancia"
              value={formatMoney(advertisingMetrics.ganancia)}
              tone="green"
              description="Monto pagado menos la pasarela"
              iconName="percent"
            />
            <MetricCard
              label="Comisión pasarela"
              value={formatMoney(advertisingMetrics.comision)}
              tone="red"
              description="Acumulado retenido por la pasarela de pago"
              iconName="receipt"
            />
          </div>

          <div className="notice"><UiIcon name="note" />Las compras de fichas financian la publicación de avisos en el Mural; no generan liquidación a vendedores.</div>

          <section className="table-shell">
            <div className="table-toolbar">
              <input
                className="input"
                type="search"
                placeholder="Buscar por código, comprador, correo o método de pago..."
                value={advertisingQuery}
                onChange={(event) => setAdvertisingQuery(event.target.value)}
              />
              {/* El pendiente primero: es lo unico accionable de esta tabla. */}
              <div className="module-tabs" style={{ marginLeft: 'auto' }}>
                {([['sin', `Sin documento (${advertisingSinDocumento})`], ['con', 'Con documento'], ['todas', 'Todas']] as const)
                  .map(([valor, label]) => (
                    <button
                      key={valor}
                      type="button"
                      className={advertisingDocFilter === valor ? 'active' : ''}
                      onClick={() => setAdvertisingDocFilter(valor)}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </div>
            <table className="wide-table">
              <thead>
                <tr>
                  <th>Código</th><th>Fecha</th><th>Quién pagó</th><th>Correo</th><th>Fichas</th>
                  <th>Monto pagado</th><th>Comisión pasarela</th><th>Ganancia</th><th>Método de pago</th><th>Estado</th><th>Documento</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdvertisingOrders.length ? filteredAdvertisingOrders.map((row) => (
                  <tr key={row.id}>
                    <td>{row.codigo}</td>
                    <td>{formatDateTimeLocal(row.fecha)}</td>
                    <td>{row.comprador ?? 'Sin registrar'}</td>
                    <td>{row.correo ?? '—'}</td>
                    <td>{row.cantidadFichas.toLocaleString('es-CL')}</td>
                    <td>{formatMoney(row.montoPagado)}</td>
                    <td>{formatMoney(row.comisionPasarela)}</td>
                    <td>{formatMoney(row.montoNeto)}</td>
                    <td>{row.metodoPago ?? '—'}</td>
                    <td><span className={`status-pill ${slug(row.estado)}`}>{row.estado}</span></td>
                    <td>
                      {row.documentoCargado ? (
                        <span className="status-pill tone-green">
                          {row.documentoTipo === 'FACTURA' ? 'Factura' : 'Boleta'}
                          {row.documentoFolio ? ` · ${row.documentoFolio}` : ''}
                        </span>
                      ) : (
                        <span className="status-pill tone-red">Pendiente</span>
                      )}
                    </td>
                    <td>
                      <div className="action-cell">
                        <button
                          className="action-button neutral"
                          type="button"
                          onClick={() => setSelectedAdvertisingOrder(row)}
                          title="Ver resumen de la compra"
                        >
                          <UiIcon name="eye" />
                        </button>
                        {/* Ver el PDF emitido, sin pasar por el formulario de emision. Se
                            decide con `documentoDescargable` y no con `documentoCargado`:
                            una boleta sin RUT no cuenta como "completa" pero su PDF existe
                            igual, y esconderlo dejaria un documento emitido sin forma de
                            mirarlo desde el panel. */}
                        {row.documentoDescargable && (
                          <button
                            className="action-button neutral"
                            type="button"
                            onClick={() => verDocumentoRecarga(row.id)}
                            title={`Ver la ${row.documentoTipo === 'FACTURA' ? 'factura' : 'boleta'} emitida`}
                          >
                            <UiIcon name="fileCheck" />
                          </button>
                        )}
                        <button
                          className={`action-button ${row.documentoCargado ? 'success' : 'issue'}`}
                          type="button"
                          onClick={() => abrirDocumentoRecarga(row)}
                          title={row.documentoCargado
                            ? 'Reemplazar el documento emitido'
                            : 'Emitir boleta o factura de esta recarga'}
                        >
                          <UiIcon name={row.documentoCargado ? 'fileCheck' : 'receipt'} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={12}>
                      <div className="empty-state">
                        {advertisingQuery
                          ? 'No hay compras de publicidad que coincidan con la búsqueda.'
                          : 'Todavía no se han registrado compras de fichas para publicidad.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-footer compact-footer">
              <span>{filteredAdvertisingOrders.length} registros mostrados</span>
            </div>
          </section>
        </>
      )}

      {activeView === 'pedidos' && ordersTab === 'pedidos' && (
        <>
          <div className="metric-grid compact pedidos-metric-grid">
            <MetricCard label="Monto recaudado" value={formatMoney(selectedOrderRows.reduce((sum, order) => sum + order.total, 0))} tone="blue" description="Pedidos filtrados o seleccionados" iconName="wallet" />
            <MetricCard label="Pedidos ingresados" value={selectedOrderRows.length} tone="amber" description={`${selectedOrderRows.filter((order) => order.status === 'Recibido').length} recibidos`} iconName="upload" />
            <MetricCard label="Liquidados" value={filteredOrders.filter((order) => order.liquidado).length} tone="green" description="Sin reclamos ni mediaciones por 3 días" iconName="check" />
          </div>

          <div className="notice"><UiIcon name="note" />Los pedidos son trazabilidad interna; el cumplimiento operativo corresponde al vendedor.</div>

          <section className="table-shell">
            <div className="table-toolbar table-toolbar-pedidos">
              <input className="input" type="search" placeholder="Buscar por ID, comprador, vendedor o producto..." value={filters.pedidos.query} onChange={(event) => updateFilter('pedidos', { query: event.target.value })} />
              <select className="select" value={selectedStatusFilter} onChange={(event) => { setSelectedStatusFilter(event.target.value); setPagination((current) => ({ ...current, pedidos: { ...current.pedidos, page: 1 } })); }} aria-label="Filtrar por estado">
                <option value="">Todos los estados</option>
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select className="input" style={{ width: 'auto', flexShrink: 0 }} value={selectedOrderMonth} onChange={(event) => selectOrderMonth(event.target.value)} aria-label="Filtrar pedidos por mes">
                {orderMonthOptions.map((month) => <option key={month} value={month}>{formatMonthName(month)}</option>)}
              </select>
              <select className="input" style={{ width: 'auto', flexShrink: 0 }} value={selectedOrderYear} onChange={(event) => selectOrderYear(event.target.value)} aria-label="Filtrar pedidos por año">
                {orderYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            {false ? (
              <table className="wide-table">
                <thead><tr><th>Vendedor</th><th>RUT</th><th>Razón social / Nombre</th><th>Correo</th><th>Cantidad liquidaciones</th><th>Monto total acumulado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {enLiquidationGroups.length ? enLiquidationGroups.map((group) => (
                    <>
                      <tr key={group.key}><td><FounderSellerName name={group.seller} founder={group.sellerFounder} /></td><td>{group.rut}</td><td>{group.legalName}</td><td>{group.email}</td><td>{group.settlements.length}</td><td>{formatMoney(group.total)}</td><td><button className="action-button neutral" type="button" onClick={() => setExpandedLiquidationSellers((current) => { const next = new Set(current); next.has(group.key) ? next.delete(group.key) : next.add(group.key); return next; })} title="Ver liquidaciones"><UiIcon name="chevronDown" /></button></td></tr>
                      {expandedLiquidationSellers.has(group.key) && <tr key={`${group.key}-details`}><td colSpan={7}><table className="wide-table"><thead><tr><th>ID liquidación</th><th>Pedido</th><th>Venta total</th><th>Descuentos al vendedor</th><th>Ganancia neta RepuesTop</th><th>Acciones</th></tr></thead><tbody>{group.settlements.map((settlement) => <tr key={settlement.id}><td>{settlement.id}</td><td>{settlement.orderId}</td><td>{formatMoney(settlement.saleTotal)}</td><td>{formatMoney(settlement.commission)}</td><td>{formatMoney(settlement.netSettlement)}</td><td><div className="action-cell"><button className="action-button neutral" type="button" onClick={() => showSettlementDetail(settlement)} title="Ver detalle"><UiIcon name="eye" /></button>{(() => { const order = orders.find((candidate) => candidate.id === settlement.orderId); const documentComplete = order ? isIssuedDocumentComplete(issuedDocuments[order.id]) : false; return order ? <button className={`action-button ${documentComplete ? 'success' : 'issue'}`} type="button" onClick={() => openDocument(order)} title="Emitir boleta o factura"><UiIcon name={documentComplete ? 'check' : 'receipt'} /></button> : null; })()}</div></td></tr>)}</tbody></table></td></tr>}
                    </>
                  )) : <tr><td colSpan={7}><div className="empty-state">No hay liquidaciones en curso para el rango seleccionado.</div></td></tr>}
                </tbody>
              </table>
            ) : (liquidationTab as string) === 'LIQUIDADO' ? (
              <table className="wide-table">
                <thead><tr><th>Código de pago</th><th>Fecha de pago</th><th>Vendedores</th><th>Cantidad de liquidaciones</th><th>Fecha de liquidación</th><th>Acciones</th></tr></thead>
                <tbody>{paidPaymentsForPeriod.length ? paidPaymentsForPeriod.map((payment) => <tr key={payment.pagoId}><td>PAG-{String(payment.pagoId).padStart(6, '0')}</td><td>{formatDate(payment.fechaPago)}</td><td><FounderSellerList sellers={payment.retiros.map((retiro) => ({ name: retiro.nombreTienda, founder: retiro.sellerFounder }))} /></td><td>{payment.retiros.length}</td><td>{formatDate(payment.periodoInicio ?? payment.fechaPago)} - {formatDate(payment.periodoFin ?? payment.fechaPago)}</td><td><div className="action-cell"><button className="action-button neutral" type="button" onClick={() => { setSelectedPaidPayment(payment); setPaidDetailQuery(''); setPaidDetailSeller(''); }} title="Ver liquidaciones del pago"><UiIcon name="eye" /></button><button className="action-button issue" type="button" onClick={() => setPaidDocumentsPayment(payment)} title="Historial de boletas"><UiIcon name="receipt" /></button></div></td></tr>) : <tr><td colSpan={6}><div className="empty-state">No hay liquidaciones pagadas para el período seleccionado.</div></td></tr>}</tbody>
              </table>
            ) : liquidationTab === 'LIQUIDADO' ? (
              <table className="wide-table">
                <thead><tr><th>Código de pago</th><th>Fecha de pago</th><th>Vendedores</th><th>Cantidad de liquidaciones</th><th>Fecha de liquidación</th><th>Acciones</th></tr></thead>
                <tbody>{paidPaymentsForPeriod.length ? paidPaymentsForPeriod.map((payment) => <tr key={payment.pagoId}><td>PAG-{String(payment.pagoId).padStart(6, '0')}</td><td>{formatDate(payment.fechaPago)}</td><td><FounderSellerList sellers={payment.retiros.map((retiro) => ({ name: retiro.nombreTienda, founder: retiro.sellerFounder }))} /></td><td>{payment.retiros.length}</td><td>{formatDate(payment.periodoInicio ?? payment.fechaPago)} - {formatDate(payment.periodoFin ?? payment.fechaPago)}</td><td><div className="action-cell"><button className="action-button neutral" type="button" onClick={() => { setSelectedPaidPayment(payment); setPaidDetailQuery(''); setPaidDetailSeller(''); }} title="Ver liquidaciones del pago"><UiIcon name="eye" /></button><button className="action-button issue" type="button" onClick={() => setPaidDocumentsPayment(payment)} title="Historial de boletas"><UiIcon name="receipt" /></button></div></td></tr>) : <tr><td colSpan={6}><div className="empty-state">No hay liquidaciones pagadas para el período seleccionado.</div></td></tr>}</tbody>
              </table>

            ) : (
            <table className="wide-table">
              <thead>
                <tr>
                  <SelectionHeader view="pedidos" sourceIds={filteredOrders.map((order) => order.id)} selected={selectedRows.pedidos} onToggle={toggleMassSelection} />
                  <th>ID pedido</th><th>Fecha</th><th>Comprador</th><th>Vendedor</th><th>Producto / Resumen</th><th>Total</th><th>Estado</th><th><button className="table-sort-button" type="button" onClick={() => { setUpdatedAtOrder((current) => current === 'asc' ? 'desc' : 'asc'); setPagination((current) => ({ ...current, pedidos: { ...current.pedidos, page: 1 } })); }} title={`Ordenar de más ${updatedAtOrder === 'asc' ? 'nuevo a más antiguo' : 'antiguo a más nuevo'}`} aria-label={`Última actualización: ordenada de más ${updatedAtOrder === 'asc' ? 'antiguo a más nuevo' : 'nuevo a más antiguo'}. Cambiar orden.`}>Última actualización <span className="sort-direction" aria-hidden="true">{updatedAtOrder === 'asc' ? '↑' : '↓'}</span></button></th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orderPage.rows.length ? orderPage.rows.map((order) => (
                  <tr key={order.id}>
                    <td className="selection-cell"><input type="checkbox" checked={selectedRows.pedidos.has(order.id)} onChange={() => toggleSelection('pedidos', order.id)} aria-label={`Seleccionar pedido ${order.id}`} /></td>
                    <td>{order.id}</td>
                    <td>{formatDateTime(order.date)}</td>
                    <td>{order.buyer}</td>
                    <td><FounderSellerName name={order.seller} founder={order.sellerFounder} /></td>
                    <td>{order.product}</td>
                    <td className={order.cancellationTooltip ? 'value-cell tooltip-container' : undefined}>
                      {order.cancellationTooltip ? (
                        <>
                          <span className="tooltip-trigger-value">
                            {formatMoney(order.total)}
                            <UiIcon name="info" />
                          </span>
                          <div className="tooltip-content">
                            <div className="tooltip-arrow"></div>
                            <div className="tooltip-body">
                              <div className="tooltip-row">{order.cancellationTooltip}</div>
                            </div>
                          </div>
                        </>
                      ) : formatMoney(order.total)}
                    </td>
                    <td>
                      <span className={`status-pill ${slug(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="updated-at-cell">
                      <span>{formatDateTime(order.updatedAt)}</span>
                      {(() => {
                        const criticality = getOrderCriticality(order);
                        if (criticality.level !== 'warning' && criticality.level !== 'critical') return null;
                        return <button className={`criticality-indicator ${criticality.level}`} type="button" onClick={() => setSelectedOrderCriticality(order)} title={`Alerta: ${criticality.label}`} aria-label={`Ver alerta del pedido ${order.id}: ${criticality.label}`}><UiIcon name="alert" /></button>;
                      })()}
                    </td>
                    <td>
                      <div className="action-cell">
                        <button className="action-button neutral" type="button" onClick={() => showOrderDetail(order)} title="Ver detalle"><UiIcon name="eye" /></button>
                        <button className="action-button neutral" type="button" onClick={() => showOrderHistory(order.id)} title="Ver historial"><UiIcon name="clock" /></button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={10}><div className="empty-state">No hay pedidos para los filtros seleccionados.</div></td></tr>}
              </tbody>
            </table>
            )}
            <div className="table-footer compact-footer">
              <span>{orderPage.rows.length} registros mostrados</span>
              <TablePager view="pedidos" state={pagination.pedidos} totalPages={orderPage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />
            </div>
          </section>
        </>
      )}

      {activeView === 'liquidaciones' && (
        <>
          <div className="module-tabs" role="tablist" aria-label="Estado de liquidación">
            {([
              ['PENDIENTE_LIQUIDACION', 'Pendiente liquidación'],
              ['EN_LIQUIDACION', 'En liquidación'],
              ['LIQUIDADO', 'Liquidado'],
            ] as const).map(([status, label]) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={liquidationTab === status}
                className={liquidationTab === status ? 'active' : undefined}
                onClick={() => {
                  setLiquidationTab(status);
                  setPagination((current) => ({ ...current, liquidaciones: { ...current.liquidaciones, page: 1 } }));
                }}
              >
                {label}
              </button>
            ))}
            {activeLiquidationPeriod && <span className="liquidation-period">Periodo de liquidación: <strong>{activeLiquidationPeriod}</strong></span>}
            {liquidationTab === 'LIQUIDADO' && <select className="input paid-period-select" value={activePaidPeriod} onChange={(event) => setSelectedPaidPeriod(event.target.value)}>{paidPeriods.map((period) => <option key={period.key} value={period.key}>Periodo pagado: {formatDate(period.start)} - {formatDate(period.end)}</option>)}</select>}
          </div>
          <div className="metric-grid compact liquidacion-metric-grid">
            <MetricCard
              label={
                liquidationTab === 'LIQUIDADO'
                  ? 'Monto total pagado'
                  : liquidationTab === 'PENDIENTE_LIQUIDACION'
                    ? 'Total acumulado por solicitar'
                    : 'Total generado en liquidación'
              }
              value={formatMoney(liquidationTab === 'LIQUIDADO' ? paidTotal : totalGenerated)}
              tone="blue"
              description={
                liquidationTab === 'LIQUIDADO'
                  ? `${paidPaymentsForPeriod.length} liquidaciones pagadas`
                  : liquidationTab === 'PENDIENTE_LIQUIDACION'
                    ? `${selectedSettlementRows.length} ventas acumuladas antes de solicitar retiro`
                    : `${selectedSettlementRows.length} registros en proceso de liquidación`
              }
              iconName="wallet"
            />
            <MetricCard
              label={
                liquidationTab === 'PENDIENTE_LIQUIDACION'
                  ? 'Ganancia neta por solicitar'
                  : liquidationTab === 'EN_LIQUIDACION'
                    ? 'Ganancia neta en liquidación'
                    : 'Ganancia neta'
              }
              value={formatMoney(liquidationTab === 'LIQUIDADO' ? paidNetProfit : totalCommission)}
              tone="green"
              description={
                liquidationTab === 'PENDIENTE_LIQUIDACION'
                  ? 'Comisión RepuesTop acumulada antes de solicitar retiro'
                  : liquidationTab === 'EN_LIQUIDACION'
                    ? 'Comisión RepuesTop de retiros en proceso'
                    : 'Después de IVA de servicio y PagoFlow'
              }
              iconName="percent"
            />
            <MetricCard
              label={
                liquidationTab === 'LIQUIDADO'
                  ? 'IVA pagado'
                  : liquidationTab === 'PENDIENTE_LIQUIDACION'
                    ? 'IVA acumulado por solicitar'
                    : 'IVA acumulado'
              }
              value={formatMoney(liquidationTab === 'LIQUIDADO' ? paidIva : totalIvaAccumulated)}
              tone="amber"
              description={
                liquidationTab === 'PENDIENTE_LIQUIDACION'
                  ? 'IVA de comisión acumulado antes de solicitar retiro'
                  : liquidationTab === 'EN_LIQUIDACION'
                    ? 'IVA de comisión acumulado de retiros en proceso'
                    : 'IVA de comisión pagado'
              }
              iconName="receipt"
            />
          </div>

          <div className="notice"><UiIcon name="note" />Solo se muestran ventas donde RepuesTop ya cobró exitosamente la venta.</div>

          <section className="table-shell">
            {liquidationTab !== 'LIQUIDADO' && <div className="table-toolbar"><input className="input" type="search" placeholder="Buscar por ID, vendedor o referencia..." value={filters.liquidaciones.query} onChange={(event) => updateFilter('liquidaciones', { query: event.target.value })} /></div>}
            {liquidationTab === 'EN_LIQUIDACION' ? (
              <table className="wide-table">
                <thead><tr><th>Vendedor</th><th>RUT</th><th>Razón social / Nombre</th><th>Correo</th><th>Cantidad liquidaciones</th><th>IVA acumulado</th><th>Acciones</th></tr></thead>
                <tbody>{enLiquidationGroups.length ? enLiquidationGroups.map((group) => {
                  const registeredDocument = getGroupDocument(group);
                  const documentComplete = Boolean(registeredDocument && isIssuedDocumentComplete(registeredDocument.document));
                  return <tr key={group.key}><td><FounderSellerName name={group.seller} founder={group.sellerFounder} /></td><td>{group.rut}</td><td>{group.legalName}</td><td>{group.email}</td><td>{group.settlements.length}</td><td>{formatMoney(group.iva)}</td><td><div className="action-cell"><button className="action-button neutral" type="button" onClick={() => setSelectedLiquidationSeller(group)} title="Vista previa de liquidaciones"><UiIcon name="eye" /></button><button className={`action-button ${documentComplete ? 'success' : 'issue'}`} type="button" onClick={() => openGroupDocument(group)} title={documentComplete ? 'Ver boleta o factura registrada' : registeredDocument ? 'Completar boleta o factura' : 'Emitir boleta o factura'}><UiIcon name={documentComplete ? 'fileCheck' : 'receipt'} /></button>{documentComplete && <button className="action-button neutral" type="button" onClick={() => openGroupDocument(group, true)} title="Editar boleta o factura registrada"><UiIcon name="edit" /></button>}</div></td></tr>;
                }) : <tr><td colSpan={7}><div className="empty-state">No hay liquidaciones en curso para el rango seleccionado.</div></td></tr>}</tbody>
              </table>
            ) : liquidationTab === 'LIQUIDADO' ? (
              <table className="wide-table paid-liquidations-table"><thead><tr><th>Código de pago</th><th>Fecha de pago</th><th>Vendedores</th><th>Cantidad de boletas/facturas</th><th>Fecha de liquidación</th><th>Acciones</th></tr></thead><tbody>{paidPaymentsForPeriod.length ? paidPaymentsForPeriod.map((payment) => <tr key={payment.pagoId}><td>PAG-{String(payment.pagoId).padStart(6, '0')}</td><td>{formatDate(payment.fechaPago)}</td><td><SellerListTooltip sellers={payment.retiros.map((retiro) => ({ name: retiro.nombreTienda, founder: retiro.sellerFounder }))} /></td><td>{payment.retiros.length}</td><td>{formatDate(getPaymentPeriod(payment.fechaPago).start)} - {formatDate(getPaymentPeriod(payment.fechaPago).end)}</td><td><div className="action-cell"><button className="action-button neutral" type="button" onClick={() => { setSelectedPaidPayment(payment); setPaidDetailQuery(''); setPaidDetailSeller(''); }} title="Ver liquidaciones del pago"><UiIcon name="eye" /></button><button className="action-button issue" type="button" onClick={() => setPaidDocumentsPayment(payment)} title="Historial de boletas"><UiIcon name="receipt" /></button></div></td></tr>) : <tr><td colSpan={6}><div className="empty-state">No hay liquidaciones pagadas para el período seleccionado.</div></td></tr>}</tbody></table>
            ) : (
            <table className="wide-table">
              <thead>
                <tr>
                  <SelectionHeader view="liquidaciones" sourceIds={filteredSettlements.map((settlement) => settlement.id)} selected={selectedRows.liquidaciones} onToggle={toggleMassSelection} />
                  <th>ID liquidación</th><th>Fecha</th><th>Vendedor</th><th>Pedidos asociados</th><th>Venta total</th><th>Descuentos al vendedor</th><th>Ganancia neta RepuesTop</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {settlementPage.rows.length ? settlementPage.rows.map((settlement) => (
                  <tr key={settlement.id}>
                    <td className="selection-cell"><input type="checkbox" checked={selectedRows.liquidaciones.has(settlement.id)} onChange={() => toggleSelection('liquidaciones', settlement.id)} aria-label={`Seleccionar liquidación ${settlement.id}`} /></td>
                    <td>{settlement.id}</td>
                    <td>{formatDate(settlement.date)}</td>
                    <td><FounderSellerName name={settlement.seller} founder={settlement.sellerFounder} /></td>
                    <td>{settlement.orderId}</td>
                    <td className="value-cell tooltip-container">
                      <span className="tooltip-trigger-value">
                        {formatMoney(settlement.saleTotal)}
                        <UiIcon name="info" />
                      </span>
                      <div className="tooltip-content">
                        <div className="tooltip-arrow"></div>
                        <div className="tooltip-body">
                          <SettlementSaleBreakdown settlement={settlement} />
                        </div>
                      </div>
                    </td>
                    <td className="value-cell tooltip-container">
                      <span className="tooltip-trigger-value">
                        {formatMoney(settlement.commission)}
                        <UiIcon name="info" />
                      </span>
                      <div className="tooltip-content">
                        <div className="tooltip-arrow"></div>
                        <div className="tooltip-body">
                          <SettlementFeeBreakdown settlement={settlement} />
                        </div>
                      </div>
                    </td>
                    <td className="value-cell tooltip-container">
                      <span className="tooltip-trigger-value">
                        {formatMoney(settlement.netSettlement)}
                        <UiIcon name="info" />
                      </span>
                      <div className="tooltip-content net-settlement-tooltip">
                        <div className="tooltip-arrow"></div>
                        <div className="tooltip-body">
                          <SettlementNetBreakdown settlement={settlement} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${slug('Finalizado')}`}>
                        Finalizado
                      </span>
                    </td>
                    <td>
                      <div className="action-cell">
                        <button className="action-button neutral" type="button" onClick={() => showSettlementDetail(settlement)} title="Ver detalle"><UiIcon name="eye" /></button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={10}><div className="empty-state">No hay liquidaciones para el rango seleccionado.</div></td></tr>}
              </tbody>
            </table>
            )}
            <div className="table-footer compact-footer">
              <span>{liquidationTab === 'LIQUIDADO' ? `${paidPaymentsForPeriod.length} pagos mostrados` : `${settlementPage.rows.length} registros mostrados`}</span>
              {liquidationTab !== 'LIQUIDADO' && <TablePager view="liquidaciones" state={pagination.liquidaciones} totalPages={settlementPage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />}
            </div>
          </section>
        </>
      )}

      {activeView === 'gastos' && (
        <div className="module-tabs" role="tablist" aria-label="Caja y gastos">
          {([
            ['caja', 'Caja'],
            ['gastos', 'Gastos'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={cajaExpenseTab === tab}
              className={cajaExpenseTab === tab ? 'active' : undefined}
              onClick={() => setCajaExpenseTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {activeView === 'gastos' && cajaExpenseTab === 'caja' && (
        <>
          <div className="metric-grid compact">
            <MetricCard
              label="Todas las ganancias"
              value={formatMoney(cajaMetrics.totalCaja)}
              tone="green"
              description={`70% de ${formatMoney(cajaMetrics.totalProfit)} neta total · ${cajaMetrics.totalCount} operaciones`}
              iconName="bank"
            />
            <MetricCard
              label="Pedidos"
              value={formatMoney(cajaMetrics.pedidosCaja)}
              tone="blue"
              description={`70% de ${formatMoney(cajaMetrics.pedidosProfit)} neta · ${cajaMetrics.pedidosCount} pedidos`}
              iconName="wallet"
            />
            <MetricCard
              label="Publicidad"
              value={formatMoney(cajaMetrics.publicidadCaja)}
              tone="amber"
              description={`70% de ${formatMoney(cajaMetrics.publicidadProfit)} neta · ${cajaMetrics.publicidadCount} compras`}
              iconName="upload"
            />
          </div>

          <div className="notice">
            <UiIcon name="note" />
            Esta caja concentra el 70% de todas las ganancias generadas (tanto por pedidos de repuestos como por compra de fichas para publicidad). Estos fondos están destinados al pago de sueldos y remuneraciones del personal y gastos operacionales de la empresa.
          </div>

          <section className="table-shell">
            <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
              <input
                className="input"
                type="search"
                placeholder="Buscar por código, comprador, producto, pack o vendedor..."
                style={{ flex: 1, minWidth: '180px' }}
                value={cajaQuery}
                onChange={(event) => {
                  setCajaQuery(event.target.value);
                  setPagination((current) => ({ ...current, caja: { ...current.caja, page: 1 } }));
                }}
              />
              <div className="caja-filter-buttons" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  className={cajaSourceFilter === 'todos' ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setCajaSourceFilter('todos');
                    setPagination((current) => ({ ...current, caja: { ...current.caja, page: 1 } }));
                  }}
                >
                  Todos ({cajaMetrics.totalCount})
                </button>
                <button
                  type="button"
                  className={cajaSourceFilter === 'pedidos' ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setCajaSourceFilter('pedidos');
                    setPagination((current) => ({ ...current, caja: { ...current.caja, page: 1 } }));
                  }}
                >
                  Pedidos ({cajaMetrics.pedidosCount})
                </button>
                <button
                  type="button"
                  className={cajaSourceFilter === 'publicidad' ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setCajaSourceFilter('publicidad');
                    setPagination((current) => ({ ...current, caja: { ...current.caja, page: 1 } }));
                  }}
                >
                  Publicidad ({cajaMetrics.publicidadCount})
                </button>
              </div>
              <select
                className="input"
                style={{ width: 'auto', flexShrink: 0 }}
                value={selectedCajaMonth}
                onChange={(event) => selectCajaMonth(event.target.value)}
                aria-label="Filtrar caja por mes"
              >
                {cajaMonthOptions.map((month) => <option key={month} value={month}>{formatMonthName(month)}</option>)}
              </select>
              <select
                className="input"
                style={{ width: 'auto', flexShrink: 0 }}
                value={selectedCajaYear}
                onChange={(event) => selectCajaYear(event.target.value)}
                aria-label="Filtrar caja por año"
              >
                {cajaYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <button
                className="icon-button"
                style={{ flexShrink: 0 }}
                type="button"
                onClick={exportCajaCsv}
                title="Exportar CSV de caja"
                aria-label="Exportar CSV de caja"
              >
                <UiIcon name="download" />
              </button>
            </div>
            <table className="wide-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Concepto / Detalle</th>
                  <th>Comprador</th>
                  <th>Venta Total</th>
                  <th>Comisión / Retención</th>
                  <th>Ganancia Neta</th>
                  <th>En Caja (70%)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cajaPage.rows.length ? cajaPage.rows.map((entry) => (
                  <tr key={`${entry.type}-${entry.id}`}>
                    <td>
                      <span className={`status-pill ${entry.type === 'pedido' ? 'finalizado' : 'preparando'}`} style={{ fontWeight: 600 }}>
                        {entry.type === 'pedido' ? 'Pedido' : 'Publicidad'}
                      </span>
                    </td>
                    <td><strong>{entry.id}</strong></td>
                    <td>
                      <div>{formatDate(entry.date)}</div>
                      {entry.date.includes('T') && <small style={{ color: 'var(--muted, #64748b)', fontSize: '11px' }}>{entry.date.split('T')[1]?.slice(0, 5)}</small>}
                    </td>
                    <td>
                      {entry.type === 'pedido' ? (
                        <div>
                          <strong>{entry.concept}</strong>
                          <div>
                            <small style={{ color: 'var(--muted, #64748b)' }}>Vendedor: </small>
                            <FounderSellerName name={entry.sellerOrPack} founder={entry.sellerFounder} />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <strong>{entry.concept}</strong>
                          <div><small style={{ color: 'var(--muted, #64748b)' }}>Pack: {entry.sellerOrPack}</small></div>
                        </div>
                      )}
                    </td>
                    <td>{entry.buyer}</td>
                    <td>{formatMoney(entry.totalSale)}</td>
                    <td>
                      <span style={{ fontSize: '12px' }}>{entry.commissionOrDeduction}</span>
                    </td>
                    <td>
                      <strong>{formatMoney(entry.netProfit)}</strong>
                    </td>
                    <td>
                      <strong style={{ color: '#059669', fontSize: '14px' }}>{formatMoney(entry.cashAmount)}</strong>
                    </td>
                    <td>
                      <div className="action-cell">
                        {entry.type === 'pedido' && entry.originalSettlement && (
                          <button
                            className="action-button neutral"
                            type="button"
                            onClick={() => showSettlementDetail(entry.originalSettlement!)}
                            title="Ver detalle del pedido"
                          >
                            <UiIcon name="eye" />
                          </button>
                        )}
                        {entry.type === 'publicidad' && entry.originalAdvertising && (
                          <button
                            className="action-button neutral"
                            type="button"
                            onClick={() => setSelectedAdvertisingOrder(entry.originalAdvertising!)}
                            title="Ver detalle de publicidad"
                          >
                            <UiIcon name="eye" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">No hay registros de caja para el filtro y periodo seleccionados.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-footer compact-footer">
              <span>{filteredCajaEntries.length} registros mostrados</span>
              <TablePager view="caja" state={pagination.caja} totalPages={cajaPage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />
            </div>
          </section>
        </>
      )}

      {activeView === 'gastos' && cajaExpenseTab === 'gastos' && (
        <>
          <div className="metric-grid compact">
            <MetricCard label="Total gastos generados" value={formatMoney(expenseTotal)} tone="amber" description={`${selectedExpenseRows.length} registros sumados`} iconName="receipt" />
            <MetricCard label="Caja RepuesTop" value={formatMoney(totalCajaIncome)} tone="green" description={`70% de ${formatMoney(cajaMetrics.totalProfit)} neta total`} iconName="bank" />
            <MetricCard label="Saldo en caja" value={formatMoney(cashBalance)} tone={cashBalance < 0 ? 'red' : 'green'} description={cashBalance < 0 ? `Déficit: faltan ${formatMoney(Math.abs(cashBalance))}` : 'Caja saludable'} iconName="wallet" />
            <MetricCard label="Comprobantes" value={filteredExpenses.filter((expense) => Boolean(expense.receipt)).length} tone="violet" description="Adjuntos registrados" iconName="document" />
          </div>

          <section className="table-shell">
            <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
              <input
                className="input"
                type="search"
                placeholder="Buscar por categoría, descripción o comprobante..."
                style={{ flex: 1, minWidth: '180px' }}
                value={filters.gastos.query}
                onChange={(event) => updateFilter('gastos', { query: event.target.value })}
              />
              <select
                className="input"
                style={{ width: 'auto', flexShrink: 0 }}
                value={selectedCajaMonth}
                onChange={(event) => selectCajaMonth(event.target.value)}
                aria-label="Filtrar gastos por mes"
              >
                {cajaMonthOptions.map((month) => <option key={month} value={month}>{formatMonthName(month)}</option>)}
              </select>
              <select
                className="input"
                style={{ width: 'auto', flexShrink: 0 }}
                value={selectedCajaYear}
                onChange={(event) => selectCajaYear(event.target.value)}
                aria-label="Filtrar gastos por año"
              >
                {cajaYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <button
                className="secondary-button"
                style={{ flexShrink: 0 }}
                type="button"
                onClick={() => setReportOpen(true)}
              >
                <UiIcon name="document" />Generar informe
              </button>
              <button
                className="icon-button"
                style={{ flexShrink: 0 }}
                type="button"
                onClick={exportExpensesCsv}
                title="Exportar CSV de gastos"
                aria-label="Exportar CSV de gastos"
              >
                <UiIcon name="download" />
              </button>
              <button
                className="primary-button"
                style={{ flexShrink: 0 }}
                type="button"
                onClick={() => openExpense()}
              >
                <UiIcon name="plus" />Registrar gasto
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <SelectionHeader view="gastos" sourceIds={filteredExpenses.map((expense) => expense.id)} selected={selectedRows.gastos} onToggle={toggleMassSelection} />
                  <th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th>Comprobante</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expensePage.rows.length ? expensePage.rows.map((expense) => (
                  <tr key={expense.id}>
                    <td className="selection-cell"><input type="checkbox" checked={selectedRows.gastos.has(expense.id)} onChange={() => toggleSelection('gastos', expense.id)} aria-label={`Seleccionar gasto ${expense.description}`} /></td>
                    <td>{formatDate(expense.date)}</td>
                    <td>{expense.category}</td>
                    <td>{expense.description}</td>
                    <td>{formatMoney(expense.amount)}</td>
                    <td><span className="receipt-link"><UiIcon name="document" />{expense.receipt || 'Sin archivo'}</span></td>
                    <td>
                      <div className="action-cell">
                        <button className="action-button neutral" type="button" onClick={() => setReceiptExpense(expense)} disabled={!expense.receipt} title="Ver comprobante"><UiIcon name="receipt" /></button>
                        <button className="action-button neutral" type="button" onClick={() => openExpense(expense)} title="Editar gasto"><UiIcon name="edit" /></button>
                        <button className="action-button delete" type="button" onClick={() => deleteExpense(expense.id)} title="Eliminar gasto"><UiIcon name="trash" /></button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={7}><div className="empty-state">No hay gastos registrados.</div></td></tr>}
              </tbody>
            </table>
            <div className="table-footer compact-footer">
              <span>{expensePage.rows.length} registros mostrados</span>
              <TablePager view="gastos" state={pagination.gastos} totalPages={expensePage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />
            </div>
          </section>
        </>
      )}

      {activeView === 'retiros' && (
        <div className="module-tabs" role="tablist" aria-label="Vista de socios">
          {([
            ['ingresos', 'Ingresos'],
            ['retiros', 'Retiros'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={partnerTab === tab}
              className={partnerTab === tab ? 'active' : undefined}
              onClick={() => setPartnerTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {activeView === 'retiros' && partnerTab === 'ingresos' && (
        <>
          <div className="metric-grid compact">
            <MetricCard
              label="Todas las ganancias (30%)"
              value={formatMoney(partnerIncomeMetrics.totalShare)}
              tone="violet"
              description={`30% de ${formatMoney(partnerIncomeMetrics.totalNet)} neta total · ${partnerIncomeMetrics.totalCount} operaciones`}
              iconName="wallet"
            />
            <MetricCard
              label="Pedidos"
              value={formatMoney(partnerIncomeMetrics.pedidosShare)}
              tone="blue"
              description={`30% de ${formatMoney(partnerIncomeMetrics.pedidosNet)} neta · ${partnerIncomeMetrics.pedidosCount} pedidos`}
              iconName="clipboard"
            />
            <MetricCard
              label="Publicidad"
              value={formatMoney(partnerIncomeMetrics.publicidadShare)}
              tone="amber"
              description={`30% de ${formatMoney(partnerIncomeMetrics.publicidadNet)} neta · ${partnerIncomeMetrics.publicidadCount} compras`}
              iconName="upload"
            />
          </div>

          <div className="notice">
            <UiIcon name="note" />
            Este apartado concentra el 30% de las ganancias netas generadas (tanto por pedidos de repuestos finalizados como por compras de fichas para publicidad) para libre disposición y retiro de los socios. El 70% restante se mantiene en la caja de la empresa para sueldos y costos operacionales.
          </div>

          <section className="table-shell">
            <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
              <h2 style={{ margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>Ingresos de socios</h2>
              <div className="caja-filter-buttons" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  className={partnerIncomeFilter === 'todos' ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setPartnerIncomeFilter('todos');
                    setPagination((current) => ({ ...current, ingresos: { ...current.ingresos, page: 1 } }));
                  }}
                >
                  Todos ({partnerIncomeMetrics.totalCount})
                </button>
                <button
                  type="button"
                  className={partnerIncomeFilter === 'pedidos' ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setPartnerIncomeFilter('pedidos');
                    setPagination((current) => ({ ...current, ingresos: { ...current.ingresos, page: 1 } }));
                  }}
                >
                  Pedidos ({partnerIncomeMetrics.pedidosCount})
                </button>
                <button
                  type="button"
                  className={partnerIncomeFilter === 'publicidad' ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setPartnerIncomeFilter('publicidad');
                    setPagination((current) => ({ ...current, ingresos: { ...current.ingresos, page: 1 } }));
                  }}
                >
                  Publicidad ({partnerIncomeMetrics.publicidadCount})
                </button>
              </div>
              <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                <select
                  className="input"
                  style={{ width: 'auto' }}
                  value={selectedIncomeMonth}
                  onChange={(event) => selectIncomeMonth(event.target.value)}
                  aria-label="Filtrar ingresos por mes"
                >
                  {incomeMonthOptions.map((month) => <option key={month} value={month}>{formatMonthName(month)}</option>)}
                </select>
                <select
                  className="input"
                  style={{ width: 'auto' }}
                  value={selectedIncomeYear}
                  onChange={(event) => selectIncomeYear(event.target.value)}
                  aria-label="Filtrar ingresos por año"
                >
                  {incomeYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
            </div>
            <table className="wide-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Código</th>
                  <th>Concepto / Detalle</th>
                  <th>Comisión / Descuento</th>
                  <th>Comisión Pasarela</th>
                  <th>IVA</th>
                  <th>Ganancia Neta</th>
                  <th>Total Socios (30%)</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {partnerIncomePage.rows.length ? partnerIncomePage.rows.map((entry) => (
                  <tr key={`${entry.type}-${entry.id}`}>
                    <td>
                      <span className={`status-pill ${entry.type === 'pedido' ? 'finalizado' : 'preparando'}`} style={{ fontWeight: 600 }}>
                        {entry.type === 'pedido' ? 'Pedido' : 'Publicidad'}
                      </span>
                    </td>
                    <td><strong>{entry.id}</strong></td>
                    <td>
                      {entry.type === 'pedido' ? (
                        <div>
                          <strong>{entry.concept}</strong>
                          <div>
                            <small style={{ color: 'var(--muted, #64748b)' }}>Vendedor: </small>
                            <FounderSellerName name={entry.sellerOrPack} founder={entry.sellerFounder} />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <strong>{entry.concept}</strong>
                          <div><small style={{ color: 'var(--muted, #64748b)' }}>Pack: {entry.sellerOrPack}</small></div>
                        </div>
                      )}
                    </td>
                    <td><span style={{ fontSize: '12px' }}>{entry.commissionLabel}</span></td>
                    <td>{formatMoney(entry.gatewayFee)}</td>
                    <td>{formatMoney(entry.iva)}</td>
                    <td><strong>{formatMoney(entry.netProfit)}</strong></td>
                    <td><strong style={{ color: '#7c3aed', fontSize: '14px' }}>{formatMoney(entry.partnerShare)}</strong></td>
                    <td>{formatDate(entry.date)}</td>
                    <td>
                      <div className="action-cell">
                        {entry.type === 'pedido' && entry.originalSettlement && (
                          <button
                            className="action-button neutral"
                            type="button"
                            onClick={() => showSettlementDetail(entry.originalSettlement!)}
                            title="Ver detalle del pedido"
                          >
                            <UiIcon name="eye" />
                          </button>
                        )}
                        {entry.type === 'publicidad' && entry.originalAdvertising && (
                          <button
                            className="action-button neutral"
                            type="button"
                            onClick={() => setSelectedAdvertisingOrder(entry.originalAdvertising!)}
                            title="Ver detalle de publicidad"
                          >
                            <UiIcon name="eye" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">No hay ingresos registrados para el filtro y periodo seleccionados.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-footer compact-footer">
              <span>{filteredPartnerIncomes.length} registros mostrados</span>
              <TablePager view="ingresos" state={pagination.ingresos} totalPages={partnerIncomePage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />
            </div>
          </section>
        </>
      )}

      {activeView === 'retiros' && partnerTab === 'retiros' && (
        <>
          <div className="metric-grid compact withdrawal-metric-row">
            <MetricCard label="Disponible retiro" value={formatMoney(partnerIncomeShare)} tone="violet" description="30% de ganancia neta del periodo" iconName="wallet" />
            {PARTNERS.map((partner, index) => {
              const socio = socioPorNombre(partner);
              return (
                <article className="metric-card" key={partner}>
                  <div className={`metric-icon ${(['blue', 'green', 'violet'] as const)[index] ?? 'blue'}`}>
                    <UiIcon name="wallet" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3>{partner}</h3>
                    <strong>{formatMoney(withdrawalPartnerBalances[partner] ?? 0)}</strong>
                    <p className="metric-description">Saldo real del socio</p>
                    <button
                      className="secondary-button"
                      type="button"
                      style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}
                      onClick={() => openSocioBanco(partner)}
                      title={socio?.tieneDatosBancarios ? 'Ver o editar datos bancarios' : 'Registrar datos bancarios'}
                    >
                      <UiIcon name="wallet" style={{ width: 14, height: 14 }} />
                      {socio?.tieneDatosBancarios ? 'Ver datos bancarios' : 'Registrar datos bancarios'}
                    </button>
                    {!socio?.tieneDatosBancarios && (
                      <p className="metric-description" style={{ color: '#b45309', marginTop: 4 }}>
                        Sin datos bancarios: no puede retirar.
                      </p>
                    )}
                    {socio?.tieneDatosBancarios && tieneRetiroEnCurso(partner) && (
                      <p className="metric-description" style={{ color: '#b45309', marginTop: 4 }}>
                        Ya tiene una solicitud en curso.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="notice"><UiIcon name="note" />Este apartado registra solo retiros de libre disposición para socios. Cada socio necesita sus datos bancarios registrados antes de poder retirar, porque esos datos se envían en la nómina BCI del pago masivo.</div>

          <section className="table-shell">
            <div className="table-toolbar">
              <h2>Historial de socios</h2>
              <select
                className="input"
                value={selectedIncomeMonth}
                onChange={(event) => selectIncomeMonth(event.target.value)}
                aria-label="Filtrar retiros por mes"
              >
                {incomeMonthOptions.map((month) => <option key={month} value={month}>{formatMonthName(month)}</option>)}
              </select>
              <select
                className="input"
                value={selectedIncomeYear}
                onChange={(event) => selectIncomeYear(event.target.value)}
                aria-label="Filtrar retiros por año"
              >
                {incomeYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <button className="primary-button" type="button" onClick={openWithdrawal}><UiIcon name="wallet" />Registrar retiro</button>
            </div>
            <table className="wide-table">
              <thead>
                <tr><th>Código</th><th>Fecha</th><th>Tipo</th><th>Quién retiró</th><th>Motivo</th><th>Monto</th><th>Saldo socio</th><th>Estado de la solicitud</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {withdrawalPage.rows.length ? withdrawalPage.rows.map((withdrawal) => {
                  const partnerBalance = withdrawalPartnerBalances[withdrawal.beneficiary] ?? withdrawal.balanceAfter;
                  const pagado = withdrawal.estado === 'PAGADO';
                  const isDocComplete = Boolean(
                    withdrawal.documentoLiquidacionCompleto ||
                    (withdrawal.documentoLiquidacionNombre && withdrawal.documentoLiquidacionTipo && withdrawal.documentoLiquidacionRut)
                  );
                  return (
                    <tr key={withdrawal.id} className={partnerBalance < 0 ? 'balance-negative' : ''}>
                      <td><strong>{withdrawal.codigoRetiro || '—'}</strong></td>
                      <td>{formatDate(withdrawal.date)}</td>
                      <td>Libre disposición socios</td>
                      <td>{withdrawal.beneficiary}</td>
                      <td>{withdrawal.reason}</td>
                      <td>{formatMoney(withdrawal.amount)}</td>
                      <td>{formatMoney(partnerBalance)}</td>
                      <td><span className={`status-pill ${pagado ? 'tone-green' : 'tone-amber'}`}>{pagado ? 'Pagado' : 'Pendiente'}</span></td>
                      <td>
                        <div className="action-cell">
                          <button
                            className="action-button neutral"
                            type="button"
                            onClick={() => showWithdrawalDetail(withdrawal)}
                            title="Ver detalle del retiro"
                          >
                            <UiIcon name="eye" />
                          </button>
                          <button
                            className={`action-button ${isDocComplete ? 'success' : 'issue'}`}
                            type="button"
                            onClick={() => openPartnerWithdrawalDocument(withdrawal)}
                            title={isDocComplete ? 'Ver / Editar documento tributario registrado' : 'Cargar documento tributario'}
                          >
                            <UiIcon name={isDocComplete ? 'fileCheck' : 'receipt'} />
                          </button>
                          {isDocComplete && (
                            <button
                              className="action-button neutral"
                              type="button"
                              onClick={() => openPartnerWithdrawalDocument(withdrawal, true)}
                              title="Editar documento tributario"
                            >
                              <UiIcon name="edit" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={9}><div className="empty-state">No hay retiros registrados para este periodo.</div></td></tr>}
              </tbody>
            </table>
            <div className="table-footer compact-footer">
              <span>{withdrawalPage.rows.length} registros mostrados</span>
              <TablePager view="retiros" state={pagination.retiros} totalPages={withdrawalPage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />
            </div>
          </section>
        </>
      )}

      {expenseDraft && (
        <Modal title={expenseDraft.id ? 'Editar gasto' : 'Registrar gasto'} onClose={() => setExpenseDraft(null)}>
          <form className="form-grid" onSubmit={saveExpense}>
            <FieldLabel label="Fecha"><input className="input" type="date" value={expenseDraft.date} onChange={(event) => setExpenseDraft({ ...expenseDraft, date: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Categoría">
              <select className="select" value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value })} required>
                {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Descripción"><input className="input" type="text" value={expenseDraft.description} onChange={(event) => setExpenseDraft({ ...expenseDraft, description: event.target.value })} placeholder="API consulta patente" required /></FieldLabel>
            <FieldLabel label="Monto"><input className="input" type="number" min="1" step="1" value={expenseDraft.amount} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })} placeholder="25000" required /></FieldLabel>
            <FieldLabel label="Comprobante opcional">
              <input ref={receiptInputRef} className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" onChange={handleReceiptChange} />
              <small>{expenseDraft.receipt || 'PDF, JPG, PNG máx. 5MB'}</small>
            </FieldLabel>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setExpenseDraft(null)}>Cancelar</button>
              <button className="primary-button" type="submit">Guardar gasto</button>
            </div>
          </form>
        </Modal>
      )}

      {orderDraft && (
        <Modal title="Registrar pedido" onClose={() => setOrderDraft(null)}>
          <form className="form-grid" onSubmit={saveOrder}>
            <FieldLabel label="ID pedido"><input className="input" type="text" value={orderDraft.id} onChange={(event) => setOrderDraft({ ...orderDraft, id: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Fecha"><input className="input" type="datetime-local" value={orderDraft.date} onChange={(event) => setOrderDraft({ ...orderDraft, date: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Comprador"><input className="input" type="text" value={orderDraft.buyer} onChange={(event) => setOrderDraft({ ...orderDraft, buyer: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Vendedor"><input className="input" type="text" value={orderDraft.seller} onChange={(event) => setOrderDraft({ ...orderDraft, seller: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Producto / Resumen"><input className="input" type="text" value={orderDraft.product} onChange={(event) => setOrderDraft({ ...orderDraft, product: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Total"><input className="input" type="number" min="1" step="1" value={orderDraft.total} onChange={(event) => setOrderDraft({ ...orderDraft, total: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Estado">
              <select className="select" value={orderDraft.status} onChange={(event) => setOrderDraft({ ...orderDraft, status: event.target.value as OrderStatus })}>
                {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </FieldLabel>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setOrderDraft(null)}>Cancelar</button>
              <button className="primary-button" type="submit">Guardar pedido</button>
            </div>
          </form>
        </Modal>
      )}

      {withdrawalDraft && (() => {
        const socioSeleccionado = socioPorNombre(withdrawalDraft.beneficiary);
        const disponible = saldoDisponible(withdrawalDraft.beneficiary, withdrawalDraft.reason);
        const montoIngresado = Number(withdrawalDraft.amount);
        const excede = Number.isFinite(montoIngresado) && montoIngresado > disponible;
        const retiroEnCurso = tieneRetiroEnCurso(withdrawalDraft.beneficiary);
        return (
          <Modal title="Registrar retiro" onClose={() => { setWithdrawalDraft(null); setWithdrawalError(''); }}>
            <form className="form-grid" onSubmit={saveWithdrawal}>
              <FieldLabel label="Fecha"><input className="input" type="date" value={withdrawalDraft.date} onChange={(event) => updateWithdrawalDraft({ date: event.target.value })} required /></FieldLabel>
              <FieldLabel label="Socio">
                <select className="select" value={withdrawalDraft.beneficiary} onChange={(event) => updateWithdrawalDraft({ beneficiary: event.target.value })} required>
                  {PARTNERS.map((partner) => <option key={partner}>{partner}</option>)}
                </select>
              </FieldLabel>
              <FieldLabel label="Motivo">
                <select className="select" value={withdrawalDraft.reason} onChange={(event) => updateWithdrawalDraft({ reason: event.target.value })} required>
                  {WITHDRAWAL_REASON_OPTIONS.map((reason) => <option key={reason}>{reason}</option>)}
                </select>
              </FieldLabel>
              <FieldLabel label={`Monto (disponible: ${formatMoney(disponible)})`}>
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  max={disponible || undefined}
                  value={withdrawalDraft.amount}
                  onChange={(event) => { setWithdrawalError(''); setWithdrawalDraft({ ...withdrawalDraft, amount: event.target.value }); }}
                  placeholder={withdrawalDraft.reason === WITHDRAWAL_REASON_MONTHLY || withdrawalDraft.reason === WITHDRAWAL_REASON_ACCUMULATED ? String(disponible) : 'Ingresa el monto a retirar'}
                  required
                />
                <small>
                  {withdrawalDraft.reason === WITHDRAWAL_REASON_MONTHLY && 'Precargado con lo acumulado del socio en el periodo filtrado.'}
                  {withdrawalDraft.reason === WITHDRAWAL_REASON_ACCUMULATED && 'Precargado con todo el saldo histórico del socio.'}
                  {withdrawalDraft.reason !== WITHDRAWAL_REASON_MONTHLY && withdrawalDraft.reason !== WITHDRAWAL_REASON_ACCUMULATED && 'Retiro parcial: escribe el monto que se va a retirar.'}
                </small>
              </FieldLabel>

              {/* BO-SOCIOS-001: comprobacion de los datos bancarios que se enviaran al banco. */}
              <div style={{ gridColumn: '1 / -1' }}>
                {socioSeleccionado?.tieneDatosBancarios ? (
                  <div className="notice" style={{ margin: 0 }}>
                    <UiIcon name="bank" />
                    <span>
                      <strong>Verifica los datos bancarios de {withdrawalDraft.beneficiary}:</strong><br />
                      {socioSeleccionado.banco} · {socioSeleccionado.tipoCuenta} N° {socioSeleccionado.numeroCuenta}<br />
                      {socioSeleccionado.titular} · RUT {socioSeleccionado.rut}
                      {socioSeleccionado.email ? <> · {socioSeleccionado.email}</> : null}
                      <br />
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}
                        onClick={() => openSocioBanco(withdrawalDraft.beneficiary)}
                      >
                        Corregir datos bancarios
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="notice" style={{ margin: 0, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
                    <UiIcon name="alert" />
                    <span>
                      {withdrawalDraft.beneficiary} no tiene datos bancarios registrados.{' '}
                      <button type="button" className="secondary-button" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openSocioBanco(withdrawalDraft.beneficiary)}>
                        Registrarlos ahora
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {!withdrawalError && retiroEnCurso && (
                <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#b91c1c', fontSize: 13 }}>
                  {withdrawalDraft.beneficiary} ya tiene una solicitud de retiro en curso. Debe esperar a que se procese antes de solicitar otra.
                </div>
              )}

              {(withdrawalError || excede) && (
                <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#b91c1c', fontSize: 13 }}>
                  {withdrawalError || `Fondos insuficientes: ${withdrawalDraft.beneficiary} tiene ${formatMoney(disponible)} disponibles.`}
                </div>
              )}

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={() => { setWithdrawalDraft(null); setWithdrawalError(''); }}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={excede || retiroEnCurso || !socioSeleccionado?.tieneDatosBancarios}>Guardar retiro</button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {socioBancoDraft && (
        <Modal title={`Datos bancarios de ${socioBancoDraft.nombre}`} onClose={() => { setSocioBancoDraft(null); setSocioBancoError(''); }}>
          <form className="form-grid" onSubmit={saveSocioBanco}>
            <FieldLabel label="RUT">
              <input className="input" type="text" value={socioBancoDraft.rut} onChange={(event) => setSocioBancoDraft({ ...socioBancoDraft, rut: event.target.value })} placeholder="12.345.678-9" required />
            </FieldLabel>
            <FieldLabel label="Nombre del titular">
              <input className="input" type="text" value={socioBancoDraft.titular} onChange={(event) => setSocioBancoDraft({ ...socioBancoDraft, titular: event.target.value })} placeholder="Nombre completo" required />
            </FieldLabel>
            <FieldLabel label="Banco">
              <select
                className="select"
                value={socioBancoDraft.banco}
                onChange={(event) => {
                  const banco = BANCOS_BCI.find((option) => option.nombre === event.target.value);
                  setSocioBancoDraft({ ...socioBancoDraft, banco: event.target.value, bankCode: banco?.code ?? null });
                }}
                required
              >
                <option value="">Selecciona un banco</option>
                {BANCOS_BCI.map((banco) => <option key={banco.nombre} value={banco.nombre}>{banco.nombre}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Tipo de cuenta">
              <select className="select" value={socioBancoDraft.tipoCuenta} onChange={(event) => setSocioBancoDraft({ ...socioBancoDraft, tipoCuenta: event.target.value })} required>
                {TIPO_CUENTA_OPTIONS.map((tipo) => <option key={tipo}>{tipo}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Número de cuenta">
              <input className="input" type="text" value={socioBancoDraft.numeroCuenta} onChange={(event) => setSocioBancoDraft({ ...socioBancoDraft, numeroCuenta: event.target.value })} placeholder="00012345678" required />
            </FieldLabel>
            <FieldLabel label="Correo de notificación">
              <input className="input" type="email" value={socioBancoDraft.email} onChange={(event) => setSocioBancoDraft({ ...socioBancoDraft, email: event.target.value })} placeholder="socio@repuestop.cl" />
            </FieldLabel>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="notice" style={{ margin: 0 }}>
                <UiIcon name="note" />
                Estos datos se envían en la nómina BCI del pago masivo. Cada retiro guarda una copia de ellos, así que editarlos aquí no altera retiros ya registrados.
              </div>
            </div>
            {socioBancoError && (
              <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#b91c1c', fontSize: 13 }}>
                {socioBancoError}
              </div>
            )}
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => { setSocioBancoDraft(null); setSocioBancoError(''); }}>Cancelar</button>
              <button className="primary-button" type="submit">Guardar datos bancarios</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedPaidPayment && (
        <Modal title={`Liquidaciones del pago PAG-${String(selectedPaidPayment.pagoId).padStart(6, '0')}`} subtitle={`${formatDate(selectedPaidPayment.periodoInicio ?? selectedPaidPayment.fechaPago)} - ${formatDate(selectedPaidPayment.periodoFin ?? selectedPaidPayment.fechaPago)}`} onClose={() => setSelectedPaidPayment(null)}>
          <div className="table-toolbar"><input className="input" type="search" placeholder="Buscar por liquidación o pedido..." value={paidDetailQuery} onChange={(event) => setPaidDetailQuery(event.target.value)} /><select className="input" value={paidDetailSeller} onChange={(event) => setPaidDetailSeller(event.target.value)}><option value="">Todos los vendedores</option>{[...new Set(selectedPaidPayment.retiros.map((retiro) => retiro.nombreTienda))].map((seller) => <option key={seller} value={seller}>{seller}</option>)}</select></div>
          <div className="modal-table-scroll paid-liquidation-detail"><table className="wide-table"><thead><tr><th>Código de liquidación</th><th>Vendedor</th><th>Pedido</th><th>Fecha</th><th>Valor</th></tr></thead><tbody>{selectedPaidPayment.retiros.flatMap((retiro, index) => (paidPaymentDetails[index]?.pedidos ?? []).filter((pedido) => (!paidDetailSeller || retiro.nombreTienda === paidDetailSeller) && (!paidDetailQuery || normalizeText(`${pedido.codigoExterno ?? pedido.pedidoId} ${pedido.pedidoId}`).includes(normalizeText(paidDetailQuery)))).map((pedido) => <tr key={`${retiro.retiroId}-${pedido.pedidoId}`}><td>{pedido.codigoExterno?.replace('-PED-', '-LQ-') ?? `LQ-${String(pedido.pedidoId).padStart(7, '0')}`}</td><td><FounderSellerName name={retiro.nombreTienda} founder={retiro.sellerFounder} /></td><td>{pedido.codigoExterno ?? `PED-${String(pedido.pedidoId).padStart(7, '0')}`}</td><td>{formatDate(pedido.fecha)}</td><td>{formatMoney(pedido.valor)}</td></tr>))}</tbody></table></div>
        </Modal>
      )}

      {paidDocumentsPayment && (
        <Modal title="Boletas y facturas adjuntas" subtitle={`PAG-${String(paidDocumentsPayment.pagoId).padStart(6, '0')}`} onClose={() => setPaidDocumentsPayment(null)}>
          <div className="modal-table-scroll paid-liquidation-detail"><table className="wide-table"><thead><tr><th>Vendedor</th><th>RUT</th><th>Archivo asociado</th></tr></thead><tbody>{paidDocumentsPayment.retiros.map((retiro) => <tr key={retiro.retiroId}><td><FounderSellerName name={retiro.nombreTienda} founder={retiro.sellerFounder} /></td><td>{retiro.rut || 'Sin RUT'}</td><td><button className={`action-button ${retiro.documentoLiquidacionNombre ? 'neutral' : 'disabled'}`} type="button" onClick={() => void previewPaidDocument(retiro.retiroId, retiro.documentoLiquidacionNombre)} disabled={!retiro.documentoLiquidacionNombre} title={retiro.documentoLiquidacionNombre ? `Ver ${retiro.documentoLiquidacionNombre}` : 'Sin PDF registrado'} aria-label={retiro.documentoLiquidacionNombre ? `Ver PDF de ${retiro.nombreTienda}` : `Sin PDF registrado para ${retiro.nombreTienda}`}><UiIcon name="eye" /></button></td></tr>)}</tbody></table></div>
        </Modal>
      )}

      {paidDocumentPreview && (
        <Modal title="PDF de boleta o factura" subtitle={paidDocumentPreview.fileName} onClose={closePaidDocumentPreview}>
          <div className="receipt-viewer registered-document-pdf">
            <iframe title={`Documento ${paidDocumentPreview.fileName}`} src={paidDocumentPreview.fileUrl} />
          </div>
        </Modal>
      )}

      {selectedLiquidationSeller && (
        <Modal title={<>Liquidaciones de <FounderSellerName name={selectedLiquidationSeller.seller} founder={selectedLiquidationSeller.sellerFounder} /></>} subtitle={`${selectedLiquidationSeller.settlements.length} liquidaciones · ${formatMoney(selectedLiquidationSeller.total)} · Período: ${selectedLiquidationPeriod}`} onClose={() => setSelectedLiquidationSeller(null)}>
          <div className="table-shell liquidation-preview-shell"><table className="wide-table liquidation-preview-table"><thead><tr><th>ID liquidación</th><th>Pedido</th><th>Fecha</th><th>Venta total</th><th>Descuentos al vendedor</th><th>Ganancia neta RepuesTop</th><th>Monto a pagar vendedor</th><th>IVA</th></tr></thead><tbody>
            {selectedLiquidationSeller.settlements.map((settlement) => <tr key={settlement.id}><td>{settlement.id}</td><td>{settlement.orderId}</td><td>{formatDate(settlement.date)}</td><td className="value-cell tooltip-container"><span className="tooltip-trigger-value">{formatMoney(settlement.saleTotal)}<UiIcon name="info" /></span><div className="tooltip-content"><div className="tooltip-arrow"></div><div className="tooltip-body"><SettlementSaleBreakdown settlement={settlement} /></div></div></td><td className="value-cell tooltip-container"><span className="tooltip-trigger-value">{formatMoney(settlement.commission)}<UiIcon name="info" /></span><div className="tooltip-content"><div className="tooltip-arrow"></div><div className="tooltip-body"><SettlementFeeBreakdown settlement={settlement} /></div></div></td><td className="value-cell tooltip-container"><span className="tooltip-trigger-value">{formatMoney(settlement.netSettlement)}<UiIcon name="info" /></span><div className="tooltip-content net-settlement-tooltip"><div className="tooltip-arrow"></div><div className="tooltip-body"><SettlementNetBreakdown settlement={settlement} /></div></div></td><td>{formatMoney(settlement.sellerPayout)}</td><td>{formatMoney(settlement.serviceCommissionIva)}</td></tr>)}
          </tbody><tfoot><tr><th colSpan={3}>Total acumulado</th><td>{formatMoney(selectedLiquidationSeller.settlements.reduce((total, settlement) => total + settlement.saleTotal, 0))}</td><td>{formatMoney(selectedLiquidationSeller.settlements.reduce((total, settlement) => total + settlement.commission, 0))}</td><td>{formatMoney(selectedLiquidationSeller.settlements.reduce((total, settlement) => total + settlement.netSettlement, 0))}</td><td>{formatMoney(selectedLiquidationSeller.settlements.reduce((total, settlement) => total + settlement.sellerPayout, 0))}</td><td>{formatMoney(selectedLiquidationSeller.settlements.reduce((total, settlement) => total + settlement.serviceCommissionIva, 0))}</td></tr></tfoot></table></div>
        </Modal>
      )}

      {documentDraft && (
        <Modal title={documentDraft.isEditing ? 'Editar documento registrado' : 'Emitir documento'} subtitle={documentDraft.orderId} onClose={() => setDocumentDraft(null)}>
          <form className="form-grid" onSubmit={saveDocument}>
            <FieldLabel label="Tipo de documento">
              <select className="select" value={documentDraft.type} onChange={(event) => setDocumentDraft({ ...documentDraft, type: event.target.value })}>
                <option>Boleta</option>
                <option>Factura</option>
              </select>
            </FieldLabel>
            <FieldLabel label="RUT receptor"><input className="input" type="text" value={documentDraft.rut} onChange={(event) => setDocumentDraft({ ...documentDraft, rut: event.target.value })} required={!documentDraft.isEditing} /></FieldLabel>

            <FieldLabel label="Razón social / Nombre"><input className="input" type="text" value={documentDraft.name} onChange={(event) => setDocumentDraft({ ...documentDraft, name: event.target.value })} required={!documentDraft.isEditing} /></FieldLabel>
            <FieldLabel label="Correo de envío"><input className="input" type="email" value={documentDraft.email} onChange={(event) => setDocumentDraft({ ...documentDraft, email: event.target.value })} required={!documentDraft.isEditing} /></FieldLabel>
            <FieldLabel label="Detalle"><input className="input" type="text" value={documentDraft.detail} onChange={(event) => setDocumentDraft({ ...documentDraft, detail: event.target.value })} required={!documentDraft.isEditing} /></FieldLabel>
            <FieldLabel label="IVA liquidado"><input className="input" type="number" min="0" step="1" value={documentDraft.ivaLiquidado} onChange={(event) => setDocumentDraft({ ...documentDraft, ivaLiquidado: event.target.value })} required={!documentDraft.isEditing} /></FieldLabel>
            <FieldLabel label="Cargar Boleta / Factura (PDF)">
              <input
                className="input"
                type="file"
                accept=".pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setDocumentDraft({ ...documentDraft, pdfName: file.name, pdfUrl: URL.createObjectURL(file), pdfFile: file });
                  }
                }}
                required={!documentDraft.isEditing && !documentDraft.pdfName}
              />
              {documentDraft.pdfName && (
                <div className="document-file-status">
                  <span>
                    <UiIcon name="check" />
                    Archivo cargado: <strong>{documentDraft.pdfName}</strong>
                  </span>
                  {documentDraft.isEditing && (
                    <button
                      className="document-file-remove"
                      type="button"
                      onClick={() => setDocumentDraft({ ...documentDraft, pdfName: '', pdfUrl: undefined, pdfFile: undefined })}
                    >
                      <UiIcon name="trash" /> Eliminar PDF
                    </button>
                  )}
                </div>
              )}
              {documentDraft.isEditing && !documentDraft.pdfName && (
                <div className="document-file-empty"><UiIcon name="info" />El registro quedará sin PDF adjunto.</div>
              )}
            </FieldLabel>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setDocumentDraft(null)}>Cancelar</button>
              <button className="primary-button" type="submit">{documentDraft.isEditing ? 'Guardar cambios' : 'Registrar envío'}</button>
            </div>
          </form>
        </Modal>
      )}

      {registeredDocumentPreview && (
        <Modal title="Documento registrado exitosamente" subtitle={registeredDocumentPreview.orderId} onClose={() => setRegisteredDocumentPreview(null)}>
          <div className="registered-document-preview">
            <div className="notice success"><UiIcon name="fileCheck" />El envío fue registrado correctamente.</div>
            <dl className="registered-document-data">
              <dt>Tipo de documento</dt><dd>{registeredDocumentPreview.document.type}</dd>
              <dt>RUT receptor</dt><dd>{registeredDocumentPreview.document.rut}</dd>
              <dt>Razón social / Nombre</dt><dd>{registeredDocumentPreview.document.name}</dd>
              <dt>Correo de envío</dt><dd>{registeredDocumentPreview.document.email}</dd>
              <dt>Detalle</dt><dd>{registeredDocumentPreview.document.detail}</dd>
              <dt>IVA liquidado</dt><dd>{formatMoney(Number(registeredDocumentPreview.document.ivaLiquidado ?? 0))}</dd>
              <dt>Documento</dt><dd><strong>{registeredDocumentPreview.document.pdfName ?? 'Sin archivo registrado'}</strong></dd>
              <dt>Registrado</dt><dd>{registeredDocumentPreview.document.sentAt}</dd>
            </dl>
            {registeredDocumentPreview.document.pdfUrl && (
              <div className="receipt-viewer registered-document-pdf">
                <iframe title={`Documento ${registeredDocumentPreview.document.pdfName ?? ''}`} src={registeredDocumentPreview.document.pdfUrl} />
              </div>
            )}
            <div className="form-actions">
              <button className="primary-button" type="button" onClick={() => setRegisteredDocumentPreview(null)}>Cerrar</button>
            </div>
          </div>
        </Modal>
      )}


      {receiptExpense && (
        <Modal title="Comprobante del gasto" subtitle={`${receiptExpense.description} · ${receiptExpense.receipt ?? ''}`} onClose={() => setReceiptExpense(null)}>
          <div className="receipt-viewer">
            {receiptExpense.receiptUrl
              ? receiptExpense.receiptType === 'application/pdf' || receiptExpense.receipt?.toLowerCase().endsWith('.pdf')
                ? <iframe title={`Comprobante ${receiptExpense.receipt}`} src={receiptExpense.receiptUrl} />
                : <img src={receiptExpense.receiptUrl} alt={`Comprobante ${receiptExpense.receipt}`} />
              : <div className="empty-state compact-empty">El gasto tiene registrado el comprobante {receiptExpense.receipt}, pero no hay un archivo cargado en esta sesión para previsualizar.</div>}
          </div>
        </Modal>
      )}

      {reportOpen && (
        <Modal title="Informe de gastos" subtitle={`${filteredExpenses.length} registros · ${formatDate(filters.gastos.start)} - ${formatDate(filters.gastos.end)}`} onClose={() => setReportOpen(false)}>
          <div className="report-summary">
            <div><span>Registros</span><strong>{filteredExpenses.length}</strong></div>
            <div><span>Total gastos</span><strong>{formatMoney(getExpenseTotal(filteredExpenses))}</strong></div>
            <div><span>Caja RepuesTop</span><strong>{formatMoney(cashFund)}</strong></div>
            <div><span>Saldo caja</span><strong>{formatMoney(cashFund - getExpenseTotal(filteredExpenses))}</strong></div>
          </div>
          <div className="table-shell embedded">
            <table>
              <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th>Comprobante</th></tr></thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}><td>{formatDate(expense.date)}</td><td>{expense.category}</td><td>{expense.description}</td><td>{formatMoney(expense.amount)}</td><td>{expense.receipt || 'Sin archivo'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={exportExpensesCsv}><UiIcon name="download" />Descargar CSV</button>
            <button className="primary-button" type="button" onClick={() => window.print()}><UiIcon name="document" />Imprimir / PDF</button>
          </div>
        </Modal>
      )}

      {selectedDetailSettlement && (
        <Modal title="Detalle de liquidación" subtitle={`${selectedDetailSettlement.id} · Pedido ${selectedDetailSettlement.orderId}`} onClose={() => setSelectedDetailSettlement(null)}>
          <div className="settlement-detail-modal">
            <section className="settlement-hero">
              <span className="settlement-hero-icon"><UiIcon name="clipboard" /></span>
              <div>
                <span><FounderSellerName name={selectedDetailSettlement.seller} founder={selectedDetailSettlement.sellerFounder} /></span>
                <strong>{formatMoney(selectedDetailSettlement.netSettlement)}</strong>
                <p>Ganancia neta RepuesTop después de IVA y PagoFlow</p>
              </div>
              <span className={`status-pill ${slug(selectedDetailSettlement.status)}`}>{selectedDetailSettlement.status}</span>
            </section>

            <section className="settlement-stat-grid">
              <article><span>Base: productos + despacho{selectedDetailSettlement.descuento && selectedDetailSettlement.descuento > 0 ? ' - descuento' : ''}</span><strong>{formatMoney(selectedDetailSettlement.saleTotal)}</strong></article>
              <article><span>{serviceCommissionLabel(selectedDetailSettlement)}</span><strong>{formatMoney(selectedDetailSettlement.serviceCommission)}</strong></article>
              <article><span>IVA de tarifa de servicio</span><strong>{formatMoney(selectedDetailSettlement.serviceCommissionIva)}</strong></article>
              <article><span>PagoFlow sobre venta total</span><strong>{formatMoney(selectedDetailSettlement.gatewayFeeSeller)}</strong></article>
            </section>

            <section className="settlement-net-card">
              <div><span>Descuentos al vendedor</span><strong>{formatMoney(selectedDetailSettlement.commission)}</strong></div>
              <UiIcon name="minus" />
              <div><span>IVA y PagoFlow sobre venta total</span><strong>{formatMoney(selectedDetailSettlement.serviceCommissionIva + selectedDetailSettlement.gatewayFeeSeller)}</strong></div>
              <UiIcon name="arrowRight" />
              <div className="success"><span>Ganancia neta RepuesTop</span><strong>{formatMoney(selectedDetailSettlement.netSettlement)}</strong></div>
            </section>

            <dl className="settlement-meta">
              <div><dt>Fecha</dt><dd>{formatDate(selectedDetailSettlement.date)}</dd></div>
              <div><dt>Vendedor</dt><dd><FounderSellerName name={selectedDetailSettlement.seller} founder={selectedDetailSettlement.sellerFounder} /></dd></div>
              <div><dt>ID liquidación</dt><dd>{selectedDetailSettlement.id}</dd></div>
              <div><dt>Pedido asociado</dt><dd>{selectedDetailSettlement.orderId}</dd></div>
              {Boolean(selectedDetailSettlement.descuento && selectedDetailSettlement.descuento > 0) && (
                <div><dt>Descuento cotización</dt><dd style={{ color: '#dc2626', fontWeight: 600 }}>-{formatMoney(selectedDetailSettlement.descuento!)}</dd></div>
              )}
            </dl>

            <div className="form-actions">
              <button className="primary-button" type="button" onClick={() => setSelectedDetailSettlement(null)}>Cerrar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Documento tributario de una recarga. RepuesTop es vendedor DIRECTO aca, asi que la
          obligacion de emitir es propia: se emite en el Portal MIPYME del SII y el PDF se carga
          y se despacha al comprador desde este formulario. */}
      {docRecargaDraft && (
        <Modal
          title={`Documento de la recarga ${docRecargaDraft.codigo}`}
          subtitle={`Comprador: ${docRecargaDraft.comprador}`}
          onClose={() => !docRecargaBusy && setDocRecargaDraft(null)}
        >
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); guardarDocumentoRecarga(); }}>
            <p className="panel-hint">
              Emite el documento en el Portal MIPYME del SII con los datos de abajo y adjunta el PDF.
              Al guardar se le envía por correo al comprador: la norma exige entregarlo, no solo
              emitirlo.
            </p>

            {/* Lo que pidió el comprador va arriba y aparte del tipo sugerido. Si no se dijera,
                el administrador emitiría lo que le propone la pantalla sin enterarse de que le
                estaban pidiendo otra cosa, y la elección del comprador sería decorativa. */}
            {docRecargaDraft.solicitado ? (
              <div className="notice">
                <strong>
                  El comprador pidió{' '}
                  {docRecargaDraft.solicitado === 'FACTURA' ? 'factura' : 'boleta'}
                </strong>
                <span>
                  {docRecargaDraft.solicitado === 'FACTURA'
                    ? 'La eligió al pagar, con el RUT ya validado. Emitir otra cosa lo deja sin el crédito fiscal del IVA.'
                    : 'La eligió al pagar, aunque tenga RUT de empresa registrado.'}
                </span>
              </div>
            ) : (
              <div className="notice">
                <strong>El comprador no eligió documento</strong>
                <span>
                  Es una recarga anterior a esa opción. El tipo de abajo sale de la heurística de
                  siempre: factura si tiene RUT de empresa registrado, boleta si no.
                </span>
              </div>
            )}

            {/* Todo lo que hay que tipear en el SII, junto y copiable: el administrador no
                deberia tener que ir a buscar el RUT o el giro a otra pantalla. */}
            <div className="registered-document-preview">
              <div className="notice">
                <strong>Datos para emitir en el SII</strong>
                <button
                  className="secondary-button"
                  type="button"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    const texto = [
                      `Receptor: ${docRecargaDraft.razonSocial || docRecargaDraft.comprador}`,
                      docRecargaDraft.rut ? `RUT: ${docRecargaDraft.rut}` : null,
                      docRecargaDraft.giro ? `Giro: ${docRecargaDraft.giro}` : null,
                      docRecargaDraft.direccion ? `Dirección: ${docRecargaDraft.direccion}` : null,
                      docRecargaDraft.email ? `Correo: ${docRecargaDraft.email}` : null,
                      '',
                      `Detalle: ${docRecargaDraft.detalle}`,
                      `Neto: ${formatMoney(docRecargaDraft.neto)}`,
                      `IVA 19%: ${formatMoney(docRecargaDraft.iva)}`,
                      `Total: ${formatMoney(docRecargaDraft.total)}`,
                    ].filter(Boolean).join('\n');
                    navigator.clipboard?.writeText(texto)
                      .then(() => { setDocRecargaCopiado(true); window.setTimeout(() => setDocRecargaCopiado(false), 2000); })
                      .catch(() => {});
                  }}
                >
                  <UiIcon name={docRecargaCopiado ? 'check' : 'clipboard'} />
                  {docRecargaCopiado ? 'Copiado' : 'Copiar datos'}
                </button>
              </div>
              <dl className="registered-document-data">
                <div><dt>Receptor</dt><dd>{docRecargaDraft.razonSocial || docRecargaDraft.comprador}</dd></div>
                <div><dt>RUT</dt><dd>{docRecargaDraft.rut || 'Sin RUT registrado'}</dd></div>
                <div><dt>Giro</dt><dd>{docRecargaDraft.giro || '—'}</dd></div>
                <div><dt>Dirección</dt><dd>{docRecargaDraft.direccion || '—'}</dd></div>
                <div><dt>Correo</dt><dd>{docRecargaDraft.email || '—'}</dd></div>
                <div><dt>Detalle</dt><dd>{docRecargaDraft.detalle}</dd></div>
                <div><dt>Neto</dt><dd>{formatMoney(docRecargaDraft.neto)}</dd></div>
                <div><dt>IVA 19%</dt><dd>{formatMoney(docRecargaDraft.iva)}</dd></div>
                <div><dt>Total</dt><dd><strong>{formatMoney(docRecargaDraft.total)}</strong></dd></div>
              </dl>
              <p className="panel-hint">
                El precio de la Moneda incluye IVA, así que el neto va calculado hacia atrás. No es
                lo mismo que la &quot;Ganancia RepuesTop&quot; de la tabla, que descuenta la comisión
                de la pasarela y no tiene relación con el impuesto.
              </p>
            </div>

            <FieldLabel label="Tipo de documento">
              <select
                className="select"
                value={docRecargaDraft.tipo}
                onChange={(event) => setDocRecargaDraft({ ...docRecargaDraft, tipo: event.target.value })}
              >
                <option value="FACTURA">Factura</option>
                <option value="BOLETA">Boleta</option>
              </select>
            </FieldLabel>

            <FieldLabel label="Folio (número que asignó el SII al emitir)">
              <input
                className="input"
                type="text"
                value={docRecargaDraft.folio}
                onChange={(event) => setDocRecargaDraft({ ...docRecargaDraft, folio: event.target.value })}
                placeholder="Ej: 1024 — aparece en el documento ya emitido"
              />
            </FieldLabel>

            <FieldLabel label={docRecargaDraft.tipo === 'FACTURA' ? 'RUT receptor (obligatorio)' : 'RUT receptor'}>
              <input
                className="input"
                type="text"
                value={docRecargaDraft.rut}
                onChange={(event) => setDocRecargaDraft({ ...docRecargaDraft, rut: event.target.value })}
                required={docRecargaDraft.tipo === 'FACTURA'}
                placeholder="12.345.678-5"
              />
            </FieldLabel>

            <FieldLabel label="Razón social / Nombre">
              <input
                className="input"
                type="text"
                value={docRecargaDraft.razonSocial}
                onChange={(event) => setDocRecargaDraft({ ...docRecargaDraft, razonSocial: event.target.value })}
              />
            </FieldLabel>

            <FieldLabel label="Cargar boleta / factura (PDF)">
              <input
                className="input"
                type="file"
                accept=".pdf"
                onChange={(event) => setDocRecargaDraft({
                  ...docRecargaDraft,
                  archivo: event.target.files?.[0] ?? null,
                })}
                required
              />
              {docRecargaDraft.archivo && (
                <div className="document-file-status">
                  <span><UiIcon name="check" />Archivo listo: <strong>{docRecargaDraft.archivo.name}</strong></span>
                </div>
              )}
            </FieldLabel>

            {docRecargaError && <div className="notice error">{docRecargaError}</div>}

            <div className="form-actions">
              {docRecargaDraft.yaCargado && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => verDocumentoRecarga(docRecargaDraft.compraId)}
                >
                  <UiIcon name="eye" /> Ver el actual
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                disabled={docRecargaBusy}
                onClick={() => setDocRecargaDraft(null)}
              >
                Cancelar
              </button>
              <button className="primary-button" type="submit" disabled={docRecargaBusy}>
                {docRecargaBusy ? 'Guardando…' : 'Guardar y enviar al comprador'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedAdvertisingOrder && (
        <Modal
          title={`Compra de publicidad ${selectedAdvertisingOrder.codigo}`}
          badges={<span className={`status-pill ${slug(selectedAdvertisingOrder.estado)}`}>{selectedAdvertisingOrder.estado}</span>}
          onClose={() => setSelectedAdvertisingOrder(null)}
        >
          <div className="advertising-detail">
            {/* Lo que se busca primero: cuánto entró y cuánto quedó. */}
            <div className="advertising-detail-highlights">
              <div className="advertising-highlight">
                <span>Monto pagado</span>
                <strong>{formatMoney(selectedAdvertisingOrder.montoPagado)}</strong>
              </div>
              <div className="advertising-highlight negative">
                <span>Comisión pasarela</span>
                <strong>− {formatMoney(selectedAdvertisingOrder.comisionPasarela)}</strong>
              </div>
              <div className="advertising-highlight positive">
                <span>Ganancia RepuesTop</span>
                <strong>{formatMoney(selectedAdvertisingOrder.montoNeto)}</strong>
              </div>
            </div>

            <div className="advertising-detail-cards">
              <section className="advertising-detail-card">
                <h4><UiIcon name="user" />Quién pagó</h4>
                <dl>
                  <div><dt>Nombre</dt><dd>{selectedAdvertisingOrder.comprador ?? 'Sin registrar'}</dd></div>
                  <div><dt>Correo</dt><dd>{selectedAdvertisingOrder.correo ?? '—'}</dd></div>
                  <div><dt>Usuario</dt><dd>{selectedAdvertisingOrder.usuarioId ? `#${selectedAdvertisingOrder.usuarioId}` : 'Sin sesión asociada'}</dd></div>
                </dl>
              </section>

              <section className="advertising-detail-card">
                <h4><UiIcon name="wallet" />Compra</h4>
                <dl>
                  <div><dt>Código</dt><dd>{selectedAdvertisingOrder.codigo}</dd></div>
                  <div><dt>Fecha de pago</dt><dd>{formatDateTimeLocal(selectedAdvertisingOrder.fecha)}</dd></div>
                  <div><dt>Pack</dt><dd>{selectedAdvertisingOrder.pack ?? '—'}</dd></div>
                  <div><dt>Fichas</dt><dd>{selectedAdvertisingOrder.cantidadFichas.toLocaleString('es-CL')}</dd></div>
                </dl>
              </section>

              <section className="advertising-detail-card">
                <h4><UiIcon name="receipt" />Pago</h4>
                <dl>
                  <div><dt>Método</dt><dd>{selectedAdvertisingOrder.metodoPago ?? '—'}</dd></div>
                  <div><dt>Referencia pasarela</dt><dd>{selectedAdvertisingOrder.referenciaPago ?? '—'}</dd></div>
                  <div><dt>Estado</dt><dd><span className={`status-pill ${slug(selectedAdvertisingOrder.estado)}`}>{selectedAdvertisingOrder.estado}</span></dd></div>
                </dl>
              </section>
            </div>
          </div>
        </Modal>
      )}

      {selectedDetailOrder && (
        <Modal
          title={`Pedido ${selectedDetailOrder.id}`}
          badges={
            <>
              <span className={`status-pill ${slug(selectedDetailOrder.status)}`}>{selectedDetailOrder.status}</span>
              <span className="status-pill pagado">Pagado</span>
            </>
          }
          onClose={() => setSelectedDetailOrder(null)}
        >
          <div className="form-grid" style={{ padding: '20px', gap: '20px' }}>
            <div
              className="order-detail-cards"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Card 1: Información General */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '16px',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                    }}
                  >
                    <UiIcon name="clipboard" style={{ width: '18px', height: '18px' }} />
                  </span>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#1e293b' }}>
                    Información de Transacción
                  </h3>
                </div>

                <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 10px', margin: 0 }}>
                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>ID Pedido:</dt>
                  <dd style={{ margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>
                    {selectedDetailOrder.id}
                  </dd>

                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Fecha:</dt>
                  <dd style={{ margin: 0, color: '#334155', fontSize: '13px' }}>
                    {formatDateTime(selectedDetailOrder.date)}
                  </dd>

                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Total Pedido:</dt>
                  <dd style={{ margin: 0, color: '#10b981', fontSize: '14px', fontWeight: 800 }}>
                    {formatMoney(selectedDetailOrder.total)}
                  </dd>

                  {Boolean(selectedDetailOrder.descuento && selectedDetailOrder.descuento > 0) && (
                    <>
                      <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Descuento cotización:</dt>
                      <dd style={{ margin: 0, color: '#dc2626', fontSize: '13px', fontWeight: 700 }}>
                        -{formatMoney(selectedDetailOrder.descuento!)}
                      </dd>
                    </>
                  )}

                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Estado:</dt>
                  <dd style={{ margin: 0 }}>
                    <span className={`status-pill ${slug(selectedDetailOrder.status)}`} style={{ fontSize: '11px', padding: '3px 8px' }}>
                      {selectedDetailOrder.status}
                    </span>
                  </dd>

                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Actualización:</dt>
                  <dd style={{ margin: 0, color: '#334155', fontSize: '13px' }}>
                    {formatDateTime(selectedDetailOrder.updatedAt)}
                  </dd>
                </dl>
              </div>

              {/* Card 2: Participantes */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '16px',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#f0fdf4',
                      color: '#16a34a',
                    }}
                  >
                    <UiIcon name="users" style={{ width: '18px', height: '18px' }} />
                  </span>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#1e293b' }}>
                    Participantes y Producto
                  </h3>
                </div>

                <dl style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 10px', margin: 0 }}>
                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Comprador:</dt>
                  <dd style={{ margin: 0, color: '#334155', fontSize: '13px', fontWeight: 650 }}>
                    {selectedDetailOrder.buyer}
                  </dd>

                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Vendedor:</dt>
                  <dd style={{ margin: 0, color: '#334155', fontSize: '13px', fontWeight: 650 }}>
                    <FounderSellerName name={selectedDetailOrder.seller} founder={selectedDetailOrder.sellerFounder} />
                  </dd>

                  <dt style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Producto:</dt>
                  <dd style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.4' }}>
                    {selectedDetailOrder.product}
                  </dd>
                </dl>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '10px' }}>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  const orderId = selectedDetailOrder.id;
                  setSelectedDetailOrder(null);
                  showOrderHistory(orderId);
                }}
                style={{ marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <UiIcon name="clock" style={{ width: '15px', height: '15px' }} /> Ver Historial
              </button>
              <button
                className="secondary-button"
                type="button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  const order = selectedDetailOrder;
                  setSelectedDetailOrder(null);
                  openDocument(order);
                }}
              >
                <UiIcon name={isIssuedDocumentComplete(issuedDocuments[selectedDetailOrder.id]) ? 'check' : 'receipt'} style={{ width: '15px', height: '15px' }} /> {isIssuedDocumentComplete(issuedDocuments[selectedDetailOrder.id]) ? 'Boleta Emitida' : 'Emitir Boleta'}
              </button>
              <button className="primary-button" type="button" onClick={() => setSelectedDetailOrder(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedOrderCriticality && (() => {
        const criticality = getOrderCriticality(selectedOrderCriticality);
        const iconName = criticality.level === 'normal' ? 'check' : criticality.level === 'not-applicable' ? 'info' : 'alert';
        return (
          <Modal
            title="Seguimiento operativo"
            subtitle={`Pedido ${selectedOrderCriticality.id}`}
            onClose={() => setSelectedOrderCriticality(null)}
          >
            <div className="criticality-detail">
              <div className="criticality-summary">
                <span className={`criticality-indicator ${criticality.level}`}><UiIcon name={iconName} /></span>
                <div>
                  <strong>{criticality.label}</strong>
                  <span>Estado actual: {selectedOrderCriticality.status}</span>
                </div>
              </div>
              <dl>
                <dt>Última actualización</dt>
                <dd>{formatDateTime(selectedOrderCriticality.updatedAt)}</dd>
                <dt>Tiempo sin avance</dt>
                <dd>{criticality.elapsedHours === null ? 'No disponible' : formatElapsedHours(criticality.elapsedHours)}</dd>
                <dt>Por qué</dt>
                <dd>{criticality.reason}</dd>
                <dt>Acción esperada</dt>
                <dd>{criticality.expectedAction}</dd>
              </dl>
              <div className="form-actions">
                <button className="primary-button" type="button" onClick={() => setSelectedOrderCriticality(null)}>Cerrar</button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {selectedHistoryOrderId && (
        <Modal
          title="Historial de Estados"
          subtitle={`Pedido ${selectedHistoryOrderId}`}
          onClose={() => setSelectedHistoryOrderId(null)}
        >
          <div className="form-grid" style={{ padding: '20px', gap: '20px' }}>
            {(() => {
              const history = statusHistory[selectedHistoryOrderId] ?? [];
              if (history.length === 0) {
                return (
                  <div className="empty-state compact-empty" style={{ textAlign: 'center', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <UiIcon name="info" style={{ width: '28px', height: '28px', color: '#94a3b8', marginBottom: '8px' }} />
                    <p style={{ margin: 0, color: '#64748b' }}>Sin cambios de estado registrados para este pedido.</p>
                  </div>
                );
              }

              return (
                <div
                  className="timeline-wrapper"
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingRight: '8px',
                    margin: '10px 0',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      paddingLeft: '24px',
                      borderLeft: '2px solid #e2e8f0',
                      marginLeft: '12px',
                    }}
                  >
                    {history.map((item, index) => {
                      const transition = item.from ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className={`status-pill ${slug(item.from)}`} style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                            {item.from}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>→</span>
                          <span className={`status-pill ${slug(item.to)}`} style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                            {item.to}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>Registro Inicial:</span>
                          <span className={`status-pill ${slug(item.to)}`} style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                            {item.to}
                          </span>
                        </div>
                      );

                      return (
                        <div
                          key={index}
                          style={{
                            position: 'relative',
                            marginBottom: index === history.length - 1 ? 0 : '24px',
                          }}
                        >
                          {/* Dot marker on the vertical timeline line */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '-31px',
                              top: '4px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              border: '3px solid #ffffff',
                              boxShadow: '0 0 0 2px #3b82f6',
                              zIndex: 10,
                            }}
                          />

                          <div
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '14px 16px',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              {transition}
                              <time style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                                {formatDateTime(item.changedAt)}
                              </time>
                            </div>

                            <div
                              style={{
                                display: 'flex',

                                gap: '12px',
                                fontSize: '11.5px',
                                color: '#64748b',
                                marginBottom: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span>
                                <strong>Responsable:</strong> {item.actor}
                              </span>
                              <span>•</span>
                              <span>
                                <strong>Origen:</strong> {item.source}
                              </span>
                            </div>

                            {item.note && (
                              <div
                                style={{
                                  margin: 0,
                                  padding: '8px 12px',
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #edf2f7',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#475569',
                                  lineHeight: '1.45',
                                  fontStyle: 'italic',
                                }}
                              >
                                {item.note}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="form-actions" style={{ marginTop: '10px' }}>
              <button
                className="secondary-button"
                type="button"
                style={{ marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  const order = orders.find((o) => o.id === selectedHistoryOrderId);
                  setSelectedHistoryOrderId(null);
                  if (order) {
                    setSelectedDetailOrder(order);
                  }
                }}
              >
                <UiIcon name="eye" style={{ width: '15px', height: '15px' }} /> Ver Detalle
              </button>
              <button className="primary-button" type="button" onClick={() => setSelectedHistoryOrderId(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
