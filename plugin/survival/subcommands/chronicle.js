"use strict";

/**
 * @module chronicle
 * @description Subcommand /survival chronicle - Lore dan catatan dunia Naura Wilds.
 * 
 * Fitur Utama:
 * - Lore entry pagination
 * - Category-based filtering
 * - Unlock condition tracking
 */


const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
// ============================================================================
// CONSTANTS
// ============================================================================

const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");

const { defaultEventNarrator: narrator } = require("../../../src/services/worldEventNarrator");

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  name: "chronicle",
  description: "Generate narasi sinematik dari peristiwa server",

  /**
   * Handler utama untuk command /survival chronicle
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const userId = interaction.user.id;
    const eventType = interaction.options.getString("type") || "generic";
    const style = interaction.options.getString("style") || "epic";
    const location = interaction.options.getString("location") || "Naura Wilds";

    try {
      const participants = [interaction.user.displayName || interaction.user.username];

      const narration = await narrator.narrateWorldEvent(
        {
          type: eventType,
          participants,
          outcome: "success",
          location,
          userId,
        },
        style,
      );

      const payload = buildContainerV2({
        accentColorHex: survivalUI.getColor("amber"),
        authorName: "World Event Chronicle",
        title: `📜 ${narration.title}`,
        description: [
          `> _${narration.text}_`,
          "",
          `-# 🎭 Gaya Narasi: **${style.charAt(0).toUpperCase() + style.slice(1)}**`,
          `-# 📍 Lokasi: **${location}**`,
          `-# ⚔️ Tipe Event: **${eventType.replace(/_/g, " ").toUpperCase()}**`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, embeds: [] });
    } catch (error) {
      logger.error(`[Chronicle] Error for user ${userId}:`, error);
      const errorPayload = buildErrorContainerV2(
        "Gagal menghasilkan narasi. Silakan coba lagi.",
      );
      return interaction.editReply({ ...errorPayload, embeds: [] });
    }
  },
};
