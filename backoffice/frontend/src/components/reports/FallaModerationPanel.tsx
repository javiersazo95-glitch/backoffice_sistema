import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as reportsApi from '@/api/reports';
import Badge from '@/components/shared/Badge';
import DetailRow from '@/components/shared/DetailRow';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import UiIcon from '@/components/shared/UiIcon';
import { formatDateTime } from '@/utils/formatters';
import type { FallaModeracionDetail, FallaReportType } from '@/types/report';

/** Mismo tope que FallaModeracionService.MOTIVO_MAX en el backend: el motivo le llega a la persona afectada. */
export const MAX_FALLA_REASON = 300;

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: 6,
};

const quoteStyle = {
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  padding: 12,
  borderRadius: 4,
  marginTop: 6,
  whiteSpace: 'pre-wrap' as const,
  color: '#0f172a',
};

export const fallaModerationQueryKey = (tipo: FallaReportType, id: number) => ['falla-moderation', tipo, id] as const;

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
}

type PendingAction = { kind: 'close' } | { kind: 'comment'; commentId: number };

interface FallaModerationPanelProps {
  tipo: FallaReportType;
  /** Id de la falla (FALLA) o del comentario (FALLA_COMENTARIO), tal como viene en el reporte. */
  objetoId: number;
}

/**
 * Moderación de una falla automotriz reportada. Para FALLA permite cerrarla; para ambos tipos permite
 * quitar un comentario. Siempre con motivo: queda en la bitácora y se le explica a la persona afectada.
 */
