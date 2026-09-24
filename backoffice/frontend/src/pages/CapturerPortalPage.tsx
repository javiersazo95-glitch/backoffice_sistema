import { useEffect,useMemo,useRef,useState } from 'react';
import { formatRut, validateRut } from '@/utils/rut';
import type { ReactNode } from 'react';
import { Navigate,useLocation,useNavigate } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/capturers';
import { resolveProfileImageUrl } from '@/api/client';
import { formatCurrency } from '@/utils/formatters';
import type { CapturerConfig,CapturerDashboard,CapturerMovement } from '@/types/capturer';
import { DEFAULT_CAPTURER_CONFIG } from '@/types/capturer';
import { BANCOS_BCI,TIPO_CUENTA_OPTIONS } from '@/modules/administration/constants';
import CapturerLayout from '@/components/capturer/CapturerLayout';

// Los datos bancarios del captador se solicitan igual que los de un socio para el
// retiro de dinero: RUT, titular, banco (con código BCI), tipo y número de cuenta.
type BankForm={rut:string;titular:string;banco:string;bankCode:number|null;tipoCuenta:string;numeroCuenta:string;email:string};
const emptyBank:BankForm={rut:'',titular:'',banco:'',bankCode:null,tipoCuenta:'',numeroCuenta:'',email:''};
type Level={name:string;min:number;next:number};
const levels:Level[]=[{name:'Bronce',min:0,next:2500},{name:'Plata',min:2500,next:10000},{name:'Oro',min:10000,next:0}];
const baseLevel:Level=levels[0]!;
/** Web de compradores: el link `?ref=CODIGO` precarga el código del captador en el registro. */
const MARKET_URL=(import.meta.env.VITE_MARKET_URL as string|undefined)?.replace(/\/+$/,'')||'https://repuestop.cl';
export const buyerReferralLink=(codigo?:string|null)=>codigo?`${MARKET_URL}/?ref=${encodeURIComponent(codigo)}`:'';

export default function CapturerPortalPage(){
 const qc=useQueryClient(); const navigate=useNavigate(); const {pathname}=useLocation();
 const section=pathname.startsWith('/captador/comisiones')?'COMISIONES':pathname.startsWith('/captador/ranking')?'RANKING':pathname.startsWith('/captador/retiros')?'FINANZAS':'RESUMEN';
 const [mode,setMode]=useState<'REGIONAL'|'GLOBAL'>('GLOBAL');
 const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));
 const [estadoFiltro,setEstadoFiltro]=useState('TODOS');
 const [bank,setBank]=useState<BankForm>(emptyBank); const bankHydrated=useRef(false);
 const [amount,setAmount]=useState(''); const [receipt,setReceipt]=useState<File|null>(null);
 const [message,setMessage]=useState(''); const [copied,setCopied]=useState(false); const [linkCopied,setLinkCopied]=useState(false);

 const status=useQuery({queryKey:['capturer-status'],queryFn:api.getStatus});
 const approved=status.data?.estado==='APROBADO';
 const dashboard=useQuery({queryKey:['capturer-dashboard'],queryFn:api.getDashboard,enabled:approved,refetchInterval:approved?30000:false});
 const ranking=useQuery({queryKey:['capturer-ranking',mode,period],queryFn:()=>api.getRanking(mode,period),enabled:approved,refetchInterval:approved?30000:false});
 const programConfig=useQuery({queryKey:['capturer-program-config'],queryFn:api.getCapturerProgramConfig,enabled:approved,retry:false,refetchInterval:approved?60000:false,refetchOnWindowFocus:true});
 const cfg:CapturerConfig=programConfig.data??DEFAULT_CAPTURER_CONFIG;
 const d=dashboard.data;

 // Precarga los datos bancarios ya guardados (una sola vez) para que el captador
 // los revise en vez de volver a escribirlos.
 useEffect(()=>{
  if(bankHydrated.current)return;
  const b=d?.datosBancarios;
  if(!b)return;
  bankHydrated.current=true;
  setBank({rut:b.rut||'',titular:b.titular||'',banco:b.banco||'',bankCode:b.bankCode??null,tipoCuenta:b.tipoCuenta||'',numeroCuenta:b.numeroCuenta||'',email:b.email||''});
 },[d]);

 const alerts=useMemo(()=>{
  if(!d)return [];
  const list=[] as Array<{label:string;detail:string;to:string}>;
  const pendientes=d.movimientos.filter(m=>m.estado==='PENDIENTE').length;
  const retirosEnRevision=d.retiros.filter(r=>r.estado==='PENDIENTE'||r.estado==='EN_REVISION').length;
  if(pendientes)list.push({label:`${pendientes} comisión(es) pendiente(s)`,detail:'Aún no se confirman para retiro.',to:'/captador/comisiones'});
  if(retirosEnRevision)list.push({label:`${retirosEnRevision} retiro(s) en revisión`,detail:'Administración Contable está revisando tu solicitud.',to:'/captador/retiros'});
  if(d.disponible>0)list.push({label:`${formatCurrency(d.disponible)} disponibles`,detail:'Puedes solicitar tu retiro.',to:'/captador/retiros'});
  return list;
 },[d]);

 if(status.isLoading)return <State title="Cargando tu cuenta…"/>;
 if(!status.data)return <State title="No encontramos tu perfil"/>;
 if(!approved)return <Navigate to="/captador/estado" replace/>;

 async function saveBank(e:React.FormEvent){
  e.preventDefault(); setMessage('');
  // H16: misma regla que el backend (CuentaBancariaValidator): RUT con digito verificador valido y
  // cuenta solo con digitos. Se avisa antes de enviar; el servidor lo vuelve a exigir.
  if(!validateRut(bank.rut)){setMessage('El RUT del titular no es válido. Revisa el número y el dígito verificador.');return;}
  if(!/^\d{6,20}$/.test(bank.numeroCuenta.trim())){setMessage('El número de cuenta debe tener solo dígitos (6 a 20).');return;}
  try{await api.saveBank({...bank,rut:bank.rut.trim(),titular:bank.titular.trim(),numeroCuenta:bank.numeroCuenta.trim(),email:bank.email.trim()});setMessage('Datos bancarios guardados.');await qc.invalidateQueries({queryKey:['capturer-dashboard']});}
  catch(err:any){setMessage(err.response?.data?.message||'No se pudieron guardar los datos.');}
 }
 async function withdraw(e:React.FormEvent){
  e.preventDefault(); if(!receipt)return; setMessage('');
  try{await api.requestWithdrawal(Number(amount),receipt);setAmount('');setReceipt(null);await qc.invalidateQueries({queryKey:['capturer-dashboard']});setMessage('Solicitud enviada a Administración Contable.');}
  catch(err:any){setMessage(err.response?.data?.message||'No se pudo solicitar el retiro.');}
 }
 function copyCode(){
  navigator.clipboard.writeText(d?.perfil.codigoReferido||'');
  setCopied(true); window.setTimeout(()=>setCopied(false),2200);
 }
 function copyBuyerLink(){
  navigator.clipboard.writeText(buyerReferralLink(d?.perfil.codigoReferido));
  setLinkCopied(true); window.setTimeout(()=>setLinkCopied(false),2200);
 }

 const body=!d?<article className="cap-card cap-loading">Preparando tus métricas…</article>:
  section==='RESUMEN'?<Resumen d={d} cfg={cfg} ranking={ranking.data} copied={copied} onCopy={copyCode} linkCopied={linkCopied} onCopyLink={copyBuyerLink} onGo={to=>navigate(to)}/>:
  section==='COMISIONES'?<Comisiones d={d} estado={estadoFiltro} onEstado={setEstadoFiltro}/>:
  section==='RANKING'?<Ranking d={d} data={ranking.data} loading={ranking.isLoading} mode={mode} onMode={setMode} period={period} onPeriod={setPeriod}/>:
  <Finanzas d={d} bank={bank} onBank={setBank} amount={amount} onAmount={setAmount} receipt={receipt} onReceipt={setReceipt} onSaveBank={saveBank} onWithdraw={withdraw}/>;

 return <CapturerLayout alias={d?.perfil.alias||status.data.alias} comuna={d?.perfil.comuna||status.data.comuna} region={d?.perfil.region||status.data.region} fotoPerfil={d?.perfil.fotoPerfil||status.data.fotoPerfil} alerts={alerts}>
  <style>{css}</style>
  {message&&<div className="cap-flash">{message}<button type="button" aria-label="Cerrar aviso" onClick={()=>setMessage('')}>×</button></div>}
  {body}
 </CapturerLayout>;
}

