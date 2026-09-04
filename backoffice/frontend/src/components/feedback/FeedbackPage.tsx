import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as feedbackApi from '@/api/feedback';
import MetricCard from '@/components/shared/MetricCard';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import { formatDateTime } from '@/utils/formatters';

export default function FeedbackPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'home'>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'seller' | 'buyer'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['system-feedback'], queryFn: feedbackApi.getSystemFeedback });
  const { data: homeFeedback = [] } = useQuery({ queryKey: ['system-feedback', 'home'], queryFn: feedbackApi.getHomeFeedback });
  const approvalMutation = useMutation({ mutationFn: ({ id, approved }: { id: number; approved: boolean }) => feedbackApi.setSystemFeedbackApproval(id, approved), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-feedback'] }) });
  const feedbackForTab = tab === 'home' ? homeFeedback : data;
  const visible = useMemo(() => feedbackForTab.filter((item) => {
    const isSeller = ['SELLER', 'VENDEDOR'].includes(item.usuarioRol);
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

  return <main className="feedback-page">
    <header className="feedback-page-header"><div><h1>Feedback</h1><p>Comentarios y calificaciones enviados desde los perfiles de usuarios.</p></div><AreaHomeShortcut /></header>
    <section className="feedback-metrics"><MetricCard label="Total feedback" value={data.length} tone="blue" description="Comentarios recibidos" iconName="message" /><MetricCard label="Publicados en home" value={publishedCount} tone="green" description="Un testimonio vigente por usuario" iconName="message" /><MetricCard label="Calificación promedio" value={average ? `${average.toFixed(1)} / 5` : '—'} tone="amber" description="Experiencia reportada" iconName="star" /></section>
    <div className="feedback-tabs" role="tablist" aria-label="Vistas de feedback"><button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Todos los feedback <span>{data.length}</span></button><button type="button" role="tab" aria-selected={tab === 'home'} className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Mostrados en el home <span>{publishedCount}</span></button></div>
    <section className="feedback-filters" aria-label="Filtros de feedback"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por usuario o comentario" /><select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value as typeof approvalFilter)} disabled={tab === 'home'}><option value="all">Todos los estados</option><option value="approved">Aprobados</option><option value="pending">Pendientes</option></select><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}><option value="all">Todos los roles</option><option value="seller">Vendedores</option><option value="buyer">Compradores</option></select><select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value as typeof ratingFilter)}><option value="all">Todas las calificaciones</option><option value="5">5 estrellas</option><option value="4">4 estrellas</option><option value="3">3 estrellas</option><option value="2">2 estrellas</option><option value="1">1 estrella</option></select></section>
    {isLoading ? <p className="feedback-state">Cargando feedback…</p> : isError ? <p className="feedback-state error">No pudimos cargar el feedback.</p> : visible.length === 0 ? <p className="feedback-state">No hay comentarios que coincidan.</p> : <div className="feedback-table-wrap"><table className="feedback-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Calificación</th><th>Comentario</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="feedback-user">{item.usuarioPerfilUrl ? <img src={item.usuarioPerfilUrl} alt="" /> : <span>{item.usuarioNombre?.slice(0, 1)}</span>}<strong>{item.usuarioNombre}</strong></div></td><td>{['SELLER', 'VENDEDOR'].includes(item.usuarioRol) ? 'Vendedor' : 'Comprador'}</td><td><b className="feedback-rating">{'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)}</b></td><td className="feedback-comment">{item.comentario}</td><td>{formatDateTime(item.fechaCreacion)}</td><td><span className={`feedback-approval ${item.aprobado ? 'approved' : 'pending'}`}>{item.aprobado ? 'Aprobado' : 'Pendiente'}</span></td><td><button type="button" className={item.aprobado ? 'feedback-action remove' : 'feedback-action'} disabled={approvalMutation.isPending} onClick={() => approvalMutation.mutate({ id: item.id, approved: !item.aprobado })}>{item.aprobado ? 'Quitar del home' : 'Aprobar para home'}</button></td></tr>)}</tbody></table></div>}
  </main>;
}
