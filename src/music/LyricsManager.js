// Lokasi: src/managers/LyricsManager.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
} = require("discord.js");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const { logger } = require("../managers/logger");
const axios = require("axios");
const lyricsFinder = require("lyrics-finder");
const ui = require("../config/ui");
const { GoogleGenerativeAI } = require("@google/generative-ai");

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

    if (redisManager.client && redisManager.client.isReady) {
      const cached = await redisManager.getCache(cacheKey);
      if (cached) return cached;
    }

    let result = null;

    try {
      // Utama: LRCLIB untuk lirik sinkron (Live Karaoke)
      const lrclibUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}&duration=${Math.round(track.info.length / 1000)}`;
      const response = await axios
        .get(lrclibUrl, { timeout: 4000 })
        .catch(() => null);

      if (response && response.data) {
        if (response.data.syncedLyrics)
          result = {
            type: "synced",
            data: this.parseLRC(response.data.syncedLyrics),
          };
        else if (response.data.plainLyrics)
          result = { type: "plain", data: response.data.plainLyrics };
      }
    } catch (error) {}

    if (!result) {
      // Fallback 1: NPM lyrics-finder
      try {
        const nplLyrics = await lyricsFinder(cleanArtist, cleanTitle);
        if (nplLyrics) result = { type: "plain", data: nplLyrics };
      } catch (e) {}
    }

    if (!result && process.env.GEMINI_API_KEY) {
      // Fallback 2: Gemini 2.5 Flash
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Tuliskan lirik lagu lengkap untuk "${cleanTitle}" oleh "${cleanArtist}". Balas HANYA teks lirik tanpa komentar. Jika tidak tahu, balas "NOT_FOUND".`;

        const aiResult = await model.generateContent(prompt);
        const aiText = aiResult.response.text().trim();
        if (aiText && aiText !== "NOT_FOUND")
          result = { type: "plain", data: aiText };
      } catch (e) {}
    }

    if (result && redisManager.client && redisManager.client.isReady) {
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

  async sendLyrics(interaction, manager, player, track, isEphemeral = false) {
    if (!interaction.deferred) {
      const options = isEphemeral ? { flags: 64 } : {};
      await interaction.deferReply(options).catch(() => {});
    }

    const lyricsObj = await this.fetchLyricsData(track);

    if (!lyricsObj) {
      return interaction
        .editReply({
          content: `${ui.getEmoji("error") || "❌"} Lirik tidak ditemukan di database global maupun memori AI untuk lagu ini.`,
        })
        .catch(() => {});
    }

    if (lyricsObj.type === "synced") {
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

      // Header informasi lagu
      const headerInfo =
        `> ${ui.getEmoji("musicArtist") || "👤"} **Artis:** \`${track.info.author}\`\n` +
        `> ⏳ **Durasi:** \`${this.formatDur(track.info.length)}\`\n` +
        `> 💿 **Album/Sumber:** \`${track.info.originalSource || "YouTube"}\`\n${divider}\n\n`;

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
          accentColorHex: ui.getColor("accent") || "#FF69B4",
          authorName: `Lirik: ${track.info.title}`,
          iconURL: interaction.client.user.displayAvatarURL(),
          title: `📄 Halaman ${pageIndex + 1} / ${pages.length}`,
          description,
          buttonsRow: pages.length > 1 ? rowButtons : null,
          footerText: ui.getFooter("music"),
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
              flags: 64,
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
  // 🎤 MODE LIVE KARAOKE (SYNCED LYRICS)
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
      const standbyInfo =
        `### 🎤 Live Karaoke: [${track.info.title}](${track.info.uri})\n${divider}\n\n` +
        `*Menunggu lirik dimulai...*\n\n-# Lirik akan tampil secara sinkron sesuai waktu lagu.`;

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("accent") || "#FF69B4",
        authorName: "Naura Live Karaoke System",
        iconURL: interaction.client.user.displayAvatarURL(),
        description: standbyInfo,
        footerText: `Disinkronkan untuk ${interaction.user.username} • Naura Hoshino Music System`,
      });

      const msg = isEdit
        ? await interaction.editReply(payload)
        : await interaction.reply({ ...payload, fetchReply: true });

      // 1. Bersihkan sisa timer lama
      this.clearLyrics(player.guildId);

      // 2. Daftarkan ke cache agar mesin bisa berjalan
      this.lyricsCache.set(player.guildId, { timeout: null });

      // 3. Simpan ID agar otomatis terhapus saat lagu selesai
      player.lyricsMessageId = msg.id;

      const update = async () => {
        // Cek apakah lirik masih diizinkan berjalan
        if (!this.lyricsCache.has(player.guildId)) return;
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

          const startIndex = Math.max(0, index - 3);
          for (let i = startIndex; i < index; i++) {
            if (timedLyrics[i].text.trim() !== "") {
              linesText.push(`*${timedLyrics[i].text}*`);
            }
          }

          if (timedLyrics[index].text.trim() !== "") {
            linesText.push(
              `### ${ui.getEmoji("dot") || "▶️"} **${timedLyrics[index].text}**`,
            );
          } else {
            linesText.push(`### ${ui.getEmoji("dot") || "▶️"} 🎵`);
          }

          const endIndex = Math.min(timedLyrics.length - 1, index + 3);
          for (let i = index + 1; i <= endIndex; i++) {
            if (timedLyrics[i].text.trim() !== "") {
              linesText.push(`*${timedLyrics[i].text}*`);
            }
          }

          const lyricsDescription =
            `### 🎤 Live Karaoke: [${track.info.title}](${track.info.uri})\n${divider}\n\n` +
            linesText.join("\n");

          const updatedPayload = buildContainerV2({
            accentColorHex: ui.getColor("accent") || "#FF69B4",
            authorName: "Naura Live Karaoke System",
            iconURL: interaction.client.user.displayAvatarURL(),
            description: lyricsDescription,
            footerText: `Disinkronkan untuk ${interaction.user.username} • Naura Hoshino Music System`,
          });

          await msg.edit(updatedPayload).catch(() => {});

          const nextTime = timedLyrics[index + 1]
            ? timedLyrics[index + 1].time - player.position
            : 2000;

          const timeout = setTimeout(update, Math.max(nextTime, 500));
          this.lyricsCache.set(player.guildId, { timeout });
        } else {
          const standbyPayload = buildContainerV2({
            accentColorHex: ui.getColor("accent") || "#FF69B4",
            authorName: "Naura Live Karaoke System",
            iconURL: interaction.client.user.displayAvatarURL(),
            description: standbyInfo,
            footerText: `Disinkronkan untuk ${interaction.user.username} • Naura Hoshino Music System`,
          });
          await msg.edit(standbyPayload).catch(() => {});

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
