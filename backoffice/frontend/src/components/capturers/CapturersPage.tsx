import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import * as api from "@/api/capturers";
import { resolveProfileImageUrl } from "@/api/client";
import UiIcon from "@/components/shared/UiIcon";
import { formatCurrency } from "@/utils/formatters";
import type { CapturedBusiness, CapturerProfile } from "@/types/capturer";
import CapturerBuyersView from "./CapturerBuyersView";
import CapturerSocialView from "./CapturerSocialView";
import CapturerVideoRepositoryView from "./CapturerVideoRepositoryView";
import { NivelBadge, estadoNegocio, medalCss } from "./capturerMetricsUi";
import CapturerDetailModal from "./CapturerDetailModal";

type Counts = { casas: number; servicios: number };

export default function CapturersPage() {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("TODOS");
  const [region, setRegion] = useState("TODAS");
  const [comuna, setComuna] = useState("TODAS");
  const [tipo, setTipo] = useState("TODAS");
  const [order, setOrder] = useState("RANKING");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CapturerProfile | null>(null);
  const [view, setView] = useState<"CAPTADORES" | "CAPTACIONES" | "COMPRADORES" | "REDES" | "VIDEOS">("CAPTADORES");
  const [aviso, setAviso] = useState("");

  const q = useQuery({
    queryKey: ["trust-capturers"],
    queryFn: api.listCapturers,
  });
  const all = useMemo(
    () => q.data?.filter((c) => c.estado === "APROBADO" && !/^deleted-user-\d+@deleted\.repuestop\.local$/i.test(c.email)) ?? [],
    [q.data],
  );

  // Ranking global histórico: sirve para la columna Ranking, el filtro y el mejor captador.
  const ranking = useQuery({
    queryKey: ["trust-capturers-ranking", all[0]?.id],
    queryFn: () =>
      api.getAdminCapturerRanking(all[0]!.id, "GLOBAL", "HISTORICO"),
    enabled: all.length > 0,
  });
  const rankByAlias = useMemo(() => {
    const map = new Map<string, { posicion: number; puntos: number }>();
    ranking.data?.posiciones.forEach((r) =>
      map.set(r.alias, { posicion: r.posicion, puntos: r.puntos }),
    );
    return map;
  }, [ranking.data]);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return all.filter((c) => {
      if (state !== "TODOS" && (state === "ACTIVO") !== c.activo) return false;
      if (region !== "TODAS" && c.region !== region) return false;
      if (comuna !== "TODAS" && c.comuna !== comuna) return false;
      if (!text) return true;
      return [
        c.nombre,
        c.alias,
        c.email,
        c.rut,
        c.codigoReferido,
        c.comuna,
        c.region,
      ]
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [all, search, state, region, comuna]);

  // Las captaciones se piden por captador; sólo se traen las de la página visible,
  // salvo que el filtro por tipo de captación necesite el listado completo.
  const needsAll = tipo !== "TODAS" || order === "CAPTACIONES";
  const fetchIds = useMemo(
    () =>
      (needsAll
        ? filtered
        : filtered.slice((page - 1) * perPage, page * perPage)
      ).map((c) => c.id),
    [needsAll, filtered, page, perPage],
  );
  const businessQueries = useQueries({
    queries: fetchIds.map((id) => ({
      queryKey: ["capturer-businesses", id],
      queryFn: () => api.getCapturedBusinesses(id),
      staleTime: 60_000,
    })),
  });
  const counts = useMemo(() => {
    const map = new Map<number, Counts>();
    fetchIds.forEach((id, i) => {
      const data = businessQueries[i]?.data;
      if (data)
        map.set(id, {
          casas: data.casasRepuestos.length,
          servicios: data.serviciosAutomotrices.length,
        });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchIds, businessQueries.map((b) => b.dataUpdatedAt).join(",")]);

  const visibles = useMemo(() => {
    const rows = filtered.filter((c) => {
      if (tipo === "TODAS") return true;
      const n = counts.get(c.id);
      if (!n) return false;
      return tipo === "CASAS" ? n.casas > 0 : n.servicios > 0;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (order === "ANTIGUOS")
        return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (order === "NOMBRE") return a.nombre.localeCompare(b.nombre, "es");
      if (order === "RANKING")
        return (
          (rankByAlias.get(a.alias)?.posicion ?? 9e9) -
          (rankByAlias.get(b.alias)?.posicion ?? 9e9)
        );
      if (order === "CAPTACIONES") {
        const ca = counts.get(a.id);
        const cb = counts.get(b.id);
        return (
          (cb?.casas ?? 0) +
          (cb?.servicios ?? 0) -
          ((ca?.casas ?? 0) + (ca?.servicios ?? 0))
        );
      }
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return sorted;
  }, [filtered, tipo, order, counts, rankByAlias]);

  const pages = Math.max(1, Math.ceil(visibles.length / perPage));
  // Al cambiar de región la comuna deja de aplicar: se vuelve a "Todas".
  useEffect(() => {
    setComuna("TODAS");
  }, [region]);
  useEffect(() => {
    setPage(1);
  }, [search, state, region, comuna, tipo, order, perPage]);
  const current = page > pages ? pages : page;
  const rows = visibles.slice((current - 1) * perPage, current * perPage);
  const desde = visibles.length ? (current - 1) * perPage + 1 : 0;
  const hasta = Math.min(current * perPage, visibles.length);

  const regions = useMemo(
    () =>
      [...new Set(all.map((c) => c.region))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [all],
  );
  const comunas = useMemo(
    () =>
      [
        ...new Set(
          all
            .filter((c) => region === "TODAS" || c.region === region)
            .map((c) => c.comuna),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [all, region],
  );
  const activos = all.filter((c) => c.activo).length;
  const conCaptaciones = all.filter(
    (c) => (rankByAlias.get(c.alias)?.puntos ?? 0) > 0,
  ).length;
  const gananciaTotal = all.reduce(
    (acc, c) => acc + Number(c.gananciaMes ?? 0),
    0,
  );
  const hayGanancia = all.some(
    (c) => c.gananciaMes !== undefined && c.gananciaMes !== null,
  );
  const mejor = ranking.data?.posiciones[0];
  const mejorPerfil = mejor && all.find((c) => c.alias === mejor.alias);
  const regionTop = useMemo(() => {
    const tally = new Map<string, number>();
    all.forEach((c) => tally.set(c.region, (tally.get(c.region) ?? 0) + 1));
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [all]);

  return (
    <main className="cps">
      <style>{css + medalCss}</style>
      <header className="cps-head">
        <h1>Captadores</h1>
        <p>
          Gestiona captadores registrados, su estado, rendimiento y datos de
          contacto.
        </p>
      </header>

      <nav className="cps-viewtabs" aria-label="Vistas de captadores">
        <button
          type="button"
          className={
            view === "CAPTADORES" ? "cps-viewtab cps-viewtab-on" : "cps-viewtab"
          }
          onClick={() => setView("CAPTADORES")}
        >
          <UiIcon name="users" />
          Captadores
        </button>
        <button
          type="button"
          className={
            view === "CAPTACIONES"
              ? "cps-viewtab cps-viewtab-on"
              : "cps-viewtab"
          }
          onClick={() => setView("CAPTACIONES")}
        >
          <UiIcon name="store" />
          Captaciones por comuna
        </button>
        <button
          type="button"
          className={view === "COMPRADORES" ? "cps-viewtab cps-viewtab-on" : "cps-viewtab"}
          onClick={() => setView("COMPRADORES")}
        >
          <UiIcon name="cart" />
          Compradores captados
        </button>
        <button
          type="button"
          className={view === "REDES" ? "cps-viewtab cps-viewtab-on" : "cps-viewtab"}
          onClick={() => setView("REDES")}
        >
          <UiIcon name="megaphone" />
          Redes sociales
        </button>
        <button
          type="button"
          className={view === "VIDEOS" ? "cps-viewtab cps-viewtab-on" : "cps-viewtab"}
          onClick={() => setView("VIDEOS")}
        >
          <UiIcon name="video" />
          Repositorio videos
        </button>
      </nav>
      {aviso && <div className="cps-aviso" role="status">{aviso}</div>}

      {view === "COMPRADORES" ? (
        <CapturerBuyersView all={all} />
      ) : view === "REDES" ? (
        <CapturerSocialView />
      ) : view === "VIDEOS" ? (
        <CapturerVideoRepositoryView
          all={all}
          onVerCaptador={(id) => {
            const captador = all.find((c) => c.id === id);
            setAviso(captador ? "" : "El perfil de este captador ya no está disponible (fue eliminado o no está aprobado).");
            if (captador) setSelected(captador);
          }}
        />
      ) : view === "CAPTACIONES" ? (
        <CaptacionesView all={all} />
      ) : (
        <>
          <div className="cps-top">
            <div className="cps-top-main">
              <section className="cps-stats">
                <Stat
                  icon="users"
                  tone="blue"
                  label="Captadores registrados"
                  value={String(all.length)}
                  foot="Aprobados en el sistema"
                />
                <Stat
                  icon="shieldCheck"
                  tone="green"
                  label="Activos"
                  value={String(activos)}
                  foot={`${pct(activos, all.length)} del total`}
                />
                <Stat
                  icon="shieldX"
                  tone="red"
                  label="Suspendidos"
                  value={String(all.length - activos)}
                  foot={`${pct(all.length - activos, all.length)} del total`}
                />
                <Stat
                  icon="target"
                  tone="violet"
                  label="Con captaciones"
                  value={ranking.isLoading ? "—" : String(conCaptaciones)}
                  foot="Con puntos acumulados"
                />
                <Stat
                  icon="wallet"
                  tone="blue"
                  label="Ganancia generada este mes"
                  value={hayGanancia ? formatCurrency(gananciaTotal) : "—"}
                  foot={
                    hayGanancia
                      ? "Comisiones del período"
                      : "Sin datos del período"
                  }
                />
              </section>

              <section className="cps-filters">
                <label className="cps-search">
                  <UiIcon name="search" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, alias, correo, RUT, código o ubicación..."
                  />
                </label>
                <Select
                  label="Estado"
                  value={state}
                  onChange={setState}
                  opts={[
                    ["TODOS", "Todos"],
                    ["ACTIVO", "Activos"],
                    ["SUSPENDIDO", "Suspendidos"],
                  ]}
                />
                <Select
                  label="Región"
                  value={region}
                  onChange={setRegion}
                  opts={[
                    ["TODAS", "Todas"],
                    ...regions.map((r): [string, string] => [r, r]),
                  ]}
                />
                <Select
                  label="Comuna"
                  value={comuna}
                  onChange={setComuna}
                  opts={[
                    ["TODAS", "Todas"],
                    ...comunas.map((x): [string, string] => [x, x]),
                  ]}
                />
                <Select
                  label="Tipo de captación"
                  value={tipo}
                  onChange={setTipo}
                  opts={[
                    ["TODAS", "Todas"],
                    ["CASAS", "Casas de repuestos"],
                    ["SERVICIOS", "Servicios automotrices"],
                  ]}
                />
                <Select
                  label="Ordenar por"
                  value={order}
                  onChange={setOrder}
                  opts={[
                    ["RECIENTES", "Más recientes"],
                    ["ANTIGUOS", "Más antiguos"],
                    ["NOMBRE", "Nombre A-Z"],
                    ["RANKING", "Mejor ranking"],
                    ["CAPTACIONES", "Más captaciones"],
                  ]}
                />
                <button
                  type="button"
                  className="cps-reset"
                  title="Limpiar filtros"
                  aria-label="Limpiar filtros"
                  onClick={() => {
                    setSearch("");
                    setState("TODOS");
                    setRegion("TODAS");
                    setComuna("TODAS");
                    setTipo("TODAS");
                    setOrder("RANKING");
                  }}
                >
                  <UiIcon name="filter" />
                </button>
              </section>
            </div>

            <aside className="cps-insights">
              <strong className="cps-insights-title">Insights rápidos</strong>
              <Insight
                tone="blue"
                icon="crown"
                title="Mejor captador global"
                value={mejorPerfil?.nombre || mejor?.alias || "—"}
                foot={
                  mejor
                    ? `${mejor.puntos.toLocaleString("es-CL")} puntos acumulados`
                    : "Sin datos de ranking"
                }
              />
              <Insight
                tone="green"
                icon="target"
                title="Región con más captadores"
                value={regionTop?.[0] || "—"}
                foot={regionTop ? `${regionTop[1]} captadores` : "Sin datos"}
              />
              <Insight
                tone="violet"
                icon="trendUp"
                title="Tasa de activación"
                value={all.length ? pct(activos, all.length) : "—"}
                foot="Activos / Registrados"
              />
            </aside>
          </div>

          <section className="cps-table-card">
            <div className="cps-table-wrap">
              <table className="cps-table cps-table-fixed" style={{ minWidth: 980 }}>
                <colgroup>
                  <col style={{ width: "15.5%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10.5%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Captador</th>
                    <th>Código</th>
                    <th>Contacto</th>
                    <th>Ubicación</th>
                    <th>Estado</th>
                    <th>Captaciones</th>
                    <th>Ranking</th>
                    <th className="cps-num" title="Ganancia del mes">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {q.isLoading ? (
                    <tr>
                      <td colSpan={8} className="cps-empty">
                        Cargando captadores…
                      </td>
                    </tr>
                  ) : rows.length ? (
                    rows.map((c, i) => {
                      const n = counts.get(c.id);
                      const pos = rankByAlias.get(c.alias)?.posicion;
                      const foto = resolveProfileImageUrl(c.fotoPerfil);
                      return (
                        <tr key={c.id} className="cps-row-click" onClick={() => setSelected(c)}
                          tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelected(c); }}
                          aria-label={`Ver detalle de ${c.nombre}`}>
                          <td>
                            <div className="cps-person">
                              <span className="cps-avatar" style={{ background: colors[(c.id + i) % colors.length] }}>
                                {foto ? (
                                  <img src={foto} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                ) : (
                                  initials(c.nombre)
                                )}
                              </span>
                              <div className="cps-two">
                                <strong title={c.nombre}>{c.nombre}</strong>
                                <small title={`@${c.alias}`}>@{c.alias}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="cps-code" title={c.codigoReferido || ""}>{c.codigoReferido || "—"}</span>
                          </td>
                          <td>
                            <div className="cps-two">
                              <span title={c.email}>{c.email}</span>
                              <small>{c.telefono || "Sin teléfono"}</small>
                            </div>
                          </td>
                          <td>
                            <div className="cps-two">
                              <span title={c.comuna}>{c.comuna}</span>
                              <small title={c.region}>{c.region}</small>
                            </div>
                          </td>
                          <td>
                            <div className="cps-two">
                              <span>
                                <span className={c.activo ? "cps-pill cps-pill-on" : "cps-pill cps-pill-off"}>
                                  {c.activo ? "Activo" : "Suspendido"}
                                </span>
                              </span>
                              <small>{new Date(c.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}</small>
                            </div>
                          </td>
                          <td>
                            <div className="cps-kinds" aria-label="Casas, servicios y compradores con compra">
                              <span title="Casas de repuestos"><UiIcon name="store" />{n ? n.casas : "–"}</span>
                              <span title="Servicios automotrices"><UiIcon name="settings" />{n ? n.servicios : "–"}</span>
                              <span title="Compradores que ya compraron"><UiIcon name="cart" />{c.compradoresConvertidos ?? 0}</span>
                            </div>
                          </td>
                          <td>
                            <div className="cps-two">
                              <span>
                                {pos ? (
                                  <span className={`cps-rank${pos <= 3 ? " cps-rank-top" : ""}`}>
                                    {pos <= 3 && <span className="cps-medal" aria-hidden="true">{["🥇", "🥈", "🥉"][pos - 1]}</span>}
                                    #{pos}
                                  </span>
                                ) : (
                                  <span className="cps-rank cps-rank-none">—</span>
                                )}
                              </span>
                              <small><NivelBadge nivel={c.nivelSocial} /></small>
                            </div>
                          </td>
                          <td className="cps-num">
                            <strong className="cps-money">
                              {c.gananciaMes !== undefined && c.gananciaMes !== null ? formatCurrency(c.gananciaMes) : "—"}
                            </strong>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="cps-empty">
                        No hay captadores que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="cps-foot">
              <span>
                Mostrando {desde} a {hasta} de {visibles.length} captadores
              </span>
              <div className="cps-pager">
                <label className="cps-perpage">
                  <select
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    aria-label="Filas por página"
                  >
                    {[10, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  por página
                </label>
                <button
                  type="button"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                  aria-label="Página anterior"
                >
                  ‹
                </button>
                {pageList(current, pages).map((p, i) =>
                  p === "…" ? (
                    <span key={`gap${i}`} className="cps-gap">
                      …
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={p}
                      className={
                        p === current ? "cps-page cps-page-on" : "cps-page"
                      }
                      onClick={() => setPage(Number(p))}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                  aria-label="Página siguiente"
                >
                  ›
                </button>
              </div>
            </footer>
          </section>
        </>
      )}

      {selected && (
        <CapturerDetailModal c={selected} ranking={rankByAlias.get(selected.alias)} close={() => setSelected(null)} />
      )}
    </main>
  );
}

type Captacion = {
  key: string;
  tipo: "CASA" | "SERVICIO";
  nombre: string;
  estado: string;
  fecha: string;
  region: string;
  comuna: string;
  captador: string;
  alias: string;
  ventas: number;
  ingreso: number;
};
const CHILE_REGIONES_COMUNAS: Record<string, string[]> = {
  "Arica y Parinacota": ["Arica", "Camarones", "General Lagos", "Putre"],
  "Tarapacá": ["Alto Hospicio", "Camiña", "Colchane", "Huara", "Iquique", "Pica", "Pozo Almonte"],
  "Antofagasta": ["Antofagasta", "Calama", "María Elena", "Mejillones", "Ollagüe", "San Pedro de Atacama", "Sierra Gorda", "Taltal", "Tocopilla"],
  "Atacama": ["Alto del Carmen", "Caldera", "Chañaral", "Copiapó", "Diego de Almagro", "Freirina", "Huasco", "Tierra Amarilla", "Vallenar"],
  "Coquimbo": ["Andacollo", "Canela", "Combarbalá", "Coquimbo", "Illapel", "La Higuera", "La Serena", "Los Vilos", "Monte Patria", "Ovalle", "Paihuano", "Punitaqui", "Río Hurtado", "Salamanca", "Vicuña"],
  "Valparaíso": ["Algarrobo", "Cabildo", "Calle Larga", "Cartagena", "Casablanca", "Catemu", "Concón", "El Quisco", "El Tabo", "Hijuelas", "Isla de Pascua", "Juan Fernández", "La Calera", "La Cruz", "La Ligua", "Limache", "Llaillay", "Los Andes", "Nogales", "Olmué", "Panquehue", "Papudo", "Petorca", "Puchuncaví", "Putaendo", "Quillota", "Quilpué", "Quintero", "Rinconada", "San Antonio", "San Esteban", "San Felipe", "Santa María", "Santo Domingo", "Valparaíso", "Villa Alemana", "Viña del Mar", "Zapallar"],
  "Metropolitana de Santiago": ["Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví", "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "María Pinto", "Melipilla", "Ñuñoa", "Padre Hurtado", "Paine", "Pedro Aguirre Cerda", "Peñaflor", "Peñalolén", "Pirque", "Providencia", "Pudahuel", "Puente Alto", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Bernardo", "San Joaquín", "San José de Maipo", "San Miguel", "San Pedro", "San Ramón", "Santiago", "Talagante", "Tiltil", "Vitacura"],
  "Libertador General Bernardo O'Higgins": ["Chépica", "Chimbarongo", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "La Estrella", "Las Cabras", "Litueche", "Lolol", "Machalí", "Malloa", "Marchigüe", "Mostazal", "Nancagua", "Navidad", "Olivar", "Palmilla", "Paredones", "Peralillo", "Peumo", "Pichidegua", "Pichilemu", "Placilla", "Pumanque", "Quinta de Tilcoco", "Rancagua", "Rengo", "Requínoa", "San Fernando", "San Vicente", "Santa Cruz"],
  "Maule": ["Cauquenes", "Chanco", "Colbún", "Constitución", "Curepto", "Curicó", "Empedrado", "Hualañé", "Licantén", "Linares", "Longaví", "Maule", "Molina", "Parral", "Pelarco", "Pelluhue", "Pencahue", "Rauco", "Retiro", "Río Claro", "Romeral", "Sagrada Familia", "San Clemente", "San Javier", "San Rafael", "Talca", "Teno", "Vichuquén", "Villa Alegre", "Yerbas Buenas"],
  "Ñuble": ["Bulnes", "Chillán", "Chillán Viejo", "Cobquecura", "Coelemu", "Coihueco", "El Carmen", "Ninhue", "Ñiquén", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil", "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Treguaco", "Yungay"],
  "Biobío": ["Alto Biobío", "Antuco", "Arauco", "Cabrero", "Cañete", "Chiguayante", "Concepción", "Contulmo", "Coronel", "Curanilahue", "Florida", "Hualpén", "Hualqui", "Laja", "Lebu", "Los Álamos", "Los Ángeles", "Lota", "Mulchén", "Nacimiento", "Negrete", "Penco", "Quilaco", "Quilleco", "San Pedro de la Paz", "San Rosendo", "Santa Bárbara", "Santa Juana", "Talcahuano", "Tirúa", "Tomé", "Tucapel", "Yumbel"],
  "La Araucanía": ["Angol", "Carahue", "Cholchol", "Collipulli", "Cunco", "Curacautín", "Curarrehue", "Ercilla", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Lonquimay", "Los Sauces", "Lumaco", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Purén", "Renaico", "Saavedra", "Temuco", "Teodoro Schmidt", "Toltén", "Traiguén", "Victoria", "Vilcún", "Villarrica"],
  "Los Ríos": ["Corral", "Futrono", "La Unión", "Lago Ranco", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "Río Bueno", "Valdivia"],
  "Los Lagos": ["Ancud", "Calbuco", "Castro", "Chaitén", "Chonchi", "Cochamó", "Curaco de Vélez", "Dalcahue", "Fresia", "Frutillar", "Futaleufú", "Hualaihué", "Llanquihue", "Los Muermos", "Maullín", "Osorno", "Palena", "Puerto Montt", "Puerto Octay", "Puerto Varas", "Puqueldón", "Purranque", "Puyehue", "Queilén", "Quellón", "Quemchi", "Quinchao", "Río Negro", "San Juan de la Costa", "San Pablo"],
  "Aysén del General Carlos Ibáñez del Campo": ["Aysén", "Chile Chico", "Cisnes", "Cochrane", "Coyhaique", "Guaitecas", "Lago Verde", "O'Higgins", "Río Ibáñez", "Tortel"],
  "Magallanes y de la Antártica Chilena": ["Antártica", "Cabo de Hornos", "Laguna Blanca", "Natales", "Porvenir", "Primavera", "Punta Arenas", "Río Verde", "San Gregorio", "Timaukel", "Torres del Paine"],
};

function normalizeGeoString(val: string): string {
  return (val || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findMatchingRegion(regionName: string): string | null {
  if (!regionName) return null;
  const norm = normalizeGeoString(regionName);
  if (norm.includes("biobio") || norm.includes("bio bio")) return "Biobío";
  if (norm.includes("metropolitana") || norm.includes("santiago")) return "Metropolitana de Santiago";
  if (norm.includes("higgins")) return "Libertador General Bernardo O'Higgins";
  if (norm.includes("araucania")) return "La Araucanía";
  if (norm.includes("aysen")) return "Aysén del General Carlos Ibáñez del Campo";
  if (norm.includes("magallanes") || norm.includes("antartica")) return "Magallanes y de la Antártica Chilena";
  if (norm.includes("nuble")) return "Ñuble";
  if (norm.includes("rios")) return "Los Ríos";
  if (norm.includes("lagos")) return "Los Lagos";
  if (norm.includes("arica") || norm.includes("parinacota")) return "Arica y Parinacota";
  if (norm.includes("tarapaca")) return "Tarapacá";
  if (norm.includes("antofagasta")) return "Antofagasta";
  if (norm.includes("atacama")) return "Atacama";
  if (norm.includes("coquimbo")) return "Coquimbo";
  if (norm.includes("valparaiso")) return "Valparaíso";
  if (norm.includes("maule")) return "Maule";

  for (const reg of Object.keys(CHILE_REGIONES_COMUNAS)) {
    const regNorm = normalizeGeoString(reg);
    if (norm === regNorm || norm.includes(regNorm) || regNorm.includes(norm)) {
      return reg;
    }
  }
  return null;
}

function matchRegion(itemRegion: string, selectedRegion: string): boolean {
  if (selectedRegion === "TODAS") return true;
  if (!itemRegion) return false;
  if (itemRegion === selectedRegion) return true;
  const normItem = normalizeGeoString(itemRegion);
  const normSelected = normalizeGeoString(selectedRegion);
  if (normItem === normSelected) return true;
  const matchItem = findMatchingRegion(itemRegion);
  const matchSelected = findMatchingRegion(selectedRegion);
  return (matchItem && matchSelected && matchItem === matchSelected) || matchItem === selectedRegion;
}

function matchComuna(itemComuna: string, selectedComuna: string): boolean {
  if (selectedComuna === "TODAS") return true;
  if (!itemComuna) return false;
  if (itemComuna === selectedComuna) return true;
  return normalizeGeoString(itemComuna) === normalizeGeoString(selectedComuna);
}

function CaptacionesView({ all }: { all: CapturerProfile[] }) {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("TODAS");
  const [comuna, setComuna] = useState("TODAS");
  const [tipo, setTipo] = useState("TODAS");
  const [order, setOrder] = useState("RECIENTES");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const queries = useQueries({
    queries: all.map((c) => ({
      queryKey: ["capturer-businesses", c.id],
      queryFn: () => api.getCapturedBusinesses(c.id),
      staleTime: 60_000,
    })),
  });
  const listos = queries.filter((x) => !x.isLoading).length;
  const cargando = listos < all.length;

  const captaciones = useMemo<Captacion[]>(() => {
    const out: Captacion[] = [];
    all.forEach((c, i) => {
      const data = queries[i]?.data;
      if (!data) return;
      const push = (b: CapturedBusiness, t: Captacion["tipo"]) =>
        out.push({
          key: `${t}-${b.id}`,
          tipo: t,
          nombre: b.nombre,
          estado: b.estado,
          fecha: b.fecha,
          region: b.region || c.region,
          comuna: b.comuna || c.comuna,
          captador: c.nombre,
          alias: c.alias,
          ventas: Number(b.ventas ?? 0),
          ingreso: Number(b.ingresoCaptador ?? 0),
        });
      data.casasRepuestos.forEach((b) => push(b, "CASA"));
      data.serviciosAutomotrices.forEach((b) => push(b, "SERVICIO"));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, queries.map((x) => x.dataUpdatedAt).join(",")]);

  const filteredCaptaciones = useMemo(() => {
    const text = search.trim().toLowerCase();
    return captaciones.filter(
      (x) =>
        matchRegion(x.region, region) &&
        matchComuna(x.comuna, comuna) &&
        (tipo === "TODAS" ||
          (tipo === "CASAS" ? x.tipo === "CASA" : x.tipo === "SERVICIO")) &&
        (!text ||
          `${x.nombre} ${x.captador} ${x.alias} ${x.comuna} ${x.region}`
            .toLowerCase()
            .includes(text)),
    );
  }, [captaciones, search, region, comuna, tipo]);

  const totalVentas = useMemo(
    () => filteredCaptaciones.reduce((acc, x) => acc + x.ventas, 0),
    [filteredCaptaciones],
  );
  const totalIngreso = useMemo(
    () => filteredCaptaciones.reduce((acc, x) => acc + x.ingreso, 0),
    [filteredCaptaciones],
  );
  const totalCasas = useMemo(
    () => filteredCaptaciones.filter((x) => x.tipo === "CASA").length,
    [filteredCaptaciones],
  );
  const totalServicios = useMemo(
    () => filteredCaptaciones.filter((x) => x.tipo === "SERVICIO").length,
    [filteredCaptaciones],
  );

  const hasActiveFilters = Boolean(
    search.trim() || region !== "TODAS" || comuna !== "TODAS" || tipo !== "TODAS",
  );

  const allRegionsList = useMemo(() => {
    return Object.keys(CHILE_REGIONES_COMUNAS);
  }, []);

  const comunas = useMemo(() => {
    if (region !== "TODAS") {
      const canonicalRegion = findMatchingRegion(region) || region;
      const list = CHILE_REGIONES_COMUNAS[canonicalRegion] || [];
      const extraComunas = captaciones
        .filter((c) => matchRegion(c.region, region) && c.comuna)
        .map((c) => c.comuna.trim());
      const set = new Set([...list, ...extraComunas]);
      return [...set].sort((a, b) => a.localeCompare(b, "es"));
    }
    const allComunas = Object.values(CHILE_REGIONES_COMUNAS).flat();
    const extraComunas = captaciones.filter((c) => c.comuna).map((c) => c.comuna.trim());
    const set = new Set([...allComunas, ...extraComunas]);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [region, captaciones]);

  const comunaCounts = useMemo(() => {
    const map = new Map<string, number>();
    captaciones.forEach((x) => {
      if (!x.comuna) return;
      if (region !== "TODAS" && !matchRegion(x.region, region)) return;
      const norm = normalizeGeoString(x.comuna);
      map.set(norm, (map.get(norm) ?? 0) + 1);
    });
    return map;
  }, [captaciones, region]);

  useEffect(() => {
    setComuna("TODAS");
  }, [region]);

  useEffect(() => {
    setPage(1);
  }, [search, region, comuna, tipo, order, perPage]);

  const detalle = useMemo(() => {
    const sorted = [...filteredCaptaciones];
    sorted.sort((a, b) => {
      if (order === "ANTIGUOS") return +new Date(a.fecha) - +new Date(b.fecha);
      if (order === "INGRESO") return b.ingreso - a.ingreso;
      if (order === "VENTAS") return b.ventas - a.ventas;
      if (order === "COMUNA") return a.comuna.localeCompare(b.comuna, "es");
      return +new Date(b.fecha) - +new Date(a.fecha);
    });
    return sorted;
  }, [filteredCaptaciones, order]);

  const pages = Math.max(1, Math.ceil(detalle.length / perPage));
  const current = page > pages ? pages : page;
  const rows = detalle.slice((current - 1) * perPage, current * perPage);
  const desde = detalle.length ? (current - 1) * perPage + 1 : 0;
  const hasta = Math.min(current * perPage, detalle.length);

  return (
    <>
      <section className="cps-stats cps-stats-5">
        <Stat
          icon="target"
          tone="blue"
          label="Captaciones totales"
          value={String(filteredCaptaciones.length)}
          foot={
            cargando
              ? `Cargando ${listos}/${all.length} captadores…`
              : hasActiveFilters
                ? `${filteredCaptaciones.length} de ${captaciones.length} captaciones`
                : `De ${all.length} captadores`
          }
        />
        <Stat
          icon="store"
          tone="green"
          label="Casas de repuestos"
          value={String(totalCasas)}
          foot={
            hasActiveFilters
              ? `${totalCasas} ${totalCasas === 1 ? 'negocio filtrado' : 'negocios filtrados'}`
              : "Negocios captados"
          }
        />
        <Stat
          icon="settings"
          tone="violet"
          label="Servicios automotrices"
          value={String(totalServicios)}
          foot={
            hasActiveFilters
              ? `${totalServicios} ${totalServicios === 1 ? 'taller filtrado' : 'talleres filtrados'}`
              : "Talleres y servicios"
          }
        />
        <Stat
          icon="barChart"
          tone="blue"
          label="Monto base generado"
          value={formatCurrency(totalVentas)}
          foot={
            hasActiveFilters
              ? "Total negocios filtrados"
              : "Total de los negocios captados"
          }
        />
        <Stat
          icon="wallet"
          tone="green"
          label="Ingreso de captadores"
          value={formatCurrency(totalIngreso)}
          foot={
            hasActiveFilters
              ? "Comisiones filtradas"
              : "Comisiones asociadas"
          }
        />
      </section>

      <section className="cps-filters">
        <label className="cps-search">
          <UiIcon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por negocio, captador, comuna o región..."
          />
        </label>
        <Select
          label="Región"
          value={region}
          onChange={setRegion}
          opts={[
            ["TODAS", "Todas"],
            ...allRegionsList.map((r): [string, string] => [r, r]),
          ]}
        />
        <Select
          label="Comuna"
          value={comuna}
          onChange={setComuna}
          opts={[
            ["TODAS", "Todas"],
            ...comunas.map((c): [string, string] => {
              const count = comunaCounts.get(normalizeGeoString(c)) ?? 0;
              return [c, `${c} (${count})`];
            }),
          ]}
        />
        <Select
          label="Tipo de negocio"
          value={tipo}
          onChange={setTipo}
          opts={[
            ["TODAS", "Todos"],
            ["CASAS", "Casas de repuestos"],
            ["SERVICIOS", "Servicios automotrices"],
          ]}
        />
        <Select
          label="Ordenar por"
          value={order}
          onChange={setOrder}
          opts={[
            ["RECIENTES", "Más recientes"],
            ["ANTIGUOS", "Más antiguos"],
            ["INGRESO", "Mayor ingreso"],
            ["VENTAS", "Mayor monto base"],
            ["COMUNA", "Comuna A-Z"],
          ]}
        />
        <button
          type="button"
          className="cps-reset"
          title="Limpiar filtros"
          aria-label="Limpiar filtros"
          onClick={() => {
            setSearch("");
            setRegion("TODAS");
            setComuna("TODAS");
            setTipo("TODAS");
            setOrder("RECIENTES");
          }}
        >
          <UiIcon name="filter" />
        </button>
      </section>

      <section className="cps-table-card">
        <div className="cps-block-head">
          <h2>Detalle de captaciones</h2>
          <p>
            Cada casa de repuestos o servicio automotriz captado, con su
            ubicación, captador e ingreso generado.
          </p>
        </div>
        <div className="cps-table-wrap">
          <table className="cps-table cps-table-fixed" style={{ minWidth: 960 }}>
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "15.5%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12.5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Tipo</th>
                <th>Ubicación</th>
                <th>Captado por</th>
                <th className="cps-num">Monto base</th>
                <th className="cps-num">Ingreso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargando && !captaciones.length ? (
                <tr>
                  <td colSpan={7} className="cps-empty">
                    Cargando captaciones… ({listos}/{all.length})
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((x, i) => {
                  const est = estadoNegocio(x.estado);
                  return (
                    <tr key={x.key}>
                      <td>
                        <div className="cps-person">
                          <span className="cps-avatar" style={{ background: colors[i % colors.length] }}>
                            {initials(x.nombre)}
                          </span>
                          <div className="cps-two">
                            <strong title={x.nombre}>{x.nombre}</strong>
                            <small>Desde {x.fecha ? new Date(x.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`cps-chip cps-chip-${x.tipo === "CASA" ? "blue" : "violet"}`}>
                          {x.tipo === "CASA" ? "Casa de repuestos" : "Servicio automotriz"}
                        </span>
                      </td>
                      <td>
                        <div className="cps-two">
                          <span className="cps-cell-strong" title={x.comuna}>{x.comuna}</span>
                          <small title={x.region}>{x.region}</small>
                        </div>
                      </td>
                      <td>
                        <div className="cps-two">
                          <span title={x.captador}>{x.captador}</span>
                          <small>@{x.alias}</small>
                        </div>
                      </td>
                      <td className="cps-num">{formatCurrency(x.ventas)}</td>
                      <td className="cps-num">
                        <strong className="cps-money cps-money-green">{formatCurrency(x.ingreso)}</strong>
                      </td>
                      <td>
                        <span className={`cps-pill cps-pill-${est.tone}`}>{est.label}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="cps-empty">
                    No hay captaciones que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="cps-foot">
          <span>
            Mostrando {desde} a {hasta} de {detalle.length} captaciones
          </span>
          <div className="cps-pager">
            <label className="cps-perpage">
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                aria-label="Filas por página"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              por página
            </label>
            <button
              type="button"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Página anterior"
            >
              ‹
            </button>
            {pageList(current, pages).map((p, i) =>
              p === "…" ? (
                <span key={`gap${i}`} className="cps-gap">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={p}
                  className={
                    p === current ? "cps-page cps-page-on" : "cps-page"
                  }
                  onClick={() => setPage(Number(p))}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
              aria-label="Página siguiente"
            >
              ›
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  foot,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  foot: string;
  tone: Tone;
}) {
  return (
    <article className="cps-stat">
      <span className={`cps-ico cps-${tone}`}>
        <UiIcon name={icon} />
      </span>
      <div>
        <span className="cps-stat-label">{label}</span>
        <strong className="cps-stat-value">{value}</strong>
        <small className="cps-stat-foot">{foot}</small>
      </div>
    </article>
  );
}

function Insight({
  icon,
  title,
  value,
  foot,
  tone,
}: {
  icon: string;
  title: string;
  value: string;
  foot: string;
  tone: Tone;
}) {
  return (
    <div className={`cps-insight cps-insight-${tone}`}>
      <span className={`cps-ico cps-${tone}`}>
        <UiIcon name={icon} />
      </span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <small>{foot}</small>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: Array<[string, string]>;
}) {
  return (
    <label className="cps-field">
      <small>{label}</small>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map(([v, l]) => (
          <option value={v} key={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

type Tone = "blue" | "green" | "red" | "violet";
const colors = [
  "#1462e8",
  "#07845a",
  "#7040d7",
  "#ef3e75",
  "#0f766e",
  "#b45309",
];
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const pct = (part: number, total: number) =>
  total ? `${((part / total) * 100).toFixed(1).replace(".", ",")}%` : "—";
function pageList(current: number, pages: number): Array<number | "…"> {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, 3, current, pages]);
  if (current > 3) {
    set.add(current - 1);
    set.add(current + 1);
  }
  const nums = [...set]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  nums.forEach((n, i) => {
    if (i && n - (nums[i - 1] as number) > 1) out.push("…");
    out.push(n);
  });
  return out;
}

const css = `
.cps{--ink:#0f2c5c;--muted:#5b6f96;--line:#e6edf7;padding:26px max(18px,2vw) 40px;background:#f7f9fd;min-height:100%;color:var(--ink);font-family:Inter,system-ui,sans-serif}
.cps *{box-sizing:border-box}
.cps-head h1{margin:0;font-size:32px;font-weight:850;letter-spacing:-.02em}
.cps-head p{margin:6px 0 20px;color:var(--muted);font-size:14px}
.cps-top{display:grid;grid-template-columns:minmax(0,1fr) 224px;gap:14px;align-items:start;margin-bottom:16px}
@media (max-width:1680px){.cps-top{grid-template-columns:minmax(0,1fr)}.cps-insights{grid-template-columns:repeat(3,minmax(0,1fr))}.cps-insights-title{grid-column:1/-1}}
.cps-top-main{display:grid;gap:14px;min-width:0}

.cps-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}
.cps-stat{display:flex;align-items:flex-start;gap:10px;min-height:108px;padding:14px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 6px 18px rgba(15,44,92,.04)}
.cps-stat>div{min-width:0}
.cps-stat-label{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em;font-size:11.5px;font-weight:600;color:#42557d;line-height:1.3}
.cps-stat-value{display:block;margin-top:6px;font-size:25px;font-weight:850;letter-spacing:-.02em;white-space:nowrap}
.cps-stat-foot{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:4px;font-size:11px;color:var(--muted);line-height:1.35}
.cps-ico{display:grid;place-items:center;width:40px;height:40px;flex:0 0 auto;border-radius:50%}
.cps-ico svg{width:19px;height:19px}
.cps-blue{background:#e6efff;color:#1657d9}
.cps-green{background:#e2f7ec;color:#0f8a4d}
.cps-red{background:#ffe6ea;color:#e0294b}
.cps-violet{background:#f0eafe;color:#6d3fd6}

.cps-filters{display:flex;align-items:flex-end;gap:9px;flex-wrap:nowrap;padding:14px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 6px 18px rgba(15,44,92,.04)}
.cps-search{display:flex;align-items:center;gap:8px;flex:3 1 200px;min-width:180px;height:42px;padding:0 12px;border:1px solid #dbe5f3;border-radius:11px;color:var(--muted)}
.cps-search svg{width:17px;height:17px;flex:0 0 auto}
.cps-search input{width:100%;border:0;outline:0;font:inherit;font-size:13px;color:var(--ink);background:transparent}
.cps-field{display:grid;gap:5px;flex:1 1 96px;min-width:86px}
.cps-field small{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cps-field select{width:100%;min-width:0;text-overflow:ellipsis}
.cps-field select,.cps-perpage select{height:42px;padding:0 10px;border:1px solid #dbe5f3;border-radius:11px;background:#fff;font:inherit;font-size:13px;color:var(--ink);cursor:pointer}
.cps-reset{flex:0 0 auto;display:grid;place-items:center;width:42px;height:42px;border:1px solid #dbe5f3;border-radius:11px;background:#fff;color:#31456e;cursor:pointer}
.cps-reset:hover{background:#f2f7ff}

.cps-insights{padding:12px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 6px 18px rgba(15,44,92,.04);display:grid;gap:8px;align-content:start}
.cps-insights-title{font-size:13.5px;font-weight:800}
.cps-insight{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:12px}
.cps-insight>div{min-width:0}
.cps-insight small{display:block;font-size:10.5px;line-height:1.35;color:var(--muted)}
.cps-insight strong{display:block;margin:2px 0;font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cps-insight-blue{background:#eef4ff}
.cps-insight-green{background:#eafaf1}
.cps-insight-violet{background:#f4efff}
.cps-insight .cps-ico{width:34px;height:34px;background:#fff}
.cps-insight .cps-ico svg{width:17px;height:17px}

.cps-table-card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 6px 18px rgba(15,44,92,.04);overflow:hidden}
.cps-table-wrap{overflow-x:auto}
.cps-table{width:100%;border-collapse:collapse;font-size:13px}
.cps-table th{padding:13px 11px;text-align:left;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7286a8;border-bottom:1px solid var(--line);white-space:nowrap}
.cps-table td{padding:11px 11px;border-bottom:1px solid #f1f5fb;vertical-align:middle;color:#31456e}
.cps-table tbody tr:last-child td{border-bottom:0}
.cps-table tbody tr:hover{background:#f8fbff}
.cps-table td small{display:block;margin-top:3px;font-size:12px;color:var(--muted);white-space:nowrap}
/* Tablas de ancho fijo: columnas proporcionales, maximo 2 lineas por celda (dato + detalle) y
   sin cortes de palabra; si el texto no cabe se abrevia con "…" y el dato completo va en el title. */
.cps-table-fixed{table-layout:fixed;overflow-wrap:normal;word-break:normal}
.cps-table-fixed td{padding:10px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cps-table-fixed th{padding:12px 8px;overflow:hidden;text-overflow:ellipsis;letter-spacing:.04em}
.cps-table-fixed td:first-child,.cps-table-fixed th:first-child{padding-left:12px}
.cps-table-fixed .cps-person strong{font-size:13px}
.cps-table-fixed td:last-child,.cps-table-fixed th:last-child{padding-right:14px}
.cps-table-fixed .cps-avatar{width:30px;height:30px;font-size:12px}
.cps-table-fixed .cps-person{gap:7px}
.cps-table-fixed .cps-code{padding:0;background:none;font-size:12px}
.cps-table-fixed .cps-pill{padding:4px 9px;font-size:11.5px}
.cps-table-fixed .cps-rank{padding:3px 8px;font-size:12.5px}
.cps-table-fixed .cpx-medal{padding:2px 7px;font-size:11px;gap:5px}
.cps-table-fixed .cps-num{text-align:right}
.cps-two{display:grid;min-width:0}
.cps-two>*{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cps-two strong{font-size:13px;color:var(--ink)}
.cps-two>span{font-size:13px;color:#31456e}
.cps-two small{margin-top:3px!important;font-size:12px}
.cps-table-fixed .cps-person{min-width:0}
.cps-table-fixed .cps-person>div{min-width:0}
.cps-row-click{cursor:pointer}
.cps-row-click:focus-visible{outline:2px solid #1657d9;outline-offset:-2px}
.cps-kinds{display:flex;gap:7px}
.cps-kinds span{display:inline-flex;align-items:center;gap:3px;color:#0f2c5c;font-size:13px;font-weight:800}
.cps-kinds svg{width:13px;height:13px;color:#7286a8}
.cps-money.cps-money-green{color:#087b42}
.cps-pill-wait{background:#fef2e0;color:#a86a08}
.cps-pill-neutral{background:#eef2f9;color:#52678f}
.cps-chip{display:inline-block;max-width:100%;padding:4px 9px;border-radius:99px;font-size:11.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.cps-chip-blue{background:#e9f1ff;color:#1d59bf}
.cps-chip-violet{background:#f1eaff;color:#6d3fd6}
.cps-cell-strong{font-weight:700}
.cps-person{display:flex;align-items:center;gap:10px}
.cps-person strong{display:block;font-size:13.5px;color:var(--ink);white-space:nowrap}
.cps-avatar{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:50%;color:#fff;font-size:13px;font-weight:800;overflow:hidden}
.cps-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.cps-tag{display:inline-block;margin-top:4px;padding:2px 7px;border-radius:6px;background:#eaf1ff;color:#165ed4;font-size:11px;font-weight:700}
.cps-code{display:inline-block;max-width:100%;padding:4px 8px;border-radius:8px;background:#f1f5fb;font-size:12px;font-weight:800;letter-spacing:.01em;color:#315287;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.cps-line{display:block;color:#31456e;white-space:nowrap}
.cps-pill{display:inline-block;padding:5px 11px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap}
.cps-pill-on{background:#dcf7e8;color:#087b42}
.cps-pill-off{background:#ffe1e6;color:#df2046}
.cps-counts{display:grid;gap:3px;font-size:12.5px;color:var(--muted);white-space:nowrap}
.cps-counts b{margin-left:6px;color:var(--ink)}
.cps-money{font-size:13.5px;font-weight:800;color:var(--ink);white-space:nowrap}
.cps-rank{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid #dce6f3;border-radius:99px;font-weight:700;color:#31456e}
.cps-rank-top{border-color:#f2dfae;background:#fffaef;color:#8a6412}
.cps-rank-none{color:#93a4c0}
.cps-medal{font-size:14px}
.cps-date{white-space:nowrap;color:var(--muted)}
.cps-actions{display:flex;gap:6px}
.cps-actions button{display:grid;place-items:center;width:32px;height:32px;border:1px solid #dce6f3;border-radius:9px;background:#fff;color:#20457a;cursor:pointer}
.cps-actions button:hover{background:#f2f7ff;border-color:#bcd2f0}
.cps-actions svg{width:16px;height:16px}
.cps-empty{padding:28px 12px;text-align:center;color:var(--muted)}

.cps-foot{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
.cps-pager{display:flex;align-items:center;gap:6px}
.cps-perpage{display:flex;align-items:center;gap:7px;margin-right:6px}
.cps-perpage select{height:36px}
.cps-pager button{min-width:34px;height:34px;padding:0 9px;border:1px solid #dce6f3;border-radius:9px;background:#fff;color:#31456e;font:inherit;font-weight:700;cursor:pointer}
.cps-pager button:hover:not(:disabled){background:#f2f7ff}
.cps-pager button:disabled{opacity:.45;cursor:default}
.cps-page-on{background:#1657d9;border-color:#1657d9;color:#fff}
.cps-page-on:hover{background:#1657d9}
.cps-gap{padding:0 4px}


.cps-viewtabs{display:flex;gap:6px;margin-bottom:14px;padding:5px;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 6px 18px rgba(15,44,92,.04);width:fit-content;max-width:100%;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}
.cps-viewtab{flex:0 0 auto;white-space:nowrap;display:flex;align-items:center;gap:8px;padding:10px 16px;border:0;border-radius:10px;background:transparent;font:inherit;font-size:13.5px;font-weight:700;color:#52678f;cursor:pointer}
.cps-viewtab:hover{background:#f2f7ff}
.cps-viewtab-on{background:#1657d9;color:#fff;box-shadow:0 6px 14px rgba(22,87,217,.25)}
@media (max-width:1180px){.cps-viewtab{padding:9px 11px;gap:6px;font-size:13px}}
.cps-viewtab svg{width:17px;height:17px}
.cps-aviso{margin:-4px 0 12px;padding:10px 12px;border-radius:12px;background:#fde8e8;color:#b42318;font-size:12.5px}

.cps-strip{display:grid;grid-template-columns:max-content repeat(4,minmax(0,1fr));align-items:center;gap:10px;margin-bottom:14px;padding:11px 14px;border:1px solid #cfe0fb;border-radius:16px;background:linear-gradient(120deg,#eaf2ff,#f8fbff);box-shadow:0 6px 18px rgba(15,44,92,.04)}
.cps-strip-title{max-width:104px;font-size:12.5px;font-weight:800;line-height:1.25;color:#123c8f}
.cps-strip .cps-insight{background:#fff;padding:8px 10px}
.cps-stats-5{margin-bottom:14px}
.cps-block-head{padding:16px 14px 12px}
.cps-block-head h2{margin:0;font-size:16px;font-weight:800;color:var(--ink)}
.cps-block-head p{margin:4px 0 0;font-size:12.5px;color:var(--muted)}
.cps-bar{display:block;width:90px;height:7px;border-radius:99px;background:#eef2f9;overflow:hidden}
.cps-bar-fill{display:block;height:100%;border-radius:99px}
.cps-bar-alto{background:#16a34a}
.cps-bar-medio{background:#1657d9}
.cps-bar-bajo{background:#f59e0b}
.cps-bar-nulo{background:#cbd5e1}
.cps-foco{display:inline-block;padding:5px 10px;border-radius:8px;font-size:11.5px;font-weight:700;white-space:nowrap}
.cps-foco-alto{background:#dcf7e8;color:#087b42}
.cps-foco-medio{background:#e6efff;color:#1657d9}
.cps-foco-bajo{background:#fef2e0;color:#a86a08}
.cps-foco-nulo{background:#f1f5fb;color:#64748b}
@media (max-width:1240px){
 .cps-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cps-strip-title{grid-column:1/-1;max-width:none}
}

@media (max-width:720px){
}
@media (max-width:860px){
 .cps-filters{flex-wrap:wrap}
 .cps-search{flex:1 1 100%}
 .cps-field{flex:1 1 130px}
}
@media (max-width:1280px){
 .cps-top{grid-template-columns:minmax(0,1fr)}
 .cps-insights{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
 .cps-insights-title{grid-column:1/-1}
 .cps-stats{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
}
`;
