"use strict";
const { SlashCommandBuilder } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const cacheManager = require("../managers/cacheManager");

const { applyAudioFilter, PREMIUM_FILTERS } = require("./audioFilters");
const premiumFilters = PREMIUM_FILTERS;

const applyLavalinkFilter = (player, filterType) => {
  return applyAudioFilter(player, filterType);
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
      const profile = await cacheManager.getUserProfile(interaction.user.id);
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

    if (client.musicManager?.updatePanelEmbed) {
      client.musicManager.updatePanelEmbed(player);
    }

    const payload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#FFB6C1",
      title: `${ui.getEmoji("tools") || "🎛️"} Filter Audio`,
      description: `${ui.getEmoji("tools") || "🎛️"} | Filter DSP Audio diubah ke: **${player.currentFilterName}**.`,
      footerText: ui.getFooter("music"),
    });

    return interaction.editReply(payload);
  },
};
