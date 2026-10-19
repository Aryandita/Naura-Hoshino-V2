import{a as m,l as c,i as l,b as u}from"./api-BRWRvht5.js";import{i as d,o as v}from"./socket-CmqnoyjF.js";import{g as p}from"./auth-DUU6sWo9.js";import{i as f}from"./reveal-DoGC9ktQ.js";import{d as g}from"./toaster-SAXJpLgQ.js";document.addEventListener("DOMContentLoaded",async()=>{if(m(c()),l(),f(),d(),L(),!await p()){$();return}await _(),B()});async function _(){const{data:e,error:t}=await u("/api/survival/profile");if(t||!e){w("Gagal memuat data survival","Pastikan kamu sudah memulai petualangan di Discord.","fa-circle-exclamation");return}h(e),y(e),k(e.inventory??[]),b(e.activeQuest)}function h(e){r("vital-hp",e.health??0,100),r("vital-hunger",e.hunger??0,100),r("vital-energy",e.stamina??0,100);const t=document.getElementById("survival-weather");if(t&&e.weather){const a={sakura_breeze:"🌸",cosmic_storm:"⚡",sunny:"☀",cloudy:"☁"},n={sakura_breeze:"Sakura Breeze",cosmic_storm:"Cosmic Storm",sunny:"Cerah",cloudy:"Berawan"};t.textContent=`${a[e.weather]||"🌿"} ${n[e.weather]||e.weather}`}}function y(e){const t=(a,n)=>{const i=document.getElementById(a);i&&(i.textContent=E(n))};t("stat-nsf",e.starFragments??0),t("stat-nc",e.wallet??0),t("stat-coupon",e.coupons??0)}function k(e){const t=document.getElementById("inventory-preview");if(t){if(!e.length){t.innerHTML='<p style="font-size:0.75rem;color:var(--muted)">Inventori kosong</p>';return}t.innerHTML=e.slice(0,6).map(a=>`
    <div class="nm-inv-item">
      <span class="nm-inv-item__icon">${a.emoji||"📦"}</span>
      <span class="nm-inv-item__name">${a.name||"Item"}</span>
    </div>
  `).join("")}}function b(e){const t=document.getElementById("active-quest");if(!t)return;if(!e){t.innerHTML=`
      <p style="font-size:0.8125rem;color:var(--muted)">
        Belum ada quest aktif. Mulai petualangan di Discord!
      </p>`;return}const a=e.steps??[],n=Math.round(e.progress/e.goal*100);t.innerHTML=`
    <p style="font-size:0.875rem;font-weight:600;color:var(--body-strong);margin-bottom:var(--sp-xs)">${e.name}</p>
    <div class="nm-timeline" style="margin-bottom:var(--sp-sm)">
      ${a.map((i,s)=>{const o=s<e.currentStep?"done":s===e.currentStep?"active":"locked";return`
          ${s>0?`<div class="nm-timeline__line${o!=="locked"?" nm-timeline__line--done":""}"></div>`:""}
          <div class="nm-timeline__step nm-timeline__step--${o}">
            <div class="nm-timeline__node">${s+1}</div>
            <span class="nm-timeline__label">${i.label||`Langkah ${s+1}`}</span>
          </div>
        `}).join("")}
    </div>
    <div class="nm-vital__track">
      <div class="nm-vital__fill" style="--fill-target:${n}%;width:${n}%;background:var(--wilds-emerald)"></div>
    </div>
    <p style="font-size:0.625rem;color:var(--muted);margin-top:4px;text-align:right">${n}% selesai</p>
  `}function $(){const e=document.querySelector(".nm-page");e&&(e.innerHTML=`
    <div class="nm-empty">
      <img src="/assets/Naura_Expression/Akward.png" alt="Naura bingung"
           class="nm-expression__img" style="width:100px;height:100px">
      <h2 class="nm-empty__title">Petualangan menunggumu~</h2>
      <p class="nm-empty__desc">Login dulu untuk memantau kondisi karaktermu di Naura Wilds!</p>
      <button class="nm-btn nm-btn--discord" onclick="window.location.href='/auth/discord'">
        <i class="fa-brands fa-discord"></i> Login dengan Discord
      </button>
    </div>
    <nav id="nm-bottom-nav"></nav>
  `,l())}function w(e,t,a="fa-leaf"){const n=document.getElementById("survival-content");n&&(n.innerHTML=`
    <div class="nm-empty">
      <i class="fa-solid ${a}" style="font-size:2rem;color:var(--wilds-amber);margin-bottom:var(--sp-sm)"></i>
      <h2 class="nm-empty__title">${e}</h2>
      <p class="nm-empty__desc">${t}</p>
    </div>`)}function B(){v("survival_update",e=>{e.health!==void 0&&r("vital-hp",e.health,100),e.hunger!==void 0&&r("vital-hunger",e.hunger,100),e.stamina!==void 0&&r("vital-energy",e.stamina,100)})}function r(e,t,a){const n=Math.min(100,Math.round(t/a*100)),i=document.getElementById(e),s=document.getElementById(`${e}-pct`);i&&(i.style.setProperty("--fill-target",`${n}%`),i.style.width=`${n}%`,i.dataset.level=n<20?"danger":n<50?"warn":"ok"),s&&(s.textContent=`${n}%`)}function E(e){return typeof e!="number"?String(e):e>=1e3?`${(e/1e3).toFixed(1)}K`:String(e)}function L(){[{selector:'[aria-label="Bertani"]',name:"Bertani",cmd:"/survival farm"},{selector:'[aria-label="Tambang"]',name:"Tambang",cmd:"/survival mine"},{selector:'[aria-label="Memasak"]',name:"Memasak",cmd:"/survival cook"},{selector:'[aria-label="Dungeon"]',name:"Dungeon",cmd:"/survival dungeon"}].forEach(({selector:t,name:a,cmd:n})=>{const i=document.querySelector(t);i&&i.addEventListener("click",s=>{s.preventDefault(),g(`Aksi ${a} siap! Buka Discord dan ketik ${n}.`)})})}
