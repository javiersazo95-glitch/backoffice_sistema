import type { AdvertisingOrder, Settlement } from '../types';
import type { FacturaComision } from '@/api/administration';

/**
 * 13-oct: desglose único de la información de pago. Cada monto de Administración Contable (venta,
 * descuentos, lo que recibe la tienda, la boleta de tarifa de servicio y la ganancia de RepuesTop)
 * se explica con esta misma estructura, para que todas las pantallas cuenten la misma historia.
 *
 * Fórmulas del servidor (LiquidacionPedidoCalculator / RetiroProveedorService):
 *   base de venta  = productos − descuento + despacho − reembolso por mediación   (`saleTotal`)
 *   descuentos     = comisión neta + IVA 19% de la comisión + cargo de pago Flow   (`commission`)
 *   recibe         = base − descuentos                                             (`sellerPayout`)
 *   boleta         = comisión + cargo de pago, cada uno neto + IVA (= descuentos)
 *   gana RepuesTop = comisión neta: el IVA va al SII y el cargo se le paga a Flow  (`netSettlement`)
 */

const IVA = 0.19;
/** Cargo fijo de Flow por reembolso, con IVA (202 + IVA). Va dentro del cargo de pago. */
const CARGO_FLOW_REEMBOLSO = 240;
/** Tolerancia de redondeo: el servidor redondea cada partida por separado. */
const TOLERANCIA = 2;

export type DesgloseFoco = 'venta' | 'descuentos' | 'recibe' | 'boleta' | 'ganancia';

export interface DesgloseLinea {
  concepto: string;
  monto: number;
  /** Texto chico bajo el concepto: de dónde sale. */
  nota?: string;
  /** Se muestra con signo menos (descuento o resta). */
  resta?: boolean;
  /** Fila informativa: no suma en el total. */
  informativa?: boolean;
}

export interface DesgloseBoletaLinea {
  concepto: string;
  neto: number;
  iva: number;
  total: number;
}

export interface DesgloseBoleta {
  titulo: string;
  lineas: DesgloseBoletaLinea[];
  neto: number;
  iva: number;
  total: number;
  porQue: string;
  /** Aviso si la factura del servidor no coincide con la suma de las ventas. */
  aviso?: string;
}

export interface DesgloseSeccion {
  titulo: string;
  lineas: DesgloseLinea[];
  total: number;
  etiquetaTotal: string;
  nota?: string;
}

export interface DesgloseHero {
  foco: DesgloseFoco;
  etiqueta: string;
  monto: number;
  detalle: string;
  tono: 'green' | 'blue' | 'violet' | 'slate';
}

export interface DesgloseVentaFila {
  id: string;
  pedido: string;
  base: number;
  descuentos: number;
  recibe: number;
  boleta: number;
  ganancia: number;
}

export interface Desglose {
  tipo: 'venta' | 'grupo' | 'recarga';
  titulo: string;
  subtitulo: string;
  heroes: DesgloseHero[];
  venta: DesgloseSeccion;
  descuentos: DesgloseSeccion | null;
  recibe: DesgloseSeccion | null;
  boleta: DesgloseBoleta | null;
  ganancia: DesgloseSeccion;
  avisos: string[];
  cuadre: { ok: boolean; texto: string } | null;
  ventas?: DesgloseVentaFila[];
}

const pct = (rate: number) => `${(Math.round(rate * 10000) / 100).toLocaleString('es-CL')}%`;
const money = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;

/** El cargo de pago llega con IVA incluido; el servidor lo separa así para la factura. */
export function separarCargoPago(cargo: number) {
  const neto = Math.round(cargo / (1 + IVA));
  return { neto, iva: cargo - neto };
}

