import{a as u,l as y,i as v,b as c}from"./api-BRWRvht5.js";import{t as m}from"./toaster-SAXJpLgQ.js";document.addEventListener("DOMContentLoaded",async()=>{u(y()),v(),await Promise.all([b(),f()])});async function b(){const a=document.getElementById("nm-market-list"),t=document.getElementById("market-total-count"),{data:s,error:l}=await c("/api/marketplace/items");if(l||!s||!Array.isArray(s.items)){a&&(a.innerHTML=`
        <div class="nm-card" style="text-align:center; padding:var(--sp-xl) var(--sp-md);">
          <img src="/assets/Naura_Expression/Akward.png" alt="Kosong" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
          <p style="color:var(--muted); font-size:0.875rem">Belum ada barang yang sedang dilelang di bursa saat ini.</p>
        </div>
      `);return}const i=s.items;if(t&&(t.textContent=`${i.length} Barang`),i.length===0){a.innerHTML=`
      <div class="nm-card" style="text-align:center; padding:var(--sp-xl) var(--sp-md);">
        <img src="/assets/Naura_Expression/Cheers.png" alt="Kosong" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
        <p style="color:var(--muted); font-size:0.875rem">Semua lelang sedang kosong. Jadilah yang pertama melelang barang!</p>
      </div>
    `;return}const o={common:"nm-badge--slate",uncommon:"nm-badge--emerald",rare:"nm-badge--blue",epic:"nm-badge--purple",legendary:"nm-badge--gold"};a.innerHTML=i.map((e,r)=>{const n=(e.rarity||"common").toLowerCase(),d=o[n]||"nm-badge--slate";return`
      <div class="nm-card animate-fade-in-up" style="animation-delay:${r*40}ms; padding:var(--sp-sm)">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div>
            <span class="nm-badge ${d}" style="font-size:0.65rem; margin-bottom:4px">
              ${e.rarity||"Rare"}
            </span>
            <h4 style="font-size:0.9rem; font-weight:700; color:var(--ink); margin:2px 0">
              ${e.name} <span style="font-size:0.75rem; color:var(--muted); font-weight:400">x${e.amount}</span>
            </h4>
            <div style="font-size:0.75rem; color:var(--muted)">Penjual: <span style="color:var(--body-strong)">${e.sellerName}</span></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.7rem; color:var(--muted)">Tawaran Tertinggi</div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--accent-gold); font-family:var(--font-mono)">
              ${(e.currentBid||0).toLocaleString("id-ID")} ${e.currency}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:var(--sp-xs); margin-top:var(--sp-sm)">
          <button class="nm-btn nm-btn--sm nm-btn--glass btn-bid" style="flex:1" data-name="${e.name}" data-price="${e.currentBid}">
            <i class="fa-solid fa-hand-holding-dollar"></i> Ajukan Tawaran
          </button>
          ${e.buyoutPrice?`
            <button class="nm-btn nm-btn--sm nm-btn--primary btn-buyout" style="flex:1" data-name="${e.name}" data-price="${e.buyoutPrice}">
              <i class="fa-solid fa-cart-shopping"></i> Beli Sekarang (${e.buyoutPrice.toLocaleString("id-ID")})
            </button>
          `:""}
        </div>
      </div>
    `}).join(""),a.querySelectorAll(".btn-bid").forEach(e=>{e.addEventListener("click",()=>{const r=e.getAttribute("data-name"),n=e.getAttribute("data-price");m({title:"Penawaran Terkirim",body:`Tawaran untuk ${r} seharga ${parseInt(n,10)+50} NSF berhasil diajukan ke bursa lelang!`,variant:"info"})})}),a.querySelectorAll(".btn-buyout").forEach(e=>{e.addEventListener("click",()=>{const r=e.getAttribute("data-name"),n=e.getAttribute("data-price");m({title:"Pembelian Berhasil! 🎉",body:`Kamu berhasil membeli instan ${r} seharga ${parseInt(n,10).toLocaleString("id-ID")} NSF. Barang masuk ke ransel.`,variant:"success"})})})}async function f(){var o;const a=document.getElementById("nm-commodities-grid");if(!a)return;const{data:t}=await c("/api/realtime/economy"),s=((o=t==null?void 0:t.data)==null?void 0:o.stocks)||(t==null?void 0:t.stocks)||[];if(!s.length)return;const l=s.slice(0,3),i=["var(--accent-purple)","var(--accent-gold)","var(--accent-blue)"];a.innerHTML=l.map((e,r)=>{const n=String(e.change).startsWith("+")||e.trend==="up",d=n?"var(--wilds-emerald)":"var(--wilds-danger)",g=n?"▲":"▼",p=i[r%i.length];return`
      <div class="nm-card" style="padding:var(--sp-xs); background:rgba(255,255,255,0.02); text-align:center">
        <span style="font-size:0.75rem; color:var(--muted)">${e.symbol||e.name}</span>
        <div style="font-size:0.875rem; font-weight:700; color:${p}">${Number(e.price).toLocaleString("id-ID")} NSF</div>
        <span style="font-size:0.65rem; color:${d}">${e.change||"0%"} ${g}</span>
      </div>
    `}).join("")}
