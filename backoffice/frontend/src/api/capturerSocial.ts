import apiClient, { resolveProfileImageUrl } from './client';
import type {
  CapturedBuyersPage, CapturedBuyersQuery, SocialContenido, SocialSancion, VideoAdmin, VideoFiltros, VideoMetricas, SocialContenidoAdmin, SocialDescarga, SocialEstado, SocialFiltros,
  SocialMetricas, SocialNuevoContenido, SocialPagina, SocialResena, SocialRed,
} from '@/types/capturerSocial';

const BASE='/captadores/me/social';

export const getSocialEstado=async()=> (await apiClient.get<SocialEstado>(`${BASE}/estado`)).data;

export const listSocialContenidos=async(f:SocialFiltros,pagina:number,tamano=12)=> (await apiClient.get<SocialPagina<SocialContenido>>(`${BASE}/contenidos`,{
  params:{vista:f.vista,tipo:f.tipo||undefined,categoria:f.categoria||undefined,red:f.red||undefined,q:f.q?.trim()||undefined,orden:f.orden,soloNoDescargados:f.soloNoDescargados||undefined,pagina,tamano},
})).data;

/**
 * El archivo va como cuerpo binario (no multipart): el backend aplica su propio tope de 80MB
 * sin subir el límite global de multipart. Los metadatos viajan en X-Contenido-Meta.
 */
export async function uploadSocialContenido(file:Blob,meta:SocialNuevoContenido,onProgress?:(pct:number)=>void){
  const {data}=await apiClient.post<SocialContenido>(`${BASE}/contenidos`,file,{
    headers:{'Content-Type':file.type||'application/octet-stream','X-Contenido-Meta':encodeURIComponent(JSON.stringify(meta))},
    timeout:10*60_000,
    onUploadProgress:e=>{if(onProgress&&e.total)onProgress(Math.round((e.loaded/e.total)*100));},
  });
  return data;
}

export async function uploadSocialPoster(id:number,poster:Blob){
  const form=new FormData(); form.append('poster',poster,'portada.jpg');
  return (await apiClient.put<SocialContenido>(`${BASE}/contenidos/${id}/poster`,form,{headers:{'Content-Type':'multipart/form-data'}})).data;
}

export const editSocialContenido=async(id:number,d:{titulo:string;descripcion?:string;categoria:string;redes:SocialRed[];filtroVisual:string})=>
  (await apiClient.patch<SocialContenido>(`${BASE}/contenidos/${id}`,d)).data;

export const deleteSocialContenido=async(id:number)=>{await apiClient.delete(`${BASE}/contenidos/${id}`);};

export const registerSocialDescarga=async(id:number)=> (await apiClient.post<SocialDescarga>(`${BASE}/contenidos/${id}/descargas`)).data;

export const listSocialResenas=async(id:number)=> (await apiClient.get<SocialResena[]>(`${BASE}/contenidos/${id}/resenas`)).data;

export const saveSocialResena=async(id:number,d:{estrellas:number;resena?:string;redSocial?:string})=>
  (await apiClient.put<SocialResena>(`${BASE}/contenidos/${id}/resena`,d)).data;

/** URL servible: absoluta de R2 o el proxy del backend (/api/v1/uploads/r2/...). */
export const socialMediaUrl=(url:string|null|undefined)=>resolveProfileImageUrl(url)??'';

/**
 * Baja el archivo por la API autenticada (ya registrada la descarga) y lo guarda como
 * "RepuesTop_@alias_<id>.ext". No se usa el link público: el proxy lo sirve inline y el
 * navegador lo abría para reproducirlo en otra pestaña en vez de descargarlo.
 */
export async function saveSocialFile(id:number,nombre:string){
  const {data}=await apiClient.get<Blob>(`${BASE}/contenidos/${id}/archivo`,{responseType:'blob',timeout:5*60_000});
  const href=URL.createObjectURL(data);
  const a=document.createElement('a'); a.href=href; a.download=nombre; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(href),2_000);
}

// ---- Backoffice (Mediación y confianza) ----
export const getSocialMetricas=async(periodo?:string)=> (await apiClient.get<SocialMetricas>('/validations/capturers/social/metrics',{params:{periodo}})).data;
export const listSocialAdmin=async(params:{estado?:string;tipo?:string;q?:string;pagina:number;tamano:number})=>
  (await apiClient.get<SocialPagina<SocialContenidoAdmin>>('/validations/capturers/social/contents',{params:{...params,estado:params.estado||undefined,tipo:params.tipo||undefined,q:params.q?.trim()||undefined}})).data;
export const setSocialVisibilidad=async(id:number,accion:'OCULTAR'|'RESTAURAR',motivo?:string)=>
  (await apiClient.patch<SocialContenidoAdmin>(`/validations/capturers/social/contents/${id}/visibility`,{accion,motivo})).data;
// ---- Repositorio de videos ----
export const listVideosAdmin=async(f:VideoFiltros,pagina:number,tamano:number)=>
  (await apiClient.get<SocialPagina<VideoAdmin>>('/validations/capturers/social/videos',{params:{
    estado:f.estado||undefined,categoria:f.categoria||undefined,captadorId:f.captadorId??undefined,q:f.q.trim()||undefined,
    desde:f.desde||undefined,hasta:f.hasta||undefined,orden:f.orden,calificacionMax:f.calificacionMax??undefined,pagina,tamano,
  }})).data;
export const getVideoMetricas=async(desde?:string,hasta?:string)=>
  (await apiClient.get<VideoMetricas>('/validations/capturers/social/videos/metrics',{params:{desde:desde||undefined,hasta:hasta||undefined}})).data;
export const listSocialSanciones=async(captadorId:number)=> (await apiClient.get<SocialSancion[]>(`/validations/capturers/${captadorId}/social/sanctions`)).data;
/** Suspende al captador del repositorio por `dias`; con `vetarVideo` también veta la pieza `contenidoId`. */
export const sancionarCaptadorSocial=async(captadorId:number,d:{dias:number;motivo:string;contenidoId?:number;vetarVideo?:boolean})=>
  (await apiClient.post<SocialSancion>(`/validations/capturers/${captadorId}/social/sanctions`,d)).data;
export const levantarSancionSocial=async(id:number)=> (await apiClient.patch<SocialSancion>(`/validations/capturers/social/sanctions/${id}/lift`)).data;
/** Compradores referidos de un captador, paginados y filtrados en el servidor. */
export const getCapturedBuyers=async(id:number,p:CapturedBuyersQuery)=>
  (await apiClient.get<CapturedBuyersPage>(`/validations/capturers/${id}/captured-buyers`,{params:{...p,q:p.q?.trim()||undefined,compra:p.compra||undefined,canal:p.canal||undefined}})).data;