/** Lo que va en la boleta o factura por esta venta (comisión + cargo de pago, con IVA). */
export function boletaDeVenta(settlement: Settlement) {
  const cargo = separarCargoPago(settlement.gatewayFeeSeller);
  return {
    cargoNeto: cargo.neto,
    cargoIva: cargo.iva,
    neto: settlement.serviceCommission + cargo.neto,
    iva: settlement.serviceCommissionIva + cargo.iva,
    total: settlement.serviceCommission + settlement.serviceCommissionIva + settlement.gatewayFeeSeller,
  };
}

/**
 * 18-oct: el fundador se detecta por el flag del servidor, no por la tasa. Hoy la marcha blanca es
 * 0% de tarifa de servicio; las ventas fundadoras antiguas (al 5%) muestran su tasa guardada.
 */
function comisionLabel(settlement: Settlement) {
  const rate = settlement.serviceCommissionRate;
  if (!settlement.sellerFounder) return `Comisión de servicio RepuesTop (${pct(rate)})`;
  return rate > 0
    ? `Tarifa RepuesTop Fundador (${pct(rate)})`
    : 'Tarifa RepuesTop Fundador (0% · marcha blanca)';
}

const BOLETA_POR_QUE =
  'Es exactamente lo que RepuesTop le descontó a la tienda: comisión + cargo de pago, cada uno con IVA 19%.';

function lineasVenta(settlement: Settlement): DesgloseLinea[] {
  const detalle = Object.entries(settlement.saleDetail ?? {});
  if (!detalle.length) return [{ concepto: 'Venta', monto: settlement.saleTotal }];
  return detalle.map(([concepto, monto]) => ({ concepto, monto: Math.abs(monto), resta: monto < 0 }));
}

function lineasDescuentos(s: {
  comisionLabel: string;
  comision: number;
  ivaComision: number;
  cargo: number;
  reembolsos: number;
  base: number;
}): DesgloseLinea[] {
  const cargoReembolso = s.reembolsos > 0 ? Math.min(s.cargo, CARGO_FLOW_REEMBOLSO * s.reembolsos) : 0;
  const cargoVenta = s.cargo - cargoReembolso;
  const cargoSplit = separarCargoPago(cargoVenta);
  const lineas: DesgloseLinea[] = [
    { concepto: s.comisionLabel, monto: s.comision, resta: true },
    { concepto: 'IVA 19% de la comisión', monto: s.ivaComision, resta: true },
    {
      concepto: 'Cargo de pago Flow (2,89% + IVA)',
      monto: cargoVenta,
      nota: `Neto ${money(cargoSplit.neto)} + IVA ${money(cargoSplit.iva)}`,
      resta: true,
    },
  ];
  if (cargoReembolso > 0) {
    lineas.push({ concepto: 'Cargo Flow por reembolso', monto: cargoReembolso, nota: '$202 + IVA por cada reembolso procesado', resta: true });
  }
  return lineas;
}

