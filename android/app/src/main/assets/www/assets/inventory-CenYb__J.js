import{a as p,l as g,i as f,b as y}from"./api-BRWRvht5.js";import{t as v}from"./toaster-SAXJpLgQ.js";let m=[],c="all";document.addEventListener("DOMContentLoaded",async()=>{p(g()),f(),x(),await b()});function x(){const a=document.querySelectorAll(".nm-tab");a.forEach(e=>{e.addEventListener("click",()=>{a.forEach(r=>r.classList.remove("is-active")),e.classList.add("is-active"),c=e.getAttribute("data-filter")||"all",u()})})}async function b(){const a=document.getElementById("nm-inventory-grid"),{data:e,error:r}=await y("/api/inventory");if(r||!e){a&&(a.innerHTML=`
        <div style="grid-column: 1 / -1; text-align:center; padding: var(--sp-xl) var(--sp-md);">
          <img src="/assets/Naura_Expression/Sad.png" alt="Sedih" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
          <p style="color:var(--muted); font-size:0.875rem">Gagal memuat ransel petualang.</p>
        </div>
      `);return}const t=e.capacity||{used:0,max:30},i=document.getElementById("nm-inv-slots"),o=document.getElementById("nm-inv-progress"),d=document.getElementById("nm-inv-weight-desc"),l=Math.min(100,Math.round(t.used/(t.max||30)*100));i&&(i.textContent=`${t.used}/${t.max} Slot`),o&&(o.style.width=`${l}%`,o.className=l>85?"nm-progress__bar nm-progress__bar--danger":"nm-progress__bar nm-progress__bar--emerald"),d&&(d.textContent=e.isGuest?"Mode pratinjau tamu. Masuk lewat Discord untuk membawa ransel aslimu.":`Beban tas terpakai ${l}%. Ruang penyimpanan masih tersedia.`);const s=e.tools||{};if(s.pickaxe){const n=document.getElementById("tool-pickaxe-dura");n&&(n.textContent=`${s.pickaxe.durability||100}%`)}if(s.axe){const n=document.getElementById("tool-axe-dura");n&&(n.textContent=`${s.axe.durability||100}%`)}if(s.rod){const n=document.getElementById("tool-rod-dura");n&&(n.textContent=`${s.rod.durability||100}%`)}m=Array.isArray(e.items)?e.items:[],u()}function u(){const a=document.getElementById("nm-inventory-grid");if(!a)return;const e=m.filter(t=>c==="all"?!0:(t.category||"").toLowerCase()===c.toLowerCase());if(e.length===0){a.innerHTML=`
      <div style="grid-column: 1 / -1; text-align:center; padding: var(--sp-xl) var(--sp-md);">
        <img src="/assets/Naura_Expression/Cheers.png" alt="Kosong" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
        <p style="color:var(--muted); font-size:0.875rem">Tidak ada item di kategori ini.</p>
      </div>
    `;return}const r={common:"#9ca3af",uncommon:"#34d399",rare:"#38bdf8",epic:"#c084fc",legendary:"#fbbf24"};a.innerHTML=e.map((t,i)=>{const o=(t.rarity||"common").toLowerCase(),d=r[o]||r.common,l=t.icon||"fa-box";return`
      <div class="nm-card animate-fade-in-up"
           style="animation-delay:${i*40}ms; padding:var(--sp-xs); text-align:center; border-color:${d}33; cursor:pointer;"
           data-item-name="${t.name||t.id}"
           data-item-desc="${t.description||"Material petualangan Naura Wilds."}">
        <div style="font-size:1.5rem; margin-bottom:4px; color:${d}">
          <i class="fa-solid ${l}"></i>
        </div>
        <div style="font-size:0.75rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
          ${t.name||t.id}
        </div>
        <div style="font-size:0.7rem; color:var(--muted); font-family:var(--font-mono)">
          x${t.count||t.amount||1}
        </div>
      </div>
    `}).join(""),a.querySelectorAll(".nm-card").forEach(t=>{t.addEventListener("click",()=>{const i=t.getAttribute("data-item-name"),o=t.getAttribute("data-item-desc");v({title:i,body:o,variant:"info"})})})}
