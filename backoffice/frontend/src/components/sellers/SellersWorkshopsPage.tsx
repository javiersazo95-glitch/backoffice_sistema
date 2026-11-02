import { useSearchParams } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';
import WorkshopsPage from '@/components/workshops/WorkshopsPage';
import SellersPage from './SellersPage';

type Tab = 'vendedores' | 'talleres';

/** Menú "Vendedores y talleres" de Gestión de Confianza: dos pestañas, la de vendedores de siempre y la de talleres. */
export default function SellersWorkshopsPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'talleres' ? 'talleres' : 'vendedores';

  const select = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'vendedores') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  return (
    <>
      <nav className="module-tabs" aria-label="Vendedores y talleres">
        <button type="button" className={tab === 'vendedores' ? 'active' : ''} onClick={() => select('vendedores')} aria-pressed={tab === 'vendedores'}>
          <UiIcon name="store" />
          Vendedores
        </button>
        <button type="button" className={tab === 'talleres' ? 'active' : ''} onClick={() => select('talleres')} aria-pressed={tab === 'talleres'}>
          <UiIcon name="settings" />
          Talleres
        </button>
      </nav>
      {tab === 'talleres' ? <WorkshopsPage /> : <SellersPage />}
    </>
  );
}
