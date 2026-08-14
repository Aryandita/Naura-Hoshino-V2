// Lokasi: src/events/poru/trackStart.js
const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const MusicUIManager = require("../MusicUIManager");
const VoiceManager = require("../../managers/voiceManager");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  rankAutoplayCandidates,
  beginPlaybackTransition,
  clearTransitionTimers,
} = require("./autoplayUtils");
const ui = require("../../config/ui");

module.exports = {
  async execute(manager, player, track) {
    try {
      const activeTrack = track || player.currentTrack;
      if (!activeTrack || !activeTrack.info || !activeTrack.info.title) {
        if (typeof player.stopTrack === "function") player.stopTrack();
        return;
      }

      // Bersihkan sisa timer fade/watcher dari lagu sebelumnya (jaga-jaga)
      clearTransitionTimers(player);

      // Simpan volume "target" normal sekali saja, dipakai sebagai acuan fade-in/fade-out
      if (typeof player.baseVolume !== "number") {
        player.baseVolume =
          typeof player.volume === "number" ? player.volume : 65;
      }

      player.previousTrack = activeTrack;
      player.isAutoplayResolving = false;

      console.log(
        `\x1b[44m\x1b[37m 🔊 PLAYING \x1b[0m \x1b[36m${activeTrack.info.title} \x1b[0m\x1b[90mdi ${manager.client.guilds.cache.get(player.guildId)?.name}\x1b[0m`,
      );

      if (!player.playedHistory) player.playedHistory = new Set();
      player.playedHistory.add(activeTrack.info.identifier);

      // Bersihkan playedHistory setiap 50 lagu agar tidak menjadi memory leak di sesi 24/7
      if (player.playedHistory.size >= 50) {
        player.playedHistory.clear();
        // Tambahkan kembali lagu yang sedang diputar agar tidak diputar ulang segera
        player.playedHistory.add(activeTrack.info.identifier);
      }

      // 🎶 Update Voice Channel Status
      try {
        if (player.voiceChannel) {
          const musicEmoji = ui.getEmoji("music") || "\ud83c\udfb5";
          const title = activeTrack.info.title || "Unknown Track";
          const newStatus = `${musicEmoji} Mendengarkan: ${title}`.substring(
            0,
            500,
          );
          const DISCORD_API = "https://discord.com/api/v10";

          fetch(`${DISCORD_API}/channels/${player.voiceChannel}/voice-status`, {
            method: "PUT",
            headers: {
              Authorization: `Bot ${manager.client.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: newStatus }),
          }).catch((e) => logger.warn("[Voice Status Warn]", e));
        }
      } catch (e) {
        logger.warn("[Voice Status Warn]", e);
      }

      // ==========================================
      // 🎧 FITUR AI DJ (RADIO ANNOUNCER)
      // ==========================================
      let isDjActive = false;
      try {
        // Gunakan cacheManager sesuai aturan AGENTS.md 1.9 (bukan GuildSettings.findOrCreate langsung)
        const guildData = await cacheManager.getGuildSettings(player.guildId);

        const isAutoplayRequest =
          activeTrack.info.requester?.id === manager.client.user.id;

        if (
          guildData &&
          guildData.aiVoiceEnabled &&
          activeTrack.info.requester &&
          !isAutoplayRequest
        ) {
          isDjActive = true;
          player.pause(true);

          const requesterName =
            activeTrack.info.requester.displayName ||
            activeTrack.info.requester.username ||
            "Seseorang";
          const trackTitle = activeTrack.info.title.substring(0, 30);
          const trackAuthor = activeTrack.info.author.substring(0, 20);

          // Teks default jika Gemini timeout atau gagal
          let djText = `Lagu selanjutnya, ${trackTitle} dari ${trackAuthor}, spesial request dari ${requesterName}. Selamat mendengarkan!`;

          try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
              model: "gemini-2.5-flash-latest",
            });
            const prompt = `Sebagai Naura, penyiar radio virtual yang ceria, buat 1 kalimat pembuka untuk mengumumkan bahwa lagu "${trackTitle}" dari "${trackAuthor}" yang di-request oleh "${requesterName}" akan diputar. Gunakan bahasa gaul. TANPA EMOJI, TANPA SIMBOL.`;

            // Timeout 3 detik agar Gemini yang lambat tidak menyebabkan lagu terjeda terlalu lama
            const AI_DJ_TIMEOUT_MS = 3000;
            const aiResultText = await Promise.race([
              model.generateContent(prompt).then((r) => r.response.text()),
              new Promise((resolve) =>
                setTimeout(() => resolve(null), AI_DJ_TIMEOUT_MS),
              ),
            ]);

            if (aiResultText) {
              djText = aiResultText
                .replace(/[^\w\s.,?!'a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ-]/g, "")
                .trim();
            } else {
              console.warn(
                `\x1b[43m\x1b[30m 🎤 AI DJ \x1b[0m \x1b[33mGemini timeout, menggunakan teks default.\x1b[0m`,
              );
            }
          } catch (e) {
            console.warn(
              `\x1b[43m\x1b[30m 🎤 AI DJ \x1b[0m \x1b[33mGemini gagal (${e.message}), menggunakan teks default.\x1b[0m`,
            );
          }

          console.log(
            `\x1b[45m\x1b[37m 🎤 AI DJ \x1b[0m \x1b[35m${djText}\x1b[0m`,
          );

          const DJ_PAUSE_MS = 5000;
          setTimeout(() => {
            try {
              if (player.isPaused) player.pause(false);
              // Fade-in halus setelah AI DJ selesai bicara
              beginPlaybackTransition(player, activeTrack, player.baseVolume);
            } catch (e) {
              logger.error(
                "[DJ ERROR] Gagal mengembalikan volume setelah DJ.",
                e,
              );
            }
          }, DJ_PAUSE_MS);
        } else {
          if (player.isPaused) player.pause(false);
        }
      } catch (e) {
        logger.error("\x1b[41m\x1b[37m ⚠️ AI DJ FATAL ERROR \x1b[0m", e);
        if (player.isPaused) player.pause(false);
      }

      if (!isDjActive && player.isPaused) player.pause(false);

      // Jalur non-DJ: mulai transisi (fade-in) begitu lagu benar-benar main,
      // sekaligus pasang pengawas agar fade-out otomatis menjelang lagu ini habis.
      if (!isDjActive) {
        beginPlaybackTransition(player, activeTrack, player.baseVolume);
      }

      let recommendedTracks = [];
      try {
        recommendedTracks = await this.handleAutoplayPrefetch(
          manager,
          player,
          activeTrack,
        );
      } catch (prefetchErr) {
        logger.error("[AutoplayPrefetch Error]", prefetchErr);
      }

      try {
        await MusicUIManager.renderPanel(
          manager,
          player,
          activeTrack,
          recommendedTracks,
        );
      } catch (uiErr) {
        logger.error("[MusicUI Render Error]", uiErr);
      }
    } catch (error) {
      logger.error("\x1b[41m\x1b[37m ⚠️ EVENT ERROR \x1b[0m", error);
    }
  },

  async handleAutoplayPrefetch(manager, player, activeTrack) {
    let recommendedTracks = [];
    if (!player.playedHistory) player.playedHistory = new Set();

    // 1. AUTOPLAY RESOLUTION: Menentukan 1 Lagu Terbaik untuk di-Autoplay
    if (player.isAutoplayMode) {
      try {
        let searchQuery;
        if (activeTrack.info.originalSource === "spotify") {
          // Spotify track fallback query
          searchQuery = `ytsearch:${activeTrack.info.author} ${activeTrack.info.title} mix`;
        } else {
          // Native YouTube Mix URL
          searchQuery = `https://www.youtube.com/watch?v=${activeTrack.info.identifier}&list=RD${activeTrack.info.identifier}`;
        }

        const searchRes = await manager.poru.resolve({
          query: searchQuery,
          requester: manager.client.user,
        });
        if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
          // Ambil beberapa kandidat terbaik sekaligus: yang teratas dipakai untuk prefetch,
          // sisanya jadi buffer cadangan (player.autoplayQueue) supaya kalau kandidat utama
          // gagal di-resolve saat queueEnd, tidak perlu nyari ulang dari nol (transisi tetap cepat & mulus).
          const ranked = rankAutoplayCandidates(
            searchRes.tracks,
            activeTrack,
            player.playedHistory,
            3,
          );

          if (ranked.length > 0) {
            const [best, ...rest] = ranked;
            best.info.requester = manager.client.user;
            best.info.originalSource = "youtube";
            player.prefetchedAutoplayTrack = best;

            player.autoplayQueue = rest.map((t) => {
              t.info.requester = manager.client.user;
              t.info.originalSource = "youtube";
              return t;
            });

            console.log(
              `\x1b[42m\x1b[30m 💿 AUTOPLAY NATIVE \x1b[0m \x1b[32mPre-fetch lagu rekomendasi: ${best.info.title}\x1b[0m`,
            );
          }
        }
      } catch (e) {
        console.error(
          `\x1b[41m\x1b[37m ⚠️ AUTOPLAY NATIVE ERROR \x1b[0m Alasan: \x1b[33m${e.message || "Tidak diketahui"}\x1b[0m. Menggunakan fallback...`,
        );
      }
    }

    // Fallback ke Gemini AI jika native Mix gagal mendapatkan lagu baru
    if (
      player.isAutoplayMode &&
      !player.prefetchedAutoplayTrack &&
      process.env.GEMINI_API_KEY
    ) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Aku sedang memutar lagu "${activeTrack.info.title}" oleh "${activeTrack.info.author}".
                Berikan 1 rekomendasi lagu selanjutnya yang memiliki vibe sangat mirip. Balas HANYA dengan format murni: "Judul Lagu - Nama Artis".`;

        const aiResult = await model.generateContent(prompt);
        const aiQuery = aiResult.response.text().trim();

        const searchRes = await manager.poru.resolve({
          query: `ytsearch:${aiQuery}`,
          requester: manager.client.user,
        });
        if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
          const ranked = rankAutoplayCandidates(
            searchRes.tracks,
            activeTrack,
            player.playedHistory,
            3,
          );
          const freshTrack =
            ranked[0] ||
            searchRes.tracks.find(
              (t) => t.info.identifier !== activeTrack.info.identifier,
            );

          if (freshTrack) {
            freshTrack.info.requester = manager.client.user;
            freshTrack.info.originalSource = "youtube";
            player.prefetchedAutoplayTrack = freshTrack;
            if (ranked.length > 1) {
              player.autoplayQueue = ranked.slice(1).map((t) => {
                t.info.requester = manager.client.user;
                t.info.originalSource = "youtube";
                return t;
              });
            }
          }
        }
      } catch (e) {
        console.error(
          `\x1b[41m\x1b[37m ⚠️ GEMINI FALLBACK ERROR \x1b[0m Alasan: \x1b[33m${e.message || "Tidak diketahui"}\x1b[0m.`,
        );
      }
    }

    // 2. TAHAP YOUTUBE MUSIC: Mencari 5 Lagu untuk Mengisi Dropdown Rekomendasi
    try {
      const dropdownRes = await manager.poru.resolve({
        query: `ytsearch:${activeTrack.info.author} ${activeTrack.info.title} mix`,
        requester: manager.client.user,
      });

      if (dropdownRes && dropdownRes.tracks) {
        recommendedTracks = rankAutoplayCandidates(
          dropdownRes.tracks,
          activeTrack,
          player.playedHistory,
          5,
        );

        // 🛑 PENAMBAHAN TAG: Menandai seluruh isi dropdown agar emoji panel sesuai
        recommendedTracks.forEach((t) => (t.info.originalSource = "youtube"));
      }
    } catch (e) {}

    // Fallback Autoplay jika Gemini Gagal
    if (player.isAutoplayMode && !player.prefetchedAutoplayTrack) {
      if (recommendedTracks.length > 0) {
        // recommendedTracks sudah diurutkan berdasarkan relevansi oleh rankAutoplayCandidates
        const freshFallback = recommendedTracks[0];
        freshFallback.info.requester = manager.client.user;
        freshFallback.info.originalSource = "youtube";
        player.prefetchedAutoplayTrack = freshFallback;
        if (
          recommendedTracks.length > 1 &&
          (!player.autoplayQueue || player.autoplayQueue.length === 0)
        ) {
          player.autoplayQueue = recommendedTracks.slice(1).map((t) => {
            t.info.requester = manager.client.user;
            t.info.originalSource = "youtube";
            return t;
          });
        }
      }

      // Ekstra Fallback jika dropdown juga kosong
      if (!player.prefetchedAutoplayTrack) {
        try {
          const extraFallback = await manager.poru.resolve({
            query: `ytsearch:${activeTrack.info.author} top tracks`,
            requester: manager.client.user,
          });
          if (
            extraFallback &&
            extraFallback.tracks &&
            extraFallback.tracks.length > 0
          ) {
            const ranked = rankAutoplayCandidates(
              extraFallback.tracks,
              activeTrack,
              player.playedHistory,
              3,
            );
            const newTrack =
              ranked[0] ||
              extraFallback.tracks.find(
                (t) => t.info.identifier !== activeTrack.info.identifier,
              );
            if (newTrack) {
              newTrack.info.requester = manager.client.user;
              newTrack.info.originalSource = "youtube";
              player.prefetchedAutoplayTrack = newTrack;
            }
          }
        } catch (e) {}
      }
    }

    if (!player.isAutoplayMode) player.prefetchedAutoplayTrack = null;

    return recommendedTracks;
  },
};
