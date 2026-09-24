// Estilos del menú "Redes sociales" del portal del captador (prefijo cap-soc-*), en la misma
// línea visual del portal (azul #1657d9, marino #0b2559, tarjetas de 16px).
export const socialCss = `
.cap-soc{display:grid;gap:16px;min-width:0}
.cap-soc *{box-sizing:border-box}
.cap-soc-card{background:#fff;border:1px solid #e6edf7;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(11,37,89,.05);min-width:0}
.cap-soc-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.cap-soc-head h2{margin:0;font-size:20px;font-weight:850;color:#0b2559;letter-spacing:-.02em}
.cap-soc-head p{margin:4px 0 0;color:#64748b;font-size:13.5px;max-width:620px}
.cap-soc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border:0;border-radius:11px;background:#1657d9;color:#fff;font:inherit;font-weight:750;cursor:pointer;transition:transform .12s,background .15s;white-space:nowrap}
.cap-soc-btn:hover{background:#1148b4}
.cap-soc-btn:active{transform:scale(.98)}
.cap-soc-btn:disabled{background:#b9c6dc;cursor:not-allowed;transform:none}
.cap-soc-btn-ghost{background:#fff;color:#1657d9;border:1px solid #d9e3f3}
.cap-soc-btn-ghost:hover{background:#f1f6ff}
.cap-soc-btn-danger{background:#fff;color:#b42318;border:1px solid #f3c9c5}
.cap-soc-btn-danger:hover{background:#fdeaea}
.cap-soc-btn-sm{padding:7px 11px;font-size:12.5px;border-radius:9px}

/* ---- nivel y requisito ---- */
.cap-soc-status{display:grid;grid-template-columns:minmax(260px,1.1fr) repeat(3,minmax(0,1fr));gap:12px}
.cap-soc-medal{position:relative;overflow:hidden;display:flex;gap:14px;align-items:center;padding:16px;border-radius:16px;color:#fff;min-width:0}
.cap-soc-medal::after{content:'';position:absolute;inset:-40% auto auto -30%;width:60%;height:180%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transform:rotate(18deg);animation:capSocShine 4.5s ease-in-out infinite}
@keyframes capSocShine{0%,60%{left:-40%}100%{left:130%}}
.cap-soc-medal-BRONCE{background:linear-gradient(135deg,#8a4b22,#d48a4f)}
.cap-soc-medal-PLATA{background:linear-gradient(135deg,#66758a,#b9c5d6)}
.cap-soc-medal-ORO{background:linear-gradient(135deg,#a8780b,#f2c94c)}
.cap-soc-medal-PLATINO{background:linear-gradient(135deg,#2f6f86,#8fd3e8)}
.cap-soc-medal-DIAMANTE{background:linear-gradient(135deg,#5a3ff0,#2fc6f6)}
.cap-soc-medal-icon{position:relative;z-index:1;display:grid;place-items:center;width:62px;height:62px;flex:0 0 auto;border-radius:20px;background:rgba(255,255,255,.2);padding:4px;transition:background .8s}
.cap-soc-medal-icon-inner{display:grid;place-items:center;width:100%;height:100%;border-radius:16px;background:rgba(0,0,0,.14);box-shadow:inset 0 0 0 2px rgba(255,255,255,.35)}
.cap-soc-medal-body{min-width:0;flex:1;position:relative;z-index:1}
/* Capa con el color de la siguiente medalla: su opacidad sigue el avance (compradores que ya compraron). */
.cap-soc-medal-next{position:absolute;inset:0;z-index:0;transition:opacity 1.2s ease}
.cap-soc-medal.cerca{animation:capSocNear 2.4s ease-in-out infinite}
@keyframes capSocNear{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}50%{box-shadow:0 0 0 4px var(--cap-soc-next,#fff),0 10px 30px -6px var(--cap-soc-next,#fff)}}
.cap-soc-medal.subio{animation:capSocLevelUp 1s cubic-bezier(.2,1.4,.4,1) 1}
.cap-soc-medal.subio .cap-soc-medal-icon{animation:capSocSpin 1.2s ease-out 1}
@keyframes capSocLevelUp{0%{transform:scale(.94)}60%{transform:scale(1.04)}100%{transform:scale(1)}}
@keyframes capSocSpin{from{transform:rotate(-200deg) scale(.6)}to{transform:rotate(0) scale(1)}}
@media (prefers-reduced-motion:reduce){.cap-soc-medal,.cap-soc-medal::after,.cap-soc-medal .cap-soc-medal-icon{animation:none!important}}
.cap-soc-medal-body small{display:block;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85}
.cap-soc-medal-body strong{display:block;font-size:21px;font-weight:900;letter-spacing:-.02em;margin-top:1px}
.cap-soc-medal-body span{display:block;font-size:12px;opacity:.92;margin-top:2px}
.cap-soc-medal-body .cap-soc-medal-foot{margin-top:7px;font-size:11.5px;opacity:.95}
.cap-soc-medal-foot b{font-weight:850}
.cap-soc-bar{height:7px;border-radius:99px;background:rgba(255,255,255,.3);overflow:hidden;margin-top:8px}
.cap-soc-bar{position:relative;z-index:1}
.cap-soc-bar>div{height:100%;border-radius:99px;background:#fff;transition:width .8s ease}
.cap-soc-stat{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:14px 15px;border-radius:16px;border:1px solid #e6edf7;background:#fff;min-width:0}
.cap-soc-stat small{font-size:11.5px;font-weight:700;color:#7b8aa3;text-transform:uppercase;letter-spacing:.05em}
.cap-soc-stat strong{font-size:21px;font-weight:900;color:#0b2559;letter-spacing:-.02em}
.cap-soc-stat span{font-size:12px;color:#64748b}
.cap-soc-stat-ok{border-color:#bfe8d0;background:linear-gradient(160deg,#fff,#effbf4)}
.cap-soc-stat-ok strong{color:#0f8a4d}
.cap-soc-stat-warn{border-color:#f6d9a8;background:linear-gradient(160deg,#fff,#fff7e8)}
.cap-soc-stat-warn strong{color:#c2760b}
.cap-soc-dots{display:flex;gap:5px;margin-top:3px}
.cap-soc-dots i{width:22px;height:6px;border-radius:99px;background:#e1e8f3}
.cap-soc-dots i.on{background:#0f8a4d}
.cap-soc-levels{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.cap-soc-level{display:flex;align-items:center;gap:7px;padding:6px 10px;border-radius:99px;border:1px solid #e6edf7;font-size:12px;color:#52647d;background:#fbfcff}
.cap-soc-level b{color:#0b2559}
.cap-soc-level.on{border-color:#1657d9;background:#eaf3ff;color:#14459b}
.cap-soc-level i{width:10px;height:10px;border-radius:50%}

/* ---- pestañas y filtros ---- */
.cap-soc-tabs{display:flex;gap:6px;padding:5px;border-radius:13px;background:#eef3fa;width:max-content;max-width:100%;overflow-x:auto}
.cap-soc-tab{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border:0;border-radius:10px;background:transparent;color:#52647d;font:inherit;font-weight:750;font-size:13.5px;cursor:pointer;white-space:nowrap}
.cap-soc-tab.on{background:#fff;color:#0b2559;box-shadow:0 2px 8px rgba(11,37,89,.08)}
.cap-soc-tab.on.mine{color:#6d3fd6}
.cap-soc-tab em{font-style:normal;padding:1px 7px;border-radius:99px;background:#dfe8f6;font-size:11px}
.cap-soc-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.cap-soc-search{flex:1 1 220px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #d7e0ee;border-radius:11px;background:#fff;color:#7b8aa3}
.cap-soc-search input{flex:1;border:0;outline:0;padding:10px 0;font:inherit;font-size:13.5px;color:#0b2559;background:transparent;min-width:0}
.cap-soc-select{padding:10px 12px;border:1px solid #d7e0ee;border-radius:11px;background:#fff;font:inherit;font-size:13px;color:#0b2559;max-width:100%}
.cap-soc-chips{display:flex;gap:6px;flex-wrap:wrap}
.cap-soc-chip{padding:7px 12px;border-radius:99px;border:1px solid #d9e3f3;background:#fff;color:#52647d;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.cap-soc-chip.on{background:#0b2559;border-color:#0b2559;color:#fff}
.cap-soc-toggle{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:650;color:#52647d;cursor:pointer;user-select:none}
.cap-soc-toggle input{width:16px;height:16px;accent-color:#1657d9}

/* ---- feed ---- */
.cap-soc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.cap-soc-post{position:relative;display:flex;flex-direction:column;border-radius:18px;background:#fff;border:1px solid #e6edf7;overflow:hidden;box-shadow:0 8px 24px rgba(11,37,89,.06);transition:transform .15s,box-shadow .15s;min-width:0}
.cap-soc-post:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(11,37,89,.12)}
.cap-soc-post.mine{border:2px solid transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#8b5cf6,#1657d9) border-box}
.cap-soc-post.hidden-post{opacity:.72}
.cap-soc-media{position:relative;aspect-ratio:4/5;background:#0b1730;overflow:hidden;cursor:pointer}
.cap-soc-media img,.cap-soc-media video{width:100%;height:100%;object-fit:cover;display:block}
.cap-soc-media video{transition:transform .35s ease}
.cap-soc-media.playing video{transform:scale(1.03)}
.cap-soc-play-hint{position:absolute;left:50%;top:50%;display:grid;place-items:center;width:52px;height:52px;margin:-26px 0 0 -26px;padding-left:4px;border-radius:50%;background:rgba(9,20,45,.5);backdrop-filter:blur(4px);color:#fff;font-size:20px;pointer-events:none;transition:opacity .2s,transform .2s}
.cap-soc-media:hover .cap-soc-play-hint{opacity:0;transform:scale(.8)}
.cap-soc-muted-chip{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);padding:4px 10px;border-radius:99px;background:rgba(9,20,45,.62);color:#fff;font-size:11px;font-weight:800;white-space:nowrap;pointer-events:none;animation:capSocIn .2s ease-out}
.cap-soc-preview-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.25);pointer-events:none}
.cap-soc-preview-bar span{display:block;height:100%;background:linear-gradient(90deg,#1657d9,#8b5cf6);transition:width .25s linear}
.cap-soc-media.playing .cap-soc-lock{opacity:.25;transition:opacity .25s}
.cap-soc-media-empty{display:grid;place-items:center;height:100%;color:#8fa3c4;font-size:13px}
.cap-soc-author{position:absolute;left:10px;top:10px;display:flex;align-items:center;gap:7px;max-width:calc(100% - 70px);padding:4px 10px 4px 4px;border-radius:99px;background:rgba(9,20,45,.62);backdrop-filter:blur(6px);color:#fff;font-size:12px;font-weight:750}
.cap-soc-author span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cap-soc-avatar{display:grid;place-items:center;width:24px;height:24px;flex:0 0 auto;border-radius:50%;background:linear-gradient(135deg,#1657d9,#8b5cf6);color:#fff;font-size:11px;font-weight:800;overflow:hidden}
.cap-soc-avatar img{width:100%;height:100%;object-fit:cover}
.cap-soc-type{position:absolute;right:10px;top:10px;display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:99px;background:rgba(9,20,45,.62);color:#fff;font-size:11px;font-weight:800}
.cap-soc-ribbon{position:absolute;right:10px;bottom:10px;padding:4px 10px;border-radius:99px;background:linear-gradient(135deg,#8b5cf6,#6d3fd6);color:#fff;font-size:11px;font-weight:850;letter-spacing:.03em;box-shadow:0 4px 10px rgba(109,63,214,.35)}
.cap-soc-watermark{position:absolute;left:10px;bottom:10px;padding:3px 8px;border-radius:7px;background:rgba(9,20,45,.5);color:#fff;font-size:10.5px;font-weight:700}
.cap-soc-lock{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:6px;background:linear-gradient(180deg,rgba(9,20,45,.15),rgba(9,20,45,.72));color:#fff;text-align:center;padding:14px;pointer-events:none}
.cap-soc-lock strong{font-size:14px}
.cap-soc-lock small{font-size:12px;opacity:.9}
.cap-soc-body{display:grid;gap:8px;padding:12px 13px 13px}
.cap-soc-title{margin:0;font-size:14.5px;font-weight:800;color:#0b2559;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cap-soc-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#64748b}
.cap-soc-stars{display:inline-flex;align-items:center;gap:2px;color:#f5a524;font-weight:750}
.cap-soc-stars span{color:#64748b;font-weight:600;margin-left:3px}
.cap-soc-tags{display:flex;gap:5px;flex-wrap:wrap}
.cap-soc-tag{padding:3px 8px;border-radius:99px;background:#eef3fa;color:#3d5680;font-size:11px;font-weight:700}
.cap-soc-tag-cat{background:#f0eafe;color:#6d3fd6}
.cap-soc-dl{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:9px;border-top:1px solid #eef3fa}
.cap-soc-dl small{font-size:11.5px;color:#64748b;line-height:1.3}
.cap-soc-dl small b{color:#0b2559}
.cap-soc-counter{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:99px;background:#fef2e0;color:#b45309;font-size:11.5px;font-weight:800;white-space:nowrap}
.cap-soc-counter.ok{background:#e3f7ec;color:#0f8a4d}
.cap-soc-mine-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center}
.cap-soc-mine-stats div{padding:7px 4px;border-radius:10px;background:#f6f3ff}
.cap-soc-mine-stats b{display:block;font-size:15px;color:#4c1d95}
.cap-soc-mine-stats small{font-size:10.5px;color:#6b5a95;font-weight:700}
.cap-soc-hidden-note{padding:8px 10px;border-radius:10px;background:#fdeaea;color:#b42318;font-size:12px;font-weight:650}
.cap-soc-empty{display:grid;place-items:center;gap:8px;padding:44px 20px;text-align:center;color:#64748b;border:2px dashed #d9e3f3;border-radius:18px;background:#fbfcff}
.cap-soc-empty strong{font-size:16px;color:#0b2559}
.cap-soc-more{display:flex;justify-content:center}
.cap-soc-skeleton{aspect-ratio:4/6;border-radius:18px;background:linear-gradient(90deg,#eef3fa 25%,#f7f9fd 50%,#eef3fa 75%);background-size:200% 100%;animation:capSocSk 1.2s infinite}
@keyframes capSocSk{0%{background-position:200% 0}100%{background-position:-200% 0}}
.cap-soc-banner{display:flex;gap:12px;align-items:center;padding:13px 15px;border-radius:14px;border:1px solid #f6d9a8;background:#fff7e8;color:#8a5a0a;font-size:13px;font-weight:600}
.cap-soc-banner.info{border-color:#cfe0fb;background:#eaf3ff;color:#14459b}

/* ---- modales ---- */
.cap-soc-overlay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;background:rgba(9,20,45,.55);backdrop-filter:blur(3px)}
.cap-soc-modal{width:min(920px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:20px;background:#fff;box-shadow:0 30px 70px rgba(9,20,45,.35)}
.cap-soc-modal-sm{width:min(560px,100%)}
.cap-soc-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #eef3fa;position:sticky;top:0;background:#fff;z-index:1}
.cap-soc-modal-head h3{margin:0;font-size:17px;font-weight:850;color:#0b2559}
.cap-soc-x{border:0;background:#f1f5fb;width:34px;height:34px;border-radius:10px;font-size:20px;line-height:1;color:#52647d;cursor:pointer}
.cap-soc-modal-body{padding:18px 20px 20px}
.cap-soc-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
.cap-soc-drop{display:grid;place-items:center;gap:8px;min-height:260px;padding:20px;border:2px dashed #c3d6f5;border-radius:16px;background:#f7faff;color:#52647d;text-align:center;cursor:pointer;transition:background .15s,border-color .15s}
.cap-soc-drop.drag{background:#eaf3ff;border-color:#1657d9}
.cap-soc-drop strong{color:#0b2559}
.cap-soc-preview{position:relative;border-radius:16px;overflow:hidden;background:#0b1730;aspect-ratio:4/5}
.cap-soc-preview img,.cap-soc-preview video{width:100%;height:100%;object-fit:contain;display:block}
.cap-soc-presets{display:flex;gap:8px;overflow-x:auto;padding:4px 2px}
.cap-soc-preset{flex:0 0 auto;display:grid;gap:4px;justify-items:center;border:0;background:transparent;font:inherit;font-size:11.5px;font-weight:700;color:#52647d;cursor:pointer}
.cap-soc-preset span{width:58px;height:58px;border-radius:12px;background-size:cover;background-position:center;border:2px solid transparent}
.cap-soc-preset.on{color:#1657d9}
.cap-soc-preset.on span{border-color:#1657d9}
.cap-soc-field{display:grid;gap:6px}
.cap-soc-field label{font-size:12.5px;font-weight:750;color:#3d4f6d}
.cap-soc-field input,.cap-soc-field textarea,.cap-soc-field select{width:100%;padding:10px 12px;border:1px solid #d7e0ee;border-radius:10px;font:inherit;font-size:13.5px;color:#0b2559;background:#fff}
.cap-soc-field textarea{resize:vertical;min-height:80px}
.cap-soc-field small{font-size:11.5px;color:#7b8aa3}
.cap-soc-form{display:grid;gap:13px;align-content:start}
.cap-soc-progress{height:8px;border-radius:99px;background:#e6edf7;overflow:hidden}
.cap-soc-progress>div{height:100%;background:linear-gradient(90deg,#1657d9,#8b5cf6);transition:width .2s}
.cap-soc-error{padding:10px 12px;border-radius:10px;background:#fdeaea;color:#b42318;font-size:13px;font-weight:650}
.cap-soc-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.cap-soc-rate{display:flex;gap:4px}
.cap-soc-rate button{border:0;background:transparent;font-size:26px;line-height:1;color:#d7dfeb;cursor:pointer;padding:0 1px;transition:transform .1s}
.cap-soc-rate button.on{color:#f5a524}
.cap-soc-rate button:hover{transform:scale(1.15)}
.cap-soc-reviews{display:grid;gap:10px}
.cap-soc-review{display:flex;gap:10px;padding:10px 12px;border-radius:12px;background:#f7f9fd}
.cap-soc-review p{margin:3px 0 0;font-size:13px;color:#3d4f6d}
.cap-soc-review small{font-size:11.5px;color:#7b8aa3}

.cap-soc-toast{position:fixed;right:18px;bottom:18px;z-index:90;max-width:min(420px,calc(100vw - 36px));padding:13px 16px;border-radius:13px;background:#0b2559;color:#fff;font-size:13.5px;font-weight:650;box-shadow:0 14px 30px rgba(9,20,45,.3);animation:capSocIn .2s ease-out}
.cap-soc-toast.err{background:#b42318}
@keyframes capSocIn{from{transform:translateY(10px);opacity:0}}

@media (max-width:1100px){.cap-soc-status{grid-template-columns:1fr 1fr}.cap-soc-medal{grid-column:1/-1}}
@media (max-width:760px){.cap-soc-split{grid-template-columns:1fr}.cap-soc-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.cap-soc-body{padding:10px}}
@media (max-width:520px){.cap-soc-status{grid-template-columns:1fr}.cap-soc-filters>*{flex:1 1 100%}}
`;
