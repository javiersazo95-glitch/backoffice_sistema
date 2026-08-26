import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

type Props={alias?:string;region?:string;comuna?:string};

export default function CapturerHeader({alias,region,comuna}:Props){
 const [open,setOpen]=useState(false); const navigate=useNavigate(); const {logout}=useAuth();
 const go=(path:string)=>{setOpen(false);navigate(path);};
 async function exit(){setOpen(false);await logout();navigate('/login?type=capturer',{replace:true});}
 return <header style={header}>
  <div><strong style={{fontSize:22}}>RepuesTop Captadores</strong>{alias&&<div style={{opacity:.75}}>Hola, {alias}{comuna&&region?` · ${comuna}, ${region}`:''}</div>}</div>
  <div style={{position:'relative'}}>
   <button type="button" aria-label="Abrir menú de usuario" aria-expanded={open} onClick={()=>setOpen(v=>!v)} style={userButton}>
    <span style={avatar} aria-hidden="true"><UserIcon/></span><span style={{fontWeight:700}}>Mi cuenta</span><span aria-hidden="true">⌄</span>
   </button>
   {open&&<div role="menu" style={menu}>
    <button role="menuitem" type="button" onClick={()=>go('/captador/cuenta')} style={menuItem}><UserIcon/>Mis datos y cuenta</button>
    <button role="menuitem" type="button" onClick={()=>go('/captador/chats')} style={menuItem}><ChatIcon/>Chats</button>
    <button role="menuitem" type="button" onClick={()=>go('/captador/ayuda')} style={menuItem}><HelpIcon/>Ayuda</button>
    <button role="menuitem" type="button" onClick={()=>go('/captador/soporte')} style={menuItem}><SupportIcon/>Soporte</button>
    <div style={divider}/>
    <button role="menuitem" type="button" onClick={exit} style={{...menuItem,color:'#b42318'}}><LogoutIcon/>Cerrar sesión</button>
   </div>}
  </div>
 </header>;
}

export const UserIcon=()=> <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
export const ChatIcon=()=> <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-4.5-1L3 20l1.4-4.1A8.4 8.4 0 0 1 3 11.5a8.5 8.5 0 0 1 18 0Z"/></svg>;
export const HelpIcon=()=> <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.4 1.2-1.9 1.7-1.9 3.1"/><path d="M12 17h.01"/></svg>;
export const SupportIcon=()=> <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Z"/><path d="M20 14a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z"/><path d="M17 19c-1 1-2.3 1.5-4 1.5"/></svg>;
const LogoutIcon=()=> <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></svg>;
const header:React.CSSProperties={background:'linear-gradient(120deg,#071b4d,#0f55ce)',color:'#fff',padding:'18px max(24px,5vw)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:16};
const userButton:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:'7px 11px 7px 7px',border:'1px solid rgba(255,255,255,.35)',borderRadius:10,background:'rgba(255,255,255,.08)',color:'#fff',cursor:'pointer'};
const avatar:React.CSSProperties={display:'grid',placeItems:'center',width:30,height:30,borderRadius:'50%',background:'#fff',color:'#145be7'};
const menu:React.CSSProperties={position:'absolute',right:0,top:'calc(100% + 8px)',zIndex:20,width:235,padding:6,border:'1px solid #dbe4f0',borderRadius:12,background:'#fff',boxShadow:'0 15px 35px rgba(15,35,75,.22)'};
const menuItem:React.CSSProperties={width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 11px',border:0,borderRadius:8,background:'transparent',color:'#243b63',fontWeight:650,textAlign:'left',cursor:'pointer'};
const divider:React.CSSProperties={height:1,margin:'5px 3px',background:'#e2e8f0'};
