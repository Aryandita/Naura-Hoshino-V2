const { logger } = require("../../managers/logger");
const MusicUIManager = require("../MusicUIManager");
const aiDjManager = require("../../managers/aiDjManager");
const geminiClient = require("../../ai/geminiClient");
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

      // Mulai transisi playback (fade-in)
      if (player.isPaused) {
        try {
          player.pause(false);
        } catch (e) {}
      }
      beginPlaybackTransition(player, activeTrack, player.baseVolume);

      // Pemulihan posisi lagu jika sebelumnya diinterupsi oleh efek soundboard
      if (
        activeTrack.info &&
        typeof activeTrack.info.resumePosition === "number" &&
        activeTrack.info.resumePosition > 0
      ) {
        const resumeMs = activeTrack.info.resumePosition;
        delete activeTrack.info.resumePosition;
        setTimeout(() => {
          try {
            if (
              player &&
              !player.destroyed &&
              player.currentTrack === activeTrack
            ) {
              if (typeof player.seekTo === "function") {
                player.seekTo(resumeMs);
                logger.info(
                  `[Poru] Berhasil memulihkan posisi lagu "${activeTrack.info.title}" ke ${Math.floor(resumeMs / 1000)}s.`,
                );
              }
            }
          } catch (seekErr) {
            logger.warn(`[Poru] Gagal memulihkan posisi lagu: ${seekErr.message}`);
          }
        }, 500);
      }

      let recommendedTracks = [];
      try {
        // Tunda prefetch selama 1500ms agar sesi WebSocket Voice antara Poru
        // dan Discord sudah stabil sebelum resolve() kedua dikirim ke node
        // Lavalink. Tanpa delay ini, dua request ke node yang berdekatan
        // menyebabkan Discord mengirim kode 4006 (session conflict) dan
        // men-disconnect bot dari voice channel.
        await new Promise((res) => setTimeout(res, 1500));

        // Pastikan player masih valid setelah delay (bisa saja user skip/stop)
        if (!player || player.destroyed) return;

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

        // 🎙️ Jalankan pengumuman AI DJ (non-blocking)
        aiDjManager
          .handleTrackStart(manager, player, activeTrack)
          .catch((err) => {
            logger.warn(
              `[AI-DJ] Gagal mengeksekusi trackStart announcer: ${err.message}`,
            );
          });
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
          // Spotify fallback: samakan pola query dengan spotifyResolver.
          searchQuery = `scsearch:${activeTrack.info.author} - ${activeTrack.info.title}`;
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
      geminiClient.isAvailable()
    ) {
      try {
        const prompt = `Aku sedang memutar lagu "${activeTrack.info.title}" oleh "${activeTrack.info.author}".
                Berikan 1 rekomendasi lagu selanjutnya yang memiliki vibe sangat mirip. Balas HANYA dengan format murni: "Judul Lagu - Nama Artis".`;

        const aiResult = await geminiClient.generate({
          parts: [{ text: prompt }],
        });
        const aiQuery = (aiResult || "").trim();

        const searchRes = await manager.poru.resolve({
          query: `scsearch:${aiQuery}`,
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

    if (!player.isAutoplayMode) {
      player.prefetchedAutoplayTrack = null;
    }

    // 3. Susun daftar lengkap rekomendasi dari sistem autoplay
    const combinedRecs = [];
    const seenIds = new Set();
    if (activeTrack && activeTrack.info && activeTrack.info.identifier) {
      seenIds.add(activeTrack.info.identifier);
    }

    if (player.prefetchedAutoplayTrack && player.prefetchedAutoplayTrack.info) {
      const id = player.prefetchedAutoplayTrack.info.identifier;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        combinedRecs.push(player.prefetchedAutoplayTrack);
      }
    }

    if (Array.isArray(player.autoplayQueue)) {
      for (const t of player.autoplayQueue) {
        const id = t.info && t.info.identifier;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          combinedRecs.push(t);
        }
      }
    }

    if (Array.isArray(recommendedTracks)) {
      for (const t of recommendedTracks) {
        const id = t.info && t.info.identifier;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          combinedRecs.push(t);
        }
      }
    }

    player.recommendedTracks = combinedRecs;
    return combinedRecs;
  },
};
