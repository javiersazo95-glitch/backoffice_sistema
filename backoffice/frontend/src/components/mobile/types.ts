import type { RecordCardProps } from './RecordCard';

/** Convierte una fila de tabla en las props de una tarjeta movil. */
export type CardMapper<T> = (row: T) => RecordCardProps;
