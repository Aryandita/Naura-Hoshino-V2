"use strict";

/**
 * 📢 Announce Command - Server Announcements - Naura Hoshino V2
 * --------------------------------------------------------------
 * Creates structured announcements with categories, images, and pin options.
 * Uses modal for content input to provide better UX.
 *
 * Features:
 * - 5 announcement categories with custom colors and emojis
 * - Image attachment support
 * - Role and @everyone mentions
 * - Optional message pinning
 * - Modal-based content input
 * - Permission validation
 *
 * Categories:
 * - update   : Pembaruan (Update)
 * - mt       : Perbaikan (Maintenance)
 * - event    : Acara (Event)
 * - warn     : Peringatan (Warning)
 * - info     : Informasi Umum
 *
 * @module plugin/admin/announce
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum character count for title + description */
const MAX_ANNOUNCEMENT_CHARS = 5500;

/** Modal timeout in milliseconds (5 minutes) */
const MODAL_TIMEOUT_MS = 300000;

/** Category configuration mapping */
const CATEGORY_CONFIG = {
  update: {
    emoji: "📢",
    label: "Pembaruan",
    colorKey: "announce_update",
  },
  mt: {
    emoji: "🛠️",
    label: "Pemeliharaan",
    colorKey: "announce_mt",
  },
  event: {
    emoji: "🎉",
    label: "Acara Komunitas",
    colorKey: "announce_event",
  },
  warn: {
    emoji: "⚠️",
    label: "Peringatan",
    colorKey: "announce_warn",
  },
  info: {
    emoji: "ℹ️",
    label: "Informasi Umum",
    colorKey: "announcement",
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get category configuration by key.
 * @param {string} kategori - Category key
 * @returns {{emoji: string, label: string, color: string}} Category config
 */
function getCategoryConfig(kategori) {
  const config = CATEGORY_CONFIG[kategori] || CATEGORY_CONFIG.info;
  return {
    emoji: config.emoji,
    label: config.label,
    color: ui.getColor(config.colorKey) || ui.getColor("primary"),
  };
}

/**
 * Build mention prefix string.
 * @param {boolean} mentionEveryone - Include @everyone
 * @param {object|null} mentionRole - Role object or null
 * @returns {string} Mention prefix with newlines
 */
function buildMentionPrefix(mentionEveryone, mentionRole) {
  const mentions = [];
  if (mentionEveryone) mentions.push("@everyone");
  if (mentionRole) mentions.push(`<@&${mentionRole.id}>`);
  return mentions.length > 0 ? `${mentions.join(" ")}\n\n` : "";
}

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription(
      "Kirim pengumuman terstruktur dengan kategori, gambar, dan opsi sematan.",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Pilih channel tujuan pengumuman")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("kategori")
        .setDescription("Pilih kategori pengumuman")
        .setRequired(true)
        .addChoices(
          { name: "Pembaruan (Update)", value: "update" },
          { name: "Perbaikan (Maintenance)", value: "mt" },
          { name: "Acara (Event)", value: "event" },
          { name: "Peringatan (Warning)", value: "warn" },
          { name: "Informasi Umum", value: "info" },
        ),
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("gambar")
        .setDescription("Unggah gambar pendukung pengumuman (opsional)")
        .setRequired(false),
    )
    .addRoleOption((opt) =>
      opt
        .setName("mention_role")
        .setDescription("Role yang ingin dimention (opsional)")
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("mention_everyone")
        .setDescription("Mention @everyone untuk pengumuman darurat")
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("pin")
        .setDescription("Sematkan pesan di channel tujuan (opsional)")
        .setRequired(false),
    ),

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute announce command.
   * Shows modal for content input, then sends formatted announcement.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Extract options
    const targetChannel = interaction.options.getChannel("channel");
    const kategori = interaction.options.getString("kategori");
    const attachment = interaction.options.getAttachment("gambar");
    const mentionRole = interaction.options.getRole("mention_role");
    const mentionEveryone = interaction.options.getBoolean("mention_everyone") || false;
    const shouldPin = interaction.options.getBoolean("pin") || false;

    // Validate bot permissions in target channel
    const botPermissions = targetChannel.permissionsFor(
      interaction.guild.members.me,
    );
    if (
      !botPermissions.has(PermissionFlagsBits.ViewChannel) ||
      !botPermissions.has(PermissionFlagsBits.SendMessages)
    ) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `Naura tidak memiliki izin melihat atau mengirim pesan di saluran <#${targetChannel.id}>.`,
          footerText: ui.getFooter("core"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    // Create and show modal for content input
    const modalId = `announceModal_${interaction.id}`;

    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle("Format Pengumuman");

    const titleInput = new TextInputBuilder()
      .setCustomId("announceTitle")
      .setLabel("Judul Pengumuman")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Tuliskan judul utama pengumuman...")
      .setMaxLength(256)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId("announceDesc")
      .setLabel("Isi Pesan")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Tuliskan detail pengumuman secara lengkap dan jelas...")
      .setMaxLength(4000)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
    );

    await interaction.showModal(modal);

    // Wait for modal submission
    const filter = (i) =>
      i.customId === modalId && i.user.id === interaction.user.id;

    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter,
        time: MODAL_TIMEOUT_MS,
      });

      // Extract modal values
      const title = modalSubmit.fields.getTextInputValue("announceTitle");
      const desc = modalSubmit.fields.getTextInputValue("announceDesc");

      // Validate character limit
      const embedCharCount = title.length + desc.length;
      if (embedCharCount > MAX_ANNOUNCEMENT_CHARS) {
        const errPayload = buildErrorContainerV2({
          title: "Karakter Melebihi Batas",
          description: `Jumlah teks judul dan deskripsi terlalu panjang (maksimum ${MAX_ANNOUNCEMENT_CHARS} karakter).`,
          footerText: ui.getFooter("core"),
        });
        return modalSubmit.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Get category configuration
      const catConfig = getCategoryConfig(kategori);
      const finalTitle = `${catConfig.emoji} ${title}`;

      // Prepare attachments
      const files = [];
      let bannerAttachmentName = null;
      if (attachment?.url) {
        files.push(attachment);
        bannerAttachmentName = attachment.name;
      }

      // Build mention prefix
      const mentionPrefix = buildMentionPrefix(mentionEveryone, mentionRole);
      const mentions = [];
      if (mentionEveryone) mentions.push("@everyone");
      if (mentionRole) mentions.push(`<@&${mentionRole.id}>`);

      // Build announcement payload
      const announcePayload = buildContainerV2({
        accentColorHex: catConfig.color,
        authorName: interaction.guild.name,
        title: finalTitle,
        description: `${mentionPrefix}${desc}`,
        bannerAttachmentName,
        files,
        footerText: `Pengumuman oleh ${interaction.user.tag}`,
      });

      // Send announcement to target channel
      try {
        const sentMessage = await targetChannel.send(announcePayload);

        // Pin message if requested
        if (shouldPin && sentMessage.pin) {
          await sentMessage.pin().catch((pinErr) => {
            logger.warn("[Announce] Failed to pin message:", pinErr.message);
          });
        }

        // Build success response
        const successFields = [
          { name: "Saluran Tujuan", value: `<#${targetChannel.id}>`, inline: true },
          { name: "Kategori", value: `${catConfig.emoji} ${catConfig.label}`, inline: true },
          { name: "Penyebutan", value: mentions.length > 0 ? mentions.join(", ") : "Tidak Ada", inline: true },
          { name: "Status Sematan", value: shouldPin ? "Ya (Disematkan)" : "Tidak", inline: true },
          { name: "Lampiran Gambar", value: attachment ? "Tersedia" : "Tidak Ada", inline: true },
        ];

        const successPayload = buildContainerV2({
          title: "Pengumuman Berhasil Diterbitkan",
          description: `Pengumuman telah dikirimkan ke saluran <#${targetChannel.id}>.`,
          fields: successFields,
          footerText: ui.getFooter("core"),
        });

        await modalSubmit.reply({
          ...successPayload,
          flags: MessageFlags.Ephemeral,
        });
      } catch (sendError) {
        logger.error("[Announce Send Error]:", sendError.message);
        await modalSubmit.reply({
          ...buildErrorContainerV2({
            title: "Pengiriman Gagal",
            description: "Pesan tidak dapat dikirim ke saluran target. Pastikan bot memiliki izin yang cukup.",
            footerText: ui.getFooter("core"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (err) {
      // Handle modal timeout or other errors
      if (err.code !== "InteractionCollectorError") {
        logger.error("[Announce Error]:", err);
      }
    }
  },
};
