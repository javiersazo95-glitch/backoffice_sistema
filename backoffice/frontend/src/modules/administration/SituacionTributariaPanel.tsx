import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import type {
  EstadoSemestreSii,
  ResultadoVerificacionSii,
  TiendaSituacionSii,
  ViaVerificacionSii,
} from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import MetricCard from '@/components/shared/MetricCard';
import Modal from '@/components/shared/Modal';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import CertificadosPorRevisar from './CertificadosPorRevisar';
import UiIcon from '@/components/shared/UiIcon';
import { chileDay, downloadFile, formatDate, formatDateTimeLocal } from './utils';

/**
 * Pendientes A y B de la revision contable (2026-10-08): situacion tributaria de las tiendas.
 *
 * - Al contratar, la plataforma exige el certificado de cumplimiento tributario y verifica el
 *   inicio de actividades (art. 68 inciso 12° del Codigo Tributario; Res. SII 99 y 168 de 2025).
 * - En enero y julio reverifica a las tiendas vigentes (Res. 168, resolutivo 1°). Sin la API de la
 *   Res. 117 se hace por consulta individual del RUT en sii.cl y se registra aqui.
 * - Cada tienda debe declarar ser contribuyente de IVA: sin esa constancia, el IVA de sus ventas lo
 *   paga RepuesTop (art. 3° bis LIVS, Circular SII 39 de 2025). La declaracion la hace la tienda en
 *   la app o la web; aqui solo se ve.
 */

// Guia oficial del SII para consultar la situacion tributaria de terceros (verificada el 2026-10-09).
const SII_CONSULTA_TERCEROS = 'https://www.sii.cl/como_se_hace_para/situacion_trib_terceros.html';

const RESULTADO_LABEL: Record<ResultadoVerificacionSii, { text: string; tone: string }> = {
  CUMPLE: { text: 'Cumple', tone: 'tone-green' },
  NO_CUMPLE: { text: 'No cumple', tone: 'tone-amber' },
  SIN_INICIO_ACTIVIDADES: { text: 'Sin inicio de actividades', tone: 'tone-red' },
  TERMINO_GIRO: { text: 'Término de giro', tone: 'tone-red' },
  SUBSISTENCIA: { text: 'Registro de Subsistencia', tone: 'tone-gray' },
};

const VIA_LABEL: Record<ViaVerificacionSii, string> = {
  CONSULTA_WEB: 'Consulta en sii.cl',
  CERTIFICADO: 'Certificado de la tienda',
  API: 'API del SII',
};

const SEMESTRE_LABEL: Record<EstadoSemestreSii, { text: string; tone: string }> = {
  AL_DIA: { text: 'Al día', tone: 'tone-green' },
  PENDIENTE: { text: 'Por reverificar', tone: 'tone-amber' },
  SIN_VERIFICAR: { text: 'Sin verificar', tone: 'tone-red' },
};

const ESTADO_TIENDA_LABEL: Record<TiendaSituacionSii['estadoTienda'], string> = {
  APROBADA: 'Aprobada',
  PENDIENTE: 'En revisión',
  SUSPENDIDA: 'Suspendida',
  OTRO: 'Otro',
};

interface VerificationDraft {
  tienda: TiendaSituacionSii;
  verificadaEn: string;
  via: ViaVerificacionSii;
  resultado: ResultadoVerificacionSii;
  inicioActividadesFecha: string;
  observaciones: string;
  evidencia: File | null;
}

function todayChile(): string {
  return chileDay(new Date().toISOString());
}

