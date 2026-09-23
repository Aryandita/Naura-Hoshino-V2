"use strict";

const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const worldBossEngine = require("../../../src/survival/engines/worldBossEngine");
const petActions = require("../../../src/survival/helpers/petActions");
const UserPet = require("../../../src/models/UserPet");
const { drawBossCard } = require("../../../src/canvas/bossCanvas");

module.exports = {
  name: "raid",
  description:
    "Ikuti pertempuran World Boss 2.0 Global bersama seluruh petualang!",

  async execute(interaction, context) {
    const action = interaction.options.getString("aksi") || "status";
    const userId = interaction.user.id;

    if (action === "leaderboard") {
      const topSurvivors = await worldBossEngine.getAllTimeLeaderboard(10);
      if (topSurvivors.length === 0) {
        const emptyPayload = buildContainerV2({
          accentColorHex: ui.getColor("info") || "#38BDF8",
          authorName: "World Boss All-Time Hall of Fame",
          title: "🏆 Papan Peringkat Penakluk Boss",
          description:
            "Belum ada catatan penakluk World Boss yang terdata. Jadilah yang pertama menumbangkan sang monster samudra!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply({ ...emptyPayload, embeds: [] });
      }

      const rows = topSurvivors.map((s, idx) => {
        const medal =
          idx === 0
            ? "🥇"
            : idx === 1
              ? "🥈"
              : idx === 2
                ? "🥉"
                : `**#${idx + 1}**`;
        return `${medal} **${s.username}** • \`${s.totalDamage.toLocaleString("id-ID")} Damage\``;
      });

      const lbPayload = buildContainerV2({
        accentColorHex: "#F59E0B",
        authorName: "World Boss All-Time Hall of Fame",
        title: "🏆 10 Penakluk World Boss Tertinggi",
        description: [
          "Berikut adalah petualang dengan total kontribusi serangan tertinggi sepanjang sejarah:",
          "",
          rows.join("\n"),
          "",
          "-# ⚔️ *Terus serang World Boss aktif untuk menaikkan peringkatmu di Hall of Fame!*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...lbPayload, embeds: [] });
    }

    if (action === "status") {
      let boss = await worldBossEngine.getActiveBoss();

      if (!boss) {
        boss = await worldBossEngine.spawnBoss();
      }

      const hpPercent = Math.max(
        0,
        Math.round((Number(boss.currentHp) / Number(boss.maxHp)) * 100),
      );
      const expTs = Math.floor(new Date(boss.endTime).getTime() / 1000);
      const phaseBadge =
        boss.phase === 3
          ? `${ui.getEmoji("stamina") || "⚡"} ENRAGED`
          : boss.phase === 2
            ? `${ui.getEmoji("shield") || "🛡️"} SHIELDED`
            : `${ui.getEmoji("battle") || "⚔️"} NORMAL`;

      const files = [];
      try {
        const cardBuffer = await drawBossCard(boss);
        files.push(
          new AttachmentBuilder(cardBuffer, { name: "world_boss.png" }),
        );
      } catch (err) {
        // Fallback jika canvas gagal render
      }

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("wb_act_serang")
          .setLabel("Serang (DPS)")
          .setEmoji(ui.parseEmoji(ui.getEmoji("battle")) || { name: "⚔️" })
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("wb_act_shield")
          .setLabel("Shield (Tank)")
          .setEmoji(ui.parseEmoji(ui.getEmoji("shield")) || { name: "🛡️" })
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("wb_act_heal")
          .setLabel("Heal (Support)")
          .setEmoji(ui.parseEmoji(ui.getEmoji("heart")) || { name: "💖" })
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("wb_act_buff")
          .setLabel("Buff (Drop Rate)")
          .setEmoji(ui.parseEmoji(ui.getEmoji("magic")) || { name: "🔮" })
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("wb_act_lb")
          .setLabel("Top Raid")
          .setEmoji(ui.parseEmoji(ui.getEmoji("trophy")) || { name: "🏆" })
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: boss.phase === 3 ? "#EF4444" : "#9900EF",
        authorName: `${ui.getEmoji("battle") || "⚔️"} Global Raid Event 2.0`,
        title: `${ui.getEmoji("fire") || "🔥"} [WORLD BOSS] ${boss.name}`,
        description: [
          `**"${boss.title}"**`,
          ``,
          `${ui.getEmoji("heart") || "❤️"} **Status Boss:** \`${Number(boss.currentHp).toLocaleString("id-ID")} / ${Number(boss.maxHp).toLocaleString("id-ID")}\` (\`${hpPercent}%\`)`,
          `${ui.getEmoji("shield") || "🔰"} **Fase Tempur:** \`${phaseBadge}\` | ${ui.getEmoji("translate") || "🌐"} **Elemen:** \`${boss.element || "DARK"}\``,
          `${ui.getEmoji("clock") || "⏳"} **Batas Waktu:** Berakhir <t:${expTs}:R>`,
          `${ui.getEmoji("diamond") || "💎"} **Pool Hadiah:** \`${Number(boss.rewardsPool?.starFragments || 5000).toLocaleString("id-ID")}\` ${ui.getEmoji("star") || "⭐"} & \`${boss.rewardsPool?.coupons || 30}\` ${ui.getEmoji("ticket") || "🎟️"}`,
          ``,
          `*Pilih peran dan klik tombol aksi di bawah untuk berkontribusi bersama seluruh server!*`,
        ].join("\n"),
        buttonsRow,
        footerText: ui.getFooter("survival"),
      });

      const reply = await interaction.reply({
        ...payload,
        files,
        fetchReply: true,
      });

      // Interactive button collector (2 menit)
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
      });

      collector.on("collect", async (btnInt) => {
        const actorId = btnInt.user.id;
        const actorUsername = btnInt.user.username;

        if (btnInt.customId === "wb_act_lb") {
          const freshBoss = await worldBossEngine.getActiveBoss();
          if (!freshBoss) {
            return btnInt.reply({
              ...buildErrorContainerV2({
                title: "Tidak Ada Data",
                description: "World Boss saat ini telah berakhir.",
                footerText: ui.getFooter("survival"),
              }),
              flags: MessageFlags.Ephemeral,
            });
          }

          const leaderboard = Object.values(
            freshBoss.damageLeaderboard || {},
          ).sort((a, b) => b.totalDamage - a.totalDamage);
          const top10 = leaderboard.slice(0, 10);
          const lines = top10.map((p, idx) => {
            const medal =
              idx === 0
                ? ui.getEmoji("badge_gold") || "🥇"
                : idx === 1
                  ? ui.getEmoji("badge_silver") || "🥈"
                  : idx === 2
                    ? ui.getEmoji("badge_bronze") || "🥉"
                    : `\`#${idx + 1}\``;
            return `${medal} **${p.username}**: \`${p.totalDamage.toLocaleString("id-ID")}\` DMG (${p.hits}x hit)`;
          });

          return btnInt.reply({
            ...buildContainerV2({
              accentColorHex: "#F1C40F",
              title: `${ui.getEmoji("trophy") || "🏆"} Peringkat Kontribusi Raid, ${freshBoss.name}`,
              description:
                lines.length > 0
                  ? lines.join("\n")
                  : "Belum ada pemain yang menyerang boss ini!",
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          });
        }

        const actionMap = {
          wb_act_serang: "serang",
          wb_act_shield: "shield",
          wb_act_heal: "heal",
          wb_act_buff: "buff",
        };

        const chosenAction = actionMap[btnInt.customId] || "serang";
        const activePet = await UserPet.findOne({
          where: { userId: actorId, isActive: true },
        });
        const petBuffs = activePet
          ? petActions.getPassiveBuffs(
              activePet.type,
              activePet.evolutionStage || 1,
            )
          : {};

        const res = await worldBossEngine.executeRaidAction(
          actorId,
          actorUsername,
          chosenAction,
          {
            userLevel: context?.survival?.level || 1,
            petBuffs,
          },
        );

        if (!res.success) {
          return btnInt.reply({
            ...buildErrorContainerV2({
              title: "Aksi Gagal",
              description:
                "World Boss telah selesai atau waktu raid telah habis!",
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          });
        }

        const desc = [
          res.message,
          ``,
          `${ui.getEmoji("heart") || "❤️"} **Sisa HP Boss:** \`${res.currentHp.toLocaleString("id-ID")} / ${Number(res.maxHp).toLocaleString("id-ID")}\``,
          `${ui.getEmoji("trophy") || "🏆"} **Total Kontribusi DPS-mu:** \`${res.userTotalDamage.toLocaleString("id-ID")}\` DMG`,
        ];

        if (res.isDefeated) {
          desc.push(
            ``,
            `${ui.getEmoji("celebrate") || "🎉"} **WORLD BOSS TELAH DITUMBANGKAN!**`,
            `Hadiah dibagikan ke semua pemain yang berpartisipasi (DPS, Tank, Healer, Buffer)!`,
          );
        }

        return btnInt.reply({
          ...buildContainerV2({
            accentColorHex: res.isDefeated ? "#22C55E" : "#9900EF",
            title: res.isDefeated
              ? `${ui.getEmoji("trophy") || "🏆"} World Boss Ditaklukkan!`
              : `${ui.getEmoji("battle") || "⚔️"} Aksi Raid Berhasil!`,
            description: desc.join("\n"),
            footerText: ui.getFooter("survival"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      });

      return reply;
    }

    if (["serang", "shield", "heal", "buff"].includes(action)) {
      const activePet = await UserPet.findOne({
        where: { userId, isActive: true },
      });
      const petBuffs = activePet
        ? petActions.getPassiveBuffs(
            activePet.type,
            activePet.evolutionStage || 1,
          )
        : {};

      const result = await worldBossEngine.executeRaidAction(
        userId,
        interaction.user.username,
        action,
        {
          userLevel: context?.survival?.level || 1,
          petBuffs,
        },
      );

      if (!result.success) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Tidak Ada Boss Aktif",
            description:
              "Saat ini belum ada World Boss yang muncul. Tunggu jadwal raid hari Minggu pukul 15:00 WIB!",
            footerText: ui.getFooter("survival"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const desc = [
        result.message,
        ``,
        `${ui.getEmoji("heart") || "❤️"} **Sisa HP Boss:** \`${result.currentHp.toLocaleString("id-ID")} / ${Number(result.maxHp).toLocaleString("id-ID")}\``,
        `${ui.getEmoji("trophy") || "🏆"} **Total Kontribusi DPS-mu:** \`${result.userTotalDamage.toLocaleString("id-ID")}\` DMG`,
      ];

      if (result.isDefeated) {
        desc.push(
          ``,
          `${ui.getEmoji("celebrate") || "🎉"} **WORLD BOSS TELAH DITUMBANGKAN!**`,
          `Hadiah telah dibagikan secara proporsional ke seluruh peserta raid!`,
        );
      }

      const payload = buildContainerV2({
        accentColorHex: result.isDefeated ? "#22C55E" : "#E74C3C",
        title: result.isDefeated
          ? `${ui.getEmoji("trophy") || "🏆"} World Boss Telah Kalah!`
          : `${ui.getEmoji("battle") || "⚔️"} Aksi Raid Berhasil!`,
        description: desc.join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply(payload);
    }

    if (action === "leaderboard") {
      const boss = await worldBossEngine.getActiveBoss();
      if (!boss) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Tidak Ada Data",
            description: "Belum ada World Boss yang sedang aktif.",
            footerText: ui.getFooter("survival"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const leaderboard = Object.values(boss.damageLeaderboard || {}).sort(
        (a, b) => b.totalDamage - a.totalDamage,
      );
      const top10 = leaderboard.slice(0, 10);

      const lines = top10.map((p, idx) => {
        const medal =
          idx === 0
            ? ui.getEmoji("badge_gold") || "🥇"
            : idx === 1
              ? ui.getEmoji("badge_silver") || "🥈"
              : idx === 2
                ? ui.getEmoji("badge_bronze") || "🥉"
                : `\`#${idx + 1}\``;
        return `${medal} **${p.username}**: \`${p.totalDamage.toLocaleString("id-ID")}\` DMG (${p.hits}x hit)`;
      });

      const payload = buildContainerV2({
        accentColorHex: "#F1C40F",
        title: `${ui.getEmoji("trophy") || "🏆"} Peringkat Kontribusi Raid, ${boss.name}`,
        description:
          lines.length > 0
            ? lines.join("\n")
            : "Belum ada pemain yang menyerang boss ini!",
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply(payload);
    }
  },
};
