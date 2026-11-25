import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as fichasApi from '@/api/fichasCodigo';
import MetricCard from '@/components/shared/MetricCard';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import { fechaCorta } from './utils';
import FichaManualModal from './FichaManualModal';

/** Codigos que las tiendas buscaron y el catalogo no conoce (ultimos 90 dias), para crearles la ficha a mano. */
export function SinFichaPanel({ onAbrirFicha }: { onAbrirFicha: (id: number) => void }) {
  const query = useQuery({ queryKey: ['fichas-codigo', 'sin-ficha'], queryFn: () => fichasApi.getCodigosSinFicha(100) });
  const [crearPara, setCrearPara] = useState<string | null>(null);
  const filas = query.data ?? [];

  return (
    <section className="table-shell">
      <div className="table-toolbar"><h2>Códigos que no se encontraron</h2></div>
      <p className="panel-hint fc-ayuda">Códigos que las tiendas escribieron y el catálogo no conoce, de los últimos 90 días. Ordenados por los más buscados.</p>
      {query.isError && <QueryErrorNotice error={query.error} what="los códigos sin ficha" onRetry={() => query.refetch()} />}
      {query.isLoading ? <p className="panel-hint">Cargando…</p> : filas.length === 0 ? (
        <p className="panel-hint">No hay códigos sin ficha.</p>
      ) : (
        <div className="table-scroll">
          <table className="wide-table">
            <thead><tr><th>Código</th><th>Búsquedas</th><th>Última</th><th /></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.codigo}>
                  <td><strong>{f.codigo}</strong></td>
                  <td>{f.semanas}</td>
                  <td>{fechaCorta(f.ultimaBusqueda)}</td>
                  <td><button type="button" className="secondary-button" onClick={() => setCrearPara(f.codigo)}>Crear ficha</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FichaManualModal abierto={crearPara != null} codigoInicial={crearPara ?? ''} onClose={() => setCrearPara(null)}
        onCreada={(id) => { setCrearPara(null); onAbrirFicha(id); }} />
    </section>
  );
}

const pct = (usado: number, tope: number) => (tope > 0 ? `${Math.min(100, Math.round((usado / tope) * 100))}% del tope` : 'sin tope');

/** Cuanto se ha usado el catalogo externo y en que estado esta la integracion. */
export function UsoPanel() {
  const query = useQuery({ queryKey: ['fichas-codigo', 'uso'], queryFn: fichasApi.getUsoFichas, refetchInterval: 60_000 });
  const u = query.data;

  return (
    <section className="table-shell">
      <div className="table-toolbar"><h2>Uso de la API del catálogo</h2></div>
      {query.isError && <QueryErrorNotice error={query.error} what="el uso de la API" onRetry={() => query.refetch()} />}
      {query.isLoading && <p className="panel-hint">Cargando…</p>}
      {u && (
        <>
          <div className="metric-grid compact">
            <MetricCard label="Consultas hoy" value={u.consultasHoy} tone="blue" iconName="activity" description={pct(u.consultasHoy, u.topeDiario)} />
            <MetricCard label="Consultas del mes" value={u.consultasMes} tone="violet" iconName="calendar" description={pct(u.consultasMes, u.cuotaMensual)} />
            <MetricCard label="Errores (7 días)" value={u.erroresSemana} tone={u.erroresSemana > 0 ? 'red' : 'green'} iconName="alert"
              description={u.erroresSemana > 0 ? 'Revisa la llave y el cupo del plan' : 'Sin errores'} />
            <MetricCard label="Fichas guardadas" value={u.fichas} tone="green" iconName="clipboard" description={`${u.verificadas} verificadas · ${u.sinVerificar} sin verificar`} />
          </div>
          <ul className="fc-estado-lista">
            <li><span className={`status-pill ${u.llave ? 'tone-green' : 'tone-red'}`}>{u.llave ? 'Configurada' : 'Sin llave'}</span> Fuente <strong>{u.fuente}</strong></li>
            <li><span className={`status-pill ${u.buscarActivo ? 'tone-green' : 'tone-amber'}`}>{u.buscarActivo ? 'Encendido' : 'Apagado'}</span> Autocompletar por código</li>
            <li><span className={`status-pill ${u.mediosActivos ? 'tone-green' : 'tone-amber'}`}>{u.mediosActivos ? 'Se muestran' : 'Ocultos'}</span> Fotos, planos y diagramas de las marcas</li>
            <li><span className="status-pill">{u.itemsPendientes}</span> códigos de cargas masivas esperando su turno</li>
          </ul>
          <p className="panel-hint">Los topes (diario y mensual) y los interruptores se cambian en el Mantenedor, bajo Flags y Parámetros.</p>
        </>
      )}
    </section>
  );
}
