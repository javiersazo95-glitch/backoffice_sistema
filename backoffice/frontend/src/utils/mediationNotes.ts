export type MediationNoteType =
  | 'seguimiento'
  | 'observacion'
  | 'advertencia'
  | 'pendiente'
  | 'contacto-realizado';

export interface MediationNoteTypeOption {
  value: MediationNoteType;
  label: string;
  icon: string;
  tone: 'blue' | 'violet' | 'amber' | 'orange' | 'green';
}

export const mediationNoteTypeOptions: MediationNoteTypeOption[] = [
  { value: 'seguimiento', label: 'Seguimiento', icon: 'note', tone: 'violet' },
  { value: 'observacion', label: 'Observación', icon: 'message', tone: 'blue' },
  { value: 'advertencia', label: 'Advertencia', icon: 'alert', tone: 'orange' },
  { value: 'pendiente', label: 'Pendiente', icon: 'clock', tone: 'amber' },
  { value: 'contacto-realizado', label: 'Contacto realizado', icon: 'phone', tone: 'green' },
];

export function mediationNoteTypeLabel(type?: string | null) {
  const option = mediationNoteTypeOptions.find((item) => item.value === type);
  return option?.label ?? 'Seguimiento';
}

export function mediationNoteTypeTone(type?: string | null): MediationNoteTypeOption['tone'] {
  return mediationNoteTypeOptions.find((item) => item.value === type)?.tone ?? 'violet';
}

export function mediationNoteTypeIcon(type?: string | null) {
  return mediationNoteTypeOptions.find((item) => item.value === type)?.icon ?? 'note';
}

