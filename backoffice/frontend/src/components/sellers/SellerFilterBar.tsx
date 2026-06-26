interface SellerFilterBarProps {
  search: string;
  startDate: string;
  endDate: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export default function SellerFilterBar({
  search,
  startDate,
  endDate,
  status,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onStatusChange,
}: SellerFilterBarProps) {
  return (
    <div className="seller-filter-bar">
      <input
        className="input"
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por tienda, RUT o ciudad..."
      />
      <input
        className="input"
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        aria-label="Fecha inicio"
      />
      <input
        className="input"
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        aria-label="Fecha fin"
      />
      <select
        className="select"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Tipo de mediación"
      >
        <option value="Todos">Todos</option>
        <option value="Mediación">Mediación</option>
        <option value="Esperando al vendedor">Esperando al vendedor</option>
      </select>
    </div>
  );
}
