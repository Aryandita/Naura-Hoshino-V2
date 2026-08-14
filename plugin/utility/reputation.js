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
        title: "🌟 Status Reputasi",
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
        let prefix = `${i + 1}.`;
        if (i === 0) prefix = "🥇";
        if (i === 1) prefix = "🥈";
        if (i === 2) prefix = "🥉";

        list += `**${prefix}** <@${u.userId}>, **${u.reputation}** ${repEmoji}\n`;
      }

      const payload = buildContainerV2({
        accentColorHex: ui.colors.primary || "#FFD700",
        title: "🏆 Peringkat Reputasi Global",
        description: `Ini adalah pengguna dengan reputasi tertinggi yang sering membantu orang lain:\n\n${list}`,
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
            description: "Kamu tidak bisa memberikan reputasi kepada bot.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      if (target.id === interaction.user.id) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Tindakan Ditolak",
            description:
              "Kamu tidak bisa memberikan reputasi pada dirimu sendiri!",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      // Cooldown check
      const redis = require("../../src/managers/redisManager");
      const cooldownKey = `rep:cooldown:${interaction.user.id}`;
      const hasCooldown = await redis.get(cooldownKey);

      if (hasCooldown) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Kamu Sedang Cooldown",
            description:
              "Kamu hanya bisa memberikan reputasi setiap 1 jam sekali agar tidak terjadi eksploitasi poin.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      // Add rep point
      await UserProfile.findOrCreate({ where: { userId: target.id } });
      await UserProfile.increment("reputation", {
        by: 1,
        where: { userId: target.id },
      });

      // Clear cache for the target
      await cacheManager.delete(`profile:${target.id}`);

      // Set 1-hour cooldown
      await redis.setEx(cooldownKey, 3600, "1");

      const profile = await cacheManager.getUserProfile(target.id);
      const newRep = profile ? profile.reputation : 1;

      const payload = buildContainerV2({
        title: "Reputasi Diberikan!",
        description: `Terima kasih! Kamu telah memberikan 1 poin reputasi kepada <@${target.id}>! 💖\nSekarang ia memiliki total **${newRep}** ${repEmoji} Reputasi.`,
        authorName: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
        color: ui.getColor("success"),
        expression: "cheers",
        footerText: ui.getFooter("utility"),
      });

      await interaction.editReply(payload);

      // Auto-show leaderboard
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
          let medal = "🏅";
          if (i === 0) medal = "🥇";
          else if (i === 1) medal = "🥈";
          else if (i === 2) medal = "🥉";

          lbText += `${medal} <@${topUsers[i].userId}>, **${topUsers[i].reputation}** ${repEmoji}\n`;
        }

        await interaction.followUp(
          buildContainerV2({
            accentColorHex: ui.colors.primary || "#FFD700",
            title: "🌟 Kondisi Leaderboard Saat Ini",
            description: lbText,
            footerText: ui.getFooter("utility"),
            expression: "impressed",
          }),
        );
      }
      return;
    }
  },
};
