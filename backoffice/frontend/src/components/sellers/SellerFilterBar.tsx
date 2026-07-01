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
        placeholder="Buscar por tienda, RUT, ciudad o dueño..."
      />
      <label className="seller-filter-date-label">
        <span>Desde</span>
        <input
          className="input"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          aria-label="Fecha inicio"
        />
      </label>
      <label className="seller-filter-date-label">
        <span>Hasta</span>
        <input
          className="input"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          aria-label="Fecha fin"
        />
      </label>
      <select
        className="select"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Estado del vendedor"
      >
        <option value="Todos">Todos los vendedores</option>
        <option value="En disputa">En disputa</option>
        <option value="En mediación">En mediación</option>
      </select>
    </div>
  );
}
