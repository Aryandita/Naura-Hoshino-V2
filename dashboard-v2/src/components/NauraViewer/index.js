/**
 * index.js - Multi-Tab Cyber-Anime Floating Widget (NAURA OS).
 * Menyatukan AI Chat Assistant, Mini Cyber Music Player & Spectrum Visualizer,
 * serta Live Telemetry HUD ke dalam floating panel interaktif.
 *
 * FIX BUG-04/08: Auto-init dihapus dari DOMContentLoaded.
 * Setiap halaman harus memanggil NauraViewer.init({ context: 'nama' }) secara eksplisit,
 * sehingga context plugin per halaman bisa dimuat dengan benar.
 */

import "./viewer.css";
import { Naura3DViewer } from "./viewer3d.js";

class NauraViewerClass {
    constructor() {
        this.initialized = false;
        this.isExpanded = false;
        this.activeTab = "chat"; // 'chat' | 'music' | 'hud'
        this.currentMood = "Happy";
        this.isPlaying = true;
        this.spectrumAnimId = null;
        this.musicProgress = 42; // persen
        this.chatHistory = [];
        this.viewer3d = null;
        this.activeContext = null; // Context reaktivitas per halaman
    }

    /**
     * Inisialisasi widget Naura OS ke dalam DOM.
     * @param {Object} options
     * @param {string} [options.context] - Nama context halaman: 'index' | 'status' | 'music' | 'portfolio' | dll.
     */
    async init(options = {}) {
        if (this.initialized) return;

        this._createUI();
        this._initEvents();
        this._initSpectrumVisualizer();
        this._initLiveTelemetry();
        this._initChatWelcome();
        await this._init3DViewer();

        // Muat context reaktivitas per halaman bila disediakan
        if (options.context) {
            await this._loadContext(options.context);
        }

        this.initialized = true;
    }

    /**
     * Muat dan inisialisasi context plugin per halaman secara dinamis.
     * Context mengatur reaktivitas mood Naura berdasarkan event Socket.IO halaman.
     * @param {string} contextName - Nama context ('index', 'status', 'music', dll.)
     */
    async _loadContext(contextName) {
        try {
            // Coba load context spesifik untuk halaman ini
            const contextModule = await import(`./contexts/${contextName}.context.js`).catch(
                () => import("./contexts/default.context.js")
            );

            const contextFactory = contextModule.default;
            if (typeof contextFactory === "function") {
                // Context menerima referensi ke viewer ini sebagai interface
                const viewerInterface = {
                    setMood: (mood, status) => this.setMood(mood, status),
                    triggerWave: () => this.triggerWave(),
                    isLoaded: () => this.viewer3d !== null,
                };

                this.activeContext = contextFactory(viewerInterface);
                if (this.activeContext && typeof this.activeContext.init === "function") {
                    // Tunggu DOM fully ready sebelum context mulai listen socket
                    if (document.readyState === "complete") {
                        this.activeContext.init();
                    } else {
                        window.addEventListener("load", () => this.activeContext.init(), { once: true });
                    }
                }
            }
        } catch (err) {
            // Context gagal dimuat, tidak kritis, widget tetap berjalan tanpa reaktivitas
            console.warn("[NauraViewer] Context plugin tidak ditemukan:", contextName, err.message);
        }
    }

