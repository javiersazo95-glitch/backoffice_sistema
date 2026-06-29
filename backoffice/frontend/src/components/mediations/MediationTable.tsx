import { MediationResponse } from '@/types/mediation';
import MediationTableRow from './MediationTableRow';

interface MediationTableProps {
  mediations: MediationResponse[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onOpenMediationCase: (id: number) => void;
  onOpenReactivation: (id: number) => void;
  onOpenSellerInfo: (sellerId: number) => void;
}

export default function MediationTable({
  mediations,
  selectedId,
  onSelect,
  onOpenMediationCase,
  onOpenReactivation,
  onOpenSellerInfo,
}: MediationTableProps) {
  return (
    <div className="table-wrap">
      <table className="wide-table active-mediations-table">
        <thead>
          <tr>
            <th>ID caso</th>
            <th>Comprador</th>
            <th>Tienda</th>
            <th>Pedido asociado</th>
            <th>Motivo</th>
            <th>Estado</th>
            <th className="mediation-actions-heading">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {mediations.length ? (
            mediations.map((item) => (
              <MediationTableRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={onSelect}
                onOpenMediationCase={onOpenMediationCase}
                onOpenReactivation={onOpenReactivation}
                onOpenSellerInfo={onOpenSellerInfo}
              />
            ))
          ) : (
            <tr>
              <td colSpan={7}>
                <span className="row-sub">No hay mediaciones que coincidan con la búsqueda.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
