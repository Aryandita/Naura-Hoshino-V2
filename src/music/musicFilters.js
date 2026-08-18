"use strict";
const { SlashCommandBuilder } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const UserProfile = require("../models/UserProfile");
const cacheManager = require("../managers/cacheManager");

const premiumFilters = ["nightcore", "vaporwave", "8d", "karaoke"];

const applyLavalinkFilter = (player, filterType) => {
  const apply = (payload, name) => {
    player.currentFilterName = name;
    if (player.node && player.node.rest) {
      player.node.rest.updatePlayer({
        guildId: player.guildId,
        data: { filters: payload },
      });
    }
  };

  switch (filterType) {
    case "clear":
      return apply({}, "Original Audio");
    case "bassboost":
      return apply(
        {
          equalizer: [
            { band: 0, gain: 0.6 },
            { band: 1, gain: 0.6 },
            { band: 2, gain: 0.4 },
          ],
        },
        "Sub-Bassboost",
      );
    case "nightcore":
      return apply(
        { timescale: { speed: 1.2, pitch: 1.2, rate: 1 } },
        "Nightcore Shift",
      );
    case "vaporwave":
      return apply(
        { timescale: { speed: 0.8, pitch: 0.8, rate: 1 } },
        "Vaporwave Reverb",
      );
    case "8d":
      return apply({ rotation: { rotationHz: 0.2 } }, "8D Surround");
    case "pop":
      return apply(
        { tremolo: { frequency: 2.0, depth: 0.5 } },
        "Pop / Tremolo",
      );
    case "karaoke":
      return apply(
        {
          karaoke: {
            level: 1.0,
            monoLevel: 1.0,
            filterBand: 220.0,
            filterWidth: 100.0,
          },
        },
        "Karaoke Mode",
      );
    default:
      return apply({}, "Original Audio");
  }
};

module.exports = {
  applyLavalinkFilter,
  premiumFilters,
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Ubah filter audio musik (DJ/Requester Only)")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Pilih filter DSP yang ingin digunakan")
        .setRequired(true)
        .addChoices(
          { name: "🚫 Clear (Normal)", value: "clear" },
          { name: "🔊 Bassboost", value: "bassboost" },
          { name: "🎶 Pop", value: "pop" },
          { name: "💎 Nightcore (VIP)", value: "nightcore" },
          { name: "💎 Vaporwave (VIP)", value: "vaporwave" },
          { name: "💎 8D Audio (VIP)", value: "8d" },
          { name: "💎 Karaoke (VIP)", value: "karaoke" },
        ),
    ),

  async execute(interaction, client) {
    await interaction.deferReply();
    const poru = client.musicManager?.poru;
    if (!poru) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Music System Offline",
          description: "Sistem musik saat ini sedang offline.",
          footerText: ui.getFooter("music"),
        }),
      );
    }

    const player = poru.players.get(interaction.guildId);
    if (!player || !player.currentTrack) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Tidak Ada Lagu",
          description: "Tidak ada lagu yang sedang diputar di server ini.",
          footerText: ui.getFooter("music"),
        }),
      );
    }

    const gSettings = await cacheManager.getGuildSettings(interaction.guildId);
    const djRoleId = gSettings?.music?.djRoleId;

    const isRequester =
      player.currentTrack?.info?.requester?.id === interaction.user.id;
    const isDJ =
      interaction.member.permissions.has("ManageChannels") ||
      (djRoleId && interaction.member.roles.cache.has(djRoleId)) ||
      interaction.member.roles.cache.some((r) => r.name.toLowerCase() === "dj");

    if (!isRequester && !isDJ) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `🛡️ | Hanya peminta lagu saat ini atau Staff (DJ) yang diizinkan untuk mengubah filter.`,
          footerText: ui.getFooter("music"),
        }),
      );
    }

    const filterType = interaction.options.getString("type");

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
            title: "💎 Fitur V.I.P Terkunci",
            description: `❌ | Filter **${filterType.toUpperCase()}** adalah fitur eksklusif Premium! Gunakan \`/premium\` untuk berlangganan.`,
            footerText: ui.getFooter("music"),
          }),
        );
      }
    }

    applyLavalinkFilter(player, filterType);

    if (client.musicManager?.updatePanelEmbed) {
      client.musicManager.updatePanelEmbed(player);
    }

    const payload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#FFB6C1",
      title: "🎛️ Filter Audio",
      description: `${ui.getEmoji("filter") || "🎛️"} | Filter DSP Audio diubah ke: **${player.currentFilterName}**.`,
      footerText: ui.getFooter("music"),
    });

    return interaction.editReply(payload);
  },
};