/** Desglose de una venta (una liquidación). */
export function desgloseVenta(settlement: Settlement, contexto: { titulo?: string; pedido?: string } = {}): Desglose {
  const boleta = boletaDeVenta(settlement);
  const recibeCalculado = settlement.saleTotal - settlement.commission;
  const gananciaCalculada = settlement.commission - boleta.iva - boleta.cargoNeto;
  const avisos: string[] = [];
  if (settlement.montoReembolsado > 0) {
    avisos.push(`Se reembolsaron ${money(settlement.montoReembolsado)} al comprador por mediación: la base y la comisión ya lo descuentan.`);
  }
  if (settlement.saldoEnContra > 0) {
    avisos.push(`El reembolso llegó después de pagarle a la tienda: queda un saldo en contra de ${money(settlement.saldoEnContra)} que se descuenta de su retiro siguiente (${(settlement.saldoEnContraEstado ?? 'pendiente').toLowerCase()}).`);
  }

  return {
    tipo: 'venta',
    titulo: contexto.titulo ?? `Desglose de la liquidación ${settlement.id}`,
    subtitulo: `${settlement.seller}${contexto.pedido ? ` · Pedido ${contexto.pedido}` : ''}`,
    heroes: [
      { foco: 'recibe', etiqueta: 'La tienda recibe', monto: settlement.sellerPayout, detalle: 'Se le transfiere en su retiro', tono: 'green' },
      { foco: 'boleta', etiqueta: 'Boleta a emitir (tarifa de servicio)', monto: boleta.total, detalle: `Neto ${money(boleta.neto)} + IVA ${money(boleta.iva)}`, tono: 'blue' },
      { foco: 'ganancia', etiqueta: 'RepuesTop gana', monto: settlement.netSettlement, detalle: 'Comisión sin IVA', tono: 'violet' },
    ],
    venta: {
      titulo: 'Venta',
      lineas: lineasVenta(settlement),
      total: settlement.saleTotal,
      etiquetaTotal: 'Base de venta',
    },
    descuentos: {
      titulo: 'Descuentos a la tienda',
      lineas: lineasDescuentos({
        comisionLabel: comisionLabel(settlement),
        comision: settlement.serviceCommission,
        ivaComision: settlement.serviceCommissionIva,
        cargo: settlement.gatewayFeeSeller,
        reembolsos: settlement.montoReembolsado > 0 ? 1 : 0,
        base: settlement.saleTotal,
      }),
      total: settlement.commission,
      etiquetaTotal: 'Total descontado',
    },
    recibe: {
      titulo: 'Monto que recibe la tienda',
      lineas: [
        { concepto: 'Base de venta', monto: settlement.saleTotal },
        { concepto: 'Total descontado', monto: settlement.commission, resta: true },
      ],
      total: settlement.sellerPayout,
      etiquetaTotal: 'La tienda recibe',
      nota: Math.abs(recibeCalculado - settlement.sellerPayout) > TOLERANCIA
        ? `El servidor informa ${money(settlement.sellerPayout)}; la resta da ${money(recibeCalculado)}.`
        : undefined,
    },
    boleta: {
      titulo: 'Boleta o factura por tarifa de servicio',
      lineas: [
        { concepto: 'Comisión de servicio RepuesTop', neto: settlement.serviceCommission, iva: settlement.serviceCommissionIva, total: settlement.serviceCommission + settlement.serviceCommissionIva },
        { concepto: 'Cargo por procesamiento de pago', neto: boleta.cargoNeto, iva: boleta.cargoIva, total: settlement.gatewayFeeSeller },
      ],
      neto: boleta.neto,
      iva: boleta.iva,
      total: boleta.total,
      porQue: `${BOLETA_POR_QUE} Se emite una por retiro, sumando sus ventas.`,
    },
    ganancia: {
      titulo: 'Lo que gana RepuesTop',
      lineas: [
        { concepto: 'Total descontado a la tienda', monto: settlement.commission },
        { concepto: 'IVA de la boleta (se paga al SII)', monto: boleta.iva, resta: true },
        { concepto: 'Cargo de pago neto (se le paga a Flow)', monto: boleta.cargoNeto, resta: true },
      ],
      total: settlement.netSettlement,
      etiquetaTotal: 'Ganancia neta RepuesTop',
      nota: `70% a caja (${money(Math.round(settlement.netSettlement * 0.7))}) · 30% a socios (${money(settlement.netSettlement - Math.round(settlement.netSettlement * 0.7))})${Math.abs(gananciaCalculada - settlement.netSettlement) > TOLERANCIA ? ` · la resta da ${money(gananciaCalculada)}` : ''}`,
    },
    avisos,
    cuadre: cuadre(settlement.saleTotal, settlement.sellerPayout, boleta.total),
  };
}

