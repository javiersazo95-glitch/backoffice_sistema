// Contratos del repositorio "Redes sociales" de captadores (backend: CaptadorSocialDTOs).

export type SocialTipo = 'VIDEO' | 'IMAGEN';
export type SocialVista = 'PUBLICO' | 'MIOS' | 'DESCARGADOS';
export type SocialOrden = 'RECIENTES' | 'MEJOR_EVALUADOS' | 'MAS_DESCARGADOS' | 'ANTIGUOS';
export type SocialCategoria = 'REPUESTOS' | 'TALLERES' | 'PROMOCIONES' | 'TIPS' | 'MARCA' | 'OTRO';
export type SocialRed = 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK' | 'YOUTUBE' | 'WHATSAPP';
export type SocialFiltro = 'ORIGINAL' | 'VIVIDO' | 'CALIDO' | 'FRIO' | 'BN' | 'VINTAGE' | 'CONTRASTE';
export type SocialMotivoBloqueo = 'BLOQUEO_14_DIAS' | 'SIN_ACCESO' | 'CUPO_AGOTADO' | 'NO_DISPONIBLE' | 'SUSPENDIDO' | null;
export type SocialNivelCodigo = 'BRONCE' | 'PLATA' | 'ORO' | 'PLATINO' | 'DIAMANTE';

export interface SocialNivel { numero:number; codigo:SocialNivelCodigo; medalla:string; puntosMinimos:number; descargasSemana:number; }

export interface SocialEstado {
  nivel:SocialNivelCodigo; nivelNumero:number; medalla:string; puntos:number; compradoresConvertidos:number; puntosPorComprador:number;
  siguienteNivel:SocialNivelCodigo|null; siguienteMedalla:string|null; puntosSiguienteNivel:number|null; progresoPct:number;
  /** -1 = ilimitado */
  cupoSemanal:number; descargasSemana:number; descargasRestantes:number|null; reinicioCupo:string; semanaInicio:string;
  videosRequeridos:number; videosUltimos7Dias:number; accesoActivo:boolean; accesoHasta:string|null;
  bloqueoDias:number; niveles:SocialNivel[]; subidasHoy:number; subidasMaximasDia:number;
  /** Compradores registrados con el código (los que ya compraron son `compradoresConvertidos`). */
  compradoresReferidos:number;
  /** Suspensión vigente del repositorio aplicada por Mediación y Confianza. */
  suspendidoHasta?:string|null; motivoSuspension?:string|null;
}

export interface SocialContenido {
  id:number; tipo:SocialTipo; url:string; posterUrl:string|null; contentType:string; tamanoBytes:number; duracionSeg:number|null;
  titulo:string; descripcion:string|null; categoria:SocialCategoria; redes:SocialRed[]; filtroVisual:SocialFiltro; estado:'PUBLICADO'|'OCULTO'|'ELIMINADO';
  autorId:number; autorAlias:string; autorFoto:string|null; propio:boolean; creadoEn:string;
  descargasTotal:number; calificacionPromedio:number; calificacionCount:number;
  ultimaDescarga:string|null; bloqueadoHasta:string|null; miCalificacion:number|null;
  puedeDescargar:boolean; motivoBloqueo:SocialMotivoBloqueo; nombreDescarga:string;
}

export interface SocialPagina<T> { contenido:T[]; pagina:number; tamano:number; total:number; totalPaginas:number; }

export interface SocialDescarga { contenidoId:number; url:string; nombreArchivo:string; descargadoEn:string; bloqueadoHasta:string|null; estado:SocialEstado; }

export interface SocialResena { id:number; autorAlias:string; autorFoto:string|null; estrellas:number; resena:string|null; redSocial:string|null; fecha:string; propia:boolean; }

export interface SocialNuevoContenido { titulo:string; descripcion?:string; categoria:SocialCategoria; redes:SocialRed[]; filtroVisual:SocialFiltro; duracionSeg?:number|null; }

export interface SocialFiltros { vista:SocialVista; tipo?:SocialTipo|''; categoria?:SocialCategoria|''; red?:SocialRed|''; q?:string; orden:SocialOrden; soloNoDescargados?:boolean; }

// ---- Backoffice ----
export interface SocialContenidoAdmin {
  id:number; tipo:SocialTipo; url:string; posterUrl:string|null; titulo:string; categoria:SocialCategoria; filtroVisual:SocialFiltro;
  autorId:number; autorAlias:string; estado:'PUBLICADO'|'OCULTO'|'ELIMINADO'; motivoOcultamiento:string|null; descargasTotal:number;
  calificacionPromedio:number; calificacionCount:number; tamanoBytes:number; creadoEn:string;
}
export interface SocialRanking { captadorId:number; alias:string; cantidad:number; }

