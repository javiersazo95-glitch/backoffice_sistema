export type AdminView = 'resumen' | 'pedidos' | 'liquidaciones' | 'gastos' | 'retiros';

export type OrderStatus = 'Pendiente' | 'Preparando' | 'Enviado' | 'Recibido' | 'Finalizado' | 'En mediación' | 'En disputa' | 'Cancelado' | 'Cancelado parcialmente';

export type SettlementStatus = 'Completada' | 'Enviado' | 'En disputa' | 'Cancelado';
export type LiquidationStatus = 'PENDIENTE_LIQUIDACION' | 'EN_LIQUIDACION' | 'LIQUIDADO';

export interface Order {
  id: string;
  date: string;
  buyer: string;
  seller: string;
  sellerFounder?: boolean;
  sellerTaxId?: string;
  sellerLegalName?: string;
  sellerEmail?: string;
  product: string;
  total: number;
  subtotalPublicado?: number;
  comisionServicio?: number;
  comisionServicioPorcentaje?: number;
  ivaComisionServicio?: number;
  comisionPagoFlowTotal?: number;
  comisionPagoFlowVendedor?: number;
  comisionPagoFlowRepuestop?: number;
  descuentosVendedor?: number;
  costoEnvio?: number;
  tasaPagoFlow?: number;
  liquidacionServicio?: number;
  montoPagarVendedor?: number;
  estadoLiquidacion?: LiquidationStatus;
  totalVentaDetalle?: Record<string, number>;
  totalVentaTooltip?: string;
  comisionPagoTooltip?: string;
  status: OrderStatus;
  updatedAt: string;
  liquidado?: boolean;
  cancellationTooltip?: string;
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

export type PartnerWithdrawalStatus = 'PENDIENTE' | 'PAGADO';

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
  // BO-SOCIOS-001: codigo legible (ej. "J-1"), estado de la solicitud y snapshot
  // bancario usado en la nomina BCI.
  codigoRetiro?: string | null;
  // BCI-NOMINA-002 (replicado para socios): alias fijo ("Jsazo", "Echoque") y si es la
  // primera solicitud sin pagar de ese socio; determinan la columna "Cuenta Destino
  // inscrita como" del Excel BCI.
  alias?: string | null;
  primeraSolicitud?: boolean;
  estado?: PartnerWithdrawalStatus;
  fechaPago?: string | null;
  rut?: string | null;
  banco?: string | null;
  bankCode?: number | null;
  tipoCuenta?: string | null;
  numeroCuenta?: string | null;
  titular?: string | null;
  email?: string | null;
  documentoLiquidacionNombre?: string | null;
  documentoLiquidacionTipo?: string | null;
  documentoLiquidacionRut?: string | null;
  documentoLiquidacionRazonSocial?: string | null;
  documentoLiquidacionEmail?: string | null;
  documentoLiquidacionDetalle?: string | null;
  documentoLiquidacionIva?: number | null;
  documentoLiquidacionCompleto?: boolean;
}

/** BO-SOCIOS-001: datos bancarios de un socio, para pagarle sus retiros por BCI. */
export interface Socio {
  id: number;
  nombre: string;
  rut?: string | null;
  banco?: string | null;
  bankCode?: number | null;
  tipoCuenta?: string | null;
  numeroCuenta?: string | null;
  titular?: string | null;
  email?: string | null;
  tieneDatosBancarios: boolean;
}

export interface SocioRequest {
  rut: string;
  banco: string;
  bankCode: number | null;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string;
  email: string;
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
  sellerFounder?: boolean;
  sellerTaxId?: string;
  sellerLegalName?: string;
  sellerEmail?: string;
  orderId: string;
  saleTotal: number;
  saleDetail: Record<string, number>;
  saleTooltip?: string;
  commission: number;
  serviceCommission: number;
  serviceCommissionRate: number;
  serviceCommissionIva: number;
  gatewayFeeSeller: number;
  gatewayFeeRepuestop: number;
  gatewayTooltip?: string;
  netSettlement: number;
  sellerPayout: number;
  liquidationStatus: LiquidationStatus;
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
  ivaLiquidado?: string;
  sentAt: string;
  pdfName?: string;
  pdfUrl?: string;
}

export interface DateFilter {
  query: string;
  start: string;
  end: string;
}

export type DateFilters = Record<AdminView, DateFilter>;

export type SelectedRows = Record<'pedidos' | 'liquidaciones' | 'gastos', Set<string>>;

export interface RetiroAdminResponse {
  retiroId: number;
  nombreTienda: string;
  sellerFounder?: boolean;
  rut: string;
  razonSocial: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  codigoRetiro?: string | null;
  // BCI-NOMINA-001: campos para completar la nomina "Pago en Linea" de BCI.
  // Columna K ("Mensaje Destinatario"): por defecto es "Pago retiro <codigo>" (solo si
  // hay email); un retiro de socio la sobreescribe con "Anticipo de Dividendos <socio>".
  mensajeDestinatario?: string | null;
  idExterno?: string | null;
  primeraSolicitud?: boolean;
  bankCode?: number | null;
  bankAccountHolderName?: string | null;
  bankAccountRutNumero?: string | null;
  bankAccountRutDv?: string | null;
  bankAccountRegistrationType?: string | null;
  bankAccountAliasValue?: string | null;
  bankAccountNotificationEmail?: string | null;
  monto: number;
  email: string;
  fecha: string;
  estado: string;
  fechaEfectiva: string;
  documentoLiquidacionNombre?: string;
  documentoLiquidacionTipo?: string;
  documentoLiquidacionRut?: string;
  documentoLiquidacionRazonSocial?: string;
  documentoLiquidacionEmail?: string;
  documentoLiquidacionDetalle?: string;
  documentoLiquidacionIva?: number;
  documentoLiquidacionCompleto?: boolean;
}

/** BCI-NOMINA-001: "Cuenta de Cargo" (cuenta de RepuesTop) usada en la nomina de pago BCI. */
export interface ConfiguracionPagos {
  cuentaCargoBci: string | null;
}

export interface RetiroPedidoItem {
  pedidoId: number;
  codigoExterno?: string;
  nombrePedido: string;
  fecha: string;
  cantidadVendida: number;
  valor: number;
}

export interface RetiroDetalleResponse {
  retiroId: number;
  fechaSolicitud: string;
  cantidadPedidos: number;
  montoTotal: number;
  estado: string;
  fechaEfectiva: string;
  pedidos: RetiroPedidoItem[];
}

export interface PagoProveedorResponse {
  pagoId: number;
  montoTotal: number;
  estado: string;
  fechaPago: string;
  periodoInicio?: string;
  periodoFin?: string;
  retiros: RetiroAdminResponse[];
  retirosSocios: Withdrawal[];
}