    _createUI() {
        const container = document.createElement("div");
        container.id = "naura-viewer-container";

        container.innerHTML = `
      <div class="nv-panel" id="nv-panel">
        <!-- Minimized Mode: Floating Anime Avatar Orb -->
        <div class="nv-mini-avatar-wrapper" id="nv-mini-trigger" title="Buka Naura OS">
          <img src="/assets/Naura_Expression/Happy.png" alt="Naura Avatar" class="nv-mini-avatar-img" id="nv-mini-img" onerror="this.onerror=null; this.src='/assets/Naura_Expression/Read.png';" />
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
              <div class="nv-avatar-frame" id="nv-avatar-frame-3d" title="Klik untuk menyapa Naura 🌸">
                <canvas class="nv-avatar-3d-canvas" id="nv-chat-3d-canvas"></canvas>
                <img src="/assets/Naura_Expression/Happy.png" alt="Naura Mood" class="nv-avatar-img" id="nv-chat-avatar" onerror="this.onerror=null; this.src='/assets/Naura_Expression/Read.png';" style="display:none;" />
                <span class="nv-badge-3d">3D LIVE</span>
                <span class="nv-btn-wave-hint"><i class="fa-solid fa-hand-sparkles"></i> Wave</span>
              </div>
              <div class="nv-hero-info">
                <div class="nv-hero-name">
                  <span>Naura Hoshino</span>
                  <span class="text-[10px] text-emerald-400 font-mono">v2.1 3D AI</span>
                </div>
                <div class="nv-hero-status" id="nv-chat-mood-text">Ceria & Siap Menemanimu ✨</div>
              </div>
            </div>

            <!-- Chat History -->
            <div class="nv-chat-messages" id="nv-chat-messages"></div>

            <!-- Quick Action Chips -->
            <div class="nv-quick-chips">
              <button class="nv-chip" data-action="wave">👋 Sapa Naura</button>
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
    `;

        document.body.appendChild(container);

        this.ui = {
            container,
            panel: container.querySelector("#nv-panel"),
            btnMin: container.querySelector("#nv-btn-min"),
            miniTrigger: container.querySelector("#nv-mini-trigger"),
            tabButtons: container.querySelectorAll(".nv-tab-btn"),
            tabPanes: {
                chat: container.querySelector("#nv-pane-chat"),
                music: container.querySelector("#nv-pane-music"),
                hud: container.querySelector("#nv-pane-hud"),
            },
            chat: {
                avatar: container.querySelector("#nv-chat-avatar"),
                avatar3dFrame: container.querySelector("#nv-avatar-frame-3d"),
                canvas3d: container.querySelector("#nv-chat-3d-canvas"),
                moodText: container.querySelector("#nv-chat-mood-text"),
                messages: container.querySelector("#nv-chat-messages"),
                input: container.querySelector("#nv-chat-input"),
                sendBtn: container.querySelector("#nv-chat-send"),
                chips: container.querySelectorAll(".nv-chip"),
            },
            music: {
                vinyl: container.querySelector("#nv-vinyl"),
                trackTitle: container.querySelector("#nv-track-title"),
                trackArtist: container.querySelector("#nv-track-artist"),
                canvas: container.querySelector("#nv-spectrum-canvas"),
                btnPlay: container.querySelector("#nv-btn-play"),
                iconPlay: container.querySelector("#nv-icon-play"),
                btnPrev: container.querySelector("#nv-btn-prev"),
                btnNext: container.querySelector("#nv-btn-next"),
                progressFill: container.querySelector("#nv-progress-fill"),
                timeCurrent: container.querySelector("#nv-time-current"),
            },
            hud: {
                ping: container.querySelector("#nv-hud-ping"),
                ramText: container.querySelector("#nv-hud-ram-text"),
                ramFill: container.querySelector("#nv-hud-ram-fill"),
                cpuText: container.querySelector("#nv-hud-cpu-text"),
                cpuFill: container.querySelector("#nv-hud-cpu-fill"),
                logList: container.querySelector("#nv-hud-log-list"),
            },
        };
    }