export default function FallaModerationPanel({ tipo, objetoId }: FallaModerationPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = fallaModerationQueryKey(tipo, objetoId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPending(null);
    setReason('');
    setActionError(null);
  }, [tipo, objetoId]);

  const { data: falla, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    // Un comentario reportado no trae su falla: se resuelve buscándolo (ver findFallaByComment).
    queryFn: () => (tipo === 'FALLA' ? reportsApi.getFallaModeration(objetoId) : reportsApi.findFallaByComment(objetoId)),
  });

  const onModerated = (updated: FallaModeracionDetail) => {
    queryClient.setQueryData(queryKey, updated);
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
    void queryClient.invalidateQueries({ queryKey: ['all-reports-names'] });
    void queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
  };

  const startAction = (action: PendingAction) => {
    setPending(action);
    setReason('');
    setActionError(null);
  };

  const cancel = () => {
    setPending(null);
    setReason('');
    setActionError(null);
  };

  const mutation = useMutation({
    mutationFn: ({ action, motivo }: { action: PendingAction; motivo: string }) =>
      action.kind === 'close'
        ? reportsApi.closeFalla(falla!.id, motivo)
        : reportsApi.removeFallaComment(action.commentId, motivo),
    onSuccess: (updated) => {
      cancel();
      onModerated(updated);
    },
    onError: (err) => setActionError(errorMessage(err, 'No se pudo completar la acción.')),
  });

  const trimmedReason = reason.trim();
  const reasonTooLong = trimmedReason.length > MAX_FALLA_REASON;

  const handleConfirm = () => {
    if (!pending) return;
    if (!trimmedReason) {
      setActionError('Indica el motivo: se le informa a la persona afectada.');
      return;
    }
    if (reasonTooLong) {
      setActionError(`El motivo no puede superar los ${MAX_FALLA_REASON} caracteres.`);
      return;
    }
    const message = pending.kind === 'close'
      ? '¿Cerrar esta falla? Dejará de recibir diagnósticos y se avisará a quien la publicó con este motivo.'
      : '¿Quitar este comentario? Se eliminan también las respuestas que cuelgan de él y se avisará a su autor con este motivo.';
    if (!window.confirm(message)) return;
    setActionError(null);
    mutation.mutate({ action: pending, motivo: trimmedReason });
  };

  if (isLoading) {
    return <div className="panel" style={{ padding: 16 }}>Cargando falla...</div>;
  }

  if (isError) {
    return <QueryErrorNotice error={error} what="la falla reportada" onRetry={refetch} />;
  }

  if (!falla) {
    return (
      <div className="panel" style={{ padding: 16 }} data-testid="falla-moderation-panel">
        <h3 style={sectionTitleStyle}>Moderar falla</h3>
        <p>
          {tipo === 'FALLA_COMENTARIO'
            ? 'El comentario reportado ya no existe (probablemente ya fue quitado).'
            : 'La falla reportada ya no está disponible.'}
        </p>
      </div>
    );
  }

  const isOpen = falla.estado === 'ABIERTA';
  const isBusy = mutation.isPending;
  const reportedCommentId = tipo === 'FALLA_COMENTARIO' ? objetoId : null;
  const comentarios = falla.comentarios ?? [];
  const sintomas = falla.sintomas ?? [];

  const reasonForm = (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor="falla-moderation-reason" style={{ fontWeight: 700 }}>
        Motivo (se le informa a la persona afectada):
      </label>
      <textarea
        id="falla-moderation-reason"
        className="input"
        rows={3}
        maxLength={MAX_FALLA_REASON}
        style={{ width: '100%', resize: 'vertical' }}
        placeholder="Ej.: El contenido incluye datos de contacto, lo que no está permitido."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={isBusy}
      />
      <small style={{ alignSelf: 'flex-end', color: reasonTooLong ? 'var(--red)' : undefined }}>
        {reason.length}/{MAX_FALLA_REASON}
      </small>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="secondary-button" onClick={cancel} disabled={isBusy}>Cancelar</button>
        <button
          type="button"
          className="danger-button"
          onClick={handleConfirm}
          disabled={isBusy || !trimmedReason || reasonTooLong}
        >
          <UiIcon name="shieldX" />
          <span>
            {isBusy ? 'Aplicando...' : pending?.kind === 'close' ? 'Confirmar cierre' : 'Confirmar eliminación'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="panel" style={{ padding: 16 }} data-testid="falla-moderation-panel">
      <h3 style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>Moderar falla</span>
        <Badge text={isOpen ? 'Abierta' : 'Cerrada'} variant={isOpen ? 'green' : 'red'} />
      </h3>

      <DetailRow label="Título" value={falla.titulo} />
      <DetailRow label="Vehículo" value={[falla.vehiculo, falla.patente].filter(Boolean).join(' · ') || '—'} />
      <DetailRow
        label="Publicada por"
        value={(
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <strong>{falla.autorNombre || '—'}</strong>
            {falla.autorEmail && <span>{falla.autorEmail}</span>}
          </span>
        )}
      />
      <DetailRow label="Ubicación" value={[falla.comuna, falla.region].filter(Boolean).join(', ') || '—'} />
      <DetailRow label="Publicada" value={formatDateTime(falla.createdAt)} />
      {falla.cerradaEn && <DetailRow label="Cerrada" value={formatDateTime(falla.cerradaEn)} />}
      {sintomas.length > 0 && <DetailRow label="Síntomas" value={sintomas.join(', ')} />}
      {(falla.fotos?.length ?? 0) > 0 && <DetailRow label="Fotos" value={String(falla.fotos?.length)} />}

      <div style={{ marginTop: 12 }}>
        <strong>Descripción:</strong>
        <p style={quoteStyle}>{falla.descripcion?.trim() ? falla.descripcion : <em>Sin descripción.</em>}</p>
      </div>
      {falla.antesDelFallo?.trim() && (
        <div style={{ marginTop: 12 }}>
          <strong>Antes del fallo:</strong>
          <p style={quoteStyle}>{falla.antesDelFallo}</p>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <strong>Comentarios ({comentarios.length}):</strong>
        {comentarios.length === 0 && <p><em>Sin comentarios.</em></p>}
        {comentarios.map((c) => {
          const isReported = c.id === reportedCommentId;
          return (
            <div
              key={c.id}
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 6,
                border: isReported ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                background: isReported ? 'rgba(239,68,68,0.08)' : 'transparent',
                marginLeft: c.respondeAId ? 20 : 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span>
                  <strong>{c.autorNombre || '—'}</strong>
                  {c.taller ? ` · ${c.taller}` : ''}
                  {c.autorEmail ? ` · ${c.autorEmail}` : ''}
                  {isReported && <> <Badge text="Reportado" variant="red" /></>}
                </span>
                <small>{formatDateTime(c.createdAt)}</small>
              </div>
              <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{c.texto}</p>
              {(c.precioDesde != null || c.precioHasta != null) && (
                <small>Precio estimado: {c.precioDesde ?? '—'} – {c.precioHasta ?? '—'}</small>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => startAction({ kind: 'comment', commentId: c.id })}
                  disabled={isBusy}
                >
                  <UiIcon name="shieldX" />
                  <span>Quitar comentario</span>
                </button>
              </div>
              {pending?.kind === 'comment' && pending.commentId === c.id && reasonForm}
            </div>
          );
        })}
      </div>

      {actionError && (
        <div className="notice notice-error" role="alert" style={{ marginTop: 14 }}>
          <p><UiIcon name="alert" /> {actionError}</p>
        </div>
      )}

      {pending?.kind === 'close' && reasonForm}

      {isOpen && pending?.kind !== 'close' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" className="danger-button" onClick={() => startAction({ kind: 'close' })} disabled={isBusy}>
            <UiIcon name="shieldX" />
            <span>Cerrar falla</span>
          </button>
        </div>
      )}
    </div>
  );
}
