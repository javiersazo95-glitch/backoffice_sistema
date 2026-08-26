import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '@/api/capturers';
import CapturerLayout from './CapturerLayout';

export default function CapturerPageShell({children}:{children:ReactNode}){
 const status=useQuery({queryKey:['capturer-status'],queryFn:api.getStatus});
 return <CapturerLayout alias={status.data?.alias} region={status.data?.region} comuna={status.data?.comuna}>{children}</CapturerLayout>;
}
export const pagePanel:React.CSSProperties={background:'#fff',border:'1px solid #e6edf7',borderRadius:16,padding:20,boxShadow:'0 8px 24px rgba(11,37,89,.05)'};
export const pageControl:React.CSSProperties={width:'100%',boxSizing:'border-box',padding:'10px 12px',border:'1px solid #d7e0ee',borderRadius:10,background:'#fff',fontSize:13.5,color:'#0b2559'};
export const pagePrimary:React.CSSProperties={padding:'11px 16px',border:0,borderRadius:11,background:'#1657d9',color:'#fff',fontWeight:700,cursor:'pointer'};
