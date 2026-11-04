import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as workshopsApi from '@/api/workshops';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import PageHeader from '@/components/shared/PageHeader';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import MetricCard from '@/components/shared/MetricCard';
import Notice from '@/components/shared/Notice';
import Badge from '@/components/shared/Badge';
import Modal from '@/components/shared/Modal';
import UiIcon from '@/components/shared/UiIcon';
import { EmptyState, RecordCard, RecordList } from '@/components/mobile';
import { useIsMobile } from '@/hooks/useIsMobile';
import { formatDate, formatDateTime } from '@/utils/formatters';
import type { WorkshopReferralSummary } from '@/types/workshopReferrals';

function location(workshop: WorkshopReferralSummary) {
  return [workshop.comuna, workshop.region].filter(Boolean).join(', ') || 'Sin ubicación';
}

/** "12 de 25" y, si ya ganó periodos, cuántos; es lo que el equipo mira para saber cómo va la captación. */
function goalLabel(workshop: WorkshopReferralSummary) {
  return `${workshop.porPremio - workshop.paraProximo} de ${workshop.porPremio}`;
}

function goalBadge(workshop: WorkshopReferralSummary) {
  if (!workshop.codigo) return <Badge text="Sin compartir" variant="blue" />;
  if (workshop.registrados + workshop.pendientes === 0) return <Badge text="Sin registros" variant="amber" />;
  return <Badge text={`Faltan ${workshop.paraProximo}`} variant={workshop.paraProximo <= 5 ? 'green' : 'blue'} />;
}

/**
 * Pestaña "Referidos" de Vendedores y talleres: seguimiento de la captación. Muestra cuántos talleres comparten su código, los
 * compradores nuevos que van registrando, cuánto llevan de su meta (25 compradores = un periodo gratis de agendamiento) y los
 * días gratis ganados. Al elegir un taller se abre un popup con su detalle y los compradores que se registraron con su código.
 */
