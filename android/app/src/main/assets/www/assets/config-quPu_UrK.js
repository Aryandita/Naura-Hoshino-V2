import{a as m,l as u,i as d,b as c,c as g}from"./api-BRWRvht5.js";import{g as p,r as v}from"./auth-DUU6sWo9.js";import{a as f,b as y,c as b}from"./toaster-SAXJpLgQ.js";import{i as k}from"./reveal-DoGC9ktQ.js";let i=null,s={};document.addEventListener("DOMContentLoaded",async()=>{if(m(u()),d(),k(),!await p()){v();return}await h()});async function h(e){const{data:a,error:t}=await c("/api/guilds/managed");if(t||!(a!=null&&a.length)){w();return}const n=document.getElementById("cfg-guild-select");n&&(a.forEach(o=>{const l=document.createElement("option");l.value=o.id,l.textContent=o.name,n.appendChild(l)}),n.addEventListener("change",()=>{i=n.value,r(i)}),i=a[0].id,n.value=i,r(i))}async function r(e){const a=document.getElementById("cfg-modules");if(!a)return;a.innerHTML=Array.from({length:6},()=>`
    <div class="nm-module-row">
      <div class="nm-skeleton" style="width:60%;height:16px;margin-bottom:4px"></div>
      <div class="nm-skeleton" style="width:44px;height:24px;border-radius:12px"></div>
    </div>
  `).join("");const{data:t,error:n}=await c(`/api/guild/${e}/settings`);if(n||!t){a.innerHTML=`
      <p style="font-size:0.8125rem;color:var(--muted)">
        Gagal memuat konfigurasi server.
      </p>`;return}s=t.modules??{},E()}const _=[{key:"economy",label:"Economy System",desc:"Dompet, bank, dan pasar NC"},{key:"survival",label:"Survival RPG",desc:"Naura Wilds, vitals dan petualangan"},{key:"music",label:"Music (Lavalink)",desc:"Putar musik dari YouTube, Spotify, dll."},{key:"automod",label:"Auto Moderation",desc:"Filter pesan otomatis dan anti-spam"},{key:"welcome",label:"Welcome Message",desc:"Pesan sambutan anggota baru"},{key:"leveling",label:"Leveling System",desc:"XP dan naik level dari aktivitas chat"},{key:"ticket",label:"Ticket System",desc:"Sistem tiket dukungan untuk member"},{key:"ai_chat",label:"AI Chat Companion",desc:"Naura AI akan merespons mention"}];function E(e){const a=document.getElementById("cfg-modules");a&&(a.innerHTML=_.map(t=>{const n=!!s[t.key];return`
      <div class="nm-module-row">
        <div class="nm-module-row__info">
          <p class="nm-module-row__name">${t.label}</p>
          <p class="nm-module-row__desc">${t.desc}</p>
        </div>
        <label class="nm-toggle" title="Toggle ${t.label}">
          <input type="checkbox" class="cfg-module-toggle" data-key="${t.key}" ${n?"checked":""}>
          <div class="nm-toggle__track"><div class="nm-toggle__thumb"></div></div>
        </label>
      </div>
    `}).join(""),a.querySelectorAll(".cfg-module-toggle").forEach(t=>{t.addEventListener("change",()=>{s[t.dataset.key]=t.checked})}))}document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("cfg-save");e==null||e.addEventListener("click",L)});async function L(){if(!i){f("Pilih server dulu");return}const e=document.getElementById("cfg-save");e&&(e.disabled=!0,e.textContent="Menyimpan...");const{error:a}=await g(`/api/guild/${i}/settings`,{modules:s});if(e&&(e.disabled=!1,e.textContent="Simpan Perubahan"),a){y(`Gagal menyimpan: ${a}`);return}b("Konfigurasi berhasil disimpan!")}function w(){const e=document.querySelector(".nm-page");e&&(e.innerHTML=`
    <div class="nm-empty">
      <i class="fa-solid fa-shield-halved" style="font-size:2rem;color:var(--accent-purple);margin-bottom:var(--sp-sm)"></i>
      <h2 class="nm-empty__title">Tidak ada server yang dikelola</h2>
      <p class="nm-empty__desc">Kamu perlu memiliki izin "Manage Server" di server tempat Naura berada.</p>
      <a href="/mobile/" class="nm-btn nm-btn--ghost">Kembali ke Beranda</a>
    </div>
    <nav id="nm-bottom-nav"></nav>
  `,d())}
