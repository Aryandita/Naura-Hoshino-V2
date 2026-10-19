import{a as w,l as $,i as b,b as x}from"./api-BRWRvht5.js";import{g as k}from"./auth-DUU6sWo9.js";import{i as E}from"./reveal-DoGC9ktQ.js";let l="nc",d="all";document.addEventListener("DOMContentLoaded",async()=>{w($()),b(),E(),L(),await y()});function L(){document.querySelectorAll(".nm-lb-filter").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.filter,a=e.dataset.range;t&&(l=t),a&&(d=a),document.querySelectorAll("[data-filter]").forEach(s=>{s.classList.toggle("nm-filter-chip--active",s.dataset.filter===l),s.setAttribute("aria-pressed",s.dataset.filter===l?"true":"false")}),document.querySelectorAll("[data-range]").forEach(s=>{s.classList.toggle("nm-filter-chip--active",s.dataset.range===d),s.setAttribute("aria-pressed",s.dataset.range===d?"true":"false")}),y()})})}async function y(){var v;const e=await k(),t=document.getElementById("lb-list");if(!t)return;t.innerHTML=Array.from({length:8},()=>`
    <div class="nm-lb-row">
      <div class="nm-skeleton" style="width:24px;height:16px"></div>
      <div class="nm-skeleton" style="width:32px;height:32px;border-radius:50%"></div>
      <div class="nm-skeleton" style="flex:1;height:16px"></div>
      <div class="nm-skeleton" style="width:60px;height:16px"></div>
    </div>
  `).join("");const{data:a,error:s}=await x(`/api/leaderboard?type=${l}&range=${d}`);if(s||!((v=a==null?void 0:a.entries)!=null&&v.length)){t.innerHTML=`
      <div class="nm-empty" style="min-height:120px">
        <p class="nm-empty__title">Data belum tersedia</p>
        <p class="nm-empty__desc">Mulai aktif di server untuk masuk leaderboard!</p>
      </div>`;return}const r=a.selfRank??null,u=a.entries,f=document.getElementById("lb-top3");if(f){const o=["🥇","🥈","🥉"];f.innerHTML=u.slice(0,3).map((n,_)=>`
      <div class="nm-card" style="display:flex;align-items:center;gap:var(--sp-sm);padding:var(--sp-sm) var(--sp-md)">
        <span style="font-size:1.25rem;flex-shrink:0">${o[_]}</span>
        <img src="${n.avatar||p(n.userId)}" alt="${n.username}"
             class="nm-lb-row__avatar" loading="lazy">
        <div style="flex:1;overflow:hidden">
          <p style="font-size:0.875rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(n.displayName||n.username)}</p>
          <p style="font-size:0.6875rem;color:var(--muted)">Lv ${n.level??"?"}</p>
        </div>
        <span class="nm-lb-row__value">${m(n.value,l)}</span>
      </div>
    `).join("")}let i="",c=!1;u.slice(3).forEach(o=>{r&&!c&&o.rank>r&&r>3&&(i+=g(a.selfEntry,r),c=!0),i+=z(o,o.userId===(e==null?void 0:e.id))}),r&&!c&&r>3&&a.selfEntry&&(i+='<div class="nm-lb-row" style="opacity:0.5;font-size:0.6875rem;color:var(--muted);padding:var(--sp-xs) 0;text-align:center">···</div>',i+=g(a.selfEntry,r)),t.innerHTML=i||'<p style="font-size:0.8125rem;color:var(--muted);padding:var(--sp-sm)">Tidak ada data</p>'}function z(e,t){return`
    <div class="nm-lb-row ${t?"nm-lb-row--self":""}">
      <span class="nm-lb-row__rank">#${e.rank}</span>
      <img src="${e.avatar||p(e.userId)}" alt="${e.username}"
           class="nm-lb-row__avatar" loading="lazy">
      <span class="nm-lb-row__name">${h(e.displayName||e.username)}</span>
      <span class="nm-lb-row__value">${m(e.value,l)}</span>
    </div>`}function g(e,t,a){return`
    <div class="nm-lb-row nm-lb-row--self" style="position:sticky;bottom:calc(var(--nav-height) + 20px)">
      <span class="nm-lb-row__rank" style="color:var(--primary)">#${t}</span>
      <img src="${(e==null?void 0:e.avatar)||p(e==null?void 0:e.userId)}" alt="Kamu" class="nm-lb-row__avatar" loading="lazy">
      <span class="nm-lb-row__name" style="color:var(--primary)">Kamu</span>
      <span class="nm-lb-row__value">${m(e==null?void 0:e.value,l)}</span>
    </div>`}function m(e,t){if(e==null)return"-";const a=Number(e);return t==="nc"?a>=1e3?`${(a/1e3).toFixed(1)}K NC`:`${a} NC`:t==="nsf"?a>=1e3?`${(a/1e3).toFixed(1)}K NSF`:`${a} NSF`:t==="xp"?a>=1e3?`${(a/1e3).toFixed(1)}K XP`:`${a} XP`:t==="quest"?`${a} Quest`:String(a)}function h(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function p(e){return`https://cdn.discordapp.com/embed/avatars/${(BigInt(e||0)>>22n)%6n}.png`}
