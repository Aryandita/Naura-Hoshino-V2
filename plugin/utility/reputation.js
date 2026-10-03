"use strict";
const { SlashCommandBuilder } = require("discord.js");
const UserProfile = require("../../src/models/UserProfile");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { Op } = require("sequelize");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reputation")
    .setDescription("Sistem Reputasi Global")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check")
        .setDescription("Lihat poin reputasi milikmu atau orang lain")
        .addUserOption((option) =>
          option
            .setName("target")
            .setDescription("Pengguna yang ingin dicek")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("Lihat peringkat reputasi global"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("give")
        .setDescription(
          "Berikan 1 poin reputasi kepada orang lain yang telah membantu",
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Pengguna yang ingin diberi poin reputasi")
            .setRequired(true),
        ),
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const repEmoji = ui.getEmoji("star") || "⭐";

    if (subcommand === "check") {
      const target = interaction.options.getUser("target") || interaction.user;

      if (target.bot) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Bot Tidak Punya Reputasi",
            description: "Bot tidak tergabung dalam sistem reputasi ini.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      const profile = await cacheManager.getUserProfile(target.id);
      const rep = profile ? profile.reputation || 0 : 0;

      const payload = buildContainerV2({
        accentColorHex: ui.colors.primary || "#FFB6C1",
        title: `${ui.getEmoji("star") || "🌟"} Status Reputasi`,
        description: `<@${target.id}> memiliki **${rep}** ${repEmoji} Reputasi.\n\n-# *Reputasi didapatkan ketika seseorang mengucapkan terima kasih dan tag namamu.*`,
        footerText: ui.getFooter("utility"),
        expression: "happy",
      });

      return interaction.editReply(payload);
    } else if (subcommand === "leaderboard") {
      const topUsers = await UserProfile.findAll({
        order: [["reputation", "DESC"]],
        limit: 10,
        where: {
          reputation: {
            [Op.gt]: 0,
          },
        },
      });

      if (!topUsers || topUsers.length === 0) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Leaderboard Kosong",
            description: "Belum ada pengguna yang mendapatkan reputasi.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      let list = "";
      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        let prefix = `\`#${i + 1}\``;
        if (i === 0) prefix = "🥇";
        if (i === 1) prefix = "🥈";
        if (i === 2) prefix = "🥉";

        list += `${prefix} <@${u.userId}> • **${u.reputation.toLocaleString("id-ID")}** ${repEmoji}\n`;
      }

      const payload = buildContainerV2({
        accentColorHex: "#FBBF24",
        title: "Peringkat Reputasi Global",
        description: `Daftar anggota komunitas yang paling banyak memberikan kontribusi positif:\n\n${list}`,
        footerText: ui.getFooter("utility"),
        expression: "impressed",
      });

      return interaction.editReply(payload);
    } else if (subcommand === "give") {
      const target = interaction.options.getUser("user");

      if (target.bot) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Target Tidak Valid",
            description: "Kamu tidak dapat memberikan reputasi kepada bot.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      if (target.id === interaction.user.id) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Aksi Ditolak",
            description: "Kamu tidak dapat memberikan poin reputasi kepada diri sendiri.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      // Cooldown check via cacheManager/redis
      const redis = require("../../src/managers/redisManager");
      const cooldownKey = `rep:cooldown:${interaction.user.id}`;
      const hasCooldown = await redis.get(cooldownKey);

      if (hasCooldown) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Waktu Tunggu Aktif",
            description:
              "Kamu hanya dapat memberikan 1 poin reputasi setiap 1 jam sekali.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      // Add rep point secara atomik via cacheManager
      await cacheManager.incrementUserProfile(target.id, "reputation", 1);

      // Set 1-hour cooldown
      await redis.setEx(cooldownKey, 3600, "1");

      const profile = await cacheManager.getUserProfile(target.id);
      const newRep = profile ? profile.reputation : 1;

      const payload = buildContainerV2({
        title: "Poin Reputasi Diberikan",
        description: `Poin reputasi berhasil diberikan kepada <@${target.id}>.\nKini pengguna tersebut mengumpulkan **${newRep}** ${repEmoji} Reputasi.`,
        authorName: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
        accentColorHex: ui.getColor("success") || "#34D399",
        expression: "cheers",
        footerText: ui.getFooter("utility"),
      });

      await interaction.editReply(payload);

      // Ringkasan leaderboard top 5
      const topUsers = await UserProfile.findAll({
        order: [["reputation", "DESC"]],
        limit: 5,
        where: {
          reputation: {
            [Op.gt]: 0,
          },
        },
      });

      if (topUsers && topUsers.length > 0) {
        let lbText = "";
        for (let i = 0; i < topUsers.length; i++) {
          let medal = `\`#${i + 1}\``;
          if (i === 0) medal = "🥇";
          else if (i === 1) medal = "🥈";
          else if (i === 2) medal = "🥉";

          lbText += `${medal} <@${topUsers[i].userId}> • **${topUsers[i].reputation.toLocaleString("id-ID")}** ${repEmoji}\n`;
        }

        await interaction.followUp(
          buildContainerV2({
            accentColorHex: "#FBBF24",
            title: "Peringkat Teratas Komunitas",
            description: lbText,
            footerText: ui.getFooter("utility"),
            expression: "impressed",
          }),
        );
      }
    }
  },
};
