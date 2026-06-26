import { useEffect, useState } from 'react';
import { MediationStatus } from '@/types/mediation';

const STORAGE_KEY = 'repuestop.manual-mediation-status-overrides';
const SYNC_EVENT = 'repuestop:manual-mediation-status-overrides-changed';

export type ManualMediationStatusOverrides = Record<number, MediationStatus>;

export function normalizeVisibleMediationStatus(status: MediationStatus): MediationStatus {
  return status === MediationStatus.ESCALADO ? MediationStatus.ESPERANDO_VENDEDOR : status;
}

function readOverrides(): ManualMediationStatusOverrides {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, MediationStatus>;
    return Object.fromEntries(
      Object.entries(parsed).map(([id, status]) => [Number(id), status]),
    );
  } catch {
    return {};
  }
}

function writeOverrides(overrides: ManualMediationStatusOverrides) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function applyManualMediationStatus<T extends { id: number; status: MediationStatus }>(
  item: T,
  overrides: ManualMediationStatusOverrides,
): T {
  const status = normalizeVisibleMediationStatus(overrides[item.id] ?? item.status);
  return status === item.status ? item : { ...item, status };
}

export function applyManualMediationStatusToActiveCases<T extends { id: number; status: MediationStatus }>(
  item: T,
  overrides: ManualMediationStatusOverrides,
): T {
  if (item.status !== MediationStatus.EN_MEDIACION && item.status !== MediationStatus.ESPERANDO_VENDEDOR) {
    return item;
  }

  return applyManualMediationStatus(item, overrides);
}

export function useManualMediationStatusOverrides() {
  const [overrides, setOverrides] = useState<ManualMediationStatusOverrides>(() => readOverrides());

  useEffect(() => {
    const sync = () => setOverrides(readOverrides());
    window.addEventListener('storage', sync);
    window.addEventListener(SYNC_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SYNC_EVENT, sync);
    };
  }, []);

  const setOverride = (id: number, status: MediationStatus) => {
    setOverrides((current) => {
      const next = { ...current, [id]: status };
      writeOverrides(next);
      return next;
    });
  };

  return [overrides, setOverride] as const;
}
