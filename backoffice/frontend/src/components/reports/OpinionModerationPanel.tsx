import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as reportsApi from '@/api/reports';
import Badge from '@/components/shared/Badge';
import DetailRow from '@/components/shared/DetailRow';
import AuthedImage from '@/components/shared/AuthedImage';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import UiIcon from '@/components/shared/UiIcon';
import { formatDateTime } from '@/utils/formatters';
import type { OpinionModerationDetail, OpinionReportType } from '@/types/report';

/** Mismo tope que OpinionModeracionService.MAX_MOTIVO en el backend: el motivo le llega al comprador. */
export const MAX_HIDE_REASON = 300;

const OPINION_TYPE_LABEL: Record<OpinionReportType, string> = {
  OPINION_PRODUCTO: 'Opinión de producto',
  OPINION_TIENDA: 'Opinión de tienda',
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: 6,
};

export const opinionModerationQueryKey = (tipo: OpinionReportType, id: number) =>
  ['opinion-moderation', tipo, id] as const;

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
}

function Stars({ rating }: { rating?: number | null }) {
  if (rating == null) return <span>Sin nota</span>;
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-label={`${rating} de 5 estrellas`} title={`${rating} de 5`}>
      <span style={{ color: '#f59e0b', letterSpacing: 2 }}>{'★'.repeat(value)}</span>
      <span style={{ color: 'rgba(148,163,184,0.5)', letterSpacing: 2 }}>{'★'.repeat(5 - value)}</span>
      <span style={{ marginLeft: 8 }}>{rating}/5</span>
    </span>
  );
}

interface OpinionModerationPanelProps {
  tipo: OpinionReportType;
  opinionId: number;
}

/**
 * Moderación de una opinión reportada desde la bandeja de reportes. Muestra la opinión completa
 * (aunque ya esté oculta) y permite ocultar comentario y fotos con un motivo, o restaurarlos.
 * La nota nunca se oculta: sigue contando en el promedio.
 */
