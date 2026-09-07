export interface SystemFeedbackResponse {
  id: number;
  usuarioId: number;
  usuarioNombre: string;
  usuarioRol: string;
  usuarioPerfilUrl: string | null;
  calificacion: number;
  comentario: string;
  aprobado: boolean;
  fechaCreacion: string;
}
