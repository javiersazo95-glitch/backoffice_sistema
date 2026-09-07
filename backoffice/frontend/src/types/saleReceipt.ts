/** Una subordén en el panel de cumplimiento de boletas de venta. */
export interface SaleReceiptCompliance {
  subordenId: number;
  pedidoId: number;
  codigoPedido: string;
  proveedorId: number;
  tienda: string | null;
  comprador: string | null;
  compradorEmail: string | null;
  fechaPedido: string | null;
  estado: string;
  tipoDocumentoTributario: string | null;
  boletaCargada: boolean;
  boletaNombre: string | null;
  boletaSubidaAt: string | null;
}
