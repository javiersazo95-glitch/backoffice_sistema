import type {
  ActivityLog,
  DateFilters,
  Expense,
  ImportRecord,
  Order,
  OrderNote,
  SelectedRows,
  StatusHistoryItem,
  Withdrawal,
} from './types';


const todayStr = new Date().toISOString().slice(0, 10);
const firstDayOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const lastDayOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

export const initialFilters: DateFilters = {
  resumen: { query: '', start: todayStr, end: todayStr },
  pedidos: { query: '', start: firstDayOfMonthStr, end: lastDayOfMonthStr },
  liquidaciones: { query: '', start: firstDayOfMonthStr, end: lastDayOfMonthStr },
  gastos: { query: '', start: firstDayOfMonthStr, end: lastDayOfMonthStr },
  retiros: { query: '', start: firstDayOfMonthStr, end: lastDayOfMonthStr },
};

export const initialSelectedRows: SelectedRows = {
  pedidos: new Set<string>(),
  liquidaciones: new Set<string>(),
  gastos: new Set<string>(),
};

export const initialOrders: Order[] = [];

export const initialExpenses: Expense[] = [];

export const initialWithdrawals: Withdrawal[] = [];

export const initialImports: ImportRecord[] = [];

export const initialActivity: ActivityLog[] = [];

export const initialStatusHistory: Record<string, StatusHistoryItem[]> = {};

export const initialOrderNotes: Record<string, OrderNote[]> = {};
