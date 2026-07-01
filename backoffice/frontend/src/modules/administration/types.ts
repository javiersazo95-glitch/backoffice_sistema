export type AdminView = 'resumen' | 'pedidos' | 'liquidaciones' | 'gastos' | 'retiros';

export type OrderStatus = 'Pendiente' | 'Preparando' | 'Enviado' | 'Recibido' | 'Finalizado' | 'En mediación' | 'En disputa';

export type SettlementStatus = 'Completada' | 'Enviado' | 'En disputa' | 'Cancelado';

export interface Order {
  id: string;
  date: string;
  buyer: string;
  seller: string;
  product: string;
  total: number;
  status: OrderStatus;
  updatedAt: string;
  liquidado?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  receipt?: string;
  receiptUrl?: string;
  receiptType?: string;
}

export interface Withdrawal {
  id: string;
  type: 'partner';
  period: string;
  date: string;
  beneficiary: string;
  reason: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}

export interface AdministrationBootstrapResponse {
  orders: Order[];
  expenses: Expense[];
  withdrawals: Withdrawal[];
  imports: ImportRecord[];
  activityLogs: ActivityLog[];
  statusHistory: Record<string, StatusHistoryItem[]>;
  orderNotes: Record<string, OrderNote[]>;
  settlementStatuses: Record<string, SettlementStatus>;
  issuedDocuments: Record<string, IssuedDocument>;
  filters: DateFilters;
  pagination: Record<'pedidos' | 'liquidaciones' | 'gastos' | 'retiros', { page: number; pageSize: number }>;
  workspace: {
    module: string;
    status: string;
    views: string[];
    persistenceMode: string;
  };
}

export interface AdministrationWorkspaceResponse {
  module: string;
  status: string;
  views: string[];
  persistenceMode: string;
}

export interface Settlement {
  id: string;
  date: string;
  seller: string;
  orderId: string;
  saleTotal: number;
  commission: number;
  buyerCommission: number;
  sellerCommission: number;
  gatewayFee: number;
  netSettlement: number;
  paidAmount: number;
  status: SettlementStatus;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  importedAt: string;
  processed: number;
  imported: number;
  updated: number;
  errors: number;
  status: string;
}

export interface ActivityLog {
  id: string;
  iconName: string;
  title: string;
  description: string;
  time: string;
}

export interface StatusHistoryItem {
  from: string;
  to: string;
  changedAt: string;
  actor: string;
  source: string;
  note: string;
}

export interface OrderNote {
  id: string;
  type: string;
  text: string;
  createdAt: string;
  author: string;
}

export interface IssuedDocument {
  type: string;
  rut: string;
  name: string;
  email: string;
  detail: string;
  sentAt: string;
  pdfName?: string;
}

export interface DateFilter {
  query: string;
  start: string;
  end: string;
}

export type DateFilters = Record<AdminView, DateFilter>;

export type SelectedRows = Record<'pedidos' | 'liquidaciones' | 'gastos', Set<string>>;