/* ---------------- Resumen ---------------- */
function fmtPct(v:number){return `${(Math.round(v*1000)/10).toLocaleString('es-CL')}%`;}
function Resumen({d,cfg,ranking,copied,onCopy,linkCopied,onCopyLink,onGo}:{d:CapturerDashboard;cfg:CapturerConfig;ranking?:{posicionPropia:number;posiciones:Array<{alias:string;puntos:number;propio:boolean}>};copied:boolean;onCopy:()=>void;linkCopied:boolean;onCopyLink:()=>void;onGo:(to:string)=>void}){
 const casaPct=fmtPct(cfg.comisionCasa);
 const compPct=fmtPct(cfg.comisionComprador??0.01);
 const pubPct=fmtPct(cfg.comisionPublicidad);
 const puntos=ranking?.posiciones.find(r=>r.propio)?.puntos??0;
 const level:Level=levels.find(l=>l.next===0||puntos<l.next)||baseLevel;
 const progress=level.next?Math.min(100,Math.round((puntos/level.next)*100)):100;
 const siguiente=levels[levels.findIndex(l=>l.name===level.name)+1]?.name||'';
 const posicion=ranking?.posicionPropia||0;
 const total=ranking?.posiciones.length||0;
 const topPct=posicion&&total&&posicion<=total?Math.min(100,Math.max(1,Math.ceil((posicion/total)*100))):null;
 const aliento=!puntos?'Suma tus primeros puntos captando negocios':posicion&&posicion<=3?'¡Estás en el podio, sigue así! 🏆':'Vas muy bien, sigue así 👏';
 const captaciones=d.casasAprobadas+d.serviciosAprobados;
 const conversion=captaciones?Math.round((d.conversiones/captaciones)*1000)/10:0;
 return <div className="cap-layout">
  <div className="cap-col">
   <section className="cap-hero">
    <article className="cap-card cap-referral">
     <span className="cap-eyebrow">Tu código de referido</span>
     <strong className="cap-code">{d.perfil.codigoReferido||'—'}</strong>
     <p className="cap-muted">Compártelo con casas, talleres y compradores: lo ingresan en “Código de captador” al crear su cuenta.</p>
     <button type="button" className="cap-primary cap-copy" onClick={onCopy}><CopyIcon/>{copied?'¡Código copiado!':'Copiar código'}</button>
     <span className="cap-eyebrow" style={{marginTop:4}}>Link para compradores</span>
     <div className="cap-link"><LinkIcon/><span>{buyerReferralLink(d.perfil.codigoReferido)||'Sin código asignado'}</span></div>
     <button type="button" className="cap-ghost" onClick={onCopyLink} disabled={!d.perfil.codigoReferido}>{linkCopied?'¡Link copiado!':'Copiar link para compradores'}</button>
    </article>
    <div className="cap-metrics">
     <Metric tone="green" icon={<MoneyIcon/>} label="Ganancia total" value={formatCurrency(d.total)} foot="Comisiones acumuladas"/>
     <Metric tone="blue" icon={<StoreIcon/>} label="Ganancia por casas" value={formatCurrency(d.casas)} foot={`${casaPct} por cada casa`}/>
     <Metric tone="violet" icon={<WrenchIcon/>} label="Ganancia por servicios" value={formatCurrency(d.publicidad)} foot={`${pubPct} por publicidad vendida`}/>
     <Metric tone="green" icon={<UsersIcon/>} label="Ganancia por compradores" value={formatCurrency(d.compradores??0)} foot={`${compPct} de cada compra`}/>
     <Metric tone="blue" icon={<UsersIcon/>} label="Compradores captados" value={String(d.compradoresCaptados??0)} foot={`${d.compradoresConvertidos??0} ya compraron`}/>
     <Metric tone="amber" icon={<ClockIcon/>} label="Pendiente por pagar" value={formatCurrency(d.pendiente)} foot="En revisión y pendientes"/>
     <Metric tone="green" icon={<CheckIcon/>} label="Disponible para retiro" value={formatCurrency(d.disponible)} foot="Listo para solicitar"/>
     <Metric tone="blue" icon={<CheckIcon/>} label="Pagado" value={formatCurrency(d.pagado)} foot="Comisiones ya pagadas"/>
     <Metric tone="blue" icon={<StoreIcon/>} label="Casas captadas" value={String(d.casasAprobadas)} foot="Aprobadas"/>
     <Metric tone="violet" icon={<WrenchIcon/>} label="Servicios captados" value={String(d.serviciosAprobados)} foot="Aprobados"/>
     <Metric tone="amber" icon={<UsersIcon/>} label="Conversiones" value={String(d.conversiones)} foot="Negocios que ya compraron"/>
    </div>
   </section>

   <section className="cap-card">
    <h2 className="cap-h2">Tu embudo de captaciones</h2>
    <div className="cap-funnel">
     <FunnelStep icon={<UsersIcon/>} label="Captaciones" value={captaciones} tone="blue"/>
     <span className="cap-arrow" aria-hidden="true">→</span>
     <FunnelStep icon={<StoreIcon/>} label="Casas aprobadas" value={d.casasAprobadas} tone="green"/>
     <span className="cap-arrow" aria-hidden="true">→</span>
     <FunnelStep icon={<WrenchIcon/>} label="Servicios aprobados" value={d.serviciosAprobados} tone="violet"/>
     <span className="cap-arrow" aria-hidden="true">→</span>
     <FunnelStep icon={<CheckIcon/>} label="Conversiones" value={d.conversiones} tone="amber"/>
     <div className="cap-funnel-rate"><span className="cap-eyebrow">Conversión</span><strong>{conversion}%</strong></div>
    </div>
   </section>

   <section className="cap-card">
    <div className="cap-card-head">
     <h2 className="cap-h2">Movimientos de comisiones</h2>
     <button type="button" className="cap-ghost" onClick={()=>onGo('/captador/comisiones')}>Ver todos</button>
    </div>
    <MovementsTable rows={d.movimientos.slice(0,5)}/>
   </section>
  </div>

  <aside className="cap-rail">
   <section className="cap-howto">
    <div className="cap-howto-head"><h2>Cómo ganas comisiones</h2><span className="cap-howto-info" aria-hidden="true"><InfoIcon/></span></div>
    <div className="cap-howto-item">
     <span className="cap-howto-icon"><StoreIcon/></span>
     <div><strong>{casaPct} por cada<br/>casa de repuesto captada</strong><p>Cuando una casa es aprobada, ganas el {casaPct} de la venta estimada.</p></div>
    </div>
    <div className="cap-howto-item">
     <span className="cap-howto-icon"><WrenchIcon/></span>
     <div><strong>{pubPct} por publicidad<br/>vendida a talleres y servicios</strong><p>Por cada compra de fichas RepuesTop que hagan los talleres o servicios automotrices.</p></div>
    </div>
    <div className="cap-howto-item">
     <span className="cap-howto-icon"><UsersIcon/></span>
     <div><strong>{compPct} de cada compra<br/>de tus compradores</strong><p>Cuando un comprador se registra con tu código, ganas el {compPct} de cada compra que haga (sin envío) y sumas {cfg.puntosCompradorConvertido ?? 2} pts con su primera compra.</p></div>
    </div>
    <div className="cap-howto-item">
     <span className="cap-howto-icon"><StarIcon/></span>
     <div><strong>{cfg.puntosCasaAprobada.toLocaleString('es-CL')} pts por casa y {cfg.puntosServicioPrimeraCompra.toLocaleString('es-CL')} pts por servicio</strong><p>Sumas puntos para el ranking por cada captación aprobada. Cada punto equivale a {formatCurrency(cfg.pesosPorPunto)}.</p></div>
    </div>
   </section>

   <section className="cap-card cap-perf">
    <div className="cap-perf-head"><h2>Tu desempeño este mes</h2><button type="button" className="cap-link-btn" onClick={()=>onGo('/captador/ranking')}>Ver ranking</button></div>
    <div className="cap-perf-row">
     <span className={`cap-perf-badge cap-level-${level.name.toLowerCase()}`}><MedalIcon/></span>
     <div className="cap-perf-name"><strong>Nivel {level.name}</strong><small>{aliento}</small></div>
     <div className="cap-perf-pos">
      <span>Posición</span>
      <strong>{posicion?`${posicion}°`:'—'}</strong>
      {topPct!==null&&<small>Top {topPct}%</small>}
     </div>
    </div>
    <div className="cap-perf-goal"><span>{level.next?`Para nivel ${siguiente}`:'Nivel máximo'}</span><span>{level.next?`Faltan ${(level.next-puntos).toLocaleString('es-CL')} pts`:'¡Lo lograste!'}</span></div>
    <div className="cap-progress"><div style={{width:`${progress}%`}}/></div>
    <small className="cap-perf-total">{puntos.toLocaleString('es-CL')}{level.next?` / ${level.next.toLocaleString('es-CL')}`:''} pts</small>
   </section>

   <section className="cap-card">
    <div className="cap-card-head"><span className="cap-eyebrow">Últimos movimientos</span><button type="button" className="cap-link-btn" onClick={()=>onGo('/captador/comisiones')}>Ver todos</button></div>
    <div className="cap-feed">
     {d.movimientos.length?d.movimientos.slice(0,4).map(m=>{
      const negocio=(m.negocioNombre||'').trim()||m.descripcion;
      return (
       <div className="cap-feed-item" key={m.id}>
        <span className="cap-feed-avatar">{(negocio||'?').charAt(0).toUpperCase()}</span>
        <div><strong>{negocio}</strong><small className="cap-muted">{tipoLabel(m.tipo)} {m.descripcion&&m.descripcion!==negocio?`· ${m.descripcion}`:''} · {new Date(m.fecha).toLocaleDateString('es-CL')}</small></div>
        <Badge estado={m.estado}/>
       </div>
      );
     }):<p className="cap-empty">Aún no registras movimientos.</p>}
    </div>
   </section>
  </aside>
 </div>;
}

