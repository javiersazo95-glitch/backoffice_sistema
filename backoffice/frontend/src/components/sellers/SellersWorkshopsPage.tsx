import { useSearchParams } from 'react-router-dom';
import UiIcon from '@/components/shared/UiIcon';
import WorkshopsPage from '@/components/workshops/WorkshopsPage';
import WorkshopReferralsTab from '@/components/workshops/WorkshopReferralsTab';
import SellersPage from './SellersPage';

type Tab = 'vendedores' | 'talleres' | 'referidos';

/**
 * Menú "Vendedores y talleres" de Gestión de Confianza: la pestaña de vendedores de siempre, la de talleres y la de referidos
 * (seguimiento de la captación de compradores por los talleres).
 */
export default function SellersWorkshopsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = requested === 'talleres' || requested === 'referidos' ? requested : 'vendedores';

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
        <button type="button" className={tab === 'referidos' ? 'active' : ''} onClick={() => select('referidos')} aria-pressed={tab === 'referidos'}>
          <UiIcon name="users" />
          Referidos
        </button>
      </nav>
      {tab === 'referidos' ? <WorkshopReferralsTab /> : tab === 'talleres' ? <WorkshopsPage /> : <SellersPage />}
    </>
  );
}
