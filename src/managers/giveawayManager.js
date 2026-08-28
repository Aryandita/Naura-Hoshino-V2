"use strict";

const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder,
} = require("discord.js");
const fs = require("node:fs");
const { logger } = require("../managers/logger");
const Giveaway = require("../models/Giveaway");
const ui = require("../config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../utils/NauraContainerBuilder");

// Jumlah max pemenang yang di-DM sekaligus sebelum diproses batch
const DM_BATCH_SIZE = 5;

class GiveawayManager {
  constructor(client) {
    this.client = client;
  }

  startChecking() {
    // Cek setiap 15 detik
    setInterval(() => this.checkGiveaways(), 15000).unref();
    logger.info("[Giveaway] Background checker aktif.");
  }

  async checkGiveaways() {
    try {
      const now = new Date();
      const activeGiveaways = await Giveaway.findAll({
        where: { ended: false },
      });

      for (const gw of activeGiveaways) {
        if (gw.endTime <= now) {
          await this.endGiveaway(gw).catch((err) =>
            logger.error(
              `[Giveaway] Gagal mengakhiri giveaway ${gw.messageId}: ${err.message}`,
            ),
          );
        }
      }
    } catch (err) {
      logger.error("[Giveaway] Gagal memeriksa giveaways:", err);
    }
  }

  /**
   * Akhiri giveaway: undi pemenang dari kolom participants, kirim DM.
   * @param {Giveaway} gwData - Baris Giveaway dari DB
   * @param {boolean} manualEnd - true bila dipaksa berakhir oleh admin
   * @param {string[]} excludeUserIds - userId yang dikecualikan dari undian (untuk re-roll)
   */
  async endGiveaway(gwData, manualEnd = false, excludeUserIds = []) {
    try {
      const guild = this.client.guilds.cache.get(gwData.guildId);
      if (!guild) {
        await gwData.update({ ended: true });
        return;
      }

      const channel = guild.channels.cache.get(gwData.channelId);
      const message = channel
        ? await channel.messages.fetch(gwData.messageId).catch(() => null)
        : null;

      // Ambil daftar peserta dari kolom DB (bukan dari emoji reaction)
      const allParticipants = Array.isArray(gwData.participants)
        ? gwData.participants
        : [];
      // Saring bot dan peserta yang dikecualikan (untuk re-roll)
      const eligible = allParticipants.filter(
        (id) => !excludeUserIds.includes(id),
      );

      let winnerIds = [];
      let winnerText = "*Tidak ada peserta yang memenuhi syarat.*";

      if (eligible.length > 0) {
        // Fisher-Yates shuffle untuk keadilan
        const shuffled = [...eligible].sort(() => Math.random() - 0.5);
        winnerIds = shuffled.slice(0, gwData.winnersCount);
        winnerText = winnerIds.map((id) => `<@${id}>`).join(", ");
      }

      const bannerPath =
        ui.getBanner("giveaway") ||
        "./assets/general/Giveaway & Event Banner.jpeg";
      const bannerName = "giveaway-end-banner.jpeg";
      const files = [];
      let bannerAttachmentName = null;

      if (fs.existsSync(bannerPath)) {
        files.push(new AttachmentBuilder(bannerPath, { name: bannerName }));
        bannerAttachmentName = bannerName;
      }

      // Bangun payload pesan giveaway berakhir
      const endPayload = buildContainerV2({
        accentColorHex: "#86EFAC",
        title: `🎊 Giveaway Berakhir: ${gwData.prize}`,
        description:
          `**Pemenang:** ${winnerText}\n` +
          `**Disponsori oleh:** <@${gwData.hostId}>\n` +
          `**Total peserta:** ${allParticipants.length} orang`,
        bannerAttachmentName,
        bannerPosition: "bottom",
        files,
        footerText: manualEnd ? "Diakhiri secara manual" : ui.getFooter("core"),
      });

      // Edit pesan giveaway bila masih ada
      if (message) {
        await message
          .edit({
            ...endPayload,
            components: [], // Hapus tombol "Ikut Giveaway"
          })
          .catch(() => {});

        // Announce pemenang di channel yang sama
        if (winnerIds.length > 0) {
          await channel
            .send({
              content: `Selamat untuk ${winnerText}! Kamu memenangkan **${gwData.prize}**! 🎉`,
            })
            .catch(() => {});
        }
      }

      // Update DB
      await gwData.update({
        ended: true,
        winners: winnerIds,
      });

      // Kirim DM notifikasi ke pemenang (secara batch)
      if (winnerIds.length > 0) {
        await this._sendWinnerDMs(winnerIds, gwData, guild);
      }
    } catch (error) {
      logger.error("[Giveaway] Error saat mengakhiri giveaway:", error);
    }
  }

  /**
   * Undi ulang pemenang baru dari peserta yang sama,
   * menghindari pemenang sebelumnya.
   * @param {Giveaway} gwData
   */
  async rerollGiveaway(gwData) {
    const previousWinners = Array.isArray(gwData.winners) ? gwData.winners : [];
    // Undi ulang menggunakan exclude list pemenang lama
    await this.endGiveaway(gwData, true, previousWinners);
  }

  /**
   * Kirim DM notifikasi ke daftar pemenang.
   * Gagal DM tidak menghentikan proses (DM pengguna bisa tertutup).
   */
  async _sendWinnerDMs(winnerIds, gwData, guild) {
    for (let i = 0; i < winnerIds.length; i += DM_BATCH_SIZE) {
      const batch = winnerIds.slice(i, i + DM_BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (userId) => {
          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            const dmPayload = buildContainerV2({
              accentColorHex: "#FFD700",
              title: "🏆 Kamu Menang Giveaway!",
              description:
                `Selamat ${member.user.username}! Kamu adalah salah satu pemenang giveaway di server **${guild.name}**.\n\n` +
                `**Hadiah:** ${gwData.prize}\n\n` +
                `Segera hubungi <@${gwData.hostId}> untuk mengklaim hadiahmu ya!`,
              footerText: `Giveaway ID: ${gwData.messageId}`,
            });

            await member.send(dmPayload).catch(() => {});
          } catch (err) {
            logger.warn(
              `[Giveaway] Gagal mengirim DM ke ${userId}: ${err.message}`,
            );
          }
        }),
      );
    }
  }

  /**
   * Buat payload tombol "Ikut Giveaway" untuk dikirim bersama pesan giveaway.
   */
  static buildJoinButton(messageId, participantCount = 0) {
    const button = new ButtonBuilder()
      .setCustomId(`giveaway_join:${messageId}`)
      .setLabel(
        `🎉 Ikut Giveaway${participantCount > 0 ? ` (${participantCount})` : ""}`,
      )
      .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder().addComponents(button);
  }
}

module.exports = GiveawayManager;
