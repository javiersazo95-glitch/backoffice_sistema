import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as saleReceiptsApi from '@/api/saleReceipts';
import PageHeader from '@/components/shared/PageHeader';
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
 * Contesta las dos preguntas que hoy no se podían contestar desde ningún lado: qué subórdenes
 * tienen su documento tributario y cuáles no, y dónde está el archivo cuando llega un
 * requerimiento del SII o un reclamo SERNAC.
 *
 * Solo lista subórdenes donde la boleta YA es exigible (confirmadas en adelante). Las que
 * están sin confirmar no incumplen nada — el backend exige la boleta justamente para dejar
 * confirmar — y una cancelada no documenta una venta que no ocurrió.
 */
export default function BoletasVentaPage() {
  const [filtro, setFiltro] = useState<Filtro>('sin');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [descargando, setDescargando] = useState<number | null>(null);
  const [error, setError] = useState('');

  const conBoleta = filtro === 'todas' ? null : filtro === 'con';

  const { data, isLoading } = useQuery({
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
   * El token es de un solo uso, así que se pide uno por descarga. Se abre en una pestaña
   * nueva dentro del gesto del clic para que el bloqueador de popups no la mate: aquí no hace
   * falta el visor con blob que usa el marketplace, porque el administrador quiere el archivo,
   * no previsualizarlo.
   */
  const descargar = async (subordenId: number) => {
    if (descargando) return;
    setDescargando(subordenId);
    setError('');
    try {
      const url = await saleReceiptsApi.getSaleReceiptUrl(subordenId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('No se pudo abrir el documento. Vuelve a intentarlo.');
    } finally {
      setDescargando(null);
    }
  };

  const filas = data?.content ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Boletas de venta"
        description="Documento tributario que cada tienda emite por su venta. Es lo que se exhibe ante un requerimiento del SII o un reclamo SERNAC."
      />

      <div className="metrics-grid">
        <MetricCard
          label="Sin boleta"
          value={totales?.sin ?? '—'}
          tone="red"
          iconName="alert"
          description="Subórdenes confirmadas sin documento tributario"
        />
        <MetricCard
          label="Con boleta"
          value={totales?.con ?? '—'}
          tone="green"
          iconName="fileCheck"
          description="Ventas documentadas por su tienda"
        />
      </div>

      <div className="filters-row">
        {([
          ['sin', 'Sin boleta'],
          ['con', 'Con boleta'],
          ['todas', 'Todas'],
        ] as [Filtro, string][]).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            className={`chip ${filtro === valor ? 'active' : ''}`}
            onClick={() => cambiarFiltro(valor)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {isLoading ? (
        <p className="empty-state">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="empty-state">
          {filtro === 'sin'
            ? 'No hay subórdenes confirmadas sin boleta. Todo el período está documentado.'
            : 'No hay subórdenes que mostrar con este filtro.'}
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Tienda</th>
                <th>Comprador</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Documento</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.subordenId}>
                  <td>{fila.codigoPedido}</td>
                  <td>{fila.tienda || '—'}</td>
                  <td>
                    {fila.comprador || '—'}
                    {fila.compradorEmail && <small> · {fila.compradorEmail}</small>}
                  </td>
                  <td>{formatDateTime(fila.fechaPedido)}</td>
                  <td>{ESTADO_LABEL[fila.estado] || fila.estado}</td>
                  <td>
                    {fila.boletaCargada ? (
                      <span className="badge badge-success">
                        {fila.tipoDocumentoTributario === 'FACTURA' ? 'Factura' : 'Boleta'}
                        {' · '}
                        {formatDateTime(fila.boletaSubidaAt)}
                      </span>
                    ) : (
                      <span className="badge badge-danger">Sin documento</span>
                    )}
                  </td>
                  <td>
                    {fila.boletaCargada && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={descargando === fila.subordenId}
                        onClick={() => descargar(fila.subordenId)}
                      >
                        <UiIcon name="receipt" />
                        {descargando === fila.subordenId ? 'Abriendo…' : 'Ver documento'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
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
