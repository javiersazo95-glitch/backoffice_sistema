import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as sellersApi from '@/api/sellers';
import * as mediationsApi from '@/api/mediations';
import UiIcon from '@/components/shared/UiIcon';
import PageHeader from '@/components/shared/PageHeader';
import Notice from '@/components/shared/Notice';
import RegisteredSellersLegend from '@/components/shared/RegisteredSellersLegend';
import SellerMetricGrid from './SellerMetricGrid';
import SellerFilterBar from './SellerFilterBar';
import SellerTable from './SellerTable';
import RisksPanel from './RisksPanel';
import ImpactMediationsPanel from './ImpactMediationsPanel';
import ResolvedCasesPanel from './ResolvedCasesPanel';
import { useSellers, useSeller, useSellerDocuments, useSuspendSeller } from '@/hooks/useSellers';
import { PAGE_SIZES } from '@/utils/constants';
import { SellerStatus, type SellerResponse, type SellerFilterRequest, type SellerDetailResponse, type SellerDocumentResponse } from '@/types/seller';
import type { RiskCase, ImpactMediation, ResolvedCase } from '@/types/cases';
import { MediationStatus, type MediationResponse, type ResolvedCaseResponse } from '@/types/mediation';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import SellerDocumentsModal from './SellerDocumentsModal';
import SellerProfileModal from './SellerProfileModal';
import SellerActiveMediationsModal from './SellerActiveMediationsModal';
import { showToast } from '@/components/layout/Toast';
import { applyManualMediationStatus, useManualMediationStatusOverrides } from '@/utils/manualMediationStatus';
import { useManualMediationAdminMode } from '@/utils/manualMediationAdminMode';

const safeText = (value: unknown, fallback = '') => {
  return typeof value === 'string' && value.trim() ? value : fallback;
};

const getBuyerFromMediation = (med: MediationResponse) => {
  const title = safeText(med.title);
  const buyer = title.replace('Comprador vs ', '').trim();
  return buyer || 'Comprador';
};

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

function isSellerVisibleInList(seller: SellerResponse) {
  // La lista de vendedores solo debe mostrar cuentas activas/aprobadas.
  // Si existen mediaciones o casos esperando al vendedor, el vendedor igualmente debe estar APROBADO.
  return seller.status === SellerStatus.APROBADO;
}