export default function SituacionTributariaPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<VerificationDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [historyFor, setHistoryFor] = useState<TiendaSituacionSii | null>(null);
  const [query, setQuery] = useState('');

  const panelQuery = useQuery({ queryKey: ['admin-tax-status'], queryFn: administrationApi.getTaxStatus });
  const historyQuery = useQuery({
    queryKey: ['admin-tax-status-history', historyFor?.proveedorId],
    queryFn: () => administrationApi.getTaxStatusHistory(historyFor!.proveedorId),
    enabled: historyFor !== null,
  });

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

  function openDraft(tienda: TiendaSituacionSii): void {
    setDraftError('');
    setDraft({
      tienda,
      verificadaEn: todayChile(),
      via: 'CONSULTA_WEB',
      resultado: 'CUMPLE',
      inicioActividadesFecha: tienda.ultimaVerificacion?.inicioActividadesFecha ?? '',
      observaciones: '',
      evidencia: null,
    });
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setDraftError('');
    try {
      await administrationApi.registerTaxStatus(draft.tienda.proveedorId, {
        verificadaEn: draft.verificadaEn,
        via: draft.via,
        resultado: draft.resultado,
        inicioActividadesFecha: draft.inicioActividadesFecha || null,
        observaciones: draft.observaciones.trim() || null,
      }, draft.evidencia);
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status-history'] });
      setDraft(null);
    } catch (error) {
      setDraftError(mensajeDeError(error, 'No se pudo registrar la verificación.'));
    } finally {
      setSaving(false);
    }
  }

  async function openUrl(getUrl: () => Promise<string>, fallback: string): Promise<void> {
    try {
      window.open(await getUrl(), '_blank', 'noopener');
    } catch (error) {
      window.alert(mensajeDeError(error, fallback));
    }
  }

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
          Cómo verificar: en <a href={SII_CONSULTA_TERCEROS} target="_blank" rel="noopener noreferrer">sii.cl</a>, Servicios
          online → Situación tributaria → <strong>Consultar situación tributaria de terceros</strong>, con el RUT de la tienda.
          Registra el resultado y adjunta una captura o PDF de la consulta. Se exige al aprobar la tienda y luego en
          <strong> enero y julio</strong> (Res. SII 168 de 2025).
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
                            onClick={() => void openUrl(() => administrationApi.getTaxStatusCertificateUrl(t.proveedorId),
                              'No se pudo abrir el certificado.')}>
                            <UiIcon name="eye" />
                          </button>
                        ) : <span className="status-pill tone-amber">Falta</span>}
                      </td>
                      <td>
                        <div className="action-cell">
                          <button className="secondary-button" type="button" onClick={() => openDraft(t)}>
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

      <Modal isOpen={draft !== null} onClose={() => setDraft(null)} title="Registrar verificación en el SII">
        {draft && (
          <form className="form-grid" onSubmit={saveDraft}>
            <p className="panel-hint" style={{ gridColumn: '1 / -1' }}>
              <strong>{draft.tienda.nombreTienda}</strong> · RUT {draft.tienda.rut ?? '—'}. Consulta el RUT en{' '}
              <a href={SII_CONSULTA_TERCEROS} target="_blank" rel="noopener noreferrer">sii.cl (situación tributaria de terceros)</a>{' '}
              y registra lo que muestra.
            </p>
            <label className="form-field">
              <span>Fecha de la consulta</span>
              <input className="input" type="date" max={todayChile()} required value={draft.verificadaEn}
                onChange={(event) => setDraft({ ...draft, verificadaEn: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Vía</span>
              <select className="select" value={draft.via} onChange={(event) => setDraft({ ...draft, via: event.target.value as ViaVerificacionSii })}>
                <option value="CONSULTA_WEB">Consulta en sii.cl</option>
                <option value="CERTIFICADO">Certificado de la tienda</option>
                <option value="API" disabled>API del SII (no autorizada)</option>
              </select>
            </label>
            <label className="form-field">
              <span>Resultado</span>
              <select className="select" value={draft.resultado} onChange={(event) => setDraft({ ...draft, resultado: event.target.value as ResultadoVerificacionSii })}>
                <option value="CUMPLE">Cumple sus obligaciones tributarias</option>
                <option value="NO_CUMPLE">No cumple (incumplidor según Res. 168)</option>
                <option value="SIN_INICIO_ACTIVIDADES">Sin inicio de actividades</option>
                <option value="TERMINO_GIRO">Término de giro</option>
                <option value="SUBSISTENCIA">Registro de Subsistencia</option>
              </select>
            </label>
            <label className="form-field">
              <span>Fecha de inicio de actividades (opcional)</span>
              <input className="input" type="date" max={todayChile()} value={draft.inicioActividadesFecha}
                onChange={(event) => setDraft({ ...draft, inicioActividadesFecha: event.target.value })} />
            </label>
            <label className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span>Observaciones (opcional)</span>
              <input className="input" type="text" maxLength={1000} value={draft.observaciones}
                onChange={(event) => setDraft({ ...draft, observaciones: event.target.value })} />
            </label>
            <label className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span>Evidencia: captura o PDF de la consulta (recomendado)</span>
              <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                onChange={(event) => setDraft({ ...draft, evidencia: event.target.files?.[0] ?? null })} />
            </label>
            {(draft.resultado === 'SIN_INICIO_ACTIVIDADES' || draft.resultado === 'TERMINO_GIRO') && (
              <div className="notice" style={{ gridColumn: '1 / -1' }}>
                <UiIcon name="alert" />
                <span>Sin inicio de actividades vigente la tienda no se puede aprobar (art. 68 del Código Tributario). Si ya vende, revisa su suspensión con Confianza.</span>
              </div>
            )}
            {draft.resultado === 'NO_CUMPLE' && (
              <div className="notice" style={{ gridColumn: '1 / -1' }}>
                <UiIcon name="info" />
                <span>Puede seguir vendiendo. La marca dura hasta el fin del semestre, y RepuesTop deberá anticipar parte del IVA cuando el SII dicte la resolución del resolutivo 7° de la Res. 168.</span>
              </div>
            )}
            {draftError && <div className="notice notice-error" style={{ gridColumn: '1 / -1' }}>{draftError}</div>}
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setDraft(null)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar verificación'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={historyFor !== null} onClose={() => setHistoryFor(null)} title={`Historial · ${historyFor?.nombreTienda ?? ''}`}>
        {historyFor && (
          <>
            {historyFor.faltantesParaAprobar.length > 0 && (
              <div className="notice" style={{ marginBottom: 12 }}>
                <UiIcon name="alert" />
                <span>Para aprobarla falta: {historyFor.faltantesParaAprobar.join('; ')}.</span>
              </div>
            )}
            {historyQuery.isLoading ? <p className="panel-hint">Cargando…</p> : (historyQuery.data ?? []).length === 0 ? (
              <p className="panel-hint">Esta tienda todavía no tiene verificaciones registradas.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="wide-table">
                  <thead><tr><th>Fecha</th><th>Resultado</th><th>Vía</th><th>Semestre</th><th>Registró</th><th /></tr></thead>
                  <tbody>
                    {(historyQuery.data ?? []).map((v) => (
                      <tr key={v.id}>
                        <td>{formatDate(v.verificadaEn)}</td>
                        <td>
                          <span className={`status-pill ${RESULTADO_LABEL[v.resultado].tone}`}>{RESULTADO_LABEL[v.resultado].text}</span>
                          {v.observaciones && <div className="panel-hint">{v.observaciones}</div>}
                        </td>
                        <td>{VIA_LABEL[v.via]}</td>
                        <td>{v.semestre}</td>
                        <td>{v.registradaPor ?? '—'}<div className="panel-hint">{formatDateTimeLocal(v.registradaAt)}</div></td>
                        <td>
                          {v.tieneEvidencia && (
                            <button className="action-button neutral" type="button" title="Ver evidencia"
                              onClick={() => void openUrl(() => administrationApi.getTaxStatusEvidenceUrl(v.id), 'No se pudo abrir la evidencia.')}>
                              <UiIcon name="eye" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
