"use strict";

/**
 * @file messageCleanup.js
 * @description Handler interaksi tombol "Bersihkan (+5 NSF)" (customId: msg_cleanup).
 * Menghapus pesan di channel, membatalkan timer auto-delete, dan memberikan hadiah 5 NSF secara aman.
 */

const { MessageFlags } = require("discord.js");
const messageCleaner = require("../../utils/messageCleaner");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = {
  id: "msg_cleanup",
  prefix: "msg_clean_",
  label: "message-cleanup",
  defer: "reply",
  flags: MessageFlags.Ephemeral,

  async handler(interaction) {
    const message = interaction.message;
    if (!message) {
      return interaction.editReply({
        ...buildContainerV2({
          authorName: "Naura Cleaner System",
          title: "Pesan Tidak Ditemukan",
          description: "Pesan ini tampaknya sudah dihapus sebelumnya.",
          expression: "sleepy",
        }),
      });
    }

    // Ambil kunci proteksi race-condition
    const locked = messageCleaner.acquireLock(message.id);
    if (!locked) {
      return interaction.editReply({
        ...buildContainerV2({
          authorName: "Naura Cleaner System",
          title: "Sedang Dibersihkan",
          description: "Pesan ini sedang diproses untuk dihapus oleh pengguna lain.",
          expression: "sleepy",
        }),
      });
    }

    try {
      // Batalkan timer auto-delete jika ada
      messageCleaner.cancelAutoDelete(message.id);

      // Hapus pesan target dari channel
      await message.delete().catch(() => {});

      // Proses klaim hadiah kebersihan 5 NSF
      const claimResult = await messageCleaner.claimCleanupReward(interaction.user.id);

      let title = "Pesan Berhasil Dibersihkan";
      let desc = "Pesan sudah dirapikan dari channel.";
      let expression = "success";

      if (claimResult.success) {
        title = "Pesan Bersih! (+5 NSF)";
        desc =
          `Pesan berhasil dibersihkan dari channel!\n\n` +
          `> ${ui.getEmoji("sparkles") || "✨"} **Upah Kebersihan:** \`+5 NSF\` (Terkumpul: \`${claimResult.currentDaily}/50 NSF\` hari ini)\n` +
          `> 🧹 Terima kasih banyak sudah ikut menjaga kebersihan channel ya, Kak!`;
        expression = "happy";
      } else if (claimResult.reason === "DAILY_LIMIT_REACHED") {
        title = "Pesan Berhasil Dibersihkan";
        desc =
          `Pesan sudah dirapikan dari channel!\n\n` +
          `> ⚠️ **Batas Harian Tercapai:** Jatah hadiah kebersihanmu sudah maksimal (\`${claimResult.currentDaily}/50 NSF\` hari ini).\n` +
          `> 💖 Kebaikanmu menjaga channel tetap rapi sangat diapresiasi! Besok bisa klaim reward lagi yaa.`;
        expression = "smile";
      } else if (claimResult.reason === "COOLDOWN") {
        title = "Pesan Berhasil Dibersihkan";
        desc =
          `Pesan sudah dirapikan dari channel!\n\n` +
          `> ⏳ **Jeda Cooldown:** Tunggu sekitar \`${claimResult.waitSeconds || 10} detik\` sebelum bisa mendapatkan upah kebersihan berikutnya.`;
        expression = "sleepy";
      }

      return interaction.editReply({
        ...buildContainerV2({
          authorName: "Naura Environment Care",
          title,
          description: desc,
          expression,
          footerText: "Naura Hoshino Ecosystem • Lingkungan Bersih, Hati Nyaman ✨",
        }),
      });
    } finally {
      messageCleaner.releaseLock(message.id);
    }
  },
};
