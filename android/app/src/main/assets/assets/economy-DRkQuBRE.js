import{a as w,l as E,i as S,b as h,c as q,d as C}from"./api-BRWRvht5.js";import{g as L,r as $}from"./auth-DUU6sWo9.js";import{b as x,a as g,c as N}from"./toaster-SAXJpLgQ.js";import{i as M}from"./reveal-DoGC9ktQ.js";document.addEventListener("DOMContentLoaded",async()=>{if(w(E()),S(),M(),!await L()){$();return}await T(),_()});async function T(){var t;const{data:e,error:r}=await h("/api/user/economy");if(r||!e){x("Gagal memuat data ekonomi");return}if(l("eco-wallet",n(e.wallet??0)),l("eco-bank",n(e.bank??0)),z(e.wallet??0),e.treasury)k(e.treasury);else{const{data:a}=await h("/api/realtime/economy");(t=a==null?void 0:a.data)!=null&&t.treasury&&k(a.data.treasury)}}function k(e){l("treasury-infra",`${n(e.infra??0)} NC`),l("treasury-lottery",`${n(e.lottery??0)} NSF`),l("treasury-subsidy",`${n(e.subsidy??0)} NSF`),l("treasury-merchant",`${n(e.merchant??0)} NSF`)}function _(){m("eco-btn-transfer",()=>u("transfer")),m("eco-btn-deposit",()=>u("deposit")),m("eco-btn-withdraw",()=>u("withdraw"))}function u(e){const t={transfer:{title:"Transfer NC",endpoint:"/api/economy/transfer",needsTarget:!0},deposit:{title:"Setor ke Bank",endpoint:"/api/economy/deposit",needsTarget:!1},withdraw:{title:"Tarik dari Bank",endpoint:"/api/economy/withdraw",needsTarget:!1}}[e],a=document.createElement("div");a.style.cssText=`
    position:fixed;bottom:0;left:0;right:0;z-index:99;
    background:var(--canvas);border-top:1px solid var(--hairline);
    border-radius:var(--r-xxl) var(--r-xxl) 0 0;
    padding:var(--sp-lg) var(--sp-lg) calc(var(--sp-xxl) + var(--nav-safe));
    animation: sheet-up var(--dur-slow) var(--ease-spring) both;
  `,a.innerHTML=`
    <h3 style="font-family:var(--font-display);font-size:0.8rem;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--sp-lg)">${t.title}</h3>
    ${t.needsTarget?`
      <label style="display:block;font-size:0.75rem;color:var(--body);margin-bottom:var(--sp-xs)">Username tujuan</label>
      <input id="eco-target" type="text" placeholder="@username"
        style="width:100%;padding:12px;background:var(--surface-glass);border:1px solid var(--hairline);border-radius:var(--r-lg);color:var(--ink);font-family:var(--font-body);font-size:0.875rem;margin-bottom:var(--sp-sm);outline:none">
    `:""}
    <label style="display:block;font-size:0.75rem;color:var(--body);margin-bottom:var(--sp-xs)">Jumlah NC</label>
    <input id="eco-amount" type="number" placeholder="0" min="1"
      style="width:100%;padding:12px;background:var(--surface-glass);border:1px solid var(--hairline);border-radius:var(--r-lg);color:var(--ink);font-family:var(--font-display);font-size:1rem;margin-bottom:var(--sp-sm);outline:none">
    <div class="nm-quick-chips" id="eco-quick-chips" style="margin-bottom:var(--sp-lg)"></div>
    <div style="display:flex;gap:var(--sp-xs)">
      <button class="nm-btn nm-btn--ghost nm-btn--full" id="eco-sheet-cancel">Batal</button>
      <button class="nm-btn nm-btn--primary nm-btn--full" id="eco-sheet-confirm">Konfirmasi</button>
    </div>
  `;const o=document.createElement("div");o.style.cssText="position:fixed;inset:0;z-index:98;background:rgba(11,12,16,0.6);backdrop-filter:blur(4px);animation:overlay-in var(--dur-normal) var(--ease-smooth) both";const d=()=>{a.remove(),o.remove()};o.addEventListener("click",d),a.querySelector("#eco-sheet-cancel").addEventListener("click",d);const p=a.querySelector("#eco-quick-chips");p&&[10,100,1e3,5e3].forEach(s=>{const i=document.createElement("button");i.className="nm-quick-chip",i.textContent=`+${n(s)}`,i.addEventListener("click",()=>{const c=a.querySelector("#eco-amount");c&&(c.value=String((Number(c.value)||0)+s))}),p.appendChild(i)}),a.querySelector("#eco-sheet-confirm").addEventListener("click",async()=>{var y,b,v;const s=Number((y=a.querySelector("#eco-amount"))==null?void 0:y.value),i=(v=(b=a.querySelector("#eco-target"))==null?void 0:b.value)==null?void 0:v.trim();if(!s||s<=0){g("Masukkan jumlah yang valid");return}if(t.needsTarget&&!i){g("Masukkan username tujuan");return}const c={amount:s};t.needsTarget&&(c.target=i);const{error:f}=await q(t.endpoint,c);if(f){x(`Gagal: ${f}`);return}N(t.title+" berhasil!"),d(),C("/api/user/economy"),T()}),document.body.appendChild(o),document.body.appendChild(a)}function z(e){const r=document.getElementById("eco-main-chips");if(!r)return;const t=[Math.round(e*.1),Math.round(e*.25),Math.round(e*.5),e],a=["10%","25%","50%","MAX"];r.innerHTML=t.map((o,d)=>`
    <button class="nm-quick-chip" data-amount="${o}">${a[d]} (${n(o)})</button>
  `).join("")}function l(e,r){const t=document.getElementById(e);t&&(t.textContent=r)}function m(e,r){var t;(t=document.getElementById(e))==null||t.addEventListener("click",r)}function n(e){return typeof e!="number"?"0":e.toLocaleString("id-ID")}
