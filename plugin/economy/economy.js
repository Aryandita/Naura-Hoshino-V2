"use strict";

/**
 * 💰 Economy Command Router - Server Economy System - Naura Hoshino V2
 * ---------------------------------------------------------------------
 * Main router for economy and market analysis commands.
 * Dynamically loads subcommands from subcommands/ directory.
 *
 * Features:
 * - Dynamic subcommand loading
 * - Economy trend analysis
 * - Market balancing recommendations
 *
 * Subcommands:
 * - /economy analyze : Analyze server economy trends and get balancing recommendations
 *
 * @module plugin/economy/economy
 */

const { SlashCommandBuilder } = require("discord.js");

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Perintah ekonomi dan analisis market")
    .addSubcommand((sub) =>
      sub
        .setName("analyze")
        .setDescription("Analisis tren ekonomi server dan rekomendasi balancing"),
    ),

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute economy command by dynamically loading subcommand.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<any>} Subcommand execution result
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const sub = require(`./subcommands/${subcommand}`);
    return sub.execute(interaction);
  },
};
