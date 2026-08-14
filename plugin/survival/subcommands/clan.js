"use strict";

const GuildClan = require("../../../src/models/GuildClan");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const leveling = require("../../../src/survival/engines/survivalLeveling");
const currency = require("../../../src/survival/engines/currency");
const {
  rollCouponDrop,
  dropLine,
} = require("../../../src/survival/helpers/couponRewards");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const CREATE_COST = 500;
const MAX_MEMBERS = 20;
const RAID_STAMINA = 15;
const BOSS_BASE_HP = 1000;
const BOSS_HP_PER_LEVEL = 200;
const BOSS_VAULT_REWARD = 1500;
const BOSS_PERSONAL_REWARD = 300;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function fail(interaction, message) {
  const payload = buildErrorContainerV2({
    title: `${e("shy", "\uD83D\uDE45")} Belum bisa dilakukan`,
    description: message,
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply({ ...payload, embeds: [] });
}

function card(interaction, { color, title, description, expression, footer }) {
  const payload = buildContainerV2({
    accentColorHex: color,
    authorName: "Naura Clan Hall",
    title,
    iconURL: interaction.user.displayAvatarURL(),
    expression: expression || "info",
    description,
    footerText: footer || ui.getFooter("survival"),
  });

  return interaction.editReply({ ...payload, embeds: [] });
}

// Fungsi findUserClan telah dihapus karena sekarang menggunakan survival.clanId (O(1) lookup)

function bossMaxHp(level) {
  return BOSS_BASE_HP + ((level || 1) - 1) * BOSS_HP_PER_LEVEL;
}

module.exports = {
  async execute(interaction, client) {
    const action = interaction.options.getString("aksi") || "info";
    const clanNameInput = interaction.options.getString("nama");
    const amountInput = interaction.options.getInteger("jumlah") || 100;
    const user = interaction.user;
    const guild = interaction.guild;

    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });
    const profile = await cacheManager.getUserProfile(user.id);
    const holders = { survival, profile };

    if (action === "info") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;

      if (!userClan) {
        return card(interaction, {
          color: ui.getColor("warning") || "#FFD700",
          title: `${e("happy", "\uD83C\uDFD5\uFE0F")} Kamu belum punya klan`,
          expression: "info",
          description: [
            "Belum ada klan yang kamu ikuti, tapi jangan sedih. Naura bantu jelaskan caranya, ya!",
            "",
            `> ${e("read", "\uD83C\uDFF0")} \`/survival clan\` aksi **create** untuk mendirikan klan (biaya ${currency.format(currency.FRAGMENT, CREATE_COST)})`,
            `> ${e("impressed", "\u2694\uFE0F")} \`/survival clan\` aksi **join** untuk gabung ke klan temanmu`,
          ].join("\n"),
        });
      }

      const leaderUser = await client.users
        .fetch(userClan.leaderId)
        .catch(() => null);
      const leaderName = leaderUser
        ? leaderUser.username
        : "pemimpin misterius";

      let state =
        typeof userClan.questsState === "string"
          ? JSON.parse(userClan.questsState)
          : userClan.questsState;
      let needsSave = false;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      todayDate.setDate(
        todayDate.getDate() -
          (todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1),
      );
      const currentWeek = todayDate.toISOString().split("T")[0];

      const {
        generateClanQuestsForClan,
      } = require("../../../src/survival/engines/questGenerator");
      if (!state || state.lastWeeklyReset !== currentWeek) {
        state = generateClanQuestsForClan(userClan);
        needsSave = true;
      }

      let rewardTotal = 0;
      let questLines = [];
      const nsfEmoji = currency.emojiOf(currency.FRAGMENT);
      state.weekly.forEach((q, idx) => {
        const icon = q.claimed
          ? e("cheers", "✅")
          : q.current >= q.target
            ? e("impressed", "⭐")
            : e("thinking", "⏳");
        if (q.current >= q.target && !q.claimed) {
          q.claimed = true;
          rewardTotal += q.reward;
          needsSave = true;
        }
        questLines.push(
          `**${idx + 1}.** ${icon} ${q.title}\n> Progres: \`${q.current} / ${q.target}\` • Kas Klan: ${nsfEmoji} **${q.reward}**`,
        );
      });

      if (rewardTotal > 0) {
        userClan.vault = (userClan.vault || 0) + rewardTotal;
      }

      if (needsSave) {
        userClan.questsState = state;
        userClan.changed("questsState", true);
        await userClan.save();
      }

      const description = [
        `> ${e("impressed", "👑")} Pemimpin: **${leaderName}**`,
        `> ${e("read", "📊")} Level klan: **${userClan.level}**`,
        `> ${e("cheers", "💰")} Kas klan: ${currency.format(currency.FRAGMENT, userClan.vault || 0)}`,
        `> ${e("happy", "👥")} Anggota: **${userClan.members.length} / ${MAX_MEMBERS}**`,
        `> ${e("shocked", "🐉")} HP boss: **${userClan.bossHp} / ${bossMaxHp(userClan.level)}**`,
        "",
        `**${e("read", "📋")} Misi Mingguan Klan**`,
        ...questLines,
        "",
        "Ayo ramaikan klanmu! Selesaikan misi di atas bersama anggota klan yang lain.",
      ];

      if (rewardTotal > 0) {
        description.push(
          `\n${e("cheers", "🎉")} Misi diselesaikan! Kas klan bertambah **${rewardTotal.toLocaleString("id-ID")} NSF**!`,
        );
      }

      return card(interaction, {
        color: ui.getColor("primary") || "#FFB6C1",
        title: `${e("cheers", "🛡️")} Klan ${userClan.name}`,
        expression: "info",
        description: description.join("\n"),
      });
    }

    if (action === "leave") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(interaction, "Kamu belum bergabung dengan klan mana pun.");

      if (userClan.leaderId === user.id) {
        await userClan.destroy();
        survival.clanId = null;
        await survival.save();
        return card(interaction, {
          color: "#ff4757",
          title: `${e("shocked", "💥")} Klan Dibubarkan`,
          description: `Kamu adalah pemimpin klan. Karena kamu keluar, klan **${userClan.name}** resmi dibubarkan.`,
        });
      }

      userClan.members = userClan.members.filter((id) => id !== user.id);
      userClan.changed("members", true);
      await userClan.save();

      survival.clanId = null;
      await survival.save();

      return card(interaction, {
        color: "#ff4757",
        title: `${e("shy", "👋")} Keluar dari Klan`,
        description: `Kamu telah keluar dari klan **${userClan.name}**.`,
      });
    }

    if (action === "create") {
      if (!clanNameInput)
        return fail(
          interaction,
          "Naura belum tahu nama klannya. Tulis namanya dulu ya!",
        );

      const existing = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (existing)
        return fail(
          interaction,
          `Kamu masih anggota klan **${existing.name}**. Keluar dulu sebelum mendirikan yang baru, ya.`,
        );

      const paid = await currency.charge(
        currency.FRAGMENT,
        holders,
        CREATE_COST,
      );
      if (paid === null) {
        return fail(
          interaction,
          `Untuk mendirikan klan butuh ${currency.format(currency.FRAGMENT, CREATE_COST)}, sedangkan saldomu belum cukup. Semangat mengumpulkannya!`,
        );
      }

      const newClan = await GuildClan.create({
        name: clanNameInput.trim(),
        leaderId: user.id,
        guildId: guild ? guild.id : "global",
        members: [user.id],
        vault: CREATE_COST,
        bossHp: BOSS_BASE_HP,
      });

      survival.clanId = newClan.id;
      await survival.save();

      return card(interaction, {
        color: "#FFD700",
        title: `${e("cheers", "\uD83C\uDFF0")} Klanmu resmi berdiri!`,
        expression: "celebrate",
        description: [
          `Selamat! Klan **${newClan.name}** sudah berdiri dengan kas awal ${currency.format(currency.FRAGMENT, CREATE_COST)}.`,
          "",
          `Ajak temanmu bergabung dengan menyebut nama **${newClan.name}** di aksi **join**. Naura ikut senang!`,
        ].join("\n"),
      });
    }

    if (action === "join") {
      if (!clanNameInput)
        return fail(
          interaction,
          "Naura belum tahu klan mana yang mau kamu masuki. Tulis namanya ya!",
        );

      const existing = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (existing)
        return fail(
          interaction,
          `Kamu sudah bergabung di klan **${existing.name}**, lho.`,
        );

      const targetClan = await GuildClan.findOne({
        where: { name: clanNameInput.trim() },
      });
      if (!targetClan)
        return fail(
          interaction,
          `Naura cari ke mana-mana, tapi klan **"${clanNameInput}"** tidak ada. Cek ejaannya lagi ya?`,
        );
      if (targetClan.members.length >= MAX_MEMBERS)
        return fail(
          interaction,
          `Klan **${targetClan.name}** sudah penuh (${MAX_MEMBERS} anggota). Coba klan lain, ya.`,
        );

      targetClan.members = [...targetClan.members, user.id];
      targetClan.changed("members", true);
      await targetClan.save();

      survival.clanId = targetClan.id;
      await survival.save();

      return card(interaction, {
        color: ui.getColor("success") || "#22c55e",
        title: `${e("cheers", "\u2694\uFE0F")} Kamu resmi bergabung!`,
        expression: "success",
        description: `Selamat, kamu sekarang anggota klan **${targetClan.name}**! Kenalan sama yang lain ya, Naura yakin kalian cepat akrab.`,
      });
    }

    if (action === "deposit") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(
          interaction,
          "Kamu belum punya klan, jadi belum ada kas yang bisa diisi.",
        );
      if (amountInput < 1)
        return fail(
          interaction,
          "Jumlah sumbangannya harus lebih dari nol ya.",
        );

      const paid = await currency.charge(
        currency.FRAGMENT,
        holders,
        amountInput,
      );
      if (paid === null) {
        const owned = currency.balanceOf(currency.FRAGMENT, holders);
        return fail(
          interaction,
          `Saldomu belum cukup. Sekarang kamu punya ${currency.format(currency.FRAGMENT, owned)}.`,
        );
      }

      userClan.vault = (userClan.vault || 0) + amountInput;
      let leveledUp = false;

      if (userClan.vault >= userClan.level * 2000) {
        userClan.level += 1;
        leveledUp = true;
      }

      await userClan.save();

      const lines = [
        `Terima kasih! Kamu menyumbang ${currency.format(currency.FRAGMENT, amountInput)} ke kas klan **${userClan.name}**.`,
        "",
        `> ${e("read", "\uD83C\uDFE6")} Kas sekarang: **${userClan.vault.toLocaleString("id-ID")}**`,
        `> ${e("impressed", "\uD83D\uDCCA")} Level klan: **${userClan.level}**`,
      ];

      if (leveledUp)
        lines.push(
          "",
          `${e("cheers", "\uD83C\uDF89")} Klanmu naik level! Boss raidnya jadi lebih kuat, tapi hadiahnya juga lebih besar.`,
        );

      return card(interaction, {
        color: "#FFD700",
        title: `${e("cheers", "\uD83D\uDCB0")} Sumbanganmu diterima`,
        expression: "economy",
        description: lines.join("\n"),
      });
    }

    if (action === "raid") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(
          interaction,
          "Kamu belum punya klan, jadi belum ada boss yang bisa diserang.",
        );
      if ((survival.stamina || 0) < RAID_STAMINA) {
        return fail(
          interaction,
          `Staminamu tinggal **${survival.stamina || 0}**, sedangkan menyerang boss butuh **${RAID_STAMINA}**. Istirahat dulu ya, Naura khawatir.`,
        );
      }

      survival.stamina -= RAID_STAMINA;
      await survival.save();

      const damage =
        Math.floor(Math.random() * 50) + (survival.strength || 1) * 10 + 20;
      let bossHp = (userClan.bossHp || bossMaxHp(userClan.level)) - damage;
      const defeated = bossHp <= 0;
      let couponText = "";

      if (defeated) {
        userClan.vault = (userClan.vault || 0) + BOSS_VAULT_REWARD;
        bossHp = bossMaxHp(userClan.level);

        await currency.reward(currency.FRAGMENT, holders, BOSS_PERSONAL_REWARD);
        await leveling.addPlayerXP(user.id, 150);

        const coupon = await rollCouponDrop("clan_boss_kill", { survival });
        couponText = dropLine(coupon);
      } else {
        await leveling.addPlayerXP(user.id, 30);
      }

      userClan.bossHp = bossHp;
      await userClan.save();

      if (!defeated) {
        return card(interaction, {
          color: "#ff4757",
          title: `${e("impressed", "\u2694\uFE0F")} Seranganmu masuk!`,
          expression: "success",
          description: [
            `Kamu menghajar boss klan dan memberi **${damage} kerusakan**. Keren banget!`,
            "",
            `> ${e("shocked", "\uD83D\uDC09")} Sisa HP boss: **${bossHp} / ${bossMaxHp(userClan.level)}**`,
            "",
            "Ajak anggota lain menyerang bareng ya, Naura sorakin dari pinggir!",
          ].join("\n"),
        });
      }

      const lines = [
        `Luar biasa! Serangan **${damage} kerusakan** darimu menumbangkan boss klan. Naura sampai bertepuk tangan!`,
        "",
        `> ${e("cheers", "\uD83C\uDF81")} Hadiah pribadi: ${currency.format(currency.FRAGMENT, BOSS_PERSONAL_REWARD)}`,
        `> ${e("read", "\uD83C\uDFE6")} Kas klan bertambah **${BOSS_VAULT_REWARD.toLocaleString("id-ID")}**`,
        `> ${e("impressed", "\uD83C\uDF1F")} Survival XP **+150**`,
        "",
        `Boss berikutnya bangkit dengan **${bossMaxHp(userClan.level)} HP**. Siapkan tenaga ya!`,
      ];

      if (couponText) lines.push("", couponText);

      return card(interaction, {
        color: "#FFD700",
        title: `${e("cheers", "\uD83C\uDF89")} Boss klan tumbang!`,
        expression: "reward",
        description: lines.join("\n"),
      });
    }

    if (action === "blessing") {
      const guildWarEngine = require("../../../src/survival/engines/guildWarEngine");
      const blessing = await guildWarEngine.getServerBlessing(
        interaction.guildId,
      );

      if (!blessing) {
        return card(interaction, {
          color: "#9CA3AF",
          title: "🕊️ Server Blessing Tidak Aktif",
          description:
            "Server ini belum memiliki Server Blessing aktif. Menangkan Clan War mingguan untuk mengaktifkan 2x XP Boost & 2x Stamina Regeneration selama 24 jam!",
        });
      }

      const expTs = Math.floor(new Date(blessing.expiresAt).getTime() / 1000);
      return card(interaction, {
        color: "#FFD700",
        title: "✨ Server-Wide Blessing Sedang Aktif!",
        description: [
          `🏆 **Pemenang Clan War:** Klan ID \`#${blessing.clanId}\``,
          ``,
          `⚡ **2x XP Boost:** Berjalan untuk seluruh pemain di server ini!`,
          `🍃 **2x Stamina Regeneration:** Pulih 2x lebih cepat!`,
          `⏳ **Masa Berlaku:** Berakhir <t:${expTs}:R>`,
        ].join("\n"),
      });
    }

    return fail(
      interaction,
      "Naura belum mengenali aksi itu. Coba pilih **info**, **create**, **join**, **deposit**, **raid**, atau **blessing** ya.",
    );
  },
};
