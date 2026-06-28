import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as sellersApi from '@/api/sellers';
import * as validationsApi from '@/api/validations';
import UiIcon from '@/components/shared/UiIcon';
import { showToast } from '@/components/layout/Toast';
import { PAGE_SIZES, STATUS_LABELS } from '@/utils/constants';
import { SellerStatus, type SellerResponse } from '@/types/seller';
import { ValidationStatus, type ValidationResponse } from '@/types/validation';
import { buildDocumentDownloadName, downloadDocument, resolveDocumentUrl } from '@/utils/documentUrls';


type RequiredDocumentStatus = ValidationStatus | 'POR_CORREGIR';

type RequiredDocumentDefinition = {
  key: string;
  label: string;
  aliases: string[];
  icon: string;
  tone: 'blue' | 'amber' | 'violet';
};

type RequiredDocumentState = RequiredDocumentDefinition & {
  document?: ValidationResponse;
  status: RequiredDocumentStatus;
};

type ValidationRequestGroup = {
  sellerId: number;
  sellerName: string;
  owner: string;
  documents: ValidationResponse[];
  requiredDocuments: RequiredDocumentState[];
  status: RequiredDocumentStatus;
  uploadedAt: string;
};

const REQUIRED_DOCUMENTS: RequiredDocumentDefinition[] = [
  {
    key: 'certificado-inicio',
    label: 'Certificado de inicio de actividades',
    aliases: ['certificado de inicio de actividades', 'certificado inicio de actividades', 'inicio de actividades', 'Inicio de Actividades (SII)'],
    icon: 'fileCheck',
    tone: 'blue',
  },
  {
    key: 'patente-comercial',
    label: 'Patente comercial actualizada',
    aliases: ['patente comercial', 'patente comercial actualizada', 'patente comercial vigente', 'Patente Municipal', 'patente municipal'],
    icon: 'clipboard',
    tone: 'violet',
  },
  {
    key: 'factura-boleta',
    label: 'Factura de venta o boleta electrónica',
    aliases: ['factura de venta', 'boleta electronica', 'boleta electrónica', 'factura venta', 'boleta de venta', 'Boleta/Factura Ejemplo', 'boleta/factura'],
    icon: 'receipt',
    tone: 'amber',
  },
  {
    key: 'declaracion-representante',
    label: 'Declaración de representante legal',
    aliases: ['declaracion de representante legal', 'declaracion representante legal', 'declaracion representante', 'representative document', 'Cédula Identidad Representante', 'cedula identidad representante', 'cedula representante'],
    icon: 'users',
    tone: 'blue',
  },
];

const STATUS_OPTIONS = [
  { value: 'Todos', label: 'Todos' },
  { value: ValidationStatus.PENDIENTE, label: 'Pendiente' },
  { value: 'POR_CORREGIR', label: 'Por corregir' },
  { value: ValidationStatus.RECHAZADA, label: 'Rechazado' },
] as const;

function getStatusLabel(status: string): string {
  if (status === 'POR_CORREGIR') return 'POR CORREGUIR';
  if (status === ValidationStatus.RECHAZADA) return 'RECHAZADO';
  if (status === ValidationStatus.PENDIENTE) return 'PENDIENTE';
  return STATUS_LABELS[status as ValidationStatus] ?? status;
}

