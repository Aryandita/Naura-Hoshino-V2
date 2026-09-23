/**
 * companionWidget.js - Global Floating AI Mascot Widget (Naura Hoshino V2)
 *
 * Menyediakan floating AI Companion yang interaktif di seluruh halaman dashboard:
 * 1. Floating orb mini dengan ekspresi emosional responsif (Happy, Cheers, Thinking, Shy, dsb).
 * 2. Obrolan cepat dengan AI Ensemble Router (Gemini/Groq) melalui /api/ai/companion/chat.
 * 3. Suara Text-to-Speech (Fish Audio & Web Speech Synthesis) dengan animasi audio wave.
 * 4. Pintasan instan menuju Panggung 3D Lounge (/lounge).
 */

(function () {
  "use strict";

  // Cegah inisialisasi ganda
  if (document.getElementById("naura-global-companion")) return;

  const style = document.createElement("style");
  style.id = "naura-companion-style";
  style.textContent = `
    .naura-companion-root {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      font-family: var(--font-body, 'Inter', sans-serif);
      user-select: none;
    }
    .naura-companion-orb {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(244,114,182,0.3) 0%, rgba(56,189,248,0.2) 100%);
      border: 2px solid rgba(244,114,182,0.8);
      box-shadow: 0 0 20px rgba(244,114,182,0.45), 0 8px 32px rgba(0,0,0,0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      backdrop-filter: blur(12px);
    }
    .naura-companion-orb:hover {
      transform: scale(1.1) translateY(-3px);
      box-shadow: 0 0 28px rgba(244,114,182,0.65), 0 12px 36px rgba(0,0,0,0.5);
      border-color: #f472b6;
    }
    .naura-companion-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
      pointer-events: none;
    }
    .naura-companion-dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #34d399;
      border: 2px solid #0f172a;
      box-shadow: 0 0 8px #34d399;
    }
    .naura-companion-pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid rgba(244,114,182,0.6);
      animation: nauraPulse 2.4s infinite cubic-bezier(0.25, 1, 0.5, 1);
      pointer-events: none;
    }
    @keyframes nauraPulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      100% { transform: scale(1.35); opacity: 0; }
    }
    .naura-companion-card {
      position: absolute;
      bottom: 74px;
      right: 0;
      width: 350px;
      max-width: calc(100vw - 40px);
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 20px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.65), 0 0 30px rgba(244,114,182,0.15);
      backdrop-filter: blur(24px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform-origin: bottom right;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      pointer-events: none;
      transform: scale(0.85) translateY(12px);
    }
    .naura-companion-card.is-open {
      opacity: 1;
      pointer-events: auto;
      transform: scale(1) translateY(0);
    }
    .naura-card-header {
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .naura-card-user {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .naura-card-user img {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid #f472b6;
    }
    .naura-card-title {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
      font-family: var(--font-heading, 'Space Grotesk', sans-serif);
    }
    .naura-card-sub {
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .naura-card-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .naura-btn-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
      text-decoration: none;
    }
    .naura-btn-icon:hover {
      background: rgba(244,114,182,0.2);
      border-color: #f472b6;
      color: #f472b6;
      transform: scale(1.05);
    }
    .naura-card-chat {
      padding: 14px;
      height: 250px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }
    .naura-msg {
      display: flex;
      flex-direction: column;
      max-width: 85%;
      font-size: 12px;
      line-height: 1.5;
    }
    .naura-msg.is-bot {
      align-self: flex-start;
    }
    .naura-msg.is-user {
      align-self: flex-end;
    }
    .naura-bubble {
      padding: 9px 13px;
      border-radius: 14px;
      word-wrap: break-word;
    }
    .naura-msg.is-bot .naura-bubble {
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(244,114,182,0.3);
      color: #f1f5f9;
      border-bottom-left-radius: 4px;
    }
    .naura-msg.is-user .naura-bubble {
      background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%);
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }
    .naura-wave-indicator {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-top: 4px;
      padding: 2px 6px;
      border-radius: 10px;
      background: rgba(244,114,182,0.15);
      border: 1px solid rgba(244,114,182,0.3);
      font-size: 10px;
      color: #f472b6;
      width: fit-content;
    }
    .naura-wave-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #f472b6;
      animation: waveDot 0.8s infinite alternate;
    }
    .naura-wave-dot:nth-child(2) { animation-delay: 0.2s; }
    .naura-wave-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes waveDot {
      0% { transform: scale(0.6); opacity: 0.4; }
      100% { transform: scale(1.4); opacity: 1; }
    }
    .naura-card-chips {
      padding: 8px 12px;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      border-top: 1px solid rgba(255,255,255,0.06);
      background: rgba(15,23,42,0.6);
      scrollbar-width: none;
    }
    .naura-card-chips::-webkit-scrollbar { display: none; }
    .naura-chip {
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: #cbd5e1;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .naura-chip:hover {
      background: rgba(244,114,182,0.2);
      border-color: #f472b6;
      color: #f472b6;
    }
    .naura-card-input-area {
      padding: 10px 12px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(11,17,32,0.9);
    }
    .naura-input {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 8px 12px;
      font-size: 12px;
      color: #f8fafc;
      outline: none;
      transition: border-color 0.2s;
    }
    .naura-input:focus {
      border-color: #f472b6;
    }
    .naura-btn-send {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, #f472b6 0%, #ec4899 100%);
      border: none;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .naura-btn-send:hover {
      transform: scale(1.08);
    }
  `;
  document.head.appendChild(style);

  // Buat DOM Widget
  const root = document.createElement("div");
  root.id = "naura-global-companion";
  root.className = "naura-companion-root";
  root.innerHTML = `
    <!-- Floating Orb -->
    <div class="naura-companion-orb" id="nauraCompanionOrb" title="Buka AI Voice Companion Naura 🌸">
      <div class="naura-companion-pulse"></div>
      <img src="/assets/Naura_Expression/Happy.png" alt="Naura" class="naura-companion-avatar" id="nauraOrbAvatar" onerror="this.src='/assets/core/avatar.png'" />
      <div class="naura-companion-dot" title="Status: Online & Ceria"></div>
    </div>

    <!-- Companion Panel Card -->
    <div class="naura-companion-card" id="nauraCompanionCard">
      <div class="naura-card-header">
        <div class="naura-card-user">
          <img src="/assets/Naura_Expression/Happy.png" id="nauraCardAvatar" alt="Naura" onerror="this.src='/assets/core/avatar.png'" />
          <div>
            <div class="naura-card-title">Naura Hoshino</div>
            <div class="naura-card-sub" id="nauraCardStatus">
              <span style="color:#34d399;">●</span> Live AI Companion
            </div>
          </div>
        </div>
        <div class="naura-card-actions">
          <a href="/lounge" class="naura-btn-icon" title="Buka Panggung 3D Lounge" target="_self">
            <i class="fa-solid fa-cube"></i>
          </a>
          <button type="button" class="naura-btn-icon" id="nauraVoiceToggle" title="Toggle Suara Audio TTS">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <button type="button" class="naura-btn-icon" id="nauraBtnClose" title="Tutup">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="naura-card-chat" id="nauraChatBox">
        <div class="naura-msg is-bot">
          <div class="naura-bubble" id="nauraInitialBubble">
            Halo! Aku Naura Hoshino, asisten ceria dan kawan petualanganmu. Ada yang bisa kubantu di server atau dashboard hari ini? 🌸✨
          </div>
        </div>
      </div>

      <div class="naura-card-chips" id="nauraCardChips">
        <button type="button" class="naura-chip" data-msg="👋 Halo Naura!">👋 Sapa Naura</button>
        <button type="button" class="naura-chip" data-msg="⚡ Cek status bot dan sistem">⚡ Status Bot</button>
        <button type="button" class="naura-chip" data-msg="🎵 Rekomendasi lagu hari ini">🎵 Musik Santai</button>
        <a href="/lounge" class="naura-chip" style="text-decoration:none;">🎭 Buka 3D Lounge</a>
        <button type="button" class="naura-chip" data-msg="🎲 Lempar dadu hoki dong!">🎲 Dadu Hoki</button>
      </div>

      <div class="naura-card-input-area">
        <input type="text" class="naura-input" id="nauraChatInput" placeholder="Tanya sesuatu ke Naura..." autocomplete="off" />
        <button type="button" class="naura-btn-send" id="nauraBtnSend" title="Kirim Pesan">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // Konfigurasi Konteks Halaman Cerdas
  const PAGE_CONTEXT_CONFIG = {
    "/economy": {
      greeting:
        "Selamat datang di Bank & Pasar NC! Mau cek kurs saham atau strategi cuan hari ini? 📈🌸",
      chips: [
        {
          label: "📈 Prediksi Saham NC",
          msg: "Bagaimana tren pasar saham dan bursa valuta hari ini?",
        },
        {
          label: "💰 Kas Server",
          msg: "Berapa total kas dan perputaran ekonomi saat ini?",
        },
        {
          label: "💎 Tips Investasi",
          msg: "Berikan tips investasi cerdas di Naura Economy",
        },
        { label: "🎲 Dadu Hoki", msg: "Lempar dadu hoki dong!" },
      ],
    },
    "/music": {
      greeting:
        "Halo penikmat musik! Lavalink node siap memutarkan track favoritmu. Mau request lagu apa? 🎵✨",
      chips: [
        {
          label: "🎵 Rekomendasi Lagu",
          msg: "Rekomendasikan lagu anime atau lofi yang enak didengar",
        },
        {
          label: "⚡ Cek Audio Node",
          msg: "Bagaimana status cluster pemutar musik Poru saat ini?",
        },
        {
          label: "📻 Info AI DJ",
          msg: "Apa saja fitur Fish Audio AI DJ Companion?",
        },
      ],
    },
    "/status": {
      greeting:
        "Monitoring telemetri dan kesehatan sistem aktif. Semua shard dan gateway terpantau aman! ⚡🛡️",
      chips: [
        {
          label: "⚡ Latency Shard",
          msg: "Berapa rata-rata ping gateway dan shard Discord saat ini?",
        },
        {
          label: "💾 Pemakaian RAM",
          msg: "Apakah penggunaan memori heap node.js dalam batas aman?",
        },
        {
          label: "🛡️ Uptime Service",
          msg: "Sudah berapa lama server bot aktif tanpa restart?",
        },
      ],
    },
    "/world": {
      greeting:
        "Wilayah Aetheria terbentang luas! Mau eksplorasi POI atau cek cuaca benua hari ini? 🗺️⚔️",
      chips: [
        {
          label: "🗺️ Panduan POI",
          msg: "Ceritakan tentang wilayah dan titik penting di peta Aetheria",
        },
        {
          label: "⚔️ Zona Rawan",
          msg: "Di mana lokasi monster langka atau pertempuran klan?",
        },
        {
          label: "🎒 Bar Vitalitas",
          msg: "Bagaimana cara menjaga stamina dan HP di Naura Wilds?",
        },
      ],
    },
    "/survival-map": {
      greeting:
        "Radar survival aktif mendeteksi sumber daya dan pemain di sekitarmu! Waspada selalu ya! 🌲⚡",
      chips: [
        {
          label: "📍 Sumber Daya",
          msg: "Di mana lokasi terbaik mencari kayu dan kristal energi?",
        },
        {
          label: "🛡️ Pos Terdepan",
          msg: "Bagaimana cara mendirikan outpost perlindungan?",
        },
      ],
    },
    "/settings": {
      greeting:
        "Di sini kamu bisa mengatur preferensi bot, kartu sambutan, dan izin role. Mau dibantu setel apa? ⚙️✨",
      chips: [
        {
          label: "🎨 Welcomer Card",
          msg: "Bagaimana cara mengubah latar belakang kartu sambutan?",
        },
        {
          label: "🔒 Keamanan Role",
          msg: "Jelaskan izin bot yang dibutuhkan untuk proteksi server",
        },
        {
          label: "⚙️ Personalisasi",
          msg: "Bagaimana cara mengubah persona AI Naura?",
        },
      ],
    },
  };

  // State
  let isOpen = false;
  let voiceEnabled = true;
  const chatHistory = [];
  let currentAudio = null;

  const orb = document.getElementById("nauraCompanionOrb");
  const card = document.getElementById("nauraCompanionCard");
  const btnClose = document.getElementById("nauraBtnClose");
  const voiceToggle = document.getElementById("nauraVoiceToggle");
  const orbAvatar = document.getElementById("nauraOrbAvatar");
  const cardAvatar = document.getElementById("nauraCardAvatar");
  const cardStatus = document.getElementById("nauraCardStatus");
  const chatBox = document.getElementById("nauraChatBox");
  const chatInput = document.getElementById("nauraChatInput");
  const btnSend = document.getElementById("nauraBtnSend");
  const cardChips = document.getElementById("nauraCardChips");
  const initialBubble = document.getElementById("nauraInitialBubble");

  function updatePageContext() {
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    const cfg = PAGE_CONTEXT_CONFIG[path];
    if (cfg) {
      if (initialBubble && chatHistory.length === 0) {
        initialBubble.textContent = cfg.greeting;
      }
      if (cardChips) {
        let chipsHtml = "";
        cfg.chips.forEach((c) => {
          chipsHtml += `<button type="button" class="naura-chip" data-msg="${c.msg}">${c.label}</button>`;
        });
        chipsHtml += `<a href="/lounge" class="naura-chip" style="text-decoration:none;">🎭 Buka 3D Lounge</a>`;
        cardChips.innerHTML = chipsHtml;
        bindChipEvents();
      }
    }
  }

  function bindChipEvents() {
    if (!cardChips) return;
    cardChips.querySelectorAll(".naura-chip[data-msg]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const msg = chip.getAttribute("data-msg");
        if (msg) handleSend(msg);
      });
    });
  }

  function toggleCard() {
    isOpen = !isOpen;
    if (isOpen) {
      updatePageContext();
      card.classList.add("is-open");
      chatInput.focus();
    } else {
      card.classList.remove("is-open");
    }
  }

  // Inisialisasi konteks saat awal
  updatePageContext();

  orb.addEventListener("click", toggleCard);
  btnClose.addEventListener("click", () => {
    isOpen = false;
    card.classList.remove("is-open");
  });

  voiceToggle.addEventListener("click", () => {
    voiceEnabled = !voiceEnabled;
    voiceToggle.innerHTML = voiceEnabled
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark" style="color:#ef4444;"></i>';
  });

  function setMascotMood(mood, statusText) {
    const validMoods = [
      "Happy",
      "Cheers",
      "Thinking",
      "Shy",
      "Sleepy",
      "Angry",
      "Blow kiss",
    ];
    const selected = validMoods.includes(mood) ? mood : "Happy";
    const src = `/assets/Naura_Expression/${selected}.png`;
    if (orbAvatar) orbAvatar.src = src;
    if (cardAvatar) cardAvatar.src = src;
    if (cardStatus && statusText) {
      cardStatus.innerHTML = `<span style="color:#34d399;">●</span> ${statusText}`;
    }
  }

  function appendMsg(sender, text, isVoicePlaying = false) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `naura-msg is-${sender}`;
    let waveHtml = "";
    if (sender === "bot" && isVoicePlaying) {
      waveHtml = `
        <div class="naura-wave-indicator">
          <span>Suara</span>
          <span class="naura-wave-dot"></span>
          <span class="naura-wave-dot"></span>
          <span class="naura-wave-dot"></span>
        </div>
      `;
    }
    msgDiv.innerHTML = `<div class="naura-bubble">${text}</div>${waveHtml}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function playVoice(text) {
    if (!voiceEnabled) return;
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      const res = await fetch("/api/ai/companion/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (
        contentType.includes("audio/mpeg") ||
        contentType.includes("audio/")
      ) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        currentAudio = new Audio(url);
        currentAudio.play();
        return;
      }

      // Fallback: Web Speech Synthesis browser
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(
          /[^\w\s\u00C0-\u024F\u1E00-\u1EFF.,!?]/g,
          "",
        );
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "id-ID";
        utterance.rate = 1.05;
        utterance.pitch = 1.25;
        window.speechSynthesis.speak(utterance);
      }
    } catch (_) {
      // Audio playback passthrough
    }
  }

  async function handleSend(customText) {
    const text = customText || chatInput.value.trim();
    if (!text) return;

    appendMsg("user", text);
    if (!customText) chatInput.value = "";

    setMascotMood("Thinking", "Sedang memproses...");
    chatHistory.push({ role: "user", content: text });

    try {
      const res = await fetch("/api/ai/companion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-6),
          context: { path: window.location.pathname },
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        setMascotMood(data.mood || "Happy", data.status || "Aktif Menemani ✨");
        appendMsg("bot", data.reply, voiceEnabled);
        chatHistory.push({ role: "model", content: data.reply });
        if (
          window.soundManager &&
          typeof window.soundManager.playPop === "function"
        ) {
          window.soundManager.playPop();
        }
        playVoice(data.reply);
      } else {
        setMascotMood("Shy", "Sedikit bingung");
        appendMsg(
          "bot",
          "Wah, Naura agak tersendat tadi. Boleh coba ulangi lagi ya Sensei? 🌸",
        );
      }
    } catch (_) {
      setMascotMood("Sleepy", "Offline sementara");
      appendMsg(
        "bot",
        "Koneksi ke otak AI sedang beristirahat. Tenang, fitur dashboard lainnya tetap lancar jaya! ⚡",
      );
    }
  }

  btnSend.addEventListener("click", () => handleSend());
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // Action chips
  document.querySelectorAll(".naura-chip[data-msg]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const msg = chip.getAttribute("data-msg");
      if (msg) handleSend(msg);
    });
  });
})();
