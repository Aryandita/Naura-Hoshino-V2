"use strict";

const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { FILTER_PRESETS, applyAudioFilter } = require("../../music/audioFilters");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "sel_music_filter",
    label: "music-filter-select",
    onError: "Gagal menerapkan filter audio.",
    async handler(interaction, client) {
      const selectedFilter = interaction.values[0];
      const poru = client.poru;
      const player = poru?.players.get(interaction.guildId);

      if (!player) {
        const errPayload = buildErrorContainerV2({
          title: "Player Tidak Aktif",
          description: "Tidak ada musik yang sedang diputar di server ini.",
          footerText: ui.getFooter("music"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      applyAudioFilter(player, selectedFilter);

      const activePreset = FILTER_PRESETS.find((p) => p.value === selectedFilter) || {
        label: selectedFilter.toUpperCase(),
        emoji: "🎛️",
      };

      const filterSelect = new StringSelectMenuBuilder()
        .setCustomId("sel_music_filter")
        .setPlaceholder("Pilih Preset Filter Audio DSP...")
        .addOptions(
          FILTER_PRESETS.map((p) => ({
            label: p.label,
            value: p.value,
            description: p.description,
            emoji: p.emoji,
            default: p.value === selectedFilter,
          })),
        );

      const selectRow = new ActionRowBuilder().addComponents(filterSelect);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura DSP Studio Engine",
        title: "🎛️ Filter Audio Diperbarui!",
        description: [
          `Filter audio berhasil disetel ke **${activePreset.emoji} ${activePreset.label}**.`,
          "",
          `Gunakan menu di bawah untuk mengganti efek equalizer kapan saja secara instan.`,
        ].join("\n"),
        selectMenu: selectRow,
        footerText: ui.getFooter("music"),
      });

      return interaction.update(payload);
    },
  },
];