    _initEvents() {
        // 1. Tab Switching
        this.ui.tabButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
            });
        });

        // 2. Minimize & Expand Toggle
        this.ui.btnMin.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        });

        this.ui.miniTrigger.addEventListener("click", () => {
            if (!this.isExpanded) this.toggleMinimize();
        });

        // 3. AI Chat Submission
        this.ui.chat.sendBtn.addEventListener("click", () => this._sendChatMessage());
        this.ui.chat.input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this._sendChatMessage();
            }
        });

        // 4. Quick Action Chips
        this.ui.chat.chips.forEach((chip) => {
            chip.addEventListener("click", () => {
                if (chip.dataset.action === "wave") {
                    this.triggerWave();
                    this.setMood("Happy", "Halo! Senang bertemu denganmu! 🌸");
                    return;
                }
                const query = chip.dataset.query;
                this.ui.chat.input.value = query;
                this._sendChatMessage();
            });
        });

        // 5. Music Play/Pause Toggle
        this.ui.music.btnPlay.addEventListener("click", () => this.toggleMusicPlay());
        this.ui.music.btnNext.addEventListener("click", () => {
            this._changeMusicTrack("Next");
        });
        this.ui.music.btnPrev.addEventListener("click", () => {
            this._changeMusicTrack("Prev");
        });

        // 6. 3D Avatar Click Interaction (Wave greeting)
        if (this.ui.chat.avatar3dFrame) {
            this.ui.chat.avatar3dFrame.addEventListener("click", () => {
                this.triggerWave();
                this.setMood("Happy", "Halo! Senang bertemu denganmu! 🌸");
            });
        }
    }

    async _init3DViewer() {
        if (!this.ui.chat.canvas3d) return;

        try {
            this.viewer3d = new Naura3DViewer(this.ui.chat.canvas3d, {
                modelPath: "/models/naura.vrm",
                lookAtCursor: true,
                cameraFov: 36,
                cameraY: 0.32,
                cameraZ: 1.05,
            });

            const loaded = await this.viewer3d.init();
            if (loaded) {
                this.ui.chat.canvas3d.style.display = "block";
                if (this.ui.chat.avatar) {
                    this.ui.chat.avatar.style.display = "none";
                }
                // Tandai badge 3D LIVE terlihat
                const badge = this.ui.chat.avatar3dFrame
                    ? this.ui.chat.avatar3dFrame.querySelector(".nv-badge-3d")
                    : null;
                if (badge) badge.style.display = "block";
            } else {
                this._fallbackTo2D();
            }
        } catch (err) {
            console.warn("[NauraViewer] 3D Viewer fallback to 2D:", err);
            this._fallbackTo2D();
        }
    }

    /**
     * Tampilkan avatar 2D sebagai fallback bila WebGL gagal.
     */
    _fallbackTo2D() {
        if (this.ui.chat.canvas3d) this.ui.chat.canvas3d.style.display = "none";
        if (this.ui.chat.avatar) this.ui.chat.avatar.style.display = "block";
        // Sembunyikan badge 3D LIVE
        const badge = this.ui.chat.avatar3dFrame
            ? this.ui.chat.avatar3dFrame.querySelector(".nv-badge-3d")
            : null;
        if (badge) badge.style.display = "none";
    }

    triggerWave() {
        if (this.viewer3d) {
            this.viewer3d.triggerWave();
        }
    }

    switchTab(tabName) {
        if (!this.ui.tabPanes[tabName]) return;
        this.activeTab = tabName;

        // Update tab button classes
        this.ui.tabButtons.forEach((btn) => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add("is-active");
            } else {
                btn.classList.remove("is-active");
            }
        });

        // Update pane visibility
        Object.keys(this.ui.tabPanes).forEach((key) => {
            if (key === tabName) {
                this.ui.tabPanes[key].classList.add("is-active");
            } else {
                this.ui.tabPanes[key].classList.remove("is-active");
            }
        });
    }

    toggleMinimize() {
        this.isExpanded = !this.isExpanded;
        if (this.isExpanded) {
            this.ui.panel.classList.remove("is-minimized");
            this.ui.panel.classList.add("is-expanded");
        } else {
            this.ui.panel.classList.remove("is-expanded");
            this.ui.panel.classList.add("is-minimized");
        }
    }

    // =========================================================================
    // CHAT CONTROLLER & EMOTION AVATARS
    // =========================================================================
    _initChatWelcome() {
        this._appendMessage("bot", "Halo! Aku Naura Hoshino, asisten virtualmu. Ada yang bisa kubantu di server atau dashboard hari ini? 🌸");
    }

    setMood(expressionName, moodStatus = "") {
        this.currentMood = expressionName;
        if (this.viewer3d) {
            this.viewer3d.setMood(expressionName);
        }
        const avatarUrl = `/assets/Naura_Expression/${expressionName}.png`;
        if (this.ui.chat.avatar) {
            this.ui.chat.avatar.src = avatarUrl;
        }
        if (moodStatus && this.ui.chat.moodText) {
            this.ui.chat.moodText.textContent = moodStatus;
        }
    }

    async _sendChatMessage() {
        const text = (this.ui.chat.input.value || "").trim();
        if (!text) return;

        // 1. Add user message
        this._appendMessage("user", text);
        this.ui.chat.input.value = "";

        // 2. Set thinking mood
        this.setMood("Thinking", "Sedang berpikir...");

        // 3. Call AI endpoint or fallback response
        try {
            const reply = await this._fetchAIReply(text);
            this._appendMessage("bot", reply.text);
            this.setMood("Talk", "Naura menjawab...");
            setTimeout(() => {
                this.setMood(reply.mood || "Happy", reply.status || "Ceria & Siap Menemanimu ✨");
            }, 1500);
        } catch (e) {
            this._appendMessage("bot", "Maaf ya, Naura sedang mengalami kendala koneksi ke server. Coba lagi sebentar lagi!");
            this.setMood("Cry", "Koneksi Terganggu");
        }
    }

    _appendMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `nv-msg is-${sender}`;

        const bubble = document.createElement("div");
        bubble.className = "nv-msg-bubble";
        bubble.textContent = text;

        msgDiv.appendChild(bubble);
        this.ui.chat.messages.appendChild(msgDiv);
        this.ui.chat.messages.scrollTop = this.ui.chat.messages.scrollHeight;
    }

    async _fetchAIReply(message) {
        // Coba endpoint sandbox dashboard
        try {
            const res = await fetch("/api/settings/sandbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.reply) {
                    return { text: data.reply, mood: "Happy", status: "Selesai Membantu ✨" };
                }
            }
        } catch {
            // Fallback
        }

        // Fallback response engine pintar lokal
        const q = message.toLowerCase();
        if (q.includes("status") || q.includes("ping")) {
            return {
                text: "Status bot saat ini: 🟢 ONLINE dengan latensi 28ms. Seluruh database (Supabase, Redis, Mongo) berjalan normal!",
                mood: "Cheers",
                status: "Sistem Stabil ⚡"
            };
        }
        if (q.includes("saldo") || q.includes("coin") || q.includes("uang")) {
            return {
                text: "Saldo akunmu saat ini: 1.542.000 Coins dan 35 Naura Coupons di Bank Vault!",
                mood: "Happy",
                status: "Ekonomi Aktif 💰"
            };
        }
        if (q.includes("lagu") || q.includes("music") || q.includes("putar")) {
            return {
                text: "Saat ini sedang memutar: 'Cyber Kawaii Lo-Fi Stream' di Voice Channel #General!",
                mood: "Cheers",
                status: "Memutar Musik 🎵"
            };
        }
        if (q.includes("dadu") || q.includes("roll")) {
            const roll = Math.floor(Math.random() * 6) + 1;
            return {
                text: `🎲 Dadu bergulir... dan hasilnya adalah **${roll}**! Semoga beruntung ya!`,
                mood: "Shocked",
                status: "Mini Game 🎲"
            };
        }
        if (q.includes("aturan") || q.includes("rules")) {
            return {
                text: "Aturan server utama: 1. Bersikap ramah & saling menghormati. 2. Dilarang spam. 3. Gunakan channel sesuai fungsinya!",
                mood: "Read",
                status: "Panduan Server 📜"
            };
        }

        return {
            text: `Naura siap bantu! Mengenai "${message}", kamu juga bisa gunakan perintah slash di Discord seperti /help untuk info lengkap ya! ✨`,
            mood: "Happy",
            status: "Siap Membantu 🌸"
        };
    }

    // =========================================================================
    // MUSIC CONTROLLER & SPECTRUM VISUALIZER
    // =========================================================================
    _initSpectrumVisualizer() {
        const canvas = this.ui.music.canvas;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const numBars = 24;

        const render = () => {
            if (canvas.width !== canvas.clientWidth) {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / numBars) - 3;
            const time = Date.now() * 0.003;

            for (let i = 0; i < numBars; i++) {
                let barHeight;
                if (this.isPlaying) {
                    const freq = Math.sin(time + i * 0.4) * 0.5 + 0.5;
                    const noise = Math.sin(time * 2.5 + i) * 0.3 + 0.3;
                    barHeight = Math.max(6, (freq * 0.6 + noise * 0.4) * (canvas.height - 10));
                } else {
                    barHeight = 4; // Idle static line
                }

                const x = i * (barWidth + 3);
                const y = canvas.height - barHeight;

                // Gradient Cyan -> Pink -> Purple
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                gradient.addColorStop(0, "#06b6d4");
                gradient.addColorStop(0.6, "#ec4899");
                gradient.addColorStop(1, "#c084fc");

                ctx.fillStyle = gradient;
                ctx.shadowColor = "#ec4899";
                ctx.shadowBlur = this.isPlaying ? 8 : 0;
                ctx.fillRect(x, y, barWidth, barHeight);
            }

            this.spectrumAnimId = requestAnimationFrame(render);
        };

        render();
    }

    toggleMusicPlay() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.ui.music.iconPlay.className = "fa-solid fa-pause";
            this.ui.music.vinyl.classList.remove("is-paused");
        } else {
            this.ui.music.iconPlay.className = "fa-solid fa-play";
            this.ui.music.vinyl.classList.add("is-paused");
        }
    }

    _changeMusicTrack(direction) {
        const tracks = [
            { title: "Cyber Kawaii Lo-Fi Stream", artist: "Naura FM • 128kbps HQ" },
            { title: "Midnight Sakura Neon Beat", artist: "Hoshino Electro Lab" },
            { title: "Neo-Tokyo Rainy Cafe", artist: "Naura Acoustic Live" },
        ];
        const rand = tracks[Math.floor(Math.random() * tracks.length)];
        this.ui.music.trackTitle.textContent = rand.title;
        this.ui.music.trackArtist.textContent = rand.artist;
        this.isPlaying = true;
        this.ui.music.iconPlay.className = "fa-solid fa-pause";
        this.ui.music.vinyl.classList.remove("is-paused");
    }

    // =========================================================================
    // LIVE TELEMETRY & EVENT LOG STREAM
    // =========================================================================
    _initLiveTelemetry() {
        // Update live timer periodic
        setInterval(() => {
            if (this.activeTab === "hud") {
                const pingVariation = Math.floor(Math.random() * 6) - 3;
                const newPing = Math.max(18, 28 + pingVariation);
                if (this.ui.hud.ping) this.ui.hud.ping.textContent = `${newPing} ms`;
            }
        }, 3000);
    }
}

// Singleton export, TIDAK auto-init di DOMContentLoaded
// Setiap halaman harus memanggil NauraViewer.init({ context: 'nama' }) di tag script mereka sendiri
const NauraViewer = new NauraViewerClass();

// Expose ke window untuk debugging (opsional)
if (typeof window !== "undefined") {
    window.NauraViewer = NauraViewer;
}

export { NauraViewer };
export default NauraViewer;
