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
export const listManagedCapturers=async()=> (await apiClient.get<CapturerProfile[]>('/backoffice/capturers')).data;
export const deactivateCapturer=async(id:number)=> (await apiClient.patch<CapturerProfile>(`/backoffice/capturers/${id}/deactivate`)).data;
export const reactivateCapturer=async(id:number)=> (await apiClient.patch<CapturerProfile>(`/backoffice/capturers/${id}/reactivate`)).data;
export const approveCapturer=async(id:number)=> (await apiClient.patch<CapturerProfile>(`/validations/capturers/${id}/approve`)).data;
export const rejectCapturer=async(id:number,motivo:string)=> (await apiClient.patch<CapturerProfile>(`/validations/capturers/${id}/reject`,{motivo})).data;
export const listServices=async()=> (await apiClient.get<AutomotiveServiceReview[]>('/validations/automotive-services')).data;
export const decideService=async(id:number,action:'approve'|'request-correction'|'reject',notas='')=> (await apiClient.patch<AutomotiveServiceReview>(`/validations/automotive-services/${id}/${action}`,action==='approve'?undefined:{notas})).data;
export async function downloadServiceDocument(id:number,tipo:string,nombre:string){const response=await apiClient.get(`/validations/automotive-services/${id}/documents/${tipo}`,{responseType:'blob'});const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=nombre||'documento';anchor.click();URL.revokeObjectURL(url);}
export const listCapturerWithdrawals=async()=> (await apiClient.get<CapturerWithdrawal[]>('/administration/capturer-withdrawals')).data;
export const payCapturerWithdrawal=async(id:number)=> (await apiClient.patch<CapturerWithdrawal>(`/administration/capturer-withdrawals/${id}/pay`)).data;
export const rejectCapturerWithdrawal=async(id:number,motivo:string)=> (await apiClient.patch<CapturerWithdrawal>(`/administration/capturer-withdrawals/${id}/reject`,{motivo})).data;
export const getCapturerConfig=async()=> (await apiClient.get<CapturerConfig>('/validations/capturers/config')).data;
export const saveCapturerConfig=async(data:CapturerConfig)=> (await apiClient.put<CapturerConfig>('/validations/capturers/config',data)).data;
export async function downloadCapturerReceipt(id:number,nombre:string){const response=await apiClient.get(`/administration/capturer-withdrawals/${id}/receipt`,{responseType:'blob'});const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=nombre||'boleta-captador.pdf';anchor.click();URL.revokeObjectURL(url);}
