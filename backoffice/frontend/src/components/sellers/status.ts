import { SellerStatus } from '@/types/seller';

export type SellerOperationalStatus =
  | SellerStatus.APROBADO
  | SellerStatus.POR_CORREGIR
  | SellerStatus.RECHAZADO;

interface SellerStatusSource {
  status: SellerStatus | string;
  mediationCount?: number;
  activeMediationCount?: number;
}

export function getSellerOperationalStatus(seller: SellerStatusSource): SellerOperationalStatus {
  return seller.status as SellerOperationalStatus;
}

export function getSellerStatusLabel(status: SellerOperationalStatus): string {
  const labels: Record<SellerOperationalStatus, string> = {
    [SellerStatus.APROBADO]: 'Aprobado',
    [SellerStatus.POR_CORREGIR]: 'Por corregir',
    [SellerStatus.RECHAZADO]: 'Rechazado',
  };

  return labels[status];
}

export function getSellerStatusTone(status: SellerOperationalStatus): string {
  if (status === SellerStatus.APROBADO) return 'green';
  if (status === SellerStatus.POR_CORREGIR) return 'orange';
  return 'red';
}
