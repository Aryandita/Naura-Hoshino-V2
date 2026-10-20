const { Op } = require("sequelize");
const { EmbedBuilder } = require("discord.js");
const ModMail = require("../../models/ModMail");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

module.exports = {
  name: "modmailCleanup",
  execute(client) {
    // ==========================================
    // 🧹 AUTO-CLEANUP MODMAIL TERBENGKALAI (48 JAM)
    // ==========================================
    // Rule 1.9: timer level-modul wajib unref agar tidak menahan proses
    // saat graceful shutdown.
    const cleanupTimer = setInterval(
      async () => {
        try {
          const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
          const abandonedTickets = await ModMail.findAll({
            where: {
              closed: false,
              updatedAt: { [Op.lt]: twoDaysAgo },
            },
          });

          for (const ticket of abandonedTickets) {
            const guild = client.guilds.cache.get(ticket.guildId);
            if (!guild) continue;
            const channel = guild.channels.cache.get(ticket.channelId);

            ticket.closed = true;
            // Rule 1.8: save dengan fields eksplisit agar tidak menimpa
            // kolom lain yang sedang diubah proses konkuren.
            await ticket.save({ fields: ["closed"] });

            if (ticket.userId && SNOWFLAKE_REGEX.test(String(ticket.userId))) {
              try {
                const user = await client.users.fetch(ticket.userId).catch(() => null);
                if (user) {
                  const embed = new EmbedBuilder()
                    .setColor("#FF0000")
                    .setTitle(
                      `🔒 ${ui.getEmoji("ticket") || "🎫"} Tiket Otomatis Ditutup`,
                    )
                    .setDescription(
                      `Tiketmu dengan **${guild.name}** telah ditutup otomatis karena tidak ada aktivitas selama 48 jam.`,
                    )
                    .setFooter({ text: ui.getFooter("utility") })
                    .setTimestamp();
                  await user.send({ embeds: [embed] }).catch(() => {});
                }
              } catch (e) {
                if (e?.code && [10008, 10013, 40060, 50027, 50013, 50007, 50035, 10062].includes(e.code)) {
                  // Intentional: Abaikan error siklus interaksi / izin Discord yang sudah diketahui
                } else {
                  logger.debug("[modmailCleanup:execute] Pemanggilan Discord API gagal: " + (e?.message || e));
                }
              }
            }

            if (channel) {
              await channel.send(
                "⏳ Tiket ditutup otomatis karena tidak ada aktivitas selama 48 jam. Channel akan dihapus dalam 10 detik.",
              );
              setTimeout(() => channel.delete().catch(() => {}), 10000);
            }
          }
        } catch (error) {
          logger.error("[MODMAIL CLEANUP ERROR]", error);
        }
      },
      60 * 60 * 1000,
    ); // Check every 1 hour
    if (cleanupTimer.unref) cleanupTimer.unref();
  },
};
