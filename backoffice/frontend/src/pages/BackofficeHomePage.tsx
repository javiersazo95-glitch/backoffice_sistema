import { Link } from 'react-router-dom';
import MetricCard from '@/components/shared/MetricCard';
import UiIcon from '@/components/shared/UiIcon';

const areas = [
  {
    path: '/administracion',
    title: 'Administración Contable',
    description: 'Pedidos, liquidaciones, comisiones y gastos internos.',
    icon: 'wallet',
    tone: 'blue' as const,
  },
  {
    path: '/soporte',
    title: 'Soporte',
    description: 'Base lista para tickets, bandejas, macros y SLA.',
    icon: 'message',
    tone: 'amber' as const,
  },
  {
    path: '/confianza',
    title: 'Gestión de Confianza',
    description: 'Vendedores, validaciones, mediaciones, alertas y bitácora.',
    icon: 'scale',
    tone: 'green' as const,
  },
];

export default function BackofficeHomePage() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Backoffice RepuesTop</h1>
          <p>Un solo sistema interno para operar las tres áreas después del inicio de sesión.</p>
        </div>
      </div>

      <div className="metric-grid compact">
        <MetricCard label="Áreas operativas" value={3} tone="blue" description="Administración, Soporte y Confianza" iconName="dashboard" />
        <MetricCard label="Acceso" value="Protegido" tone="green" description="Disponible solo con credenciales" iconName="lock" />
        <MetricCard label="Stack" value="React + Spring" tone="violet" description="Monorepo frontend/backend" iconName="document" />
        <MetricCard label="Soporte" value="Base" tone="amber" description="Listo para implementar" iconName="message" />
      </div>

      <section className="area-grid" aria-label="Áreas del backoffice">
        {areas.map((area) => (
          <Link className="area-card" to={area.path} key={area.path}>
            <span className={`status-icon ${area.tone}`}><UiIcon name={area.icon} /></span>
            <div>
              <strong>{area.title}</strong>
              <p>{area.description}</p>
            </div>
            <UiIcon name="arrowRight" />
          </Link>
        ))}
      </section>
    </>
  );
}