/* ---------------- Comisiones ---------------- */
function Comisiones({d,estado,onEstado}:{d:CapturerDashboard;estado:string;onEstado:(v:string)=>void}){
 const estados=useMemo(()=>Array.from(new Set(d.movimientos.map(m=>m.estado))),[d.movimientos]);
 const rows=estado==='TODOS'?d.movimientos:d.movimientos.filter(m=>m.estado===estado);
 const totalFiltrado=rows.reduce((acc,m)=>acc+Number(m.montoComision||0),0);
 return <div className="cap-col">
  <section className="cap-metrics cap-metrics-wide">
   <Metric tone="green" icon={<MoneyIcon/>} label="Ganancia total" value={formatCurrency(d.total)} foot="Todas tus comisiones"/>
   <Metric tone="amber" icon={<ClockIcon/>} label="Pendiente por pagar" value={formatCurrency(d.pendiente)} foot="En revisión y pendientes"/>
   <Metric tone="blue" icon={<CheckIcon/>} label="Disponible" value={formatCurrency(d.disponible)} foot="Listo para retirar"/>
   <Metric tone="violet" icon={<CheckIcon/>} label="Pagado" value={formatCurrency(d.pagado)} foot="Ya transferido"/>
  </section>
  <section className="cap-card">
   <div className="cap-card-head">
    <div><h2 className="cap-h2">Movimientos de comisiones</h2><p className="cap-muted cap-sub">Detalle de cada comisión generada por tus captaciones.</p></div>
    <div className="cap-filters">
     <select className="cap-control" value={estado} onChange={e=>onEstado(e.target.value)} aria-label="Filtrar por estado">
      <option value="TODOS">Todos los estados</option>
      {estados.map(s=><option key={s} value={s}>{estadoLabel(s)}</option>)}
     </select>
    </div>
   </div>
   <MovementsTable rows={rows}/>
   <div className="cap-table-foot"><span>Mostrando {rows.length} de {d.movimientos.length} movimientos</span><strong>Total filtrado: {formatCurrency(totalFiltrado)}</strong></div>
  </section>
 </div>;
}

