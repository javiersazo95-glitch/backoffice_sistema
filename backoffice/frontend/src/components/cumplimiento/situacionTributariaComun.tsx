import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import type { EstadoSemestreSii, ResultadoVerificacionSii, ViaVerificacionSii } from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import Modal from '@/components/shared/Modal';
import UiIcon from '@/components/shared/UiIcon';
import { chileDay, formatDate, formatDateTimeLocal } from '@/modules/administration/utils';

/**
 * Piezas de la situacion tributaria de las tiendas que comparten la bandeja semestral
 * (Confianza → Cumplimiento tributario) y el perfil de cada tienda (Confianza → Vendedores).
 * 9-oct: la situacion tributaria paso de Administracion Contable a Confianza, que aprueba las
 * tiendas y las reverifica en enero y julio (Res. SII 168 de 2025).
 */

// Consulta de situacion tributaria de terceros del SII, sin clave (verificada el 2026-10-09).
export const SII_CONSULTA_TERCEROS = 'https://www2.sii.cl/stc/noauthz';

export const RESULTADO_LABEL: Record<ResultadoVerificacionSii, { text: string; tone: string }> = {
  CUMPLE: { text: 'Cumple', tone: 'tone-green' },
  NO_CUMPLE: { text: 'No cumple', tone: 'tone-amber' },
  SIN_INICIO_ACTIVIDADES: { text: 'Sin inicio de actividades', tone: 'tone-red' },
  TERMINO_GIRO: { text: 'Término de giro', tone: 'tone-red' },
  SUBSISTENCIA: { text: 'Registro de Subsistencia', tone: 'tone-gray' },
};

export const VIA_LABEL: Record<ViaVerificacionSii, string> = {
  CONSULTA_WEB: 'Consulta en sii.cl',
  CERTIFICADO: 'Certificado de la tienda',
  API: 'API del SII',
};

export const SEMESTRE_LABEL: Record<EstadoSemestreSii, { text: string; tone: string }> = {
  AL_DIA: { text: 'Al día', tone: 'tone-green' },
  PENDIENTE: { text: 'Por reverificar', tone: 'tone-amber' },
  SIN_VERIFICAR: { text: 'Sin verificar', tone: 'tone-red' },
};

export function todayChile(): string {
  return chileDay(new Date().toISOString());
}

/** Abre en otra pestana un archivo con URL firmada (certificado o evidencia). */
export async function abrirUrlFirmada(getUrl: () => Promise<string>, fallback: string): Promise<void> {
  try {
    window.open(await getUrl(), '_blank', 'noopener');
  } catch (error) {
    window.alert(mensajeDeError(error, fallback));
  }
}

/** Tienda sobre la que se registra una verificacion manual. */
export interface TiendaAVerificar {
  proveedorId: number;
  nombreTienda: string | null;
  rut: string | null;
  inicioActividadesFecha?: string | null;
}

interface Borrador {
  verificadaEn: string;
  via: ViaVerificacionSii;
  resultado: ResultadoVerificacionSii;
  inicioActividadesFecha: string;
  observaciones: string;
  evidencia: File | null;
}

/**
 * Registro de una verificacion manual en el SII (consulta del RUT en sii.cl o certificado de la
 * tienda), con evidencia. Lo usan la bandeja semestral y el perfil de la tienda.
 */
