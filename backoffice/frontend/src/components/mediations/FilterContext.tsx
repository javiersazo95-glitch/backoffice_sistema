import UiIcon from '@/components/shared/UiIcon';
import { mediationStatusHelp } from '@/utils/formatters';

interface FilterContextProps {
  status: string;
}

export default function FilterContext({ status }: FilterContextProps) {
  const helpText = mediationStatusHelp(status || 'Todos');
  
  return (
    <div className="filter-context">
      <UiIcon name="shield" />
      {helpText}
    </div>
  );
}
