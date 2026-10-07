import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as feedbackApi from '@/api/feedback';
import MetricCard from '@/components/shared/MetricCard';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import { formatDateTime } from '@/utils/formatters';
import { useIsMobile } from '@/hooks/useIsMobile';
import { RecordCard, RecordList, EmptyState, FilterSheet, FilterTrigger, CardAvatar } from '@/components/mobile';
import { countActiveFilters } from '@/utils/filters';
import { resolveProfileImageUrl } from '@/api/client';

/**
 * El backend manda el rol tal cual esta en la tabla de usuarios: CLIENTE, PROVEEDOR u OPERADOR.
 * Antes se comparaba contra SELLER/VENDEDOR, que nunca llegan, y todo el mundo salia "Comprador".
 */
const isSellerRole = (rol: string | null | undefined) => ['PROVEEDOR', 'VENDEDOR', 'SELLER'].includes((rol ?? '').toUpperCase());

export default function FeedbackPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'home'>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'seller' | 'buyer'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['system-feedback'], queryFn: feedbackApi.getSystemFeedback });
  const { data: homeFeedback = [] } = useQuery({ queryKey: ['system-feedback', 'home'], queryFn: feedbackApi.getHomeFeedback });
  const approvalMutation = useMutation({ mutationFn: ({ id, approved }: { id: number; approved: boolean }) => feedbackApi.setSystemFeedbackApproval(id, approved), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-feedback'] }) });
  const feedbackForTab = tab === 'home' ? homeFeedback : data;
  const visible = useMemo(() => feedbackForTab.filter((item) => {
    const isSeller = isSellerRole(item.usuarioRol);
    const matchesSearch = `${item.usuarioNombre} ${item.comentario}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesApproval = approvalFilter === 'all'
      || (approvalFilter === 'approved' && item.aprobado)
      || (approvalFilter === 'pending' && !item.aprobado);
    const matchesRole = roleFilter === 'all' || (roleFilter === 'seller' && isSeller) || (roleFilter === 'buyer' && !isSeller);
    const matchesRating = ratingFilter === 'all' || item.calificacion === Number(ratingFilter);
    return matchesSearch && matchesApproval && matchesRole && matchesRating;
  }), [feedbackForTab, search, approvalFilter, roleFilter, ratingFilter]);
  const average = data.length ? data.reduce((sum, item) => sum + item.calificacion, 0) / data.length : 0;
  const publishedCount = homeFeedback.length;

  const approvalSelect = (
    <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value as typeof approvalFilter)} disabled={tab === 'home'}><option value="all">Todos los estados</option><option value="approved">Aprobados</option><option value="pending">Pendientes</option></select>
  );
  const roleSelect = (
    <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}><option value="all">Todos los roles</option><option value="seller">Vendedores</option><option value="buyer">Compradores</option></select>
  );
  const ratingSelect = (
    <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value as typeof ratingFilter)}><option value="all">Todas las calificaciones</option><option value="5">5 estrellas</option><option value="4">4 estrellas</option><option value="3">3 estrellas</option><option value="2">2 estrellas</option><option value="1">1 estrella</option></select>
  );

  if (isMobile) {
    const activeCount = countActiveFilters({ approvalFilter, roleFilter, ratingFilter }, { approvalFilter: 'all', roleFilter: 'all', ratingFilter: 'all' });
    return <main className="feedback-page">
      <header className="feedback-page-header"><div><h1>Feedback</h1><p>Comentarios y calificaciones enviados desde los perfiles de usuarios.</p></div><AreaHomeShortcut /></header>
      <section className="feedback-metrics"><MetricCard label="Total feedback" value={data.length} tone="blue" description="Comentarios recibidos" iconName="message" /><MetricCard label="Publicados en home" value={publishedCount} tone="green" description="Un testimonio vigente por usuario" iconName="message" /><MetricCard label="Calificación promedio" value={average ? `${average.toFixed(1)} / 5` : '—'} tone="amber" description="Experiencia reportada" iconName="star" /></section>
      <div className="feedback-tabs" role="tablist" aria-label="Vistas de feedback"><button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Todos <span>{data.length}</span></button><button type="button" role="tab" aria-selected={tab === 'home'} className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>En el home <span>{publishedCount}</span></button></div>
      <div className="mb-filter-row">
        <input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar usuario o comentario" aria-label="Buscar feedback" />
        <FilterTrigger count={activeCount} onClick={() => setFiltersOpen(true)} />
      </div>
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar feedback"
        activeCount={activeCount}
        onClear={() => { setApprovalFilter('all'); setRoleFilter('all'); setRatingFilter('all'); }}
      >
        <label>Estado{approvalSelect}</label>
        <label>Rol{roleSelect}</label>
        <label>Calificación{ratingSelect}</label>
      </FilterSheet>
      {isError ? (
        <EmptyState tone="error" icon="alert" title="No pudimos cargar el feedback" description="Intenta nuevamente en unos segundos." />
      ) : (
        <RecordList
          loading={isLoading}
          ariaLabel="Feedback de usuarios"
          empty={<EmptyState icon="message" title="Sin comentarios" description="No hay comentarios que coincidan con los filtros." />}
        >
          {visible.map((item) => (
            <RecordCard
              key={item.id}
              leading={<CardAvatar src={(resolveProfileImageUrl(item.usuarioPerfilUrl) ?? undefined)} name={item.usuarioNombre} />}
              title={item.usuarioNombre}
              subtitle={`${isSellerRole(item.usuarioRol) ? 'Vendedor' : 'Comprador'} · ${formatDateTime(item.fechaCreacion)}`}
              badge={<span className={`feedback-approval ${item.aprobado ? 'approved' : 'pending'}`}>{item.aprobado ? 'Aprobado' : 'Pendiente'}</span>}
              footer={(
                <>
                  <b className="feedback-rating" aria-label={`${item.calificacion} de 5`}>{'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)}</b>
                  <p className="mb-feedback-comment">{item.comentario}</p>
                </>
              )}
              actions={(
                <button
                  type="button"
                  className={item.aprobado ? 'mb-action mb-action--danger' : 'mb-action mb-action--success'}
                  disabled={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate({ id: item.id, approved: !item.aprobado })}
                >
                  {item.aprobado ? 'Quitar del home' : 'Aprobar para home'}
                </button>
              )}
            />
          ))}
        </RecordList>
      )}
    </main>;
  }

  return <main className="feedback-page">
    <header className="feedback-page-header"><div><h1>Feedback</h1><p>Comentarios y calificaciones enviados desde los perfiles de usuarios.</p></div><AreaHomeShortcut /></header>
    <section className="feedback-metrics"><MetricCard label="Total feedback" value={data.length} tone="blue" description="Comentarios recibidos" iconName="message" /><MetricCard label="Publicados en home" value={publishedCount} tone="green" description="Un testimonio vigente por usuario" iconName="message" /><MetricCard label="Calificación promedio" value={average ? `${average.toFixed(1)} / 5` : '—'} tone="amber" description="Experiencia reportada" iconName="star" /></section>
    <div className="feedback-tabs" role="tablist" aria-label="Vistas de feedback"><button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Todos los feedback <span>{data.length}</span></button><button type="button" role="tab" aria-selected={tab === 'home'} className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Mostrados en el home <span>{publishedCount}</span></button></div>
    <section className="feedback-filters" aria-label="Filtros de feedback"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por usuario o comentario" />{approvalSelect}{roleSelect}{ratingSelect}</section>
    {isLoading ? <p className="feedback-state">Cargando feedback…</p> : isError ? <p className="feedback-state error">No pudimos cargar el feedback.</p> : visible.length === 0 ? <p className="feedback-state">No hay comentarios que coincidan.</p> : <div className="feedback-table-wrap"><table className="feedback-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Calificación</th><th>Comentario</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="feedback-user">{(resolveProfileImageUrl(item.usuarioPerfilUrl) ?? undefined) ? <img src={(resolveProfileImageUrl(item.usuarioPerfilUrl) ?? undefined)} alt="" /> : <span>{item.usuarioNombre?.slice(0, 1)}</span>}<strong>{item.usuarioNombre}</strong></div></td><td>{isSellerRole(item.usuarioRol) ? 'Vendedor' : 'Comprador'}</td><td><b className="feedback-rating">{'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)}</b></td><td className="feedback-comment">{item.comentario}</td><td>{formatDateTime(item.fechaCreacion)}</td><td><span className={`feedback-approval ${item.aprobado ? 'approved' : 'pending'}`}>{item.aprobado ? 'Aprobado' : 'Pendiente'}</span></td><td><button type="button" className={item.aprobado ? 'feedback-action remove' : 'feedback-action'} disabled={approvalMutation.isPending} onClick={() => approvalMutation.mutate({ id: item.id, approved: !item.aprobado })}>{item.aprobado ? 'Quitar del home' : 'Aprobar para home'}</button></td></tr>)}</tbody></table></div>}
  </main>;
}
