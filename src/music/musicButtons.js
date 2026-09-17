/* eslint-disable no-unreachable */
const { MessageFlags } = require("discord.js");
// Lokasi: src/events/interactions/musicButtons.js
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const UserProfile = require("../models/UserProfile");
const LyricsManager = require("../music/LyricsManager"); // 👈 Memanggil mesin lirik baru

const DEFAULT_EMOJIS = {
  nowplaying: "<a:DiscSpinner1:1492696912145678488>",
  favorite: "<a:SpinHeart:1492696848643915796>",
  filter: "<:Filter:1484705994020753529>",
  musicPlayPause: "<:PlayPause:1484705975998091375>",
  musicSkip: "<:Skip:1484705981152755712>",
  musicStop: "<:Stop:1484705983778525315>",
  musicLoop: "<:Loop:1484705967991034010>",
  musicVolDown: "<:VolumeDown:1484874588524646621>",
  musicVolUp: "<:VolumeUp:1484874537110864034>",
  musicAutoplay: "<:AutoPlay:1484705985980268744>",
  musicLyrics: "<:Lyrics:1484705972919337070>",
  musicShuffle: "<:Shuffle:1484705970469867641>",
  music247: "<a:Moon:1492696850602524682>",
};

const getEmoji = (name) => {
  if (ui && ui.getEmoji) {
    const e = ui.getEmoji(name);
    if (e) return e;
  }
  return DEFAULT_EMOJIS[name] || "🎵";
};

const safeStopTrack = (player) => {
  if (!player) return;
  if (typeof player.stopTrack === "function") player.stopTrack();
  else if (player.node && player.node.rest)
    player.node.rest
      .updatePlayer({
        guildId: player.guildId,
        data: { track: { encoded: null } },
      })
      .catch(() => {});
};

