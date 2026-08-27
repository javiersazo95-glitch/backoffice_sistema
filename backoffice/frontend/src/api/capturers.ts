import apiClient from './client';
import type { CapturerDashboard,CapturerProfile,CapturerRanking,CapturerWithdrawal,AutomotiveServiceReview,CapturerConfig,CapturerChat,CapturerChatMessage,CapturedBusinesses } from '@/types/capturer';
export const getStatus=async()=> (await apiClient.get<CapturerProfile>('/captadores/me/status')).data;
export const getDashboard=async()=> (await apiClient.get<CapturerDashboard>('/captadores/me/dashboard')).data;
export const getRanking=async(modalidad:string,periodo:string)=> (await apiClient.get<CapturerRanking>('/captadores/me/ranking',{params:{modalidad,periodo}})).data;
export const getChats=async()=> (await apiClient.get<CapturerChat[]>('/captadores/me/chats')).data;
export const getChatMessages=async(id:number)=> (await apiClient.get<CapturerChatMessage[]>(`/captadores/me/chats/${id}/messages`)).data;
export const sendChatMessage=async(id:number,mensaje:string)=> (await apiClient.post<CapturerChatMessage>(`/captadores/me/chats/${id}/messages`,{mensaje})).data;
export async function uploadProfilePhoto(file:File){const form=new FormData();form.append('file',file);return (await apiClient.post<{userProfileUrl:string}>('/users/perfil/foto',form,{headers:{'Content-Type':'multipart/form-data'}})).data;}
export const saveBank=async(data:Record<string,unknown>)=> (await apiClient.put<CapturerProfile>('/captadores/me/bank',data)).data;
export async function requestWithdrawal(monto:number,boleta:File){const form=new FormData();form.append('boleta',boleta);return (await apiClient.post<CapturerWithdrawal>('/captadores/me/withdrawals',form,{params:{monto},headers:{'Content-Type':'multipart/form-data'}})).data;}
export const listCapturers=async()=> (await apiClient.get<CapturerProfile[]>('/validations/capturers')).data;
export const getCapturedBusinesses=async(id:number,periodo?:string)=> (await apiClient.get<CapturedBusinesses>(`/validations/capturers/${id}/captured-businesses`,{params:{periodo}})).data;
export const getAdminCapturerRanking=async(id:number,modalidad:string,periodo:string)=> (await apiClient.get<CapturerRanking>(`/validations/capturers/${id}/ranking`,{params:{modalidad,periodo}})).data;

async function getValidationDocument(path:string):Promise<Blob>{
  const response=await apiClient.get<Blob>(path,{responseType:'blob'});
  return response.data;
}

function saveDocument(blob:Blob,nombre:string){
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=nombre||'documento';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1_000);
}

async function previewDocument(path:string){
  const preview=window.open('','_blank');
  if(!preview) throw new Error('El navegador bloqueó la vista previa. Habilita las ventanas emergentes e inténtalo nuevamente.');

  preview.opener=null;
  preview.document.title='Cargando documento';
  preview.document.body.textContent='Cargando documento…';
  try{
    const blob=await getValidationDocument(path);
    const url=URL.createObjectURL(blob);
    preview.location.replace(url);
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
  }catch(error){
    preview.close();
    throw error;
  }
}

export async function viewCapturerDocument(id:number,tipo:string){return previewDocument(`/validations/capturers/${id}/documents/${tipo}`);}
export async function downloadCapturerDocument(id:number,tipo:string,nombre:string){saveDocument(await getValidationDocument(`/validations/capturers/${id}/documents/${tipo}`),nombre);}
export const listManagedCapturers=async()=> (await apiClient.get<CapturerProfile[]>('/backoffice/capturers',{params:{includeDeleted:false}})).data;
export const deactivateCapturer=async(id:number)=> (await apiClient.patch<CapturerProfile>(`/backoffice/capturers/${id}/deactivate`)).data;
export const reactivateCapturer=async(id:number)=> (await apiClient.patch<CapturerProfile>(`/backoffice/capturers/${id}/reactivate`)).data;
export const approveCapturer=async(id:number)=> (await apiClient.patch<CapturerProfile>(`/validations/capturers/${id}/approve`)).data;
export const rejectCapturer=async(id:number,motivo:string)=> (await apiClient.patch<CapturerProfile>(`/validations/capturers/${id}/reject`,{motivo})).data;
export const listServices=async()=> (await apiClient.get<AutomotiveServiceReview[]>('/validations/automotive-services')).data;
export const decideService=async(id:number,action:'approve'|'request-correction'|'reject',notas='')=> (await apiClient.patch<AutomotiveServiceReview>(`/validations/automotive-services/${id}/${action}`,action==='approve'?undefined:{notas})).data;
export async function viewServiceDocument(id:number,tipo:string){return previewDocument(`/validations/automotive-services/${id}/documents/${tipo}`);}
export async function downloadServiceDocument(id:number,tipo:string,nombre:string){saveDocument(await getValidationDocument(`/validations/automotive-services/${id}/documents/${tipo}`),nombre);}
export const listCapturerWithdrawals=async()=> (await apiClient.get<CapturerWithdrawal[]>('/administration/capturer-withdrawals')).data;
export const payCapturerWithdrawal=async(id:number)=> (await apiClient.patch<CapturerWithdrawal>(`/administration/capturer-withdrawals/${id}/pay`)).data;
export const rejectCapturerWithdrawal=async(id:number,motivo:string)=> (await apiClient.patch<CapturerWithdrawal>(`/administration/capturer-withdrawals/${id}/reject`,{motivo})).data;
export const getCapturerConfig=async()=> (await apiClient.get<CapturerConfig>('/validations/capturers/config')).data;
// Config del programa visible para el propio captador (mismos valores que administra
// Confianza y Mediación). Se usa para que las tarjetas informativas del portal reflejen
// siempre la configuración vigente de puntaje y comisiones.
export const getCapturerProgramConfig=async()=> (await apiClient.get<CapturerConfig>('/captadores/me/config')).data;
export const saveCapturerConfig=async(data:CapturerConfig)=> (await apiClient.put<CapturerConfig>('/validations/capturers/config',data)).data;
export async function downloadCapturerReceipt(id:number,nombre:string){const response=await apiClient.get(`/administration/capturer-withdrawals/${id}/receipt`,{responseType:'blob'});const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=nombre||'boleta-captador.pdf';anchor.click();URL.revokeObjectURL(url);}