export default function WorkshopReferralsTab() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workshops', 'referrals'],
    queryFn: () => workshopsApi.getWorkshopReferrals(),
  });
  const totals = data?.totales;
  const workshops = useMemo(() => data?.talleres ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workshops;
    return workshops.filter((w) => [w.nombreNegocio, w.email, w.codigo, w.comuna, w.region].some((v) => (v ?? '').toLowerCase().includes(q)));
  }, [workshops, search]);

  const detailQuery = useQuery({
    queryKey: ['workshops', 'referrals', selectedId],
    queryFn: () => workshopsApi.getWorkshopReferralDetail(selectedId as number),
    enabled: selectedId != null,
  });
  const selected = workshops.find((w) => w.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Referidos de talleres"
        description="Seguimiento de la captación: los compradores nuevos que cada taller registra con su código QR y cuánto le falta para ganar agendamiento gratis."
        actions={<AreaHomeShortcut />}
      />
      {isError && <QueryErrorNotice error={error} what="los referidos" onRetry={refetch} />}

      <section className="metric-grid compact seller-metric-grid">
        <MetricCard label="Talleres con código" value={totals?.talleresConCodigo ?? 0} tone="blue" iconName="store"
          description={`${totals?.talleresConReferidos ?? 0} ya registraron compradores con su código.`} />
        <MetricCard label="Compradores nuevos" value={totals?.compradoresRegistrados ?? 0} tone="green" iconName="users"
          description="Se registraron con el código de un taller y verificaron su correo." />
        <MetricCard label="Pendientes de verificar" value={totals?.compradoresPendientes ?? 0} tone="amber" iconName="mail"
          description="Crearon la cuenta con un código pero aún no verifican el correo." />
        <MetricCard label="Días gratis entregados" value={totals?.diasGanados ?? 0} tone="violet" iconName="calendar"
          description={`${totals?.talleresConMeta ?? 0} talleres completaron la meta (${totals?.porPremio ?? 25} compradores = ${totals?.diasPorPeriodo ?? 30} días).`} />
      </section>

      <Notice>
        Cada {totals?.porPremio ?? 25} compradores que se registran con el código de un taller (con el correo verificado) le suman {totals?.diasPorPeriodo ?? 30} días de
        agendamiento gratis. La barra de cada taller se reinicia al completar la meta.
      </Notice>

      <section className="seller-layout">
        <article className="panel">
          <div className="panel-header"><h2>Avance por taller</h2></div>
          <div className="seller-filter-bar">
            <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar taller, correo, código o comuna…" aria-label="Buscar talleres" />
          </div>

          {isLoading ? (
            <div className="panel-body">Cargando referidos...</div>
          ) : isMobile ? (
            <RecordList
              ariaLabel="Referidos por taller"
              empty={<EmptyState icon="store" title="Sin talleres" description="No hay talleres acreditados que coincidan con la búsqueda." />}
            >
              {filtered.map((workshop) => (
                <RecordCard
                  key={workshop.id}
                  title={workshop.nombreNegocio}
                  subtitle={`${workshop.codigo ?? 'Sin código'} · ${location(workshop)}`}
                  badge={goalBadge(workshop)}
                  meta={[
                    { label: 'Compradores', value: workshop.registrados },
                    { label: 'Por verificar', value: workshop.pendientes },
                    { label: 'Avance', value: goalLabel(workshop) },
                    { label: 'Días ganados', value: workshop.diasGanados },
                  ]}
                  onPress={() => setSelectedId(workshop.id)}
                  ariaLabel={`Referidos de ${workshop.nombreNegocio}`}
                />
              ))}
            </RecordList>
          ) : (
            <div className="table-wrap">
              <table className="workshop-table">
                <thead>
                  <tr>
                    <th>Taller</th>
                    <th>Código</th>
                    <th>Compradores</th>
                    <th title="Registrados con su código que aún no verifican el correo">Por verificar</th>
                    <th>Avance de la meta</th>
                    <th>Días gratis ganados</th>
                    <th>Último registro</th>
                    <th className="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length ? filtered.map((workshop) => (
                    <tr key={workshop.id} className={workshop.id === selectedId ? 'is-selected' : undefined}>
                      <td>
                        <strong>{workshop.nombreNegocio}</strong>
                        <span className="row-sub" style={{ display: 'block' }}>{location(workshop)}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{workshop.codigo ?? <span className="row-sub">Sin compartir</span>}</td>
                      <td>{workshop.registrados}</td>
                      <td>{workshop.pendientes}</td>
                      <td style={{ minWidth: 180 }}>
                        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={workshop.porPremio}
                          aria-valuenow={workshop.porPremio - workshop.paraProximo} aria-label={`Avance de ${workshop.nombreNegocio}`}
                          style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round(((workshop.porPremio - workshop.paraProximo) / workshop.porPremio) * 100)}%`, height: '100%', background: '#18a957' }} />
                        </div>
                        <span className="row-sub">{goalLabel(workshop)} · faltan {workshop.paraProximo}</span>
                      </td>
                      <td>{workshop.diasGanados > 0 ? `${workshop.diasGanados} días (${workshop.periodosGanados})` : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{workshop.ultimoReferidoEn ? formatDate(workshop.ultimoReferidoEn) : 'Sin registros'}</td>
                      <td className="col-actions">
                        <div className="seller-actions">
                          <button className="row-action" type="button" onClick={() => setSelectedId(workshop.id)}
                            aria-label="Ver detalle del taller" title="Ver detalle del taller">
                            <UiIcon name="users" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8}><span className="row-sub">No hay talleres acreditados que coincidan con la búsqueda.</span></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <Modal isOpen={selected !== null} onClose={() => setSelectedId(null)} title={selected ? `Referidos de ${selected.nombreNegocio}` : 'Referidos'} wide>
        {selected && (
          <>
            <section className="metric-grid compact">
              <MetricCard label="Código" value={selected.codigo ?? 'Sin compartir'} tone="blue" iconName="store" description={location(selected)} />
              <MetricCard label="Compradores" value={selected.registrados} tone="green" iconName="users"
                description={`${selected.pendientes} por verificar el correo.`} />
              <MetricCard label="Avance de la meta" value={goalLabel(selected)} tone="amber" iconName="calendar"
                description={`Faltan ${selected.paraProximo} para el próximo periodo gratis.`} />
              <MetricCard label="Días gratis ganados" value={selected.diasGanados > 0 ? `${selected.diasGanados} días` : '—'} tone="violet" iconName="calendar"
                description={selected.ultimoReferidoEn ? `Último registro: ${formatDate(selected.ultimoReferidoEn)}` : 'Sin registros todavía.'} />
            </section>
            <h3>Compradores registrados con su código</h3>
            {detailQuery.isLoading ? (
              <div className="panel-body">Cargando compradores...</div>
            ) : detailQuery.isError ? (
              <QueryErrorNotice error={detailQuery.error} what="los compradores del taller" onRetry={detailQuery.refetch} />
            ) : (detailQuery.data?.compradores.length ?? 0) === 0 ? (
              <div className="panel-body"><span className="row-sub">Este taller aún no tiene compradores registrados con su código.</span></div>
            ) : (
              <div className="table-wrap">
                <table className="workshop-table">
                  <thead>
                    <tr><th>Comprador</th><th>Correo</th><th>Canal</th><th>Se registró</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {detailQuery.data?.compradores.map((buyer) => (
                      <tr key={buyer.usuarioId}>
                        <td><strong>{buyer.nombre}</strong></td>
                        <td>{buyer.email ?? '—'}</td>
                        <td>{buyer.canal === 'WEB' ? 'Web' : 'App'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(buyer.registradoEn)}</td>
                        <td>
                          {buyer.contadoEn
                            ? <Badge text="Cuenta para la meta" variant="green" />
                            : <Badge text="Falta verificar correo" variant="amber" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
