import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import MetricCard from '@/components/shared/MetricCard';
import UiIcon from '@/components/shared/UiIcon';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import * as administrationApi from '@/api/administration';
import {
  EXPENSE_CATEGORIES,
  ORDER_STATUS_OPTIONS,
  PARTNERS,
  TODAY,
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
  DateFilter,
  Expense,
  ImportRecord,
  IssuedDocument,
  Order,
  OrderStatus,
  SelectedRows,
  Settlement,
  SettlementStatus,
  StatusHistoryItem,
  Withdrawal,
} from './types';
import {
  createId,
  csvCell,
  downloadFile,
  formatDate,
  formatDateTime,
  formatMoney,
  getBarWidth,
  getCashAllocation,
  getExpenseTotal,
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
type PageView = SelectableView | 'retiros';

interface PaginationState {
  page: number;
  pageSize: number;
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
  type: string;
  rut: string;
  name: string;
  email: string;
  detail: string;
  pdfName?: string;
}

interface WithdrawalDraft {
  date: string;
  beneficiary: string;
  reason: string;
  amount: string;
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
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
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
  const [issuedDocuments, setIssuedDocuments] = useState<Record<string, IssuedDocument>>({});
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [withdrawalDraft, setWithdrawalDraft] = useState<WithdrawalDraft | null>(null);
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft | null>(null);
  const [receiptExpense, setReceiptExpense] = useState<Expense | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);
  const [selectedDetailSettlement, setSelectedDetailSettlement] = useState<Settlement | null>(null);
  const [selectedHistoryOrderId, setSelectedHistoryOrderId] = useState<string | null>(null);
  const [backendWorkspace, setBackendWorkspace] = useState<{ module: string; status: string; views: string[]; persistenceMode: string } | null>(null);

  const { data: bootstrap } = useQuery({
    queryKey: ['administration-bootstrap'],
    queryFn: administrationApi.getBootstrap,
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

  const filteredOrders = useMemo(() => {
    const filter = filters.pedidos;
    const query = normalizeText(filter.query);
    return orders.filter((order) => {
      const matchesDate = isWithinRange(orderDate(order), filter.start, filter.end);
      const matchesQuery = !query || [order.id, order.buyer, order.seller, order.product].some((value) => normalizeText(value).includes(query));
      const matchesStatus = !selectedStatusFilter || order.status === selectedStatusFilter;
      return matchesDate && matchesQuery && matchesStatus;
    });
  }, [filters.pedidos, orders, selectedStatusFilter]);

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
      return matchesDate && matchesQuery;
    });
  }, [filters.liquidaciones, settlements]);

  const filteredExpenses = useMemo(() => {
    const filter = filters.gastos;
    const query = normalizeText(filter.query);
    return expenses.filter((expense) => {
      const matchesDate = isWithinRange(expense.date, filter.start, filter.end);
      const matchesQuery = !query || [expense.category, expense.description, expense.receipt, formatMoney(expense.amount)].some((value) => normalizeText(value).includes(query));
      return matchesDate && matchesQuery;
    });
  }, [expenses, filters.gastos]);

  const filteredWithdrawals = useMemo(
    () => withdrawals
      .filter((withdrawal) => withdrawal.type === 'partner' && isWithinRange(withdrawal.date, filters.retiros.start, filters.retiros.end))
      .sort((first, second) => second.date.localeCompare(first.date)),
    [filters.retiros, withdrawals],
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
      const totalByView = {
        pedidos: filteredOrders.length,
        liquidaciones: filteredSettlements.length,
        gastos: filteredExpenses.length,
        retiros: filteredWithdrawals.length,
      };
      const state = current[view];
      const totalPages = Math.max(1, Math.ceil(totalByView[view] / state.pageSize));
      const page = direction === 'prev' ? Math.max(1, state.page - 1) : Math.min(totalPages, state.page + 1);
      return { ...current, [view]: { ...state, page } };
    });
  }

  function updatePageSize(view: PageView, pageSize: number): void {
    setPagination((current) => ({ ...current, [view]: { page: 1, pageSize } }));
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

  function saveExpense(event: FormEvent<HTMLFormElement>): void {
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

    const payload: Expense = {
      id: expenseDraft.id || createId(),
      date: expenseDraft.date,
      category: expenseDraft.category,
      description: expenseDraft.description.trim(),
      amount,
      receipt: file?.name || expenseDraft.receipt || undefined,
      receiptUrl: file ? URL.createObjectURL(file) : expenseDraft.receiptUrl || undefined,
      receiptType: file ? file.type : expenseDraft.receiptType || undefined,
    };
    const exists = expenses.some((expense) => expense.id === payload.id);
    setExpenses((current) => exists ? current.map((expense) => (expense.id === payload.id ? payload : expense)) : [payload, ...current]);
    pushActivity('wallet', exists ? 'Gasto actualizado' : 'Gasto registrado', `${payload.category} - ${payload.description}`);
    setExpenseDraft(null);
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

  function openDocument(order: Order): void {
    const existing = issuedDocuments[order.id];
    setDocumentDraft({
      orderId: order.id,
      type: existing?.type ?? 'Boleta',
      rut: existing?.rut ?? '',
      name: existing?.name ?? order.buyer,
      email: existing?.email ?? '',
      detail: existing?.detail ?? `Compra de repuesto en pedido ${order.id}`,
      pdfName: existing?.pdfName ?? '',
    });
  }

  function saveDocument(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!documentDraft) return;
    if (!documentDraft.orderId || !documentDraft.rut.trim() || !documentDraft.name.trim() || !documentDraft.email.trim() || !documentDraft.detail.trim()) {
      window.alert('Completa tipo de documento, RUT, nombre, correo y detalle.');
      return;
    }
    setIssuedDocuments((current) => ({
      ...current,
      [documentDraft.orderId]: {
        type: documentDraft.type,
        rut: documentDraft.rut.trim(),
        name: documentDraft.name.trim(),
        email: documentDraft.email.trim(),
        detail: documentDraft.detail.trim(),
        sentAt: 'Ahora',
        pdfName: documentDraft.pdfName,
      },
    }));
    pushActivity('receipt', `${documentDraft.type} registrada`, `Pedido ${documentDraft.orderId} enviado a ${documentDraft.email.trim()}`);
    setDocumentDraft(null);
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
    const partnerPool = getCashAllocation(
      settlements
        .filter((settlement) => isWithinRange(settlement.date, filters.retiros.start, filters.retiros.end))
        .reduce((sum, settlement) => sum + settlement.commission, 0),
    ).withdrawalAvailable;
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

  function openWithdrawal(): void {
    setWithdrawalDraft({
      date: filters.retiros.end || TODAY,
      beneficiary: PARTNERS[0] ?? '',
      reason: WITHDRAWAL_REASON_OPTIONS[0] ?? 'Retiro mensual socio',
      amount: '',
    });
  }

  function saveWithdrawal(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!withdrawalDraft) return;
    const amount = Number(withdrawalDraft.amount);
    if (!withdrawalDraft.date || !withdrawalDraft.beneficiary || !withdrawalDraft.reason || !amount || amount <= 0) {
      window.alert('Completa fecha, socio, motivo y un monto mayor a cero.');
      return;
    }
    const partnerPool = getCashAllocation(
      settlements
        .filter((settlement) => isWithinRange(settlement.date, filters.retiros.start, filters.retiros.end))
        .reduce((sum, settlement) => sum + settlement.commission, 0),
    ).withdrawalAvailable;
    const balanceBefore = getPartnerBalances(withdrawals, partnerPool, filters.retiros.start, filters.retiros.end)[withdrawalDraft.beneficiary] ?? 0;
    const withdrawal: Withdrawal = {
      id: createId(),
      type: 'partner',
      period: withdrawalDraft.date.slice(0, 7),
      date: withdrawalDraft.date,
      beneficiary: withdrawalDraft.beneficiary,
      reason: withdrawalDraft.reason,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore - amount,
    };
    setWithdrawals((current) => [withdrawal, ...current]);
    setPagination((current) => ({ ...current, retiros: { ...current.retiros, page: 1 } }));
    pushActivity('wallet', 'Retiro registrado', `${withdrawal.beneficiary} retiró ${formatMoney(withdrawal.amount)}`);
    setWithdrawalDraft(null);
  }

  function deleteExpense(expenseId: string): void {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
    setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    setSelectedRows((current) => {
      const next = new Set(current.gastos);
      next.delete(expenseId);
      return { ...current, gastos: next };
    });
    pushActivity('wallet', 'Gasto eliminado', 'Se eliminó un gasto registrado');
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
  const withdrawalPage = getPage(filteredWithdrawals, pagination.retiros);
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
    const current = acc.get(order.seller) ?? { seller: order.seller, total: 0, count: 0 };
    current.total += order.total;
    current.count += 1;
    acc.set(order.seller, current);
    return acc;
  }, new Map<string, { seller: string; total: number; count: number }>()).values()]
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
  const { cashFund, withdrawalAvailable } = getCashAllocation(totalCommission);
  const expenseTotal = getExpenseTotal(selectedExpenseRows);
  const cashBalance = cashFund - expenseTotal;
  const withdrawalPartnerBalances = getPartnerBalances(withdrawals, withdrawalAvailable, filters.retiros.start, filters.retiros.end);
  return (
    <>
      <input ref={orderImportRef} type="file" hidden accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleOrderImport} />

      <div className="page-header">
        <div className="page-title">
          <h1>Administración Contable</h1>
          <p>{backendWorkspace ? `${backendWorkspace.status} · Pedidos, comisiones, liquidaciones, gastos y retiros.` : 'Pedidos, comisiones, liquidaciones y gastos internos de RepuesTop.'}</p>
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
              <button className="secondary-button" type="button" onClick={() => navigate('/administracion/gastos')}><UiIcon name="wallet" />Gastos</button>
              <button className="secondary-button" type="button" onClick={() => navigate('/administracion/retiros')}><UiIcon name="wallet" />Historial de Retiros</button>
            </div>
          </section>

          <section className="summary-kpi-grid">
            <article className="summary-kpi tone-blue"><span><UiIcon name="wallet" />Ventas</span><strong>{formatMoney(totalCollected)}</strong><p>{summaryOrders.length} pedidos · promedio por pedido {formatMoney(avgTicket)}</p></article>
            <article className="summary-kpi tone-green"><span><UiIcon name="percent" />Comisión</span><strong>{formatMoney(summaryCommission)}</strong><p>{summarySettlements.length} liquidaciones · {commissionRate}% del vendido</p></article>
            <article className={`summary-kpi tone-${summaryCashAvailable < 0 ? 'red' : 'cyan'}`}><span><UiIcon name="bank" />Caja</span><strong>{formatMoney(summaryCashAvailable)}</strong><p>{formatMoney(summaryCashFund)} base · {formatMoney(summaryExpenseTotal)} gastos</p></article>
            <article className="summary-kpi tone-purple"><span><UiIcon name="wallet" />Socios</span><strong>{formatMoney(summaryPartnerAvailable)}</strong><p>Saldo total socios · retirado {formatMoney(summaryPartnerWithdrawn)}</p></article>
          </section>

          <section className="summary-layout">
            <section className="summary-panel summary-panel-wide">
              <div className="panel-title"><h2>Flujo de caja del periodo</h2><span className="summary-panel-note">70% caja · 30% socios</span></div>
              <div className="cash-flow-list">
                <article><div><span>Comisión cobrada</span><strong>{formatMoney(summaryCommission)}</strong></div><i><b style={{ width: `${getBarWidth(summaryCommission, Math.max(summaryCommission, flowMax))}%` }} /></i></article>
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
              <div className="seller-highlight"><span><UiIcon name="wallet" /></span><div><strong>{topSeller.seller}</strong><p>{formatMoney(topSeller.total)} vendido en el rango activo.</p></div></div>
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
          <div className="metric-grid compact pedidos-metric-grid">
            <MetricCard label="Monto recaudado" value={formatMoney(selectedOrderRows.reduce((sum, order) => sum + order.total, 0))} tone="blue" description="Pedidos filtrados o seleccionados" iconName="wallet" />
            <MetricCard label="Pedidos ingresados" value={selectedOrderRows.length} tone="amber" description={`${selectedOrderRows.filter((order) => order.status === 'Recibido').length} recibidos`} iconName="upload" />
            <MetricCard label="Liquidados" value={filteredOrders.filter((order) => order.liquidado).length} tone="green" description="Sin reclamos ni mediaciones por 3 días" iconName="check" />
          </div>

          <div className="notice"><UiIcon name="note" />Los pedidos son trazabilidad interna; el cumplimiento operativo corresponde al vendedor.</div>

          <section className="table-shell">
            <div className="table-toolbar table-toolbar-pedidos">
              <input className="input" type="search" placeholder="Buscar por ID, comprador, vendedor o producto..." value={filters.pedidos.query} onChange={(event) => updateFilter('pedidos', { query: event.target.value })} />
              <select className="select" value={selectedStatusFilter} onChange={(event) => setSelectedStatusFilter(event.target.value)} aria-label="Filtrar por estado">
                <option value="">Todos los estados</option>
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <table className="wide-table">
              <thead>
                <tr>
                  <SelectionHeader view="pedidos" sourceIds={filteredOrders.map((order) => order.id)} selected={selectedRows.pedidos} onToggle={toggleMassSelection} />
                  <th>ID pedido</th><th>Fecha</th><th>Comprador</th><th>Vendedor</th><th>Producto / Resumen</th><th>Total</th><th>Estado</th><th>Última actualización</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orderPage.rows.length ? orderPage.rows.map((order) => (
                  <tr key={order.id}>
                    <td className="selection-cell"><input type="checkbox" checked={selectedRows.pedidos.has(order.id)} onChange={() => toggleSelection('pedidos', order.id)} aria-label={`Seleccionar pedido ${order.id}`} /></td>
                    <td>{order.id}</td>
                    <td>{formatDateTime(order.date)}</td>
                    <td>{order.buyer}</td>
                    <td>{order.seller}</td>
                    <td>{order.product}</td>
                    <td>{formatMoney(order.total)}</td>
                    <td>
                      <span className={`status-pill ${slug(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{formatDateTime(order.updatedAt)}</td>
                    <td>
                      <div className="action-cell">
                        <button className="action-button neutral" type="button" onClick={() => showOrderDetail(order)} title="Ver detalle"><UiIcon name="eye" /></button>
                        <button className="action-button neutral" type="button" onClick={() => showOrderHistory(order.id)} title="Ver historial"><UiIcon name="clock" /></button>
                        <button className={`action-button ${issuedDocuments[order.id] ? 'success' : 'issue'}`} type="button" onClick={() => openDocument(order)} title="Emitir boleta o factura"><UiIcon name={issuedDocuments[order.id] ? 'check' : 'receipt'} /></button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={10}><div className="empty-state">No hay pedidos para los filtros seleccionados.</div></td></tr>}
              </tbody>
            </table>
            <div className="table-footer compact-footer">
              <span>{orderPage.rows.length} registros mostrados</span>
              <TablePager view="pedidos" state={pagination.pedidos} totalPages={orderPage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />
            </div>
          </section>
        </>
      )}

      {activeView === 'liquidaciones' && (
        <>
          <div className="metric-grid compact">
            <MetricCard label="Total generado" value={formatMoney(totalGenerated)} tone="blue" description={`${selectedSettlementRows.length} registros sumados`} iconName="wallet" />
            <MetricCard label="Comisión cobrada" value={formatMoney(totalCommission)} tone="green" description="5% mín. $690 máx. $9.990" iconName="percent" />
            <MetricCard label="Caja RepuesTop" value={formatMoney(cashFund)} tone="amber" description="70% de comisión" iconName="bank" />
            <MetricCard label="Disponible retiro" value={formatMoney(withdrawalAvailable)} tone="violet" description="30% de comisión" iconName="wallet" />
          </div>

          <div className="notice"><UiIcon name="note" />Solo se muestran ventas donde RepuesTop ya cobró exitosamente su comisión.</div>

          <section className="table-shell">
            <div className="table-toolbar">
              <input className="input" type="search" placeholder="Buscar por ID, vendedor o referencia..." value={filters.liquidaciones.query} onChange={(event) => updateFilter('liquidaciones', { query: event.target.value })} />
            </div>
            <table className="wide-table">
              <thead>
                <tr>
                  <SelectionHeader view="liquidaciones" sourceIds={filteredSettlements.map((settlement) => settlement.id)} selected={selectedRows.liquidaciones} onToggle={toggleMassSelection} />
                  <th>ID liquidación</th><th>Fecha</th><th>Vendedor</th><th>Pedidos asociados</th><th>Venta total</th><th>Comisión RepuesTop</th><th>Monto liquidado</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {settlementPage.rows.length ? settlementPage.rows.map((settlement) => (
                  <tr key={settlement.id}>
                    <td className="selection-cell"><input type="checkbox" checked={selectedRows.liquidaciones.has(settlement.id)} onChange={() => toggleSelection('liquidaciones', settlement.id)} aria-label={`Seleccionar liquidación ${settlement.id}`} /></td>
                    <td>{settlement.id}</td>
                    <td>{formatDate(settlement.date)}</td>
                    <td>{settlement.seller}</td>
                    <td>{settlement.orderId}</td>
                    <td className="value-cell">{formatMoney(settlement.saleTotal)}</td>
                    <td className="value-cell tooltip-container">
                      <span className="tooltip-trigger-value">
                        {formatMoney(settlement.commission)}
                        <UiIcon name="info" />
                      </span>
                      <div className="tooltip-content">
                        <div className="tooltip-arrow"></div>
                        <div className="tooltip-body">
                          <div className="tooltip-row"><span>Comisión comprador</span><span>{formatMoney(settlement.buyerCommission)}</span></div>
                          <div className="tooltip-row"><span>Comisión vendedor</span><span>{formatMoney(settlement.sellerCommission)}</span></div>
                          <div className="tooltip-divider"></div>
                          <div className="tooltip-row total"><span>Total comisiones</span><span>{formatMoney(settlement.commission)}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="value-cell tooltip-container">
                      <span className="tooltip-trigger-value">
                        {formatMoney(settlement.netSettlement)}
                        <UiIcon name="info" />
                      </span>
                      <div className="tooltip-content">
                        <div className="tooltip-arrow"></div>
                        <div className="tooltip-body">
                          <div className="tooltip-row"><span>Comisión comprador</span><span>{formatMoney(settlement.buyerCommission)}</span></div>
                          <div className="tooltip-row"><span>Comisión vendedor</span><span>{formatMoney(settlement.sellerCommission)}</span></div>
                          <div className="tooltip-row"><span>Comisión MercadoPago</span><span>-{formatMoney(settlement.gatewayFee)}</span></div>
                          <div className="tooltip-divider"></div>
                          <div className="tooltip-row total"><span>Liquidación neta</span><span>{formatMoney(settlement.netSettlement)}</span></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${slug(settlement.status)}`}>
                        {settlement.status}
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
            <div className="table-footer compact-footer">
              <span>{settlementPage.rows.length} registros mostrados</span>
              <TablePager view="liquidaciones" state={pagination.liquidaciones} totalPages={settlementPage.totalPages} onPage={updatePage} onPageSize={updatePageSize} />
            </div>
          </section>
        </>
      )}

      {activeView === 'gastos' && (
        <>
          <div className="metric-grid compact">
            <MetricCard label="Total gastos generados" value={formatMoney(expenseTotal)} tone="amber" description={`${selectedExpenseRows.length} registros sumados`} iconName="receipt" />
            <MetricCard label="Caja RepuesTop" value={formatMoney(cashFund)} tone="amber" description="70% de comisión" iconName="bank" />
            <MetricCard label="Saldo en caja" value={formatMoney(cashBalance)} tone={cashBalance < 0 ? 'red' : 'green'} description={cashBalance < 0 ? `Déficit: faltan ${formatMoney(Math.abs(cashBalance))}` : 'Caja saludable'} iconName="wallet" />
            <MetricCard label="Comprobantes" value={filteredExpenses.filter((expense) => Boolean(expense.receipt)).length} tone="violet" description="Adjuntos registrados" iconName="document" />
          </div>

          <section className="table-shell">
            <div className="table-toolbar">
              <input className="input" type="search" placeholder="Buscar por categoría, descripción o comprobante..." value={filters.gastos.query} onChange={(event) => updateFilter('gastos', { query: event.target.value })} />
              <button className="secondary-button" type="button" onClick={() => setReportOpen(true)}><UiIcon name="document" />Generar informe</button>
              <button className="secondary-button" type="button" onClick={exportExpensesCsv}><UiIcon name="download" />Exportar CSV</button>
              <button className="primary-button" type="button" onClick={() => openExpense()}><UiIcon name="plus" />Registrar gasto</button>
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
        <>
          <div className="metric-grid compact withdrawal-metric-row">
            <MetricCard label="Disponible retiro" value={formatMoney(withdrawalAvailable)} tone="violet" description="30% de comisión" iconName="wallet" />
            {PARTNERS.map((partner, index) => (
              <MetricCard
                key={partner}
                label={partner}
                value={formatMoney(withdrawalPartnerBalances[partner] ?? 0)}
                tone={(['blue', 'green', 'violet'] as const)[index] ?? 'blue'}
                description="Saldo real del socio"
                iconName="wallet"
              />
            ))}
          </div>

          <div className="notice"><UiIcon name="note" />Este apartado registra solo retiros de libre disposición para socios. Las tarjetas y la tabla muestran el saldo real de cada socio según sus retiros, por lo que un socio puede quedar en negativo si retiró más de lo disponible.</div>

          <section className="table-shell">
            <div className="table-toolbar">
              <h2>Historial de socios</h2>
              <button className="primary-button" type="button" onClick={openWithdrawal}><UiIcon name="wallet" />Registrar retiro</button>
            </div>
            <table className="wide-table">
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Quién retiró</th><th>Motivo</th><th>Monto</th><th>Saldo socio</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {withdrawalPage.rows.length ? withdrawalPage.rows.map((withdrawal) => {
                  const partnerBalance = withdrawalPartnerBalances[withdrawal.beneficiary] ?? withdrawal.balanceAfter;
                  return (
                    <tr key={withdrawal.id} className={partnerBalance < 0 ? 'balance-negative' : ''}>
                      <td>{formatDate(withdrawal.date)}</td>
                      <td>Libre disposición socios</td>
                      <td>{withdrawal.beneficiary}</td>
                      <td>{withdrawal.reason}</td>
                      <td>{formatMoney(withdrawal.amount)}</td>
                      <td>{formatMoney(partnerBalance)}</td>
                      <td>
                        <div className="action-cell">
                          <button className="action-button neutral" type="button" onClick={() => showWithdrawalDetail(withdrawal)} title="Ver detalle"><UiIcon name="eye" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={7}><div className="empty-state">No hay retiros registrados para este periodo.</div></td></tr>}
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

      {withdrawalDraft && (
        <Modal title="Registrar retiro" onClose={() => setWithdrawalDraft(null)}>
          <form className="form-grid" onSubmit={saveWithdrawal}>
            <FieldLabel label="Fecha"><input className="input" type="date" value={withdrawalDraft.date} onChange={(event) => setWithdrawalDraft({ ...withdrawalDraft, date: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Socio">
              <select className="select" value={withdrawalDraft.beneficiary} onChange={(event) => setWithdrawalDraft({ ...withdrawalDraft, beneficiary: event.target.value })} required>
                {PARTNERS.map((partner) => <option key={partner}>{partner}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Motivo">
              <select className="select" value={withdrawalDraft.reason} onChange={(event) => setWithdrawalDraft({ ...withdrawalDraft, reason: event.target.value })} required>
                {WITHDRAWAL_REASON_OPTIONS.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Monto"><input className="input" type="number" min="1" step="1" value={withdrawalDraft.amount} onChange={(event) => setWithdrawalDraft({ ...withdrawalDraft, amount: event.target.value })} placeholder="100000" required /></FieldLabel>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setWithdrawalDraft(null)}>Cancelar</button>
              <button className="primary-button" type="submit">Guardar retiro</button>
            </div>
          </form>
        </Modal>
      )}

      {documentDraft && (
        <Modal title="Emitir documento" subtitle={documentDraft.orderId} onClose={() => setDocumentDraft(null)}>
          <form className="form-grid" onSubmit={saveDocument}>
            <FieldLabel label="Tipo de documento">
              <select className="select" value={documentDraft.type} onChange={(event) => setDocumentDraft({ ...documentDraft, type: event.target.value })}>
                <option>Boleta</option>
                <option>Factura</option>
              </select>
            </FieldLabel>
            <FieldLabel label="RUT receptor"><input className="input" type="text" value={documentDraft.rut} onChange={(event) => setDocumentDraft({ ...documentDraft, rut: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Razón social / Nombre"><input className="input" type="text" value={documentDraft.name} onChange={(event) => setDocumentDraft({ ...documentDraft, name: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Correo de envío"><input className="input" type="email" value={documentDraft.email} onChange={(event) => setDocumentDraft({ ...documentDraft, email: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Detalle"><input className="input" type="text" value={documentDraft.detail} onChange={(event) => setDocumentDraft({ ...documentDraft, detail: event.target.value })} required /></FieldLabel>
            <FieldLabel label="Cargar Boleta / Factura (PDF)">
              <input
                className="input"
                type="file"
                accept=".pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setDocumentDraft({ ...documentDraft, pdfName: file.name });
                  }
                }}
                required={!documentDraft.pdfName}
              />
              {documentDraft.pdfName && (
                <div style={{ marginTop: '5px', fontSize: '12px', color: '#10b981' }}>
                  <UiIcon name="check" style={{ width: '12px', height: '12px', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                  Archivo cargado: <strong>{documentDraft.pdfName}</strong>
                </div>
              )}
            </FieldLabel>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setDocumentDraft(null)}>Cancelar</button>
              <button className="primary-button" type="submit">Registrar envío</button>
            </div>
          </form>
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
                <span>{selectedDetailSettlement.seller}</span>
                <strong>{formatMoney(selectedDetailSettlement.netSettlement)}</strong>
                <p>Liquidación neta después de MercadoPago</p>
              </div>
              <span className={`status-pill ${slug(selectedDetailSettlement.status)}`}>{selectedDetailSettlement.status}</span>
            </section>

            <section className="settlement-stat-grid">
              <article><span>Venta total</span><strong>{formatMoney(selectedDetailSettlement.saleTotal)}</strong></article>
              <article><span>Comisión comprador</span><strong>{formatMoney(selectedDetailSettlement.buyerCommission)}</strong></article>
              <article><span>Comisión vendedor</span><strong>{formatMoney(selectedDetailSettlement.sellerCommission)}</strong></article>
              <article className="danger"><span>MercadoPago</span><strong>-{formatMoney(selectedDetailSettlement.gatewayFee)}</strong></article>
            </section>

            <section className="settlement-net-card">
              <div><span>Total comisiones</span><strong>{formatMoney(selectedDetailSettlement.commission)}</strong></div>
              <UiIcon name="minus" />
              <div><span>MercadoPago</span><strong>{formatMoney(selectedDetailSettlement.gatewayFee)}</strong></div>
              <UiIcon name="arrowRight" />
              <div className="success"><span>Monto liquidado</span><strong>{formatMoney(selectedDetailSettlement.netSettlement)}</strong></div>
            </section>

            <dl className="settlement-meta">
              <div><dt>Fecha</dt><dd>{formatDate(selectedDetailSettlement.date)}</dd></div>
              <div><dt>Vendedor</dt><dd>{selectedDetailSettlement.seller}</dd></div>
              <div><dt>ID liquidación</dt><dd>{selectedDetailSettlement.id}</dd></div>
              <div><dt>Pedido asociado</dt><dd>{selectedDetailSettlement.orderId}</dd></div>
            </dl>

            <div className="form-actions">
              <button className="primary-button" type="button" onClick={() => setSelectedDetailSettlement(null)}>Cerrar</button>
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
                    {selectedDetailOrder.seller}
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
                <UiIcon name={issuedDocuments[selectedDetailOrder.id] ? 'check' : 'receipt'} style={{ width: '15px', height: '15px' }} /> {issuedDocuments[selectedDetailOrder.id] ? 'Boleta Emitida' : 'Emitir Boleta'}
              </button>
              <button className="primary-button" type="button" onClick={() => setSelectedDetailOrder(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

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
