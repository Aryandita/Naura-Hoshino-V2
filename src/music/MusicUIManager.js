// Lokasi: plugin/music/MusicUIManager.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../managers/logger");
const { generateMusicPanelImage } = require("../canvas/canvasHelper");
const ui = require("../config/ui");
const {
  textDisplay,
  separatorComp,
} = require("../utils/NauraContainerBuilder");

class MusicUIManager {
  static formatDur(ms) {
    if (!ms || ms === 0 || !isFinite(ms)) return "0:00";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  static buildProgressBar(current, total) {
    if (total === 0 || !isFinite(total))
      return `${ui.getEmoji("nowplaying") || "🔴"} **LIVE STREAM**`;
    const totalSegments = 12;
    let progress = Math.round((current / total) * totalSegments);
    if (progress > totalSegments) progress = totalSegments;
    if (progress < 0) progress = 0;

    let bar = "";
    for (let i = 0; i < totalSegments; i++) {
      if (i < progress) bar += ui.getEmoji("progressLineBefore") || "▬";
      else if (i === progress) bar += ui.getEmoji("progressDot") || "🔵";
      else bar += ui.getEmoji("progressLineAfter") || "▬";
    }
    return bar;
  }

  static async renderPanel(manager, player, track, recommendedTracks = []) {
    try {
      let channel = manager.client.channels.cache.get(player.textChannel);
      if (!channel && player.textChannel) {
        channel = await manager.client.channels
          .fetch(player.textChannel)
          .catch(() => null);
      }
      if (!channel) {
        logger.error(
          `[MusicUI Error] Channel ${player.textChannel} tidak dapat ditemukan.`,
        );
        return;
      }

      console.log(
        "\x1b[46m\x1b[30m 🎨 UI ENGINE \x1b[0m \x1b[36mMenggambar Canvas & Merakit Panel untuk:\x1b[0m",
        track.info.title,
      );

      if (!player.currentFilterName)
        player.currentFilterName = "Original Audio";

      const generatePayload = async (currentPos, isUpdate = false) => {
        const pBar = this.buildProgressBar(currentPos, track.info.length);
        const timeStr = track.info.isStream
          ? "LIVE"
          : `${this.formatDur(currentPos)} / ${this.formatDur(track.info.length)}`;
        const requesterText = track.info.requester?.id
          ? `<@${track.info.requester.id}>`
          : "`📻 Autoplay Engine`";

        // 🟢🔴 DETEKSI PLATFORM CERDAS UNTUK WARNA & EMOJI
        let accentColor = 0xffb6c1; // Pink default
        let brandEmoji = "🎵";

        const source =
          track.info.originalSource || track.info.sourceName || "youtube";

        if (source === "spotify") {
          accentColor = 0x1db954; // Spotify Green
          brandEmoji = ui.getEmoji("spotify") || "🟢";
        } else if (source === "youtube") {
          accentColor = 0xff0000; // YouTube Red
          brandEmoji = ui.getEmoji("youtube") || "🔴";
        } else if (source === "soundcloud") {
          accentColor = 0xff5500;
          brandEmoji = "☁️";
        } else if (source === "ytmsearch" || source === "ytm") {
          accentColor = 0xff0000;
          brandEmoji = ui.getEmoji("youtube") || "🔴";
        }

        // ==========================================
        // 🎵 BUILD COMPONENTS V2 MUSIC PANEL
        // ==========================================
        const containerComponents = [];

        // --- Header: Author (nama bot) ---
        containerComponents.push(
          textDisplay(`-# ✦  N A U R A  M U S I C  P A N E L  ✦`),
        );
        containerComponents.push(separatorComp(true, 1));

        // --- Now Playing Info ---
        containerComponents.push(
          textDisplay(
            `### ${brandEmoji} Now Playing...\n` +
              `[${track.info.title}](${track.info.uri})\n\n` +
              `${timeStr} ${pBar}\n\n` +
              `**Artist/Channel:**\n` +
              `${track.info.author}\n\n` +
              `**Requested by**\n` +
              `${requesterText}\n\n` +
              `---\n` +
              `**━━━ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐏𝐀𝐑𝐀𝐌𝐄𝐓𝐄𝐑𝐒 ━━━**\n` +
              `> 🔊 **Volume:** \`${player.volume}%\`\n` +
              `> ${ui.stripCustomEmojis(ui.getEmoji("filter") || "🎛️")} **Filter DSP:** \`${player.currentFilterName}\`\n` +
              `> **Looping:** \`${player.loop}\`\n` +
              `> **Autoplay:** \`${player.isAutoplayMode ? "Aktif" : "Nonaktif"}\`\n` +
              `> **Mode 24/7:** \`${player.is247 ? "Aktif" : "Nonaktif"}\``,
          ),
        );

        // --- Canvas Image sebagai Media Gallery ---
        const uniqueFileName = `naura-panel-${Date.now()}.png`;
        const imageBuffer = await generateMusicPanelImage(
          track,
          currentPos,
          manager.client.user.displayAvatarURL({ extension: "png" }),
        );
        const attachment = new AttachmentBuilder(imageBuffer, {
          name: uniqueFileName,
        });

        containerComponents.push({
          type: 12, // MEDIA_GALLERY
          items: [{ media: { url: `attachment://${uniqueFileName}` } }],
        });

        // --- Rows tombol kontrol musik ---
        const rowFilter = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("music_filter")
            .setPlaceholder(`🎛️ DSP Filter: ${player.currentFilterName}`)
            .addOptions([
              {
                label: "Original Audio",
                description: "Frekuensi murni",
                value: "clear",
                emoji: "🎵",
              },
              {
                label: "Sub-Bassboost",
                description: "Peningkatan nada rendah",
                value: "bassboost",
                emoji: "🔊",
              },
              {
                label: "Nightcore Shift",
                description: "Peningkatan tempo",
                value: "nightcore",
                emoji: "⚡",
              },
              {
                label: "Vaporwave Reverb",
                description: "Gema ruang",
                value: "vaporwave",
                emoji: "🌊",
              },
              {
                label: "8D Surround",
                description: "Audio 360",
                value: "8d",
                emoji: "🎧",
              },
              {
                label: "Pop / Tremolo",
                description: "Efek getaran suara",
                value: "pop",
                emoji: "🎸",
              },
              {
                label: "Karaoke Mode",
                description: "Kurangi vokal",
                value: "karaoke",
                emoji: "🎤",
              },
            ]),
        );

        const rowMedia = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("music_pause")
            .setEmoji(
              ui.parseEmoji(ui.getEmoji("musicPlayPause")) || { name: "⏯️" },
            )
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("music_stop")
            .setEmoji(ui.parseEmoji(ui.getEmoji("musicStop")) || { name: "⏹️" })
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("music_skip")
            .setEmoji(ui.parseEmoji(ui.getEmoji("musicSkip")) || { name: "⏭️" })
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("music_loop")
            .setEmoji(ui.parseEmoji(ui.getEmoji("musicLoop")) || { name: "🔁" })
            .setStyle(
              player.loop !== "NONE"
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary,
            ),
          new ButtonBuilder()
            .setCustomId("music_autoplay")
            .setEmoji(
              ui.parseEmoji(ui.getEmoji("musicAutoplay")) || { name: "🤖" },
            )
            .setStyle(
              player.isAutoplayMode
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary,
            ),
        );

        const rowUtils = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("music_voldown")
            .setEmoji(
              ui.parseEmoji(ui.getEmoji("musicVolDown")) || { name: "🔉" },
            )
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("music_volup")
            .setEmoji(
              ui.parseEmoji(ui.getEmoji("musicVolUp")) || { name: "🔊" },
            )
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("music_lyrics")
            .setEmoji(
              ui.parseEmoji(ui.getEmoji("musicLyrics")) || { name: "🎤" },
            )
            .setLabel("Lirik")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("music_247")
            .setEmoji(ui.parseEmoji(ui.getEmoji("music247")) || { name: "🌙" })
            .setStyle(
              player.is247 ? ButtonStyle.Primary : ButtonStyle.Secondary,
            ),
          new ButtonBuilder()
            .setCustomId("music_save")
            .setEmoji(ui.parseEmoji(ui.getEmoji("favorite")) || { name: "💚" })
            .setStyle(ButtonStyle.Success),
        );

        // ── Separator tipis: Pemisah Konten dari Tombol ───────────────
        containerComponents.push(separatorComp(false, 1));

        // Tambahkan rows rekomendasi jika ada
        if (recommendedTracks && recommendedTracks.length > 0) {
          const rowDropdown = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("music_recommendation")
              .setPlaceholder("📻 Rekomendasi Trek Audio Berikutnya")
              .addOptions(
                recommendedTracks.slice(0, 5).map((t) => ({
                  label: t.info.title.substring(0, 95),
                  description: t.info.author.substring(0, 40),
                  value: t.info.uri.substring(0, 100),
                  emoji: "🎵",
                })),
              ),
          );
          containerComponents.push(rowDropdown.toJSON());
        }

