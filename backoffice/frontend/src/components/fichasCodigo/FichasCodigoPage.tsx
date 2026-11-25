import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as fichasApi from '@/api/fichasCodigo';
import MetricCard from '@/components/shared/MetricCard';
import PageHeader from '@/components/shared/PageHeader';
import Pagination from '@/components/shared/Pagination';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import SearchInput from '@/components/shared/SearchInput';
import type { FichaFiltro } from '@/types/fichaCodigo';
import EquivalenciasPanel from './EquivalenciasPanel';
import FichaDetalleModal from './FichaDetalleModal';
import FichaManualModal from './FichaManualModal';
import { SinFichaPanel, UsoPanel } from './SinFichaYUsoPanel';
import { estadoPill } from './utils';
import './fichasCodigo.css';

type Pestana = 'fichas' | 'equivalencias' | 'sin-ficha' | 'uso';

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'fichas', label: 'Fichas' },
  { id: 'equivalencias', label: 'Modelos y categorías' },
  { id: 'sin-ficha', label: 'No encontrados' },
  { id: 'uso', label: 'Uso de la API' },
];

const FILTROS: { id: FichaFiltro; label: string }[] = [
  { id: 'sin-verificar', label: 'Sin verificar' },
  { id: 'media', label: 'Confianza media' },
  { id: 'reportadas', label: 'Reportadas' },
  { id: 'verificadas', label: 'Verificadas' },
  { id: 'rechazadas', label: 'Rechazadas' },
  { id: 'todas', label: 'Todas' },
];

/**
 * Soporte de las fichas por codigo del fabricante (25-nov): revisar lo que el catalogo externo completo, corregirlo,
 * resolver las equivalencias de modelos y categorias y crear a mano lo que no se encontro. Todo queda en la bitacora.
 */
export default function FichasCodigoPage() {
  const [params, setParams] = useSearchParams();
  const pestana = (PESTANAS.find((p) => p.id === params.get('tab'))?.id ?? 'fichas') as Pestana;
  const [filtro, setFiltro] = useState<FichaFiltro>('sin-verificar');
  const [texto, setTexto] = useState('');
  const [masUsadas, setMasUsadas] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);

  const cola = useQuery({
    queryKey: ['fichas-codigo', 'cola', filtro, texto, masUsadas, page, size],
    queryFn: () => fichasApi.getFichas({ filtro, q: texto || undefined, masUsadas, page, size }),
    enabled: pestana === 'fichas',
    placeholderData: (previa) => previa,
  });
  const cifras = cola.data?.cifras;
  const cambiarFiltro = (f: FichaFiltro) => { setFiltro(f); setPage(0); };

  return (
    <div className="page-content fc-page">
      <PageHeader title="Fichas por código" description="Revisa lo que el catálogo completó por el código del fabricante, corrígelo y resuelve lo que no calzó."
        actions={<button type="button" className="primary-button" onClick={() => setCreando(true)}>Crear ficha a mano</button>} />

      <div className="feedback-tabs" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} className={pestana === p.id ? 'active' : ''}
            onClick={() => setParams(p.id === 'fichas' ? {} : { tab: p.id })}>
            {p.label}
          </button>
        ))}
      </div>

      {pestana === 'fichas' && (
        <>
          <div className="metric-grid compact">
            <MetricCard label="Sin verificar" value={cifras?.sinVerificar ?? '—'} tone="amber" iconName="clipboard" description="Esperan una revisión" />
            <MetricCard label="Confianza media" value={cifras?.confianzaMedia ?? '—'} tone="violet" iconName="alert" description="Llegaron por un código equivalente" />
            <MetricCard label="Reportadas" value={cifras?.reportadas ?? '—'} tone="red" iconName="flag" description="Un comprador vio un error" />
            <MetricCard label="Verificadas" value={cifras?.verificadas ?? '—'} tone="green" iconName="shieldCheck" description={`${cifras?.total ?? 0} fichas en total`} />
          </div>

          <section className="table-shell">
            <div className="table-toolbar fc-toolbar">
              <div className="fc-chips" role="group" aria-label="Filtro">
                {FILTROS.map((f) => (
                  <button key={f.id} type="button" className={`fc-filtro${filtro === f.id ? ' active' : ''}`} aria-pressed={filtro === f.id} onClick={() => cambiarFiltro(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="fc-filtros">
                <SearchInput value={texto} onChange={(v) => { setTexto(v); setPage(0); }} placeholder="Código, nombre o marca…" />
                <label className="fc-check"><input type="checkbox" checked={masUsadas} onChange={(e) => { setMasUsadas(e.target.checked); setPage(0); }} /> Más publicadas primero</label>
              </div>
            </div>

            {cola.isError && <QueryErrorNotice error={cola.error} what="las fichas" onRetry={() => cola.refetch()} />}
            {cola.isLoading ? <p className="panel-hint">Cargando…</p> : (cola.data?.content.length ?? 0) === 0 ? (
              <p className="panel-hint">No hay fichas en este filtro.</p>
            ) : (
              <div className="table-scroll">
                <table className="wide-table">
                  <thead><tr><th>Código</th><th>Repuesto</th><th>Estado</th><th>Vehículos</th><th>Publicaciones</th><th /></tr></thead>
                  <tbody>
                    {cola.data?.content.map((f) => (
                      <tr key={f.id} className="fc-fila" onClick={() => setAbierta(f.id)}>
                        <td><strong>{f.codigo}</strong><div className="panel-hint">{f.marca}</div></td>
                        <td>{f.nombre}<div className="panel-hint">{f.subcategoria ? `${f.categoria} › ${f.subcategoria}` : 'Sin categoría'}</div></td>
                        <td>
                          {estadoPill(f.estado)}
                          {f.confianza === 'MEDIA' && f.estado === 'AUTO' && <span className="status-pill tone-blue">Media</span>}
                          {f.reportes > 0 && <span className="status-pill tone-red">{f.reportes} {f.reportes === 1 ? 'reporte' : 'reportes'}</span>}
                        </td>
                        <td>{f.vehiculos}{f.fueraDeCatalogo > 0 && <div className="panel-hint">{f.fueraDeCatalogo} fuera del catálogo</div>}</td>
                        <td>
                          {f.usos === 0 ? <span className="panel-hint">Sin publicar</span> : `${f.usos} en ${f.tiendas} ${f.tiendas === 1 ? 'tienda' : 'tiendas'}`}
                          {f.editadas > 0 && <div className="panel-hint">{f.editadas} editadas por la tienda</div>}
                        </td>
                        <td><button type="button" className="secondary-button" onClick={(e) => { e.stopPropagation(); setAbierta(f.id); }}>Revisar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {cola.data && cola.data.totalElements > 0 && (
              <Pagination currentPage={cola.data.currentPage} totalPages={cola.data.totalPages} totalItems={cola.data.totalElements} pageSize={size}
                onPageChange={setPage} onPageSizeChange={(s) => { setSize(s); setPage(0); }} />
            )}
          </section>
        </>
      )}

      {pestana === 'equivalencias' && <EquivalenciasPanel />}
      {pestana === 'sin-ficha' && <SinFichaPanel onAbrirFicha={setAbierta} />}
      {pestana === 'uso' && <UsoPanel />}

      <FichaDetalleModal fichaId={abierta} onClose={() => setAbierta(null)} />
      <FichaManualModal abierto={creando} onClose={() => setCreando(false)} onCreada={(id) => { setCreando(false); setAbierta(id); }} />
    </div>
  );
}
