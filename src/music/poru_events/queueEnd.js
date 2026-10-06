const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const LyricsManager = require("../LyricsManager");
const geminiClient = require("../../ai/geminiClient");
const {
  rankAutoplayCandidates,
  clearTransitionTimers,
} = require("./autoplayUtils");

module.exports = {
  async execute(manager, player) {
    if (!player || player.isRecoveringTrack) {
      // Sedang dalam proses pemulihan track alternatif oleh trackError
      return;
    }

    // 1. Bersihkan lirik Karaoke dari panel teks
    if (player.lyricsMessageId) {
      const channel = manager.client.channels.cache.get(player.textChannel);
      if (channel) {
        channel.messages
          .fetch(player.lyricsMessageId)
          .then((m) => m.delete().catch(() => {}))
          .catch(() => {});
      }
      player.lyricsMessageId = null;
    }

    try {
      const lyricsEngine = new LyricsManager(manager.client);
      lyricsEngine.clearLyrics(player.guildId);
    } catch (e) {}

    // Bersihkan antrean tersimpan dan suara vote skip setelah antrean benar-benar selesai
    manager.clearSavedQueueState?.(player.guildId);
    manager.clearSkipVotes?.(player.guildId);

    // 2. EKSEKUSI AUTOPLAY (PERBAIKAN)
    if (player.isAutoplayMode) {
      if (player.isAutoplayResolving) return;
      player.isAutoplayResolving = true;

      let trackToPlay = player.prefetchedAutoplayTrack;
      player.prefetchedAutoplayTrack = null;

      // ✅ Kalau kandidat utama sudah dipakai/hilang, coba ambil dari buffer cadangan
      // (player.autoplayQueue, diisi saat trackStart) dulu -- lebih cepat daripada resolve ulang dari nol
      if (
        !trackToPlay &&
        Array.isArray(player.autoplayQueue) &&
        player.autoplayQueue.length > 0
      ) {
        while (player.autoplayQueue.length > 0 && !trackToPlay) {
          const candidate = player.autoplayQueue.shift();
          if (
            candidate &&
            !player.playedHistory?.has(candidate.info.identifier)
          ) {
            trackToPlay = candidate;
          }
        }
        if (trackToPlay) {
          console.log(
            `\x1b[42m\x1b[30m 💿 AUTOPLAY BUFFER \x1b[0m \x1b[32mMemakai cadangan dari autoplayQueue: ${trackToPlay.info.title}\x1b[0m`,
          );
        }
      }

      // Jika tidak ada lagu yang di-prefetch/di-buffer, coba YouTube Mix secara langsung (100% Tanpa AI)
      if (!trackToPlay && player.previousTrack) {
        console.log(
          `\x1b[45m\x1b[37m 💿 AUTOPLAY \x1b[0m \x1b[35mMencari lagu rekomendasi native YouTube Mix...\x1b[0m`,
        );
        try {
          const mixUrl = `https://www.youtube.com/watch?v=${player.previousTrack.info.identifier}&list=RD${player.previousTrack.info.identifier}`;
          const searchRes = await manager.poru.resolve({
            query: mixUrl,
            requester: manager.client.user,
          });
          if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
            const ranked = rankAutoplayCandidates(
              searchRes.tracks,
              player.previousTrack,
              player.playedHistory || new Set(),
              3,
            );
            const freshTrack = ranked[0];

            if (freshTrack) {
              trackToPlay = freshTrack;
              trackToPlay.info.requester = manager.client.user;
              trackToPlay.info.originalSource = "youtube";
              // Sisa kandidat teratas disimpan sebagai buffer untuk siklus autoplay berikutnya
              if (ranked.length > 1) player.autoplayQueue = ranked.slice(1);
              console.log(
                `\x1b[42m\x1b[30m 💿 AUTOPLAY NATIVE \x1b[0m \x1b[32mBerhasil memuat lagu rekomendasi YouTube Mix: ${freshTrack.info.title}\x1b[0m`,
              );
            }
          }
        } catch (e) {
          console.error(
            `\x1b[41m\x1b[37m ⚠️ AUTOPLAY NATIVE ERROR \x1b[0m Gagal fetch: ${e.message}`,
          );
        }
      }

      // Fallback ke Gemini AI jika native Mix kosong
      if (!trackToPlay && geminiClient.isAvailable() && player.previousTrack) {
        console.log(
          `\x1b[45m\x1b[37m 💿 AUTOPLAY \x1b[0m \x1b[35mMencari lagu rekomendasi AI Fallback...\x1b[0m`,
        );
        try {
          const activeTrack = player.previousTrack;
          const prompt = `Aku sedang memutar lagu "${activeTrack.info.title}" oleh "${activeTrack.info.author}".
Berikan 1 rekomendasi lagu selanjutnya yang populer dan memiliki vibe/genre yang sama, tidak harus dari artis yang sama. Balas HANYA dengan format murni: "Judul Lagu - Nama Artis". TANPA KUTIP, TANPA SIMBOL.`;

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
              player.previousTrack,
              player.playedHistory || new Set(),
              3,
            );
            const freshTrack =
              ranked[0] ||
              searchRes.tracks.find(
                (t) =>
                  t.info.identifier !== player.previousTrack?.info?.identifier,
              );

            if (freshTrack) {
              trackToPlay = freshTrack;
              trackToPlay.info.requester = manager.client.user;
              trackToPlay.info.originalSource = "youtube";
              if (ranked.length > 1) player.autoplayQueue = ranked.slice(1);
            }
          }
        } catch (e) {
          logger.error(
            `\x1b[41m\x1b[37m ⚠️ GEMINI FALLBACK ERROR \x1b[0m Gagal fetch fallback autoplay: ${e.message}`,
          );
        }
      }

      // Fallback Ekstra ke YouTube Music jika Gemini gagal
      if (!trackToPlay && player.previousTrack) {
        try {
          const searchRes = await manager.poru.resolve({
            query: `ytsearch:${player.previousTrack.info.title} ${player.previousTrack.info.author} mix`,
            requester: manager.client.user,
          });
          if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
            // ✅ Ranking berdasarkan kemiripan judul/artis + filter blacklist & durasi
            const ranked = rankAutoplayCandidates(
              searchRes.tracks,
              player.previousTrack,
              player.playedHistory || new Set(),
              3,
            );
            const freshTrack =
              ranked[0] ||
              searchRes.tracks.find(
                (t) =>
                  t.info.identifier !== player.previousTrack?.info?.identifier,
              );

            if (freshTrack) {
              trackToPlay = freshTrack;
              trackToPlay.info.requester = manager.client.user;
              trackToPlay.info.originalSource = "youtube";
            }
          }
        } catch (e) {}
      }

      if (trackToPlay) {
        console.log(
          `\x1b[45m\x1b[37m 💿 AUTOPLAY \x1b[0m \x1b[35mMemutar lagu rekomendasi: ${trackToPlay.info.title}\x1b[0m`,
        );

        // Track manual agar tidak berulang
        if (!player.playedHistory) player.playedHistory = new Set();
        player.playedHistory.add(trackToPlay.info.identifier);

        // ✅ Inject TTS untuk Autoplay (setiap 3 lagu)
        const aiDjManager = require("../../managers/aiDjManager");
        const fishAudioService = require("../../services/fishAudioService");
        const isDjActive = aiDjManager.isDjEnabled(player.guildId) && fishAudioService.isConfigured();
        
        let ttsTrack = null;
        if (isDjActive) {
           const count = (aiDjManager.trackCounters.get(player.guildId) || 0) + 1;
           aiDjManager.trackCounters.set(player.guildId, count);
           if (count % 3 === 0) {
              const { script, classification } = aiDjManager.generateDjScript(trackToPlay.info, "Naura DJ");
              try {
                const audioBuffer = await fishAudioService.generateSpeech(script, { format: "mp3", latency: "low" });
                if (audioBuffer) {
                  const url = await fishAudioService.uploadToCatbox(audioBuffer);
                  if (url) {
                    const ttsRes = await manager.poru.resolve({ query: url, requester: manager.client.user });
                    if (ttsRes && ttsRes.tracks && ttsRes.tracks.length > 0) {
                      ttsTrack = ttsRes.tracks[0];
                      ttsTrack.info.title = `🎙️ Naura DJ: ${classification.genre.replace("_", " ")} Session`;
                      ttsTrack.info.author = "Naura Hoshino";
                      ttsTrack.info.originalSource = "http";
                      ttsTrack.isTTS = true;
                      trackToPlay.info.skipDj = true;
                      
                      const channel = manager.client.channels.cache.get(player.textChannel);
                      if (channel) {
                        const speakPayload = buildContainerV2({
                          accentColorHex: ui.getColor("primary") || "#FFB6C1",
                          title: `🎙️ Hoshino FM`,
                          description: `> _"${script}"_`,
                          expression: "singing",
                          footerText: ui.getFooter("music"),
                        });
                        const speakMsg = await channel.send(speakPayload).catch(() => null);
                        if (speakMsg) trackToPlay.ttsMessageId = speakMsg.id;
                      }
                    }
                  }
                }
              } catch(e) {
                logger.warn(`[Autoplay] Gagal generate TTS: ${e.message}`);
              }
           } else {
             trackToPlay.info.skipDj = true; // Skip pengumuman manual agar tidak bentrok
           }
        }

        if (ttsTrack) player.queue.add(ttsTrack);
        player.queue.add(trackToPlay);
        player.isAutoplayResolving = false;

        // ✅ FIX: setImmediate memberi 1 tick event loop agar Poru selesai settle
        // setelah queueEnd - mencegah race condition yang menyebabkan track di-skip
        return new Promise((resolve) => {
          setImmediate(() => {
            player.play();
            resolve();
          });
        });
      } else {
        player.isAutoplayResolving = false;
      }
    }

    if (player.is247) {
      player.isIdle247 = true;
      const MusicUIManager = require("../MusicUIManager");
      await MusicUIManager.renderIdle247Panel(manager, player);
      return;
    }

    clearTransitionTimers(player);
    
    const channel = manager.client.channels.cache.get(player.textChannel);
    if (channel) {
      const standbyPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `🎵 Antrean Musik Habis`,
        description: `Lagu terakhir sudah selesai diputar. Ada yang mau tambah lagu lagi? Naura tungguin di sini sebentar ya! Kalau tidak ada, Naura pamit dalam 2 menit.`,
        expression: "happy",
        footerText: ui.getFooter("music"),
      });

      // Bersihkan panel NowPlaying terakhir
      const oldCache = manager.uiCache.get(player.guildId);
      if (oldCache && oldCache.messageId) {
        channel.messages
          .fetch(oldCache.messageId)
          .then((m) => m.delete().catch(() => {}))
          .catch(() => {});
        if (oldCache.interval) clearInterval(oldCache.interval);
        manager.uiCache.delete(player.guildId);
      }
      
      const standbyMsg = await channel.send(standbyPayload).catch(() => null);

      player.standbyTimeout = setTimeout(() => {
        // Cek jika player masih aktif atau sedang memutar lagu
        if (!player || player.destroyed || player.isPlaying) return;
        
        player.destroy();
        if (standbyMsg) standbyMsg.delete().catch(() => {});
        
        const exitPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          title: `${ui.getEmoji("offline") || ui.getEmoji("power") || "🔌"} Pemutusan Sesi Audio`,
          description: `Sepertinya sudah tidak ada lagu lagi. Naura pamit dari Voice Channel ya! Sampai jumpa di sesi musik berikutnya! ${ui.getEmoji("naura_blowkiss") || "👋"}`,
          expression: "happy",
          footerText: ui.getFooter("music"),
        });
        
        channel.send(exitPayload)
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 15000))
          .catch(() => {});
      }, 120000); // 2 menit timeout
    }
  },
};
