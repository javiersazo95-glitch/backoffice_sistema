import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import { getSettlements } from '../utils';
import { desgloseGrupo, type Desglose } from './desglose';

/** Lo mínimo de un retiro para armar su desglose. */
export interface RetiroRef {
  retiroId: number;
  monto: number;
  nombreTienda: string;
  codigoRetiro?: string | null;
  proveedorId?: number | null;
}

/**
 * 13-oct: desglose de un retiro cuando la pantalla no tiene sus ventas a mano (Pago a proveedores,
 * carga de la boleta). Cruza los pedidos del retiro con las ventas del bootstrap (mismas query keys
 * que el resto del módulo, así que casi siempre sale de caché) y usa la factura del servidor.
 */
export function useRetiroDesglose(retiro: RetiroRef | null) {
  const retiroId = retiro?.retiroId ?? null;
  const detalle = useQuery({
    queryKey: ['admin-withdrawal-details', retiroId],
    queryFn: () => administrationApi.getWithdrawalDetails(retiroId!),
    enabled: retiroId !== null,
    staleTime: 60_000,
  });
  const bootstrap = useQuery({
    queryKey: ['administration-bootstrap'],
    queryFn: administrationApi.getBootstrap,
    enabled: retiroId !== null,
    staleTime: 60_000,
  });
  const factura = useQuery({
    queryKey: ['factura-comision', retiroId],
    queryFn: () => administrationApi.getFacturaComision(retiroId!),
    enabled: retiroId !== null,
    staleTime: 60_000,
  });

  const desglose = useMemo<Desglose | null>(() => {
    if (!retiro || !detalle.data || !bootstrap.data || factura.isLoading) return null;
    const pedidos = new Set(detalle.data.pedidos.filter((pedido) => !pedido.tipoCargo).map((pedido) => pedido.pedidoId));
    const settlements = getSettlements(bootstrap.data.orders ?? [], {}).filter((settlement) =>
      settlement.pedidoId !== undefined
      && pedidos.has(settlement.pedidoId)
      && (retiro.proveedorId == null || settlement.proveedorId == null || settlement.proveedorId === retiro.proveedorId));
    const resultado = desgloseGrupo(settlements, {
      titulo: `Desglose del retiro ${retiro.codigoRetiro ?? ''}`.trim(),
      subtitulo: `${retiro.nombreTienda} · ${settlements.length} venta${settlements.length === 1 ? '' : 's'}`,
      retiroMonto: retiro.monto,
      factura: factura.data ?? null,
    });
    if (!settlements.length) {
      resultado.avisos.unshift('No se encontraron las ventas de este retiro en el listado de liquidaciones: se muestran el monto del retiro y la boleta calculada por el servidor.');
    }
    return resultado;
  }, [retiro, detalle.data, bootstrap.data, factura.data, factura.isLoading]);

  const error = detalle.isError || bootstrap.isError ? 'No se pudieron cargar las ventas del retiro.' : null;
  return { desglose, cargando: !desglose && !error, error };
}
