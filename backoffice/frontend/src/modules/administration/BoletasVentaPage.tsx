import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as saleReceiptsApi from '@/api/saleReceipts';
import MetricCard from '@/components/shared/MetricCard';
import Pagination from '@/components/shared/Pagination';
import UiIcon from '@/components/shared/UiIcon';

type Filtro = 'todas' | 'sin' | 'con';

const ESTADO_LABEL: Record<string, string> = {
  EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  FINALIZADO: 'Finalizado',
};

const ESTADO_TONO: Record<string, string> = {
  EN_PREPARACION: 'tone-amber',
  ENVIADO: 'tone-blue',
  ENTREGADO: 'tone-green',
  FINALIZADO: 'tone-gray',
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Panel de cumplimiento de la boleta de venta.
 *
 * Contesta las dos preguntas que antes no se podían contestar desde ningún lado: qué subórdenes
 * tienen su documento tributario y cuáles no, y dónde está el archivo cuando llega un
 * requerimiento del SII o un reclamo SERNAC.
 *
 * Solo lista subórdenes donde la boleta YA es exigible (confirmadas en adelante). Las que están
 * sin confirmar no incumplen nada — el backend exige la boleta justamente para dejar confirmar —
 * y una cancelada no documenta una venta que no ocurrió.
 */
export default function BoletasVentaPage() {
  const [filtro, setFiltro] = useState<Filtro>('sin');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [descargando, setDescargando] = useState<number | null>(null);
  const [errorDescarga, setErrorDescarga] = useState('');

  const conBoleta = filtro === 'todas' ? null : filtro === 'con';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sale-receipts', conBoleta, page, size],
    queryFn: () => saleReceiptsApi.getSaleReceipts({ conBoleta, page, size }),
  });

  // Se piden solo los totales de cada lado, con size 1: interesa `totalElements`, no las filas.
  const { data: totales } = useQuery({
    queryKey: ['sale-receipts-totales'],
    queryFn: async () => {
      const [sin, con] = await Promise.all([
        saleReceiptsApi.getSaleReceipts({ conBoleta: false, size: 1 }),
        saleReceiptsApi.getSaleReceipts({ conBoleta: true, size: 1 }),
      ]);
      return { sin: sin.totalElements, con: con.totalElements };
    },
  });

  const cambiarFiltro = (siguiente: Filtro) => {
    setFiltro(siguiente);
    setPage(0);
  };

  /**
   * El token es de un solo uso, así que se pide uno por descarga. Se abre en pestaña nueva
   * dentro del gesto del clic para que el bloqueador de popups no la mate: aquí no hace falta
   * el visor con blob del marketplace, porque el administrador quiere el archivo, no
   * previsualizarlo.
   */
  const descargar = async (subordenId: number) => {
    if (descargando) return;
    setDescargando(subordenId);
    setErrorDescarga('');
    try {
      const url = await saleReceiptsApi.getSaleReceiptUrl(subordenId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setErrorDescarga('No se pudo abrir el documento. Vuelve a intentarlo.');
    } finally {
      setDescargando(null);
    }
  };

  const filas = data?.content ?? [];

  return (
    <div className="admin-finance-page">
      <header className="page-header">
        <div className="header-title">
          <h1>Boletas de venta</h1>
          <p>
            Documento tributario que cada tienda emite por su venta. Es lo que se exhibe ante un
            requerimiento del SII o un reclamo SERNAC.
          </p>
        </div>
      </header>

      <div className="metric-grid compact" style={{ marginBottom: 20 }}>
        <MetricCard
          label="Sin boleta"
          value={totales?.sin ?? '—'}
          tone="red"
          iconName="alert"
          description="Subórdenes confirmadas sin documento"
        />
        <MetricCard
          label="Con boleta"
          value={totales?.con ?? '—'}
          tone="green"
          iconName="fileCheck"
          description="Ventas ya documentadas"
        />
      </div>

      <div className="module-tabs">
        {([
          ['sin', 'Sin boleta', 'alert'],
          ['con', 'Con boleta', 'fileCheck'],
          ['todas', 'Todas', 'clipboard'],
        ] as [Filtro, string, string][]).map(([valor, label, icono]) => (
          <button
            key={valor}
            type="button"
            className={filtro === valor ? 'active' : ''}
            onClick={() => cambiarFiltro(valor)}
          >
            <UiIcon name={icono} /> {label}
          </button>
        ))}
      </div>

      <section className="table-shell">
        <div className="table-toolbar">
          <div className="panel-title">
            <h2>Subórdenes</h2>
            <span className="summary-panel-note">
              La boleta se exige al confirmar, así que aquí solo aparecen las confirmadas en adelante
            </span>
          </div>
        </div>

        {errorDescarga && (
          <div className="empty-state" style={{ color: '#c53030' }}>{errorDescarga}</div>
        )}

        <div className="table-wrap">
          <table className="wide-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Tienda</th>
                <th>Comprador</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Documento</th>
                <th style={{ width: 80, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="loading-cell">Cargando subórdenes…</td></tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7}>
                    {/* Antes un fallo del backend se veia igual que "no hay datos", y una
                        consulta que reventaba con 503 pasaba por lista vacia. */}
                    <div className="empty-state">
                      <strong style={{ color: '#c53030' }}>No se pudieron cargar las subórdenes.</strong>
                      <p style={{ margin: '6px 0 12px', fontSize: 13 }}>
                        {error instanceof Error ? error.message : 'Error desconocido.'}
                      </p>
                      <button type="button" className="action-button neutral" onClick={() => refetch()}>
                        <UiIcon name="refresh" /> Reintentar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      {filtro === 'sin'
                        ? 'No hay subórdenes confirmadas sin boleta. Todo está documentado.'
                        : 'No hay subórdenes que mostrar con este filtro.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filas.map((fila) => (
                  <tr key={fila.subordenId}>
                    <td><strong>{fila.codigoPedido}</strong></td>
                    <td>{fila.tienda || '—'}</td>
                    <td>
                      {fila.comprador || '—'}
                      {fila.compradorEmail && (
                        <small style={{ display: 'block', color: '#6b7a90', marginTop: 3 }}>
                          {fila.compradorEmail}
                        </small>
                      )}
                    </td>
                    <td>{formatDateTime(fila.fechaPedido)}</td>
                    <td>
                      <span className={`status-pill ${ESTADO_TONO[fila.estado] || 'tone-gray'}`}>
                        {ESTADO_LABEL[fila.estado] || fila.estado}
                      </span>
                    </td>
                    <td>
                      {fila.boletaCargada ? (
                        <>
                          <span className="status-pill tone-green">
                            {fila.tipoDocumentoTributario === 'FACTURA' ? 'Factura' : 'Boleta'}
                          </span>
                          <small style={{ display: 'block', color: '#6b7a90', marginTop: 3 }}>
                            {formatDateTime(fila.boletaSubidaAt)}
                          </small>
                        </>
                      ) : (
                        <span className="status-pill tone-red">Sin documento</span>
                      )}
                    </td>
                    <td>
                      <div className="action-cell">
                        {fila.boletaCargada ? (
                          <button
                            type="button"
                            className="action-button neutral"
                            title={`Ver ${fila.boletaNombre || 'documento'}`}
                            disabled={descargando === fila.subordenId}
                            onClick={() => descargar(fila.subordenId)}
                          >
                            <UiIcon name="eye" />
                          </button>
                        ) : (
                          <span style={{ color: '#a0aec0' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data && !isError && (
        <Pagination
          currentPage={data.currentPage}
          totalPages={data.totalPages}
          totalItems={data.totalElements}
          pageSize={data.pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nuevo) => { setSize(nuevo); setPage(0); }}
        />
      )}
    </div>
  );
}
