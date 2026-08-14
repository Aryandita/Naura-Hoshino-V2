"use strict";

const { MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const worldBossEngine = require("../../../src/survival/engines/worldBossEngine");
const petActions = require("../../../src/survival/helpers/petActions");
const cacheManager = require("../../../src/managers/cacheManager");
const UserPet = require("../../../src/models/UserPet");

module.exports = {
  name: "raid",
  description: "Ikuti pertempuran World Boss Global bersama seluruh petualang!",

  async execute(interaction, context) {
    const action = interaction.options.getString("aksi") || "status";
    const userId = interaction.user.id;

    if (action === "status") {
      let boss = await worldBossEngine.getActiveBoss();

      if (!boss) {
        // Auto-spawn demo boss bila belum ada
        boss = await worldBossEngine.spawnBoss();
      }

      const hpPercent = Math.max(
        0,
        Math.round((Number(boss.currentHp) / Number(boss.maxHp)) * 100),
      );
      const expTs = Math.floor(new Date(boss.endTime).getTime() / 1000);

      const payload = buildContainerV2({
        accentColorHex: "#9900EF",
        authorName: "⚔️ Global Raid Event",
        title: `🔥 [WORLD BOSS] ${boss.name}`,
        description: [
          `**"${boss.title}"**`,
          ``,
          `❤️ **HP Boss:** ${Number(boss.currentHp).toLocaleString("id-ID")} / ${Number(boss.maxHp).toLocaleString("id-ID")} (\`${hpPercent}%\`)`,
          `⏳ **Batas Waktu:** Berakhir <t:${expTs}:R>`,
          `💎 **Pool Hadiah:** ${boss.rewardsPool.starFragments} Star Fragments & ${boss.rewardsPool.coupons} Naura Coupons!`,
          ``,
          `*Gunakan \`/survival raid aksi:serang\` untuk mengerahkan pet dan menyerang Boss!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply(payload);
    }

    if (action === "serang") {
      // Ambil pet aktif user untuk mendapatkan passive buff
      const activePet = await UserPet.findOne({
        where: { userId, isActive: true },
      });
      const petBuffs = activePet
        ? petActions.getPassiveBuffs(
            activePet.type,
            activePet.evolutionStage || 1,
          )
        : {};

      const result = await worldBossEngine.attackBoss(
        userId,
        interaction.user.username,
        {
          userLevel: context?.survival?.level || 1,
          petBuffs,
        },
      );

      if (!result.success) {
        if (
          result.reason === "NO_ACTIVE_BOSS" ||
          result.reason === "BOSS_EXPIRED"
        ) {
          return interaction.reply({
            ...buildErrorContainerV2({
              title: "Tidak Ada Boss Aktif",
              description:
                "Saat ini belum ada World Boss yang muncul. Tunggu pengumuman jadwal raid selanjutnya!",
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      const critText = result.isCrit ? " 💥 **CRITICAL HIT!**" : "";
      const petNote = activePet
        ? ` (Buff Pet **${activePet.name || activePet.type}** aktif!)`
        : "";

      const desc = [
        `⚔️ Kamu melancarkan serangan dahsyat ke **${result.bossName}**!${critText}`,
        ``,
        `💥 **Damage Dihasilkan:** \`${result.damage.toLocaleString("id-ID")}\` DMG${petNote}`,
        `❤️ **Sisa HP Boss:** \`${result.currentHp.toLocaleString("id-ID")} / ${Number(result.maxHp).toLocaleString("id-ID")}\``,
        `🏆 **Total Kontribusimu:** \`${result.userTotalDamage.toLocaleString("id-ID")}\` DMG`,
      ];

      if (result.isDefeated) {
        desc.push(
          ``,
          `🎉 **WORLD BOSS TELAH DITUMBANGKAN!**`,
          `Hadiah telah dibagikan secara proporsional ke semua petualang yang berpartisipasi!`,
        );
      }

      const payload = buildContainerV2({
        accentColorHex: result.isDefeated ? "#22C55E" : "#E74C3C",
        title: result.isDefeated
          ? "🏆 World Boss Telah Kalah!"
          : "⚔️ Serangan Berhasil!",
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
            ? "🥇"
            : idx === 1
              ? "🥈"
              : idx === 2
                ? "🥉"
                : `\`#${idx + 1}\``;
        return `${medal} **${p.username}**: \`${p.totalDamage.toLocaleString("id-ID")}\` DMG (${p.hits}x hit)`;
      });

      const payload = buildContainerV2({
        accentColorHex: "#F1C40F",
        title: `🏆 Peringkat Kontribusi Raid, ${boss.name}`,
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
