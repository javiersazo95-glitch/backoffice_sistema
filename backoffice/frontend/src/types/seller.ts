export enum SellerStatus {
  APROBADO = 'APROBADO',
  POR_CORREGIR = 'POR_CORREGIR',
  RECHAZADO = 'RECHAZADO',
  SUSPENDIDO = 'SUSPENDIDO',
}

export enum TrustLevel {
  ALTO = 'ALTO',
  MEDIO = 'MEDIO',
  BAJO = 'BAJO',
}

export enum BankStatus {
  VERIFICADA = 'VERIFICADA',
  PENDIENTE = 'PENDIENTE',
  BLOQUEADA = 'BLOQUEADA',
}

export interface SellerResponse {
  id: number;
  externalId: string;
  storeName: string;
  rut: string;
  city: string;
  status: SellerStatus;
  trustLevel: TrustLevel;
  trustScore: number;
  rating: number;
  /** No lo envia el backend hoy; se deja opcional para no mostrar "undefined". */
  responseTime?: string;
  openTickets: number;
  mediationCount: number;
  returnsCount: number;
  claimsCount: number;
  pendingReceipts: number;
  partsCount: number;
  salesCount: number;
  createdAt?: string;
  documentsSummary: string;
  /** No lo envia el backend hoy; el estado de bloqueo sale de `status`. */
  bankStatus?: BankStatus;
  lastActivityAt: string;
  address?: string;
  email?: string;
  phone?: string;
  cargo?: string;
  owner?: string;
  userProfileUrl?: string | null;
  // Razón social registrada para el retiro de dinero (giro comercial del vendedor)
  razonSocial?: string | null;
  // Cuenta bancaria real del vendedor
  bankName?: string | null;
  bankAccountHolderName?: string | null;
  bankAccountRut?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountUpdatedAt?: string | null;
  founder?: boolean;
  founderSince?: string | null;
}

export interface SellerDetailResponse extends SellerResponse {
  documents: SellerDocumentResponse[];
  tickets: import('./ticket').TicketResponse[];
  mediations: import('./mediation').MediationSummaryResponse[];
  risks: import('./alert').AlertResponse[];
}

export interface SellerBlockHistoryResponse {
  id: string;
  sellerId: number;
  mediationId?: number | null;
  externalId?: string | null;
  action: string;
  reason?: string | null;
  detail?: string | null;
  operator?: string | null;
  status?: string | null;
  source: string;
  createdAt: string;
}

export interface SellerRetiroResponse {
  retiroId: number;
  codigoExterno?: string | null;
  fechaSolicitud: string;
  cantidadPedidos: number;
  montoTotal: number;
  estado: string;
  fechaEfectiva: string;
  /** Solo con estado RECHAZADO: por que reboto el deposito, cuando y quien lo marco. */
  motivoRechazo?: string | null;
  rechazadoAt?: string | null;
  rechazadoPor?: string | null;
  /** Retiro con que el vendedor volvio a cobrar tras el rechazo; null si aun no lo pide. */
  reintentoCodigo?: string | null;
  reintentoFecha?: string | null;
  montoReembolsoMediacion?: number | null;
}

export interface SellerDocumentResponse {
  id: number;
  sellerId: number;
  documentType: string;
  documentUrl?: string;
  uploadedAt: string;
  dueAt: string;
  status: import('./validation').ValidationStatus;
  owner: string;
  notes: string;
}

export interface SellerSaleResponse {
  id: number;
  buyerName?: string;
  total?: number;
  totalSeller?: number;
  status: string;
  createdAt: string;
  /** O72: el numero publico del pedido agrupado ("4827 1936 00-2" en la vista de la tienda). */
  numeroPedidoFormato?: string;
  numeroPedido?: string;
  codigoSoporte?: string;
  items: Array<{
    name: string;
    codigoVendedor?: string;
  }>;
}

export interface SellerFilterRequest {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

export type NivelSuspension = 'TEMPORAL' | 'DEFINITIVA' | 'FRAUDE';

export interface SuspendSellerRequest {
  reason: string;
  /** H59: sin nivel, el backend la toma como DEFINITIVA. */
  nivel?: NivelSuspension;
  /** H59: 3_DIAS, 7_DIAS, 15_DIAS, 1_MES o 3_MESES; obligatoria en TEMPORAL. */
  duracion?: string;
  /** H59 fase 6: obligatoria en FRAUDE (solo SUPER_ADMIN). Interna. */
  evidencia?: string;
}

/**
 * Cuanto cancela una tienda, de `GET /sellers/cancellation-rates`.
 *
 * Cancelar le sale gratis al vendedor: el comprador recibe el 100% -- como debe ser -- pero la
 * nota publica se arma con las calificaciones de compras FINALIZADAS, asi que una venta cancelada
 * ni siquiera entra en el promedio. Esta metrica existe para verlo; no castiga a nadie.
 */
export interface SellerCancellationRate {
  proveedorId: number;
  tienda: string;
  ventas: number;
  canceladas: number;
  /** Porcentaje con un decimal. */
  tasa: number;
  /** Pasa el umbral Y tiene ventas suficientes para que el numero signifique algo. */
  superaUmbral: boolean;
}