function cuadre(base: number, recibe: number, boleta: number) {
  const ok = Math.abs(base - (recibe + boleta)) <= TOLERANCIA;
  return {
    ok,
    texto: ok
      ? `Cuadra: base de venta ${money(base)} = la tienda recibe ${money(recibe)} + boleta ${money(boleta)}`
      : `No cuadra: base de venta ${money(base)} ≠ recibe ${money(recibe)} + boleta ${money(boleta)} (diferencia ${money(base - recibe - boleta)})`,
  };
}

/**
 * Desglose de varias ventas: el grupo de un vendedor en liquidación, un retiro o el total de un
 * período. `retiroMonto` es lo que pide el retiro (ya descuenta saldos en contra); `factura` es la
 * boleta calculada por el servidor para ese retiro.
 */
export function desgloseGrupo(
  settlements: Settlement[],
  opciones: { titulo: string; subtitulo: string; retiroMonto?: number | null; factura?: FacturaComision | null; recibeEtiqueta?: string },
): Desglose {
  const sum = (pick: (s: Settlement) => number) => settlements.reduce((total, s) => total + pick(s), 0);
  const base = sum((s) => s.saleTotal);
  const descuentos = sum((s) => s.commission);
  const comision = sum((s) => s.serviceCommission);
  const ivaComision = sum((s) => s.serviceCommissionIva);
  const cargo = sum((s) => s.gatewayFeeSeller);
  const payout = sum((s) => s.sellerPayout);
  // Sin ventas cruzadas (retiro sin datos en el bootstrap) la ganancia sale de la factura del servidor.
  const ganancia = settlements.length ? sum((s) => s.netSettlement) : (opciones.factura?.lineas[0]?.neto ?? 0);
  const reembolsos = settlements.filter((s) => s.montoReembolsado > 0).length;
  const boletas = settlements.map(boletaDeVenta);
  const boletaNeto = boletas.reduce((t, b) => t + b.neto, 0);
  const boletaIva = boletas.reduce((t, b) => t + b.iva, 0);
  const cargoNeto = boletas.reduce((t, b) => t + b.cargoNeto, 0);
  const boletaTotal = boletas.reduce((t, b) => t + b.total, 0);

  const retiroMonto = opciones.retiroMonto ?? null;
  const saldosEnContra = retiroMonto !== null ? Math.max(0, Math.round(payout - retiroMonto)) : 0;
  const recibe = retiroMonto ?? payout;
  const factura = opciones.factura ?? null;
  const rates = [...new Set(settlements.map((s) => Math.round(s.serviceCommissionRate * 10000)))];
  // Si todas las ventas son de la misma tienda fundadora, la etiqueta dice lo mismo que en cada venta.
  const todasFundadoras = settlements.length > 0 && settlements.every((s) => s.sellerFounder);
  const comisionEtiqueta = rates.length === 1 && todasFundadoras
    ? comisionLabel(settlements[0]!)
    : rates.length === 1
      ? `Comisión de servicio RepuesTop (${pct(rates[0]! / 10000)})`
      : 'Comisión de servicio RepuesTop (según la tasa de cada venta)';

  const avisos: string[] = [];
  if (reembolsos > 0) avisos.push(`${reembolsos} venta${reembolsos === 1 ? '' : 's'} con reembolso por mediación: la base y la comisión ya lo descuentan.`);
  if (saldosEnContra > 0) {
    avisos.push(`El retiro pide ${money(retiroMonto!)} y no ${money(payout)}: se descuentan ${money(saldosEnContra)} de saldos en contra (reembolsos de ventas que ya se le habían pagado).`);
  } else if (settlements.length && retiroMonto !== null && Math.abs(retiroMonto - payout) > TOLERANCIA) {
    avisos.push(`El retiro pide ${money(retiroMonto)} y la suma de las ventas mostradas da ${money(payout)}: el retiro puede incluir ventas fuera del rango de fechas filtrado.`);
  }

  const boletaFinal: DesgloseBoleta = factura
    ? {
      titulo: 'Boleta o factura por tarifa de servicio',
      lineas: factura.lineas.map((l) => ({ concepto: l.concepto, neto: l.neto, iva: l.iva, total: l.neto + l.iva })),
      neto: factura.neto,
      iva: factura.iva,
      total: factura.total,
      porQue: `${BOLETA_POR_QUE} Una sola boleta por el retiro${factura.codigoRetiro ? ` ${factura.codigoRetiro}` : ''}.`,
      aviso: settlements.length && Math.abs(factura.total - boletaTotal) > TOLERANCIA * Math.max(1, settlements.length)
        ? `La suma por venta mostrada da ${money(boletaTotal)}; manda el monto calculado por el servidor para el retiro (${money(factura.total)}).`
        : undefined,
    }
    : {
      titulo: 'Boleta o factura por tarifa de servicio',
      lineas: [
        { concepto: 'Comisión de servicio RepuesTop', neto: comision, iva: ivaComision, total: comision + ivaComision },
        { concepto: 'Cargo por procesamiento de pago', neto: cargoNeto, iva: boletaIva - ivaComision, total: cargo },
      ],
      neto: boletaNeto,
      iva: boletaIva,
      total: boletaTotal,
      porQue: `${BOLETA_POR_QUE} Se emite una por retiro, sumando sus ventas.`,
    };

  const recibeLineas: DesgloseLinea[] = settlements.length || retiroMonto === null ? [
    { concepto: 'Base de venta', monto: base },
    { concepto: 'Total descontado', monto: descuentos, resta: true },
  ] : [{ concepto: 'Monto del retiro', monto: retiroMonto }];
  if (saldosEnContra > 0) recibeLineas.push({ concepto: 'Saldos en contra descontados en este retiro', monto: saldosEnContra, resta: true, nota: 'Reembolsos de ventas ya pagadas' });

  return {
    tipo: 'grupo',
    titulo: opciones.titulo,
    subtitulo: opciones.subtitulo,
    heroes: [
      { foco: 'recibe', etiqueta: opciones.recibeEtiqueta ?? 'La tienda recibe', monto: recibe, detalle: retiroMonto !== null ? 'Monto del retiro a transferir' : `${settlements.length} venta${settlements.length === 1 ? '' : 's'}`, tono: 'green' },
      { foco: 'boleta', etiqueta: 'Boleta a emitir (tarifa de servicio)', monto: boletaFinal.total, detalle: `Neto ${money(boletaFinal.neto)} + IVA ${money(boletaFinal.iva)}`, tono: 'blue' },
      { foco: 'ganancia', etiqueta: 'RepuesTop gana', monto: ganancia, detalle: 'Comisión sin IVA', tono: 'violet' },
    ],
    venta: {
      titulo: 'Ventas',
      lineas: [{ concepto: `${settlements.length} venta${settlements.length === 1 ? '' : 's'} (productos + despacho − descuentos)`, monto: base }],
      total: base,
      etiquetaTotal: 'Base de venta',
    },
    descuentos: {
      titulo: 'Descuentos a la tienda',
      lineas: lineasDescuentos({ comisionLabel: comisionEtiqueta, comision, ivaComision, cargo, reembolsos, base }),
      total: descuentos,
      etiquetaTotal: 'Total descontado',
    },
    recibe: {
      titulo: 'Monto que recibe la tienda',
      lineas: recibeLineas,
      total: recibe,
      etiquetaTotal: opciones.recibeEtiqueta ?? 'La tienda recibe',
    },
    boleta: boletaFinal,
    ganancia: {
      titulo: 'Lo que gana RepuesTop',
      lineas: [
        { concepto: 'Total descontado a las tiendas', monto: descuentos },
        { concepto: 'IVA de la boleta (se paga al SII)', monto: boletaIva, resta: true },
        { concepto: 'Cargo de pago neto (se le paga a Flow)', monto: cargoNeto, resta: true },
      ],
      total: ganancia,
      etiquetaTotal: 'Ganancia neta RepuesTop',
      nota: `70% a caja (${money(Math.round(ganancia * 0.7))}) · 30% a socios (${money(ganancia - Math.round(ganancia * 0.7))})`,
    },
    avisos,
    cuadre: settlements.length ? cuadre(base, payout, boletaTotal) : null,
    ventas: settlements.map((s) => ({
      id: s.id,
      pedido: s.orderId,
      base: s.saleTotal,
      descuentos: s.commission,
      recibe: s.sellerPayout,
      boleta: boletaDeVenta(s).total,
      ganancia: s.netSettlement,
    })),
  };
}

