import { useEffect,useRef,useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation,useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import CapturerAvatar from '@/components/capturers/CapturerAvatar';

type Alert={label:string;detail:string;to:string};
type Props={alias?:string;region?:string;comuna?:string;fotoPerfil?:string|null;alerts?:Alert[];children:ReactNode};

const navItems:Array<{to:string;label:string;icon:ReactNode}>=[
 {to:'/captador',label:'Resumen',icon:<HomeIcon/>},
 {to:'/captador/comisiones',label:'Comisiones',icon:<MoneyIcon/>},
 {to:'/captador/ranking',label:'Ranking',icon:<TrophyIcon/>},
 {to:'/captador/redes-sociales',label:'Redes sociales',icon:<SocialIcon/>},
 {to:'/captador/retiros',label:'Retiros y banco',icon:<BankIcon/>},
 {to:'/captador/cuenta',label:'Mi cuenta',icon:<UserIcon/>},
];

export default function CapturerLayout({alias,region,comuna,fotoPerfil,alerts=[],children}:Props){
 const navigate=useNavigate(); const {pathname}=useLocation(); const {logout}=useAuth();
 const [menu,setMenu]=useState(false); const [bell,setBell]=useState(false); const [drawer,setDrawer]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{function onClick(e:MouseEvent){if(!root.current?.contains(e.target as Node)){setMenu(false);setBell(false);}}document.addEventListener('mousedown',onClick);return()=>document.removeEventListener('mousedown',onClick);},[]);
 const go=(to:string)=>{setMenu(false);setBell(false);setDrawer(false);navigate(to);};
 async function exit(){setMenu(false);await logout();navigate('/login?type=capturer',{replace:true});}
 return <div className="cap-root" ref={root}>
  <style>{css}</style>
  <aside className={drawer?'cap-side cap-side-open':'cap-side'}>
   <div className="cap-brand"><img src="/assets/repuestop-captadores.jpg" alt="RepuesTop"/></div>
   <nav aria-label="Secciones del portal de captadores" className="cap-nav">
    {navItems.map(item=>{const active=item.to==='/captador'?pathname==='/captador':pathname.startsWith(item.to);
     return <button type="button" key={item.to} onClick={()=>go(item.to)} aria-current={active?'page':undefined} className={active?'cap-nav-item cap-nav-item-active':'cap-nav-item'}>{item.icon}<span>{item.label}</span></button>;})}
   </nav>
   <div className="cap-help">
    <strong>¿Necesitas ayuda?</strong>
    <p>Revisa las preguntas frecuentes o escríbele al equipo RepuesTop.</p>
    <div className="cap-help-actions">
     <button type="button" onClick={()=>go('/captador/ayuda')} className="cap-help-ghost">Ayuda</button>
     <button type="button" onClick={()=>go('/captador/soporte')} className="cap-help-cta"><SupportIcon/>Soporte</button>
    </div>
   </div>
  </aside>
  {drawer&&<button type="button" aria-label="Cerrar menú" className="cap-scrim" onClick={()=>setDrawer(false)}/>}
  <div className="cap-main">
   <header className="cap-top">
    <button type="button" aria-label="Abrir menú de navegación" className="cap-burger" onClick={()=>setDrawer(true)}><BurgerIcon/></button>
    <div className="cap-hello">
     <h1>Hola, {alias||'captador'} <span aria-hidden="true">👋</span></h1>
     {(comuna||region)&&<p><PinIcon/>{[comuna,region].filter(Boolean).join(', ')}</p>}
    </div>
    <div className="cap-top-actions">
     <div className="cap-pop-wrap">
      <button type="button" aria-label="Notificaciones" aria-expanded={bell} className="cap-bell" onClick={()=>{setBell(v=>!v);setMenu(false);}}>
       <BellIcon/>{alerts.length>0&&<span className="cap-badge">{alerts.length}</span>}
      </button>
      {bell&&<div className="cap-pop" role="menu">
       <span className="cap-pop-title">Notificaciones</span>
       {alerts.length?alerts.map(a=><button role="menuitem" type="button" key={a.label} className="cap-pop-item" onClick={()=>go(a.to)}><strong>{a.label}</strong><small>{a.detail}</small></button>):<p className="cap-pop-empty">No tienes avisos pendientes.</p>}
      </div>}
     </div>
     <div className="cap-pop-wrap">
      <button type="button" aria-label="Abrir menú de usuario" aria-expanded={menu} className="cap-user" onClick={()=>{setMenu(v=>!v);setBell(false);}}>
       <CapturerAvatar className="cap-avatar" nombre={alias} fotoPerfil={fotoPerfil}/>
       <span className="cap-user-text"><strong>{alias||'Captador'}</strong><small>Captador</small></span>
       <ChevronIcon/>
      </button>
      {menu&&<div className="cap-pop cap-pop-right" role="menu">
       <button role="menuitem" type="button" className="cap-menu-item" onClick={()=>go('/captador/cuenta')}><UserIcon/>Mis datos y cuenta</button>
       <button role="menuitem" type="button" className="cap-menu-item" onClick={()=>go('/captador/chats')}><ChatIcon/>Chats</button>
       <button role="menuitem" type="button" className="cap-menu-item" onClick={()=>go('/captador/ayuda')}><HelpIcon/>Ayuda</button>
       <button role="menuitem" type="button" className="cap-menu-item" onClick={()=>go('/captador/soporte')}><SupportIcon/>Soporte</button>
       <div className="cap-menu-divider"/>
       <button role="menuitem" type="button" className="cap-menu-item cap-menu-danger" onClick={exit}><LogoutIcon/>Cerrar sesión</button>
      </div>}
     </div>
    </div>
   </header>
   <div className="cap-content">{children}</div>
  </div>
 </div>;
}

function HomeIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>;}
function MoneyIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.2A2.7 2.7 0 0 0 12 8c-1.4 0-2.5.8-2.5 2s1.1 2 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.7 2.7 0 0 1-2.5-1.2"/><path d="M12 6.4V8M12 16v1.6"/></svg>;}
function SocialIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2.5v9L17 14"/><path d="m8.5 9.5 4 2.5-4 2.5Z"/></svg>;}
function TrophyIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5a2.5 2.5 0 0 1-2.5 4"/><path d="M12 14v3M9 20h6"/></svg>;}
function BankIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18"/></svg>;}
function BellIcon(){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"/><path d="M10.5 18a1.8 1.8 0 0 0 3 0"/></svg>;}
function PinIcon(){return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;}
function ChevronIcon(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;}
function BurgerIcon(){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;}
export function UserIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;}
export function ChatIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-4.5-1L3 20l1.4-4.1A8.4 8.4 0 0 1 3 11.5a8.5 8.5 0 0 1 18 0Z"/></svg>;}
export function HelpIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.4 1.2-1.9 1.7-1.9 3.1"/><path d="M12 17h.01"/></svg>;}
export function SupportIcon(){return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Z"/><path d="M20 14a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z"/><path d="M17 19c-1 1-2.3 1.5-4 1.5"/></svg>;}
function LogoutIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></svg>;}

