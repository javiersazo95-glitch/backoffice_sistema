import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import type { TiendaSituacionSii } from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import MetricCard from '@/components/shared/MetricCard';
import Modal from '@/components/shared/Modal';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import UiIcon from '@/components/shared/UiIcon';
import { downloadFile, formatDate, formatDateTimeLocal } from '@/modules/administration/utils';
import CertificadosPorRevisar from './CertificadosPorRevisar';
import {
  HistorialVerificacionesSii,
  RESULTADO_LABEL,
  RegistrarVerificacionSiiModal,
  SEMESTRE_LABEL,
  SII_CONSULTA_TERCEROS,
  VIA_LABEL,
  abrirUrlFirmada,
  todayChile,
  type TiendaAVerificar,
} from './situacionTributariaComun';

/**
 * Bandeja de la situacion tributaria de las tiendas (Confianza → Cumplimiento tributario).
 *
 * - Al contratar, la plataforma exige el certificado de cumplimiento tributario y verifica el
 *   inicio de actividades (art. 68 inciso 12° del Codigo Tributario; Res. SII 99 y 168 de 2025).
 *   Eso se hace al aprobar, en Validaciones.
 * - En enero y julio reverifica a las tiendas vigentes (Res. 168, resolutivo 1°). Sin la API de la
 *   Res. 117 se hace por consulta individual del RUT en sii.cl o con el certificado que sube la
 *   tienda, y se registra aqui.
 * - Cada tienda debe declarar ser contribuyente de IVA: sin esa constancia, el IVA de sus ventas lo
 *   paga RepuesTop (art. 3° bis LIVS, Circular SII 39 de 2025). Aqui solo se ve.
 */

const ESTADO_TIENDA_LABEL: Record<TiendaSituacionSii['estadoTienda'], string> = {
  APROBADA: 'Aprobada',
  PENDIENTE: 'En revisión',
  SUSPENDIDA: 'Suspendida',
  OTRO: 'Otro',
};