export default function SellersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<SellerFilterRequest>({ page: 0, size: PAGE_SIZES.SELLERS, search: '', status: undefined, startDate: '', endDate: '' });
  const [searchInput, setSearchInput] = useState('');
  const [statusDisplay, setStatusDisplay] = useState('Todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [infoSeller, setInfoSeller] = useState<SellerResponse | null>(null);
  const [sellerInfoOpen, setSellerInfoOpen] = useState(false);
  const [sellerMediationsOpen, setSellerMediationsOpen] = useState(false);

  const applyFilter = (updates: Partial<SellerFilterRequest>) => {
    setFilter((f) => ({ ...f, ...updates, page: 0 }));
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    applyFilter({ search: value || undefined });
  };

  const handleStatusChange = (value: string) => {
    setStatusDisplay(value);
    applyFilter({ status: undefined });
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    applyFilter({ startDate: value || undefined });
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    applyFilter({ endDate: value || undefined });
  };

  const sellerListFilter: SellerFilterRequest = {
    ...filter,
    status: undefined,
    page: 0,
    size: PAGE_SIZES.MAX,
  };

  const { data, isLoading } = useSellers(sellerListFilter);
  const { data: allSellersData } = useSellers({ page: 0, size: PAGE_SIZES.MAX });
  const { data: sellerDocs } = useSellerDocuments(selectedSellerId ?? 0);
  const { data: sellerDetail } = useSeller(selectedSellerId ?? 0);
  const suspendMutation = useSuspendSeller();

  const { data: activeMediationsData } = useQuery({
    queryKey: ['mediations', 'active-all'],
    queryFn: () => mediationsApi.getMediations({ activeOnly: true, page: 0, size: PAGE_SIZES.MAX }),
  });

  const { data: resolvedCasesData } = useQuery({
    queryKey: ['resolved-cases-content'],
    queryFn: async () => {
      const result = await mediationsApi.getMediations({ status: MediationStatus.RESUELTA });
      return result.content as any as ResolvedCaseResponse[];
    },
  });

  const allSellers = allSellersData?.content ?? [];
  const listedSellers = data?.content ?? [];
  const activeMediationsSource = activeMediationsData?.content ?? [];
  const [manualStatusOverrides] = useManualMediationStatusOverrides();
  const [adminMode] = useManualMediationAdminMode();
  const effectiveManualStatusOverrides = adminMode ? manualStatusOverrides : {};

  const prioritizedActiveMediations = useMemo(() => {
    const byOrder = new Map<string, { mediation: MediationResponse; changed: boolean }>();

    activeMediationsSource
      .map((med) => {
        const mediation = applyManualMediationStatus(med, effectiveManualStatusOverrides);
        return { mediation, changed: mediation.status !== med.status };
      })
      .filter(({ mediation }) => mediation.status === MediationStatus.EN_MEDIACION || mediation.status === MediationStatus.ESPERANDO_VENDEDOR)
      .forEach(({ mediation, changed }) => {
        const key = safeText(mediation.orderId, String(mediation.id));
        const current = byOrder.get(key);
        const currentUpdatedAt = current ? new Date(current.mediation.updatedAt).getTime() || 0 : -1;
        const nextUpdatedAt = new Date(mediation.updatedAt).getTime() || 0;

        if (
          !current
          || (changed && !current.changed)
          || (changed === current.changed && nextUpdatedAt >= currentUpdatedAt)
        ) {
          byOrder.set(key, { mediation, changed });
        }
      });

    return Array.from(byOrder.values()).map((item) => item.mediation);
  }, [activeMediationsSource, effectiveManualStatusOverrides]);

  const findSellerById = (id: number) => {
    return (
      allSellers.find((seller) => seller.id === id)
      ?? listedSellers.find((seller) => seller.id === id)
      ?? null
    );
  };

  const risks: RiskCase[] = prioritizedActiveMediations
    .filter((med: MediationResponse) => med.status === MediationStatus.ESPERANDO_VENDEDOR)
    .map((med: MediationResponse) => {
      const sellerObj = findSellerById(med.sellerId);
      const rawOwner = safeText(med.owner, 'Sin responsable');
      let resolvedOwner = rawOwner;
      if (rawOwner === 'Sistema' || rawOwner === 'Sin responsable' || !rawOwner) {
        const potentialOwner = sellerObj?.owner || sellerObj?.storeName || 'eladmin';
        resolvedOwner = potentialOwner.toLowerCase() === 'eladmin' ? 'eladmin' : potentialOwner;
      }
      
      const rawStage = safeText(med.stage, 'Sin etapa informada');
      const resolvedStage = (rawStage === 'Sin etapa informada' || !rawStage) ? 'En preparación' : rawStage;

      return {
        id: String(med.id),
        sellerId: med.sellerId,
        seller: safeText(med.sellerName, 'Vendedor'),
        status: 'Esperando al vendedor',
        reason: safeText(med.reason, 'Esperando al vendedor'),
        orderId: safeText(med.orderId, 'Sin pedido'),
        updated: safeText(med.createdAt, 'Sin fecha informada'),
        stage: resolvedStage,
        owner: resolvedOwner,
        purchase: safeText(med.reason, 'Sin compra asociada'),
        buyer: med.buyer || getBuyerFromMediation(med),
      };
    });

  const impactMediations: ImpactMediation[] = prioritizedActiveMediations
    .filter((m: MediationResponse) => m.status === MediationStatus.EN_MEDIACION)
    .map((med: MediationResponse) => {
      const sellerObj = findSellerById(med.sellerId);
      const rawOwner = safeText(med.owner, 'Sin responsable');
      let resolvedOwner = rawOwner;
      if (rawOwner === 'Sistema' || rawOwner === 'Sin responsable' || !rawOwner) {
        const potentialOwner = sellerObj?.owner || sellerObj?.storeName || 'eladmin';
        resolvedOwner = potentialOwner.toLowerCase() === 'eladmin' ? 'eladmin' : potentialOwner;
      }
      
      const rawStage = safeText(med.stage, 'Sin etapa informada');
      const resolvedStage = (rawStage === 'Sin etapa informada' || !rawStage) ? 'En preparación' : rawStage;

      return {
        id: String(med.id),
        sellerId: med.sellerId,
        seller: safeText(med.sellerName, 'Vendedor'),
        status: 'En mediación' as ImpactMediation['status'],
        reason: safeText(med.reason, 'Mediación en curso'),
        escalationReason: safeText(med.escalationReason),
        orderId: safeText(med.orderId, 'Sin pedido'),
        amount: String(med.amount),
        updated: safeText(med.createdAt, 'Sin fecha informada'),
        owner: resolvedOwner,
        stage: resolvedStage,
        nextAction: safeText(med.nextAction),
        accountBlocked: med.accountBlocked,
        purchase: safeText(med.reason, 'Sin compra asociada'),
        buyer: med.buyer || 'Comprador',
      };
    });

  const resolvedCases: ResolvedCase[] = (Array.isArray(resolvedCasesData) ? resolvedCasesData : []).map((item: any) => ({
    id: String(item.id),
    sellerId: item.sellerId,
    seller: safeText(item.sellerName, 'Vendedor'),
    caseId: safeText(item.externalId, String(item.id)),
    kind: safeText(item.caseKind, 'Caso resuelto'),
    reason: safeText(item.reason, 'Caso resuelto'),
    orderId: safeText(item.orderId, 'Sin pedido'),
    resolvedDate: safeText(item.createdAt, 'Sin fecha informada'),
    resolvedBy: safeText(item.resolvedBy, 'Sin responsable'),
    resolutionReason: safeText(item.resolutionReason, 'Sin motivo registrado'),
    documentName: safeText(item.documentName),
    sourceStatus: safeText(item.sourceStatus),
  }));

  const risksBySeller = risks.reduce((acc, risk) => {
    if (!acc[risk.sellerId]) {
      acc[risk.sellerId] = [];
    }
    acc[risk.sellerId]!.push(risk);
    return acc;
  }, {} as Record<number, RiskCase[]>);

  const mediationsBySeller = impactMediations.filter((med) => !med.accountBlocked).reduce((acc, med) => {
    if (!acc[med.sellerId]) {
      acc[med.sellerId] = [];
    }
    acc[med.sellerId]!.push(med);
    return acc;
  }, {} as Record<number, ImpactMediation[]>);

  const blockedMediationsBySeller = impactMediations.filter((med) => med.accountBlocked).reduce((acc, med) => {
    if (!acc[med.sellerId]) {
      acc[med.sellerId] = [];
    }
    acc[med.sellerId]!.push(med);
    return acc;
  }, {} as Record<number, ImpactMediation[]>);

  const rescueSellerIds = useMemo(() => {
    const baseIds = new Set(allSellers.map((seller) => seller.id));
    const ids = new Set<number>();

    [...Object.keys(mediationsBySeller).map(Number), ...Object.keys(risksBySeller).map(Number)].forEach((sellerId) => {
      if (!baseIds.has(sellerId)) {
        ids.add(sellerId);
      }
    });

    return Array.from(ids);
  }, [allSellers, mediationsBySeller, risksBySeller]);

  const rescuedSellerQueries = useQueries({
    queries: rescueSellerIds.map((sellerId) => ({
      queryKey: ['seller-rescued', sellerId],
      queryFn: () => sellersApi.getSellerById(sellerId),
      enabled: sellerId > 0,
    })),
  });

  const rescuedSellers = rescuedSellerQueries
    .map((query) => query.data)
    .filter(Boolean)
    .map((seller) => seller as SellerResponse);

  const sellerPool = useMemo(() => {
    const merged = new Map<number, SellerResponse>();
    [...listedSellers, ...rescuedSellers].forEach((seller) => {
      merged.set(seller.id, seller);
    });
    return Array.from(merged.values());
  }, [listedSellers, rescuedSellers]);

  const activeMediationsCount = impactMediations.length;
  const escalatedMediationsCount = risks.length;

  const visibleSellers = sellerPool.filter((seller) => isSellerVisibleInList(seller));

  const currentPage = filter.page ?? 0;
  const pageSize = filter.size ?? PAGE_SIZES.SELLERS;
  const totalElements = visibleSellers.length;
  const totalPages = Math.ceil(totalElements / pageSize);
  const pagedSellers = visibleSellers.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const sellerMetricCounts = {
    active: allSellers.filter((seller) => seller.status === SellerStatus.APROBADO).length,
    activeMediations: activeMediationsCount,
    escalatedMediations: escalatedMediationsCount,
  };

  const sellerDetailView = useMemo<SellerDetailResponse | null>(() => {
    if (!sellerDetail) return null;

    const sellerMediations = impactMediations.filter((mediation) => mediation.sellerId === sellerDetail.id);
    const sellerRisks = risks.filter((risk) => risk.sellerId === sellerDetail.id);

    return {
      ...sellerDetail,
      mediations: sellerMediations,
      risks: sellerRisks,
    } as unknown as SellerDetailResponse;
  }, [impactMediations, risks, sellerDetail]);
  const sellerDocumentList = useMemo(() => {
    return mergeDocumentLists(selectedSellerId ?? 0, sellerDocs, sellerDetail?.documents, getEmbeddedSellerDocuments(sellerDetail));
  }, [selectedSellerId, sellerDetail, sellerDocs]);

  const handleSellerSelect = (id: number) => {
    const seller = findSellerById(id);
    setSelectedSellerId(id);
    setInfoSeller(seller ?? null);
    setDocModalOpen(true);
  };

  const handleToggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleViewDocs = (id: number) => {
    const seller = findSellerById(id);
    setSelectedSellerId(id);
    setInfoSeller(seller);
    setDocModalOpen(true);
  };

  const handleOpenSellerInfo = (seller: SellerResponse) => {
    setSelectedSellerId(seller.id);
    setInfoSeller(seller);
    setSellerInfoOpen(true);
  };

  const handleOpenSellerDocuments = (sellerId: number) => {
    setSelectedSellerId(sellerId);
    setSellerInfoOpen(false);
    setSellerMediationsOpen(false);
    setDocModalOpen(true);
  };

  const handleOpenSellerMediations = (sellerId: number) => {
    setSelectedSellerId(sellerId);
    setSellerInfoOpen(false);
    setDocModalOpen(false);
    setSellerMediationsOpen(true);
  };

  const handleCloseSellerDocuments = () => {
    setDocModalOpen(false);
    setSelectedSellerId(null);
    setInfoSeller(null);
  };

  const handleCloseSellerMediations = () => {
    setSellerMediationsOpen(false);
    setSelectedSellerId(null);
    setInfoSeller(null);
  };

  const handleBlockAccount = (id: number) => {
    if (confirm('¿Estás seguro de bloquear esta cuenta?')) {
      suspendMutation.mutate(
        { id, data: { reason: 'Bloqueado desde perfil' } },
        {
          onSuccess: () => {
            showToast('Cuenta bloqueada');
            setSellerInfoOpen(false);
          },
          onError: (error: any) => {
            showToast(error?.response?.data?.message || 'No se pudo bloquear la cuenta');
          },
        }
      );
    }
  };

  const handleStartMediation = (mediationId: number) => {
    navigate(`/confianza/mediations?action=init&mediationId=${mediationId}`);
  };

  const handleReviewMediation = (mediationId: number) => {
    navigate(`/confianza/mediations?action=review&mediationId=${mediationId}`);
  };

  return (
    <>
      <PageHeader
        title="Gestión de vendedores"
        description="Control operativo de vendedores visibles, mediaciones asociadas y casos bloqueados."
        actions={<AreaHomeShortcut />}
      />

      <SellerMetricGrid
        activeSellers={sellerMetricCounts.active}
        activeMediations={sellerMetricCounts.activeMediations}
        escalatedMediations={sellerMetricCounts.escalatedMediations}
      />

      <Notice>
        Los casos abiertos no cambian la visibilidad del vendedor. Esta vista muestra solo vendedores activos y sus mediaciones o casos esperando al vendedor asociados.
      </Notice>

      <RegisteredSellersLegend />

      <section className="seller-layout">
        <article className="panel">
          <div className="panel-header">
            <h2>Listado de vendedores</h2>
          </div>

          <SellerFilterBar
            search={searchInput}
            startDate={startDate}
            endDate={endDate}
            status={statusDisplay}
            onSearchChange={handleSearchChange}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onStatusChange={handleStatusChange}
          />

          {isLoading ? (
            <div className="panel-body">Cargando vendedores...</div>
          ) : (
            <>
              <SellerTable
                sellers={pagedSellers}
                onViewSeller={handleOpenSellerInfo}
                onViewDocs={handleViewDocs}
                onToggleSeller={handleSellerSelect}
                expandedId={expandedId}
                onToggleExpand={handleToggleExpand}
                risks={risksBySeller}
                mediations={mediationsBySeller}
                blockedMediations={blockedMediationsBySeller}
                onReviewMediation={handleReviewMediation}
                selectedSellerId={selectedSellerId}
              />

              {totalPages > 0 && (
                <div className="pagination">
                  <span>Mostrando {currentPage * pageSize + 1} a {Math.min((currentPage + 1) * pageSize, totalElements)} de {totalElements} vendedores</span>
                  <div className="page-buttons">
                    <button
                      className="page-button page-prev"
                      type="button"
                      onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 0) - 1 }))}
                      disabled={currentPage === 0}
                      aria-label="Pagina anterior"
                    >
                      <UiIcon name="arrowRight" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i).map((page) => (
                      <button
                        key={page}
                        className={`page-button ${page === currentPage ? 'active' : ''}`}
                        type="button"
                        onClick={() => setFilter((f) => ({ ...f, page }))}
                      >
                        {page + 1}
                      </button>
                    ))}
                    <button
                      className="page-button"
                      type="button"
                      onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 0) + 1 }))}
                      disabled={currentPage === totalPages - 1}
                      aria-label="Pagina siguiente"
                    >
                      <UiIcon name="arrowRight" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </article>

        <div className="bottom-grid">
          <RisksPanel
            risks={risks}
            onOpenSeller={handleSellerSelect}
            onOpenCase={(caseId) => handleStartMediation(Number(caseId))}
          />
          <ImpactMediationsPanel
            mediations={impactMediations}
            onOpenSeller={handleSellerSelect}
            onOpenCase={(caseId) => handleReviewMediation(Number(caseId))}
          />
          <ResolvedCasesPanel
            cases={resolvedCases}
            onOpenSeller={handleSellerSelect}
          />
        </div>
      </section>

      <SellerDocumentsModal
        isOpen={docModalOpen}
        onClose={handleCloseSellerDocuments}
        seller={sellerDetailView || infoSeller}
        documents={sellerDocumentList}
      />

      <SellerProfileModal
        isOpen={sellerInfoOpen}
        onClose={() => {
          setSellerInfoOpen(false);
          setSelectedSellerId(null);
          setInfoSeller(null);
        }}
        seller={sellerDetailView || null}
        onOpenDocuments={handleOpenSellerDocuments}
        onOpenMediation={handleOpenSellerMediations}
        onSuspend={handleBlockAccount}
      />

      <SellerActiveMediationsModal
        isOpen={sellerMediationsOpen}
        onClose={handleCloseSellerMediations}
        seller={sellerDetailView || null}
      />
    </>
  );
}
