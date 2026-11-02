import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrackedPublications } from '@/api/tracking';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import Badge from '@/components/shared/Badge';
import MetricCard from '@/components/shared/MetricCard';
import Notice from '@/components/shared/Notice';
import PageHeader from '@/components/shared/PageHeader';
import Pagination from '@/components/shared/Pagination';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import UiIcon from '@/components/shared/UiIcon';
import { EmptyState, RecordCard, RecordList } from '@/components/mobile';
import { useIsMobile } from '@/hooks/useIsMobile';
import { formatDateTime } from '@/utils/formatters';
import type { TrackedPublication, TrackingKind } from '@/types/tracking';
import { AGE_CRITICAL_HOURS, AGE_WARNING_HOURS, ageInHours, ageTone, formatAge } from './age';
import TrackedProfilesModal from './TrackedProfilesModal';

const PAGE_SIZE = 8;

type ResponseFilter = 'POR_NOTIFICAR' | 'SIN_RESPUESTA' | 'CON_RESPUESTA' | 'TODAS';
type SortKey = 'createdAt' | 'respuestas';
/** Criticidad de una publicación por pendiente de notificar, según su antigüedad. */
type Severity = 'ALL' | 'CRITICAL' | 'WARNING' | 'RECENT';
type SortDirection = 'asc' | 'desc';

const COPY: Record<TrackingKind, { tab: string; short: string; icon: string; profile: string; response: string; responses: string; title: string }> = {
  fallas: { tab: 'Fallas automotrices', short: 'Fallas', icon: 'settings', profile: 'talleres', response: 'diagnóstico', responses: 'Diagnósticos', title: 'Falla' },
  necesidades: { tab: 'Necesidades de compra', short: 'Necesidades', icon: 'cart', profile: 'casas de repuestos', response: 'oferta', responses: 'Ofertas', title: 'Repuesto' },
};

function statusLabel(item: TrackedPublication) {
  if (item.estado === 'ACTIVA' || item.estado === 'ABIERTA') return item.vigente ? 'Vigente' : 'Vencida';
  return item.estado.charAt(0) + item.estado.slice(1).toLowerCase();
}

/** Vigente y sin ninguna respuesta: el comprador sigue esperando; el semáforo de antigüedad sólo aplica a éstas. */
function needsFollowUp(item: TrackedPublication) {
  return item.vigente && item.respuestas === 0;
}

/**
 * Alerta para el moderador: vigente, con más de 24 h de antigüedad y sin una sola respuesta. Es lo más antiguo y con menos
 * actividad, donde conviene contactar primero a los perfiles que podrían diagnosticar u ofertar.
 */
function needsAttention(item: TrackedPublication) {
  return needsFollowUp(item) && (ageInHours(item.createdAt) ?? 0) >= AGE_WARNING_HOURS;
}

function severityOf(item: TrackedPublication): Exclude<Severity, 'ALL'> {
  const hours = ageInHours(item.createdAt) ?? 0;
  if (hours >= AGE_CRITICAL_HOURS) return 'CRITICAL';
  return hours >= AGE_WARNING_HOURS ? 'WARNING' : 'RECENT';
}

const SEVERITY_CHIPS: Array<{ key: Severity; label: string; dot: string }> = [
  { key: 'ALL', label: 'Todas las pendientes', dot: '#64748b' },
  { key: 'CRITICAL', label: `Críticas (+${AGE_CRITICAL_HOURS} h)`, dot: '#dc2626' },
  { key: 'WARNING', label: `Atención (${AGE_WARNING_HOURS}–${AGE_CRITICAL_HOURS} h)`, dot: '#d97706' },
  { key: 'RECENT', label: `Recientes (-${AGE_WARNING_HOURS} h)`, dot: '#16a34a' },
];

/** Vigente y con perfiles a los que les sirve que nadie ha avisado todavía. */
function hasPendingNotifications(item: TrackedPublication) {
  return item.vigente && item.porNotificar > 0;
}

