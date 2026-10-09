import { useQueryClient } from '@tanstack/react-query';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import UiIcon from '@/components/shared/UiIcon';
import SituacionTributariaPanel from './SituacionTributariaPanel';

/**
 * Confianza → Cumplimiento tributario: la bandeja de la situacion tributaria de las tiendas
 * (reverificacion de enero y julio, certificados por revisar, historial y nomina RUT;DV).
 * 9-oct: paso de Administracion Contable a Confianza, que aprueba las tiendas. La alerta diaria de
 * las 08:10 trae aqui. Las notas de credito siguen en Administracion Contable → Cumplimiento SII.
 */
export default function CumplimientoTributarioPage() {
  const queryClient = useQueryClient();

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Cumplimiento tributario</h1>
          <p>Situación tributaria de las tiendas ante el SII: verificación semestral, certificados y declaración de IVA.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" title="Actualizar datos"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['admin-tax-status'] });
              void queryClient.invalidateQueries({ queryKey: ['admin-pending-certificates'] });
            }}>
            <UiIcon name="refresh" /> Actualizar
          </button>
          <AreaHomeShortcut />
        </div>
      </div>
      <SituacionTributariaPanel />
    </>
  );
}
