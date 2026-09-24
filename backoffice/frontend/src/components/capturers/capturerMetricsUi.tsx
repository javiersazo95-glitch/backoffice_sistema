import type { ReactNode } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import type { SocialNivelCodigo } from '@/types/capturerSocial';

// Piezas visuales compartidas por las vistas "Compradores captados" y "Redes sociales" de
// Captadores (prefijo cpx-*, en la línea de las tarjetas cps-* de la página).

export type KpiTone = 'blue' | 'green' | 'violet' | 'amber' | 'red';

export const NIVEL_META: Record<SocialNivelCodigo, { label: string; color: string }> = {
  BRONCE: { label: 'Bronce', color: '#c07a42' },
  PLATA: { label: 'Plata', color: '#98a6b9' },
  ORO: { label: 'Oro', color: '#e0b12e' },
  PLATINO: { label: 'Platino', color: '#4fa6c2' },
  DIAMANTE: { label: 'Diamante', color: '#5a6ff5' },
};

export function Kpi({ icon, label, value, foot, tone }: { icon: string; label: string; value: string; foot: string; tone: KpiTone }) {
  return <article className="cpx-kpi">
    <span className={`cpx-ico cpx-${tone}`}><UiIcon name={icon} /></span>
    <div><span className="cpx-kpi-label">{label}</span><strong className="cpx-kpi-value">{value}</strong><small>{foot}</small></div>
  </article>;
}

/** Barra horizontal simple (sin librería de gráficos). */
export function BarRow({ label, value, max, color, suffix }: { label: ReactNode; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
  return <div className="cpx-bar-row">
    <span className="cpx-bar-label">{label}</span>
    <div className="cpx-bar"><div style={{ width: `${pct}%`, background: color }} /></div>
    <b>{value.toLocaleString('es-CL')}{suffix ?? ''}</b>
  </div>;
}

export function NivelBadge({ nivel }: { nivel?: string | null }) {
  const meta = nivel ? NIVEL_META[nivel as SocialNivelCodigo] : undefined;
  if (!meta) return <span className="cpx-muted">—</span>;
  return <span className="cpx-medal" style={{ borderColor: meta.color, color: meta.color }}><i style={{ background: meta.color }} />{meta.label}</span>;
}

export const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '0%');

export const cpxCss = `
.cpx{display:grid;gap:14px}
.cpx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:11px}
.cpx-kpi{display:flex;gap:10px;align-items:flex-start;padding:15px;background:#fff;border:1px solid var(--line,#e6edf7);border-radius:16px;box-shadow:0 6px 18px rgba(15,44,92,.04);min-width:0}
.cpx-kpi>div{min-width:0}
.cpx-kpi-label{display:block;font-size:11.5px;font-weight:600;color:#42557d}
.cpx-kpi-value{display:block;margin-top:6px;font-size:24px;font-weight:850;letter-spacing:-.02em;white-space:nowrap;color:#0b2559}
.cpx-kpi small{display:block;margin-top:4px;font-size:11px;color:#7286a8}
.cpx-ico{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:12px}
.cpx-ico svg{width:19px;height:19px}
.cpx-blue{background:#e6efff;color:#1657d9}.cpx-green{background:#dcf7e8;color:#087b42}.cpx-violet{background:#efe8ff;color:#6d3fd6}.cpx-amber{background:#fef2e0;color:#c2760b}.cpx-red{background:#fde8e8;color:#b42318}
.cpx-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.cpx-card{background:#fff;border:1px solid var(--line,#e6edf7);border-radius:16px;box-shadow:0 6px 18px rgba(15,44,92,.04);padding:16px;min-width:0}
.cpx-card h3{margin:0 0 4px;font-size:15px;font-weight:850;color:#0b2559}
.cpx-card>p{margin:0 0 12px;font-size:12.5px;color:#7286a8}
.cpx-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.cpx-head h2{margin:0;font-size:17px;font-weight:850;color:#0b2559}
.cpx-head p{margin:3px 0 0;font-size:12.5px;color:#7286a8}
.cpx-field{display:grid;gap:4px;font-size:11.5px;font-weight:700;color:#42557d}
.cpx-field input,.cpx-field select{padding:9px 11px;border:1px solid #d7e0ee;border-radius:10px;font:inherit;font-size:13px;color:#0b2559;background:#fff}
.cpx-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.cpx-bar-row{display:grid;grid-template-columns:minmax(90px,160px) 1fr auto;gap:10px;align-items:center;padding:5px 0;font-size:12.5px;color:#31456e}
.cpx-bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cpx-bar{height:9px;border-radius:99px;background:#eef3fa;overflow:hidden}
.cpx-bar>div{height:100%;border-radius:99px;transition:width .5s}
.cpx-bar-row b{font-size:12.5px;color:#0b2559;min-width:36px;text-align:right}
.cpx-medal{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border:1px solid;border-radius:99px;font-size:11.5px;font-weight:800;white-space:nowrap;background:#fff}
.cpx-medal i{width:8px;height:8px;border-radius:50%}
.cpx-muted{color:#7286a8}
.cpx-table{width:100%;border-collapse:collapse;font-size:13px}
.cpx-table th{padding:11px 10px;text-align:left;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7286a8;border-bottom:1px solid #e6edf7;white-space:nowrap}
.cpx-table td{padding:10px;border-bottom:1px solid #f1f5fb;color:#31456e;vertical-align:middle}
.cpx-table tbody tr:hover{background:#f8fbff}
.cpx-table-wrap{overflow-x:auto}
.cpx-empty{padding:22px;text-align:center;color:#7286a8}
.cpx-thumb{width:46px;height:58px;border-radius:9px;object-fit:cover;background:#0b1730;display:block}
.cpx-state{display:inline-block;padding:4px 10px;border-radius:8px;font-size:11.5px;font-weight:800}
.cpx-state-PUBLICADO{background:#dcf7e8;color:#087b42}.cpx-state-OCULTO{background:#fde8e8;color:#b42318}
.cpx-btn{padding:7px 11px;border-radius:9px;border:1px solid #d9e3f3;background:#fff;color:#1657d9;font:inherit;font-size:12.5px;font-weight:750;cursor:pointer}
.cpx-btn:hover{background:#f1f6ff}
.cpx-btn-danger{color:#b42318;border-color:#f3c9c5}
.cpx-btn-danger:hover{background:#fde8e8}
.cpx-pager{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:10px;font-size:12.5px;color:#7286a8}
.cpx-rank{display:grid;gap:6px}
.cpx-rank-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:11px;background:#f7f9fd;font-size:13px}
.cpx-rank-row em{font-style:normal;display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:#e6efff;color:#1657d9;font-size:12px;font-weight:850}
.cpx-rank-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#0b2559;font-weight:700}
.cpx-rank-row b{color:#0b2559}
.cpx-note{padding:10px 12px;border-radius:12px;background:#eef4ff;color:#14459b;font-size:12.5px}
@media (max-width:900px){.cpx-grid2{grid-template-columns:1fr}}
`;