// ---- Repositorio de videos (backoffice) ----
export type VideoEstado = 'PUBLICADO' | 'OCULTO';
export type VideoOrden = 'RECIENTES' | 'ANTIGUOS' | 'MAS_DESCARGADOS' | 'MENOS_DESCARGADOS' | 'MEJOR_EVALUADOS' | 'PEOR_EVALUADOS' | 'MAS_PESADOS' | 'MODERADOS';
export interface VideoAdmin {
  id:number; url:string; posterUrl:string|null; contentType:string; tamanoBytes:number; duracionSeg:number|null;
  titulo:string; descripcion:string|null; categoria:SocialCategoria; redes:SocialRed[]; filtroVisual:SocialFiltro;
  estado:VideoEstado; motivoOcultamiento:string|null; moderadoPor:string|null; moderadoAt:string|null;
  descargasTotal:number; calificacionPromedio:number; calificacionCount:number; creadoEn:string; actualizadoEn:string;
  autorId:number; autorAlias:string; autorNombre:string|null; autorFoto:string|null; autorActivo:boolean; autorSuspendidoHasta:string|null;
}
export interface VideoFiltros { estado:''|VideoEstado; categoria:''|SocialCategoria; captadorId:number|null; q:string; desde:string; hasta:string; orden:VideoOrden; calificacionMax:number|null; }
export interface VideoMetricas {
  desde:string; hasta:string; videosTotal:number; videosPublicados:number; videosVetados:number;
  subidosPeriodo:number; vetadosPeriodo:number; descargasPeriodo:number; descargasTotal:number;
  calificacionPromedio:number; resenasTotal:number; captadoresPublicando:number; captadoresSancionados:number;
  almacenamientoBytes:number; duracionPromedioSeg:number|null;
  porCategoria:Array<{categoria:SocialCategoria;cantidad:number}>; topCaptadores:SocialRanking[];
  masDescargados:VideoAdmin[]; peorEvaluados:VideoAdmin[];
}
export interface SocialSancion {
  id:number; captadorId:number; captadorAlias:string; contenidoId:number|null; contenidoTitulo:string|null; dias:number; motivo:string;
  desde:string; hasta:string; creadoPor:string|null; creadaEn:string; levantadaEn:string|null; levantadaPor:string|null; vigente:boolean;
}
export interface SocialMetricas {
  periodo:string; contenidosPublicados:number; videosPublicados:number; imagenesPublicadas:number; contenidosOcultos:number;
  subidasSemana:number; descargasSemana:number; subidasPeriodo:number; descargasPeriodo:number;
  captadoresAprobados:number; captadoresConAcceso:number; captadoresPorNivel:Record<SocialNivelCodigo,number>;
  compradoresReferidos:number; compradoresConvertidos:number; comisionCompradoresPeriodo:number;
  masDescargados:SocialContenidoAdmin[]; mejorEvaluados:SocialContenidoAdmin[]; topAportadores:SocialRanking[]; topDescargadores:SocialRanking[];
}
export interface CapturedBuyer { atribucionId:number; nombre:string; emailEnmascarado:string; canal:string; registradoEn:string; primeraCompraEn:string|null; pedidos:number; montoBase:number; ingresoCaptador:number; }
/** Página de compradores referidos; referidos/conCompra/montoBase/ingreso son totales del captador (sin filtros). */
export interface CapturedBuyersPage extends SocialPagina<CapturedBuyer> { referidos:number; conCompra:number; montoBase:number; ingreso:number; }
export type CapturedBuyersOrden = 'RECIENTES'|'ANTIGUOS'|'PRIMERA_COMPRA'|'INGRESO'|'NOMBRE';
export interface CapturedBuyersQuery { q?:string; compra?:''|'CON_COMPRA'|'SIN_COMPRA'; canal?:''|'WEB'|'MOBILE'; orden?:CapturedBuyersOrden; pagina:number; tamano:number; }

// ---- Catálogos de UI ----
export const SOCIAL_CATEGORIAS:Array<{value:SocialCategoria;label:string}>=[
  {value:'REPUESTOS',label:'Repuestos'},{value:'TALLERES',label:'Talleres'},{value:'PROMOCIONES',label:'Promociones'},
  {value:'TIPS',label:'Tips y consejos'},{value:'MARCA',label:'Marca RepuesTop'},{value:'OTRO',label:'Otro'},
];
export const SOCIAL_REDES:Array<{value:SocialRed;label:string}>=[
  {value:'INSTAGRAM',label:'Instagram'},{value:'TIKTOK',label:'TikTok'},{value:'FACEBOOK',label:'Facebook'},
  {value:'YOUTUBE',label:'YouTube Shorts'},{value:'WHATSAPP',label:'WhatsApp'},
];
/** Filtros visuales: el mismo valor CSS se usa en el feed y (en imágenes) al "hornearlo" con canvas antes de subir. */
export const SOCIAL_FILTROS:Array<{value:SocialFiltro;label:string;css:string}>=[
  {value:'ORIGINAL',label:'Original',css:'none'},
  {value:'VIVIDO',label:'Vívido',css:'saturate(1.45) contrast(1.08)'},
  {value:'CALIDO',label:'Cálido',css:'sepia(.25) saturate(1.3) hue-rotate(-10deg)'},
  {value:'FRIO',label:'Frío',css:'saturate(1.1) hue-rotate(15deg) brightness(1.03)'},
  {value:'BN',label:'B/N',css:'grayscale(1) contrast(1.1)'},
  {value:'VINTAGE',label:'Vintage',css:'sepia(.45) contrast(.95) brightness(1.05) saturate(.85)'},
  {value:'CONTRASTE',label:'Contraste',css:'contrast(1.35) saturate(1.1)'},
];
export const socialFiltroCss=(f:SocialFiltro|null|undefined)=>SOCIAL_FILTROS.find(x=>x.value===f)?.css??'none';
export const socialCategoriaLabel=(c:string)=>SOCIAL_CATEGORIAS.find(x=>x.value===c)?.label??c;
export const socialRedLabel=(r:string)=>SOCIAL_REDES.find(x=>x.value===r)?.label??(r==='OTRA'?'Otra':r);
