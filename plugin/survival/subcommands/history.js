"use strict";

const mongoManager = require("../../../src/managers/mongoManager");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;

    try {
      let logs = [];
      if (mongoManager.isReady) {
        logs = await mongoManager.getCommandAuditLogs(
          { userId: user.id },
          10,
        );
      }

      if (!logs || logs.length === 0) {
        const emptyPayload = buildContainerV2({
          accentColorHex: ui.getColor("info") || "#38BDF8",
          authorName: "Naura Transaction Ledger",
          title: `${e("book", "📜")} Riwayat Aktivitas & Transaksi`,
          description: [
            `Halo <@${user.id}>! Belum ada catatan transaksi atau aktivitas yang tersimpan di buku kas audit.`,
            "",
            "-# 💡 *Catatan audit akan otomatis terbentuk saat kamu melakukan perintah survival, pasar lelang, barter, atau transfer saldo.*",
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return interaction.editReply({ ...emptyPayload, embeds: [] });
      }

      const logLines = logs.map((log, index) => {
        const dateStr = log.createdAt
          ? new Date(log.createdAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Waktu tidak diketahui";

        const statusEmoji =
          log.status === "SUCCESS"
            ? "✅"
            : log.status === "COOLDOWN"
              ? "⏳"
              : "❌";

        const cmd = log.commandName || "command";
        let detail = "";
        if (log.options && typeof log.options === "object") {
          const keys = Object.keys(log.options);
          if (keys.length > 0) {
            const entries = keys
              .slice(0, 3)
              .map((k) => `${k}: \`${log.options[k]}\``)
              .join(", ");
            detail = ` (${entries})`;
          }
        }

        return `**${index + 1}.** \`[${dateStr}]\` ${statusEmoji} **/${cmd}**${detail}`;
      });

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#8B5CF6",
        authorName: "Naura Audit Ledger",
        title: `${e("coin", "🪙")} 10 Aktivitas & Transaksi Terakhir`,
        description: [
          `Berikut adalah jejak audit aktivitas dan transaksi ekonomi untuk <@${user.id}>:`,
          "",
          logLines.join("\n"),
          "",
          "-# 🔒 *Semua transaksi ekonomi dan perintah tercatat secara permanen untuk integritas data.*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, embeds: [] });
    } catch (err) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Mengambil Riwayat",
        errorMessage:
          "Terjadi kendala saat membaca buku kas audit MongoDB. Coba lagi nanti ya!",
      });
      return interaction.editReply({ ...errPayload, embeds: [] });
    }
  },
};