const css=`
.cap-root{--cap-ink:#0b2559;--cap-muted:#64748b;--cap-line:#e6edf7;--cap-blue:#1657d9;--cap-bg:#f4f7fb;min-height:100vh;display:grid;grid-template-columns:230px minmax(0,1fr);background:var(--cap-bg);font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--cap-ink)}
.cap-root *{box-sizing:border-box}
.cap-side{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:18px;padding:20px 14px;background:linear-gradient(180deg,#0a1f52,#0a1a41);color:#fff;z-index:40}
.cap-brand{display:flex;justify-content:center;align-items:center;padding:12px 14px;border-radius:14px;background:#fff;box-shadow:0 6px 16px rgba(4,14,38,.28)}
.cap-brand img{height:46px;width:auto;object-fit:contain}
.cap-nav{display:grid;gap:4px}
.cap-nav-item{display:flex;align-items:center;gap:11px;width:100%;padding:12px 13px;border:0;border-radius:11px;background:transparent;color:#a8bbdf;font:inherit;font-size:14.5px;font-weight:600;text-align:left;cursor:pointer;transition:background .15s,color .15s}
.cap-nav-item:hover{background:rgba(255,255,255,.08);color:#fff}
.cap-nav-item-active{background:#1c62e8;color:#fff;box-shadow:0 8px 18px rgba(28,98,232,.35)}
.cap-help{margin-top:auto;padding:14px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.cap-help strong{display:block;font-size:14px}
.cap-help p{margin:6px 0 12px;font-size:12.5px;line-height:1.45;color:#a8bbdf}
.cap-help-actions{display:flex;gap:8px}
.cap-help-ghost,.cap-help-cta{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 8px;border-radius:9px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.cap-help-ghost{border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff}
.cap-help-cta{border:0;background:#22b455;color:#fff}
.cap-scrim{display:none;position:fixed;inset:0;z-index:35;border:0;background:rgba(6,18,45,.45)}
.cap-main{min-width:0;display:flex;flex-direction:column}
.cap-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:14px;padding:14px max(18px,2.2vw);background:#fff;border-bottom:1px solid var(--cap-line)}
.cap-burger{display:none;padding:8px;border:1px solid var(--cap-line);border-radius:10px;background:#fff;color:var(--cap-ink);cursor:pointer}
.cap-hello{min-width:0;flex:1}
.cap-hello h1{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em}
.cap-hello p{display:flex;align-items:center;gap:5px;margin:3px 0 0;font-size:13px;color:var(--cap-muted)}
.cap-top-actions{display:flex;align-items:center;gap:10px}
.cap-pop-wrap{position:relative}
.cap-bell{position:relative;display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--cap-line);border-radius:12px;background:#fff;color:#31456e;cursor:pointer}
.cap-bell:hover{background:#f4f7fb}
.cap-badge{position:absolute;top:-6px;right:-6px;min-width:19px;height:19px;padding:0 5px;display:grid;place-items:center;border-radius:999px;background:#e11d48;color:#fff;font-size:11px;font-weight:800}
.cap-user{display:flex;align-items:center;gap:9px;padding:5px 10px 5px 5px;border:1px solid var(--cap-line);border-radius:12px;background:#fff;color:var(--cap-ink);font:inherit;cursor:pointer}
.cap-user:hover{background:#f4f7fb}
.cap-avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:linear-gradient(140deg,#0a1f52,#1c62e8);color:#fff;font-weight:800;overflow:hidden;flex:0 0 auto}
.cap-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.cap-user-text{display:grid;text-align:left;line-height:1.15}
.cap-user-text strong{font-size:13.5px}
.cap-user-text small{font-size:11.5px;color:var(--cap-muted)}
.cap-pop{position:absolute;right:0;top:calc(100% + 9px);z-index:50;width:265px;padding:7px;border:1px solid var(--cap-line);border-radius:14px;background:#fff;box-shadow:0 18px 40px rgba(11,37,89,.18)}
.cap-pop-title{display:block;padding:8px 10px 6px;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--cap-muted)}
.cap-pop-item{display:grid;gap:2px;width:100%;padding:9px 10px;border:0;border-radius:9px;background:transparent;font:inherit;text-align:left;color:var(--cap-ink);cursor:pointer}
.cap-pop-item:hover{background:#f1f6ff}
.cap-pop-item small{color:var(--cap-muted);font-size:12px}
.cap-pop-empty{margin:4px 10px 10px;font-size:13px;color:var(--cap-muted)}
.cap-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 11px;border:0;border-radius:9px;background:transparent;font:inherit;font-weight:650;text-align:left;color:#243b63;cursor:pointer}
.cap-menu-item:hover{background:#f1f6ff}
.cap-menu-danger{color:#b42318}
.cap-menu-divider{height:1px;margin:5px 3px;background:var(--cap-line)}
.cap-content{padding:20px max(18px,2.2vw) 36px}
@media (max-width:1000px){
 .cap-root{grid-template-columns:minmax(0,1fr)}
 .cap-side{position:fixed;left:0;top:0;width:250px;transform:translateX(-100%);transition:transform .2s ease}
 .cap-side-open{transform:none;box-shadow:0 0 60px rgba(6,18,45,.4)}
 .cap-scrim{display:block}
 .cap-burger{display:grid;place-items:center}
 .cap-user-text{display:none}
 .cap-hello h1{font-size:16.5px}
 .cap-hello p{font-size:12px}
 .cap-top{padding:12px 16px;gap:10px}
}
`;