/** Menú "Seguimiento de publicaciones": fallas y necesidades de compra con su antigüedad y los perfiles por contactar. */
export default function PublicationTrackingPage() {
  const isMobile = useIsMobile();
  const [kind, setKind] = useState<TrackingKind>('fallas');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ResponseFilter>('POR_NOTIFICAR');
  const [page, setPage] = useState(0);
  const [severity, setSeverity] = useState<Severity>('ALL');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'createdAt', direction: 'desc' });
  const [selected, setSelected] = useState<TrackedPublication | null>(null);
  const copy = COPY[kind];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tracking-publications', kind],
    queryFn: () => getTrackedPublications(kind),
  });
  const items = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'POR_NOTIFICAR' && !hasPendingNotifications(item)) return false;
      if (filter === 'POR_NOTIFICAR' && severity !== 'ALL' && severityOf(item) !== severity) return false;
      if (filter === 'SIN_RESPUESTA' && !needsFollowUp(item)) return false;
      if (filter === 'CON_RESPUESTA' && item.respuestas === 0) return false;
      return !q || [item.titulo, item.vehiculo, item.comuna, item.region, item.autorNombre].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [items, search, filter, severity]);

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    const time = (item: TrackedPublication) => new Date(item.createdAt).getTime() || 0;
    return [...filtered].sort((a, b) => {
      // Por actividad, a igual cantidad de respuestas va primero la más antigua.
      if (sort.key === 'respuestas') return factor * (a.respuestas - b.respuestas) || time(a) - time(b);
      return factor * (time(a) - time(b));
    });
  }, [filtered, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => (current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'createdAt' ? 'asc' : 'asc' }));
    setPage(0);
  };

  // Conteo de las que faltan por notificar, por criticidad, para los filtros rápidos.
  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { ALL: 0, CRITICAL: 0, WARNING: 0, RECENT: 0 };
    items.filter(hasPendingNotifications).forEach((item) => {
      counts.ALL += 1;
      counts[severityOf(item)] += 1;
    });
    return counts;
  }, [items]);

  const pickSeverity = (next: Severity) => {
    setFilter('POR_NOTIFICAR');
    setSeverity(next);
    // Lo más urgente primero: al mirar críticas o en atención, las más antiguas arriba.
    if (next === 'CRITICAL' || next === 'WARNING') setSort({ key: 'createdAt', direction: 'asc' });
    setPage(0);
  };

  const metrics = useMemo(() => {
    const now = Date.now();
    const unanswered = items.filter(needsFollowUp);
    return {
      toNotify: items.filter(hasPendingNotifications).length,
      recent: items.filter((item) => (ageInHours(item.createdAt, now) ?? Infinity) < AGE_WARNING_HOURS).length,
      critical: unanswered.filter((item) => (ageInHours(item.createdAt, now) ?? 0) >= AGE_CRITICAL_HOURS).length,
      answered: items.filter((item) => item.respuestas > 0).length,
    };
  }, [items]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0));
  const paged = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const changeKind = (next: TrackingKind) => { setKind(next); setSeverity('ALL'); setPage(0); };
  const location = (item: TrackedPublication) => [item.comuna, item.region].filter(Boolean).join(', ') || 'Sin ubicación';
  const fitBadge = (item: TrackedPublication) => (
    <Badge text={`${item.calzan} de ${item.avisados}`} variant={item.calzan > 0 ? 'blue' : ''} />
  );
  const responseBadge = (item: TrackedPublication) => (
    <Badge text={String(item.respuestas)} variant={item.respuestas > 0 ? 'green' : needsFollowUp(item) ? 'amber' : ''} />
  );
  const notifiedBadge = (item: TrackedPublication) => (
    <Badge text={`${item.notificados}${item.porNotificar > 0 ? ` · faltan ${item.porNotificar}` : ''}`} variant={item.porNotificar > 0 && item.vigente ? 'amber' : item.notificados > 0 ? 'green' : ''} />
  );
  const alertIcon = (item: TrackedPublication) => {
    if (!needsAttention(item)) return null;
    const critical = (ageInHours(item.createdAt) ?? 0) >= AGE_CRITICAL_HOURS;
    return (
      <span
        role="img"
        aria-label="Requiere acción"
        title={`Sin ${copy.response} hace ${formatAge(item.createdAt).replace('hace ', '')}: contactar a los ${copy.profile} a los que les sirve`}
        style={{ display: 'inline-flex', width: 20, height: 20, color: critical ? '#dc2626' : '#d97706', flexShrink: 0 }}
      >
        <UiIcon name="alert" />
      </span>
    );
  };
  const sortHeader = (key: SortKey, label: string) => {
    const active = sort.key === key;
    return (
      <th aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => toggleSort(key)} title="Ordenar"
          style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 'inherit', color: active ? '#1766bc' : 'inherit' }}>
          {label}
          <span aria-hidden="true">{active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    );
  };
  const ageBadge = (item: TrackedPublication) => (
    <>
      {needsFollowUp(item) ? <Badge text={formatAge(item.createdAt)} variant={ageTone(item.createdAt)} /> : <span>{formatAge(item.createdAt)}</span>}
      {(ageInHours(item.createdAt) ?? Infinity) < AGE_WARNING_HOURS && <> <Badge text="Nueva" variant="blue" /></>}
    </>
  );

  return (
    <>
      <PageHeader
        title="Seguimiento de publicaciones"
        description="Cada nueva falla o necesidad de compra con los talleres y casas de repuestos a los que les sirve, para avisarles y ver quién ya respondió."
        actions={<AreaHomeShortcut />}
      />

      <nav className="module-tabs" aria-label="Tipo de publicación">
        {(Object.keys(COPY) as TrackingKind[]).map((key) => (
          <button key={key} type="button" className={kind === key ? 'active' : ''} onClick={() => changeKind(key)} aria-pressed={kind === key}>
            <UiIcon name={COPY[key].icon} />
            {isMobile ? COPY[key].short : COPY[key].tab}
          </button>
        ))}
      </nav>

      {isError && <QueryErrorNotice error={error} what="las publicaciones" onRetry={refetch} />}

      <section className="metric-grid compact seller-metric-grid">
        <MetricCard label="Por notificar" value={metrics.toNotify} tone="amber" iconName="clock" description={`Publicaciones vigentes con ${copy.profile} a los que les sirve y nadie ha avisado.`} />
        <MetricCard label="Nuevas (24 h)" value={metrics.recent} tone="blue" iconName={copy.icon} description="Publicadas en las últimas 24 horas." />
        <MetricCard label={`Más de ${AGE_CRITICAL_HOURS} h sin respuesta`} value={metrics.critical} tone="red" iconName="alert" description="Las más urgentes: el comprador lleva días esperando." />
        <MetricCard label="Con respuestas" value={metrics.answered} tone="green" iconName="check" description={`Publicaciones que ya recibieron al menos un ${copy.response}.`} />
      </section>

      <Notice>
        {isMobile ? `Toca una publicación para ver a qué ${copy.profile} les sirve y contactarlos. La alerta marca las vigentes con más de 24 h sin respuestas.` : <>Abre una publicación para ver a qué {copy.profile} les sirve, cuáles ya registraron su {copy.response} y cuáles faltan. Con "Contactar" ves todos sus datos y marcas el tick de notificado. Ordena por Registro o por actividad desde la cabecera. El ícono de alerta marca las publicaciones vigentes con más de 24 h y sin ninguna respuesta (ámbar hasta 72 h, rojo sobre 72 h): contacta primero a esos perfiles.</>}
      </Notice>

      <section className="seller-layout">
        <article className="panel">
          <div className="panel-header"><h2>{copy.tab}</h2></div>

          <div role="group" aria-label="Filtro rápido por criticidad" style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : undefined, gap: 8, padding: '0 16px 12px' }}>
            {SEVERITY_CHIPS.map((chip) => {
              const active = filter === 'POR_NOTIFICAR' && severity === chip.key;
              return (
                <button key={chip.key} type="button" className={active ? 'primary-button' : 'secondary-button'} aria-pressed={active}
                  onClick={() => pickSeverity(chip.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', width: 'auto', flex: '0 0 auto' }}>
                  <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: active ? '#fff' : chip.dot, flexShrink: 0 }} />
                  {chip.label} ({severityCounts[chip.key]})
                </button>
              );
            })}
          </div>

          <div className="seller-filter-bar">
            <input className="input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar por título, vehículo, comuna o autor..." aria-label="Buscar publicaciones" />
            <select className="select" style={{ minWidth: 230 }} value={filter} onChange={(e) => { setFilter(e.target.value as ResponseFilter); setSeverity('ALL'); setPage(0); }} aria-label="Filtrar por respuestas">
              <option value="POR_NOTIFICAR">Por notificar (vigentes)</option>
              <option value="SIN_RESPUESTA">Sin respuestas (vigentes)</option>
              <option value="CON_RESPUESTA">Con respuestas</option>
              <option value="TODAS">Todas</option>
            </select>
          </div>

          {isMobile && (
            <div style={{ padding: '0 16px 12px' }}>
              <select className="select" aria-label="Ordenar publicaciones"
                value={`${sort.key}-${sort.direction}`}
                onChange={(e) => { const [key, direction] = e.target.value.split('-') as [SortKey, SortDirection]; setSort({ key, direction }); setPage(0); }}>
                <option value="createdAt-desc">Más recientes primero</option>
                <option value="createdAt-asc">Más antiguas primero</option>
                <option value="respuestas-asc">Menos actividad primero</option>
                <option value="respuestas-desc">Más actividad primero</option>
              </select>
            </div>
          )}

          {isLoading ? (
            <div className="panel-body">Cargando publicaciones...</div>
          ) : isMobile ? (
            <RecordList ariaLabel="Publicaciones" empty={<EmptyState icon={copy.icon} title="Sin publicaciones" description="No hay publicaciones que coincidan con el filtro." />}>
              {paged.map((item) => (
                <RecordCard
                  key={item.id}
                  title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{alertIcon(item)}{item.titulo}</span>}
                  subtitle={`${item.vehiculo || 'Sin vehículo'} · ${location(item)}`}
                  badge={ageBadge(item)}
                  meta={[
                    { label: 'Registro', value: formatDateTime(item.createdAt) },
                    { label: 'Les sirve', value: fitBadge(item) },
                    { label: copy.responses, value: responseBadge(item) },
                    { label: 'Notificados', value: notifiedBadge(item) },
                    { label: 'Estado', value: statusLabel(item) },
                    { label: 'Autor', value: item.autorNombre },
                  ]}
                  onPress={() => setSelected(item)}
                  ariaLabel={`Publicación ${item.titulo}`}
                  actions={<button type="button" className="mb-action" onClick={() => setSelected(item)}><UiIcon name="users" />Perfiles</button>}
                />
              ))}
            </RecordList>
          ) : (
            <div className="table-wrap">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>{copy.title}</th><th>Vehículo y zona</th><th>Autor</th>{sortHeader('createdAt', 'Registro')}
                    <th>Estado</th><th>Les sirve</th>{sortHeader('respuestas', copy.responses)}<th>Notificados</th><th className="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length ? paged.map((item) => (
                    <tr key={item.id} style={needsAttention(item) ? { background: 'rgba(220, 38, 38, 0.05)' } : undefined}>
                      <td className="col-title">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{alertIcon(item)}<strong>{item.titulo}</strong></span>
                        <div className="row-sub">#{item.id}</div>
                      </td>
                      <td>{item.vehiculo || '—'}<div className="row-sub">{location(item)}</div></td>
                      <td className="col-author">{item.autorNombre}{item.autorTelefono ? <div className="row-sub">{item.autorTelefono}</div> : null}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{ageBadge(item)}<div className="row-sub">{formatDateTime(item.createdAt)}</div></td>
                      <td>{statusLabel(item)}</td>
                      <td>{fitBadge(item)}</td>
                      <td>{responseBadge(item)}</td>
                      <td>{notifiedBadge(item)}</td>
                      <td className="col-actions">
                        <div className="seller-actions">
                          <button className="row-action" type="button" onClick={() => setSelected(item)} aria-label="Ver perfiles a notificar" title="Ver perfiles a notificar">
                            <UiIcon name="users" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={9}><span className="row-sub">No hay publicaciones que coincidan con el filtro.</span></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && totalPages > 0 && isMobile && (
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={sorted.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          )}
          {!isLoading && totalPages > 0 && !isMobile && (
            <div className="pagination">
              <span>Mostrando {currentPage * PAGE_SIZE + 1} a {Math.min((currentPage + 1) * PAGE_SIZE, sorted.length)} de {sorted.length} publicaciones</span>
              <div className="page-buttons">
                <button className="page-button page-prev" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Pagina anterior"><UiIcon name="arrowRight" /></button>
                {Array.from({ length: totalPages }, (_, index) => index).map((index) => (
                  <button key={index} className={`page-button ${index === currentPage ? 'active' : ''}`} type="button" onClick={() => setPage(index)}>{index + 1}</button>
                ))}
                <button className="page-button" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages - 1} aria-label="Pagina siguiente"><UiIcon name="arrowRight" /></button>
              </div>
            </div>
          )}
        </article>
      </section>

      {selected && <TrackedProfilesModal key={`${kind}-${selected.id}`} kind={kind} publication={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
