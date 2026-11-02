import apiClient from './client';
import type { RegisterContactRequest, TrackedContact, TrackedProfiles, TrackedPublication, TrackingKind } from '@/types/tracking';

export async function getTrackedPublications(kind: TrackingKind): Promise<TrackedPublication[]> {
  const response = await apiClient.get<TrackedPublication[]>(`/validations/seguimiento/${kind}`);
  return response.data;
}

/** Perfiles avisados de una publicacion, con quienes ya respondieron y quienes faltan por llamar. */
export async function getTrackedProfiles(kind: TrackingKind, id: number): Promise<TrackedProfiles> {
  const response = await apiClient.get<TrackedProfiles>(`/validations/seguimiento/${kind}/${id}/perfiles`);
  return response.data;
}

/** Quita la marca de notificado de un perfil en una publicación (por si se marcó por error). */
export async function unmarkNotified(kind: TrackingKind, publicationId: number, profileId: number): Promise<void> {
  await apiClient.delete(`/validations/seguimiento/contactos/${kind === 'fallas' ? 'FALLA' : 'NECESIDAD'}/${publicationId}/${profileId}`);
}

/** Historial de contactos del equipo con un perfil (id de la cuenta), el más reciente primero. */
export async function getContactHistory(perfilId: number): Promise<TrackedContact[]> {
  const response = await apiClient.get<TrackedContact[]>(`/validations/seguimiento/contactos/${perfilId}`);
  return response.data;
}

export async function registerContact(request: RegisterContactRequest): Promise<TrackedContact> {
  const response = await apiClient.post<TrackedContact>('/validations/seguimiento/contactos', request);
  return response.data;
}