/**
 * Desglose de una compra de Monedas. RepuesTop vende directo y asume la comisión de Flow (14-oct):
 * ganancia = venta sin IVA − comisión de Flow sin IVA; el IVA de Flow es crédito fiscal.
 */
export function desgloseRecarga(ad: AdvertisingOrder): Desglose {
  const iva = ad.ivaVenta ?? Math.round(ad.montoPagado - ad.montoPagado / (1 + IVA));
  const neto = ad.montoPagado - iva;
  const flowIva = ad.ivaPasarela ?? Math.round(ad.comisionPasarela - ad.comisionPasarela / (1 + IVA));
  const flowNeto = ad.comisionPasarela - flowIva;
  const ganancia = neto - flowNeto;
  return {
    tipo: 'recarga',
    titulo: `Desglose de la recarga ${ad.codigo}`,
    subtitulo: `${ad.comprador ?? 'Comprador'}${ad.pack ? ` · ${ad.pack}` : ''}`,
    heroes: [
      { foco: 'venta', etiqueta: 'Pagó el comprador', monto: ad.montoPagado, detalle: 'Con IVA incluido', tono: 'slate' },
      { foco: 'boleta', etiqueta: 'Documento al comprador', monto: ad.montoPagado, detalle: `Neto ${money(neto)} + IVA ${money(iva)}`, tono: 'blue' },
      { foco: 'ganancia', etiqueta: 'RepuesTop gana', monto: ganancia, detalle: 'Venta sin IVA − Flow sin IVA', tono: 'violet' },
    ],
    venta: {
      titulo: 'Venta de Monedas',
      lineas: [{ concepto: `${ad.cantidadFichas} Monedas${ad.pack ? ` (${ad.pack})` : ''}`, monto: ad.montoPagado }],
      total: ad.montoPagado,
      etiquetaTotal: 'Monto pagado',
    },
    descuentos: null,
    recibe: null,
    boleta: {
      titulo: 'Boleta o factura al comprador',
      lineas: [{ concepto: 'Venta de Monedas', neto, iva, total: ad.montoPagado }],
      neto,
      iva,
      total: ad.montoPagado,
      porQue: 'RepuesTop vende directo: emite el documento por el total pagado; el IVA va al SII.',
    },
    ganancia: {
      titulo: 'Lo que gana RepuesTop',
      lineas: [
        { concepto: 'Monto pagado por el comprador', monto: ad.montoPagado },
        { concepto: 'IVA de la venta (se paga al SII)', monto: iva, resta: true },
        {
          concepto: 'Comisión Flow sin IVA (la asume RepuesTop)',
          monto: flowNeto,
          resta: true,
          nota: `Flow cobra ${money(ad.comisionPasarela)}; su IVA ${money(flowIva)} es crédito fiscal`,
        },
      ],
      total: ganancia,
      etiquetaTotal: 'Ganancia RepuesTop',
      nota: `70% a caja (${money(Math.round(ganancia * 0.7))}) · 30% a socios (${money(ganancia - Math.round(ganancia * 0.7))})${Math.abs(ganancia - ad.montoNeto) > TOLERANCIA ? ` · el servidor informa ${money(ad.montoNeto)}` : ''}`,
    },
    avisos: [],
    cuadre: null,
  };
}
