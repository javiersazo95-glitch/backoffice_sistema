import { useState } from 'react';
import { MediationStatus } from '@/types/mediation';
import { useIsMobile } from '@/hooks/useIsMobile';
import { FilterSheet, FilterTrigger } from '@/components/mobile';
import { countActiveFilters } from '@/utils/filters';

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
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelectChange = (value: string) => {
    onFilterChange(value, undefined);
  };

  const currentValue = blocked ? '' : status;

  if (isMobile) {
    const activeCount = countActiveFilters({ startDate, endDate, status: currentValue });
    return (
      <>
        <div className="mb-filter-row">
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar caso, comprador, tienda…"
            aria-label="Buscar mediaciones"
          />
          <FilterTrigger count={activeCount} onClick={() => setSheetOpen(true)} />
        </div>
        <FilterSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filtrar mediaciones"
          activeCount={activeCount}
          onClear={() => {
            onStartDateChange('');
            onEndDateChange('');
            onFilterChange('', undefined);
          }}
        >
          <label>
            Desde
            <input className="input" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
          </label>
          <label>
            Hasta
            <input className="input" type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
          </label>
          <label>
            Estado
            <select className="select" value={currentValue} onChange={(e) => handleSelectChange(e.target.value)}>
              <option value="">Todos</option>
              <option value={MediationStatus.EN_MEDIACION}>En mediación</option>
            </select>
          </label>
        </FilterSheet>
      </>
    );
  }

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
      </select>
    </div>
  );
}