export default function OpinionModerationPanel({ tipo, opinionId }: OpinionModerationPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = opinionModerationQueryKey(tipo, opinionId);
  const [isHideFormOpen, setIsHideFormOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Al cambiar de reporte se descarta lo que se estaba escribiendo para el anterior.
  useEffect(() => {
    setIsHideFormOpen(false);
    setReason('');
    setActionError(null);
    setPreviewImage(null);
  }, [tipo, opinionId]);

  const { data: opinion, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => reportsApi.getOpinionModeration(tipo, opinionId),
  });

  const onModerated = (updated: OpinionModerationDetail) => {
    // El POST ya devuelve la opinión actualizada; se pinta de inmediato y se revalida igual.
    queryClient.setQueryData(queryKey, updated);
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
    void queryClient.invalidateQueries({ queryKey: ['all-reports-names'] });
    void queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
  };

  const hideMutation = useMutation({
    mutationFn: (motivo: string) => reportsApi.hideOpinion(tipo, opinionId, motivo),
    onSuccess: (updated) => {
      setIsHideFormOpen(false);
      setReason('');
      setActionError(null);
      onModerated(updated);
    },
    onError: (err) => setActionError(errorMessage(err, 'No se pudo ocultar la opinión.')),
  });

  const restoreMutation = useMutation({
    mutationFn: () => reportsApi.restoreOpinion(tipo, opinionId),
    onSuccess: (updated) => {
      setActionError(null);
      onModerated(updated);
    },
    onError: (err) => setActionError(errorMessage(err, 'No se pudo restaurar la opinión.')),
  });

  const isBusy = hideMutation.isPending || restoreMutation.isPending;
  const trimmedReason = reason.trim();
  const reasonTooLong = trimmedReason.length > MAX_HIDE_REASON;

  const handleConfirmHide = () => {
    if (!trimmedReason) {
      setActionError('Indica el motivo: se le informa al comprador.');
      return;
    }
    if (reasonTooLong) {
      setActionError(`El motivo no puede superar los ${MAX_HIDE_REASON} caracteres.`);
      return;
    }
    if (!window.confirm('¿Ocultar el comentario y las fotos de esta opinión? Dejarán de verse en la app (la nota sigue contando) y se avisará al comprador con este motivo.')) return;
    setActionError(null);
    hideMutation.mutate(trimmedReason);
  };

  const handleRestore = () => {
    if (!window.confirm('¿Restaurar esta opinión? El comentario y las fotos vuelven a verse en la app.')) return;
    setActionError(null);
    restoreMutation.mutate();
  };

  if (isLoading) {
    return <div className="panel" style={{ padding: 16 }}>Cargando opinión...</div>;
  }

  if (isError || !opinion) {
    return <QueryErrorNotice error={error} what="la opinión reportada" onRetry={refetch} />;
  }

  const images = (opinion.imageUrls ?? []).filter((url) => typeof url === 'string' && url.trim().length > 0);

  return (
    <div className="panel" style={{ padding: 16 }} data-testid="opinion-moderation-panel">
      <h3 style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>Moderar opinión</span>
        <Badge text={opinion.hidden ? 'Oculta' : 'Visible'} variant={opinion.hidden ? 'red' : 'green'} />
      </h3>

      <DetailRow label="Tipo" value={OPINION_TYPE_LABEL[opinion.tipo] ?? OPINION_TYPE_LABEL[tipo]} />
      <DetailRow label="Tienda" value={opinion.storeName || '—'} />
      {(opinion.productName || opinion.tipo === 'OPINION_PRODUCTO') && (
        <DetailRow label="Producto" value={opinion.productName || '—'} />
      )}
      <DetailRow
        label="Comprador"
        value={(
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <strong>{opinion.buyerName || '—'}</strong>
            {opinion.buyerEmail && <span>{opinion.buyerEmail}</span>}
          </span>
        )}
      />
      {opinion.pedidoId != null && <DetailRow label="Pedido" value={`#${opinion.pedidoId}`} />}
      {opinion.ratedAt && <DetailRow label="Fecha de la opinión" value={formatDateTime(opinion.ratedAt)} />}
      <DetailRow label="Nota" value={<Stars rating={opinion.rating} />} />
      <DetailRow label="Reportes recibidos" value={String(opinion.reports ?? 0)} />

      <div style={{ marginTop: 12 }}>
        <strong>Comentario:</strong>
        <p
          style={{
            background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
            padding: 12,
            borderRadius: 4,
            marginTop: 6,
            whiteSpace: 'pre-wrap',
            color: '#0f172a',
          }}
        >
          {opinion.comment?.trim() ? opinion.comment : <em>Sin comentario.</em>}
        </p>
      </div>

      {images.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Fotos ({images.length}):</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
            {images.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => setPreviewImage(url)}
                aria-label={`Ver foto ${index + 1} en grande`}
                style={{
                  width: 88,
                  height: 88,
                  padding: 0,
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.25)',
                  cursor: 'zoom-in',
                }}
              >
                <AuthedImage
                  src={url}
                  alt={`Foto ${index + 1} de la opinión`}
                  fallbackSrc="/assets/repuestop-logo-cropped.jpg"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {opinion.hidden && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 6,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.08)',
          }}
        >
          <strong>Oculta al público</strong>
          {opinion.hiddenReason && <DetailRow label="Motivo" value={opinion.hiddenReason} />}
          {opinion.hiddenBy && <DetailRow label="Ocultada por" value={opinion.hiddenBy} />}
          {opinion.hiddenAt && <DetailRow label="Fecha" value={formatDateTime(opinion.hiddenAt)} />}
        </div>
      )}

      {actionError && (
        <div className="notice notice-error" role="alert" style={{ marginTop: 14 }}>
          <p><UiIcon name="alert" /> {actionError}</p>
        </div>
      )}

      {isHideFormOpen && !opinion.hidden && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="opinion-hide-reason" style={{ fontWeight: 700 }}>
            Motivo (se le informa al comprador):
          </label>
          <textarea
            id="opinion-hide-reason"
            className="input"
            rows={3}
            maxLength={MAX_HIDE_REASON}
            style={{ width: '100%', resize: 'vertical' }}
            placeholder="Ej.: El comentario incluye datos de contacto, lo que no está permitido."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isBusy}
          />
          <small style={{ alignSelf: 'flex-end', color: reasonTooLong ? 'var(--red)' : undefined }}>
            {reason.length}/{MAX_HIDE_REASON}
          </small>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        {opinion.hidden ? (
          <button type="button" className="primary-button" onClick={handleRestore} disabled={isBusy}>
            <UiIcon name="eye" />
            <span>{restoreMutation.isPending ? 'Restaurando...' : 'Restaurar'}</span>
          </button>
        ) : isHideFormOpen ? (
          <>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setIsHideFormOpen(false);
                setReason('');
                setActionError(null);
              }}
              disabled={isBusy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={handleConfirmHide}
              disabled={isBusy || !trimmedReason || reasonTooLong}
            >
              <UiIcon name="shieldX" />
              <span>{hideMutation.isPending ? 'Ocultando...' : 'Confirmar ocultamiento'}</span>
            </button>
          </>
        ) : (
          <button type="button" className="danger-button" onClick={() => setIsHideFormOpen(true)} disabled={isBusy}>
            <UiIcon name="shieldX" />
            <span>Ocultar comentario y fotos</span>
          </button>
        )}
      </div>

      {previewImage && (
        <div className="modal-backdrop" onClick={() => setPreviewImage(null)} style={{ zIndex: 70 }}>
          <div
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#000',
              borderRadius: '10px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                color: '#fff',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
              type="button"
              onClick={() => setPreviewImage(null)}
              aria-label="Cerrar vista previa"
            >
              ×
            </button>
            <AuthedImage
              src={previewImage}
              alt="Foto de la opinión ampliada"
              fallbackSrc="/assets/repuestop-logo-cropped.jpg"
              style={{ width: '100%', height: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
