(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const e of a)if(e.type==="childList")for(const n of e.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function i(a){const e={};return a.integrity&&(e.integrity=a.integrity),a.referrerPolicy&&(e.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?e.credentials="include":a.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function s(a){if(a.ep)return;a.ep=!0;const e=i(a);fetch(a.href,e)}})();class m{constructor(){this.initialized=!1,this.isExpanded=!0,this.activeTab="chat",this.currentMood="Happy",this.isPlaying=!0,this.spectrumAnimId=null,this.musicProgress=42,this.chatHistory=[]}async init(t={}){this.initialized||(this._createUI(),this._initEvents(),this._initSpectrumVisualizer(),this._initLiveTelemetry(),this._initChatWelcome(),this.initialized=!0)}_createUI(){const t=document.createElement("div");t.id="naura-viewer-container",t.innerHTML=`
      <div class="nv-panel is-expanded" id="nv-panel">
        <!-- Minimized Mode: Floating Anime Avatar Orb -->
        <div class="nv-mini-avatar-wrapper" id="nv-mini-trigger" title="Buka Naura OS">
          <img src="/assets/Naura_Expression/Happy.png" alt="Naura Avatar" class="nv-mini-avatar-img" id="nv-mini-img" onerror="this.src='/assets/Naura_Expression/Read.png'" />
          <span class="nv-mini-dot"></span>
        </div>

        <!-- Header Panel -->
        <div class="nv-header">
          <div class="nv-title-area">
            <span class="nv-status-dot"></span>
            <h3 class="nv-title">NAURA OS</h3>
          </div>

          <!-- Tab Selector Pill -->
          <div class="nv-tabs">
            <button class="nv-tab-btn is-active" data-tab="chat" title="AI Chat Assistant">
              <i class="fa-solid fa-comments"></i> <span>Chat</span>
            </button>
            <button class="nv-tab-btn" data-tab="music" title="Mini Music Player">
              <i class="fa-solid fa-music"></i> <span>Music</span>
            </button>
            <button class="nv-tab-btn" data-tab="hud" title="Live Telemetry">
              <i class="fa-solid fa-gauge-high"></i> <span>HUD</span>
            </button>
          </div>

          <!-- Minimize Button -->
          <button class="nv-btn-ctrl" id="nv-btn-min" title="Kecilkan Widget">
            <i class="fa-solid fa-compress"></i>
          </button>
        </div>

        <!-- Multi-Tab Body -->
        <div class="nv-body">
          <!-- TAB 1: 💬 AI CHAT ASSISTANT -->
          <div class="nv-tab-pane is-active" id="nv-pane-chat">
            <div class="nv-chat-hero">
              <div class="nv-avatar-frame">
                <img src="/assets/Naura_Expression/Happy.png" alt="Naura Mood" class="nv-avatar-img" id="nv-chat-avatar" onerror="this.src='/assets/Naura_Expression/Read.png'" />
              </div>
              <div class="nv-hero-info">
                <div class="nv-hero-name">
                  <span>Naura Hoshino</span>
                  <span class="text-[10px] text-emerald-400 font-mono">v2.1 AI</span>
                </div>
                <div class="nv-hero-status" id="nv-chat-mood-text">Ceria & Siap Menemanimu ✨</div>
              </div>
            </div>

            <!-- Chat History -->
            <div class="nv-chat-messages" id="nv-chat-messages"></div>

            <!-- Quick Action Chips -->
            <div class="nv-quick-chips">
              <button class="nv-chip" data-query="Status Bot">⚡ Status Bot</button>
              <button class="nv-chip" data-query="Cek Saldo">💰 Saldo Saya</button>
              <button class="nv-chip" data-query="Lagu yang diputar">🎵 Now Playing</button>
              <button class="nv-chip" data-query="Aturan Server">📜 Server Rules</button>
              <button class="nv-chip" data-query="Lempar Dadu">🎲 Lempar Dadu</button>
            </div>

            <!-- Chat Input -->
            <div class="nv-chat-input-area">
              <input type="text" class="nv-chat-input" id="nv-chat-input" placeholder="Tanya sesuatu ke Naura..." autocomplete="off" />
              <button class="nv-chat-send-btn" id="nv-chat-send" title="Kirim Pesan">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>
          </div>

          <!-- TAB 2: 🎵 MINI MUSIC PLAYER & SPECTRUM VISUALIZER -->
          <div class="nv-tab-pane" id="nv-pane-music">
            <div class="nv-music-container">
              <!-- Now Playing Card -->
              <div class="nv-music-card">
                <div class="nv-music-vinyl" id="nv-vinyl">
                  <div class="nv-vinyl-center"></div>
                </div>
                <div class="nv-music-meta">
                  <div class="nv-track-title" id="nv-track-title">Cyber Kawaii Lo-Fi Stream</div>
                  <div class="nv-track-artist" id="nv-track-artist">Naura FM • 128kbps HQ Audio</div>
                </div>
              </div>

              <!-- Neon Spectrum Visualizer -->
              <div class="nv-spectrum-box">
                <div class="nv-spectrum-header">
                  <span>AUDIO FREQUENCY SPECTRUM</span>
                  <span id="nv-spectrum-fps">60 FPS</span>
                </div>
                <canvas id="nv-spectrum-canvas"></canvas>
              </div>

              <!-- Progress Bar -->
              <div class="nv-progress-wrap">
                <div class="nv-progress-bar" id="nv-progress-bar">
                  <div class="nv-progress-fill" id="nv-progress-fill"></div>
                </div>
                <div class="nv-time-row">
                  <span id="nv-time-current">01:38</span>
                  <span id="nv-time-total">03:52</span>
                </div>
              </div>

              <!-- Playback Controls -->
              <div class="nv-ctrl-row">
                <button class="nv-btn-play-action" id="nv-btn-prev" title="Lagu Sebelumnya">
                  <i class="fa-solid fa-backward-step"></i>
                </button>
                <button class="nv-btn-play-action is-main" id="nv-btn-play" title="Play/Pause">
                  <i class="fa-solid fa-pause" id="nv-icon-play"></i>
                </button>
                <button class="nv-btn-play-action" id="nv-btn-next" title="Lagu Selanjutnya">
                  <i class="fa-solid fa-forward-step"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- TAB 3: ⚡ CYBER HUD & TELEMETRY -->
          <div class="nv-tab-pane" id="nv-pane-hud">
            <div class="nv-hud-container">
              <!-- Top Grid Metrics -->
              <div class="nv-hud-grid">
                <div class="nv-hud-stat-card">
                  <span class="nv-hud-stat-label">Gateway Ping</span>
                  <span class="nv-hud-stat-val text-green" id="nv-hud-ping">28 ms</span>
                </div>
                <div class="nv-hud-stat-card">
                  <span class="nv-hud-stat-label">System State</span>
                  <span class="nv-hud-stat-val text-pink">OPTIMAL</span>
                </div>
              </div>

              <!-- System Resource Bars -->
              <div class="nv-hud-bar-group">
                <div class="nv-hud-bar-item">
                  <div class="nv-hud-bar-label">
                    <span>RAM USAGE</span>
                    <span id="nv-hud-ram-text">1.42 GB / 8.0 GB</span>
                  </div>
                  <div class="nv-hud-meter">
                    <div class="nv-hud-meter-fill fill-pink" id="nv-hud-ram-fill" style="width: 28%;"></div>
                  </div>
                </div>

                <div class="nv-hud-bar-item">
                  <div class="nv-hud-bar-label">
                    <span>CPU LOAD</span>
                    <span id="nv-hud-cpu-text">3.8%</span>
                  </div>
                  <div class="nv-hud-meter">
                    <div class="nv-hud-meter-fill fill-cyan" id="nv-hud-cpu-fill" style="width: 14%;"></div>
                  </div>
                </div>
              </div>

              <!-- Live Event Log Stream -->
              <div class="nv-hud-feed-box">
                <div class="nv-feed-title">
                  <i class="fa-solid fa-terminal"></i>
                  <span>LIVE SERVER LOG STREAM</span>
                </div>
                <div class="nv-feed-list" id="nv-hud-log-list">
                  <div class="nv-feed-item"><span class="highlight">[SYSTEM]</span> WebSocket Shard #0 terhubung.</div>
                  <div class="nv-feed-item"><span class="highlight">[DATABASE]</span> Supabase cluster sinkron 100%.</div>
                  <div class="nv-feed-item"><span class="highlight">[MUSIC]</span> Node Lavalink active standby.</div>
                  <div class="nv-feed-item"><span class="highlight">[AI]</span> Gemini Memory Cache ready.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,document.body.appendChild(t),this.ui={container:t,panel:t.querySelector("#nv-panel"),btnMin:t.querySelector("#nv-btn-min"),miniTrigger:t.querySelector("#nv-mini-trigger"),tabButtons:t.querySelectorAll(".nv-tab-btn"),tabPanes:{chat:t.querySelector("#nv-pane-chat"),music:t.querySelector("#nv-pane-music"),hud:t.querySelector("#nv-pane-hud")},chat:{avatar:t.querySelector("#nv-chat-avatar"),moodText:t.querySelector("#nv-chat-mood-text"),messages:t.querySelector("#nv-chat-messages"),input:t.querySelector("#nv-chat-input"),sendBtn:t.querySelector("#nv-chat-send"),chips:t.querySelectorAll(".nv-chip")},music:{vinyl:t.querySelector("#nv-vinyl"),trackTitle:t.querySelector("#nv-track-title"),trackArtist:t.querySelector("#nv-track-artist"),canvas:t.querySelector("#nv-spectrum-canvas"),btnPlay:t.querySelector("#nv-btn-play"),iconPlay:t.querySelector("#nv-icon-play"),btnPrev:t.querySelector("#nv-btn-prev"),btnNext:t.querySelector("#nv-btn-next"),progressFill:t.querySelector("#nv-progress-fill"),timeCurrent:t.querySelector("#nv-time-current")},hud:{ping:t.querySelector("#nv-hud-ping"),ramText:t.querySelector("#nv-hud-ram-text"),ramFill:t.querySelector("#nv-hud-ram-fill"),cpuText:t.querySelector("#nv-hud-cpu-text"),cpuFill:t.querySelector("#nv-hud-cpu-fill"),logList:t.querySelector("#nv-hud-log-list")}}}_initEvents(){this.ui.tabButtons.forEach(t=>{t.addEventListener("click",()=>{const i=t.dataset.tab;this.switchTab(i)})}),this.ui.btnMin.addEventListener("click",t=>{t.stopPropagation(),this.toggleMinimize()}),this.ui.miniTrigger.addEventListener("click",()=>{this.isExpanded||this.toggleMinimize()}),this.ui.chat.sendBtn.addEventListener("click",()=>this._sendChatMessage()),this.ui.chat.input.addEventListener("keydown",t=>{t.key==="Enter"&&(t.preventDefault(),this._sendChatMessage())}),this.ui.chat.chips.forEach(t=>{t.addEventListener("click",()=>{const i=t.dataset.query;this.ui.chat.input.value=i,this._sendChatMessage()})}),this.ui.music.btnPlay.addEventListener("click",()=>this.toggleMusicPlay()),this.ui.music.btnNext.addEventListener("click",()=>{this._changeMusicTrack("Next")}),this.ui.music.btnPrev.addEventListener("click",()=>{this._changeMusicTrack("Prev")})}switchTab(t){this.ui.tabPanes[t]&&(this.activeTab=t,this.ui.tabButtons.forEach(i=>{i.dataset.tab===t?i.classList.add("is-active"):i.classList.remove("is-active")}),Object.keys(this.ui.tabPanes).forEach(i=>{i===t?this.ui.tabPanes[i].classList.add("is-active"):this.ui.tabPanes[i].classList.remove("is-active")}))}toggleMinimize(){this.isExpanded=!this.isExpanded,this.isExpanded?(this.ui.panel.classList.remove("is-minimized"),this.ui.panel.classList.add("is-expanded")):(this.ui.panel.classList.remove("is-expanded"),this.ui.panel.classList.add("is-minimized"))}_initChatWelcome(){this._appendMessage("bot","Halo! Aku Naura Hoshino, asisten virtualmu. Ada yang bisa kubantu di server atau dashboard hari ini? 🌸")}setMood(t,i=""){this.currentMood=t;const s=`/assets/Naura_Expression/${t}.png`;this.ui.chat.avatar&&(this.ui.chat.avatar.src=s),i&&this.ui.chat.moodText&&(this.ui.chat.moodText.textContent=i)}async _sendChatMessage(){const t=(this.ui.chat.input.value||"").trim();if(t){this._appendMessage("user",t),this.ui.chat.input.value="",this.setMood("Thinking","Sedang berpikir...");try{const i=await this._fetchAIReply(t);this._appendMessage("bot",i.text),this.setMood(i.mood||"Happy",i.status||"Ceria & Siap Menemanimu ✨")}catch{this._appendMessage("bot","Maaf ya, Naura sedang mengalami kendala koneksi ke server. Coba lagi sebentar lagi!"),this.setMood("Cry","Koneksi Terganggu")}}}_appendMessage(t,i){const s=document.createElement("div");s.className=`nv-msg is-${t}`;const a=document.createElement("div");a.className="nv-msg-bubble",a.textContent=i,s.appendChild(a),this.ui.chat.messages.appendChild(s),this.ui.chat.messages.scrollTop=this.ui.chat.messages.scrollHeight}async _fetchAIReply(t){try{const s=await fetch("/api/settings/sandbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:t})});if(s.ok){const a=await s.json();if(a.reply)return{text:a.reply,mood:"Happy",status:"Selesai Membantu ✨"}}}catch{}const i=t.toLowerCase();return i.includes("status")||i.includes("ping")?{text:"Status bot saat ini: 🟢 ONLINE dengan latensi 28ms. Seluruh database (Supabase, Redis, Mongo) berjalan normal!",mood:"Cheers",status:"Sistem Stabil ⚡"}:i.includes("saldo")||i.includes("coin")||i.includes("uang")?{text:"Saldo akunmu saat ini: 1.542.000 Coins dan 35 Naura Coupons di Bank Vault!",mood:"Happy",status:"Ekonomi Aktif 💰"}:i.includes("lagu")||i.includes("music")||i.includes("putar")?{text:"Saat ini sedang memutar: 'Cyber Kawaii Lo-Fi Stream' di Voice Channel #General!",mood:"Cheers",status:"Memutar Musik 🎵"}:i.includes("dadu")||i.includes("roll")?{text:`🎲 Dadu bergulir... dan hasilnya adalah **${Math.floor(Math.random()*6)+1}**! Semoga beruntung ya!`,mood:"Shocked",status:"Mini Game 🎲"}:i.includes("aturan")||i.includes("rules")?{text:"Aturan server utama: 1. Bersikap ramah & saling menghormati. 2. Dilarang spam. 3. Gunakan channel sesuai fungsinya!",mood:"Read",status:"Panduan Server 📜"}:{text:`Naura siap bantu! Mengenai "${t}", kamu juga bisa gunakan perintah slash di Discord seperti /help untuk info lengkap ya! ✨`,mood:"Happy",status:"Siap Membantu 🌸"}}_initSpectrumVisualizer(){const t=this.ui.music.canvas;if(!t)return;const i=t.getContext("2d"),s=24,a=()=>{t.width!==t.clientWidth&&(t.width=t.clientWidth,t.height=t.clientHeight),i.clearRect(0,0,t.width,t.height);const e=t.width/s-3,n=Date.now()*.003;for(let r=0;r<s;r++){let c;if(this.isPlaying){const h=Math.sin(n+r*.4)*.5+.5,p=Math.sin(n*2.5+r)*.3+.3;c=Math.max(6,(h*.6+p*.4)*(t.height-10))}else c=4;const u=r*(e+3),v=t.height-c,l=i.createLinearGradient(0,t.height,0,0);l.addColorStop(0,"#06b6d4"),l.addColorStop(.6,"#ec4899"),l.addColorStop(1,"#c084fc"),i.fillStyle=l,i.shadowColor="#ec4899",i.shadowBlur=this.isPlaying?8:0,i.fillRect(u,v,e,c)}this.spectrumAnimId=requestAnimationFrame(a)};a()}toggleMusicPlay(){this.isPlaying=!this.isPlaying,this.isPlaying?(this.ui.music.iconPlay.className="fa-solid fa-pause",this.ui.music.vinyl.classList.remove("is-paused")):(this.ui.music.iconPlay.className="fa-solid fa-play",this.ui.music.vinyl.classList.add("is-paused"))}_changeMusicTrack(t){const i=[{title:"Cyber Kawaii Lo-Fi Stream",artist:"Naura FM • 128kbps HQ"},{title:"Midnight Sakura Neon Beat",artist:"Hoshino Electro Lab"},{title:"Neo-Tokyo Rainy Cafe",artist:"Naura Acoustic Live"}],s=i[Math.floor(Math.random()*i.length)];this.ui.music.trackTitle.textContent=s.title,this.ui.music.trackArtist.textContent=s.artist,this.isPlaying=!0,this.ui.music.iconPlay.className="fa-solid fa-pause",this.ui.music.vinyl.classList.remove("is-paused")}_initLiveTelemetry(){setInterval(()=>{if(this.activeTab==="hud"){const t=Math.floor(Math.random()*6)-3,i=Math.max(18,28+t);this.ui.hud.ping&&(this.ui.hud.ping.textContent=`${i} ms`)}},3e3)}}const d=new m;typeof window<"u"&&(window.addEventListener("DOMContentLoaded",()=>{d.init()}),window.NauraViewer=d);export{d as N};