function normalizeDocumentType(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesDocumentType(documentType: string, aliases: string[]): boolean {
  const normalizedDocumentType = normalizeDocumentType(documentType);
  return aliases.some((alias) => {
    const normalizedAlias = normalizeDocumentType(alias);
    return (
      normalizedDocumentType === normalizedAlias
      || normalizedDocumentType.includes(normalizedAlias)
      || normalizedAlias.includes(normalizedDocumentType)
    );
  });
}

function buildRequiredDocumentStates(documents: ValidationResponse[]): RequiredDocumentState[] {
  const usedDocumentIds = new Set<number>();

  return REQUIRED_DOCUMENTS.map((definition) => {
    const document = documents.find((candidate) => {
      if (usedDocumentIds.has(candidate.id)) return false;
      return matchesDocumentType(candidate.documentType, definition.aliases);
    });

    if (document) {
      usedDocumentIds.add(document.id);
      return {
        ...definition,
        document,
        status: getDocumentOperationalStatus(document),
      };
    }

    return {
      ...definition,
      status: ValidationStatus.PENDIENTE,
    };
  });
}

function getRequiredDocumentsStatus(documents: RequiredDocumentState[]): ValidationStatus | 'POR_CORREGIR' {
  if (documents.some((document) => document.status === ValidationStatus.RECHAZADA)) {
    return ValidationStatus.RECHAZADA;
  }

  if (documents.some((document) => document.status === 'POR_CORREGIR')) {
    return 'POR_CORREGIR';
  }

  if (documents.some((document) => document.status === ValidationStatus.PENDIENTE)) {
    return ValidationStatus.PENDIENTE;
  }

  return ValidationStatus.APROBADA;
}

function getDocumentOperationalStatus(doc: ValidationResponse): ValidationStatus | 'POR_CORREGIR' {
  return doc.status;
}

function buildValidationGroups(validations: ValidationResponse[]): ValidationRequestGroup[] {
  const groups = new Map<number, ValidationResponse[]>();

  validations.forEach((validation) => {
    const current = groups.get(validation.sellerId) ?? [];
    current.push(validation);
    groups.set(validation.sellerId, current);
  });

  return Array.from(groups.entries())
    .map(([sellerId, documents]) => {
      const sortedDocuments = [...documents].sort((a, b) => {
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      });
      const firstDocument = sortedDocuments[0];
      const lastDocument = sortedDocuments[sortedDocuments.length - 1];
      const requiredDocuments = buildRequiredDocumentStates(sortedDocuments);

      return {
        sellerId,
        sellerName: firstDocument?.sellerName ?? 'Vendedor sin nombre',
        owner: firstDocument?.owner ?? 'Sin responsable',
        documents: sortedDocuments,
        requiredDocuments,
        status: getRequiredDocumentsStatus(requiredDocuments),
        uploadedAt: lastDocument?.uploadedAt ?? firstDocument?.uploadedAt ?? '',
      };
    })
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

function getCompletedCount(documents: RequiredDocumentState[]): number {
  return documents.filter((document) => Boolean(document.document)).length;
}

function getSellerMeta(seller?: SellerResponse) {
  return {
    rut: seller?.rut ?? 'No informado',
    city: seller?.city ?? 'No informado',
    address: seller?.address ?? 'No informado',
    businessLine: seller?.documentsSummary ?? 'No informado',
    email: seller?.email ?? 'No informado',
    phone: seller?.phone ?? 'No informado',
  };
}

interface ObservationHistoryItem {
  id: string;
  type: 'rechazo' | 'correccion_solicitada' | 'apelacion_vendedor' | 'correccion_vendedor' | 'nota_general';
  tagLabel: string;
  timestamp: string;
  message: string;
  attachments?: string[];
}

function parseObservationHistory(notes: string | undefined): ObservationHistoryItem[] {
  if (!notes || !notes.trim()) return [];

  const lines = notes.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ObservationHistoryItem[] = [];

  const tagRegex = /^\[([^\]-]+)(?:\s*-\s*([^\]]+))?\](?:\s*\((?:Adjuntos|Documentos):\s*(.+?)\))?:\s*(.*)$/;
  const oldTagRegex = /^\[([^\]]+)\]:\s*(.*)$/;

  lines.forEach((line, index) => {
    const match = line.match(tagRegex);
    if (match) {
      const tag = match[1]?.trim() || '';
      const time = match[2]?.trim() || '';
      const adjuntosRaw = match[3]?.trim() || '';
      const msg = match[4]?.trim() || '';

      const attachments = adjuntosRaw
        ? adjuntosRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      let type: ObservationHistoryItem['type'] = 'nota_general';
      let tagLabel = tag;

      const cleanTag = tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cleanTag.includes('rechazo')) {
        type = 'rechazo';
        tagLabel = 'Rechazo';
      } else if (cleanTag.includes('solicitada') || cleanTag.includes('solicitar')) {
        type = 'correccion_solicitada';
        tagLabel = 'Corrección Solicitada';
      } else if (cleanTag.includes('apelacion')) {
        type = 'apelacion_vendedor';
        tagLabel = 'Apelación de Vendedor';
      } else if (cleanTag.includes('correccion') || cleanTag.includes('vendedor')) {
        type = 'correccion_vendedor';
        tagLabel = 'Corrección de Vendedor';
      }

      items.push({
        id: `obs-${index}-${tag}-${time}`,
        type,
        tagLabel,
        timestamp: time || 'Histórico',
        message: msg,
        attachments,
      });
    } else {
      const oldMatch = line.match(oldTagRegex);
      if (oldMatch) {
        const tag = oldMatch[1]?.trim() || '';
        const msg = oldMatch[2]?.trim() || '';
        let type: ObservationHistoryItem['type'] = 'nota_general';
        let tagLabel = tag;
        const cleanTag = tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanTag.includes('apelacion')) {
          type = 'apelacion_vendedor';
          tagLabel = 'Apelación de Vendedor';
        } else if (cleanTag.includes('correccion')) {
          type = 'correccion_vendedor';
          tagLabel = 'Corrección de Vendedor';
        }

        items.push({
          id: `obs-${index}-old`,
          type,
          tagLabel,
          timestamp: 'Histórico',
          message: msg,
        });
      } else {
        items.push({
          id: `obs-${index}-raw`,
          type: 'nota_general',
          tagLabel: 'Nota',
          timestamp: 'Histórico',
          message: line,
        });
      }
    }
  });

  return items;
}

