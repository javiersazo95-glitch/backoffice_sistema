import type { ReactNode } from 'react';
import { useFlag } from '@/hooks/useRemoteConfig';

/**
 * Pinta a sus hijos solo si el feature flag está encendido (contrato del Mantenedor común,
 * sección 6: `<Feature flag fallback>`). Sin bootstrap, manda `fallback` (por convención `true`),
 * así un build viejo o un backend caído dejan todo visible como hoy.
 */
export default function Feature({ flag, fallback = true, children }: { flag: string; fallback?: boolean; children: ReactNode }) {
  const visible = useFlag(flag, fallback);
  return visible ? <>{children}</> : null;
}
