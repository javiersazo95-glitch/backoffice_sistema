/** Falla automotriz (respuestas = diagnosticos de talleres) o necesidad de compra (respuestas = ofertas de tiendas). */
export interface TrackedPublication {
  id: number;
  titulo: string;
  vehiculo?: string;
  comuna?: string;
  region?: string;
  autorNombre: string;
  autorTelefono?: string;
  estado: string;
  vigente: boolean;
  createdAt: string;
  venceEn?: string;
  /** Perfiles dentro del alcance de la publicación. */
  avisados: number;
  /** De ésos, los que cumplen lo que pide la publicación (categoría, marca...). */
  calzan: number;
  respuestas: number;
  notificados: number;
  /** Calzan, no respondieron y nadie los ha marcado como notificados. */
  porNotificar: number;
}

export interface TrackedProfile {
  id: number;
  nombre: string;
  responsable?: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
  direccion?: string;
  horario?: string;
  comuna?: string;
  registradoEn?: string;
  /** El sistema cree que le interesa, y por qué. */
  calza: boolean;
  motivos: string[];
  respondio: boolean;
  respondioEn?: string;
  /** Marca (tick) de que ya se le avisó de esta publicación. */
  notificado: boolean;
  notificadoEn?: string;
  /** Contactos del equipo con este perfil y el más reciente. */
  contactos: number;
  ultimoContacto?: TrackedContact | null;
}

export interface TrackedProfiles {
  publicacion: TrackedPublication;
  perfiles: TrackedProfile[];
}

export type TrackingKind = 'fallas' | 'necesidades';

export type ContactResult = 'NOTIFICADO' | 'CONTACTADO' | 'COMPROMETIO' | 'NO_CONTESTA' | 'NO_INTERESADO';

/** Un contacto del equipo con un perfil (llamada o mensaje) y lo que respondió. */
export interface TrackedContact {
  id: number;
  resultado: ContactResult;
  nota?: string;
  responsable?: string;
  /** yyyy-MM-dd */
  proximoContacto?: string;
  publicacionTipo?: string;
  publicacionId?: number;
  createdAt: string;
}

export interface RegisterContactRequest {
  perfilId: number;
  publicacionTipo?: 'FALLA' | 'NECESIDAD';
  publicacionId?: number;
  resultado: ContactResult;
  nota?: string;
  proximoContacto?: string;
}