export default function SituacionTributariaPanel() {
  const [aVerificar, setAVerificar] = useState<TiendaAVerificar | null>(null);
  const [historyFor, setHistoryFor] = useState<TiendaSituacionSii | null>(null);
  const [query, setQuery] = useState('');

  const panelQuery = useQuery({ queryKey: ['admin-tax-status'], queryFn: administrationApi.getTaxStatus });

  const tiendas = panelQuery.data?.tiendas ?? [];
  const vigentes = tiendas.filter((t) => t.estadoTienda === 'APROBADA' || t.estadoTienda === 'SUSPENDIDA');
  const porReverificar = vigentes.filter((t) => t.estadoSemestre !== 'AL_DIA').length;
  const sinIva = vigentes.filter((t) => !t.declaracionIvaAt).length;
  const sinCertificado = tiendas.filter((t) => !t.tieneCertificado).length;
  const incumplidoras = vigentes.filter((t) => t.ultimaVerificacion?.resultado === 'NO_CUMPLE'
    && t.estadoSemestre === 'AL_DIA').length;

  const filtradas = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tiendas;
    return tiendas.filter((t) => `${t.nombreTienda ?? ''} ${t.rut ?? ''}`.toLowerCase().includes(term));
  }, [tiendas, query]);

  async function downloadNomina(): Promise<void> {
    try {
      const csv = await administrationApi.getTaxStatusNomina();
      downloadFile(`nomina-sii-rut-dv-${todayChile()}.csv`, csv, 'text/csv;charset=utf-8');
    } catch (error) {
      window.alert(mensajeDeError(error, 'No se pudo generar la nómina.'));
    }
  }

  return (
    <>
      {panelQuery.isError && (
        <QueryErrorNotice error={panelQuery.error} what="la situación tributaria de las tiendas" onRetry={() => panelQuery.refetch()} />
      )}

      <div className="metric-grid compact">
        <MetricCard label="Por reverificar este semestre" value={porReverificar} tone={porReverificar ? 'amber' : 'green'} iconName="calendar"
          description={panelQuery.data ? `Semestre ${panelQuery.data.semestreActual}, hasta el ${formatDate(panelQuery.data.finSemestre)}` : 'Tiendas vigentes'} />
        <MetricCard label="Sin declaración de IVA" value={sinIva} tone={sinIva ? 'red' : 'green'} iconName="alert"
          description="Tiendas vigentes: sin ella, el IVA de sus ventas lo paga RepuesTop" />
        <MetricCard label="Sin certificado" value={sinCertificado} tone={sinCertificado ? 'amber' : 'green'} iconName="document"
          description="Certificado de cumplimiento tributario (Res. SII 168)" />
        <MetricCard label="No cumplen" value={incumplidoras} tone="violet" iconName="scale"
          description="Pueden vender; RepuesTop deberá anticipar IVA cuando el SII lo reglamente" />
      </div>

      {panelQuery.data?.mesDeReverificacion && (
        <div className="notice">
          <UiIcon name="calendar" />
          <span><strong>Mes de reverificación.</strong> La Res. SII 168 exige verificar este mes el cumplimiento tributario de todas las tiendas vigentes.</span>
        </div>
      )}

      <div className="notice">
        <UiIcon name="info" />
        <span>
          Las tiendas nuevas se verifican al aprobarlas, en Validaciones. En <strong>enero y julio</strong> se reverifican
          todas las vigentes (Res. SII 168 de 2025): con el certificado que suben (cola de abajo) o consultando el RUT en{' '}
          <a href={SII_CONSULTA_TERCEROS} target="_blank" rel="noopener noreferrer">sii.cl</a> y registrando el resultado con
          una captura como evidencia.
        </span>
      </div>

      <CertificadosPorRevisar />

      <section className="table-shell">
        <div className="table-toolbar">
          <h2>Situación tributaria de las tiendas</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" type="search" placeholder="Buscar por tienda o RUT…" value={query}
              onChange={(event) => setQuery(event.target.value)} />
            <button className="secondary-button" type="button" onClick={() => void downloadNomina()}
              title="Solo se sube al SII si RepuesTop está autorizada a la API de la Res. 117 (junio y diciembre)">
              <UiIcon name="download" /> Nómina RUT;DV
            </button>
          </div>
        </div>
        {panelQuery.isLoading ? (
          <p className="panel-hint">Cargando…</p>
        ) : filtradas.length === 0 ? (
          <p className="panel-hint">No hay tiendas para mostrar.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="wide-table">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Cuenta</th>
                  <th>Este semestre</th>
                  <th>Última verificación</th>
                  <th>Declaración IVA</th>
                  <th>Certificado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => {
                  const ultima = t.ultimaVerificacion;
                  return (
                    <tr key={t.proveedorId}>
                      <td>
                        {t.nombreTienda ?? '—'}
                        <div className="panel-hint">{t.rut ?? 'Sin RUT'}</div>
                      </td>
                      <td>
                        {ESTADO_TIENDA_LABEL[t.estadoTienda]}
                        {t.estadoTienda === 'PENDIENTE' && t.faltantesParaAprobar.length > 0 && (
                          <div className="panel-hint" title={t.faltantesParaAprobar.join('; ')}>
                            Falta para aprobar: {t.faltantesParaAprobar.length}
                          </div>
                        )}
                      </td>
                      <td><span className={`status-pill ${SEMESTRE_LABEL[t.estadoSemestre].tone}`}>{SEMESTRE_LABEL[t.estadoSemestre].text}</span></td>
                      <td>
                        {ultima ? (
                          <>
                            <span className={`status-pill ${RESULTADO_LABEL[ultima.resultado].tone}`}>{RESULTADO_LABEL[ultima.resultado].text}</span>
                            <div className="panel-hint">{formatDate(ultima.verificadaEn)} · {VIA_LABEL[ultima.via]} · {ultima.semestre}</div>
                          </>
                        ) : '—'}
                      </td>
                      <td>
                        {t.declaracionIvaAt
                          ? <span className="status-pill tone-green" title={formatDateTimeLocal(t.declaracionIvaAt)}>Declarada</span>
                          : <span className="status-pill tone-red">Sin declarar</span>}
                      </td>
                      <td>
                        {t.tieneCertificado ? (
                          <button className="action-button neutral" type="button" title="Ver certificado"
                            onClick={() => void abrirUrlFirmada(() => administrationApi.getTaxStatusCertificateUrl(t.proveedorId),
                              'No se pudo abrir el certificado.')}>
                            <UiIcon name="eye" />
                          </button>
                        ) : <span className="status-pill tone-amber">Falta</span>}
                      </td>
                      <td>
                        <div className="action-cell">
                          <button className="secondary-button" type="button" onClick={() => setAVerificar({
                            proveedorId: t.proveedorId,
                            nombreTienda: t.nombreTienda,
                            rut: t.rut,
                            inicioActividadesFecha: t.ultimaVerificacion?.inicioActividadesFecha ?? null,
                          })}>
                            <UiIcon name="fileCheck" /> Verificar
                          </button>
                          <button className="action-button neutral" type="button" title="Historial" onClick={() => setHistoryFor(t)}>
                            <UiIcon name="clock" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RegistrarVerificacionSiiModal tienda={aVerificar} onClose={() => setAVerificar(null)} />

      <Modal isOpen={historyFor !== null} onClose={() => setHistoryFor(null)} title={`Historial · ${historyFor?.nombreTienda ?? ''}`}>
        {historyFor && (
          <>
            {historyFor.faltantesParaAprobar.length > 0 && (
              <div className="notice" style={{ marginBottom: 12 }}>
                <UiIcon name="alert" />
                <span>Para aprobarla falta: {historyFor.faltantesParaAprobar.join('; ')}.</span>
              </div>
            )}
            <HistorialVerificacionesSii proveedorId={historyFor.proveedorId} />
          </>
        )}
      </Modal>
    </>
  );
}
