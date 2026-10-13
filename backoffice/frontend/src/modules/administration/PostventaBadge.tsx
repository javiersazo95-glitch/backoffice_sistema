/**
 * 13-oct: etiqueta general de postventa de una venta (qué pasó después de la compra), según la
 * mediación de esa tienda: reembolsado, reemplazado, reparado, entrega conforme, etc. La calcula el
 * backend (`AdministracionContableService.postventa`); el detalle va en el title.
 */
const POSTVENTA: Record<string, { label: string; color: string; bg: string }> = {
  REEMBOLSADO: { label: 'Reembolsado', color: '#047857', bg: '#ecfdf5' },
  REEMBOLSO_EN_PROCESO: { label: 'Reembolso en proceso', color: '#b45309', bg: '#fffbeb' },
  REEMBOLSO_PARCIAL: { label: 'Reembolso parcial', color: '#b45309', bg: '#fffbeb' },
  DEVUELTO_POR_TIENDA: { label: 'Devuelto por la tienda', color: '#b45309', bg: '#fffbeb' },
  REEMPLAZADO: { label: 'Reemplazado', color: '#1d4ed8', bg: '#eff6ff' },
  REPARADO: { label: 'Reparado', color: '#1d4ed8', bg: '#eff6ff' },
  ENTREGA_CONFORME: { label: 'Entrega conforme', color: '#047857', bg: '#ecfdf5' },
  RECLAMO_RECHAZADO: { label: 'Reclamo rechazado', color: '#475569', bg: '#f1f5f9' },
  CERRADO_POR_SUSPENSION: { label: 'Cerrado por suspensión', color: '#b91c1c', bg: '#fef2f2' },
  PIDE_MEDIADOR: { label: 'Pide mediador', color: '#b91c1c', bg: '#fef2f2' },
  LISTO_PARA_RESOLVER: { label: 'Listo para resolver', color: '#7c3aed', bg: '#f5f3ff' },
  EN_CUESTIONARIO: { label: 'En cuestionario', color: '#7c3aed', bg: '#f5f3ff' },
};

export function postventaLabel(postventa: string | null | undefined): string | null {
  return postventa ? POSTVENTA[postventa]?.label ?? postventa : null;
}

export default function PostventaBadge({ postventa, detalle }: { postventa?: string | null; detalle?: string | null }) {
  if (!postventa) return null;
  const tone = POSTVENTA[postventa] ?? { label: postventa, color: '#475569', bg: '#f1f5f9' };
  return (
    <span
      title={detalle ?? undefined}
      style={{
        display: 'inline-block',
        marginTop: 4,
        padding: '1px 8px',
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {tone.label}
    </span>
  );
}