        containerComponents.push(rowFilter.toJSON());
        containerComponents.push(rowMedia.toJSON());
        containerComponents.push(rowUtils.toJSON());

        // ── Separator tebal: Pemisah Tombol dari Footer ──────────────
        containerComponents.push(separatorComp(true, 1));
        // --- Footer ---
        containerComponents.push(
          textDisplay(`-# ${ui.stripCustomEmojis(ui.getFooter("music"))}`),
        );

        const payload = {
          content: null,
          embeds: [],
          flags: MessageFlags.IsComponentsV2,
          files: [attachment],
          components: [
            {
              type: 17, // CONTAINER
              accent_color: accentColor,
              components: containerComponents,
            },
          ],
        };

        if (isUpdate) payload.attachments = [];

        return payload;
      };

      const initialPayload = await generatePayload(0, false);
      const message = await channel.send(initialPayload);

      const oldCache = manager.uiCache.get(player.guildId);
      if (oldCache && oldCache.messageId) {
        channel.messages
          .fetch(oldCache.messageId)
          .then((m) => m.delete().catch(() => {}))
          .catch(() => {});
        if (oldCache.interval) clearInterval(oldCache.interval);
      }

      const updateIntervalMs = 15000;

      const interval = setInterval(async () => {
        if (!player.isPlaying || player.isPaused) return;
        try {
          const currentMsg = await channel.messages
            .fetch(message.id)
            .catch(() => null);
          if (!currentMsg) {
            clearInterval(interval);
            return;
          }
          const updatePayload = await generatePayload(player.position, true);
          await currentMsg.edit(updatePayload).catch(() => {});
        } catch (e) {}
      }, updateIntervalMs);

      manager.uiCache.set(player.guildId, {
        messageId: message.id,
        interval: interval,
        generatePayload: generatePayload,
      });
    } catch (error) {
      logger.error("\x1b[41m\x1b[37m ⚠️ UI ERROR \x1b[0m", error);
    }
  }

  static async renderIdle247Panel(manager, player) {
    try {
      // Bersihkan interval canvas lama jika ada
      const oldCache = manager.uiCache.get(player.guildId);
      if (oldCache) {
        if (oldCache.interval) clearInterval(oldCache.interval);
        if (oldCache.messageId) {
          const channel = manager.client.channels.cache.get(player.textChannel);
          if (channel) {
            channel.messages
              .fetch(oldCache.messageId)
              .then((m) => m.delete().catch(() => {}))
              .catch(() => {});
          }
        }
        manager.uiCache.delete(player.guildId);
      }

      let channel = manager.client.channels.cache.get(player.textChannel);
      if (!channel && player.textChannel) {
        channel = await manager.client.channels
          .fetch(player.textChannel)
          .catch(() => null);
      }
      if (!channel) return;

      const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
      const row247 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("music_247")
          .setLabel("Mode 24/7 (Aktif)")
          .setEmoji(ui.parseEmoji(ui.getEmoji("music247")) || { name: "🌙" })
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("music_stop")
          .setLabel("Keluar VC")
          .setEmoji(ui.parseEmoji(ui.getEmoji("musicStop")) || { name: "⏹️" })
          .setStyle(ButtonStyle.Danger),
      );

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "✦ NAURA 24/7 STANDBY ENGINE ✦",
        title: "🌙 Mode Siaga 24/7 Aktif",
        description:
          `Naura sedang siaga di Voice Channel <#${player.voiceChannel}>.\n\n` +
          `> 💤 **Status Stream:** Pasif (0kbps Bandwidth & 0% CPU Load)\n` +
          `> 🎵 Putar lagu baru kapan saja dengan perintah \`/music play <judul/URL>\` atau gunakan tombol di bawah.`,
        buttonsRow: row247,
        footerText: ui.getFooter("music"),
      });

      const sentMsg = await channel.send(payload).catch(() => null);
      if (sentMsg) {
        manager.uiCache.set(player.guildId, {
          messageId: sentMsg.id,
          interval: null,
        });
      }
    } catch (err) {
      logger.error("[MusicUI 24/7 Idle Error]", err);
    }
  }
}

module.exports = MusicUIManager;
