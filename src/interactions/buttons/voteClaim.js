"use strict";

const { MessageFlags } = require("discord.js");
const voteService = require("../../services/voteService");
const { checkTopggVote } = require("../../utils/topggApi");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "btn_vote_claim",
    label: "vote-claim",
    onError: "Terjadi kesalahan saat memproses klaim vote.",
    async handler(interaction, client) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const userId = interaction.user.id;
      const displayName =
        interaction.user.displayName || interaction.user.username;

      // 1. Cek Top.gg API bila token tersedia
      const checkRes = await checkTopggVote(userId);
      if (checkRes.ok && checkRes.voted === false) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            authorName: "Naura Vote System",
            title: "Belum Ada Vote Terdeteksi",
            errorMessage:
              `Halo Kak **${displayName}**! Naura belum menemukan catatan vote aktif dari akunmu di Top.gg dalam 12 jam terakhir.\n\n` +
              `Silakan klik tombol **Vote di Top.gg** terlebih dahulu, selesaikan vote, lalu klik tombol **Klaim Hadiah Vote** ini kembali ya! ✨`,
            expression: "shy",
          }),
        });
      }

      // 2. Berikan hadiah vote via voteService
      const isWeekend = voteService.isWeekend();
      const result = await voteService.processTopGgVote({ userId, isWeekend });

      if (!result.success && result.reason === "cooldown") {
        const nextTs = result.nextAt
          ? Math.floor(new Date(result.nextAt).getTime() / 1000)
          : Math.floor((Date.now() + 11 * 3600 * 1000) / 1000);
        return interaction.editReply({
          ...buildContainerV2({
            accentColorHex: ui.getColor("warning") || "#F59E0B",
            authorName: "Naura Vote Cooldown",
            title: "⏳ Hadiah Vote Sudah Diklaim",
            iconURL: client.user.displayAvatarURL(),
            description:
              `Halo Kak **${displayName}**! Kamu sudah mengklaim hadiah vote untuk periode ini.\n\n` +
              `🕒 **Vote Berikutnya Siap:** <t:${nextTs}:R>\n` +
              `- # *Kamu bisa melakukan vote kembali setiap 12 jam sekali di Top.gg untuk terus memperpanjang status VIP!*`,
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      if (!result.success) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            authorName: "Naura Vote System",
            title: "Gagal Mengklaim Hadiah",
            errorMessage: `Maaf Kak **${displayName}**, klaim vote tidak dapat diproses: ${result.reason || "terjadi gangguan teknis"}. Coba beberapa saat lagi ya!`,
            expression: "sad",
          }),
        });
      }

      // 3. Sukses klaim
      const couponEmoji = ui.getEmoji("coupon") || "🎟️";
      const coinEmoji = ui.getEmoji("coin") || "🪙";
      const expiryTs = result.expiry
        ? Math.floor(new Date(result.expiry).getTime() / 1000)
        : Math.floor((Date.now() + 12 * 3600 * 1000) / 1000);

      const descLines = [
        `Hai Kak **${displayName}**! Terima kasih banyak atas dukungan vote kamu untuk Naura di Top.gg!`,
        ``,
        `🎁 **HADIAH YANG KAMU DAPATKAN:**`,
        `✨ **Trial VIP Starter (12 Jam)**`,
        `${couponEmoji} **+${result.coupons} Naura Coupon** (Total: ${result.totalCoupons})`,
        `${coinEmoji} **+1.500 Naura Coins**`,
      ];

      if (result.isWeekend) {
        descLines.push(``, `⚡ **Weekend Astral Surge Aktif:** Bonus 2x Naura Coupons didapatkan!`);
      }

      if (result.trialDropped) {
        descLines.push(
          ``,
          `🎉 **LUCKY DROP ASTRAL SURGE!**`,
          `Kamu beruntung mendapatkan **🎟️ 1x Voucher VIP 1 Hari (Astral Surge)**!`,
          `Voucher telah otomatis disimpan ke inventaris. Gunakan lewat \`/survival consume\`!`,
        );
      }

      descLines.push(
        ``,
        `⏳ **Status VIP Aktif Sampai:** <t:${expiryTs}:F> (<t:${expiryTs}:R>)`,
        `🔥 **Streak Vote Saat Ini:** Ke-${result.streak || 1} (Hari ke-${result.daysStreak || 1})`,
        ``,
        `- # *Tips: Terus kumpulkan Naura Coupon untuk ditukarkan dengan armor & item langka di \`/rpg barter\`!*`,
      );

      return interaction.editReply({
        ...buildContainerV2({
          accentColorHex: ui.getColor("premium_voter") || "#F43F5E",
          authorName: "Naura Vote System",
          title: "🎉 Hadiah Vote Berhasil Diklaim!",
          iconURL: client.user.displayAvatarURL(),
          expression: "cheers",
          description: descLines.join("\n"),
          footerText: ui.getFooter("utility"),
        }),
      });
    },
  },
];
