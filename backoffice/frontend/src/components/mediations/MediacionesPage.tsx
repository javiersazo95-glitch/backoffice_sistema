import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMediations, useMediation, useInitMediation, useBlockAccount, useResolveCase, useReactivateAccount, useAddMessage, useEditMessage, useDeleteMessage } from '@/hooks/useMediations';
import { useSeller, useSellerDocuments } from '@/hooks/useSellers';
import { useQuery } from '@tanstack/react-query';
import * as mediationsApi from '@/api/mediations';
import MetricCard from '@/components/shared/MetricCard';
import Pagination from '@/components/shared/Pagination';
import PageHeader from '@/components/shared/PageHeader';
import type { PageResponse } from '@/types/common';
import { PAGE_SIZES } from '@/utils/constants';
import { MediationStatus, type MediationResponse } from '@/types/mediation';
import { showToast } from '@/components/layout/Toast';
import type { MediationFilterRequest } from '@/types/mediation';
import type { MediationNoteType } from '@/utils/mediationNotes';
import { mediationStatusDisplay } from '@/utils/formatters';
import { normalizeVisibleMediationStatus } from '@/utils/manualMediationStatus';
import MediationTable from './MediationTable';
import MediationResolvedTable from './MediationResolvedTable';
import BlockedAccountsTable from './BlockedAccountsTable';
import MediationFilterBar from './MediationFilterBar';
import FilterContext from './FilterContext';
import MediationDetailPanel from './MediationDetailPanel';
import MediationDetail from './MediationDetail';
import SellerDocumentsModal from '@/components/sellers/SellerDocumentsModal';
import SellerProfileModal from '@/components/sellers/SellerProfileModal';
import SellerActiveMediationsModal from '@/components/sellers/SellerActiveMediationsModal';
import {
  MediationInitModal,
  MediationNoteModal,
  MediationNotesHistoryModal,
  CaseResolutionModal,
  MediationInitFeedbackOverlay,
  ResolvedCaseTimelineModal,
  BlockedAccountHistoryModal,
  AppealReviewModal,
} from './modals';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import { SellerStatus, type SellerDetailResponse, type SellerDocumentResponse } from '@/types/seller';
import type { ResolvedCaseResponse } from '@/types/mediation';

