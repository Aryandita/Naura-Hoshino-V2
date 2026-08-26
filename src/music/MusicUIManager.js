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

      if (Array.isArray(recommendedTracks) && recommendedTracks.length > 0) {
        player.recommendedTracks = recommendedTracks;
      }

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
        const fs = require("node:fs");
        const bannerPath =
          ui.getBanner("music") ||
          "./assets/general/Music Banner.jpeg";
        const bannerName = "music-banner.jpeg";
        const hasBanner = fs.existsSync(bannerPath);

        // --- Header: Author (nama bot) ---
        containerComponents.push(
          textDisplay(`-# ✦  N A U R A  M U S I C  P A N E L  ✦`),
        );
        containerComponents.push(separatorComp(true, 1));

        // --- Top Banner: Banner Musik ---
        if (hasBanner) {
          containerComponents.push({
            type: 12, // MEDIA_GALLERY
            items: [{ media: { url: `attachment://${bannerName}` } }],
          });
          containerComponents.push(separatorComp(true, 1));
        }

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
              `**━━━ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐏𝐀𝐑𝐀𝐌𝐄𝐓𝐄𝐑𝐒 ━━━**\n` +
              `> ${ui.getEmoji("musicVolUp") || "🔊"} **Volume:** \`${player.volume}%\`\n` +
              `> ${ui.getEmoji("filter") || "🎛️"} **Filter DSP:** \`${player.currentFilterName}\`\n` +
              `> ${ui.getEmoji("musicLoop") || "🔁"} **Looping:** \`${player.loop}\`\n` +
              `> ${ui.getEmoji("musicAutoplay") || "🤖"} **Autoplay:** \`${player.isAutoplayMode ? "Aktif" : "Nonaktif"}\`\n` +
              `> ${ui.getEmoji("music247") || "🌙"} **Mode 24/7:** \`${player.is247 ? "Aktif" : "Nonaktif"}\``,
          ),
        );

        // --- Pemisah sebelum Canvas ---
        containerComponents.push(separatorComp(true, 1));

        // --- Canvas Image sebagai Media Gallery (di bagian bawah) ---
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

        // Tambahkan dropdown rekomendasi lagu berikutnya khusus saat mode Autoplay aktif (fitur premium)
        const getRecommendations = () => {
          const combined = [];
          const seenIds = new Set();
          if (track && track.info && track.info.identifier) {
            seenIds.add(track.info.identifier);
          }
          if (player.currentTrack && player.currentTrack.info && player.currentTrack.info.identifier) {
            seenIds.add(player.currentTrack.info.identifier);
          }

          // 1. Pilihan Autoplay Utama (Prefetched) jika ada
          if (player.prefetchedAutoplayTrack && player.prefetchedAutoplayTrack.info) {
            const id = player.prefetchedAutoplayTrack.info.identifier;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              combined.push({
                ...player.prefetchedAutoplayTrack,
                isAutoplayNext: true,
              });
            }
          }

          // 2. Buffer Antrean Autoplay
          if (Array.isArray(player.autoplayQueue)) {
            for (const t of player.autoplayQueue) {
              const id = t && t.info && t.info.identifier;
              if (id && !seenIds.has(id)) {
                seenIds.add(id);
                combined.push(t);
              }
            }
          }

          // 3. Rekomendasi yang tersimpan di player / parameter
          const recs = (Array.isArray(player.recommendedTracks) && player.recommendedTracks.length > 0)
            ? player.recommendedTracks
            : (Array.isArray(recommendedTracks) && recommendedTracks.length > 0 ? recommendedTracks : []);

          for (const t of recs) {
            const id = t && t.info && t.info.identifier;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              combined.push(t);
            }
          }

          return combined;
        };

        const activeRecs = getRecommendations();
        // Dropdown hanya tampil jika Autoplay aktif bagi pengguna VIP / Premium
        if (player.isAutoplayMode && activeRecs.length > 0) {
          const placeholder = (player.prefetchedAutoplayTrack && player.prefetchedAutoplayTrack.info && player.prefetchedAutoplayTrack.info.title)
            ? `🤖 Autoplay: ${player.prefetchedAutoplayTrack.info.title}`.substring(0, 95)
            : "📻 Rekomendasi Autoplay Berikutnya";

          const rowDropdown = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("music_recommendation")
              .setPlaceholder(placeholder)
              .addOptions(
                activeRecs.slice(0, 10).map((t, idx) => {
                  const isTopAutoplay = t.isAutoplayNext || idx === 0;
                  const rawTitle = t.info && t.info.title ? t.info.title : "Unknown Title";
                  const label = rawTitle.length > 100 ? rawTitle.substring(0, 97) + "..." : rawTitle;

                  const rawDesc = isTopAutoplay
                    ? `[Autoplay Selanjutnya] ${(t.info && t.info.author) || "Unknown Artist"}`
                    : ((t.info && t.info.author) || "Unknown Artist");
                  const desc = rawDesc.length > 100 ? rawDesc.substring(0, 97) + "..." : rawDesc;

                  const value = (t.info && t.info.uri && t.info.uri.startsWith("http"))
                    ? t.info.uri.substring(0, 100)
                    : `ytsearch:${t.info && t.info.title} ${t.info && t.info.author}`.substring(0, 100);

                  const customEmoji = isTopAutoplay
                    ? (ui.parseEmoji(ui.getEmoji("musicAutoplay")) || { name: "🤖" })
                    : (ui.parseEmoji(ui.getEmoji("normal")) || ui.parseEmoji(ui.getEmoji("music_note")) || { name: "🎵" });

                  return {
                    label: label,
                    description: desc,
                    value: value,
                    emoji: customEmoji,
                  };
                }),
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

        const filesArray = [attachment];
        if (hasBanner) {
          filesArray.push(
            new AttachmentBuilder(bannerPath, { name: bannerName }),
          );
        }

        const payload = {
          content: null,
          embeds: [],
          flags: MessageFlags.IsComponentsV2,
          files: filesArray,
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
      // Rule 1.9: interval per-player sudah dibersihkan via clearInterval di
      // jalur ganti track/destroy; unref hanya pengaman agar proses tidak
      // pernah tertahan oleh timer ini saat shutdown.
      if (interval.unref) interval.unref();

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

      const {
        buildContainerV2,
      } = require("../utils/NauraContainerBuilder");
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
        title: `${ui.getEmoji("night") || "🌙"} Mode Siaga 24/7 Aktif`,
        description:
          `Naura sedang siaga di Voice Channel <#${player.voiceChannel}>.\n\n` +
          `> ${ui.getEmoji("naura_sleepy") || "💤"} **Status Stream:** Pasif (0kbps Bandwidth & 0% CPU Load)\n` +
          `> ${ui.getEmoji("music") || "🎵"} Putar lagu baru kapan saja dengan perintah \`/music play <judul/URL>\` atau gunakan tombol di bawah.`,
        expression: "sleepy",
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
