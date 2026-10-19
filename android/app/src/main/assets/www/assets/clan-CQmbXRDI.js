import{a as m,l as g,i as u,b as p,c as y}from"./api-BRWRvht5.js";import{t as c}from"./toaster-SAXJpLgQ.js";document.addEventListener("DOMContentLoaded",async()=>{m(g()),u(),await v(),f()});async function v(){const{data:t}=await p("/api/clan/info");if(t&&t.clan){const e=t.clan,a=document.getElementById("clan-name"),i=document.getElementById("clan-tag"),s=document.getElementById("clan-desc"),r=document.getElementById("clan-level"),o=document.getElementById("clan-members-count"),d=document.getElementById("clan-treasury");a&&(a.textContent=e.name||"Sensei Brigade"),i&&(i.textContent=`[${e.tag||"VIP"}]`),s&&(s.textContent=e.description||"Sindikat petualang tangguh Naura Wilds."),r&&(r.textContent=`Lv. ${e.level||1}`),o&&(o.textContent=`${e.memberCount||1} Org`),d&&(d.textContent=`${(e.treasury||0).toLocaleString("id-ID")}`);const l=document.getElementById("clan-members-list");l&&Array.isArray(e.members)&&(l.innerHTML=e.members.map(n=>`
        <div class="nm-card" style="display:flex; align-items:center; justify-content:space-between; padding:var(--sp-xs) var(--sp-sm); background:rgba(255,255,255,0.02)">
          <div style="display:flex; align-items:center; gap:var(--sp-xs)">
            <img src="${n.avatar||"/assets/core/avatar.png"}" alt="${n.name}" style="width:32px; height:32px; border-radius:50%; object-fit:cover">
            <div>
              <div style="font-size:0.8125rem; font-weight:600">${n.name}</div>
              <div style="font-size:0.7rem; color:var(--muted)">${n.role||"Anggota"}</div>
            </div>
          </div>
          <span class="nm-badge ${n.role==="Ketua"?"nm-badge--gold":"nm-badge--purple"}" style="font-size:0.65rem">
            ${n.role==="Ketua"?"Pemimpin":"Petualang"}
          </span>
        </div>
      `).join(""))}else{const e=document.getElementById("clan-members-list");e&&(e.innerHTML=`
        <div class="nm-card" style="display:flex; align-items:center; justify-content:space-between; padding:var(--sp-xs) var(--sp-sm); background:rgba(255,255,255,0.02)">
          <div style="display:flex; align-items:center; gap:var(--sp-xs)">
            <img src="/assets/core/avatar.png" alt="Sensei" style="width:32px; height:32px; border-radius:50%">
            <div>
              <div style="font-size:0.8125rem; font-weight:600">Commander Sensei</div>
              <div style="font-size:0.7rem; color:var(--muted)">Ketua Sindikat</div>
            </div>
          </div>
          <span class="nm-badge nm-badge--gold" style="font-size:0.65rem">Pemimpin</span>
        </div>
      `)}}function f(){const t=document.getElementById("btn-contribute-energy");t&&t.addEventListener("click",async()=>{t.disabled=!0,t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Mendonasikan...';const{data:e,error:a}=await y("/api/territory/contribute",{territoryId:"tower_1",energyAmount:100});if(t.disabled=!1,t.innerHTML='<i class="fa-solid fa-bolt"></i> Donasi 50 NSF',a){c({title:"Donasi Gagal",body:a,variant:"danger"});return}if(c({title:"Kontribusi Sukses! ⚡",body:e.message||"Pertahanan teritori klan bertambah kokoh!",variant:"success"}),e.currentPoints){const i=document.getElementById("territory-points"),s=document.getElementById("territory-progress");i&&(i.textContent=`${e.currentPoints}/1000 CP`),s&&(s.style.width=`${Math.min(100,Math.round(e.currentPoints/1e3*100))}%`)}})}
