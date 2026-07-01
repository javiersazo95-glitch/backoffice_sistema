import { MediationStatus } from '@/types/mediation';

interface MediationFilterBarProps {
  search: string;
  startDate: string;
  endDate: string;
  status: string;
  blocked: boolean | undefined;
  onSearchChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onFilterChange: (status: string, blocked: boolean | undefined) => void;
}

export default function MediationFilterBar({
  search,
  startDate,
  endDate,
  status,
  blocked,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onFilterChange,
}: MediationFilterBarProps) {
  const handleSelectChange = (value: string) => {
    onFilterChange(value, undefined);
  };

  const currentValue = blocked ? '' : status;

  return (
    <div className="module-filter-bar mediation-filter-bar">
      <input
        className="input"
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por ID caso, comprador, vendedor..."
      />
      <input
        className="input"
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        aria-label="Fecha inicio"
        title="Fecha inicio"
      />
      <input
        className="input"
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        aria-label="Fecha fin"
        title="Fecha fin"
      />
      <select
        className="select"
        value={currentValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        aria-label="Estado de mediación"
      >
        <option value="">Todos</option>
        <option value={MediationStatus.EN_MEDIACION}>En mediación</option>
        <option value={MediationStatus.ESPERANDO_VENDEDOR}>En disputa</option>
      </select>
    </div>
  );
}
