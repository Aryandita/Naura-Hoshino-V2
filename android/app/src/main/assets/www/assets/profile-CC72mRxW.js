import{a as f,l as m,i as g,b as v,P as d,f as l,A as h,e as y,g as b}from"./api-BRWRvht5.js";import{g as E,r as x,l as w}from"./auth-DUU6sWo9.js";import{c}from"./toaster-SAXJpLgQ.js";import{i as L}from"./reveal-DoGC9ktQ.js";document.addEventListener("DOMContentLoaded",async()=>{f(m()),g(),L();const t=await E();if(!t){x();return}S(t),$(),k(),B()});function S(t){const a=document.getElementById("profile-avatar"),i=document.getElementById("profile-name"),r=document.getElementById("profile-level");a&&(a.src=t.avatar?`https://cdn.discordapp.com/avatars/${t.id}/${t.avatar}.webp?size=128`:`https://cdn.discordapp.com/embed/avatars/${Number(t.id)%6}.png`,a.alt=t.displayName),i&&(i.textContent=t.displayName||t.username),r&&(r.textContent="Memuat level..."),v("/api/survival/profile").then(({data:e})=>{e&&r&&(r.textContent=`Level ${e.level??"?"} Petualang`)})}function $(){const t=m(),a=document.getElementById("profile-presets");a&&(a.innerHTML=d.map(e=>`
      <button class="nm-preset-mini ${t.preset===e.id?"is-active":""}"
        data-preset="${e.id}"
        aria-pressed="${t.preset===e.id}"
        style="
          padding: 8px 14px;
          background: var(--surface-glass);
          border: 2px solid ${t.preset===e.id?e.primary:"var(--hairline)"};
          border-radius: var(--r-full);
          display: flex; align-items: center; gap: 6px;
          cursor: pointer; color: var(--body-strong);
          font-family: var(--font-body); font-size: 0.75rem; font-weight:600;
          transition: border-color var(--dur-fast);
          min-height: 36px;
        "
      >
        <span style="width:12px;height:12px;border-radius:50%;background:${e.primary};flex-shrink:0"></span>
        ${e.label}
      </button>
    `).join(""),a.querySelectorAll(".nm-preset-mini").forEach(e=>{e.addEventListener("click",()=>{const n=e.dataset.preset,o=d.find(s=>s.id===n);l({preset:n,accent:null}),a.querySelectorAll(".nm-preset-mini").forEach(s=>{const p=d.find(u=>u.id===s.dataset.preset);s.style.borderColor=s.dataset.preset===n?p.primary:"var(--hairline)",s.setAttribute("aria-pressed",s.dataset.preset===n)}),c(`Tema ${o.label} diaktifkan`)})}));const i=document.getElementById("profile-swatches");i&&(i.innerHTML=h.map(e=>`
      <button class="nm-swatch" data-hex="${e}" aria-label="Aksen ${e}"
        style="
          width:28px;height:28px;border-radius:50%;background:${e};border:none;cursor:pointer;
          outline: ${t.accent===e?`3px solid ${e}`:"none"};
          outline-offset:2px; transition:transform var(--dur-fast);
          min-width:28px;
        "
      ></button>
    `).join(`
      <button class="nm-swatch" data-hex="reset"
        aria-label="Reset aksen"
        style="width:28px;height:28px;border-radius:50%;background:var(--surface-glass);border:1px solid var(--hairline);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.6875rem;min-width:28px">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
    `),i.querySelectorAll(".nm-swatch").forEach(e=>{e.addEventListener("click",()=>{const n=e.dataset.hex;l({accent:n==="reset"?null:n}),i.querySelectorAll(".nm-swatch").forEach(o=>{o.style.outline=o.dataset.hex===n&&n!=="reset"?`3px solid ${o.dataset.hex}`:"none"}),n!=="reset"&&c("Warna aksen diubah")})}));const r=document.getElementById("profile-anim-toggle");r&&(r.checked=t.animation!==!1,r.addEventListener("change",()=>{l({animation:r.checked})})),document.querySelectorAll(".profile-font-btn").forEach(e=>{e.classList.toggle("nm-filter-chip--active",e.dataset.size===t.fontSize),e.addEventListener("click",()=>{l({fontSize:e.dataset.size}),document.querySelectorAll(".profile-font-btn").forEach(n=>{n.classList.toggle("nm-filter-chip--active",n.dataset.size===e.dataset.size)})})})}function k(){const t=document.getElementById("profile-widget-order");if(!t)return;const a=y(),i={"bot-status":"Status Bot","now-playing":"Sedang Diputar","survival-vitals":"Kondisi Karakter",services:"Status Layanan"};t.innerHTML=a.map(r=>`
    <div class="nm-module-row nm-draggable" data-id="${r}" draggable="true"
      style="cursor:grab;user-select:none">
      <i class="fa-solid fa-grip-vertical" style="color:var(--muted);margin-right:var(--sp-xs);cursor:grab" aria-hidden="true"></i>
      <div class="nm-module-row__info">
        <p class="nm-module-row__name">${i[r]||r}</p>
      </div>
    </div>
  `).join(""),A(t)}function A(t){let a=null;t.addEventListener("dragstart",i=>{a=i.target.closest(".nm-draggable"),a&&(a.style.opacity="0.5")}),t.addEventListener("dragend",()=>{a&&(a.style.opacity="1"),a=null;const i=[...t.querySelectorAll(".nm-draggable")].map(r=>r.dataset.id);b(i),c("Urutan widget disimpan")}),t.addEventListener("dragover",i=>{i.preventDefault();const r=i.target.closest(".nm-draggable");if(r&&r!==a){const e=r.getBoundingClientRect(),n=i.clientY>e.top+e.height/2;t.insertBefore(a,n?r.nextSibling:r)}})}function B(t){var a;(a=document.getElementById("profile-logout"))==null||a.addEventListener("click",()=>{confirm("Yakin mau logout?")&&w()})}
