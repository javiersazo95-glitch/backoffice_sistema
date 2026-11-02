import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrackedProfiles } from '@/api/tracking';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { formatDate } from '@/utils/formatters';
import type { TrackedProfile, TrackedPublication, TrackingKind } from '@/types/tracking';
import { formatAge } from './age';
import ContactModal, { contactResultMeta } from './ContactModal';

const PAGE_SIZE = 8;

type ProfileFilter = 'TODOS' | 'LES_SIRVE' | 'SIN_RESPUESTA' | 'SIN_NOTIFICAR';

interface TrackedProfilesModalProps {
  kind: TrackingKind;
  publication: TrackedPublication;
  onClose: () => void;
}

/**
 * Perfiles dentro del alcance de una publicación: a quiénes les sirve, quién ya respondió y a quién falta avisar. Los que no
 * respondieron tienen un botón "Contactar" con todos sus datos; el tick marca a los ya notificados.
 */
export default function TrackedProfilesModal({ kind, publication, onClose }: TrackedProfilesModalProps) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<ProfileFilter>('SIN_RESPUESTA');
  const [contactTarget, setContactTarget] = useState<TrackedProfile | null>(null);
  const profileLabel = kind === 'fallas' ? 'talleres' : 'casas de repuestos';
  const responseLabel = kind === 'fallas' ? 'Diagnosticó' : 'Ofertó';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tracking-profiles', kind, publication.id],
    queryFn: () => getTrackedProfiles(kind, publication.id),
  });

  const profiles = useMemo(() => data?.perfiles ?? [], [data]);
  const filtered = useMemo(() => profiles.filter((profile) => {
    if (filter === 'LES_SIRVE') return profile.calza;
    if (filter === 'SIN_RESPUESTA') return !profile.respondio;
    if (filter === 'SIN_NOTIFICAR') return !profile.respondio && !profile.notificado;
    return true;
  }), [profiles, filter]);

  const totals = {
    all: profiles.length,
    fit: profiles.filter((p) => p.calza).length,
    answered: profiles.filter((p) => p.respondio).length,
    notified: profiles.filter((p) => p.notificado).length,
  };
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0));
  const rows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  // El perfil abierto en el contacto se lee de la lista viva para que el tick se actualice al guardar.
  const liveTarget = contactTarget ? profiles.find((p) => p.id === contactTarget.id) ?? contactTarget : null;

  return (
    <div className="case-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="seller-documents-modal" style={{ maxWidth: '1100px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className="seller-documents-icon"><UiIcon name="users" /></span>
            <div className="seller-documents-title">
              <h2>{publication.titulo}</h2>
              <p>
                {[publication.vehiculo, publication.comuna].filter(Boolean).join(' · ') || 'Sin detalle'} · publicada {formatAge(publication.createdAt)}
              </p>
            </div>
          </div>
          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section style={{ padding: '20px', maxHeight: 'min(560px, calc(100dvh - 150px))', overflowY: 'auto' }}>
          {isError && <p className="row-sub">No se pudieron cargar los perfiles.</p>}
          {isLoading && <p className="row-sub">Cargando perfiles...</p>}

          {data && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <p className="row-sub" style={{ margin: 0 }}>
                  <strong>{totals.all}</strong> {profileLabel} en la zona · a <strong>{totals.fit}</strong> les sirve ·{' '}
                  <strong>{totals.answered}</strong> {kind === 'fallas' ? 'ya diagnosticaron' : 'ya ofertaron'} · <strong>{totals.notified}</strong> notificados
                </p>
                <select className="select" style={{ width: 'auto' }} value={filter} onChange={(e) => { setFilter(e.target.value as ProfileFilter); setPage(0); }} aria-label="Filtrar perfiles">
                  <option value="SIN_RESPUESTA">Sin {kind === 'fallas' ? 'diagnóstico' : 'oferta'}</option>
                  <option value="SIN_NOTIFICAR">Por notificar</option>
                  <option value="LES_SIRVE">Les sirve</option>
                  <option value="TODOS">Todos</option>
                </select>
              </div>

              {filtered.length ? (
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table className="wide-table seller-profile-table" style={{ tableLayout: 'auto', minWidth: 900 }}>
                    <thead>
                      <tr><th>Perfil</th><th>Por qué le sirve</th><th>Comuna</th><th>Registro</th><th>{kind === 'fallas' ? 'Diagnóstico' : 'Oferta'}</th><th>Último contacto</th><th style={{ textAlign: 'right' }}>Contacto</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((profile) => (
                        <tr key={profile.id}>
                          <td style={{ whiteSpace: 'normal', minWidth: 170 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {profile.notificado && (
                                <span title={`Notificado${profile.notificadoEn ? ` el ${formatDate(profile.notificadoEn)}` : ''}`} aria-label="Notificado"
                                  style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: '50%', background: '#16a34a', color: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <UiIcon name="check" style={{ width: 12, height: 12 }} />
                                </span>
                              )}
                              <strong>{profile.nombre}</strong>
                            </span>
                            {profile.responsable && <div className="row-sub">{profile.responsable}</div>}
                          </td>
                          <td style={{ whiteSpace: 'normal', minWidth: 200 }}>
                            <Badge text={profile.calza ? 'Le sirve' : 'Sólo en la zona'} variant={profile.calza ? 'green' : ''} />
                            {profile.motivos.map((reason) => <div key={reason} className="row-sub">{reason}</div>)}
                          </td>
                          <td style={{ whiteSpace: 'normal' }}>{profile.comuna || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {profile.registradoEn ? <>{formatDate(profile.registradoEn)}<div className="row-sub">{formatAge(profile.registradoEn)}</div></> : '—'}
                          </td>
                          <td>
                            <Badge text={profile.respondio ? responseLabel : 'Sin responder'} variant={profile.respondio ? 'green' : 'amber'} />
                            {profile.respondioEn && <div className="row-sub">{formatAge(profile.respondioEn)}</div>}
                          </td>
                          <td style={{ whiteSpace: 'normal', minWidth: 130 }}>
                            {profile.ultimoContacto ? (
                              <>
                                <Badge text={contactResultMeta(profile.ultimoContacto.resultado).label} variant={contactResultMeta(profile.ultimoContacto.resultado).tone} />
                                <div className="row-sub">{formatAge(profile.ultimoContacto.createdAt)}{profile.ultimoContacto.responsable ? ` · ${profile.ultimoContacto.responsable}` : ''}</div>
                              </>
                            ) : <span className="row-sub">Sin contactar</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {profile.respondio ? <span className="row-sub">—</span> : (
                              <button className="secondary-button" type="button" style={{ padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                                onClick={() => setContactTarget(profile)}>
                                <UiIcon name="smartphone" style={{ width: 13, height: 13 }} /> Contactar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="row-sub">No hay {profileLabel} para este filtro.</p>
              )}

              {totalPages > 1 && (
                <div className="pagination compact-pagination seller-profile-pagination">
                  <span>Mostrando {currentPage * PAGE_SIZE + 1} a {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
                  <div className="page-buttons">
                    <button className="page-button page-prev" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Página anterior"><UiIcon name="arrowRight" /></button>
                    {Array.from({ length: totalPages }, (_, index) => index).map((item) => (
                      <button key={item} className={`page-button ${item === currentPage ? 'active' : ''}`} type="button" onClick={() => setPage(item)}>{item + 1}</button>
                    ))}
                    <button className="page-button" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages - 1} aria-label="Página siguiente"><UiIcon name="arrowRight" /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {liveTarget && (
        <ContactModal kind={kind} publication={publication} profile={liveTarget} onClose={() => setContactTarget(null)} />
      )}
    </div>
  );
}