function normalizeDocumentKey(documentType: string) {
  return documentType
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDocumentUrl(document: SellerDocumentResponse & Record<string, unknown>) {
  return [
    document.documentUrl,
    document.fileUrl,
    document.url,
    document.r2Url,
    document.r2ObjectUrl,
    document.storageUrl,
    document.publicUrl,
    document.downloadUrl,
    typeof document.file === 'object' && document.file ? (document.file as Record<string, unknown>).url : undefined,
    typeof document.r2 === 'object' && document.r2 ? (document.r2 as Record<string, unknown>).url : undefined,
    typeof document.storage === 'object' && document.storage ? (document.storage as Record<string, unknown>).url : undefined,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function normalizeSellerDocument(document: SellerDocumentResponse, sellerId: number) {
  const documentRecord = document as SellerDocumentResponse & Record<string, unknown>;
  return {
    ...document,
    sellerId: document.sellerId || sellerId,
    documentUrl: getDocumentUrl(documentRecord),
  };
}

function getEmbeddedSellerDocuments(seller?: SellerDetailResponse | null): SellerDocumentResponse[] {
  if (!seller) return [];

  const sellerRecord = seller as SellerDetailResponse & Record<string, unknown>;
  const candidates = [
    sellerRecord.adhesionContractUrl,
    sellerRecord.adhesionContractDocumentUrl,
    sellerRecord.contractUrl,
    sellerRecord.contractDocumentUrl,
    sellerRecord.contratoAdhesionUrl,
    sellerRecord.contratoAdhesionDocumentUrl,
  ];
  const contractUrl = candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? findAdhesionContractUrl(sellerRecord);

  if (!contractUrl) return [];

  return [{
    id: -seller.id,
    sellerId: seller.id,
    documentType: 'Contrato de adhesión',
    documentUrl: contractUrl,
    uploadedAt: seller.lastActivityAt,
    dueAt: '',
    status: seller.status === SellerStatus.RECHAZADO ? 'RECHAZADA' as SellerDocumentResponse['status'] : 'APROBADA' as SellerDocumentResponse['status'],
    owner: seller.owner || seller.storeName,
    notes: 'Contrato de adhesión almacenado en Cloudflare R2.',
  }];
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function mentionsAdhesionContract(value: string) {
  const normalized = normalizeDocumentKey(value);
  return (
    normalized.includes('contrato adhesion')
    || normalized.includes('contrato de adhesion')
    || normalized.includes('adhesion contract')
    || normalized.includes('contract adhesion')
    || normalized.includes('contratoadhesion')
  );
}

function findAdhesionContractUrl(source: unknown, path: string[] = [], depth = 0): string | undefined {
  if (!source || depth > 6) return undefined;

  if (typeof source === 'string') {
    const context = path.join(' ');
    if (looksLikeUrl(source) && (mentionsAdhesionContract(context) || mentionsAdhesionContract(source))) {
      return source;
    }
    return undefined;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findAdhesionContractUrl(item, path, depth + 1);
      if (found) return found;
    }
    return undefined;
  }

  if (typeof source !== 'object') return undefined;

  const record = source as Record<string, unknown>;
  const valuesContext = [
    record.documentType,
    record.type,
    record.name,
    record.fileName,
    record.title,
    record.key,
  ].filter((value): value is string => typeof value === 'string').join(' ');

  if (mentionsAdhesionContract(valuesContext)) {
    const url = getDocumentUrl(record as SellerDocumentResponse & Record<string, unknown>);
    if (url) return url;
  }

  for (const [key, value] of Object.entries(record)) {
    const found = findAdhesionContractUrl(value, [...path, key, valuesContext], depth + 1);
    if (found) return found;
  }

  return undefined;
}

function mergeDocumentLists(sellerId: number, ...documentLists: Array<SellerDocumentResponse[] | undefined>) {
  const merged = new Map<string, SellerDocumentResponse>();

  documentLists.flatMap((list) => list ?? []).forEach((document) => {
    const normalizedDocument = normalizeSellerDocument(document, sellerId);
    const key = normalizeDocumentKey(normalizedDocument.documentType);
    const current = merged.get(key);
    if (!current || (!current.documentUrl && normalizedDocument.documentUrl)) {
      merged.set(key, normalizedDocument);
    }
  });

  return Array.from(merged.values());
}

export default function MediacionesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const deepLinkHandledRef = useRef('');
  const [filter, setFilter] = useState<MediationFilterRequest>({ activeOnly: true, page: 0, size: PAGE_SIZES.MEDIATIONS });
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [blockedFilter, setBlockedFilter] = useState<boolean | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES.MEDIATIONS);

  const [initModalOpen, setInitModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [notesHistoryModalOpen, setNotesHistoryModalOpen] = useState(false);
  const [noteFeedbackOpen, setNoteFeedbackOpen] = useState(false);
  const [noteFeedbackTitle, setNoteFeedbackTitle] = useState('Nota registrada');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [resolvedTimelineOpen, setResolvedTimelineOpen] = useState(false);
  const [selectedTimelineCase, setSelectedTimelineCase] = useState<ResolvedCaseResponse | null>(null);
  const [editingNote, setEditingNote] = useState<{ index: number; messageId: number; text: string; noteType?: MediationNoteType } | null>(null);
  const [blockedHistoryOpen, setBlockedHistoryOpen] = useState(false);
  const [blockedHistoryId, setBlockedHistoryId] = useState<number | null>(null);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealMediationId, setAppealMediationId] = useState<number | null>(null);
  const [sellerInfoOpen, setSellerInfoOpen] = useState(false);
  const [sellerDocumentsOpen, setSellerDocumentsOpen] = useState(false);
  const [sellerMediationsOpen, setSellerMediationsOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const { data, isLoading } = useMediations(filter);
  const { data: mediationDetail } = useMediation(selectedId ?? 0);
  const { data: resolvedCases, isLoading: isLoadingResolvedCases } = useQuery({
    queryKey: ['resolved-cases'],
    queryFn: async () => {
      const result = await mediationsApi.getMediations({ status: MediationStatus.RESUELTA, page: 0, size: 100 });
      return result as any;
    },
  });

  const { data: blockedAccounts, isLoading: isLoadingBlockedAccounts } = useQuery<PageResponse<MediationResponse>>({
    queryKey: ['mediations', 'blocked-accounts'],
    queryFn: () => mediationsApi.getMediations({ blocked: true, page: 0, size: 100 }),
  });

  const { data: sellerDetail } = useSeller(selectedSellerId ?? 0);
  const { data: sellerDocuments } = useSellerDocuments(selectedSellerId ?? 0);
  const sellerDocumentList = useMemo(() => {
    return mergeDocumentLists(selectedSellerId ?? 0, sellerDocuments, sellerDetail?.documents, getEmbeddedSellerDocuments(sellerDetail));
  }, [selectedSellerId, sellerDetail, sellerDocuments]);

  const { data: activeMediationsData } = useQuery({
    queryKey: ['mediations-count', 'EN_MEDIACION'],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.EN_MEDIACION, page: 0, size: 1 }),
  });

  const { data: waitingData } = useQuery({
    queryKey: ['mediations-count', 'ESPERANDO_VENDEDOR'],
    queryFn: () => mediationsApi.getMediations({ status: MediationStatus.ESPERANDO_VENDEDOR, page: 0, size: 1 }),
  });

  const initMutation = useInitMediation();
  const blockMutation = useBlockAccount();
  const resolveMutation = useResolveCase();
  const reactivateMutation = useReactivateAccount();
  const addMessageMutation = useAddMessage();
  const editMessageMutation = useEditMessage();
  const deleteMessageMutation = useDeleteMessage();

  const activeStatuses = new Set([
    MediationStatus.ESPERANDO_VENDEDOR,
    MediationStatus.EN_MEDIACION,
  ]);
  const mediations = (data?.content ?? [])
    .map((item) => {
      const overridden = { ...item, status: normalizeVisibleMediationStatus(item.status) };
      return {
        ...overridden,
        displayStatus: mediationStatusDisplay(overridden.status, overridden.accountBlocked),
      };
    })
    .filter((item): item is MediationResponse => !!item && !item.accountBlocked && activeStatuses.has(item.status));
  const selectedMediation = selectedId
      ? (() => {
        const source = mediationDetail || mediations.find((m) => m.id === selectedId) || null;
        if (!source) return null;
        const overridden = { ...source, status: normalizeVisibleMediationStatus(source.status) };
        return {
          ...overridden,
          displayStatus: mediationStatusDisplay(overridden.status, overridden.accountBlocked),
        };
      })()
    : null;

  const statusMetrics = useMemo(
    () => ({
      active: activeMediationsData?.totalElements ?? 0,
      waiting: waitingData?.totalElements ?? 0,
      resolved: resolvedCases?.totalElements ?? resolvedCases?.content?.length ?? 0,
    }),
    [activeMediationsData?.totalElements, resolvedCases?.content?.length, resolvedCases?.totalElements, waitingData?.totalElements],
  );

  useEffect(() => {
    if (!noteFeedbackOpen) return;
    const timeout = window.setTimeout(() => setNoteFeedbackOpen(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [noteFeedbackOpen]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;

    const deepLinkKey = searchParams.toString();
    if (deepLinkHandledRef.current === deepLinkKey) return;
    deepLinkHandledRef.current = deepLinkKey;

    let cancelled = false;
    const clearDeepLinkParams = () => {
      if (!cancelled) setSearchParams({}, { replace: true });
    };

    const openFromDeepLink = async () => {
      const mediationId = Number(searchParams.get('mediationId'));

      if (action === 'review' && Number.isFinite(mediationId) && mediationId > 0) {
        setSelectedId(mediationId);
        setReviewModalOpen(true);
        clearDeepLinkParams();
        return;
      }

      if (action === 'init') {
        let targetId = Number.isFinite(mediationId) && mediationId > 0 ? mediationId : 0;

        if (!targetId) {
          const sellerId = Number(searchParams.get('sellerId'));
          if (Number.isFinite(sellerId) && sellerId > 0) {
            const waitingCases = await mediationsApi.getMediations({
              status: MediationStatus.ESPERANDO_VENDEDOR,
              page: 0,
              size: PAGE_SIZES.MAX,
            });
            targetId = waitingCases.content.find((item) => item.sellerId === sellerId)?.id ?? 0;
          }
        }

        if (targetId) {
          setSelectedId(targetId);
          setInitModalOpen(true);
        } else {
          showToast('No se encontró un caso en disputa para inicializar mediación.');
        }

        clearDeepLinkParams();
      }
    };

    openFromDeepLink();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setFilter((f) => ({ ...f, search: value, page: 0 }));
  };

  const handleFilterChange = (statusVal: string, blockedVal: boolean | undefined) => {
    setStatusFilter(statusVal);
    setBlockedFilter(blockedVal);
    if (blockedVal !== undefined) {
      setFilter((f) => ({ ...f, status: undefined, blocked: blockedVal, page: 0 }));
    } else {
      setFilter((f) => ({ ...f, status: (statusVal || undefined) as MediationStatus | undefined, blocked: undefined, page: 0 }));
    }
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setFilter((f) => ({ ...f, startDate: value || undefined, page: 0 }));
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setFilter((f) => ({ ...f, endDate: value || undefined, page: 0 }));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setFilter((f) => ({ ...f, size, page: 0 }));
  };

  const handleInitMediation = (id: number, message: string) => {
    const mediation = mediations.find((m) => m.id === id);
    if (!mediation) return;
    initMutation.mutate(
      { id, data: { sellerId: mediation.sellerId, title: mediation.title, reason: mediation.reason, orderId: mediation.orderId, amount: String(mediation.amount), message } },
      { onSuccess: () => { setInitModalOpen(false); showToast('Mediación inicializada'); } },
    );
  };

  const handleAddNote = (id: number, note: string, noteType: MediationNoteType, noteIndex?: number) => {
    if (noteIndex !== undefined) {
      editMessageMutation.mutate(
        { mediationId: id, messageId: editingNote?.messageId ?? noteIndex, data: { message: note, type: noteType, isInternal: true } },
        {
          onSuccess: () => {
            setNoteModalOpen(false);
            setEditingNote(null);
            setNotesHistoryModalOpen(true);
            setNoteFeedbackTitle('Nota actualizada');
            setNoteFeedbackOpen(true);
          },
        },
      );
    } else {
      addMessageMutation.mutate(
        { mediationId: id, data: { message: note, type: noteType, isInternal: true } },
        {
          onSuccess: () => {
            setNoteModalOpen(false);
            setEditingNote(null);
            setNotesHistoryModalOpen(true);
            setNoteFeedbackTitle('Nota registrada');
            setNoteFeedbackOpen(true);
          },
        },
      );
    }
  };

  const handleEditNote = (_id: number, noteIndex: number) => {
    if (mediationDetail?.messages?.[noteIndex]) {
      const note = mediationDetail.messages[noteIndex];
      setEditingNote({ index: noteIndex, messageId: note.id, text: note.text, noteType: note.noteType });
      setNoteModalOpen(true);
    }
  };

  const handleDeleteNote = (id: number, noteIndex: number) => {
    if (confirm('¿Estás seguro de eliminar esta nota?')) {
      const messageId = mediationDetail?.messages?.[noteIndex]?.id;
      if (messageId === undefined) return;
      deleteMessageMutation.mutate(
        { mediationId: id, messageId },
        { onSuccess: () => showToast('Nota eliminada') },
      );
    }
  };

  const handleResolve = (id: number, reason: string, file: File) => {
    resolveMutation.mutate(
      { id, data: { resolutionReason: reason }, document: file },
      {
        onSuccess: () => { setReviewModalOpen(false); showToast('Caso resuelto'); },
        onError: (error: any) => { showToast(error?.response?.data?.message || 'Error al resolver el caso'); },
      },
    );
  };

  const handleReactivate = (id: number, reason: string, file: File) => {
    reactivateMutation.mutate(
      { id, data: { resolutionReason: reason }, document: file },
      { onSuccess: () => { setReactivateModalOpen(false); showToast('Cuenta reactivada'); } },
    );
  };

  const handleBlockAccount = (id: number) => {
    if (confirm('¿Estás seguro de bloquear esta cuenta?')) {
      blockMutation.mutate(id, {
        onSuccess: () => {
          setReviewModalOpen(false);
          navigate('/confianza/mediations');
          showToast('Cuenta bloqueada');
        },
        onError: (error: any) => {
          showToast(error?.response?.data?.message || 'No se pudo bloquear la cuenta');
        },
      });
    }
  };

  const handleOpenSellerInfo = (sellerId: number) => {
    setSelectedSellerId(sellerId);
    setSellerInfoOpen(true);
  };

  const handleOpenSellerDocuments = (sellerId: number) => {
    setSelectedSellerId(sellerId);
    setSellerInfoOpen(false);
    setSellerMediationsOpen(false);
    setSellerDocumentsOpen(true);
  };

  const handleOpenSellerMediations = (sellerId: number) => {
    setSelectedSellerId(sellerId);
    setSellerInfoOpen(false);
    setSellerDocumentsOpen(false);
    setSellerMediationsOpen(true);
  };

  const handleCloseSellerDocuments = () => {
    setSellerDocumentsOpen(false);
    setSelectedSellerId(null);
  };

  const handleCloseSellerMediations = () => {
    setSellerMediationsOpen(false);
    setSelectedSellerId(null);
  };

  return (
    <>
      <PageHeader
        title="Mediaciones"
        description="Intervención entre comprador y vendedor cuando existen reclamos o falta de respuesta."
        actions={<AreaHomeShortcut />}
      />

      <section className="metric-grid compact mediation-metric-grid">
            <MetricCard
              label="En mediación"
              value={statusMetrics.active}
              tone="violet"
              iconName="scale"
              description="Casos con mediación formal ya iniciada."
            />
            <MetricCard
              label="En disputa"
              value={statusMetrics.waiting}
              tone="amber"
              iconName="clock"
              description="Casos pendientes de respuesta o gestión del vendedor."
            />
            <MetricCard
              label="Casos resueltos"
              value={statusMetrics.resolved}
              tone="green"
              iconName="check"
              description="Mediaciones cerradas con respaldo registrado."
            />
          </section>

          <section className="module-layout mediation-layout">
            <article className="panel mediation-table-panel">
              <MediationFilterBar
                search={search}
                startDate={startDate}
                endDate={endDate}
                status={statusFilter}
                blocked={blockedFilter}
                onSearchChange={handleSearchChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                onFilterChange={handleFilterChange}
              />

              <FilterContext status={statusFilter} />

              {isLoading ? (
                <div className="panel-body">Cargando mediaciones...</div>
              ) : (
                <>
                  <section className="mediation-data-section active-mediations-section">
                    <div className="panel-header active-mediations-header">
                      <div>
                        <h2>Mediaciones activas</h2>
                        <span className="panel-hint">Casos abiertos que requieren seguimiento o gestión del equipo de mediación</span>
                      </div>
                      <span className="panel-count active-count">{data?.totalElements ?? mediations.length}</span>
                    </div>

                    <MediationTable
                      mediations={mediations}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onOpenMediationCase={(id) => { setSelectedId(id); setReviewModalOpen(true); }}
                      onOpenReactivation={(id) => { setSelectedId(id); setReactivateModalOpen(true); }}
                      onOpenSellerInfo={handleOpenSellerInfo}
                    />

                    <Pagination
                      currentPage={filter.page ?? 0}
                      totalPages={data?.totalPages ?? 0}
                      totalItems={data?.totalElements ?? 0}
                      pageSize={pageSize}
                      onPageChange={(p) => setFilter((f) => ({ ...f, page: p }))}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  </section>

                  <BlockedAccountsTable
                    accounts={blockedAccounts?.content ?? []}
                    totalItems={blockedAccounts?.totalElements ?? 0}
                    isLoading={isLoadingBlockedAccounts}
                    onOpenSellerInfo={handleOpenSellerInfo}
                    onOpenHistory={(id) => { setBlockedHistoryId(id); setBlockedHistoryOpen(true); }}
                    onOpenAppeal={(id) => { setAppealMediationId(id); setAppealModalOpen(true); }}
                  />

                  <MediationResolvedTable
                    cases={resolvedCases?.content ?? []}
                    totalItems={resolvedCases?.totalElements ?? 0}
                    isLoading={isLoadingResolvedCases}
                    onOpenTimeline={(item) => { setSelectedTimelineCase(item); setResolvedTimelineOpen(true); }}
                  />
                </>
              )}
            </article>

        {selectedMediation && (
          <MediationDetailPanel
            item={selectedMediation}
            onOpenReactivation={(id) => { setSelectedId(id); setReactivateModalOpen(true); }}
            onOpenMediationCase={(id) => { setSelectedId(id); setReviewModalOpen(true); }}
            onOpenInitMediation={(id) => { setSelectedId(id); setInitModalOpen(true); }}
            onOpenNote={(id) => { setSelectedId(id); setEditingNote(null); setNoteModalOpen(true); }}
            onOpenNotesHistory={(id) => { setSelectedId(id); setNotesHistoryModalOpen(true); }}
            onBlockAccount={handleBlockAccount}
            onOpenSellerInfo={handleOpenSellerInfo}
          />
        )}
      </section>

      <MediationInitModal
        isOpen={initModalOpen}
        onClose={() => setInitModalOpen(false)}
        item={mediationDetail || null}
        onSubmit={handleInitMediation}
      />

      <MediationNoteModal
        isOpen={noteModalOpen}
        onClose={() => { setNoteModalOpen(false); setEditingNote(null); }}
        item={mediationDetail || null}
        editingNote={editingNote}
        onSubmit={handleAddNote}
      />

      <MediationNotesHistoryModal
        isOpen={notesHistoryModalOpen}
        onClose={() => setNotesHistoryModalOpen(false)}
        onNewNote={() => {
          setNotesHistoryModalOpen(false);
          setEditingNote(null);
          setNoteModalOpen(true);
        }}
        item={mediationDetail || null}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
      />

      <MediationInitFeedbackOverlay
        isOpen={noteFeedbackOpen}
        label={noteFeedbackTitle}
        message="La nota quedó registrada en el historial interno del caso."
        status="success"
        title={noteFeedbackTitle}
        onClose={() => setNoteFeedbackOpen(false)}
      />

      <CaseResolutionModal
        isOpen={reactivateModalOpen}
        onClose={() => setReactivateModalOpen(false)}
        item={mediationDetail || null}
        mode="reactivate"
        onSubmit={handleReactivate}
      />

      <ResolvedCaseTimelineModal
        isOpen={resolvedTimelineOpen}
        onClose={() => { setResolvedTimelineOpen(false); setSelectedTimelineCase(null); }}
        item={selectedTimelineCase}
      />

      <BlockedAccountHistoryModal
        isOpen={blockedHistoryOpen}
        onClose={() => { setBlockedHistoryOpen(false); setBlockedHistoryId(null); }}
        item={blockedAccounts?.content?.find((item: MediationResponse) => item.id === blockedHistoryId) || null}
      />

      <AppealReviewModal
        isOpen={appealModalOpen}
        onClose={() => { setAppealModalOpen(false); setAppealMediationId(null); }}
        item={blockedAccounts?.content?.find((item: MediationResponse) => item.id === appealMediationId) || null}
        isSubmitting={reactivateMutation.isPending}
        onReactivate={(id, reason, file) => { handleReactivate(id, reason, file); setAppealModalOpen(false); }}
      />

      <SellerProfileModal
        isOpen={sellerInfoOpen}
        onClose={() => {
          setSellerInfoOpen(false);
          setSelectedSellerId(null);
        }}
        seller={sellerDetail || null}
        onOpenDocuments={handleOpenSellerDocuments}
        onOpenMediation={handleOpenSellerMediations}
        onSuspend={handleBlockAccount}
      />

      <SellerDocumentsModal
        isOpen={sellerDocumentsOpen}
        onClose={handleCloseSellerDocuments}
        seller={sellerDetail || null}
        documents={sellerDocumentList}
      />

      <SellerActiveMediationsModal
        isOpen={sellerMediationsOpen}
        onClose={handleCloseSellerMediations}
        seller={sellerDetail || null}
      />

      <MediationDetail
        isOpen={reviewModalOpen}
        item={selectedMediation}
        onClose={() => setReviewModalOpen(false)}
        onResolve={handleResolve}
        onBlockAccount={handleBlockAccount}
        onSendMessage={(mediationId, text, targetRole) =>
          addMessageMutation.mutate({ mediationId, data: { message: text, targetRole } })
        }
      />
    </>
  );
}
