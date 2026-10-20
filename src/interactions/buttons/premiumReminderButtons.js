"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "premium_renew_click",
    label: "premium-renew-click",
    onError: "Gagal memproses tombol perpanjangan VIP.",
    async handler(interaction, client) {
      const displayName = interaction.user.displayName || interaction.user.username;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Saweria (QRIS / GoPay / OVO)")
          .setStyle(ButtonStyle.Link)
          .setURL("https://saweria.co/naurahoshino"),
        new ButtonBuilder()
          .setLabel("Trakteer (QRIS / E-Wallet)")
          .setStyle(ButtonStyle.Link)
          .setURL("https://trakteer.id/naurahoshino"),
      );

      const container = buildContainerV2({
        accentColorHex: ui.getColor("premium") || "#EC4899",
        authorName: "Naura Hoshino VIP Lounge",
        title: "💎 Perpanjangan Status VIP Naura",
        iconURL: client.user.displayAvatarURL(),
        description: [
          `Halo Kak **${displayName}**! Terima kasih banyak telah mendukung pengembangan Naura Hoshino! ✨`,
          ``,
          `Untuk memperpanjang masa aktif VIP kamu:`,
          `1. Kunjungi salah satu portal donasi resmi kami di bawah (Saweria / Trakteer).`,
          `2. **Sangat Penting:** Masukkan Discord User ID kamu (\`${interaction.user.id}\`) pada pesan/catatan donasi.`,
          `3. Sistem Webhook Dual-Rail kami akan secara instan memverifikasi transaksi dan memperpanjang masa aktif VIP akunmu secara otomatis!`,
          ``,
          `*Pilihan Tier:*`,
          `• **VIP Starter (1 Bulan):** Rp 15.000`,
          `• **VIP Supporter (3 Bulan):** Rp 35.000`,
          `• **VIP Bestie (1 Tahun):** Rp 75.000`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({
        ...container,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    },
  },
  {
    id: "premium_benefits_info",
    label: "premium-benefits-info",
    onError: "Gagal memproses info keuntungan VIP.",
    async handler(interaction, client) {
      const container = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#6366F1",
        authorName: "Naura Hoshino VIP Lounge",
        title: "📋 Keuntungan Eksklusif Member VIP",
        iconURL: client.user.displayAvatarURL(),
        description: [
          `Berikut adalah daftar keuntungan eksklusif yang kamu nikmati sebagai Member VIP Naura:`,
          ``,
          `🤖 **Living AI Companion:** Obrolan AI tanpa batasan kuota harian dan akses ke semua Persona (Tsundere, Kuudere, Gamer, Butler).`,
          `🎙️ **Voice AI & DJ Greeting:** Sapaan suara khusus dari Naura (Fish Audio TTS) saat bot mulai memutar musik di voice channel.`,
          `🎨 **Canvas Social Flex:** Kartu profil eksklusif dengan bingkai neon hologram bercahaya, kilau bintang, dan stempel emas VIP.`,
          `📻 **Audio 24/7 Standby:** Mode standby non-stop untuk bot musik di server patron tanpa putus voice channel.`,
          `🎵 **Ekspansi Soundboard:** Batas kapasitas soundboard web bertambah hingga 50 slot suara kustom.`,
          `⚡ **Bonus RPG Survival:** Bonus multiplier perolehan Star Fragments dan kupon astral gacha.`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({
        ...container,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
