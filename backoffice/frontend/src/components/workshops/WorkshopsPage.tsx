import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as workshopsApi from '@/api/workshops';
import { resolveProfileImageUrl } from '@/api/client';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import PageHeader from '@/components/shared/PageHeader';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import MetricCard from '@/components/shared/MetricCard';
import Notice from '@/components/shared/Notice';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import Pagination from '@/components/shared/Pagination';
import { CardAvatar, EmptyState, FilterSheet, FilterTrigger, RecordCard, RecordList } from '@/components/mobile';
import { useIsMobile } from '@/hooks/useIsMobile';
import { countActiveFilters } from '@/utils/filters';
import { formatDate } from '@/utils/formatters';
import { PAGE_SIZES } from '@/utils/constants';
import type { WorkshopSummary } from '@/types/workshop';
import WorkshopProfileModal, { type WorkshopProfileTab } from './WorkshopProfileModal';
import { WORKSHOP_STATUS_OPTIONS, getWorkshopStatusLabel, getWorkshopStatusTone } from './status';

const ALL = 'Todos';

function workshopLocation(workshop: WorkshopSummary) {
  return [workshop.comuna, workshop.region].filter(Boolean).join(', ') || 'Sin ubicación';
}

function ratingLabel(workshop: WorkshopSummary) {
  return workshop.calificacion != null ? `${workshop.calificacion.toFixed(1)} (${workshop.opiniones})` : 'Sin opiniones';
}

