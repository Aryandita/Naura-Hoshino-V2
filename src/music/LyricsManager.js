const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  MessageFlags,
} = require("discord.js");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const { logger } = require("../managers/logger");
const axios = require("axios");
const lyricsFinder = require("lyrics-finder");
const ui = require("../config/ui");
const env = require("../config/env");
const geminiClient = require("../ai/geminiClient");

class LyricsManager {
  constructor(client) {
    this.client = client;
    this.lyricsCache = new Collection();
  }

  clearLyrics(guildId) {
    const cache = this.lyricsCache.get(guildId);
    if (cache) {
      if (cache.timeout) clearTimeout(cache.timeout);
      this.lyricsCache.delete(guildId);
    }
  }

  async fetchLyricsData(track) {
    let cleanTitle = track.info.title;
    let cleanArtist = track.info.author || "";

    // Pisahkan artis dan judul dari format "Artist - Song" (umum di YouTube)
    if (cleanTitle.includes(" - ")) {
      const parts = cleanTitle.split(" - ");
      cleanArtist = parts[0].trim();
      cleanTitle = parts[1].trim();
    }

    // Bersihkan suffix artis seperti " - Topic" atau VEVO
    cleanArtist = cleanArtist
      .replace(/\s*-\s*Topic/gi, "")
      .replace(/vevo/gi, "")
      .trim();

    // Hapus noise dalam tanda kurung/bracket
    cleanTitle = cleanTitle.replace(/(\(.*?\)|\[.*?\])/g, "").trim();

    const redisManager = require("../managers/redisManager");
    const cacheKey = `lyrics_${encodeURIComponent(cleanArtist)}_${encodeURIComponent(cleanTitle)}`;

    if (redisManager.isReady) {
      const cached = await redisManager.getCache(cacheKey);
      if (cached) return cached;
    }

    let result = null;

    // 1. Coba Musixmatch resmi jika API key tersedia di environment
    if (env.MUSIXMATCH_API_KEY) {
      try {
        const mmUrl = `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?apikey=${encodeURIComponent(env.MUSIXMATCH_API_KEY)}&q_track=${encodeURIComponent(cleanTitle)}&q_artist=${encodeURIComponent(cleanArtist)}`;
        const mmRes = await axios.get(mmUrl, { timeout: 4000 }).catch(() => null);
        const mmBody = mmRes?.data?.message?.body?.lyrics?.lyrics_body;
        if (mmBody && typeof mmBody === "string") {
          const cleanedMm = mmBody.split("******* This Lyrics is NOT for Commercial use *******")[0].trim();
          if (cleanedMm) {
            result = { type: "plain", provider: "musixmatch", data: cleanedMm };
          }
        }
      } catch (e) {
        logger.debug("[LyricsManager:fetchLyricsData] Musixmatch error: " + (e?.message || e));
      }
    }

    // 2. Coba LRCLIB (Prioritas utama untuk lirik tersinkronisasi / Live Karaoke)
    try {
      const lrclibUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}&duration=${Math.round(track.info.length / 1000)}`;
      const response = await axios
        .get(lrclibUrl, { timeout: 4000 })
        .catch(() => null);

      if (response && response.data) {
        if (response.data.syncedLyrics) {
          result = {
            type: "synced",
            provider: "lrclib",
            data: this.parseLRC(response.data.syncedLyrics),
          };
        } else if (!result && response.data.plainLyrics) {
          result = { type: "plain", provider: "lrclib", data: response.data.plainLyrics };
        }
      }
    } catch (error) {
      logger.debug("[LyricsManager:fetchLyricsData] Operasi audio/voice gagal: " + (error?.message || error));
    }

    if (!result) {
      // Fallback 1: NPM lyrics-finder
      try {
        const nplLyrics = await lyricsFinder(cleanArtist, cleanTitle);
        if (nplLyrics) result = { type: "plain", data: nplLyrics };
      } catch (e) {
        logger.debug("[LyricsManager:fetchLyricsData] Operasi audio/voice gagal: " + (e?.message || e));
      }
    }

    if (!result && geminiClient.isAvailable()) {
      // Fallback 2: Gemini 2.5 Flash
      try {
        const prompt = `Tuliskan lirik lagu lengkap untuk "${cleanTitle}" oleh "${cleanArtist}". Balas HANYA teks lirik tanpa komentar. Jika tidak tahu, balas "NOT_FOUND".`;

        const aiResult = await geminiClient.generate({
          parts: [{ text: prompt }],
        });
        const aiText = (aiResult || "").trim();
        if (aiText && aiText !== "NOT_FOUND")
          result = { type: "plain", data: aiText };
      } catch (e) {
        logger.debug("[LyricsManager:fetchLyricsData] Operasi audio/voice gagal: " + (e?.message || e));
      }
    }

    if (result && redisManager.isReady) {
      await redisManager.setCache(cacheKey, result, 24 * 60 * 60); // Cache 24 jam
    }

    return result;
  }

  parseLRC(lrcContent) {
    const lines = lrcContent.split("\n");
    const timedLyrics = [];
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/);
      if (match) {
        const time = (parseInt(match[1]) * 60 + parseFloat(match[2])) * 1000;
        const text = match[3].trim();
        if (text) timedLyrics.push({ time, text });
      }
    }
    return timedLyrics;
  }

  // Fungsi format waktu (bantuan)
  formatDur(ms) {
    if (!ms || ms === 0 || !isFinite(ms)) return "0:00";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  // Progress bar ala timeline Spotify
  renderProgressBar(currentMs, totalMs, barLength = 14) {
    const cur = typeof currentMs === "number" && isFinite(currentMs) ? Math.max(0, currentMs) : 0;
    const tot = typeof totalMs === "number" && isFinite(totalMs) && totalMs > 0 ? totalMs : 0;

    if (tot === 0) {
      return `${this.formatDur(cur)} ━━━━🟢━━━━ 0:00`;
    }

    const progress = Math.min(Math.max(cur / tot, 0), 1);
    const activeIndex = Math.min(Math.floor(progress * barLength), barLength - 1);
    let bar = "";
    for (let i = 0; i < barLength; i++) {
      if (i === activeIndex) {
        bar += "🟢";
      } else {
        bar += "━";
      }
    }
    return `${this.formatDur(cur)} ${bar} ${this.formatDur(tot)}`;
  }

  async sendLyrics(interaction, manager, player, track, isEphemeral = false) {
    if (!interaction.deferred && !interaction.replied) {
      const options = isEphemeral ? { flags: MessageFlags.Ephemeral } : {};
      await interaction.deferReply(options).catch(() => {});
    }

    const lyricsObj = await this.fetchLyricsData(track);

    if (!lyricsObj) {
      const { buildErrorContainerV2 } = require("../utils/NauraContainerBuilder");
      const errPayload = buildErrorContainerV2({
        interaction,
        title: "Lirik Tidak Ditemukan",
        description: `${ui.getEmoji("error") || "❌"} Lirik tidak ditemukan di database global maupun memori AI untuk lagu ini.`,
        footerText: ui.getFooter("music"),
      });
      return interaction.editReply(errPayload).catch(() => {});
    }

    if (lyricsObj.type === "synced" && player) {
      return this.startLiveLyrics(
        interaction,
        player,
        track,
        lyricsObj.data,
        true,
      );
    }

    return this.sendPagedLyrics(interaction, player, track, lyricsObj.data);
  }

  // ==========================================
  // 📖 MODE PAGED LYRICS (BEAUTIFIED)
  // ==========================================
  async sendPagedLyrics(interaction, player, track, textData) {
    try {
      let plainText = "Lirik tidak dapat diproses.";

      if (typeof textData === "string") plainText = textData;
      else if (textData && typeof textData.data === "string")
        plainText = textData.data;
      else if (Array.isArray(textData)) plainText = textData.join("\n");
      else if (textData) plainText = String(textData);

      const lines = plainText.split("\n").filter((l) => l.trim() !== "");
      const pages = [];

      for (let i = 0; i < lines.length; i += 25) {
        pages.push(lines.slice(i, i + 25).join("\n"));
      }

      if (pages.length === 0) pages.push("Lirik kosong atau tidak terbaca.");

      let current = 0;
      const divider = `-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      // Header informasi lagu ala Spotify
      const headerInfo =
        `> ${ui.getEmoji("musicArtist") || "👤"} **Artis:** \`${track.info.author}\`\n` +
        `> ⏳ **Durasi:** \`${this.formatDur(track.info.length)}\`\n` +
        `> 💿 **Sumber:** \`${track.info.originalSource || "Spotify"}\`\n${divider}\n\n`;

      const buildPagePayload = (pageIndex) => {
        const pageText = pages[pageIndex];
        const description = headerInfo + pageText;

        const hasPrev = pageIndex > 0;
        const hasNext = pageIndex < pages.length - 1;

        const rowButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("lyrics_prev")
            .setLabel("◀ Sebelumnya")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasPrev),
          new ButtonBuilder()
            .setCustomId("lyrics_next")
            .setLabel("Selanjutnya ▶")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasNext),
        );

        return buildContainerV2({
          accentColorHex: "#1DB954",
          authorName: `Spotify Lyrics: ${track.info.title}`,
          iconURL: interaction.client.user.displayAvatarURL(),
          title: `📄 Halaman ${pageIndex + 1} / ${pages.length}`,
          description,
          buttonsRow: pages.length > 1 ? [rowButtons] : null,
          footerText: `Lirik Lagu Penuh • Didukung oleh Spotify & Musixmatch Engine`,
        });
      };

      const msg = await interaction.editReply(buildPagePayload(current));

      // Collector tombol navigasi halaman (5 menit)
      if (pages.length > 1 && msg) {
        const collector = msg.createMessageComponentCollector({
          time: 5 * 60 * 1000,
        });

        collector.on("collect", async (btnInteraction) => {
          if (btnInteraction.user.id !== interaction.user.id) {
            return btnInteraction.reply({
              content: "❌ Hanya pengirim yang bisa menavigasi halaman ini.",
              flags: MessageFlags.Ephemeral,
            });
          }

          if (btnInteraction.customId === "lyrics_prev")
            current = Math.max(0, current - 1);
          if (btnInteraction.customId === "lyrics_next")
            current = Math.min(pages.length - 1, current + 1);

          await btnInteraction
            .update(buildPagePayload(current))
            .catch(() => {});
        });

        collector.on("end", () => {
          interaction
            .editReply(
              buildContainerV2({
                accentColorHex: ui.getColor("accent") || "#FF69B4",
                authorName: `Lirik: ${track.info.title}`,
                iconURL: interaction.client.user.displayAvatarURL(),
                title: `📄 Halaman ${current + 1} / ${pages.length}`,
                description: headerInfo + pages[current],
                footerText: ui.getFooter("music"),
              }),
            )
            .catch(() => {});
        });
      }
    } catch (error) {
      logger.error("Error in sendPagedLyrics:", error);
    }
  }

  // ==========================================
  // 🟢 MODE SPOTIFY LIVE LYRICS (SYNCED KARAOKE)
  // ==========================================
  async startLiveLyrics(
    interaction,
    player,
    track,
    timedLyrics,
    isEdit = false,
  ) {
    try {
      if (!timedLyrics || timedLyrics.length === 0) {
        return this.sendPagedLyrics(
          interaction,
          player,
          track,
          "Lirik sinkron tidak tersedia.",
        );
      }

      const divider = `-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      const buildControls = () =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("lyrics_live_sync")
            .setLabel("Sinkron Ulang")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("lyrics_live_full")
            .setLabel("Lirik Lengkap")
            .setEmoji("📄")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("lyrics_live_stop")
            .setLabel("Tutup")
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger),
        );

      const timeline = this.renderProgressBar(player.position || 0, track.info.length);
      const standbyDescription = [
        `### 🟢 Spotify Live Lyrics: [${track.info.title}](${track.info.uri})`,
        `> 👤 **Artis:** \`${track.info.author}\` • 💿 **Sumber:** \`${track.info.originalSource || "Spotify"}\``,
        `> ⏱️ \`${timeline}\``,
        divider,
        "",
        "*Menunggu vokal dimulai...*",
        "",
        "-# Lirik akan otomatis bergerak secara sinkron mengikuti audio lagu.",
      ].join("\n");

      const payload = buildContainerV2({
        accentColorHex: "#1DB954",
        authorName: "SPOTIFY LIVE LYRICS ENGINE",
        iconURL: interaction.client.user.displayAvatarURL(),
        description: standbyDescription,
        buttonsRow: [buildControls()],
        footerText: `Disinkronkan secara real-time • Spotify & Musixmatch Engine`,
      });

      const msg = isEdit
        ? await interaction.editReply(payload)
        : await interaction.reply({ ...payload, withResponse: true });
      const targetMsg = msg?.resource?.message || msg;

      // 1. Bersihkan sisa timer lama
      this.clearLyrics(player.guildId);

      // 2. Daftarkan ke cache agar mesin bisa berjalan
      this.lyricsCache.set(player.guildId, { timeout: null });

      // 3. Simpan ID agar otomatis terhapus saat lagu selesai
      player.lyricsMessageId = targetMsg?.id || null;

      // 4. Pasang collector interaktif tombol Spotify (15 menit)
      if (targetMsg && typeof targetMsg.createMessageComponentCollector === "function") {
        const collector = targetMsg.createMessageComponentCollector({
          time: 15 * 60 * 1000,
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== interaction.user.id) {
            return btn.reply({
              content: "❌ Hanya pengguna yang meminta lirik yang dapat mengontrol tampilan ini.",
              flags: MessageFlags.Ephemeral,
            });
          }

          if (btn.customId === "lyrics_live_stop") {
            this.clearLyrics(player.guildId);
            collector.stop("user_closed");
            return btn.update(
              buildContainerV2({
                accentColorHex: "#6B7280",
                authorName: "SPOTIFY LIVE LYRICS",
                iconURL: interaction.client.user.displayAvatarURL(),
                title: "⏹️ Sesi Lirik Ditutup",
                description: `Tampilan Spotify Live Lyrics untuk lagu **${track.info.title}** telah dihentikan.`,
                footerText: ui.getFooter("music"),
              }),
            ).catch(() => {});
          }

          if (btn.customId === "lyrics_live_full") {
            this.clearLyrics(player.guildId);
            collector.stop("switched_to_paged");
            await btn.deferUpdate().catch(() => {});
            const fullPlain = timedLyrics.map((l) => l.text).join("\n");
            return this.sendPagedLyrics(interaction, player, track, fullPlain);
          }

          if (btn.customId === "lyrics_live_sync") {
            await btn.deferUpdate().catch(() => {});
            return update();
          }
        });
      }

      const update = async () => {
        // Cek apakah lirik masih diizinkan berjalan
        if (!this.lyricsCache.has(player.guildId)) return;
        if (
          player.currentTrack &&
          track &&
          player.currentTrack.info.uri !== track.info.uri
        ) {
          this.clearLyrics(player.guildId);
          return;
        }
        if (!player.isPlaying || player.isPaused) {
          const t = setTimeout(update, 1000);
          this.lyricsCache.set(player.guildId, { timeout: t });
          return;
        }

        const currentPos = player.position;
        const index = timedLyrics.findIndex((l, i) => {
          const next = timedLyrics[i + 1];
          return currentPos >= l.time && (!next || currentPos < next.time);
        });

        if (index !== -1) {
          const linesText = [];

          // 1. Baris sebelumnya (redup)
          const startIndex = Math.max(0, index - 2);
          for (let i = startIndex; i < index; i++) {
            if (timedLyrics[i].text.trim() !== "") {
              linesText.push(`> *${timedLyrics[i].text}*`);
            }
          }

          // 2. Baris aktif (Spotify style: teks besar, bold, penanda hijau)
          if (timedLyrics[index].text.trim() !== "") {
            linesText.push(`## 🟢 **${timedLyrics[index].text}**`);
          } else {
            linesText.push(`## 🟢 🎵 *(Instrumental)*`);
          }

          // 3. Baris berikutnya (teks normal)
          const endIndex = Math.min(timedLyrics.length - 1, index + 2);
          for (let i = index + 1; i <= endIndex; i++) {
            if (timedLyrics[i].text.trim() !== "") {
              linesText.push(`${timedLyrics[i].text}`);
            }
          }

          const currentTimeline = this.renderProgressBar(currentPos, track.info.length);
          const lyricsDescription = [
            `### 🟢 Spotify Live Lyrics: [${track.info.title}](${track.info.uri})`,
            `> 👤 **Artis:** \`${track.info.author}\` • 💿 **Sumber:** \`${track.info.originalSource || "Spotify"}\``,
            `> ⏱️ \`${currentTimeline}\``,
            divider,
            "",
            ...linesText,
          ].join("\n");

          const updatedPayload = buildContainerV2({
            accentColorHex: "#1DB954",
            authorName: "SPOTIFY LIVE LYRICS ENGINE",
            iconURL: interaction.client.user.displayAvatarURL(),
            description: lyricsDescription,
            buttonsRow: [buildControls()],
            footerText: `Disinkronkan secara real-time • Spotify & Musixmatch Engine`,
          });

          if (targetMsg && typeof targetMsg.edit === "function") {
            await targetMsg.edit(updatedPayload).catch(() => {});
          }

          const nextTime = timedLyrics[index + 1]
            ? timedLyrics[index + 1].time - player.position
            : 2000;

          const timeout = setTimeout(update, Math.max(nextTime, 500));
          this.lyricsCache.set(player.guildId, { timeout });
        } else {
          const currentTimeline = this.renderProgressBar(currentPos, track.info.length);
          const currentStandby = [
            `### 🟢 Spotify Live Lyrics: [${track.info.title}](${track.info.uri})`,
            `> 👤 **Artis:** \`${track.info.author}\` • 💿 **Sumber:** \`${track.info.originalSource || "Spotify"}\``,
            `> ⏱️ \`${currentTimeline}\``,
            divider,
            "",
            "*Menunggu vokal dimulai...*",
            "",
            "-# Lirik akan otomatis bergerak secara sinkron mengikuti audio lagu.",
          ].join("\n");

          const standbyPayload = buildContainerV2({
            accentColorHex: "#1DB954",
            authorName: "SPOTIFY LIVE LYRICS ENGINE",
            iconURL: interaction.client.user.displayAvatarURL(),
            description: currentStandby,
            buttonsRow: [buildControls()],
            footerText: `Disinkronkan secara real-time • Spotify & Musixmatch Engine`,
          });
          if (targetMsg && typeof targetMsg.edit === "function") {
            await targetMsg.edit(standbyPayload).catch(() => {});
          }

          const timeout = setTimeout(update, 1000);
          this.lyricsCache.set(player.guildId, { timeout });
        }
      };

      update();
    } catch (error) {
      logger.error("Error in startLiveLyrics:", error);
    }
  }
}

module.exports = LyricsManager;
