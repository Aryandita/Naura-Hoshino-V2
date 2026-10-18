"use strict";

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

async function handlePartner(interaction, client, lang) {
  if (interaction.deferReply && !interaction.deferred) {
    await interaction.deferReply();
  }

  const ePartner = e("handshake", "\uD83E\uDD1D");
  const eSparkle = e("sparkle", "\u2728");
  const eStar = e("star", "\u2B50");
  const eCheck = e("check", "\u2705");
  const dot = e("dot", "\u25B6\uFE0F");
  const eGuild = e("guilds", "\uD83C\uDF10");

  const partnerName = env.PARTNERSHIP || "Belum ada kolaborasi";
  const partnerDisplay =
    partnerName && partnerName !== "Belum ada kolaborasi"
      ? `**${partnerName}**`
      : "*Belum ada kolaborasi aktif saat ini. Jadilah server partner pertama Naura!*";

  const partnerBanner = ui.getBanner("about") || ui.getBanner("core");

  const partnerButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Ajukan Partnership")
      .setURL(LINKS.SUPPORT)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("support", "\uD83D\uDCAC")),
    new ButtonBuilder()
      .setLabel("Web Dashboard")
      .setURL(LINKS.DASHBOARD)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("dashboard", "\uD83C\uDF10")),
    new ButtonBuilder()
      .setLabel("Invite Naura")
      .setURL(LINKS.INVITE)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("invite", "\uD83D\uDCE9")),
  );

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

  if (partnerBanner) {
    payload.files = [
      new AttachmentBuilder(partnerBanner, { name: "banner.png" }),
    ];
  }

  if (interaction.editReply) return interaction.editReply(payload);
  return interaction.reply(payload);
}

module.exports = handlePartner;
