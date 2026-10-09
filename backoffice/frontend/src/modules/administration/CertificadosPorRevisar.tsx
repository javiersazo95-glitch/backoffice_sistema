import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as administrationApi from '@/api/administration';
import type { CertificadoPendiente, ReviewCertificatePayload } from '@/api/administration';
import { mensajeDeError } from '@/api/client';
import Modal from '@/components/shared/Modal';
import UiIcon from '@/components/shared/UiIcon';
import { chileDay, formatDateTimeLocal } from './utils';

/**
 * Paso 2 del plan de situacion tributaria: la cola de certificados que las tiendas suben desde
 * "Mi tienda" para la reverificacion de enero y julio (Res. SII 168 de 2025, resolutivo 1°).
 *
 * Revisar uno es abrir el PDF y marcar lo que dice: Cumple o No cumple crean la verificacion del
 * semestre; Rechazado le pide otro a la tienda con el motivo. Va uno tras otro: al guardar se pasa
 * al siguiente.
 */

function hoyChile(): string {
  return chileDay(new Date().toISOString());
}

export default function CertificadosPorRevisar() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-pending-certificates'], queryFn: administrationApi.getPendingCertificates });
  const pendientes = query.data ?? [];

  const [actual, setActual] = useState<CertificadoPendiente | null>(null);
  const [fecha, setFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function abrir(certificado: CertificadoPendiente): void {
    setActual(certificado);
    setFecha('');
    setMotivo('');
    setRechazando(false);
    setError('');
  }

  async function verPdf(id: number): Promise<void> {
    try {
      window.open(await administrationApi.getPendingCertificateUrl(id), '_blank', 'noopener');
    } catch (err) {
      window.alert(mensajeDeError(err, 'No se pudo abrir el certificado.'));
    }
  }

  async function guardar(estado: ReviewCertificatePayload['estado']): Promise<void> {
    if (!actual || guardando) return;
    if (estado !== 'RECHAZADO' && !fecha) {
      setError('Ingresa la fecha que muestra el certificado.');
      return;
    }
    if (estado === 'RECHAZADO' && !motivo.trim()) {
      setError('Indica el motivo: se le muestra a la tienda.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await administrationApi.reviewCertificate(actual.id, {
        estado,
        certificadoFecha: estado === 'RECHAZADO' ? null : fecha,
        motivo: estado === 'RECHAZADO' ? motivo.trim() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-tax-status'] });
      const restantes = (await query.refetch()).data ?? [];
      const siguiente = restantes.find((c) => c.id !== actual.id);
      if (siguiente) abrir(siguiente);
      else setActual(null);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar la revisión.'));
    } finally {
      setGuardando(false);
    }
  }

  if (query.isLoading || pendientes.length === 0) return null;

  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <h2>Certificados por revisar ({pendientes.length})</h2>
        <button className="primary-button" type="button" onClick={() => abrir(pendientes[0]!)}>
          <UiIcon name="fileCheck" /> Revisar uno tras otro
        </button>
      </div>
      <p className="panel-hint">
        Certificados de cumplimiento que las tiendas subieron desde Mi tienda. Al revisarlo como Cumple o No cumple, la tienda
        queda al día este semestre.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="wide-table">
          <thead><tr><th>Tienda</th><th>Subido</th><th>Semestre</th><th /></tr></thead>
          <tbody>
            {pendientes.map((c) => (
              <tr key={c.id}>
                <td>{c.nombreTienda ?? '—'}<div className="panel-hint">{c.rut ?? 'Sin RUT'}</div></td>
                <td>{formatDateTimeLocal(c.subidoAt)}</td>
                <td>{c.semestre}</td>
                <td><button className="secondary-button" type="button" onClick={() => abrir(c)}>Revisar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={actual !== null} onClose={() => setActual(null)} title="Revisar certificado de cumplimiento">
        {actual && (
          // Enter no registra nada: el resultado se elige siempre con un boton explicito.
          <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
            <p className="panel-hint" style={{ gridColumn: '1 / -1' }}>
              <strong>{actual.nombreTienda}</strong> · RUT {actual.rut ?? '—'} · subido el {formatDateTimeLocal(actual.subidoAt)}.
              Revisa que el RUT y el nombre del certificado coincidan con la tienda y que la fecha sea de este semestre.
            </p>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="secondary-button" type="button" onClick={() => void verPdf(actual.id)}>
                <UiIcon name="eye" /> Abrir el certificado (PDF)
              </button>
            </div>

            {!rechazando ? (
              <>
                <label className="form-field">
                  <span>Fecha que muestra el certificado</span>
                  <input className="input" type="date" max={hoyChile()} value={fecha} onChange={(event) => setFecha(event.target.value)} />
                </label>
                <div className="form-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                  <button className="primary-button" type="button" disabled={guardando} onClick={() => void guardar('CUMPLE')}>
                    Dice Cumple
                  </button>
                  <button className="secondary-button" type="button" disabled={guardando} onClick={() => void guardar('NO_CUMPLE')}>
                    Dice No cumple
                  </button>
                  <button className="ghost-button" type="button" disabled={guardando} onClick={() => { setRechazando(true); setError(''); }}>
                    No sirve: rechazar
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Motivo (se le muestra a la tienda)</span>
                  <input className="input" type="text" maxLength={500} value={motivo}
                    placeholder="Ej: el RUT no coincide, el archivo no se lee, es de otro semestre"
                    onChange={(event) => setMotivo(event.target.value)} />
                </label>
                <div className="form-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-start' }}>
                  <button className="secondary-button" type="button" onClick={() => setRechazando(false)}>Volver</button>
                  <button className="primary-button" type="button" disabled={guardando} onClick={() => void guardar('RECHAZADO')}>
                    Rechazar y pedir otro
                  </button>
                </div>
              </>
            )}
            {error && <div className="notice notice-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
          </form>
        )}
      </Modal>
    </section>
  );
}
