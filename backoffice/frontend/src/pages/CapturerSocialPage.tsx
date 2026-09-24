import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/capturers';
import { deleteSocialContenido, getSocialEstado, listSocialContenidos, registerSocialDescarga, saveSocialFile } from '@/api/capturerSocial';
import CapturerLayout from '@/components/capturer/CapturerLayout';
import SocialLevelPanel from '@/components/capturer/social/SocialLevelPanel';
import SocialPostCard from '@/components/capturer/social/SocialPostCard';
import SocialUploadModal from '@/components/capturer/social/SocialUploadModal';
import SocialDetailModal, { SocialEditModal } from '@/components/capturer/social/SocialDetailModal';
import { socialCss } from '@/components/capturer/social/socialStyles';
import type { SocialCategoria, SocialContenido, SocialOrden, SocialRed, SocialTipo, SocialVista } from '@/types/capturerSocial';
import { SOCIAL_CATEGORIAS, SOCIAL_REDES } from '@/types/capturerSocial';

const TABS: Array<{ value: SocialVista; label: string; hint: string }> = [
  { value: 'PUBLICO', label: 'Repositorio público', hint: 'Lo que suben todos los captadores' },
  { value: 'MIOS', label: 'Mis contenidos', hint: 'Lo que tú subiste' },
  { value: 'DESCARGADOS', label: 'Mis descargas', hint: 'Lo que ya bajaste y su bloqueo' },
];

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), intervalMs); return () => window.clearInterval(t); }, [intervalMs]);
  return now;
}

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]);
  return v;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
}