export function RegistrarVerificacionSiiModal({ tienda, onClose }: { tienda: TiendaAVerificar | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setBorrador(tienda ? {
      verificadaEn: todayChile(),
      via: 'CONSULTA_WEB',
      resultado: 'CUMPLE',
      inicioActividadesFecha: tienda.inicioActividadesFecha ?? '',
      observaciones: '',
      evidencia: null,
    } : null);
  }, [tienda]);

  async function guardar(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!tienda || !borrador || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await administrationApi.registerTaxStatus(tienda.proveedorId, {
        verificadaEn: borrador.verificadaEn,
        via: borrador.via,
        resultado: borrador.resultado,
        inicioActividadesFecha: borrador.inicioActividadesFecha || null,
        observaciones: borrador.observaciones.trim() || null,
      }, borrador.evidencia);
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status-history'] });
      await queryClient.invalidateQueries({ queryKey: ['validation-tax-status'] });
      onClose();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo registrar la verificación.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal isOpen={tienda !== null && borrador !== null} onClose={onClose} title="Registrar verificación en el SII">
      {tienda && borrador && (
        <form className="form-grid" onSubmit={guardar}>
          <p className="panel-hint" style={{ gridColumn: '1 / -1' }}>
            <strong>{tienda.nombreTienda}</strong> · RUT {tienda.rut ?? '—'}. Consulta el RUT en{' '}
            <a href={SII_CONSULTA_TERCEROS} target="_blank" rel="noopener noreferrer">sii.cl (situación tributaria de terceros)</a>{' '}
            y registra lo que muestra.
          </p>
          <label className="form-field">
            <span>Fecha de la consulta</span>
            <input className="input" type="date" max={todayChile()} required value={borrador.verificadaEn}
              onChange={(event) => setBorrador({ ...borrador, verificadaEn: event.target.value })} />
          </label>
          <label className="form-field">
            <span>Vía</span>
            <select className="select" value={borrador.via} onChange={(event) => setBorrador({ ...borrador, via: event.target.value as ViaVerificacionSii })}>
              <option value="CONSULTA_WEB">Consulta en sii.cl</option>
              <option value="CERTIFICADO">Certificado de la tienda</option>
              <option value="API" disabled>API del SII (no autorizada)</option>
            </select>
          </label>
          <label className="form-field">
            <span>Resultado</span>
            <select className="select" value={borrador.resultado} onChange={(event) => setBorrador({ ...borrador, resultado: event.target.value as ResultadoVerificacionSii })}>
              <option value="CUMPLE">Cumple sus obligaciones tributarias</option>
              <option value="NO_CUMPLE">No cumple (incumplidor según Res. 168)</option>
              <option value="SIN_INICIO_ACTIVIDADES">Sin inicio de actividades</option>
              <option value="TERMINO_GIRO">Término de giro</option>
              <option value="SUBSISTENCIA">Registro de Subsistencia</option>
            </select>
          </label>
          <label className="form-field">
            <span>Fecha de inicio de actividades (opcional)</span>
            <input className="input" type="date" max={todayChile()} value={borrador.inicioActividadesFecha}
              onChange={(event) => setBorrador({ ...borrador, inicioActividadesFecha: event.target.value })} />
          </label>
          <label className="form-field" style={{ gridColumn: '1 / -1' }}>
            <span>Observaciones (opcional)</span>
            <input className="input" type="text" maxLength={1000} value={borrador.observaciones}
              onChange={(event) => setBorrador({ ...borrador, observaciones: event.target.value })} />
          </label>
          <label className="form-field" style={{ gridColumn: '1 / -1' }}>
            <span>Evidencia: captura o PDF de la consulta (recomendado)</span>
            <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              onChange={(event) => setBorrador({ ...borrador, evidencia: event.target.files?.[0] ?? null })} />
          </label>
          {(borrador.resultado === 'SIN_INICIO_ACTIVIDADES' || borrador.resultado === 'TERMINO_GIRO') && (
            <div className="notice" style={{ gridColumn: '1 / -1' }}>
              <UiIcon name="alert" />
              <span>Sin inicio de actividades vigente la tienda no se puede aprobar (art. 68 del Código Tributario). Si ya vende, evalúa suspenderla.</span>
            </div>
          )}
          {borrador.resultado === 'NO_CUMPLE' && (
            <div className="notice" style={{ gridColumn: '1 / -1' }}>
              <UiIcon name="info" />
              <span>Puede seguir vendiendo. La marca dura hasta el fin del semestre, y RepuesTop deberá anticipar parte del IVA cuando el SII dicte la resolución del resolutivo 7° de la Res. 168.</span>
            </div>
          )}
          {error && <div className="notice notice-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar verificación'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Historial de verificaciones del SII de una tienda, con su evidencia. */
export function HistorialVerificacionesSii({ proveedorId }: { proveedorId: number }) {
  const historyQuery = useQuery({
    queryKey: ['admin-tax-status-history', proveedorId],
    queryFn: () => administrationApi.getTaxStatusHistory(proveedorId),
  });

  if (historyQuery.isLoading) return <p className="panel-hint">Cargando…</p>;
  if (historyQuery.isError) return <p className="panel-hint">No se pudo cargar el historial.</p>;
  const verificaciones = historyQuery.data ?? [];
  if (verificaciones.length === 0) return <p className="panel-hint">Esta tienda todavía no tiene verificaciones registradas.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="wide-table" style={{ minWidth: 0 }}>
        <thead><tr><th>Fecha</th><th>Resultado</th><th>Vía</th><th>Semestre</th><th>Registró</th><th /></tr></thead>
        <tbody>
          {verificaciones.map((v) => (
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
                    onClick={() => void abrirUrlFirmada(() => administrationApi.getTaxStatusEvidenceUrl(v.id), 'No se pudo abrir la evidencia.')}>
                    <UiIcon name="eye" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
