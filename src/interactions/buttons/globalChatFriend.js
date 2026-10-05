"use strict";

const { Op } = require("sequelize");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");
const UserFriend = require("../../models/UserFriend");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "gchat_add_",
    label: "global-chat-add-friend",
    defer: "reply",
    isEphemeral: true,
    async handler(interaction, client) {
      const targetUserId = interaction.customId.replace("gchat_add_", "").trim();
      const currentUserId = interaction.user.id;

      if (targetUserId === currentUserId) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Tidak Bisa Menambah Diri Sendiri",
            errorMessage:
              "Kamu tidak bisa menambahkan dirimu sendiri sebagai teman, hihi! Ayo cari teman baru di Global Chat!",
            expression: "shy",
          }),
        );
      }

      let targetUser = client?.users?.cache?.get(targetUserId);
      if (!targetUser) {
        targetUser = await client?.users?.fetch(targetUserId).catch(() => null);
      }
      const targetName = targetUser?.username || "Pengguna";

      try {
        const existing = await UserFriend.findOne({
          where: {
            [Op.or]: [
              { user1Id: currentUserId, user2Id: targetUserId },
              { user1Id: targetUserId, user2Id: currentUserId },
            ],
          },
        });

        if (existing) {
          if (existing.status === "accepted") {
            const payload = buildContainerV2({
              accentColorHex: ui.getColor("info") || "#38BDF8",
              title: "Sudah Berteman! 🤝",
              expression: "happy",
              description: `Kamu dan **${targetName}** sudah resmi berteman! Streak pertemanan kalian saat ini adalah **${existing.streak || 0}** hari.`,
              footerText: ui.getFooter("core"),
            });
            return interaction.editReply(payload);
          }

          if (existing.user1Id === currentUserId) {
            const payload = buildContainerV2({
              accentColorHex: ui.getColor("neutral") || "#64748B",
              title: "Permintaan Sudah Dikirim ⏳",
              expression: "info",
              description: `Kamu sudah mengirimkan permintaan pertemanan ke **${targetName}**. Tinggal menunggu balasan darinya!`,
              footerText: ui.getFooter("core"),
            });
            return interaction.editReply(payload);
          } else {
            // Target user had sent a request, now current user clicks to accept!
            existing.status = "accepted";
            existing.streak = Math.max(1, existing.streak || 1);
            existing.lastInteraction = new Date();
            await existing.save({ fields: ["status", "streak", "lastInteraction"] });

            const payload = buildContainerV2({
              accentColorHex: ui.getColor("success") || "#10B981",
              title: "Pertemanan Diterima! 🎉",
              expression: "celebrate",
              description: `Hore! Kamu telah menerima permintaan pertemanan dari **${targetName}**. Kalian sekarang resmi berteman di Naura Network!`,
              footerText: ui.getFooter("core"),
            });
            return interaction.editReply(payload);
          }
        }

        // Buat koneksi pertemanan baru
        await UserFriend.create({
          user1Id: currentUserId,
          user2Id: targetUserId,
          status: "accepted",
          streak: 1,
          lastInteraction: new Date(),
        });

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10B981",
          title: "Pertemanan Baru Terjalin! 🤝",
          expression: "celebrate",
          description: [
            `Selamat! Kamu dan **${targetName}** sekarang resmi berteman!`,
            "",
            "✨ Terus saling berinteraksi dan mengobrol di Global Chat untuk meningkatkan streak persahabatan kalian setiap hari!",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });

        return interaction.editReply(payload);
      } catch (err) {
        logger.error("[GlobalChatFriend] Gagal menambahkan teman: " + err.message);
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Menambahkan Teman",
            errorMessage:
              "Terjadi kesalahan saat memproses pertemanan. Silakan coba sesaat lagi.",
            expression: "sad",
          }),
        );
      }
    },
  },
];