export default function CapturerSocialPage() {
  const qc = useQueryClient();
  const now = useNow();
  const [vista, setVista] = useState<SocialVista>('PUBLICO');
  const [tipo, setTipo] = useState<SocialTipo | ''>('');
  const [categoria, setCategoria] = useState<SocialCategoria | ''>('');
  const [red, setRed] = useState<SocialRed | ''>('');
  const [orden, setOrden] = useState<SocialOrden>('RECIENTES');
  const [soloNoDescargados, setSoloNoDescargados] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounced(busqueda);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detalle, setDetalle] = useState<SocialContenido | null>(null);
  const [editando, setEditando] = useState<SocialContenido | null>(null);
  const [descargando, setDescargando] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 4500); return () => window.clearTimeout(t); }, [toast]);

  const status = useQuery({ queryKey: ['capturer-status'], queryFn: api.getStatus });
  const estado = useQuery({ queryKey: ['capturer-social-estado'], queryFn: getSocialEstado, refetchInterval: 60_000 });
  const filtros = useMemo(() => ({ vista, tipo, categoria, red, q, orden, soloNoDescargados: vista === 'PUBLICO' && soloNoDescargados }), [vista, tipo, categoria, red, q, orden, soloNoDescargados]);
  const feed = useInfiniteQuery({
    queryKey: ['capturer-social-feed', filtros],
    queryFn: ({ pageParam }) => listSocialContenidos(filtros, pageParam),
    initialPageParam: 0,
    getNextPageParam: last => (last.pagina + 1 < last.totalPaginas ? last.pagina + 1 : undefined),
  });
  const items = feed.data?.pages.flatMap(p => p.contenido) ?? [];
  const total = feed.data?.pages[0]?.total ?? 0;
  const alias = status.data?.alias ?? 'captador';

  async function refrescar() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['capturer-social-feed'] }),
      qc.invalidateQueries({ queryKey: ['capturer-social-estado'] }),
    ]);
  }

  async function descargar(c: SocialContenido) {
    setDescargando(c.id);
    try {
      const d = await registerSocialDescarga(c.id);
      await saveSocialFile(d.url, d.nombreArchivo);
      qc.setQueryData(['capturer-social-estado'], d.estado);
      setToast({ text: c.propio ? 'Descarga lista.' : `¡Descargado! Esta pieza queda bloqueada ${d.estado.bloqueoDias} días. Te quedan ${d.estado.descargasRestantes ?? '∞'} descargas esta semana.` });
      if (detalle?.id === c.id) setDetalle({ ...c, ultimaDescarga: d.descargadoEn, bloqueadoHasta: d.bloqueadoHasta, motivoBloqueo: d.bloqueadoHasta ? 'BLOQUEO_14_DIAS' : c.motivoBloqueo, puedeDescargar: !d.bloqueadoHasta, descargasTotal: c.descargasTotal + 1 });
      await refrescar();
    } catch (err) {
      setToast({ text: errorMessage(err, 'No pudimos descargar el contenido.'), err: true });
      await refrescar();
    } finally { setDescargando(null); }
  }

  async function eliminar(c: SocialContenido) {
    if (!window.confirm(`¿Eliminar "${c.titulo}" del repositorio? Esta acción no se puede deshacer.`)) return;
    try { await deleteSocialContenido(c.id); setToast({ text: 'Contenido eliminado.' }); await refrescar(); }
    catch (err) { setToast({ text: errorMessage(err, 'No pudimos eliminar el contenido.'), err: true }); }
  }

  const e = estado.data;
  const emptyText = vista === 'MIOS'
    ? { t: 'Todavía no subes contenido', d: 'Sube tu primer video: con 3 videos en 7 días desbloqueas el repositorio completo.' }
    : vista === 'DESCARGADOS'
      ? { t: 'Aún no descargas contenido', d: 'Lo que descargues aparecerá aquí con su contador de bloqueo de 14 días.' }
      : { t: 'No hay contenido con estos filtros', d: 'Prueba otros filtros o sé el primero en subir contenido.' };

  return <CapturerLayout alias={status.data?.alias} region={status.data?.region} comuna={status.data?.comuna} fotoPerfil={status.data?.fotoPerfil}>
    <style>{socialCss}</style>
    <div className="cap-soc">
      <section className="cap-soc-card cap-soc-head">
        <div>
          <h2>Redes sociales</h2>
          <p>Repositorio compartido de videos e imágenes que suben los captadores. Descárgalos, publícalos en tus redes con tu código y cuéntanos qué resultados te dieron.</p>
        </div>
        <button type="button" className="cap-soc-btn" onClick={() => setUploadOpen(true)} disabled={!!e && e.subidasHoy >= e.subidasMaximasDia}>＋ Subir contenido</button>
      </section>

      {e ? <SocialLevelPanel e={e} now={now} /> : <div className="cap-soc-skeleton" style={{ aspectRatio: 'auto', height: 150 }} />}
      {e && !e.accesoActivo && vista === 'PUBLICO' && <div className="cap-soc-banner">🔒 Para descargar del repositorio sube {e.videosRequeridos - e.videosUltimos7Dias} video(s) más. El acceso dura 7 días desde tus últimos {e.videosRequeridos} videos.</div>}

      <section className="cap-soc-card" style={{ display: 'grid', gap: 14 }}>
        <div className="cap-soc-head">
          <div className="cap-soc-tabs" role="tablist">
            {TABS.map(t => <button key={t.value} type="button" role="tab" aria-selected={vista === t.value} title={t.hint}
              className={`cap-soc-tab${vista === t.value ? ' on' : ''}${t.value === 'MIOS' ? ' mine' : ''}`} onClick={() => setVista(t.value)}>
              {t.label}{vista === t.value && !feed.isLoading && <em>{total}</em>}
            </button>)}
          </div>
          <div className="cap-soc-chips" role="group" aria-label="Tipo">
            {([['', 'Todo'], ['VIDEO', 'Videos'], ['IMAGEN', 'Imágenes']] as const).map(([v, l]) => <button key={v} type="button" className={`cap-soc-chip${tipo === v ? ' on' : ''}`} onClick={() => setTipo(v)}>{l}</button>)}
          </div>
        </div>
        <div className="cap-soc-filters">
          <label className="cap-soc-search"><span aria-hidden="true">🔎</span><input value={busqueda} maxLength={80} onChange={ev => setBusqueda(ev.target.value)} placeholder="Buscar por título, texto o @captador" aria-label="Buscar" /></label>
          <select className="cap-soc-select" value={categoria} onChange={ev => setCategoria(ev.target.value as SocialCategoria | '')} aria-label="Categoría">
            <option value="">Todas las categorías</option>{SOCIAL_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="cap-soc-select" value={red} onChange={ev => setRed(ev.target.value as SocialRed | '')} aria-label="Red social">
            <option value="">Todas las redes</option>{SOCIAL_REDES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select className="cap-soc-select" value={orden} onChange={ev => setOrden(ev.target.value as SocialOrden)} aria-label="Ordenar">
            <option value="RECIENTES">Más recientes</option><option value="MEJOR_EVALUADOS">Mejor evaluados</option><option value="MAS_DESCARGADOS">Más descargados</option><option value="ANTIGUOS">Más antiguos</option>
          </select>
          {vista === 'PUBLICO' && <label className="cap-soc-toggle"><input type="checkbox" checked={soloNoDescargados} onChange={ev => setSoloNoDescargados(ev.target.checked)} />Solo lo que no he descargado</label>}
        </div>

        {feed.isLoading ? <div className="cap-soc-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="cap-soc-skeleton" />)}</div>
          : feed.isError ? <div className="cap-soc-error">{errorMessage(feed.error, 'No pudimos cargar el repositorio.')}</div>
            : items.length === 0 ? <div className="cap-soc-empty"><span style={{ fontSize: 34 }}>{vista === 'MIOS' ? '🎥' : '📭'}</span><strong>{emptyText.t}</strong><span>{emptyText.d}</span>
              {vista !== 'DESCARGADOS' && <button type="button" className="cap-soc-btn" onClick={() => setUploadOpen(true)}>＋ Subir contenido</button>}</div>
              : <div className="cap-soc-grid">
                {items.map(c => <SocialPostCard key={c.id} c={c} now={now} downloading={descargando === c.id} onOpen={setDetalle} onDownload={descargar}
                  variant={vista === 'MIOS' ? 'mine' : 'feed'} onEdit={setEditando} onDelete={eliminar} />)}
              </div>}
        {feed.hasNextPage && <div className="cap-soc-more"><button type="button" className="cap-soc-btn cap-soc-btn-ghost" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>{feed.isFetchingNextPage ? 'Cargando…' : 'Ver más contenido'}</button></div>}
      </section>
    </div>

    {uploadOpen && <SocialUploadModal alias={alias} onClose={() => setUploadOpen(false)} onDone={async () => {
      setUploadOpen(false); setToast({ text: '¡Publicado! Tu contenido ya está en el repositorio.' }); setVista('MIOS'); await refrescar();
    }} />}
    {detalle && <SocialDetailModal c={detalle} now={now} downloading={descargando === detalle.id} onClose={() => setDetalle(null)} onDownload={descargar} onChanged={() => void refrescar()} />}
    {editando && <SocialEditModal c={editando} onClose={() => setEditando(null)} onSaved={async () => { setEditando(null); setToast({ text: 'Cambios guardados.' }); await refrescar(); }} />}
    {toast && <div className={`cap-soc-toast${toast.err ? ' err' : ''}`} role="status">{toast.text}</div>}
  </CapturerLayout>;
}
