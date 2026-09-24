import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as validationsApi from '@/api/validations';
import type { AdValidationItem, AdModerationStatus } from '@/types/adValidation';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import AuthedImage from '@/components/shared/AuthedImage';

// El backend ya manda `ownerSellerId` con prefijo (CodigoVendedor.PREFIJO, hoy "RTP-").
// Esto es solo el respaldo para respuestas antiguas que traian el id pelado; antes estaba
// escrito a mano en dos sitios con el prefijo viejo pegado a la cadena.
const SELLER_ID_PREFIX = 'RTP-';
function formatSellerId(ownerSellerId: string) {
  return ownerSellerId.startsWith(SELLER_ID_PREFIX) ? ownerSellerId : `${SELLER_ID_PREFIX}${ownerSellerId}`;
}

const REJECT_REASON_PRESETS = [
  'Imágenes inapropiadas, de baja calidad o no corresponden al servicio ofrecido.',
  'Información de contacto, precios o descripción con datos falsos o engañosos.',
  'Categoría o tipo de servicio no automotriz / fuera del rubro de RepuesTop.',
  'Texto con enlaces externos prohibidos, publicidad no autorizada o spam.',
  'Incumplimiento de las políticas y términos de uso del Mural de Anuncios.',
  'Otro motivo específico...',
];

const TIER_META: Record<string, { label: string; tone: string; pillClass: string }> = {
  basica: { label: 'Básica', tone: 'gray', pillClass: 'tone-gray' },
  destacada: { label: 'Destacada', tone: 'blue', pillClass: 'tone-blue' },
  premium: { label: 'Premium', tone: 'violet', pillClass: 'tone-violet' },
  empresarial: { label: 'Empresarial', tone: 'amber', pillClass: 'tone-amber' },
};

function getAdStatus(ad: AdValidationItem): AdModerationStatus {
  if (ad.moderationStatus) return ad.moderationStatus;
  if (ad.activo) return 'APROBADO';
  return 'PENDIENTE';
}

