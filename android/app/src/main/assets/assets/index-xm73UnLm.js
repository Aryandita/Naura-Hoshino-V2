import{a as H,l as z,i as D,s as T,e as U,b as C}from"./api-BRWRvht5.js";import{i as q,o as c}from"./socket-CmqnoyjF.js";import{g as M}from"./auth-DUU6sWo9.js";import{i as K}from"./reveal-DoGC9ktQ.js";const L=new AbortController;document.addEventListener("DOMContentLoaded",async()=>{H(z()),D(),q(),K(),j(),await N(),T(N,3e4,L.signal),await O(),W()});window.addEventListener("pagehide",()=>L.abort());async function j(){const t=await M(),e=document.getElementById("nm-header-name"),n=document.getElementById("nm-greeting-title"),a=document.getElementById("nm-greeting-expr");if(t){const i=new Date().getHours(),s=i<11?"Selamat pagi":i<15?"Halo":i<19?"Selamat sore":"Selamat malam";e&&(e.textContent="Naura Hoshino"),n&&(n.textContent=`${s}, Kak ${t.displayName}~`),a&&(a.src=i<17?"/assets/Naura_Expression/Cheers.png":"/assets/Naura_Expression/Happy.png",a.alt="Naura menyapa")}else A()}function A(){const t=document.getElementById("nm-widget-grid");t&&(t.innerHTML=`
    <div class="nm-empty">
      <img src="/assets/Naura_Expression/Akward.png"
           alt="Naura bingung" class="nm-expression__img" style="width:100px;height:100px">
      <h2 class="nm-empty__title">Belum masuk, nih~</h2>
      <p class="nm-empty__desc">Login dulu biar Naura bisa kenalan dan tampilkan datamu.</p>
      <button class="nm-btn nm-btn--discord" onclick="window.location.href='/auth/discord'">
        <i class="fa-brands fa-discord" aria-hidden="true"></i>
        Login dengan Discord
      </button>
    </div>
  `)}async function O(){if(!await M())return;const e=U(),n=document.getElementById("nm-widget-grid");n&&(e.forEach((a,i)=>{const s=P(a);s&&(s.style.animationDelay=`${i*60}ms`,s.classList.add("animate-card-mount"),n.appendChild(s))}),V())}function P(t){const e=document.createElement("div");switch(e.id=`widget-${t}`,e.className="nm-card",t){case"bot-status":e.innerHTML=R();break;case"now-playing":e.style.display="none",e.innerHTML=G();break;case"survival-vitals":e.style.display="none",e.innerHTML=J();break;case"services":e.innerHTML=F();break;default:return null}return e}async function N(){var m,p,v,u,g,f,y,h,b,_,w,x,k,E,B,S,$,I;const{data:t,error:e}=await C("/api/health");if(e||!t)return;l("chip-ping",((m=t.bot)==null?void 0:m.ping)>=0?`${t.bot.ping}ms`:"---",((p=t.bot)==null?void 0:p.ping)>200?"warn":"ok"),l("chip-memory",(v=t.bot)!=null&&v.memoryUsageMB?`${Math.round(t.bot.memoryUsageMB)}MB`:"---"),l("chip-guilds",((u=t.bot)==null?void 0:u.guilds)??"---"),l("chip-uptime",(g=t.bot)!=null&&g.uptimeSeconds?Q(t.bot.uptimeSeconds):"---");const n=document.getElementById("widget-bot-status-dot");n&&(n.className=`nm-dot nm-dot--${t.status==="ok"?"online":"offline"}`);const a=document.getElementById("widget-bot-status-text");a&&(a.textContent=t.status==="ok"?"Online":"Offline"),d("svc-db",((y=(f=t.services)==null?void 0:f.database)==null?void 0:y.connected)??!1),d("svc-redis",((b=(h=t.services)==null?void 0:h.redis)==null?void 0:b.connected)??!1),d("svc-mongo",((w=(_=t.services)==null?void 0:_.mongodb)==null?void 0:w.state)==="connected"),d("svc-lavalink",((k=(x=t.services)==null?void 0:x.lavalink)==null?void 0:k.connected)>0);const i=document.getElementById("eco-stat-members");if(i){const o=((E=t.bot)==null?void 0:E.users)||((B=t.bot)==null?void 0:B.memberCount)||((S=t.stats)==null?void 0:S.totalMembers)||0;i.textContent=o?Number(o).toLocaleString("id-ID"):"1.4K+"}const s=document.getElementById("eco-stat-survivors");if(s){const o=t.survivors||(($=t.stats)==null?void 0:$.survivors)||((I=t.stats)==null?void 0:I.totalSurvivors)||0;s.textContent=o?Number(o).toLocaleString("id-ID"):"850+"}}async function V(){const{data:t}=await C("/api/survival/profile");if(!t)return;const e=document.getElementById("widget-survival-vitals");e&&(e.style.display="",r("vital-hp",t.health??0,100),r("vital-hunger",t.hunger??0,100),r("vital-energy",t.stamina??0,100))}function W(){c("stats_update",t=>{t.ping!==void 0&&l("chip-ping",`${t.ping}ms`)}),c("music_state",t=>{const e=document.getElementById("widget-now-playing");if(e)if(t.track){e.style.display="";const n=e.querySelector("#np-title"),a=e.querySelector("#np-artist"),i=e.querySelector("#np-cover");n&&(n.textContent=t.track.title||"Unknown"),a&&(a.textContent=t.track.author||"Unknown"),i&&t.track.thumbnail&&(i.src=t.track.thumbnail)}else e.style.display="none"}),c("survival_update",t=>{t.health!==void 0&&r("vital-hp",t.health,100),t.hunger!==void 0&&r("vital-hunger",t.hunger,100),t.stamina!==void 0&&r("vital-energy",t.stamina,100)})}function R(){return`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-sm)">
      <p class="nm-section-title" style="margin:0">Status Bot &amp; Ekosistem</p>
      <div style="display:flex;align-items:center;gap:6px">
        <div id="widget-bot-status-dot" class="nm-dot"></div>
        <span id="widget-bot-status-text" style="font-size:0.75rem;color:var(--body)">Memuat...</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-xs);margin-top:var(--sp-xs)">
      <div style="padding:8px;background:var(--surface-glass);border:1px solid var(--hairline);border-radius:var(--r-md);text-align:center">
        <span style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;display:block">Member</span>
        <strong id="eco-stat-members" style="font-size:0.875rem;color:var(--ink);font-family:var(--font-display)">---</strong>
      </div>
      <div style="padding:8px;background:var(--surface-glass);border:1px solid var(--hairline);border-radius:var(--r-md);text-align:center">
        <span style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;display:block">Survivor</span>
        <strong id="eco-stat-survivors" style="font-size:0.875rem;color:var(--accent-emerald);font-family:var(--font-display)">---</strong>
      </div>
      <div style="padding:8px;background:var(--surface-glass);border:1px solid var(--hairline);border-radius:var(--r-md);text-align:center">
        <span style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;display:block">Engine</span>
        <strong id="eco-stat-engine" style="font-size:0.875rem;color:var(--primary);font-family:var(--font-display)">v2.3.0</strong>
      </div>
    </div>
  `}function F(){return`
    <p class="nm-section-title" style="margin-bottom:var(--sp-xs)">Layanan</p>
    <div class="nm-service-grid">
      ${[{id:"svc-db",label:"Database"},{id:"svc-redis",label:"Redis"},{id:"svc-mongo",label:"MongoDB"},{id:"svc-lavalink",label:"Lavalink"}].map(e=>`
        <div class="nm-service-item" id="${e.id}">
          <div class="nm-dot"></div>
          <span>${e.label}</span>
        </div>
      `).join("")}
    </div>
  `}function G(){return`
    <p class="nm-section-title" style="margin-bottom:var(--sp-sm)">Sedang Diputar</p>
    <div style="display:flex;align-items:center;gap:var(--sp-md)">
      <img id="np-cover" class="nm-player-cover" style="width:56px;height:56px"
           src="/assets/core/avatar.png" alt="Album art">
      <div style="flex:1;overflow:hidden">
        <p id="np-title"  style="font-size:0.875rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">-</p>
        <p id="np-artist" style="font-size:0.75rem;color:var(--body);margin-top:2px">-</p>
      </div>
      <a href="/mobile/music" class="nm-btn nm-btn--ghost" style="padding:8px 12px;min-height:40px;font-size:0.75rem">
        <i class="fa-solid fa-music" aria-hidden="true"></i>
      </a>
    </div>
  `}function J(){return`
    <p class="nm-section-title" style="margin-bottom:var(--sp-sm)">Kondisi Karakter</p>
    <div class="nm-vital">
      <div class="nm-vital__row">
        <span class="nm-vital__icon">❤</span>
        <div class="nm-vital__track"><div id="vital-hp" class="nm-vital__fill" style="--fill-target:0%;width:0%"></div></div>
        <span class="nm-vital__pct" id="vital-hp-pct">0%</span>
      </div>
      <div class="nm-vital__row">
        <span class="nm-vital__icon">🍖</span>
        <div class="nm-vital__track"><div id="vital-hunger" class="nm-vital__fill" style="--fill-target:0%;width:0%"></div></div>
        <span class="nm-vital__pct" id="vital-hunger-pct">0%</span>
      </div>
      <div class="nm-vital__row">
        <span class="nm-vital__icon">⚡</span>
        <div class="nm-vital__track"><div id="vital-energy" class="nm-vital__fill" style="--fill-target:0%;width:0%"></div></div>
        <span class="nm-vital__pct" id="vital-energy-pct">0%</span>
      </div>
    </div>
  `}function l(t,e){const n=document.getElementById(t);n&&(n.textContent=e)}function d(t,e){const n=document.getElementById(t);if(!n)return;const a=n.querySelector(".nm-dot");a&&(a.className=`nm-dot nm-dot--${e?"online":"offline"}`),n.className=`nm-service-item nm-service-item--${e?"ok":"err"}`}function r(t,e,n){const a=Math.round(e/n*100),i=document.getElementById(t),s=document.getElementById(`${t}-pct`);i&&(i.style.setProperty("--fill-target",`${a}%`),i.style.width=`${a}%`,i.dataset.level=a<20?"danger":a<50?"warn":"ok"),s&&(s.textContent=`${a}%`)}function Q(t){const e=Math.floor(t/3600),n=Math.floor(t%3600/60);return e>0?`${e}j ${n}m`:`${n}m`}