export default function ValidationsPage() {
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [dateFilter, setDateFilter] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: validationsData, isLoading: isLoadingValidations } = useQuery({
    queryKey: ['validations-workspace'],
    queryFn: () => validationsApi.getValidations(0, PAGE_SIZES.MAX),
  });

  const { data: sellersData } = useQuery({
    queryKey: ['validation-sellers-lookup'],
    queryFn: () => sellersApi.getSellers({ page: 0, size: PAGE_SIZES.MAX }),
  });

  const validations = validationsData?.content ?? [];
  const sellers = sellersData?.content ?? [];

  const sellerById = useMemo(() => {
    return new Map(sellers.map((seller) => [seller.id, seller]));
  }, [sellers]);

  const groups = useMemo(() => buildValidationGroups(validations), [validations]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return groups.filter((group) => {
      const seller = sellerById.get(group.sellerId);
      if (seller?.status === SellerStatus.APROBADO) {
        return false;
      }

      const matchesSearch = !normalizedSearch
        || group.sellerName.toLowerCase().includes(normalizedSearch)
        || group.owner.toLowerCase().includes(normalizedSearch)
        || (seller?.rut?.toLowerCase() ?? '').includes(normalizedSearch)
        || (seller?.city?.toLowerCase() ?? '').includes(normalizedSearch);

      let matchesStatus = false;
      if (statusFilter === 'Todos') {
        matchesStatus = true;
      } else if (statusFilter === 'POR_CORREGIR') {
        matchesStatus = group.status === 'POR_CORREGIR';
      } else {
        matchesStatus = group.status === statusFilter;
      }
      const matchesDate = !dateFilter || group.documents.some((document) => document.uploadedAt?.startsWith(dateFilter));

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [dateFilter, groups, searchTerm, sellerById, statusFilter]);

  const selectedGroup = useMemo(() => {
    if (filteredGroups.length === 0) return undefined;
    return filteredGroups.find((group) => group.sellerId === selectedSellerId) ?? filteredGroups[0];
  }, [filteredGroups, selectedSellerId]);

  const selectedSeller = selectedGroup ? sellerById.get(selectedGroup.sellerId) : undefined;
  const sellerMeta = getSellerMeta(selectedSeller);
  const requiredDocuments = selectedGroup?.requiredDocuments ?? [];
  const uploadedRequiredDocuments = requiredDocuments.filter((document) => Boolean(document.document));
  const pendingDocuments = requiredDocuments
    .filter((document) => document.document?.status === ValidationStatus.PENDIENTE)
    .map((document) => document.document as ValidationResponse);
  const hasMissingRequiredDocuments = requiredDocuments.some((document) => !document.document);
  const canResolveRequest = !hasMissingRequiredDocuments && pendingDocuments.length > 0;
  const canApproveRequest = canResolveRequest && !requiredDocuments.some((document) => document.document?.status === ValidationStatus.RECHAZADA);

  const approveMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => validationsApi.approveValidation(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validations-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['validations'] });
      queryClient.invalidateQueries({ queryKey: ['validation-sellers-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-validations-preview'] });
      showToast('Solicitud aprobada');
    },
  });

  const correctMutation = useMutation({
    mutationFn: ({ ids, notes }: { ids: number[]; notes: string }) =>
      Promise.all(ids.map((id) => validationsApi.requestCorrection(id, notes))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validations-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['validations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-validations-preview'] });
      setDecisionNotes('');
      showToast('Corrección solicitada');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ ids, notes }: { ids: number[]; notes: string }) =>
      Promise.all(ids.map((id) => validationsApi.rejectValidation(id, notes))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validations-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['validations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-validations-preview'] });
      setDecisionNotes('');
      showToast('Solicitud rechazada');
    },
  });

  const mutationInProgress = approveMutation.isPending || correctMutation.isPending || rejectMutation.isPending;

  function clearFilters() {
    setSearchTerm('');
    setStatusFilter('Todos');
    setDateFilter('');
    setSelectedSellerId(null);
  }

  function selectGroup(sellerId: number) {
    setSelectedSellerId(sellerId);
    setDecisionNotes('');
  }

  function openDocument(document: ValidationResponse) {
    if (document.documentUrl) {
      window.open(document.documentUrl, '_blank');
    } else {
      showToast(`Documento "${document.documentType}" registrado en backend. No hay URL de archivo expuesta en esta API.`);
    }
  }

  function approveSelectedRequest() {
    if (pendingDocuments.length === 0) return;
    approveMutation.mutate(pendingDocuments.map((document) => document.id));
  }

  function requestSelectedCorrection() {
    if (pendingDocuments.length === 0 || !decisionNotes.trim()) return;
    correctMutation.mutate({
      ids: pendingDocuments.map((document) => document.id),
      notes: decisionNotes.trim(),
    });
  }

  function rejectSelectedRequest() {
    if (pendingDocuments.length === 0) return;
    rejectMutation.mutate({
      ids: pendingDocuments.map((document) => document.id),
      notes: decisionNotes.trim(),
    });
  }

  return (
    <section className="validation-workspace">
      <div className="validation-page-head">
        <div>
          <h1>Solicitudes de validación</h1>
          <p>Revisa y valida solicitudes de registro de vendedores.</p>
        </div>
        <button className="validation-help-button" type="button" aria-label="Ayuda">
          ?
        </button>
      </div>

      <div className="validation-filters">
        <label className="validation-search-field">
          <UiIcon name="search" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por tienda o responsable..."
          />
        </label>

        <label className="validation-filter-field">
          <span>Estado</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="validation-filter-field">
          <span>Fecha</span>
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </label>

        <button className="validation-clear-button" type="button" onClick={clearFilters}>
          <UiIcon name="filter" />
          Limpiar filtros
        </button>
      </div>

      <div className="validation-content-grid">
        <aside className="validation-request-list" aria-label="Solicitudes de validación">
          {isLoadingValidations && <div className="validation-empty-state">Cargando validaciones...</div>}

          {!isLoadingValidations && filteredGroups.length === 0 && (
            <div className="validation-empty-state">No hay solicitudes para los filtros seleccionados.</div>
          )}

          {filteredGroups.map((group) => {
            const seller = sellerById.get(group.sellerId);
            const completed = getCompletedCount(group.requiredDocuments);
            const isSelected = selectedGroup?.sellerId === group.sellerId;

            return (
              <button
                key={group.sellerId}
                className={`validation-request-card ${isSelected ? 'active' : ''}`}
                type="button"
                onClick={() => selectGroup(group.sellerId)}
              >
                <span className="validation-request-title-row">
                  <strong>{group.sellerName}</strong>
                  <StatusPill status={group.status} />
                </span>
                <span className="validation-request-meta">
                  <UiIcon name="target" />
                  {seller?.city ?? 'Ciudad no informada'}
                </span>
                <span className="validation-request-footer">
                  <span>
                    <UiIcon name="users" />
                    {group.owner}
                  </span>
                  <strong>{completed} / {REQUIRED_DOCUMENTS.length}</strong>
                </span>
              </button>
            );
          })}
        </aside>

        <main className="validation-detail-stack">
          {!selectedGroup && !isLoadingValidations && (
            <div className="validation-empty-state large">Selecciona una solicitud para revisar sus documentos.</div>
          )}

          {selectedGroup && (
            <>
              <section className="validation-panel">
                <PanelTitle icon="home" title="Datos de la tienda" />

                <div className="validation-info-grid">
                  <div className="validation-info-box">
                    <InfoRow label="Nombre de la tienda" value={selectedGroup.sellerName} />
                    <InfoRow label="Rut de la empresa" value={sellerMeta.rut} />
                    <InfoRow label="Ciudad" value={sellerMeta.city} />
                    <InfoRow label="Dirección" value={sellerMeta.address} />
                    <InfoRow label="Giro comercial" value={sellerMeta.businessLine} />
                  </div>

                  <div className="validation-info-box">
                    <PanelTitle icon="users" title="Responsable de la solicitud" compact />
                    <InfoRow label="Nombre" value={selectedSeller?.owner ?? selectedGroup.owner} />
                    <InfoRow label="Cargo" value={selectedSeller?.cargo ?? 'No informado'} />
                    <InfoRow label="Correo electrónico" value={sellerMeta.email} />
                    <InfoRow label="Teléfono" value={sellerMeta.phone} />
                  </div>
                </div>
              </section>

              <section className="validation-panel">
                <PanelTitle icon="document" title="Documentos requeridos" />

                <div className="validation-documents-summary">
                  <strong>{uploadedRequiredDocuments.length} de {REQUIRED_DOCUMENTS.length} documentos cargados</strong>
                  <span>
                    {hasMissingRequiredDocuments
                      ? `Faltan ${requiredDocuments.filter((document) => !document.document).length} por cargar.`
                      : `Los ${REQUIRED_DOCUMENTS.length} documentos requeridos ya fueron cargados.`}
                  </span>
                </div>

                <div className="validation-documents-grid">
                  {requiredDocuments.map((requiredDocument) => {
                    const document = requiredDocument.document;

                    return (
                      <div
                        className={`validation-document-row${document ? ' loaded' : ' missing'}`}
                        key={requiredDocument.key}
                      >
                        <div className={`validation-document-icon tone-${requiredDocument.tone}`}>
                          <UiIcon name={requiredDocument.icon} />
                        </div>

                        <div className="validation-document-card-body">
                          <div className="validation-document-card-head">
                            <div className="validation-document-copy">
                              <strong>{requiredDocument.label}</strong>
                              <span>
                                {document
                                  ? `Cargado como: ${document.documentType}`
                                  : 'Aún no ha sido cargado por el vendedor'}
                              </span>
                            </div>

                            <StatusPill status={requiredDocument.status} isLoaded={Boolean(document)} />
                          </div>

                          <div className="validation-document-card-footer">
                            {document ? (
                              <div className="validation-history-doc-actions" style={{ gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => openDocument(document)}
                                  title="Previsualizar"
                                  className="validation-doc-action-btn preview"
                                >
                                  <UiIcon name="eye" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = resolveDocumentUrl(document.documentUrl);
                                    if (url) {
                                      void downloadDocument(
                                        url,
                                        buildDocumentDownloadName(document.documentType, url),
                                      );
                                    } else {
                                      showToast("No se pudo iniciar la descarga: URL no disponible.");
                                    }
                                  }}
                                  title="Descargar"
                                  className="validation-doc-action-btn download"
                                >
                                  <UiIcon name="download" />
                                </button>
                              </div>
                            ) : (
                              <span className="validation-document-placeholder">Pendiente de carga</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="validation-panel validation-history-panel">
                <div
                  className="validation-history-header-toggle"
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                >
                  <div className="validation-history-header-left">
                    <PanelTitle icon="audit" title="Historial de observaciones" />
                    {(() => {
                      const combinedNotes = selectedGroup.documents[0]?.notes || '';
                      const parsedHistory = parseObservationHistory(combinedNotes);
                      
                      if (parsedHistory.length === 0) {
                        return <span className="validation-history-origin-badge new">Primer Ingreso</span>;
                      }
                      
                      const newestItem = parsedHistory[parsedHistory.length - 1];
                      if (!newestItem) {
                        return <span className="validation-history-origin-badge new">Primer Ingreso</span>;
                      }
                      
                      if (newestItem.type === 'apelacion_vendedor') {
                        return <span className="validation-history-origin-badge appeal">Reingreso por Apelación</span>;
                      } else if (newestItem.type === 'correccion_vendedor') {
                        return <span className="validation-history-origin-badge correction">Reingreso por Corrección</span>;
                      } else if (newestItem.type === 'rechazo') {
                        return <span className="validation-history-origin-badge rejected-status">Rechazado</span>;
                      } else if (newestItem.type === 'correccion_solicitada') {
                        return <span className="validation-history-origin-badge correction-status">Por Corregir</span>;
                      } else {
                        return <span className="validation-history-origin-badge legacy">Con Historial</span>;
                      }
                    })()}
                  </div>
                  <button
                    type="button"
                    className={`validation-history-toggle-btn ${isHistoryExpanded ? 'expanded' : ''}`}
                    aria-label={isHistoryExpanded ? 'Colapsar historial' : 'Expandir historial'}
                  >
                    <UiIcon name="chevronDown" />
                  </button>
                </div>

                {isHistoryExpanded && (
                  <div className="validation-history-list">
                    {(() => {
                      const combinedNotes = selectedGroup.documents[0]?.notes || '';
                      const parsedHistory = parseObservationHistory(combinedNotes);

                      if (parsedHistory.length === 0) {
                        return (
                          <div className="validation-history-empty">
                            No hay observaciones registradas previamente para los documentos de esta tienda.
                          </div>
                        );
                      }

                      const reversedHistory = [...parsedHistory].reverse();

                      return reversedHistory.map((item) => {
                        let badgeVariant = 'approved';
                        if (item.type === 'rechazo') {
                          badgeVariant = 'rejected';
                        } else if (item.type === 'correccion_solicitada') {
                          badgeVariant = 'correction';
                        } else if (item.type === 'apelacion_vendedor') {
                          badgeVariant = 'appeal';
                        } else if (item.type === 'correccion_vendedor') {
                          badgeVariant = 'seller-correction';
                        } else {
                          badgeVariant = 'general';
                        }

                        return (
                          <div className={`validation-history-item state-${badgeVariant}`} key={item.id}>
                            <div className="validation-history-item-header">
                              <span className="validation-history-doc-type">
                                <UiIcon name={badgeVariant === 'appeal' ? 'message' : 'document'} />
                                {item.tagLabel}
                              </span>
                              <span className={`validation-history-badge ${badgeVariant}`}>
                                {item.tagLabel}
                              </span>
                            </div>
                            <p className="validation-history-note-text">
                              {item.message}
                            </p>
                            <div className="validation-history-meta">
                              <span>Fecha: {item.timestamp}</span>
                            </div>

                            {(() => {
                              const isLegacyCorrection = item.type === 'correccion_vendedor' && !item.attachments;
                              const hasExplicitAttachments = item.attachments && item.attachments.length > 0;
                              
                              if (!hasExplicitAttachments && !isLegacyCorrection) {
                                return null;
                              }

                              const filteredDocs = selectedGroup.documents.filter((doc) => {
                                if (isLegacyCorrection) return true;
                                return item.attachments?.some((attName) => {
                                  return doc.documentType.toLowerCase().trim() === attName.toLowerCase().trim();
                                });
                              });

                              if (filteredDocs.length === 0) return null;

                              return (
                                <div className="validation-history-documents">
                                  <span className="validation-history-docs-title">
                                    {isLegacyCorrection 
                                      ? "Documentos de la solicitud (Histórico):" 
                                      : "Documentos corregidos en este envío:"}
                                  </span>
                                  <div className="validation-history-docs-list">
                                    {filteredDocs.map((doc) => (
                                      <div key={doc.id} className="validation-history-doc-chip">
                                        <span className="validation-history-doc-name" title={doc.documentType}>
                                          {doc.documentType}
                                        </span>
                                        <div className="validation-history-doc-actions">
                                          {doc.documentUrl ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => window.open(doc.documentUrl, '_blank')}
                                                title="Previsualizar"
                                                className="validation-doc-action-btn preview"
                                              >
                                                <UiIcon name="eye" />
                                              </button>
                                              <a
                                                href={doc.documentUrl}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Descargar"
                                                className="validation-doc-action-btn download"
                                              >
                                                <UiIcon name="download" />
                                              </a>
                                            </>
                                          ) : (
                                            <span className="no-url">No disponible</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </section>

              <section className="validation-panel validation-decision-panel">
                <div>
                  <PanelTitle icon="scale" title="Decisión" />
                  <label className="validation-notes-label" htmlFor="validation-decision-notes">
                    Notas internas o solicitud de corrección (opcional)
                  </label>
                  <div className="validation-notes-box">
                    <textarea
                      id="validation-decision-notes"
                      maxLength={500}
                      value={decisionNotes}
                      onChange={(event) => setDecisionNotes(event.target.value)}
                      placeholder="Escribe una nota o indica qué información debe corregir el vendedor..."
                    />
                    <span>{decisionNotes.length} / 500</span>
                  </div>
                </div>

                <div className="validation-decision-actions">
                  <button
                    className="validation-action-button approve"
                    type="button"
                    disabled={!canApproveRequest || mutationInProgress}
                    onClick={approveSelectedRequest}
                  >
                    <UiIcon name="check" />
                    Aprobar solicitud
                  </button>
                  <button
                    className="validation-action-button correction"
                    type="button"
                    disabled={!canResolveRequest || !decisionNotes.trim() || mutationInProgress}
                    onClick={requestSelectedCorrection}
                  >
                    <UiIcon name="refresh" />
                    Solicitar corrección
                  </button>
                  <button
                    className="validation-action-button reject"
                    type="button"
                    disabled={!canResolveRequest || mutationInProgress}
                    onClick={rejectSelectedRequest}
                  >
                    <UiIcon name="close" />
                    Rechazar solicitud
                  </button>
                </div>

                {hasMissingRequiredDocuments && (
                  <p className="validation-decision-hint">
                    Completa la carga de los 4 documentos de registro obligatorios para habilitar la decisión de la solicitud.
                  </p>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </section>
  );
}

function PanelTitle({ icon, title, compact = false }: { icon: string; title: string; compact?: boolean }) {
  return (
    <div className={`validation-panel-title ${compact ? 'compact' : ''}`}>
      <span>
        <UiIcon name={icon} />
      </span>
      <h2>{title}</h2>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="validation-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status, isLoaded = false }: { status: string; isLoaded?: boolean }) {
  const isPendingLoaded = status === ValidationStatus.PENDIENTE && isLoaded;
  const normalizedClass = isPendingLoaded ? 'cargado' : status.toLowerCase().replace('_', '-');
  const label = isPendingLoaded ? 'CARGADO' : getStatusLabel(status);
  return <span className={`validation-status-pill ${normalizedClass}`}>{label}</span>;
}