function formatPrice(ad: AdValidationItem): string {
  if (ad.priceValue && Number(ad.priceValue) > 0) {
    return `$${Number(ad.priceValue).toLocaleString('es-CL')}`;
  }
  return ad.priceText || 'A convenir';
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Sin fecha';
  try {
    // O32 (pruebas de lanzamiento, 2026-09-24): `publicado_en` es DATE ("2026-09-24"). `new Date()`
    // lo lee como medianoche UTC y en Chile se mostraba "23 sept". Una fecha sin hora se arma local.
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    const d = soloFecha
      ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
      : new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function AdValidationTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'>('TODOS');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Modals state
  const [selectedAdForDetail, setSelectedAdForDetail] = useState<AdValidationItem | null>(null);
  const [selectedAdForReject, setSelectedAdForReject] = useState<AdValidationItem | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  // Centered Feedback Dialog state
  const [feedbackDialog, setFeedbackDialog] = useState<{
    isOpen: boolean;
    type: 'success' | 'danger';
    title: string;
    message: string;
  } | null>(null);

  // Reject form state
  const [rejectPreset, setRejectPreset] = useState<string>(REJECT_REASON_PRESETS[0] || '');
  const [rejectCustomNotes, setRejectCustomNotes] = useState<string>('');

  const { data: ads = [], isLoading, isError } = useQuery<AdValidationItem[]>({
    queryKey: ['ad-validations'],
    queryFn: validationsApi.getAdValidations,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string | number) => validationsApi.approveAdValidation(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['ad-validations'] });
      showToast(`✓ Anuncio #${id} aprobado y publicado exitosamente en el Mural.`);
      setSelectedAdForDetail(null);
      setFeedbackDialog({
        isOpen: true,
        type: 'success',
        title: '¡Publicación Aprobada y Publicada!',
        message: `El anuncio #${id} fue aprobado exitosamente por moderación y ya se encuentra publicado de forma visible en el Mural de Anuncios.`,
      });
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || 'Error al aprobar el anuncio.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string | number; reason: string }) => validationsApi.rejectAdValidation(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ad-validations'] });
      showToast(`Anuncio #${id} rechazado. El motivo fue registrado para apelación del usuario.`);
      setSelectedAdForReject(null);
      setSelectedAdForDetail(null);
      setRejectCustomNotes('');
      setFeedbackDialog({
        isOpen: true,
        type: 'danger',
        title: 'Publicación Rechazada',
        message: `El anuncio #${id} fue rechazado. El motivo quedó registrado y se envió la notificación al usuario en la app para su correspondiente apelación y corrección.`,
      });
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || 'Error al rechazar el anuncio.');
    },
  });

  // Dynamic Date Filter Options - Only show months with registered ads
  const monthNames: Record<string, string> = {
    '01': 'Enero',
    '02': 'Febrero',
    '03': 'Marzo',
    '04': 'Abril',
    '05': 'Mayo',
    '06': 'Junio',
    '07': 'Julio',
    '08': 'Agosto',
    '09': 'Septiembre',
    '10': 'Octubre',
    '11': 'Noviembre',
    '12': 'Diciembre',
  };

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    ads.forEach((ad) => {
      if (ad.publishedAt) {
        const adDate = ad.publishedAt;
        if (selectedYear === 'ALL' || adDate.startsWith(selectedYear)) {
          const monthPart = adDate.slice(5, 7);
          if (monthPart && monthNames[monthPart]) {
            months.add(monthPart);
          }
        }
      }
    });

    const sortedMonths = Array.from(months).sort();
    return [
      { value: 'ALL', label: 'Todos los meses' },
      ...sortedMonths.map((m) => ({
        value: m,
        label: monthNames[m] || m,
      })),
    ];
  }, [ads, selectedYear]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const currentYear = String(new Date().getFullYear());
    years.add(currentYear);
    ads.forEach((ad) => {
      if (ad.publishedAt) {
        const y = ad.publishedAt.slice(0, 4);
        if (y && y.length === 4) years.add(y);
      }
    });
    return ['ALL', ...Array.from(years).sort().reverse()];
  }, [ads]);

  // Metrics
  const metrics = useMemo(() => {
    const total = ads.length;
    const pendientes = ads.filter((a) => getAdStatus(a) === 'PENDIENTE').length;
    const aprobados = ads.filter((a) => getAdStatus(a) === 'APROBADO').length;
    const rechazados = ads.filter((a) => getAdStatus(a) === 'RECHAZADO').length;
    return { total, pendientes, aprobados, rechazados };
  }, [ads]);

  // Filtered ads
  const filteredAds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return ads.filter((ad) => {
      const status = getAdStatus(ad);
      if (statusFilter !== 'TODOS' && status !== statusFilter) return false;
      if (tierFilter !== 'ALL' && ad.tier !== tierFilter) return false;

      // Date filtering by publishedAt
      if (ad.publishedAt) {
        const adDate = ad.publishedAt;
        if (selectedYear !== 'ALL' && !adDate.startsWith(selectedYear)) return false;
        if (selectedMonth !== 'ALL') {
          const monthPart = adDate.slice(5, 7);
          if (monthPart !== selectedMonth) return false;
        }
      } else if (selectedYear !== 'ALL' || selectedMonth !== 'ALL') {
        return false;
      }

      if (!term) return true;

      return (
        (ad.title || '').toLowerCase().includes(term) ||
        (ad.company || '').toLowerCase().includes(term) ||
        (ad.category || '').toLowerCase().includes(term) ||
        (ad.categoryLabel || '').toLowerCase().includes(term) ||
        (ad.commune || '').toLowerCase().includes(term) ||
        (ad.region || '').toLowerCase().includes(term) ||
        (ad.ownerEmail || '').toLowerCase().includes(term) ||
        (ad.phone || '').toLowerCase().includes(term) ||
        String(ad.id).includes(term)
      );
    });
  }, [ads, searchTerm, statusFilter, tierFilter, selectedMonth, selectedYear]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAds.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedAds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAds.slice(start, start + pageSize);
  }, [filteredAds, currentPage, pageSize]);

  const handleOpenReject = (ad: AdValidationItem) => {
    setSelectedAdForReject(ad);
    setRejectPreset(REJECT_REASON_PRESETS[0] || '');
    setRejectCustomNotes('');
  };

  const handleConfirmReject = () => {
    if (!selectedAdForReject) return;
    const finalReason = rejectCustomNotes.trim()
      ? `${rejectPreset !== 'Otro motivo específico...' ? rejectPreset + ' - ' : ''}${rejectCustomNotes.trim()}`
      : rejectPreset;

    rejectMutation.mutate({ id: selectedAdForReject.id, reason: finalReason });
  };

  const exportAdsCsv = () => {
    if (!filteredAds.length) {
      showToast('No hay anuncios para exportar con los filtros actuales.');
      return;
    }

    const headers = ['ID', 'Plan/Tier', 'Título', 'Empresa', 'Categoría', 'Comuna', 'Región', 'Teléfono', 'Precio', 'Propietario', 'Estado Moderación', 'Motivo Rechazo', 'Publicado', 'Expira'];
    const rows = filteredAds.map((ad) => [
      `"${ad.id}"`,
      `"${ad.tier}"`,
      `"${(ad.title || '').replace(/"/g, '""')}"`,
      `"${(ad.company || '').replace(/"/g, '""')}"`,
      `"${(ad.categoryLabel || ad.category || '').replace(/"/g, '""')}"`,
      `"${(ad.commune || '').replace(/"/g, '""')}"`,
      `"${(ad.region || '').replace(/"/g, '""')}"`,
      `"${(ad.phone || '').replace(/"/g, '""')}"`,
      `"${formatPrice(ad)}"`,
      `"${(ad.ownerEmail || '').replace(/"/g, '""')}"`,
      `"${getAdStatus(ad)}"`,
      `"${(ad.rejectionReason || '').replace(/"/g, '""')}"`,
      `"${ad.publishedAt || ''}"`,
      `"${ad.expiresAt || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tablero-mural-anuncios-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="ad-validation-workspace">
      {/* 1. Metric Cards Grid (Standard Backoffice Design) */}
      <div className="metric-grid compact publicidad-metric-grid">
        <div className="metric-card">
          <div className="metric-icon blue">
            <UiIcon name="megaphone" />
          </div>
          <div>
            <h3>Total publicaciones</h3>
            <strong>{metrics.total}</strong>
            <p className="metric-description">Anuncios en el Mural</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon amber">
            <UiIcon name="clock" />
          </div>
          <div>
            <h3>Pendientes de revisión</h3>
            <strong>{metrics.pendientes}</strong>
            <p className="metric-description">Por validar publicación</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon green">
            <UiIcon name="check" />
          </div>
          <div>
            <h3>Publicados / Aprobados</h3>
            <strong>{metrics.aprobados}</strong>
            <p className="metric-description">Visibles en mural público</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon red">
            <UiIcon name="shieldX" />
          </div>
          <div>
            <h3>Rechazados / En apelación</h3>
            <strong>{metrics.rechazados}</strong>
            <p className="metric-description">Con motivo informado</p>
          </div>
        </div>
      </div>

      {/* 2. Notice Information Banner */}
      <div className="notice">
        <p>
          <UiIcon name="info" />
          <span>
            Panel de auditoría y moderación del <strong>Mural de Anuncios</strong>. Puedes validar qué publicaciones se exhiben públicamente en el sistema y, en caso de rechazo, registrar el motivo explícito para que el usuario pueda corregir y apelar desde su panel.
          </span>
        </p>
      </div>

      {/* 3. Table Shell & Toolbar */}
      <section className="table-shell">
        <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
          <input
            className="input"
            type="search"
            placeholder="Buscar por título, taller/empresa, categoría, comuna o correo..."
            style={{ flex: 1, minWidth: '220px' }}
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
          />

          <div className="caja-filter-buttons" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              className={statusFilter === 'TODOS' ? 'primary-button' : 'secondary-button'}
              onClick={() => {
                setStatusFilter('TODOS');
                setPage(1);
              }}
            >
              Todos ({metrics.total})
            </button>
            <button
              type="button"
              className={statusFilter === 'PENDIENTE' ? 'primary-button' : 'secondary-button'}
              onClick={() => {
                setStatusFilter('PENDIENTE');
                setPage(1);
              }}
            >
              Pendientes ({metrics.pendientes})
            </button>
            <button
              type="button"
              className={statusFilter === 'APROBADO' ? 'primary-button' : 'secondary-button'}
              onClick={() => {
                setStatusFilter('APROBADO');
                setPage(1);
              }}
            >
              Publicados ({metrics.aprobados})
            </button>
            <button
              type="button"
              className={statusFilter === 'RECHAZADO' ? 'primary-button' : 'secondary-button'}
              onClick={() => {
                setStatusFilter('RECHAZADO');
                setPage(1);
              }}
            >
              Rechazados ({metrics.rechazados})
            </button>
          </div>

          <select
            className="input status-select"
            style={{ width: 'auto', flexShrink: 0 }}
            value={tierFilter}
            onChange={(event) => {
              setTierFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por plan de anuncio"
          >
            <option value="ALL">Todos los planes</option>
            <option value="basica">Plan Básica</option>
            <option value="destacada">Plan Destacada</option>
            <option value="premium">Plan Premium</option>
            <option value="empresarial">Plan Empresarial</option>
          </select>

          <select
            className="input"
            style={{ width: 'auto', flexShrink: 0 }}
            value={selectedMonth}
            onChange={(event) => {
              setSelectedMonth(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar anuncios por mes"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            className="input"
            style={{ width: 'auto', flexShrink: 0 }}
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar anuncios por año"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y === 'ALL' ? 'Todos los años' : y}
              </option>
            ))}
          </select>

          <button
            className="icon-button"
            style={{ flexShrink: 0 }}
            type="button"
            onClick={exportAdsCsv}
            title="Exportar CSV de anuncios del mural"
            aria-label="Exportar CSV de anuncios del mural"
          >
            <UiIcon name="download" />
          </button>
        </div>

        {/* 4. Ads Data Table */}
        <table className="wide-table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>Foto</th>
              <th style={{ width: '110px' }}>Plan</th>
              <th>Título y Taller / Empresa</th>
              <th>Categoría</th>
              <th>Ubicación</th>
              <th>Contacto</th>
              <th>Propietario</th>
              <th style={{ textAlign: 'center' }}>Estado Mural</th>
              <th>Publicado / Expira</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">Cargando publicaciones del mural de anuncios...</div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state error">Error al cargar las publicaciones de anuncios.</div>
                </td>
              </tr>
            ) : pagedAds.length > 0 ? (
              pagedAds.map((ad) => {
                const status = getAdStatus(ad);
                const tierMeta = TIER_META[ad.tier] || { label: ad.tier, pillClass: 'tone-gray' };
                const primaryImage = ad.images && ad.images.length > 0 ? ad.images[0] : null;

                return (
                  <tr key={ad.id}>
                    {/* Thumbnail */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="ad-table-thumb" style={{ margin: '0 auto' }}>
                        {primaryImage ? (
                          <AuthedImage
                            src={primaryImage}
                            alt={ad.title}
                            fallbackSrc="/assets/repuestop-logo-cropped.jpg"
                          />
                        ) : (
                          <UiIcon name="megaphone" />
                        )}
                      </div>
                    </td>

                    {/* Tier badge */}
                    <td>
                      <span className={`status-pill ${tierMeta.pillClass}`}>
                        {tierMeta.label}
                      </span>
                    </td>

                    {/* Title and Company */}
                    <td>
                      <div className="ad-table-title-cell">
                        <div className="ad-table-title-main" title={ad.title}>{ad.title}</div>
                        <div className="ad-table-title-sub" title={ad.company}>{ad.company}</div>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                        {ad.categoryLabel || ad.category}
                      </span>
                    </td>

                    {/* Location */}
                    <td>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>{ad.commune}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{ad.region || 'Chile'}</div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <UiIcon name="phone" style={{ width: '13px', height: '13px', color: '#0ea5e9' }} />
                        <span>{ad.phone || 'Sin fono'}</span>
                      </div>
                      {ad.whatsapp && (
                        <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 600 }}>WA: {ad.whatsapp}</div>
                      )}
                    </td>

                    {/* Owner */}
                    <td>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                        {ad.ownerEmail || `Usuario #${ad.ownerUserId || 'N/A'}`}
                      </div>
                      {ad.ownerSellerId && (
                        <div style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>
                          ID Tienda: {formatSellerId(ad.ownerSellerId)}
                        </div>
                      )}
                    </td>

                    {/* Moderation Status */}
                    <td style={{ textAlign: 'center' }}>
                      {status === 'APROBADO' && (
                        <span className="status-pill tone-green" style={{ gap: '5px' }}>
                          <UiIcon name="check" style={{ width: '13px', height: '13px' }} />
                          Publicado
                        </span>
                      )}
                      {status === 'PENDIENTE' && (
                        <span className="status-pill tone-amber" style={{ gap: '5px' }}>
                          <UiIcon name="clock" style={{ width: '13px', height: '13px' }} />
                          Pendiente
                        </span>
                      )}
                      {status === 'RECHAZADO' && (
                        <span
                          className="status-pill tone-red"
                          style={{ gap: '5px', cursor: 'help' }}
                          title={ad.rejectionReason ? `Motivo: ${ad.rejectionReason}` : 'Rechazado sin motivo'}
                        >
                          <UiIcon name="shieldX" style={{ width: '13px', height: '13px' }} />
                          Rechazado
                        </span>
                      )}
                    </td>

                    {/* Dates */}
                    <td>
                      <div style={{ fontSize: '12px', color: '#334155' }}>Pub: {formatDate(ad.publishedAt)}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Exp: {formatDate(ad.expiresAt)}</div>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="action-cell" style={{ justifyContent: 'center' }}>
                        {/* Detail / Inspection button */}
                        <button
                          className="action-button issue"
                          type="button"
                          onClick={() => setSelectedAdForDetail(ad)}
                          title="Inspeccionar publicación completa"
                        >
                          <UiIcon name="eye" />
                        </button>

                        {/* Approve button */}
                        {status !== 'APROBADO' && (
                          <button
                            className="action-button success"
                            type="button"
                            onClick={() => approveMutation.mutate(ad.id)}
                            disabled={approveMutation.isPending}
                            title="Aprobar y publicar en el mural"
                          >
                            <UiIcon name="check" />
                          </button>
                        )}

                        {/* Reject button */}
                        {status !== 'RECHAZADO' && (
                          <button
                            className="action-button delete"
                            type="button"
                            onClick={() => handleOpenReject(ad)}
                            disabled={rejectMutation.isPending}
                            title="Rechazar publicación y enviar motivo para apelación"
                          >
                            <UiIcon name="shieldX" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">No se encontraron publicaciones de anuncios con los filtros aplicados.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Table Footer with Pager */}
        <div className="table-footer">
          <span>Mostrando <strong>{pagedAds.length}</strong> de <strong>{filteredAds.length}</strong> anuncios</span>
          <div className="table-pager">
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Página {currentPage} de {totalPages}
            </span>
            <div className="pagination subtle">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Página siguiente"
              >
                ›
              </button>
            </div>
            <select
              className="input"
              style={{ padding: '3px 8px', fontSize: '12px', width: 'auto' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Tamaño de página"
            >
              <option value={5}>5 por pág.</option>
              <option value={10}>10 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
            </select>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: INSPECCIÓN COMPLETA DE PUBLICACIÓN DEL MURAL                     */}
      {/* ========================================================================= */}
      {selectedAdForDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedAdForDetail(null)}>
          <div
            className="modal-panel"
            style={{ width: 'min(840px, 96%)', maxHeight: 'min(90vh, 900px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-block">
                <h2>Inspección de Anuncio en el Mural</h2>
                <p>Publicación #{selectedAdForDetail.id} &bull; {selectedAdForDetail.company}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-pill ${TIER_META[selectedAdForDetail.tier]?.pillClass || 'tone-gray'}`}>
                  Plan {TIER_META[selectedAdForDetail.tier]?.label || selectedAdForDetail.tier}
                </span>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setSelectedAdForDetail(null)}
                  aria-label="Cerrar modal"
                >
                  <UiIcon name="close" />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'grid', gap: '18px' }}>
              {/* If Rejected: Show Rejection feedback banner for appeal visibility */}
              {selectedAdForDetail.rejectionReason && (
                <div className="ad-appeal-banner">
                  <UiIcon name="alert" />
                  <div>
                    <strong style={{ display: 'block', fontSize: '13.5px', marginBottom: '2px' }}>
                      Motivo de rechazo registrado (Visible para apelación del usuario):
                    </strong>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45 }}>{selectedAdForDetail.rejectionReason}</p>
                  </div>
                </div>
              )}

              {/* Gallery of Images */}
              <div>
                <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UiIcon name="document" /> Galería de Fotos ({selectedAdForDetail.images?.length || 0} imágenes)
                </h4>
                {selectedAdForDetail.images && selectedAdForDetail.images.length > 0 ? (
                  <div className="ad-gallery-grid">
                    {selectedAdForDetail.images.map((img, idx) => {
                      return (
                        <div
                          key={idx}
                          className="ad-gallery-item"
                          onClick={() => setSelectedImagePreview(img)}
                          title="Clic para ver en tamaño completo"
                        >
                          <AuthedImage
                            src={img}
                            alt={`Imagen ${idx + 1}`}
                            fallbackSrc="/assets/repuestop-logo-cropped.jpg"
                          />
                          <span className="ad-gallery-badge">
                            #{idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                    Este aviso no incluye imágenes cargadas.
                  </div>
                )}
              </div>

              {/* Story Images if present */}
              {selectedAdForDetail.storyImages && selectedAdForDetail.storyImages.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#7e22ce', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UiIcon name="sparkles" /> Historias Destacadas ({selectedAdForDetail.storyImages.length})
                  </h4>
                  <div className="ad-story-grid">
                    {selectedAdForDetail.storyImages.map((img, idx) => {
                      return (
                        <div
                          key={idx}
                          className="ad-story-item"
                          onClick={() => setSelectedImagePreview(img)}
                          title="Clic para ampliar historia"
                        >
                          <AuthedImage
                            src={img}
                            alt={`Historia ${idx + 1}`}
                            fallbackSrc="/assets/repuestop-logo-cropped.jpg"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Specs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* General Info */}
                <div className="ad-modal-detail-card">
                  <h4>
                    <UiIcon name="home" /> Datos de la Publicación
                  </h4>
                  <dl className="ad-modal-detail-list">
                    <div className="ad-modal-detail-row">
                      <dt>Título:</dt>
                      <dd>{selectedAdForDetail.title}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>Taller / Empresa:</dt>
                      <dd>{selectedAdForDetail.company}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>Categoría:</dt>
                      <dd>{selectedAdForDetail.categoryLabel || selectedAdForDetail.category}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>Precio / Tarifa:</dt>
                      <dd>{formatPrice(selectedAdForDetail)} {selectedAdForDetail.priceType ? `(${selectedAdForDetail.priceType})` : ''}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>Horario de atención:</dt>
                      <dd>{selectedAdForDetail.openingHours || (selectedAdForDetail.is24Hours ? 'Atención 24 Horas' : 'No especificado')}</dd>
                    </div>
                  </dl>
                </div>

                {/* Location and Contact */}
                <div className="ad-modal-detail-card">
                  <h4>
                    <UiIcon name="target" /> Ubicación y Contacto
                  </h4>
                  <dl className="ad-modal-detail-list">
                    <div className="ad-modal-detail-row">
                      <dt>Dirección:</dt>
                      <dd>{selectedAdForDetail.address || 'No indicada'}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>Comuna / Región:</dt>
                      <dd>{selectedAdForDetail.commune}, {selectedAdForDetail.region || 'Chile'}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>Teléfono:</dt>
                      <dd>{selectedAdForDetail.phone}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>WhatsApp:</dt>
                      <dd>{selectedAdForDetail.whatsapp || 'No registrado'}</dd>
                    </div>
                    <div className="ad-modal-detail-row">
                      <dt>Email Propietario:</dt>
                      <dd>{selectedAdForDetail.ownerEmail || 'No informado'}</dd>
                    </div>
                    {selectedAdForDetail.ownerSellerId && (
                      <div className="ad-modal-detail-row">
                        <dt>ID Tienda (Externo):</dt>
                        <dd style={{ fontWeight: 700, color: '#0284c7' }}>
                          {formatSellerId(selectedAdForDetail.ownerSellerId)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Description */}
              <div className="ad-modal-detail-card" style={{ background: '#fff' }}>
                <h4>
                  <UiIcon name="document" /> Descripción del Servicio
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {selectedAdForDetail.description}
                </p>
              </div>

              {/* Services and Features tags */}
              {(selectedAdForDetail.servicesOffered?.length || selectedAdForDetail.features?.length) ? (
                <div>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                    Servicios y Características Informadas
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedAdForDetail.servicesOffered?.map((srv, i) => (
                      <span key={`srv-${i}`} className="ad-tag-pill service">
                        ✓ {srv}
                      </span>
                    ))}
                    {selectedAdForDetail.features?.map((ft, i) => (
                      <span key={`ft-${i}`} className="ad-tag-pill feature">
                        • {ft}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Online booking details if applicable */}
              {selectedAdForDetail.hasOnlineBooking && (
                <div className="ad-booking-card">
                  <UiIcon name="calendar" style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                  <div>
                    <strong>Servicio con Reserva Online y Agenda Activada</strong>
                    <div style={{ marginTop: '2px', fontSize: '12.5px', opacity: 0.9 }}>
                      Configuración: {selectedAdForDetail.agendaConfigName || 'Agenda estándar'} &bull; {selectedAdForDetail.agendaHours || 'Horarios según agenda'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div
              style={{
                padding: '14px 20px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Estado actual: <strong>{getAdStatus(selectedAdForDetail)}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="secondary-button"
                  style={{ minHeight: '38px', height: '38px', padding: '0 16px', fontSize: '13.5px', borderRadius: '7px' }}
                  type="button"
                  onClick={() => setSelectedAdForDetail(null)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  style={{
                    minHeight: '38px',
                    height: '38px',
                    padding: '0 16px',
                    fontSize: '13.5px',
                    borderRadius: '7px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.borderColor = '#fca5a5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }}
                  onClick={() => {
                    const ad = selectedAdForDetail;
                    setSelectedAdForDetail(null);
                    handleOpenReject(ad);
                  }}
                >
                  <UiIcon name="shieldX" style={{ width: '16px', height: '16px' }} />
                  <span>Rechazar publicación</span>
                </button>
                <button
                  className="primary-button"
                  style={{
                    minHeight: '38px',
                    height: '38px',
                    padding: '0 18px',
                    fontSize: '13.5px',
                    borderRadius: '7px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                  type="button"
                  onClick={() => {
                    approveMutation.mutate(selectedAdForDetail.id);
                  }}
                  disabled={approveMutation.isPending}
                >
                  <UiIcon name="check" style={{ width: '16px', height: '16px' }} />
                  <span>Aprobar y publicar en Mural</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECHAZAR PUBLICACIÓN CON MOTIVO PARA APELACIÓN                   */}
      {/* ========================================================================= */}
      {selectedAdForReject && (
        <div className="modal-backdrop" onClick={() => setSelectedAdForReject(null)}>
          <div
            className="modal-panel"
            style={{ width: 'min(580px, 95%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-block">
                <h2 style={{ color: '#b91c1c' }}>Rechazar Publicación de Anuncio</h2>
                <p>Anuncio #{selectedAdForReject.id} &bull; {selectedAdForReject.title}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedAdForReject(null)}
                aria-label="Cerrar modal"
              >
                <UiIcon name="close" />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '12.5px',
                  lineHeight: 1.45,
                }}
              >
                <strong>Importante:</strong> Al rechazar este anuncio, el aviso no será visible en el mural público y el usuario recibirá este motivo en su panel para que pueda corregir los puntos observados y apelar.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Selecciona una causal común de rechazo:
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={rejectPreset}
                  onChange={(e) => setRejectPreset(e.target.value)}
                >
                  {REJECT_REASON_PRESETS.map((preset, i) => (
                    <option key={i} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Detalle adicional u observaciones para el usuario:
                </label>
                <textarea
                  className="input"
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Explica qué elementos no cumplen con las políticas y cómo puede el usuario corregir su publicación para apelar..."
                  value={rejectCustomNotes}
                  onChange={(e) => setRejectCustomNotes(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                padding: '14px 20px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <button
                className="secondary-button"
                style={{ minHeight: '38px', height: '38px', padding: '0 16px', fontSize: '13.5px', borderRadius: '7px' }}
                type="button"
                onClick={() => setSelectedAdForReject(null)}
                disabled={rejectMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                style={{
                  minHeight: '38px',
                  height: '38px',
                  padding: '0 18px',
                  fontSize: '13.5px',
                  borderRadius: '7px',
                  background: '#dc2626',
                  borderColor: '#b91c1c',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending || (!rejectCustomNotes.trim() && rejectPreset === 'Otro motivo específico...')}
              >
                <UiIcon name="shieldX" style={{ width: '16px', height: '16px' }} />
                <span>{rejectMutation.isPending ? 'Guardando...' : 'Confirmar Rechazo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VISTA PREVIA DE IMAGEN AMPLIADA (LIGHTBOX)                       */}
      {/* ========================================================================= */}
      {selectedImagePreview && (
        <div className="modal-backdrop" onClick={() => setSelectedImagePreview(null)} style={{ zIndex: 70 }}>
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
              onClick={() => setSelectedImagePreview(null)}
              aria-label="Cerrar vista previa"
            >
              ×
            </button>
            <AuthedImage
              src={selectedImagePreview}
              alt="Vista previa ampliada"
              fallbackSrc="/assets/repuestop-logo-cropped.jpg"
              style={{ width: '100%', height: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: FEEDBACK CENTRALIZADO EN PANTALLA (ÉXITO / RECHAZO)              */}
      {/* ========================================================================= */}
      {feedbackDialog?.isOpen && (
        <div className="modal-backdrop" onClick={() => setFeedbackDialog(null)} style={{ zIndex: 90 }}>
          <div
            className="modal-panel"
            style={{
              width: 'min(440px, 92%)',
              textAlign: 'center',
              padding: '28px 24px 22px',
              borderRadius: '14px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
              background: '#ffffff',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: feedbackDialog.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: feedbackDialog.type === 'success' ? '#16a34a' : '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <UiIcon
                name={feedbackDialog.type === 'success' ? 'check' : 'shieldX'}
                style={{ width: '32px', height: '32px' }}
              />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>
              {feedbackDialog.title}
            </h3>
            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.55, marginBottom: '22px' }}>
              {feedbackDialog.message}
            </p>
            <button
              className="primary-button"
              style={{
                minHeight: '40px',
                padding: '0 28px',
                fontSize: '14px',
                fontWeight: 650,
                borderRadius: '8px',
                width: '100%',
                background: feedbackDialog.type === 'success' ? 'var(--blue)' : '#dc2626',
                borderColor: feedbackDialog.type === 'success' ? 'var(--blue)' : '#b91c1c',
              }}
              type="button"
              onClick={() => setFeedbackDialog(null)}
              autoFocus
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
