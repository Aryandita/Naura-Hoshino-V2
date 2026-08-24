"use strict";

const { MessageFlags } = require("discord.js");
const { grantVoteRewards } = require("../../../dashboard/utils/voteRewards");
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

      // 2. Berikan hadiah vote
      const isWeekend = [0, 6, 5].includes(new Date().getDay()); // Jum-Min
      const result = await grantVoteRewards(userId, { isWeekend });

      if (!result.ok && result.reason === "cooldown") {
        return interaction.editReply({
          ...buildContainerV2({
            accentColorHex: ui.getColor("warning") || "#F59E0B",
            authorName: "Naura Vote Cooldown",
            title: "⏳ Hadiah Vote Sudah Diklaim",
            iconURL: client.user.displayAvatarURL(),
            description:
              `Halo Kak **${displayName}**! Kamu sudah mengklaim hadiah vote untuk periode ini.\n\n` +
              `🕒 **Vote Berikutnya Siap:** <t:${Math.floor(result.nextAt.getTime() / 1000)}:R>\n` +
              `- # *Kamu bisa melakukan vote kembali setiap 12 jam sekali di Top.gg untuk terus memperpanjang status V.I.P!*`,
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      // 3. Sukses klaim
      const couponEmoji = ui.getEmoji("coupon") || "🎟️";
      const coinEmoji = ui.getEmoji("coin") || "🪙";

      return interaction.editReply({
        ...buildContainerV2({
          accentColorHex: ui.getColor("premium_voter") || "#F43F5E",
          authorName: "🌸 Makasih Sudah Vote Naura!",
          title: "🎉 Hadiah Vote Berhasil Diklaim!",
          iconURL: client.user.displayAvatarURL(),
          description:
            `Hai Kak **${displayName}**! Terima kasih banyak atas dukungan vote kamu untuk Naura di Top.gg!\n\n` +
            `🎁 **HADIAH YANG KAMU DAPATKAN:**\n` +
            `✨ **Trial V.I.P Premium (12 Jam)**\n` +
            `${couponEmoji} **+${result.coupons} Naura Coupon** (Total: ${result.totalCoupons})\n` +
            `${coinEmoji} **+1.500 Naura Coins**\n\n` +
            `⏳ **Status V.I.P Aktif Sampai:** <t:${Math.floor(result.expiry.getTime() / 1000)}:R>\n` +
            `🔥 **Streak Vote Saat Ini:** Ke-${result.streak} (Hari ke-${result.daysStreak || 1})\n\n` +
            `- # *Tips: Terus kumpulkan Naura Coupon untuk ditukarkan dengan armor & item langka di \`/rpg barter\`!*`,
          footerText: ui.getFooter("utility"),
        }),
      });
    },
  },
];
