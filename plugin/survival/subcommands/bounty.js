"use strict";

const outlawEngine = require("../../../src/survival/engines/outlawBountyEngine");
const duelEngine = require("../../../src/survival/engines/duelEngine");
const { buildContainerV2, buildErrorContainerV2, buildSuccessContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = {
  name: "bounty",
  description: "Papan Buronan & Sayembara Pemburu Kepala (PvP Wanted Board) di Naura Wilds",

  async execute(interaction) {
    const sub = interaction.options?.getSubcommand(false) || "list";
    const user = interaction.user;

    try {
      if (sub === "list") {
        const board = await outlawEngine.getWantedBoard();

        if (!board || board.length === 0) {
          const emptyPayload = buildContainerV2({
            accentColorHex: ui.getColor("info") || "#3B82F6",
            authorName: "NAURA WILDS WANTED BOARD",
            title: "🤠 Papan Buronan Kosong",
            description: [
              "Saat ini tidak ada buronan aktif yang kepalanya dihargai di Naura Wilds.",
              "",
              "Ingin menempatkan buronan atas pemain lain?",
              "Gunakan `/survival bounty place target:@user imbalan:<nsf> alasan:<alasan>`",
            ].join("\n"),
            footerText: ui.getFooter("survival"),
          });
          return interaction.editReply(emptyPayload);
        }

        const lines = board.map((b, idx) => {
          return `${idx + 1}. **<@${b.targetUserId}>**\n> 💰 Hadiah Kepala: **${b.rewardNsf.toLocaleString("id-ID")} NSF**\n> 📜 Alasan: *${b.reason}*\n> 🎯 Pemburu Pengaju: <@${b.issuerId}>`;
        });

        const listPayload = buildContainerV2({
          accentColorHex: "#EF4444",
          authorName: "NAURA WILDS WANTED BOARD",
          title: `☠️ Papan Buronan Teratas (${board.length} Buronan)`,
          description: [
            "Para buronan berikut dicari di seluruh pelosok rimba:",
            "",
            lines.join("\n\n"),
            "",
            "- # *Gunakan `/survival bounty hunt target:@user` untuk menantang dan merebut hadiah kepalanya!*",
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(listPayload);
      }

      if (sub === "place") {
        const target = interaction.options.getUser("target");
        const reward = interaction.options.getInteger("imbalan");
        const reason = interaction.options.getString("alasan") || "Dicari di alam liar Naura Wilds.";

        const result = await outlawEngine.placeOutlawBounty({
          issuerId: user.id,
          targetUserId: target.id,
          rewardNsf: reward,
          reason,
        });

        if (!result.success) {
          const errPayload = buildErrorContainerV2({
            title: "Gagal Menaruh Buronan",
            errorMessage: result.message,
            footerText: ui.getFooter("survival"),
          });
          return interaction.editReply(errPayload);
        }

        const successPayload = buildSuccessContainerV2({
          title: "☠️ Buronan Ditempatkan!",
          message: result.message,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(successPayload);
      }

      if (sub === "hunt") {
        const target = interaction.options.getUser("target");
        if (target.id === user.id) {
          const errPayload = buildErrorContainerV2({
            title: "Target Tidak Valid",
            errorMessage: "Kamu tidak bisa memburu dirimu sendiri!",
            footerText: ui.getFooter("survival"),
          });
          return interaction.editReply(errPayload);
        }

        const board = await outlawEngine.getWantedBoard();
        const bounty = board.find((b) => b.targetUserId === target.id);

        if (!bounty) {
          const errPayload = buildErrorContainerV2({
            title: "Bukan Buronan",
            errorMessage: `<@${target.id}> tidak memiliki status buronan di papan sayembara.`,
            footerText: ui.getFooter("survival"),
          });
          return interaction.editReply(errPayload);
        }

        // Jalankan pertarungan headhunt duel otomatis
        const duelResult = await duelEngine.runDuel(user, target);

        if (!duelResult.success) {
          const errPayload = buildErrorContainerV2({
            title: "Pengepungan Gagal",
            errorMessage: duelResult.reason || "Gagal memulai pertarungan pemburuan.",
            footerText: ui.getFooter("survival"),
          });
          return interaction.editReply(errPayload);
        }

        if (duelResult.winnerId === user.id) {
          // Hunter menang, klaim hadiah!
          const claimRes = await outlawEngine.claimOutlawBounty(user.id, target.id);

          const victoryPayload = buildContainerV2({
            accentColorHex: "#10B981",
            authorName: "PERBURUAN BURONAN BERHASIL",
            title: "⚔️ Buronan Berhasil Dilumpuhkan!",
            description: [
              `Kakak berhasil mengalahkan buronan <@${target.id}> dalam pertarungan sengit!`,
              "",
              `🎁 **Hadiah Kepala Dicairkan:** **+${claimRes.rewardNsf?.toLocaleString("id-ID")} NSF**!`,
              `> Sisa HP Pemburu: **${duelResult.winnerHp} HP**`,
              "",
              "- # *Nama buronan telah dihapus dari Wanted Outlaw Board.*",
            ].join("\n"),
            footerText: ui.getFooter("survival"),
          });
          return interaction.editReply(victoryPayload);
        } else {
          // Buronan lolos / hunter kalah
          const defeatPayload = buildContainerV2({
            accentColorHex: "#EF4444",
            authorName: "PERBURUAN BURONAN GAGAL",
            title: "☠️ Buronan Berhasil Melarikan Diri!",
            description: [
              `Buronan <@${target.id}> terlalu tangguh dan berhasil mengalahkanmu!`,
              "",
              `> Sisa HP Buronan: **${duelResult.winnerHp} HP**`,
              "Tingkatkan atribut dan perlengkapanmu sebelum menantangnya kembali!",
            ].join("\n"),
            footerText: ui.getFooter("survival"),
          });
          return interaction.editReply(defeatPayload);
        }
      }
    } catch (err) {
      const errPayload = buildErrorContainerV2({
        title: "Terjadi Kesalahan",
        errorMessage: "Gagal memproses aksi Papan Buronan.",
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply(errPayload).catch(() => {});
    }
  },
};