module.exports = async (interaction, client) => {
  const poru = client.musicManager.poru;
  const player = poru.players.get(interaction.guildId);
  if (interaction.customId !== "music_lyrics") {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
      return;
    }
  }

  // Handle Select Menus
  if (interaction.isStringSelectMenu()) {
    switch (interaction.customId) {
      case "music_recommendation":
        const trackUri = interaction.values[0];
        try {
          const res = await poru.resolve({
            query: trackUri,
            requester: interaction.user,
          });
          if (res && res.tracks && res.tracks.length > 0) {
            const addedTrack = res.tracks[0];
            player.queue.add(addedTrack);
            if (!player.isPlaying && !player.isPaused) player.play();

            // Bersihkan track yang sudah dipilih dari rekomendasi
            if (Array.isArray(player.recommendedTracks)) {
              player.recommendedTracks = player.recommendedTracks.filter(
                (t) =>
                  t.info?.uri !== trackUri &&
                  t.info?.identifier !== addedTrack.info?.identifier,
              );
            }
            if (Array.isArray(player.autoplayQueue)) {
              player.autoplayQueue = player.autoplayQueue.filter(
                (t) =>
                  t.info?.uri !== trackUri &&
                  t.info?.identifier !== addedTrack.info?.identifier,
              );
            }
            if (
              player.prefetchedAutoplayTrack?.info?.identifier ===
              addedTrack.info?.identifier
            ) {
              player.prefetchedAutoplayTrack =
                player.autoplayQueue?.shift() || null;
            }

            // Perbarui panel Now Playing
            if (client.musicManager?.updatePanelEmbed) {
              client.musicManager.updatePanelEmbed(player);
            }

            return interaction
              .editReply(
                buildContainerV2({
                  description: `${getEmoji("nowplaying")} | Trek **[${addedTrack.info.title}](${addedTrack.info.uri})** berhasil dimasukkan ke antrean!`,
                  footerText: ui.getFooter("music"),
                }),
              )
              .catch(() => {});
          }
        } catch (e) {
          return interaction
            .editReply(
              buildErrorContainerV2({
                description: "❌ | Gagal memuat trek rekomendasi.",
                footerText: ui.getFooter("music"),
              }),
            )
            .catch(() => {});
        }
        return;

      case "music_filter":
        const cacheManager = require("../managers/cacheManager");
        const gSettings = await cacheManager.getGuildSettings(
          interaction.guildId,
        );
        const djRoleId = gSettings?.music?.djRoleId;

        const isRequester =
          player.currentTrack?.info?.requester?.id === interaction.user.id;
        const isDJ =
          interaction.member.permissions.has("ManageChannels") ||
          (djRoleId && interaction.member.roles.cache.has(djRoleId)) ||
          interaction.member.roles.cache.some(
            (r) => r.name.toLowerCase() === "dj",
          );

        if (!isRequester && !isDJ) {
          return interaction.editReply(
            buildErrorContainerV2({
              description: `🛡️ | Hanya peminta lagu saat ini atau Staff (DJ) yang diizinkan.`,
              footerText: ui.getFooter("music"),
            }),
          );
        }

        const {
          applyLavalinkFilter,
          premiumFilters,
        } = require("./musicFilters");
        const filterType = interaction.values[0];

        if (premiumFilters.includes(filterType)) {
          const [profile] = await UserProfile.findOrCreate({
            where: { userId: interaction.user.id },
          });
          if (
            !profile.isPremium ||
            !profile.premiumUntil ||
            profile.premiumUntil <= new Date()
          ) {
            return interaction.editReply(
              buildErrorContainerV2({
                title: `${ui.getEmoji("vip") || "💎"} Fitur V.I.P Terkunci`,
                description: `❌ | Filter **${filterType.toUpperCase()}** adalah fitur eksklusif Premium! Gunakan \`/premium\` untuk berlangganan.`,
                footerText: ui.getFooter("music"),
              }),
            );
          }
        }

        applyLavalinkFilter(player, filterType);
        client.musicManager.updatePanelEmbed(player);
        return interaction.editReply(
          buildContainerV2({
            description: `${getEmoji("filter")} | Filter DSP Audio diubah ke: **${player.currentFilterName}**.`,
            footerText: ui.getFooter("music"),
          }),
        );
    }
    return;
  }

  // Permissions check for buttons
  const cacheManager = require("../managers/cacheManager");
  const gSettingsBtn = await cacheManager.getGuildSettings(interaction.guildId);
  const djRoleIdBtn = gSettingsBtn?.music?.djRoleId;

  const isRequester =
    player.currentTrack?.info?.requester?.id === interaction.user.id;
  const isDJ =
    interaction.member.permissions.has("ManageChannels") ||
    (djRoleIdBtn && interaction.member.roles.cache.has(djRoleIdBtn)) ||
    interaction.member.roles.cache.some((r) => r.name.toLowerCase() === "dj");
  const requiresDJ = [
    "music_stop",
    "music_skip",
    "music_pause",
    "music_247",
    "music_autoplay",
    "music_loop",
    "music_shuffle",
    "music_lyrics",
  ];

  if (requiresDJ.includes(interaction.customId) && !isRequester && !isDJ) {
    // Khusus music_lyrics, karena belum di-defer, kita gunakan reply() bukan editReply()
    if (interaction.customId === "music_lyrics") {
      return ui.sendError(interaction, "err_sys_16", true);
    }
    return ui.sendError(interaction, "err_sys_17");
  }

  // Handle Buttons using Switch-Case
  switch (interaction.customId) {
    case "music_save":
      try {
        const [userProfile] = await UserProfile.findOrCreate({
          where: { userId: interaction.user.id },
        });
        if (!player.currentTrack || !player.currentTrack.info)
          return interaction.editReply(
            buildErrorContainerV2({
              description: `❌ | Tidak ada data trek valid.`,
              footerText: ui.getFooter("music"),
            }),
          );

        const savedData = `${player.currentTrack.info.title} | ${player.currentTrack.info.uri}`;
        const rawPl = userProfile.music_playlist;
        const playlist = Array.isArray(rawPl)
          ? rawPl
          : typeof rawPl === "string"
            ? (() => {
                try {
                  return JSON.parse(rawPl);
                } catch (e) {
                  return [];
                }
              })()
            : [];

        if (!playlist.includes(savedData)) {
          playlist.push(savedData);
          userProfile.music_playlist = playlist;
          userProfile.changed("music_playlist", true);
          await userProfile.save({ fields: ["music_playlist"] });
          const payload = buildContainerV2({
            accentColorHex: "#22c55e",
            title: "Lagu Difavoritkan",
            description: `${getEmoji("favorite")} | **${player.currentTrack.info.title}** ditambahkan ke Naura Playlist!`,
            footerText: ui.getFooter("music"),
          });
          return interaction.editReply(payload);
        } else {
          const errPayload = buildErrorContainerV2({
            title: "Sudah Ada",
            description: "⚠️ | Lagu ini sudah ada di daftar favorit Anda.",
            footerText: ui.getFooter("music"),
          });
          return interaction.editReply(errPayload);
        }
      } catch (e) {
        const errPayload = buildErrorContainerV2({
          title: "DB Error",
          description: "❌ | Gagal sinkronisasi DB.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }
      break;

    case "music_lyrics": {
      const [profile] = await UserProfile.findOrCreate({
        where: { userId: interaction.user.id },
      });
      if (
        !profile.isPremium ||
        !profile.premiumUntil ||
        profile.premiumUntil <= new Date()
      ) {
        return ui.sendError(interaction, "err_sys_18", true);
      }

      if (!player.currentTrack || !player.currentTrack.info) {
        return ui.sendError(interaction, "err_sys_19", true);
      }

      const lyricsEngine = new LyricsManager(client);
      // Panggil sendLyrics. Parameter kelima (false) akan membuatnya jadi publik!
      await lyricsEngine.sendLyrics(
        interaction,
        client.musicManager,
        player,
        player.currentTrack,
        false,
      );
      break;
    }

    case "music_autoplay": {
      const [profile] = await UserProfile.findOrCreate({
        where: { userId: interaction.user.id },
      });
      if (
        !profile.isPremium ||
        !profile.premiumUntil ||
        profile.premiumUntil <= new Date()
      ) {
        return ui.sendError(interaction, "err_sys_20", true);
      }
      player.isAutoplayMode = !player.isAutoplayMode;
      if (player.isAutoplayMode) player.setLoop("NONE");
      client.musicManager.updatePanelEmbed(player);
      return interaction.editReply(
        buildContainerV2({
          description: `${getEmoji("musicAutoplay")} | Autoplay AI **${player.isAutoplayMode ? "DIAKTIFKAN" : "DIMATIKAN"}**.`,
          footerText: ui.getFooter("music"),
        }),
      );
    }

    case "music_shuffle":
      player.queue.shuffle();
      client.musicManager.updatePanelEmbed(player);
      return interaction.editReply(
        buildContainerV2({
          description: `${getEmoji("musicShuffle")} | Antrean berhasil diacak (shuffled)!`,
          footerText: ui.getFooter("music"),
        }),
      );

    case "music_loop":
      const modes = { NONE: "TRACK", TRACK: "QUEUE", QUEUE: "NONE" };
      player.setLoop(modes[player.loop] || "NONE");
      if (player.loop !== "NONE") player.isAutoplayMode = false;
      client.musicManager.updatePanelEmbed(player);
      const modeNames = {
        NONE: "Nonaktif",
        TRACK: "Ulangi 1 Trek",
        QUEUE: "Ulangi Seluruh Antrean",
      };
      return interaction.editReply(
        buildContainerV2({
          description: `${getEmoji("musicLoop")} | Looping diatur ke: **${modeNames[player.loop]}**.`,
          footerText: ui.getFooter("music"),
        }),
      );

    case "music_247": {
      const UserProfile = require("../models/UserProfile");
      const GuildSettings = require("../models/GuildSettings");
      const [profile] = await UserProfile.findOrCreate({
        where: { userId: interaction.user.id },
      });
      const guildSettings = await GuildSettings.findOne({
        where: { guildId: interaction.guildId },
      });

      const isUserVip =
        profile?.isPremium &&
        profile?.premiumUntil &&
        new Date(profile.premiumUntil) > new Date();
      const isGuildVip =
        guildSettings?.isPremium || guildSettings?.settings?.isPremium;
      const env = require("../config/env");
      const isOwner = env.OWNER_IDS.includes(interaction.user.id);

      if (!isUserVip && !isGuildVip && !isOwner) {
        return ui.sendError(interaction, "err_sys_21", true);
      }

      player.is247 = !player.is247;

      try {
        const [guildData] = await GuildSettings.findOrCreate({
          where: { guildId: interaction.guildId },
        });
        const musicData = guildData.music || {};
        musicData.twentyFourSeven = player.is247;
        musicData.voiceChannel = player.is247 ? player.voiceChannel : null;
        musicData.textChannel = player.is247 ? player.textChannel : null;
        guildData.music = musicData;
        guildData.changed("music", true);
        await guildData.save({ fields: ["music"] });
        cacheManager.invalidateGuildSettings(interaction.guildId);
      } catch (e) {}

      if (player.is247) {
        if (!player.currentTrack && !player.isPlaying) {
          player.isIdle247 = true;
          const MusicUIManager = require("../music/MusicUIManager");
          await MusicUIManager.renderIdle247Panel(client.musicManager, player);
        } else {
          client.musicManager.updatePanelEmbed(player);
        }
      } else {
        player.isIdle247 = false;
        client.musicManager.updatePanelEmbed(player);
      }

      return interaction.editReply(
        buildContainerV2({
          description: `${getEmoji("music247")} | Mode Siaga 24/7 **${player.is247 ? "DIAKTIFKAN" : "DIMATIKAN"}**.`,
          footerText: ui.getFooter("music"),
        }),
      );
    }

    case "music_voldown":
      player.setVolume(Math.max(10, player.volume - 10));
      client.musicManager.updatePanelEmbed(player);
      return interaction.editReply(
        buildContainerV2({
          description: `${getEmoji("musicVolDown")} | Volume diturunkan ke **${player.volume}%**.`,
          footerText: ui.getFooter("music"),
        }),
      );

    case "music_volup":
      player.setVolume(Math.min(100, player.volume + 10));
      client.musicManager.updatePanelEmbed(player);
      return interaction.editReply(
        buildContainerV2({
          description: `${getEmoji("musicVolUp")} | Volume dinaikkan ke **${player.volume}%**.`,
          footerText: ui.getFooter("music"),
        }),
      );

    case "music_pause":
      player.pause(!player.isPaused);
      client.musicManager.updatePanelEmbed(player);
      return interaction.editReply(
        buildContainerV2({
          description: `${getEmoji("musicPlayPause")} | Transmisi audio **${player.isPaused ? "DIJEDA" : "DILANJUTKAN"}**.`,
          footerText: ui.getFooter("music"),
        }),
      );

    case "music_skip": {
      const voiceChannel = interaction.member?.voice?.channel;
      const listeners = voiceChannel
        ? voiceChannel.members.filter((m) => !m.user.bot).size
        : 1;

      player.skipVotes = player.skipVotes || new Set();
      player.skipVotes.add(interaction.user.id);

      const requiredVotes = Math.max(1, Math.ceil(listeners / 2));
      const isRequester =
        player.currentTrack?.info?.requester?.id === interaction.user.id;

      if (
        listeners <= 1 ||
        isRequester ||
        player.skipVotes.size >= requiredVotes
      ) {
        player.skipVotes.clear();
        safeStopTrack(player);
        return interaction.editReply(
          buildContainerV2({
            description: `${getEmoji("musicSkip")} | Melewati trek saat ini. Bersiap memutar selanjutnya...`,
            footerText: ui.getFooter("music"),
          }),
        );
      } else {
        return interaction.editReply(
          buildContainerV2({
            description: `${getEmoji("musicSkip")} | Vote skip dicatat (**${player.skipVotes.size}/${requiredVotes}** suara dari pendengar).`,
            footerText: ui.getFooter("music"),
          }),
        );
      }
    }

    case "music_stop": {
      player.queue.clear();
      if (player.is247) {
        player.isIdle247 = true;
        safeStopTrack(player);
        const MusicUIManager = require("../music/MusicUIManager");
        await MusicUIManager.renderIdle247Panel(client.musicManager, player);
        return interaction.editReply(
          buildContainerV2({
            description: `${getEmoji("music247")} | Musik dihentikan. Mode 24/7 aktif (Siaga Pasif 0kbps).`,
            footerText: ui.getFooter("music"),
          }),
        );
      } else {
        player.is247 = false;
        player.destroy();
        return interaction.editReply(
          buildErrorContainerV2({
            description: `${getEmoji("musicStop")} | Transmisi dihentikan. Naura pamit dari Voice Channel.`,
            footerText: ui.getFooter("music"),
          }),
        );
      }
    }
  }
};
