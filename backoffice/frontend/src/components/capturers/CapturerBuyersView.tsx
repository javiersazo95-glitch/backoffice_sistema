import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCapturedBuyers, getSocialMetricas } from '@/api/capturerSocial';
import { formatCurrency } from '@/utils/formatters';
import type { CapturerProfile } from '@/types/capturer';
import { BarRow, Kpi, NivelBadge, cpxCss, pct } from './capturerMetricsUi';

/**
 * Compradores captados: compradores que se registraron con el código de un captador. El
 * captador gana un % de sus compras y, al completar la primera compra, suma puntos de nivel.
 */
export default function CapturerBuyersView({ all }: { all: CapturerProfile[] }) {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [abierto, setAbierto] = useState<number | null>(null);
  const metricas = useQuery({ queryKey: ['trust-capturers-social-metrics', periodo], queryFn: () => getSocialMetricas(periodo) });
  const m = metricas.data;

  const ranking = useMemo(() => [...all]
    .map(c => ({ c, captados: c.compradoresCaptados ?? 0, convertidos: c.compradoresConvertidos ?? 0 }))
    .sort((a, b) => b.convertidos - a.convertidos || b.captados - a.captados), [all]);
  const conCompradores = ranking.filter(r => r.captados > 0);
  const maxCaptados = Math.max(1, ...ranking.map(r => r.captados));

  return <div className="cpx">
    <style>{cpxCss}</style>
    <div className="cpx-head">
      <div><h2>Compradores captados</h2><p>Compradores que ingresaron el código de un captador al crear su cuenta (manual o con Google).</p></div>
      <label className="cpx-field">Periodo de comisión<input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} /></label>
    </div>
    <section className="cpx-kpis">
      <Kpi icon="users" tone="blue" label="Compradores referidos" value={m ? m.compradoresReferidos.toLocaleString('es-CL') : '—'} foot="Registrados con un código de captador" />
      <Kpi icon="cart" tone="green" label="Compradores captados" value={m ? m.compradoresConvertidos.toLocaleString('es-CL') : '—'} foot="Con al menos una compra pagada" />
      <Kpi icon="percent" tone="violet" label="Tasa de conversión" value={m ? pct(m.compradoresConvertidos, m.compradoresReferidos) : '—'} foot="Referidos que ya compraron" />
      <Kpi icon="wallet" tone="amber" label="Comisión por compradores" value={m ? formatCurrency(m.comisionCompradoresPeriodo) : '—'} foot={`Neta del periodo ${periodo}`} />
      <Kpi icon="target" tone="blue" label="Captadores con compradores" value={String(conCompradores.length)} foot={`de ${all.length} captadores aprobados`} />
    </section>

    <div className="cpx-grid2">
      <section className="cpx-card">
        <h3>Top captadores por compradores</h3>
        <p>Compradores referidos por captador (la barra) y cuántos ya compraron.</p>
        {conCompradores.length ? conCompradores.slice(0, 8).map(r => <BarRow key={r.c.id} label={`@${r.c.alias}`} value={r.captados} max={maxCaptados} color="#1657d9" suffix={` · ${r.convertidos} ✓`} />)
          : <div className="cpx-empty">Aún no hay compradores referidos.</div>}
      </section>
      <section className="cpx-card">
        <h3>Embudo del programa</h3>
        <p>De registro con código a su primera compra.</p>
        <BarRow label="Referidos" value={m?.compradoresReferidos ?? 0} max={Math.max(1, m?.compradoresReferidos ?? 0)} color="#1657d9" />
        <BarRow label="Con 1ª compra" value={m?.compradoresConvertidos ?? 0} max={Math.max(1, m?.compradoresReferidos ?? 0)} color="#0f8a4d" />
        <div className="cpx-note" style={{ marginTop: 10 }}>Cada comprador captado suma puntos al captador (50 compradores = 100 pts) y sube su medalla del repositorio de redes sociales.</div>
      </section>
    </div>

    <section className="cpx-card">
      <h3>Detalle por captador</h3>
      <p>Haz clic en un captador para ver sus compradores (el correo se muestra enmascarado).</p>
      <div className="cpx-table-wrap">
        <table className="cpx-table">
          <thead><tr><th>Captador</th><th>Código</th><th>Referidos</th><th>Con compra</th><th>Conversión</th><th>Puntos</th><th>Medalla</th><th /></tr></thead>
          <tbody>
            {ranking.length ? ranking.map(({ c, captados, convertidos }) => <Fragment key={c.id}>
              <tr>
                <td><strong>{c.nombre}</strong><div className="cpx-muted">@{c.alias}</div></td>
                <td>{c.codigoReferido || '—'}</td>
                <td>{captados}</td>
                <td>{convertidos}</td>
                <td>{pct(convertidos, captados)}</td>
                <td>{(c.puntosSociales ?? 0).toLocaleString('es-CL')}</td>
                <td><NivelBadge nivel={c.nivelSocial} /></td>
                <td><button type="button" className="cpx-btn" disabled={!captados} onClick={() => setAbierto(abierto === c.id ? null : c.id)}>{abierto === c.id ? 'Ocultar' : 'Ver compradores'}</button></td>
              </tr>
              {abierto === c.id && <tr><td colSpan={8} style={{ background: '#f8fbff' }}><BuyersDetail id={c.id} /></td></tr>}
            </Fragment>) : <tr><td colSpan={8} className="cpx-empty">No hay captadores aprobados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}

function BuyersDetail({ id }: { id: number }) {
  const q = useQuery({ queryKey: ['trust-capturer-buyers', id], queryFn: () => getCapturedBuyers(id) });
  if (q.isLoading) return <div className="cpx-empty">Cargando compradores…</div>;
  if (!q.data?.length) return <div className="cpx-empty">Sin compradores referidos.</div>;
  return <table className="cpx-table">
    <thead><tr><th>Comprador</th><th>Canal</th><th>Registro</th><th>Primera compra</th><th>Pedidos</th><th>Monto base</th><th>Ingreso captador</th></tr></thead>
    <tbody>{q.data.map(b => <tr key={b.atribucionId}>
      <td><strong>{b.nombre}</strong><div className="cpx-muted">{b.emailEnmascarado}</div></td>
      <td>{b.canal === 'WEB' ? 'Web' : 'App'}</td>
      <td>{new Date(b.registradoEn).toLocaleDateString('es-CL')}</td>
      <td>{b.primeraCompraEn ? new Date(b.primeraCompraEn).toLocaleDateString('es-CL') : <span className="cpx-muted">Aún no compra</span>}</td>
      <td>{b.pedidos}</td>
      <td>{formatCurrency(b.montoBase)}</td>
      <td><strong>{formatCurrency(b.ingresoCaptador)}</strong></td>
    </tr>)}</tbody>
  </table>;
}
