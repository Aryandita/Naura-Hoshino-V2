"use strict";

/**
 * 🤝 Partner Command - Community Partnership Program - Naura Hoshino V2
 * ----------------------------------------------------------------------
 * Displays information about Naura's server partnership program.
 * Shows benefits, requirements, and current active partners.
 *
 * Features:
 * - Partnership benefits overview
 * - Requirements and terms
 * - Active partner display
 * - Quick action buttons (Apply, Dashboard, Invite)
 * - Dynamic banner support
 *
 * @module plugin/core/subcommands/partner
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const ui = require("../../../src/config/ui");
const env = require("../../../src/config/env");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { e, LINKS } = require("../helpers/coreShared");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default text when no active partnership exists */
const NO_PARTNER_TEXT = "Belum ada kolaborasi";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format partner display name with fallback message.
 * @param {string} partnerName - Partner name from config
 * @returns {string} Formatted display text
 */
function formatPartnerDisplay(partnerName) {
  if (partnerName && partnerName !== NO_PARTNER_TEXT) {
    return `**${partnerName}**`;
  }
  return "*Belum ada kolaborasi aktif saat ini. Jadilah server partner pertama Naura!*";
}

/**
 * Build partnership action buttons row.
 * @returns {ActionRowBuilder} Button row component
 */
function buildPartnerButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Ajukan Partnership")
      .setURL(LINKS.SUPPORT)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("support", "💬")),
    new ButtonBuilder()
      .setLabel("Web Dashboard")
      .setURL(LINKS.DASHBOARD)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("dashboard", "🌐")),
    new ButtonBuilder()
      .setLabel("Invite Naura")
      .setURL(LINKS.INVITE)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("invite", "📩")),
  );
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle /core partner command execution.
 * Displays partnership program information and application links.
 * @param {object} interaction - Discord interaction
 * @param {object} client - Discord client
 * @param {object} lang - Language dictionary
 * @returns {Promise<void>}
 */
async function handlePartner(interaction, client, lang) {
  // Defer reply for processing
  if (interaction.deferReply && !interaction.deferred) {
    await interaction.deferReply();
  }

  // Get emojis
  const ePartner = e("handshake", "🤝");
  const eSparkle = e("sparkle", "✨");
  const eStar = e("star", "⭐");
  const eCheck = e("check", "✅");
  const dot = e("dot", "▶️");
  const eGuild = e("guilds", "🌐");

  // Get partner info
  const partnerName = env.PARTNERSHIP || NO_PARTNER_TEXT;
  const partnerDisplay = formatPartnerDisplay(partnerName);

  // Get banner
  const partnerBanner = ui.getBanner("about") || ui.getBanner("core");

  // Build action buttons
  const partnerButtons = buildPartnerButtons();

  // Build payload
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("info") || "#38BDF8",
    authorName: "Naura Community Partnership",
    title: `${ePartner} Program Partnership Server & Komunitas`,
    iconURL: client.user?.displayAvatarURL?.() || null,
    description:
      `Hai para pemilik dan pengurus server! Naura selalu terbuka buat menjalin kerja sama (Partnership) dengan komunitas kalian lho ${eSparkle}. Kita bisa saling bantu mempromosikan dan memajukan server secara sehat, aktif, dan harmonis!`,
    fields: [
      {
        name: `${eStar} BENEFIT PARTNERSHIP NAURA`,
        value:
          `> ${eCheck} **Promosi Jaringan Server:** Server kamu dipromosikan di jaringan komunitas resmi Naura.\n` +
          `> ${eCheck} **Fasilitas VIP Gratis:** Akses fitur VIP Premium gratis khusus untuk server partner aktif.\n` +
          `> ${eCheck} **Dukungan Prioritas:** Bantuan teknis & setup prioritas langsung dari tim Aryandita.`,
      },
      {
        name: `${eStar} SYARAT & KETENTUAN PARTNERSHIP`,
        value:
          `> ${eCheck} Memiliki minimal **100+ member aktif** di server Discord kamu.\n` +
          `> ${eCheck} Mematuhi Discord Terms of Service & Community Guidelines.\n` +
          `> ${eCheck} Memasang bot Naura Hoshino di server dan bersedia saling mempromosikan secara berkala.`,
      },
      {
        name: `${eGuild} DAFTAR PARTNER RESMI AKTIF`,
        value:
          `${dot} **Partner Saat Ini:** ${partnerDisplay}\n\n` +
          `Tertarik menjadi partner resmi Naura? Klik tombol **Ajukan Partnership** di bawah untuk bergabung ke Support Server dan membuka tiket kerja sama!`,
      },
    ],
    bannerAttachmentName: partnerBanner ? "banner.png" : null,
    buttonsRow: partnerButtons,
    footerText: ui.getFooter("partner"),
  });

  // Add banner attachment
  if (partnerBanner) {
    payload.files = [new AttachmentBuilder(partnerBanner, { name: "banner.png" })];
  }

  // Send response
  if (interaction.editReply) return interaction.editReply(payload);
  return interaction.reply(payload);
}

module.exports = handlePartner;
