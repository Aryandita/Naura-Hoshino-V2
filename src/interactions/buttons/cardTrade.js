"use strict";

const { MessageFlags } = require("discord.js");
const redisManager = require("../../managers/redisManager");
const UserCard = require("../../models/UserCard");
const UserSurvival = require("../../models/UserSurvival");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { sequelize } = require("../../managers/dbManager");
const ui = require("../../config/ui");

module.exports = [{
  prefix: "card_trade_",
  label: "card-trade",
  async handler(interaction, client) {
    const customId = interaction.customId;
    const isAccept = customId.startsWith("card_trade_accept_");
    const isDecline = customId.startsWith("card_trade_decline_");
    if (!isAccept && !isDecline) return;

    const tradeId = customId.replace("card_trade_accept_", "").replace("card_trade_decline_", "");
    const tradeDataRaw = await redisManager.getCache(`card:trade:${tradeId}`);

    if (!tradeDataRaw) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Sesi Kadaluarsa",
          description: "Sesi barter kartu ini telah berakhir atau dibatalkan.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const trade = typeof tradeDataRaw === "string" ? JSON.parse(tradeDataRaw) : tradeDataRaw;

    if (interaction.user.id !== trade.targetUserId) {
      return interaction.reply({
        content: `${ui.getEmoji("error") || "❌"} Anda bukan penerima tawaran barter kartu ini.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (isDecline) {
      await redisManager.deleteCache(`card:trade:${tradeId}`);
      const payload = buildContainerV2({
        title: `${ui.getEmoji("flag_white") || "🏳️"} Tawaran Barter Ditolak`,
        description: `<@${trade.targetUserId}> telah menolak tawaran barter dari <@${trade.initiatorId}>.`,
        color: "#64748B",
      });
      return interaction.update({ ...payload, components: [] });
    }

    // Process Accept with Transaction
    try {
      const t = await sequelize.transaction();
      try {
        // 1. Verify cards
        const cardA = await UserCard.findOne({
          where: { cardCode: trade.initiatorCardCode, userId: trade.initiatorId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!cardA) {
          await t.rollback();
          return interaction.reply({
            content: `${ui.getEmoji("error") || "❌"} Kartu milik pengirim tawaran sudah tidak tersedia di inventory!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        let cardB = null;
        if (trade.targetCardCode) {
          cardB = await UserCard.findOne({
            where: { cardCode: trade.targetCardCode, userId: trade.targetUserId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (!cardB) {
            await t.rollback();
            return interaction.reply({
              content: `${ui.getEmoji("error") || "❌"} Kartumu sudah tidak tersedia di inventory!`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        // 2. Verify and transfer Star Fragments if offered
        if (trade.starFragmentsOffer > 0) {
          const survivalA = await UserSurvival.findOne({
            where: { userId: trade.initiatorId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (!survivalA || (survivalA.starFragments || 0) < trade.starFragmentsOffer) {
            await t.rollback();
            return interaction.reply({
              content: `${ui.getEmoji("error") || "❌"} Saldo Star Fragments pengirim tawaran tidak mencukupi!`,
              flags: MessageFlags.Ephemeral,
            });
          }

          survivalA.starFragments -= trade.starFragmentsOffer;
          await survivalA.save({ transaction: t, fields: ["starFragments"] });

          const [survivalB] = await UserSurvival.findOrCreate({
            where: { userId: trade.targetUserId },
            transaction: t,
          });
          survivalB.starFragments = (survivalB.starFragments || 0) + trade.starFragmentsOffer;
          await survivalB.save({ transaction: t, fields: ["starFragments"] });
        }

        // 3. Swap Card Ownerships
        cardA.userId = trade.targetUserId;
        await cardA.save({ transaction: t, fields: ["userId"] });

        if (cardB) {
          cardB.userId = trade.initiatorId;
          await cardB.save({ transaction: t, fields: ["userId"] });
        }

        await t.commit();
        await redisManager.deleteCache(`card:trade:${tradeId}`);

        const payload = buildContainerV2({
          title: `${ui.getEmoji("celebrate") || "🎉"} Transaksi Barter Kartu Sukses!`,
          description: `Selamat! Barter kartu antara <@${trade.initiatorId}> dan <@${trade.targetUserId}> telah selesai dengan aman!\n\n**Pertukaran:**\n- <@${trade.targetUserId}> menerima: **${cardA.characterName}** (\`${cardA.cardCode}\`)${trade.starFragmentsOffer > 0 ? ` + ${ui.getEmoji("star") || "⭐"} **${trade.starFragmentsOffer.toLocaleString()} NSF**` : ""}\n- <@${trade.initiatorId}> menerima: ${cardB ? `**${cardB.characterName}** (\`${cardB.cardCode}\`)` : "*Tanpa kartu tukar*"}`,
          color: "#10B981",
        });

        return interaction.update({ ...payload, components: [] });
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } catch (error) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Barter Gagal",
          errorMessage: `Terjadi kesalahan transaksi database: ${error.message}`,
        }),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
}];
