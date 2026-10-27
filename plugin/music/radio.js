"use strict";

/**
 * 📻 Radio Command - Virtual Radio DJ - Naura Hoshino V2
 * -------------------------------------------------------
 * Manages Naura's virtual radio station in voice channels.
 * Provides message queue, lo-fi mode, and radio status display.
 *
 * Subcommands:
 * - /radio status  : View current radio queue and presets
 * - /radio message : Send greeting/shout-out to radio
 * - /radio lofi    : Activate midnight lo-fi soundscape
 *
 * Features:
 * - Anonymous message support
 * - Message queue management
 * - Preset soundscape display
 * - Lo-Fi ambient mode toggle
 *
 * @module plugin/music/radio
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const radioService = require("../../src/services/radioService");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radio")
    .setDescription("📻 Naura Virtual Radio DJ & Voice Channel Companion")
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription(
          "Lihat status siaran radio Naura di Voice Channel saat ini",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("message")
        .setDescription(
          "Kirimkan titipan salam atau curhat ke stasiun radio Naura",
        )
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Isi pesan yang ingin dibacakan")
            .setRequired(true)
            .setMaxLength(180),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("anon")
            .setDescription("Kirim sebagai pengirim rahasia (anonim)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lofi")
        .setDescription(
          "Nyalakan mode Midnight Lo-Fi & Starlight Chill Soundscape",
        ),
    ),

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute radio command based on subcommand.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.user;
    const displayName =
      interaction.member?.displayName || user.displayName || user.username;
    const guildId = interaction.guildId;

    // Handle /radio status
    if (subcommand === "status") {
      await handleStatus(interaction, displayName, guildId);
      return;
    }

    // Handle /radio message
    if (subcommand === "message") {
      await handleMessage(interaction, displayName, guildId);
      return;
    }

    // Handle /radio lofi
    if (subcommand === "lofi") {
      await handleLofi(interaction, displayName);
      return;
    }
  },
};

// ============================================================================
// SUBCOMMAND HANDLERS
// ============================================================================

/**
 * Handle /radio status subcommand.
 * Displays current radio queue and available presets.
 * @param {object} interaction - Discord interaction
 * @param {string} displayName - User display name
 * @param {string} guildId - Guild ID
 * @returns {Promise<void>}
 */
async function handleStatus(interaction, displayName, guildId) {
  await interaction.deferReply();

  const pending = await radioService.getPendingRadioMessages(guildId);
  const presets = radioService.getPresets();

  // Format message queue
  const msgLines =
    pending.length > 0
      ? pending.map((m) => `• **${m.author}**: "${m.text}"`).join("\n")
      : "*Belum ada titipan salam di antrean radio.*";

  // Format preset list
  const presetLines = presets
    .map((p) => `• **${p.name}**\n  _${p.desc}_`)
    .join("\n");

  const payload = buildContainerV2({
    authorName: "NAURA VIRTUAL RADIO 2.1",
    title: "📻 Stasiun Radio Naura Hoshino Mengudara!",
    description: `Halo, **${displayName}**! Stasiun Radio Naura siap menemani sesi mengobrol dan belajar di Voice Channel dengan host AI yang ramah.\n\n🎙️ **Antrean Titipan Salam Radio:**\n${msgLines}\n\n🎧 **Preset Soundscape Santai:**\n${presetLines}\n\n> *Gunakan \`/radio message\` untuk mengirimkan salam atau curhatmu ke siaran live!*`,
    footerText: ui.getFooter("music"),
  });

  return interaction.editReply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Handle /radio message subcommand.
 * Queues a greeting or shout-out for radio broadcast.
 * @param {object} interaction - Discord interaction
 * @param {string} displayName - User display name
 * @param {string} guildId - Guild ID
 * @returns {Promise<void>}
 */
async function handleMessage(interaction, displayName, guildId) {
  await interaction.deferReply();

  const pesan = interaction.options.getString("pesan");
  const isAnon = interaction.options.getBoolean("anon") || false;

  // Queue the message
  const entry = await radioService.queueRadioMessage(
    guildId,
    displayName,
    pesan,
    isAnon,
  );

  const payload = buildContainerV2({
    authorName: "NAURA VIRTUAL RADIO 2.1",
    title: "💌 Titipan Salam Radio Berhasil Terkirim!",
    description: `Pesan dari **${entry.author}** telah masuk ke antrean siaran Radio Naura!\n\n> *"${entry.text}"*\n\n📻 *Naura akan membacakan pesan ini di Voice Channel pada jeda pergantian lagu berikutnya.*`,
    footerText: ui.getFooter("music"),
  });

  return interaction.editReply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Handle /radio lofi subcommand.
 * Activates midnight lo-fi ambient soundscape.
 * @param {object} interaction - Discord interaction
 * @param {string} displayName - User display name
 * @returns {Promise<void>}
 */
async function handleLofi(interaction, displayName) {
  await interaction.deferReply();

  const payload = buildContainerV2({
    authorName: "NAURA VIRTUAL RADIO 2.1",
    title: "🌧️ Midnight Lo-Fi & Starlight Chill Aktif!",
    description: `Suasana radio telah dialihkan ke gelombang santai **Midnight Lo-Fi & Rintik Hujan** untuk **${displayName}** dan seluruh kawan-kawan di server!\n\n☕ *Selamat bersantai, belajar, dan beristirahat di bawah naungan bintang kosmik.*`,
    footerText: ui.getFooter("music"),
  });

  return interaction.editReply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}
