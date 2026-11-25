import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as fichasApi from '@/api/fichasCodigo';
import { mensajeDeError } from '@/api/client';
import Pagination from '@/components/shared/Pagination';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import SearchInput from '@/components/shared/SearchInput';
import type { AliasFila, AliasTipo } from '@/types/fichaCodigo';

/** Selector de destino: una subcategoria nuestra, o marca y luego modelo del catalogo chileno. */
function SelectorDestino({ fila, onElegir, ocupado }: { fila: AliasFila; onElegir: (destinoId: number) => void; ocupado: boolean }) {
  const categoria = fila.tipo === 'CATEGORIA';
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const subcategorias = useQuery({ queryKey: ['fichas-codigo', 'subcategorias'], queryFn: fichasApi.getSubcategorias, staleTime: 3_600_000, enabled: categoria });
  const marcas = useQuery({ queryKey: ['fichas-codigo', 'marcas-vehiculo'], queryFn: fichasApi.getMarcasVehiculo, staleTime: 3_600_000, enabled: !categoria });
  const modelos = useQuery({ queryKey: ['fichas-codigo', 'modelos', marcaId], queryFn: () => fichasApi.getModelosVehiculo(marcaId as number), enabled: !categoria && marcaId != null });

  if (categoria) {
    return (
      <select className="select" defaultValue="" disabled={ocupado} aria-label={`Subcategoría para ${fila.texto}`}
        onChange={(e) => e.target.value && onElegir(Number(e.target.value))}>
        <option value="">Elegir subcategoría…</option>
        {(subcategorias.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.categoriaNombre} › {s.nombre}</option>)}
      </select>
    );
  }
  return (
    <div className="fc-destino">
      <select className="select" value={marcaId ?? ''} disabled={ocupado} aria-label="Marca" onChange={(e) => setMarcaId(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Marca…</option>
        {(marcas.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <select className="select" defaultValue="" disabled={ocupado || marcaId == null} aria-label={`Modelo para ${fila.texto}`}
        onChange={(e) => e.target.value && onElegir(Number(e.target.value))}>
        <option value="">{marcaId == null ? 'Elige la marca' : 'Modelo…'}</option>
        {(modelos.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
    </div>
  );
}

/**
 * Los modelos y categorias del catalogo externo que no calzan con los nuestros. Al resolver uno se rehacen las fichas sin
 * verificar que lo usaban; las verificadas no se tocan.
 */
export default function EquivalenciasPanel() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<AliasTipo>('MODELO');
  const [pendientes, setPendientes] = useState(true);
  const [texto, setTexto] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const query = useQuery({
    queryKey: ['fichas-codigo', 'equivalencias', tipo, pendientes, texto, page, size],
    queryFn: () => fichasApi.getEquivalencias({ tipo, pendientes, q: texto || undefined, page, size }),
  });

  const resolver = useMutation({
    mutationFn: ({ id, destinoId }: { id: number; destinoId: number | null }) => fichasApi.resolverEquivalencia(id, destinoId),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['fichas-codigo'] });
      setAviso({
        tono: 'ok',
        texto: r.alias.destinoId == null
          ? `Se quitó la equivalencia de «${r.alias.texto}». Fichas rehechas: ${r.fichasActualizadas}.`
          : `«${r.alias.texto}» → ${r.alias.destino ?? 'destino elegido'}. Fichas rehechas: ${r.fichasActualizadas}.`,
      });
    },
    onError: (e) => setAviso({ tono: 'error', texto: mensajeDeError(e, 'No se pudo guardar la equivalencia.') }),
  });

  const filas = query.data?.content ?? [];

  return (
    <section className="table-shell">
      <div className="table-toolbar fc-toolbar">
        <h2>Modelos y categorías sin equivalencia</h2>
        <div className="fc-filtros">
          <select className="select" value={tipo} onChange={(e) => { setTipo(e.target.value as AliasTipo); setPage(0); }} aria-label="Tipo">
            <option value="MODELO">Modelos de vehículo</option>
            <option value="CATEGORIA">Categorías de repuesto</option>
          </select>
          <select className="select" value={pendientes ? 'p' : 't'} onChange={(e) => { setPendientes(e.target.value === 'p'); setPage(0); }} aria-label="Estado">
            <option value="p">Solo pendientes</option>
            <option value="t">Todas</option>
          </select>
          <SearchInput value={texto} onChange={(v) => { setTexto(v); setPage(0); }} placeholder="Buscar texto…" />
        </div>
      </div>
      <p className="panel-hint fc-ayuda">
        {tipo === 'MODELO'
          ? 'Cómo llama el catálogo externo a un modelo (ej. «COROLLA Verso») y a cuál de los nuestros corresponde. Ordenados por los que más se repiten.'
          : 'Cómo llama el catálogo externo a una categoría de repuesto y a qué subcategoría nuestra equivale.'}
      </p>
      {aviso && <div className={`notice${aviso.tono === 'error' ? ' error' : ''}`} role="status"><p>{aviso.texto}</p></div>}
      {query.isError && <QueryErrorNotice error={query.error} what="las equivalencias" onRetry={() => query.refetch()} />}
      {query.isLoading ? <p className="panel-hint">Cargando…</p> : filas.length === 0 ? (
        <p className="panel-hint">{pendientes ? 'No hay equivalencias pendientes. 🎉' : 'Sin resultados.'}</p>
      ) : (
        <div className="table-scroll">
          <table className="wide-table">
            <thead><tr><th>Texto del catálogo externo</th><th>Veces</th><th>Corresponde a</th><th /></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.texto}</strong></td>
                  <td>{f.veces}</td>
                  <td>
                    {f.destinoId != null
                      ? <span className="status-pill tone-green">{f.destino ?? `id ${f.destinoId}`}</span>
                      : <SelectorDestino fila={f} ocupado={resolver.isPending} onElegir={(destinoId) => resolver.mutate({ id: f.id, destinoId })} />}
                  </td>
                  <td>
                    {f.destinoId != null && (
                      <button type="button" className="ghost-button" disabled={resolver.isPending} onClick={() => resolver.mutate({ id: f.id, destinoId: null })}>Quitar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && query.data.totalElements > 0 && (
        <Pagination currentPage={query.data.currentPage} totalPages={query.data.totalPages} totalItems={query.data.totalElements} pageSize={size}
          onPageChange={setPage} onPageSizeChange={(s) => { setSize(s); setPage(0); }} />
      )}
    </section>
  );
}