/** Pestaña "Talleres" de Vendedores y talleres: seguimiento de cada taller como ficha. */
export default function WorkshopsPage() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<{ workshop: WorkshopSummary; tab: WorkshopProfileTab } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workshops', 'all'],
    queryFn: () => workshopsApi.getWorkshops(),
  });
  const workshops = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = startDate ? new Date(startDate).getTime() : null;
    const to = endDate ? new Date(endDate).getTime() + 86_400_000 : null;
    return workshops.filter((w) => {
      if (status !== ALL && w.estado !== status) return false;
      if (q && ![w.nombreNegocio, w.rut, w.responsable, w.email, w.comuna, w.region].some((v) => (v ?? '').toLowerCase().includes(q))) return false;
      if (from != null || to != null) {
        const created = new Date(w.createdAt ?? '').getTime();
        if (Number.isNaN(created)) return false;
        if (from != null && created < from) return false;
        if (to != null && created > to) return false;
      }
      return true;
    });
  }, [workshops, search, status, startDate, endDate]);

  const pageSize = PAGE_SIZES.SELLERS;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0));
  const paged = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const metrics = {
    accredited: workshops.filter((w) => w.estado === 'APROBADO').length,
    inProcess: workshops.filter((w) => w.estado === 'PENDIENTE' || w.estado === 'POR_CORREGIR').length,
    reports: workshops.reduce((total, w) => total + w.reportes, 0),
    diagnostics: workshops.reduce((total, w) => total + w.diagnosticos + w.comentarios, 0),
  };

  const update = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };
  const open = (workshop: WorkshopSummary, tab: WorkshopProfileTab = 'reportes') => setSelected({ workshop, tab });
  const activeFilters = countActiveFilters({ startDate, endDate, status }, { status: ALL });

  const statusSelect = (
    <select className="select" value={status} onChange={(e) => update(setStatus)(e.target.value)} aria-label="Estado del taller">
      <option value={ALL}>Todos los talleres</option>
      {WORKSHOP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );

  return (
    <>
      <PageHeader
        title="Gestión de talleres"
        description="Seguimiento de cada taller: estado de su acreditación, métricas, reportes, diagnósticos y necesidades de compra."
        actions={<AreaHomeShortcut />}
      />
      {isError && <QueryErrorNotice error={error} what="los talleres" onRetry={refetch} />}

      <section className="metric-grid compact seller-metric-grid">
        <MetricCard label="Talleres acreditados" value={metrics.accredited} tone="green" iconName="users" description="Talleres con la acreditación aprobada." />
        <MetricCard label="En proceso" value={metrics.inProcess} tone="amber" iconName="clipboard" description="Talleres con la acreditación en revisión o por corregir." />
        <MetricCard label="Reportes" value={metrics.reports} tone="red" iconName="flag" description="Reportes registrados contra talleres." />
        <MetricCard label="Diagnósticos y comentarios" value={metrics.diagnostics} tone="violet" iconName="message" description="Lo que los talleres han publicado en fallas automotrices." />
      </section>

      <Notice>
        Esta vista es de seguimiento: reúne por taller sus reportes, los diagnósticos y comentarios que dejó en fallas automotrices y las necesidades de compra que publicó.
      </Notice>

      <section className="seller-layout">
        <article className="panel">
          <div className="panel-header">
            <h2>Listado de talleres</h2>
          </div>

          {isMobile ? (
            <>
              <div className="mb-filter-row">
                <input className="input" type="search" value={search} onChange={(e) => update(setSearch)(e.target.value)}
                  placeholder="Buscar taller, RUT, comuna…" aria-label="Buscar talleres" />
                <FilterTrigger count={activeFilters} onClick={() => setSheetOpen(true)} />
              </div>
              <FilterSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                title="Filtrar talleres"
                activeCount={activeFilters}
                onClear={() => { setStartDate(''); setEndDate(''); setStatus(ALL); setPage(0); }}
              >
                <label>Desde<input className="input" type="date" value={startDate} onChange={(e) => update(setStartDate)(e.target.value)} /></label>
                <label>Hasta<input className="input" type="date" value={endDate} onChange={(e) => update(setEndDate)(e.target.value)} /></label>
                <label>Estado{statusSelect}</label>
              </FilterSheet>
            </>
          ) : (
            <div className="seller-filter-bar">
              <input className="input" type="search" value={search} onChange={(e) => update(setSearch)(e.target.value)}
                placeholder="Buscar por taller, RUT, responsable o comuna..." />
              <label className="seller-filter-date-label">
                <span>Desde</span>
                <input className="input" type="date" value={startDate} onChange={(e) => update(setStartDate)(e.target.value)} aria-label="Fecha inicio" />
              </label>
              <label className="seller-filter-date-label">
                <span>Hasta</span>
                <input className="input" type="date" value={endDate} onChange={(e) => update(setEndDate)(e.target.value)} aria-label="Fecha fin" />
              </label>
              {statusSelect}
            </div>
          )}

          {isLoading ? (
            <div className="panel-body">Cargando talleres...</div>
          ) : isMobile ? (
            <RecordList
              ariaLabel="Listado de talleres"
              empty={<EmptyState icon="store" title="Sin talleres" description="No hay talleres que coincidan con la búsqueda." />}
            >
              {paged.map((workshop) => (
                <RecordCard
                  key={workshop.id}
                  leading={<CardAvatar src={workshop.userProfileUrl ? resolveProfileImageUrl(workshop.userProfileUrl) : null} name={workshop.nombreNegocio} />}
                  title={workshop.nombreNegocio}
                  subtitle={`${workshop.rut} · ${workshopLocation(workshop)}`}
                  badge={<Badge text={getWorkshopStatusLabel(workshop.estado)} variant={getWorkshopStatusTone(workshop.estado)} />}
                  meta={[
                    { label: 'Reportes', value: workshop.reportes },
                    { label: 'Diagnósticos', value: workshop.diagnosticos },
                    { label: 'Comentarios', value: workshop.comentarios },
                    { label: 'Necesidades', value: workshop.necesidades },
                    { label: 'Calificación', value: ratingLabel(workshop) },
                    { label: 'Ingreso', value: workshop.createdAt ? formatDate(workshop.createdAt) : 'Sin fecha' },
                  ]}
                  onPress={() => open(workshop)}
                  ariaLabel={`Taller ${workshop.nombreNegocio}`}
                  actions={(
                    <>
                      <button type="button" className="mb-action" onClick={() => open(workshop)}>
                        <UiIcon name="users" />
                        Ficha
                      </button>
                      {workshop.reportes > 0 && (
                        <button type="button" className="mb-action mb-action--danger" onClick={() => open(workshop, 'reportes')}>
                          <UiIcon name="flag" />
                          Reportes
                        </button>
                      )}
                    </>
                  )}
                />
              ))}
            </RecordList>
          ) : (
            <div className="table-wrap">
              <table className="workshop-table">
                <thead>
                  <tr>
                    <th>Taller</th>
                    <th>RUT</th>
                    <th>Comuna</th>
                    <th>Estado</th>
                    <th>Reportes</th>
                    <th title="Diagnósticos / comentarios en fallas automotrices">Diag. / coment.</th>
                    <th>Necesidades</th>
                    <th>Calificación</th>
                    <th>Ingreso</th>
                    <th className="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length ? paged.map((workshop) => (
                    <tr key={workshop.id}>
                      <td>
                        <span className="seller-cell">
                          <span className="seller-logo logo-blue">
                            {workshop.userProfileUrl ? (
                              <img src={resolveProfileImageUrl(workshop.userProfileUrl) ?? undefined} alt={workshop.nombreNegocio} />
                            ) : (
                              workshop.nombreNegocio.substring(0, 2).toUpperCase()
                            )}
                          </span>
                          <strong>{workshop.nombreNegocio}</strong>
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{workshop.rut}</td>
                      <td>{workshop.comuna || 'Sin comuna'}</td>
                      <td><Badge text={getWorkshopStatusLabel(workshop.estado)} variant={getWorkshopStatusTone(workshop.estado)} /></td>
                      <td>{workshop.reportes}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{workshop.diagnosticos} / {workshop.comentarios}</td>
                      <td>{workshop.necesidades}</td>
                      <td>{ratingLabel(workshop)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{workshop.createdAt ? formatDate(workshop.createdAt) : 'Sin fecha'}</td>
                      <td className="col-actions">
                        <div className="seller-actions" aria-label={`Acciones de ${workshop.nombreNegocio}`}>
                          <button className="row-action" type="button" onClick={() => open(workshop)} aria-label="Ver ficha del taller" title="Ver ficha del taller">
                            <UiIcon name="users" />
                          </button>
                          {workshop.reportes > 0 && (
                            <button className="row-action account-lock-action" type="button" onClick={() => open(workshop, 'reportes')}
                              aria-label="Ver reportes del taller" title="Ver reportes del taller">
                              <UiIcon name="flag" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={10}><span className="row-sub">No hay talleres que coincidan con la búsqueda.</span></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && totalPages > 0 && isMobile && (
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />
          )}

          {!isLoading && totalPages > 0 && !isMobile && (
            <div className="pagination">
              <span>Mostrando {currentPage * pageSize + 1} a {Math.min((currentPage + 1) * pageSize, filtered.length)} de {filtered.length} talleres</span>
              <div className="page-buttons">
                <button className="page-button page-prev" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Pagina anterior">
                  <UiIcon name="arrowRight" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i).map((index) => (
                  <button key={index} className={`page-button ${index === currentPage ? 'active' : ''}`} type="button" onClick={() => setPage(index)}>
                    {index + 1}
                  </button>
                ))}
                <button className="page-button" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages - 1} aria-label="Pagina siguiente">
                  <UiIcon name="arrowRight" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {selected && (
        <WorkshopProfileModal
          key={`${selected.workshop.id}-${selected.tab}`}
          workshop={selected.workshop}
          initialTab={selected.tab}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