/* ---------------- Ranking ---------------- */
type RankRow={posicion:number;alias:string;region:string;puntos:number;propio:boolean;fotoPerfil?:string|null};
const rankColors=['#1462e8','#07845a','#7040d7','#ef3e75','#0f766e','#b45309'];
function Ranking({d,data,loading,mode,onMode,period,onPeriod}:{d:CapturerDashboard;data?:{posicionPropia:number;posiciones:RankRow[]};loading:boolean;mode:'REGIONAL'|'GLOBAL';onMode:(v:'REGIONAL'|'GLOBAL')=>void;period:string;onPeriod:(v:string)=>void}){
 const [search,setSearch]=useState('');
 const [regionF,setRegionF]=useState('TODAS');
 const [order,setOrder]=useState('POSICION');
 const [perPage,setPerPage]=useState(10);
 const [page,setPage]=useState(1);
 const rows=data?.posiciones??[];
 const own=rows.find(r=>r.propio);
 const puntos=own?.puntos??0;
 const posicion=data?.posicionPropia||own?.posicion||0;
 const total=rows.length;
 const topPct=posicion&&total&&posicion<=total?Math.min(100,Math.max(1,Math.ceil((posicion/total)*100))):null;
 const lider=rows[0];
 const level:Level=levels.find(l=>l.next===0||puntos<l.next)||baseLevel;
 const siguienteNivel=levels[levels.findIndex(l=>l.name===level.name)+1]?.name||'';
 const progress=level.next?Math.min(100,Math.round((puntos/level.next)*100)):100;
 const alLider=lider&&own?Math.max(0,lider.puntos-own.puntos):0;
 const arriba=posicion>1?rows.find(r=>r.posicion===posicion-1):undefined;
 const regions=useMemo(()=>[...new Set(rows.map(r=>r.region))].sort((a,b)=>a.localeCompare(b,'es')),[rows]);
 const misRegion=rows.filter(r=>r.region===d.perfil.region).length;
 const captaciones=d.casasAprobadas+d.serviciosAprobados;

 const filtered=useMemo(()=>{
  const text=search.trim().toLowerCase();
  const list=rows.filter(r=>(regionF==='TODAS'||r.region===regionF)&&(!text||`${r.alias} ${r.region}`.toLowerCase().includes(text)));
  const sorted=[...list];
  if(order==='PUNTOS')sorted.sort((a,b)=>b.puntos-a.puntos);
  else if(order==='ALIAS')sorted.sort((a,b)=>a.alias.localeCompare(b.alias,'es'));
  else sorted.sort((a,b)=>a.posicion-b.posicion);
  return sorted;
 },[rows,search,regionF,order]);

 const pages=Math.max(1,Math.ceil(filtered.length/perPage));
 useEffect(()=>{setPage(1);},[search,regionF,order,perPage,mode,period]);
 const current=page>pages?pages:page;
 const visibles=filtered.slice((current-1)*perPage,current*perPage);
 const desde=filtered.length?(current-1)*perPage+1:0;
 const hasta=Math.min(current*perPage,filtered.length);

 return <div className="cap-rk">
  <header className="cap-page-head">
   <h1>Ranking de captadores</h1>
   <p>Compite con otros captadores {mode==='REGIONAL'?'de tu región':'de todo el país'} y sigue tu avance de puntos.</p>
  </header>

  <section className="cap-rk-insights">
   <span className="cap-rk-insights-title">Insights de tu competencia</span>
   <RkInsight tone="blue" icon={<CrownIcon/>} title="Líder del ranking" value={lider?`@${lider.alias}${lider.propio?' (tú)':''}`:'—'} foot={lider?`${lider.puntos.toLocaleString('es-CL')} puntos`:'Sin datos'}/>
   <RkInsight tone="green" icon={<TrendIcon/>} title={arriba?'Para subir un puesto':'Tu ventaja'} value={arriba?`+${Math.max(0,arriba.puntos-puntos+1).toLocaleString('es-CL')} pts`:'Estás 1°'} foot={arriba?`Superar a @${arriba.alias}`:'Nadie por delante'}/>
   <RkInsight tone="violet" icon={<TargetIcon/>} title="Distancia al líder" value={lider&&!lider.propio&&alLider>0?`${alLider.toLocaleString('es-CL')} pts`:'Eres el líder'} foot={topPct?`Estás en el top ${topPct}%`:'Sin posición asignada'}/>
   <RkInsight tone="amber" icon={<PinAltIcon/>} title="Tu región" value={d.perfil.region} foot={`${misRegion} captador(es) compitiendo`}/>
  </section>

  <section className="cap-rk-stats">
   <RkStat tone="blue" icon={<TrophyIcon/>} label="Tu posición" value={posicion?`#${posicion}`:'—'} foot={total?`de ${total} captadores`:'Sin participantes'}/>
   <RkStat tone="violet" icon={<StarIcon/>} label="Tus puntos" value={puntos.toLocaleString('es-CL')} foot="Puntos acumulados"/>
   <RkStat tone="amber" icon={<ShieldIcon/>} label="Tu nivel" value={level.name} foot={level.next?`${progress}% hacia ${siguienteNivel}`:'Nivel máximo'}/>
   <RkStat tone="green" icon={<UsersIcon/>} label="Tus captaciones" value={String(captaciones)} foot={`${d.casasAprobadas} casas · ${d.serviciosAprobados} servicios`}/>
   <RkStat tone="blue" icon={<MoneyIcon/>} label="Tu ganancia total" value={formatCurrency(d.total)} foot="Comisiones acumuladas"/>
  </section>

  <section className="cap-rk-filters">
   <label className="cap-rk-search">
    <SearchIcon/>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por alias o región..."/>
   </label>
   <RkSelect label="Modalidad" value={mode} onChange={v=>onMode(v as 'REGIONAL'|'GLOBAL')} opts={[['REGIONAL','Regional'],['GLOBAL','Global']]}/>
   <RkSelect label="Período" value={period} onChange={onPeriod} opts={[[new Date().toISOString().slice(0,7),'Mes actual'],['HISTORICO','Histórico']]}/>
   <RkSelect label="Región" value={regionF} onChange={setRegionF} opts={[['TODAS','Todas'],...regions.map((r):[string,string]=>[r,r])]}/>
   <RkSelect label="Ordenar por" value={order} onChange={setOrder} opts={[['POSICION','Mejor posición'],['PUNTOS','Más puntos'],['ALIAS','Alias A-Z']]}/>
   <button type="button" className="cap-rk-reset" title="Limpiar filtros" aria-label="Limpiar filtros"
    onClick={()=>{setSearch('');setRegionF('TODAS');setOrder('POSICION');}}><FilterIcon/></button>
  </section>

  <section className="cap-rk-table-card">
   <div className="cap-table-wrap">
    <table className="cap-table cap-rk-table">
     <thead><tr><th>Posición</th><th>Captador</th><th>Región</th><th className="cap-right">Puntos</th><th className="cap-right">Diferencia contigo</th></tr></thead>
     <tbody>
      {loading?<tr><td colSpan={5} className="cap-empty-cell">Cargando ranking…</td></tr>:
       visibles.length?visibles.map(r=>{
        const dif=r.puntos-puntos;
        return <tr key={`${r.alias}-${r.posicion}`} className={r.propio?'cap-row-own':''}>
         <td>
          <span className={`cap-rk-pos${r.posicion<=3?' cap-rk-pos-top':''}`}>
           {r.posicion<=3&&<span aria-hidden="true">{['🥇','🥈','🥉'][r.posicion-1]}</span>}#{r.posicion}
          </span>
         </td>
         <td>
          <div className="cap-rk-person">
           <span className="cap-rk-avatar" style={{background:rankColors[r.posicion%rankColors.length]}}>{resolveProfileImageUrl(r.fotoPerfil)?<img src={resolveProfileImageUrl(r.fotoPerfil)??undefined} alt="" onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>:r.alias.charAt(0).toUpperCase()}</span>
           <div><strong>@{r.alias}</strong>{r.propio&&<span className="cap-rk-you">Tú</span>}</div>
          </div>
         </td>
         <td>{r.region}</td>
         <td className="cap-right"><strong>{r.puntos.toLocaleString('es-CL')}</strong></td>
         <td className="cap-right">{r.propio?<span className="cap-muted">—</span>:<span className={dif>0?'cap-dif cap-dif-up':dif<0?'cap-dif cap-dif-down':'cap-dif'}>{dif>0?'+':''}{dif.toLocaleString('es-CL')}</span>}</td>
        </tr>;
       }):<tr><td colSpan={5} className="cap-empty-cell">Todavía no hay participantes para este período.</td></tr>}
     </tbody>
    </table>
   </div>
   <footer className="cap-rk-foot">
    <span>Mostrando {desde} a {hasta} de {filtered.length} captadores</span>
    <div className="cap-rk-pager">
     <label className="cap-rk-perpage">
      <select value={perPage} onChange={e=>setPerPage(Number(e.target.value))} aria-label="Filas por página">
       {[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}
      </select>
      por página
     </label>
     <button type="button" disabled={current===1} onClick={()=>setPage(current-1)} aria-label="Página anterior">‹</button>
     {pageList(current,pages).map((p,i)=>p==='…'
      ?<span key={`gap${i}`} className="cap-rk-gap">…</span>
      :<button type="button" key={p} className={p===current?'cap-rk-page cap-rk-page-on':'cap-rk-page'} onClick={()=>setPage(Number(p))}>{p}</button>)}
     <button type="button" disabled={current===pages} onClick={()=>setPage(current+1)} aria-label="Página siguiente">›</button>
    </div>
   </footer>
  </section>
 </div>;
}
function RkStat({icon,label,value,foot,tone}:{icon:ReactNode;label:string;value:string;foot:string;tone:'blue'|'green'|'violet'|'amber'}){
 return <article className="cap-card cap-rk-stat">
  <span className={`cap-metric-icon cap-tone-${tone}`}>{icon}</span>
  <div><span className="cap-rk-stat-label">{label}</span><strong className="cap-rk-stat-value">{value}</strong><small className="cap-rk-stat-foot">{foot}</small></div>
 </article>;
}
function RkInsight({icon,title,value,foot,tone}:{icon:ReactNode;title:string;value:string;foot:string;tone:'blue'|'green'|'violet'|'amber'}){
 return <div className={`cap-rk-insight cap-rk-insight-${tone}`}>
  <span className={`cap-metric-icon cap-tone-${tone}`}>{icon}</span>
  <div><small>{title}</small><strong>{value}</strong><small>{foot}</small></div>
 </div>;
}
function RkSelect({label,value,onChange,opts}:{label:string;value:string;onChange:(v:string)=>void;opts:Array<[string,string]>}){
 return <label className="cap-rk-field"><small>{label}</small>
  <select value={value} onChange={e=>onChange(e.target.value)}>{opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
 </label>;
}
function pageList(current:number,pages:number):Array<number|'…'>{
 if(pages<=5)return Array.from({length:pages},(_,i)=>i+1);
 const set=new Set<number>([1,2,3,current,pages]);
 if(current>3){set.add(current-1);set.add(current+1);}
 const nums=[...set].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b);
 const out:Array<number|'…'>=[];
 nums.forEach((n,i)=>{if(i&&n-(nums[i-1] as number)>1)out.push('…');out.push(n);});
 return out;
}

/* ---------------- Retiros y banco ---------------- */
const bankRequired:Array<keyof BankForm>=['rut','titular','banco','tipoCuenta','numeroCuenta'];
function Finanzas({d,bank,onBank,amount,onAmount,receipt,onReceipt,onSaveBank,onWithdraw}:{d:CapturerDashboard;bank:BankForm;onBank:(v:BankForm|((b:BankForm)=>BankForm))=>void;amount:string;onAmount:(v:string)=>void;receipt:File|null;onReceipt:(f:File|null)=>void;onSaveBank:(e:React.FormEvent)=>void;onWithdraw:(e:React.FormEvent)=>void}){
 const set=(patch:Partial<BankForm>)=>onBank(b=>({...b,...patch}));
 const bankComplete=bankRequired.every(k=>String(bank[k]??'').trim().length>0);
 const solicitudEnCurso=d.retiros.find(r=>r.estado==='PENDIENTE'||r.estado==='EN_REVISION');
 const guardado=d.datosBancarios;
 const cuentaGuardadaCompleta=!!guardado&&!!guardado.rut&&!!guardado.banco&&!!guardado.numeroCuenta;
 const montoNum=Number(amount);
 const montoInvalido=amount!==''&&(!Number.isFinite(montoNum)||montoNum<=0||montoNum>d.disponible);
 return <div className="cap-col">
  <header className="cap-fin-head">
   <div>
    <h1>Retiro y banco</h1>
    <p>Registra la cuenta donde recibes tus comisiones y solicita el retiro de tu saldo disponible.</p>
   </div>
   <span className={`cap-fin-status ${cuentaGuardadaCompleta?'ok':'pending'}`}>
    {cuentaGuardadaCompleta?<CheckIcon/>:<InfoIcon/>}
    {cuentaGuardadaCompleta?'Cuenta bancaria verificada':'Cuenta bancaria incompleta'}
   </span>
  </header>

  <section className="cap-metrics cap-metrics-wide">
   <Metric tone="green" icon={<MoneyIcon/>} label="Disponible para retiro" value={formatCurrency(d.disponible)} foot="Saldo confirmado"/>
   <Metric tone="amber" icon={<ClockIcon/>} label="Pendiente" value={formatCurrency(d.pendiente)} foot="Aún no confirmado"/>
   <Metric tone="blue" icon={<CheckIcon/>} label="Pagado" value={formatCurrency(d.pagado)} foot="Histórico transferido"/>
   <Metric tone="violet" icon={<BankIcon/>} label="Retiros solicitados" value={String(d.retiros.length)} foot="Total de solicitudes"/>
  </section>

  <section className="cap-payinfo">
   <span className="cap-payinfo-icon"><ClockIcon/></span>
   <div>
    <strong>¿Cuándo recibo mi dinero?</strong>
    <p>Los pagos a captadores se realizan <b>todos los martes</b>. Tu comisión se habilita para retiro cuando Flow libera los fondos, entre <b>2 y 3 días hábiles</b> después de que el pedido pasa a estado <b>Finalizado</b> o de tu ingreso directo por la compra de monedas RepuesTop.</p>
   </div>
  </section>

  {solicitudEnCurso&&<section className="cap-payinfo cap-payinfo-warn">
   <span className="cap-payinfo-icon"><ClockIcon/></span>
   <div>
    <strong>Tienes una solicitud de retiro en curso</strong>
    <p>Tu solicitud <b>{solicitudEnCurso.codigo}</b> por <b>{formatCurrency(solicitudEnCurso.monto)}</b> está en revisión de Administración Contable. <b>No puedes solicitar otro retiro hasta que este se pague.</b></p>
   </div>
  </section>}

  <section className="cap-two">
   <form className="cap-card cap-fin-card" onSubmit={onSaveBank}>
    <div className="cap-fin-card-head">
     <span className="cap-metric-icon cap-tone-blue"><BankIcon/></span>
     <div>
      <span className="cap-eyebrow">Datos para el retiro de dinero</span>
      <h2 className="cap-h2">Cuenta bancaria</h2>
     </div>
    </div>
    <p className="cap-muted cap-sub">Usamos estos datos para transferirte por la nómina bancaria. Deben coincidir con tu boleta de honorarios.</p>
    <div className="cap-form-grid">
     <label className="cap-field">RUT del titular
      <input className="cap-control" placeholder="12.345.678-9" value={bank.rut} onChange={e=>set({rut:formatRut(e.target.value)})} aria-invalid={bank.rut.length>=8&&!validateRut(bank.rut)?true:undefined} required/>
     </label>
     <label className="cap-field">Nombre del titular
      <input className="cap-control" placeholder="Nombre completo" value={bank.titular} onChange={e=>set({titular:e.target.value})} required/>
     </label>
     <label className="cap-field">Banco
      <select className="cap-control" value={bank.banco} onChange={e=>{const opt=BANCOS_BCI.find(o=>o.nombre===e.target.value);set({banco:e.target.value,bankCode:opt?.code??null});}} required>
       <option value="">Selecciona un banco</option>
       {BANCOS_BCI.map(o=><option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
      </select>
     </label>
     <label className="cap-field">Tipo de cuenta
      <select className="cap-control" value={bank.tipoCuenta} onChange={e=>set({tipoCuenta:e.target.value})} required>
       <option value="">Selecciona el tipo</option>
       {TIPO_CUENTA_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
      </select>
     </label>
     <label className="cap-field">Número de cuenta
      <input className="cap-control" placeholder="Sin puntos ni guiones" value={bank.numeroCuenta} onChange={e=>set({numeroCuenta:e.target.value.replace(/[^0-9]/g,'')})} inputMode="numeric" required/>
     </label>
     <label className="cap-field">Correo de notificación
      <input className="cap-control" type="email" placeholder="tucorreo@ejemplo.cl" value={bank.email} onChange={e=>set({email:e.target.value})}/>
     </label>
    </div>
    {bank.banco&&<p className="cap-note"><InfoIcon/>Código de banco para la nómina: <strong>&nbsp;{bank.bankCode??'—'}</strong></p>}
    <button className="cap-primary" disabled={!bankComplete}>{cuentaGuardadaCompleta?'Actualizar datos':'Guardar datos'}</button>
   </form>

   {solicitudEnCurso?(
   <div className="cap-card cap-fin-card">
    <div className="cap-fin-card-head">
     <span className="cap-metric-icon cap-tone-amber"><ClockIcon/></span>
     <div>
      <span className="cap-eyebrow">Solicitud en curso</span>
      <h2 className="cap-h2">Retiro en revisión</h2>
     </div>
    </div>
    <div className="cap-request-open">
     <div className="cap-request-row"><span>Código</span><strong>{solicitudEnCurso.codigo}</strong></div>
     <div className="cap-request-row"><span>Monto solicitado</span><strong>{formatCurrency(solicitudEnCurso.monto)}</strong></div>
     <div className="cap-request-row"><span>Fecha de solicitud</span><strong>{new Date(solicitudEnCurso.fecha).toLocaleDateString('es-CL')}</strong></div>
     <div className="cap-request-row"><span>Estado</span><Badge estado={solicitudEnCurso.estado}/></div>
    </div>
    <p className="cap-note cap-note-warn"><InfoIcon/>Solo puede haber una solicitud a la vez. Podrás pedir un nuevo retiro cuando Administración Contable pague este, normalmente el martes siguiente.</p>
   </div>
   ):(
   <form className="cap-card cap-fin-card" onSubmit={onWithdraw}>
    <div className="cap-fin-card-head">
     <span className="cap-metric-icon cap-tone-green"><MoneyIcon/></span>
     <div>
      <span className="cap-eyebrow">Saldo disponible</span>
      <h2 className="cap-h2">Solicitar retiro</h2>
     </div>
    </div>
    <div className="cap-balance"><span>Puedes retirar hasta</span><strong>{formatCurrency(d.disponible)}</strong></div>
    {!bankComplete&&<p className="cap-note cap-note-warn"><InfoIcon/>Completa y guarda tu cuenta bancaria antes de solicitar un retiro.</p>}
    <label className="cap-field">Monto a retirar
     <input className="cap-control" type="number" min="1" max={d.disponible} value={amount} onChange={e=>onAmount(e.target.value)} disabled={d.disponible<=0} required/>
    </label>
    {montoInvalido&&<small className="cap-inline-err">El monto debe ser mayor a 0 y no superar {formatCurrency(d.disponible)}.</small>}
    <label className="cap-field">Boleta de honorarios (PDF)
     <input className="cap-control" type="file" accept="application/pdf" onChange={e=>onReceipt(e.target.files?.[0]||null)} required/>
    </label>
    <p className="cap-note"><InfoIcon/>La boleta de honorarios en PDF es obligatoria y se envía a Administración Contable junto con la solicitud.{receipt?` Archivo: ${receipt.name}`:''}</p>
    <button className="cap-primary" disabled={!bankComplete||montoInvalido||d.disponible<=0}>Enviar solicitud</button>
   </form>
   )}
  </section>

  <section className="cap-card">
   <div className="cap-card-head"><h2 className="cap-h2">Historial de retiros</h2><span className="cap-muted cap-sub">{d.retiros.length} solicitud(es)</span></div>
   <div className="cap-table-wrap">
    <table className="cap-table">
     <thead><tr><th>Fecha</th><th>Código</th><th>Cuenta destino</th><th className="cap-right">Monto</th><th>Estado</th><th>Fecha de pago</th><th>Observación</th></tr></thead>
     <tbody>{d.retiros.length?d.retiros.map(r=><tr key={r.id}>
      <td>{new Date(r.fecha).toLocaleDateString('es-CL')}</td>
      <td><span className="cap-cell-strong">{r.codigo}</span></td>
      <td>{r.banco?<span>{r.banco}<small className="cap-muted" style={{display:'block',fontSize:12}}>{[r.tipoCuenta,r.numeroCuenta].filter(Boolean).join(' · ')||'—'}</small></span>:'—'}</td>
      <td className="cap-right"><strong>{formatCurrency(r.monto)}</strong></td>
      <td><Badge estado={r.estado}/></td>
      <td>{r.fechaPago?new Date(r.fechaPago).toLocaleDateString('es-CL'):'—'}</td>
      <td className="cap-muted">{r.motivoRechazo||'—'}</td>
     </tr>):<tr><td colSpan={7} className="cap-empty-cell">Aún no has solicitado retiros.</td></tr>}</tbody>
    </table>
   </div>
  </section>
 </div>;
}

/* ---------------- Piezas compartidas ---------------- */
function Metric({icon,label,value,foot,tone}:{icon:ReactNode;label:string;value:string;foot:string;tone:'blue'|'green'|'violet'|'amber'}){
 return <article className="cap-card cap-metric">
  <span className={`cap-metric-icon cap-tone-${tone}`}>{icon}</span>
  <div><span className="cap-metric-label">{label}</span><strong className="cap-metric-value">{value}</strong><small className={`cap-metric-foot cap-foot-${tone}`}>{foot}</small></div>
 </article>;
}
function FunnelStep({icon,label,value,tone}:{icon:ReactNode;label:string;value:number;tone:'blue'|'green'|'violet'|'amber'}){
 return <div className="cap-funnel-step"><span className={`cap-metric-icon cap-tone-${tone}`}>{icon}</span><div><span className="cap-metric-label">{label}</span><strong>{value}</strong></div></div>;
}
function MovementsTable({rows}:{rows:CapturerMovement[]}){
 return <div className="cap-table-wrap">
  <table className="cap-table">
   <thead><tr><th>Fecha</th><th>Empresa / Negocio</th><th>Tipo</th><th className="cap-right">Comisión</th><th>Estado</th></tr></thead>
   <tbody>{rows.length?rows.map(m=>{
    const negocio = (m.negocioNombre || '').trim() || m.descripcion;
    return (
     <tr key={m.id}>
      <td>{new Date(m.fecha).toLocaleDateString('es-CL')}</td>
      <td>
       <div className="cap-biz">
        <span className="cap-feed-avatar">{(negocio||'?').charAt(0).toUpperCase()}</span>
        <div>
         <span className="cap-cell-strong">{negocio}</span>
         {m.negocioNombre && m.descripcion && m.descripcion !== m.negocioNombre ? (
          <small className="cap-muted" style={{display:'block',fontSize:12,marginTop:2}}>{m.descripcion}</small>
         ) : null}
        </div>
       </div>
      </td>
      <td><span className={`cap-chip cap-chip-${m.tipo==='CASA'||m.tipo==='VENTA_REPUESTOS'||m.tipo==='COMPRA_COMPRADOR'?'blue':'violet'}`}>{tipoLabel(m.tipo)}</span></td>
      <td className="cap-right"><strong>{formatCurrency(m.montoComision)}</strong></td>
      <td><Badge estado={m.estado}/></td>
     </tr>
    );
   }):<tr><td colSpan={5} className="cap-empty-cell">Aún no tienes movimientos de comisión.</td></tr>}</tbody>
  </table>
 </div>;
}
function Badge({estado}:{estado:string}){
 const tone=estado==='PAGADO'?'green':estado==='PENDIENTE'?'amber':estado==='RECHAZADO'?'red':'blue';
 return <span className={`cap-badge-state cap-state-${tone}`}>{estadoLabel(estado)}</span>;
}
function State({title,detail}:{title:string;detail?:string}){
 return <main className="cap-state"><style>{css}</style><section className="cap-card cap-state-card">
  <img src="/assets/repuestop-logo.jpg" alt="RepuesTop"/>
  <h1>{title}</h1>{detail&&<p className="cap-muted">{detail}</p>}
 </section></main>;
}
function tipoLabel(tipo:string){return tipo==='CASA'||tipo==='VENTA_REPUESTOS'?'Venta repuestos':tipo==='PUBLICIDAD'||tipo==='COMPRA_FICHAS'?'Compra fichas':tipo==='COMPRA_COMPRADOR'?'Compra comprador':tipo?tipo.charAt(0)+tipo.slice(1).toLowerCase().replace(/_/g,' '):'—';}
function estadoLabel(estado:string){return estado?estado.charAt(0)+estado.slice(1).toLowerCase().replace(/_/g,' '):'—';}

const LinkIcon=()=> <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>;
const CopyIcon=()=> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>;
const MoneyIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.2A2.7 2.7 0 0 0 12 8c-1.4 0-2.5.8-2.5 2s1.1 2 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.7 2.7 0 0 1-2.5-1.2"/><path d="M12 6.4V8M12 16v1.6"/></svg>;
const StoreIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1-4H5Z"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>;
const WrenchIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 3.5a5 5 0 0 0-6.2 6.2L3.6 15.4a2 2 0 0 0 2.8 2.8l5.7-5.7a5 5 0 0 0 6.2-6.2l-2.8 2.8-2.3-.6-.6-2.3Z"/></svg>;
const ClockIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.3 2"/></svg>;
const CheckIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.3 12.3 2.6 2.6 4.8-5"/></svg>;
const UsersIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.3a3.4 3.4 0 0 1 0 6.4M17.5 20a6.2 6.2 0 0 0-2-4.5"/></svg>;
const BankIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18"/></svg>;
const MedalIcon=()=> <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M12 2.6 19.4 6v5.6c0 4.6-3.1 8.1-7.4 9.8-4.3-1.7-7.4-5.2-7.4-9.8V6Z" fill="currentColor" fillOpacity=".18"/><path d="m12 7.6 1.35 2.75 3.05.45-2.2 2.15.52 3.03L12 14.5l-2.72 1.48.52-3.03-2.2-2.15 3.05-.45Z" fill="currentColor" stroke="none"/></svg>;
const TrophyIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5a2.5 2.5 0 0 1-2.5 4"/><path d="M12 14v3M9 20h6"/></svg>;
const StarIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9Z"/></svg>;
const ShieldIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 7.7-7 9.5-4-1.8-7-5.1-7-9.5V6Z"/><path d="m9.5 12 1.8 1.8 3.4-3.6"/></svg>;
const SearchIcon=()=> <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
const FilterIcon=()=> <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>;
const CrownIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 18 -1-9 5 3 4-6 4 6 5-3-1 9Z"/><path d="M4 21h16"/></svg>;
const TrendIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>;
const TargetIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>;
const PinAltIcon=()=> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
const InfoIcon=()=> <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>;

const css=`
.cap-layout{display:grid;grid-template-columns:minmax(0,1fr) 296px;gap:16px;align-items:start}
.cap-col{display:grid;gap:18px;min-width:0}
.cap-col>*{min-width:0}
.cap-hero>*{min-width:0}
.cap-metrics>*{min-width:0}
.cap-rail{display:grid;gap:14px;min-width:0}
.cap-card{background:#fff;border:1px solid #e6edf7;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(11,37,89,.05)}
.cap-loading{color:#64748b}
.cap-h2{margin:2px 0 0;font-size:17px;font-weight:800;color:#0b2559}
.cap-sub{margin:5px 0 0;font-size:13px}
.cap-muted{color:#64748b}
.cap-eyebrow{display:block;font-size:11.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#7b8aa3}
.cap-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.cap-flash{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;padding:12px 14px;border:1px solid #cfe0fb;border-radius:12px;background:#eaf3ff;color:#14459b;font-weight:600}
.cap-flash button{border:0;background:transparent;color:inherit;font-size:19px;line-height:1;cursor:pointer}

.cap-hero{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,1.9fr);gap:16px;align-items:start}
.cap-referral{display:grid;gap:10px;align-content:start;background:linear-gradient(150deg,#ffffff,#eef4ff)}
.cap-code{font-size:23px;font-weight:900;letter-spacing:-.03em;color:#1657d9;overflow-wrap:anywhere}
.cap-link{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px dashed #c3d6f5;border-radius:11px;background:#fff;color:#52647d;font-size:12.5px;overflow:hidden}
.cap-link span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cap-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border:0;border-radius:11px;background:#1657d9;color:#fff;font:inherit;font-weight:700;cursor:pointer;transition:background .15s}
.cap-primary:hover{background:#1148b4}
.cap-copy{width:100%}
.cap-ghost,.cap-link-btn{border:1px solid #e0e8f5;border-radius:9px;padding:7px 12px;background:#fff;color:#1657d9;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.cap-ghost:hover,.cap-link-btn:hover{background:#f1f6ff}
.cap-link-btn{border:0;padding:4px 2px}

.cap-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.cap-metrics-wide{grid-template-columns:repeat(auto-fit,minmax(215px,1fr))}
.cap-metric{display:flex;align-items:flex-start;gap:11px;padding:15px}
.cap-metric>div{min-width:0}
.cap-metric-label{overflow-wrap:anywhere}
.cap-metric-value{white-space:nowrap}
.cap-metric-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;flex:0 0 auto}
.cap-tone-blue{background:#e7effe;color:#1657d9}
.cap-tone-green{background:#e3f7ec;color:#0f8a4d}
.cap-tone-violet{background:#f0eafe;color:#6d3fd6}
.cap-tone-amber{background:#fef2e0;color:#c2760b}
.cap-metric-label{display:block;font-size:12.5px;font-weight:600;color:#64748b}
.cap-metric-value{display:block;margin-top:3px;font-size:20px;font-weight:850;letter-spacing:-.02em;color:#0b2559}
.cap-metric-foot{display:block;margin-top:3px;font-size:11.5px;font-weight:600}
.cap-foot-blue{color:#1657d9}.cap-foot-green{color:#0f8a4d}.cap-foot-violet{color:#6d3fd6}.cap-foot-amber{color:#c2760b}

.cap-funnel{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;margin-top:14px;overflow-x:auto;padding-bottom:2px}
.cap-funnel-step{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.cap-funnel-step .cap-metric-icon{width:32px;height:32px;border-radius:10px}
.cap-funnel-step .cap-metric-icon svg{width:16px;height:16px}
.cap-funnel-step .cap-metric-label{white-space:nowrap;font-size:11.5px}
.cap-funnel-step strong{display:block;font-size:19px;font-weight:850;line-height:1.2;color:#0b2559}
.cap-arrow{color:#b7c5da;font-size:16px;flex:0 0 auto}
.cap-funnel-rate{margin-left:auto;padding-left:14px;border-left:1px solid #e6edf7;flex:0 0 auto;white-space:nowrap}
.cap-funnel-rate strong{display:block;font-size:19px;font-weight:850;line-height:1.2;color:#0f8a4d}

.cap-table-wrap{overflow-x:auto}
.cap-table{width:100%;border-collapse:collapse;text-align:left;font-size:13.5px}
.cap-table th{padding:10px 12px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7b8aa3;border-bottom:1px solid #e6edf7;white-space:nowrap}
.cap-table td{padding:12px;border-bottom:1px solid #f0f4fa;color:#3d4f6d;vertical-align:middle}
.cap-table tbody tr:last-child td{border-bottom:0}
.cap-table tbody tr:hover{background:#f8fbff}
.cap-right{text-align:right}
.cap-cell-strong{font-weight:700;color:#0b2559}
.cap-biz{display:flex;align-items:center;gap:9px}
.cap-chip{display:inline-block;padding:4px 9px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.cap-chip-blue{background:#e7effe;color:#1657d9}
.cap-chip-violet{background:#f0eafe;color:#6d3fd6}
.cap-badge-state{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.cap-badge-state::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
.cap-state-green{background:#e3f7ec;color:#0f8a4d}
.cap-state-amber{background:#fef2e0;color:#c2760b}
.cap-state-blue{background:#e7effe;color:#1657d9}
.cap-state-red{background:#fdeaea;color:#b42318}
.cap-empty-cell{padding:26px 8px;text-align:center;color:#8494ab}
.cap-empty{margin:6px 0 0;font-size:13px;color:#8494ab}
.cap-table-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #eef3fa;font-size:13px;color:#64748b}

.cap-howto{padding:15px;border-radius:16px;background:linear-gradient(160deg,#1b4fc4 0%,#0e3288 55%,#0b2a72 100%);color:#fff;box-shadow:0 12px 30px rgba(11,45,120,.24)}
.cap-howto-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.cap-howto-head h2{margin:0;font-size:14.5px;font-weight:800;color:#fff}
.cap-howto-info{display:grid;place-items:center;color:#9dbcf5}
.cap-howto-item{display:flex;gap:11px;margin-top:13px}
.cap-howto-item:first-of-type{margin-top:0}
.cap-howto-item strong{display:block;font-size:13.5px;font-weight:800;line-height:1.32}
.cap-howto-item p{margin:5px 0 0;font-size:11.5px;line-height:1.45;color:#b6cdf4}
.cap-howto-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:12px;background:rgba(255,255,255,.15);color:#fff}
.cap-howto-icon svg{width:19px;height:19px}

.cap-perf{padding:15px}
.cap-perf-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.cap-perf-head h2{margin:0;font-size:14.5px;font-weight:800;color:#0b2559}
.cap-perf-row{display:flex;align-items:center;gap:12px}
.cap-perf-badge{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:12px}
.cap-perf-name{min-width:0;flex:1}
.cap-perf-name strong{display:block;font-size:14px;font-weight:800;color:#0b2559}
.cap-perf-name small{display:block;margin-top:1px;font-size:11.5px;color:#64748b}
.cap-perf-pos{text-align:right;flex:0 0 auto;padding-left:12px;border-left:1px solid #eef3fa}
.cap-perf-pos span{display:block;font-size:11px;color:#7b8aa3}
.cap-perf-pos strong{display:block;font-size:21px;font-weight:850;line-height:1.1;color:#0b2559}
.cap-perf-pos small{display:block;font-size:11px;color:#7b8aa3}
.cap-perf-goal{display:flex;justify-content:space-between;gap:10px;margin:13px 0 6px;font-size:11.5px;font-weight:600;color:#52647d}
.cap-perf-total{display:block;margin-top:6px;font-size:11px;color:#7b8aa3}
.cap-level-bronce{background:linear-gradient(150deg,#cf9560,#a4622a);color:#fff;box-shadow:0 6px 14px rgba(164,98,42,.28)}
.cap-level-plata{background:linear-gradient(150deg,#8497b4,#54688a);color:#fff;box-shadow:0 6px 14px rgba(84,104,138,.28)}
.cap-level-oro{background:linear-gradient(150deg,#f0c75e,#b7841a);color:#fff;box-shadow:0 6px 14px rgba(183,132,26,.3)}
.cap-progress{height:8px;border-radius:99px;background:#e9eff8;overflow:hidden}
.cap-progress div{height:100%;border-radius:99px;background:linear-gradient(90deg,#1657d9,#33a1ff)}

.cap-feed{display:grid;gap:4px}
.cap-feed-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5fb}
.cap-feed-item:last-child{border-bottom:0}
.cap-feed-item strong{display:block;font-size:13.5px;color:#0b2559}
.cap-feed-item small{display:block;font-size:11.5px}
.cap-feed-item>div{min-width:0;flex:1}
.cap-feed-item>div strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cap-feed-avatar{display:grid;place-items:center;width:32px;height:32px;flex:0 0 auto;border-radius:10px;background:#e7effe;color:#1657d9;font-size:13px;font-weight:800}

.cap-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;align-items:start}
.cap-fin-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.cap-fin-head h1{margin:0;font-size:24px;font-weight:850;letter-spacing:-.02em;color:#0b2559}
.cap-fin-head p{margin:5px 0 0;font-size:13.5px;color:#64748b;max-width:560px}
.cap-fin-status{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:999px;font-size:12.5px;font-weight:700;white-space:nowrap}
.cap-fin-status svg{width:15px;height:15px}
.cap-fin-status.ok{background:#e3f7ec;color:#0f8a4d;border:1px solid #b9e6cd}
.cap-fin-status.pending{background:#fef2e0;color:#c2760b;border:1px solid #f3ddb4}
.cap-fin-card{display:flex;flex-direction:column;gap:2px}
.cap-fin-card-head{display:flex;align-items:center;gap:12px;margin-bottom:4px}
.cap-fin-card-head .cap-metric-icon{width:40px;height:40px}
.cap-fin-card .cap-primary{margin-top:auto}
.cap-fin-card .cap-primary:disabled{background:#aebfdd;cursor:not-allowed}
.cap-payinfo{display:flex;gap:13px;align-items:flex-start;padding:15px 16px;border:1px solid #cfe0fb;border-radius:14px;background:linear-gradient(120deg,#eaf2ff,#f8fbff)}
.cap-payinfo-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:11px;background:#dbe8ff;color:#1657d9}
.cap-payinfo strong{display:block;font-size:13.5px;font-weight:800;color:#0b2559}
.cap-payinfo p{margin:4px 0 0;font-size:12.5px;line-height:1.5;color:#42557d}
.cap-payinfo-warn{border-color:#f3ddb4;background:linear-gradient(120deg,#fff4e2,#fffaf2)}
.cap-payinfo-warn .cap-payinfo-icon{background:#fbe3bf;color:#c2760b}
.cap-payinfo-warn strong{color:#8a5a12}
.cap-payinfo-warn p{color:#7a5a2c}
.cap-request-open{display:grid;gap:1px;margin:12px 0 4px;border:1px solid #e6edf7;border-radius:12px;overflow:hidden;background:#e6edf7}
.cap-request-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 13px;background:#fff;font-size:13px}
.cap-request-row span{color:#64748b;font-weight:600}
.cap-request-row strong{color:#0b2559;font-weight:800}
.cap-note-warn{color:#b45309;font-weight:600}
.cap-inline-err{display:block;margin:-8px 0 10px;font-size:12px;font-weight:600;color:#b42318}
select.cap-control{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7a95' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.cap-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:14px 0 16px}
.cap-field{display:grid;gap:6px;font-size:12.5px;font-weight:700;color:#3d4f6d}
.cap-control{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d7e0ee;border-radius:10px;background:#fff;font:inherit;font-size:13.5px;color:#0b2559}
.cap-control:focus{outline:2px solid #b9d0fb;outline-offset:0;border-color:#1657d9}
.cap-balance{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0;padding:14px;border-radius:12px;background:#f2f7ff;color:#52647d;font-size:13px}
.cap-balance strong{font-size:22px;font-weight:850;color:#0f8a4d}
.cap-note{display:flex;gap:7px;align-items:flex-start;margin:4px 0 14px;font-size:12px;line-height:1.5;color:#64748b}
.cap-note svg{flex:0 0 auto;margin-top:2px}
.cap-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cap-filters .cap-control{width:auto}
.cap-toggle{display:flex;padding:3px;border:1px solid #e0e8f5;border-radius:10px;background:#f6f9fe}
.cap-toggle button{padding:7px 13px;border:0;border-radius:8px;background:transparent;color:#52647d;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.cap-toggle .cap-toggle-on{background:#1657d9;color:#fff;box-shadow:0 4px 10px rgba(22,87,217,.28)}

.cap-podium{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px}
.cap-podium-item{display:grid;gap:3px;padding:14px;border:1px solid #e6edf7;border-radius:14px;background:#fbfdff}
.cap-podium-item strong{font-size:15px;color:#0b2559}
.cap-podium-item small{color:#64748b;font-size:12px}
.cap-podium-pos{font-size:12px;font-weight:800;color:#7b8aa3}
.cap-podium-pts{margin-top:5px;font-size:13px;font-weight:800;color:#1657d9}
.cap-podium-1{background:linear-gradient(150deg,#fff8e6,#fff);border-color:#f4dda1}
.cap-podium-2{background:linear-gradient(150deg,#f3f6fb,#fff)}
.cap-podium-3{background:linear-gradient(150deg,#fdf1e9,#fff)}
.cap-podium-own{outline:2px solid #1657d9}
.cap-row-own{background:#eef5ff}
.cap-row-own td{font-weight:700;color:#0b2559}
.cap-pos{display:inline-grid;place-items:center;min-width:34px;padding:4px 8px;border-radius:8px;background:#f1f5fb;font-weight:800;color:#3d4f6d}

.cap-state{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7fb;font-family:Inter,system-ui,sans-serif}
.cap-state-card{max-width:520px;text-align:center}
.cap-state-card img{height:70px;border-radius:12px}
.cap-state-card h1{margin:14px 0 8px;font-size:22px;color:#0b2559}

.cap-page-head h1{margin:0;font-size:26px;font-weight:850;letter-spacing:-.02em;color:#0b2559}
.cap-page-head p{margin:5px 0 0;font-size:13.5px;color:#64748b}
.cap-rk{display:grid;gap:14px;min-width:0}
.cap-rk-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}
.cap-rk-stat{display:flex;align-items:flex-start;gap:10px;min-height:104px;padding:15px 13px}
.cap-rk-stat>div{min-width:0}
.cap-rk-stat-label{display:block;font-size:11.5px;font-weight:600;color:#42557d;line-height:1.3}
.cap-rk-stat-value{display:block;margin-top:6px;font-size:21px;font-weight:850;letter-spacing:-.02em;color:#0b2559;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cap-rk-stat-foot{display:block;margin-top:4px;font-size:11px;line-height:1.35;color:#7b8aa3}

.cap-rk-filters{display:flex;align-items:flex-end;gap:9px;flex-wrap:nowrap;padding:14px;background:#fff;border:1px solid #e6edf7;border-radius:16px;box-shadow:0 8px 24px rgba(11,37,89,.05)}
.cap-rk-search{display:flex;align-items:center;gap:8px;flex:2 1 110px;min-width:108px;height:42px;padding:0 12px;border:1px solid #d7e0ee;border-radius:11px;color:#7b8aa3}
.cap-rk-search svg{flex:0 0 auto}
.cap-rk-search input{width:100%;min-width:0;border:0;outline:0;font:inherit;font-size:13px;color:#0b2559;background:transparent}
.cap-rk-field{display:grid;gap:5px;flex:1 1 96px;min-width:86px}
.cap-rk-field small{font-size:11.5px;color:#7b8aa3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cap-rk-field select,.cap-rk-perpage select{height:42px;padding:0 10px;border:1px solid #d7e0ee;border-radius:11px;background:#fff;font:inherit;font-size:13px;color:#0b2559;cursor:pointer}
.cap-rk-field select{width:100%;min-width:0;text-overflow:ellipsis}
.cap-rk-reset{flex:0 0 auto;display:grid;place-items:center;width:42px;height:42px;border:1px solid #d7e0ee;border-radius:11px;background:#fff;color:#31456e;cursor:pointer}
.cap-rk-reset:hover{background:#f2f7ff}

.cap-rk-insights{display:grid;grid-template-columns:max-content repeat(4,minmax(0,1fr));align-items:center;gap:10px;padding:11px 14px;border:1px solid #cfe0fb;border-radius:16px;background:linear-gradient(120deg,#eaf2ff,#f8fbff);box-shadow:0 8px 24px rgba(11,37,89,.05)}
.cap-rk-insights-title{max-width:96px;font-size:12.5px;font-weight:800;line-height:1.25;color:#123c8f}
.cap-rk-insight{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:12px;background:#fff;min-width:0}
.cap-rk-insight>div{min-width:0}
.cap-rk-insight small{display:block;font-size:10.5px;line-height:1.3;color:#7b8aa3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cap-rk-insight strong{display:block;margin:1px 0;font-size:13px;font-weight:800;color:#0b2559;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cap-rk-insight .cap-metric-icon{width:34px;height:34px}
.cap-rk-insight-blue .cap-metric-icon{background:#e7effe}
.cap-rk-insight-green .cap-metric-icon{background:#e3f7ec}
.cap-rk-insight-violet .cap-metric-icon{background:#f0eafe}
.cap-rk-insight-amber .cap-metric-icon{background:#fef2e0}

.cap-rk-table-card{background:#fff;border:1px solid #e6edf7;border-radius:16px;box-shadow:0 8px 24px rgba(11,37,89,.05);overflow:hidden}
.cap-rk-table{font-size:13px}
.cap-rk-table th{padding:13px 11px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7286a8;border-bottom:1px solid #e6edf7;white-space:nowrap}
.cap-rk-table td{padding:11px;border-bottom:1px solid #f1f5fb;color:#31456e;vertical-align:middle}
.cap-rk-table tbody tr:last-child td{border-bottom:0}
.cap-rk-table tbody tr:hover{background:#f8fbff}
.cap-rk-pos{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid #dce6f3;border-radius:99px;font-weight:700;color:#31456e}
.cap-rk-pos-top{border-color:#f2dfae;background:#fffaef;color:#8a6412}
.cap-rk-person{display:flex;align-items:center;gap:9px}
.cap-rk-person strong{font-size:13.5px;color:#0b2559}
.cap-rk-avatar{display:grid;place-items:center;width:36px;height:36px;flex:0 0 auto;border-radius:50%;color:#fff;font-size:13px;font-weight:800;overflow:hidden}
.cap-rk-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.cap-rk-you{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:6px;background:#eaf1ff;color:#165ed4;font-size:11px;font-weight:700}
.cap-dif{font-weight:700;color:#7b8aa3}
.cap-dif-up{color:#e0294b}
.cap-dif-down{color:#0f8a4d}
.cap-rk-foot{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 16px;border-top:1px solid #e6edf7;font-size:12.5px;color:#7b8aa3}
.cap-rk-pager{display:flex;align-items:center;gap:6px}
.cap-rk-perpage{display:flex;align-items:center;gap:7px;margin-right:6px}
.cap-rk-perpage select{height:36px}
.cap-rk-pager button{min-width:34px;height:34px;padding:0 9px;border:1px solid #dce6f3;border-radius:9px;background:#fff;color:#31456e;font:inherit;font-weight:700;cursor:pointer}
.cap-rk-pager button:hover:not(:disabled){background:#f2f7ff}
.cap-rk-pager button:disabled{opacity:.45;cursor:default}
.cap-rk-page-on{background:#1657d9;border-color:#1657d9;color:#fff}
.cap-rk-page-on:hover{background:#1657d9}
.cap-rk-gap{padding:0 4px}

@media (max-width:1240px){
 .cap-rk-insights{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cap-rk-insights-title{grid-column:1/-1;max-width:none}
}
@media (max-width:860px){
 .cap-rk-stats{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
 .cap-rk-filters{flex-wrap:wrap}
 .cap-rk-search{flex:1 1 100%}
 .cap-rk-field{flex:1 1 130px}
}

@media (max-width:1520px){
 .cap-hero{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:1400px){
 .cap-funnel{gap:12px}
 .cap-funnel .cap-arrow{display:none}
 .cap-funnel-step .cap-metric-icon{width:28px;height:28px}
 .cap-funnel-step .cap-metric-icon svg{width:15px;height:15px}
 .cap-funnel-step .cap-metric-label{font-size:11px}
 .cap-funnel-step strong{font-size:17px}
 .cap-funnel-rate strong{font-size:17px}
}
@media (max-width:1180px){
 .cap-layout{grid-template-columns:minmax(0,1fr)}
 .cap-hero{grid-template-columns:minmax(0,1fr)}
 .cap-metrics{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
}
`;
