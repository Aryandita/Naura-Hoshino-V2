(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))t(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&t(o)}).observe(document,{childList:!0,subtree:!0});function a(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function t(n){if(n.ep)return;n.ep=!0;const i=a(n);fetch(n.href,i)}})();const w=[{id:"home",title:"Beranda",desc:"Ringkasan sistem & telemetri bot",icon:"fa-house",color:"#f9a8d4",href:"/mobile/"},{id:"survival",title:"Naura Wilds",desc:"Status vital, stamina & radar survival",icon:"fa-shield-halved",color:"#86efac",href:"/mobile/survival"},{id:"inventory",title:"Ransel & Tas",desc:"Kelola item, material & fusi alat",icon:"fa-box-open",color:"#fbbf24",href:"/mobile/inventory"},{id:"clan",title:"Klan & Sindikat",desc:"Aliansi teritori & perang distrik",icon:"fa-chess-rook",color:"#c084fc",href:"/mobile/clan"},{id:"marketplace",title:"Pasar Galaksi",desc:"Bursa lelang & transaksi komoditas",icon:"fa-shop",color:"#38bdf8",href:"/mobile/marketplace"},{id:"arcade",title:"Retro Arcade",desc:"Mini-game santai berhadiah NSF",icon:"fa-gamepad",color:"#f43f5e",href:"/mobile/arcade"},{id:"music",title:"Audio & DJ",desc:"Player musik, antrean & live voice",icon:"fa-music",color:"#93c5fd",href:"/mobile/music"},{id:"economy",title:"Ekonomi Server",desc:"Dompet, bank & peredaran koin",icon:"fa-coins",color:"#ffd700",href:"/mobile/economy"},{id:"leaderboard",title:"Papan Peringkat",desc:"Ranking petualang teratas",icon:"fa-ranking-star",color:"#a78bfa",href:"/mobile/leaderboard"},{id:"profile",title:"Profil & Kartu",desc:"Kartu identitas & koleksi kartu",icon:"fa-user",color:"#f472b6",href:"/mobile/profile"},{id:"config",title:"Pengaturan Server",desc:"Konfigurasi bot, prefix & automod",icon:"fa-sliders",color:"#6ee7b7",href:"/mobile/config"},{id:"soundboard",title:"Soundboard Studio",desc:"Papan efek suara audio interaktif",icon:"fa-bullhorn",color:"#e879f9",href:"/soundboard"},{id:"tickets",title:"Tiket Bantuan",desc:"Pusat bantuan & pengaduan",icon:"fa-ticket",color:"#facc15",href:"/tickets"},{id:"portfolio",title:"Showcase Portofolio",desc:"Halaman pameran karya member",icon:"fa-id-badge",color:"#60a5fa",href:"/portfolio"},{id:"welcomer",title:"Studio Welcomer",desc:"Desain kartu sambutan member baru",icon:"fa-wand-magic-sparkles",color:"#fb7185",href:"/welcomer"},{id:"automations",title:"Automasi Server",desc:"Pemicu dan aksi terjadwal",icon:"fa-bolt",color:"#34d399",href:"/automations"}];function k(){if(document.getElementById("nm-apps-drawer-overlay"))return;const e=window.location.pathname.replace(/\/$/,""),r=`
    <div id="nm-apps-drawer-overlay" class="nm-drawer-overlay" aria-hidden="true">
      <div class="nm-drawer-sheet" role="dialog" aria-modal="true" aria-label="Semua Fitur Naura OS">
        <div class="nm-drawer-handle"></div>
        <div class="nm-drawer-header">
          <div class="nm-drawer-title-group">
            <span class="nm-badge nm-badge--pink">Pusat Fitur</span>
            <h2 class="nm-drawer-title">Jelajahi Fitur Naura OS</h2>
          </div>
          <button id="nm-close-apps-drawer" class="nm-header__btn" aria-label="Tutup menu">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="nm-drawer-grid">
          ${w.map(o=>{const l=e===o.href.replace(/\/$/,"");return`
              <a href="${o.href}" class="nm-drawer-card ${l?"is-active":""}">
                <div class="nm-drawer-card__icon" style="background:${o.color}22; color:${o.color}; border-color:${o.color}44;">
                  <i class="fa-solid ${o.icon}"></i>
                </div>
                <div class="nm-drawer-card__info">
                  <div class="nm-drawer-card__title">${o.title}</div>
                  <div class="nm-drawer-card__desc">${o.desc}</div>
                </div>
              </a>
            `}).join("")}
        </div>
      </div>
    </div>
  `;document.body.insertAdjacentHTML("beforeend",r);const a=document.getElementById("nm-apps-drawer-overlay"),t=document.getElementById("nm-close-apps-drawer"),n=()=>{a.classList.add("is-open"),a.setAttribute("aria-hidden","false"),document.body.style.overflow="hidden"},i=()=>{a.classList.remove("is-open"),a.setAttribute("aria-hidden","true"),document.body.style.overflow=""};t&&t.addEventListener("click",i),a.addEventListener("click",o=>{o.target===a&&i()}),document.querySelectorAll("[data-action='open-apps-drawer'], #nm-open-apps").forEach(o=>{o.addEventListener("click",l=>{l.preventDefault(),n()})})}const h="naura-mobile-theme",g="naura-mobile-widgets",f=[{id:"midnight",label:"Midnight",primary:"#FFB6C1",canvas:"#0b0c10"},{id:"sakura",label:"Sakura",primary:"#ff9ebb",canvas:"#160f18"},{id:"cyber-neon",label:"Cyber Neon",primary:"#00f0ff",canvas:"#070913"},{id:"wilds",label:"Naura Wilds",primary:"#86efac",canvas:"#061209"},{id:"light-horizon",label:"Horizon",primary:"#db2777",canvas:"#f8fafc"},{id:"oled",label:"OLED",primary:"#ff5c8a",canvas:"#000000"}],S=["#FFB6C1","#f9a8d4","#ff9ebb","#ff5c8a","#c084fc","#93c5fd","#7dd3fc","#86efac","#34d399","#fbbf24","#ffd700","#f87171"];function y(){try{const e=localStorage.getItem(h);return e?JSON.parse(e):p()}catch{return p()}}function x(e){const r=document.documentElement;r.dataset.theme=e.preset||"midnight",e.accent&&(r.style.setProperty("--primary",e.accent),r.style.setProperty("--primary-glow",E(e.accent,.55))),r.dataset.fontSize=e.fontSize||"normal",e.animation?r.classList.remove("motion-reduce"):r.classList.add("motion-reduce")}function d(e){const a={...y(),...e};return localStorage.setItem(h,JSON.stringify(a)),x(a),a}function N(){try{const e=localStorage.getItem(g);return e?JSON.parse(e):v()}catch{return v()}}function O(e){localStorage.setItem(g,JSON.stringify(e))}function p(){return{preset:"midnight",accent:null,animation:!0,fontSize:"normal"}}function v(){return["bot-status","now-playing","survival-vitals","services"]}function E(e,r){const a=e.replace("#",""),t=parseInt(a.substring(0,2),16),n=parseInt(a.substring(2,4),16),i=parseInt(a.substring(4,6),16);return`rgba(${t}, ${n}, ${i}, ${r})`}let u=!1,s=null,c=null;function _(){document.querySelectorAll("#nm-open-customizer, [data-action='open-customizer']").forEach(r=>{r.dataset.customizerBound||(r.dataset.customizerBound="true",r.addEventListener("click",a=>{var t,n;a.preventDefault(),(n=(t=window.soundManager)==null?void 0:t.play)==null||n.call(t,"modal"),A()}))})}function A(){u||(u=!0,$())}function b(){var e,r;u&&(u=!1,(r=(e=window.soundManager)==null?void 0:e.play)==null||r.call(e,"click"),s&&(s.style.animation="sheet-down var(--dur-slow) var(--ease-smooth) both",s.addEventListener("animationend",()=>s==null?void 0:s.remove(),{once:!0})),c&&(c.style.animation="overlay-in var(--dur-normal) reverse both",c.addEventListener("animationend",()=>c==null?void 0:c.remove(),{once:!0})))}function $(){const e=y();c=document.createElement("div"),c.style.cssText=`
    position: fixed; inset: 0; z-index: 98;
    background: rgba(11,12,16,0.6);
    backdrop-filter: blur(4px);
    animation: overlay-in var(--dur-normal) var(--ease-smooth) both;
  `,c.addEventListener("click",b),s=document.createElement("div"),s.setAttribute("role","dialog"),s.setAttribute("aria-modal","true"),s.setAttribute("aria-label","Kustomisasi Dashboard"),s.style.cssText=`
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 99;
    background: var(--canvas);
    border-top: 1px solid var(--hairline);
    border-radius: var(--r-xxl) var(--r-xxl) 0 0;
    padding: var(--sp-md) var(--sp-lg) calc(var(--sp-xxl) + var(--nav-safe));
    max-height: 80dvh;
    overflow-y: auto;
    animation: sheet-up var(--dur-slow) var(--ease-spring) both;
  `,s.innerHTML=`
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--sp-lg)">
      <h2 style="font-family:var(--font-display); font-size:0.8125rem; font-weight:700; letter-spacing:1px; color:var(--primary); text-transform:uppercase">
        Kustomisasi
      </h2>
      <button id="nm-close-customizer" aria-label="Tutup"
        style="width:32px;height:32px;border-radius:var(--r-full);background:var(--surface-glass);border:1px solid var(--hairline);color:var(--body);cursor:pointer;display:flex;align-items:center;justify-content:center">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Preset Tema -->
    <p class="nm-section-title" style="margin-bottom:var(--sp-xs)">Tema</p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--sp-xs);margin-bottom:var(--sp-lg)">
      ${f.map(a=>`
        <button class="nm-preset-btn ${e.preset===a.id?"is-active":""}"
          data-preset="${a.id}"
          style="
            padding: var(--sp-sm) var(--sp-md);
            background: var(--surface-glass);
            border: 2px solid ${e.preset===a.id?a.primary:"var(--hairline)"};
            border-radius: var(--r-xl);
            display: flex; align-items: center; gap: var(--sp-xs);
            cursor: pointer; color: var(--body-strong);
            font-family: var(--font-body); font-size: 0.875rem; font-weight:600;
            transition: border-color var(--dur-fast);
          "
        >
          <span style="width:14px;height:14px;border-radius:50%;background:${a.primary};flex-shrink:0"></span>
          ${a.label}
        </button>
      `).join("")}
    </div>

    <!-- Aksen Warna -->
    <p class="nm-section-title" style="margin-bottom:var(--sp-xs)">Aksen Warna</p>
    <div style="display:flex;flex-wrap:wrap;gap:var(--sp-xs);margin-bottom:var(--sp-lg)">
      ${S.map(a=>`
        <button class="nm-swatch-btn"
          data-accent="${a}"
          aria-label="Aksen ${a}"
          style="
            width:32px;height:32px;border-radius:50%;
            background:${a};border:none;cursor:pointer;
            outline: ${e.accent===a?`3px solid ${a}`:"none"};
            outline-offset: 3px;
            transition: outline var(--dur-fast), transform var(--dur-fast);
          "
        ></button>
      `).join("")}
      <button class="nm-swatch-btn" data-accent="reset"
        style="width:32px;height:32px;border-radius:50%;background:var(--surface-glass);border:1px solid var(--hairline);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.75rem">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Animasi -->
    <div class="nm-module-row">
      <div class="nm-module-row__info">
        <p class="nm-module-row__name">Animasi</p>
        <p class="nm-module-row__desc">Matikan jika kurang nyaman</p>
      </div>
      <label class="nm-toggle">
        <input type="checkbox" id="nm-toggle-anim" ${e.animation?"checked":""}>
        <div class="nm-toggle__track"><div class="nm-toggle__thumb"></div></div>
      </label>
    </div>

    <!-- Ukuran Teks -->
    <div class="nm-module-row">
      <div class="nm-module-row__info">
        <p class="nm-module-row__name">Ukuran Teks</p>
      </div>
      <div style="display:flex;gap:var(--sp-xs)">
        ${["compact","normal","large"].map((a,t)=>`
          <button class="nm-quick-chip nm-font-size-btn ${e.fontSize===a?"is-active":""}"
            data-size="${a}"
            style="${e.fontSize===a?"background:rgba(255,182,193,0.12);border-color:var(--primary);color:var(--primary);":""}">
            ${["S","M","L"][t]}
          </button>
        `).join("")}
      </div>
    </div>
  `,document.body.appendChild(c),document.body.appendChild(s),s.querySelector("#nm-close-customizer").addEventListener("click",b),s.querySelectorAll(".nm-preset-btn").forEach(a=>{a.addEventListener("click",()=>{const t=a.dataset.preset;d({preset:t,accent:null}),s.querySelectorAll(".nm-preset-btn").forEach(n=>{const i=f.find(o=>o.id===n.dataset.preset);n.style.borderColor=n.dataset.preset===t?i.primary:"var(--hairline)",n.classList.toggle("is-active",n.dataset.preset===t)})})}),s.querySelectorAll(".nm-swatch-btn").forEach(a=>{a.addEventListener("click",()=>{const t=a.dataset.accent;d(t==="reset"?{accent:null}:{accent:t}),s.querySelectorAll(".nm-swatch-btn").forEach(n=>{const i=n.dataset.accent===t&&t!=="reset";n.style.outline=i?`3px solid ${n.dataset.accent}`:"none"})})});const r=s.querySelector("#nm-toggle-anim");r==null||r.addEventListener("change",()=>{d({animation:r.checked})}),s.querySelectorAll(".nm-font-size-btn").forEach(a=>{a.addEventListener("click",()=>{const t=a.dataset.size;d({fontSize:t}),s.querySelectorAll(".nm-font-size-btn").forEach(n=>{const i=n.dataset.size===t;n.style.background=i?"rgba(255,182,193,0.12)":"",n.style.borderColor=i?"var(--primary)":"",n.style.color=i?"var(--primary)":""})})})}const L=[{id:"home",icon:"fa-house",label:"Beranda",href:"/mobile/",accent:"var(--primary)",match:["/mobile/","/mobile/index.html"]},{id:"survival",icon:"fa-shield-halved",label:"Wilds",href:"/mobile/survival",accent:"var(--wilds-emerald)",match:["/mobile/survival"]},{id:"music",icon:"fa-music",label:"Musik",href:"/mobile/music",accent:"var(--accent-blue)",match:["/mobile/music"]},{id:"economy",icon:"fa-coins",label:"Ekonomi",href:"/mobile/economy",accent:"var(--accent-gold)",match:["/mobile/economy"]},{id:"leaderboard",icon:"fa-ranking-star",label:"Ranking",href:"/mobile/leaderboard",accent:"var(--accent-purple)",match:["/mobile/leaderboard"]},{id:"config",icon:"fa-sliders",label:"Config",href:"/mobile/config",accent:"var(--accent-purple)",match:["/mobile/config"]},{id:"profile",icon:"fa-user",label:"Profil",href:"/mobile/profile",accent:"var(--primary)",match:["/mobile/profile"]}];function j(){k(),_(),P(),M(),z();const e=document.querySelector(".nm-header__actions");if(e&&!document.getElementById("nm-open-apps")){const t=document.createElement("button");t.id="nm-open-apps",t.className="nm-header__btn",t.setAttribute("aria-label","Pusat Fitur"),t.setAttribute("title","Semua Fitur Naura OS"),t.innerHTML='<i class="fa-solid fa-cubes" aria-hidden="true"></i>',e.prepend(t),t.addEventListener("click",n=>{n.preventDefault();const i=document.getElementById("nm-apps-drawer-overlay");i&&(i.classList.add("is-open"),i.setAttribute("aria-hidden","false"),document.body.style.overflow="hidden")})}const r=document.getElementById("nm-bottom-nav");if(!r)return;const a=T(window.location.pathname);r.innerHTML=L.map(t=>{const n=t.match.some(i=>a===i||a.startsWith(i+"/"));return`
      <a
        href="${t.href}"
        class="nm-nav-tab ${n?"is-active":""}"
        aria-label="${t.label}"
        aria-current="${n?"page":"false"}"
        style="--tab-accent: ${t.accent}"
        id="nav-tab-${t.id}"
      >
        <i class="fa-solid ${t.icon}" aria-hidden="true"></i>
        <span class="nm-nav-tab__label">${t.label}</span>
      </a>
    `}).join(""),r.addEventListener("click",t=>{var i,o;const n=t.target.closest(".nm-nav-tab");n&&((o=(i=window.soundManager)==null?void 0:i.play)==null||o.call(i,"tab"),r.querySelectorAll(".nm-nav-tab").forEach(l=>l.classList.remove("is-active")),n.classList.add("is-active"))})}function P(){if(!(typeof window>"u")&&!window.soundManager&&!document.getElementById("naura-sound-script")){const e=document.createElement("script");e.id="naura-sound-script",e.src="/src/js/soundManager.js",e.async=!0,e.onload=()=>{var a,t;const r=localStorage.getItem("naura-sfx-muted")==="true";window.soundManager&&r&&((t=(a=window.soundManager).setSfxEnabled)==null||t.call(a,!1))},document.head.appendChild(e)}}function M(){const e=document.querySelector(".nm-header__actions");if(!e||document.getElementById("nm-sfx-btn"))return;const r=document.createElement("button");r.id="nm-sfx-btn",r.className="nm-header__btn",r.setAttribute("aria-label","Toggle Suara SFX");const a=()=>{var n,i;const t=localStorage.getItem("naura-sfx-muted")==="true";r.innerHTML=t?'<i class="fa-solid fa-volume-xmark" aria-hidden="true" style="color:var(--muted)"></i>':'<i class="fa-solid fa-volume-high" aria-hidden="true"></i>',r.setAttribute("title",t?"Suara: Mute":"Suara: Aktif"),window.soundManager&&((i=(n=window.soundManager).setSfxEnabled)==null||i.call(n,!t))};r.addEventListener("click",t=>{var o,l;t.preventDefault();const i=!(localStorage.getItem("naura-sfx-muted")==="true");localStorage.setItem("naura-sfx-muted",String(i)),a(),!i&&window.soundManager&&((l=(o=window.soundManager).play)==null||l.call(o,"click"))}),a(),e.appendChild(r)}function T(e){return e==="/mobile/"||e==="/mobile"?"/mobile/":e.endsWith("/")?e.slice(0,-1):e}function z(){if(typeof window>"u")return;if(!document.querySelector('link[rel="manifest"]')){const r=document.createElement("link");r.rel="manifest",r.href="/manifest.json",document.head.appendChild(r)}let e=document.querySelector('meta[name="theme-color"]');if(e?e.content="#FFB6C1":(e=document.createElement("meta"),e.name="theme-color",e.content="#FFB6C1",document.head.appendChild(e)),"serviceWorker"in navigator){const r=()=>{navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(a=>{console.debug("[PWA] Mobile Service Worker info:",a.message||a)})};document.readyState==="complete"?r():window.addEventListener("load",r,{once:!0})}}const m=new Map,I={"/api/health":3e4,"/api/user/me":6e4,"/api/survival/profile":15e3,"/api/leaderboard":6e4};async function B(e,r={}){const a=I[e];if(a&&!r.method){const t=m.get(e);if(t&&Date.now()-t.ts<a)return{data:t.data,status:200}}try{const t=await fetch(e,{credentials:"include",headers:{"Content-Type":"application/json",...r.headers},...r});if(t.status===401)return{error:"Perlu login",status:401};if(!t.ok)return{error:(await t.json().catch(()=>({}))).message||`HTTP ${t.status}`,status:t.status};const n=await t.json();return a&&!r.method&&m.set(e,{data:n,ts:Date.now()}),{data:n,status:t.status}}catch(t){return t.name==="AbortError"?{error:"Dibatalkan",status:0}:{error:t.message||"Gagal terhubung ke server",status:0}}}function q(e,r){return B(e,{method:"POST",body:JSON.stringify(r)})}function W(e){m.delete(e)}function F(e,r,a){e();const t=setInterval(()=>{if(a!=null&&a.aborted){clearInterval(t);return}e()},r);return a==null||a.addEventListener("abort",()=>clearInterval(t)),t}function C(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}typeof window<"u"&&!window.escapeHtml&&(window.escapeHtml=C);export{S as A,f as P,x as a,B as b,q as c,W as d,N as e,d as f,O as g,j as i,y as l,F as s};
