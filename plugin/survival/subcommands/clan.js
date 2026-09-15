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
      const questLines = [];
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
        // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain yang
        // sedang diubah anggota klan lain secara konkuren.
        await userClan.save({ fields: ["questsState", "vault"] });
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

      const {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
      } = require("discord.js");
      const hubButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("clan_hub_hall")
          .setLabel("🏡 2.5D Guild Hall")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("clan_hub_coffee")
          .setLabel("☕ Seduh Kopi (+25 Energy)")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("clan_hub_raid")
          .setLabel("⚔️ Serang Bos")
          .setStyle(ButtonStyle.Danger),
      );

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "🏰 Master Clan Hub & Dashboard",
        title: `${e("cheers", "🛡️")} Klan ${userClan.name}`,
        iconURL: interaction.user.displayAvatarURL(),
        description: description.join("\n"),
        footerText: ui.getFooter("survival"),
        buttonsRow: hubButtons,
      });

      return interaction.editReply({ ...payload, embeds: [] });
    }

    // 2. 2.5D GUILD HALL LOUNGE
    if (action === "hall") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(interaction, "Kamu belum bergabung dengan klan mana pun.");

      const guildHallEngine = require("../../../src/survival/engines/guildHallEngine");
      const { drawGuildHall } = require("../../../src/canvas/guildHallCanvas");
      const { AttachmentBuilder } = require("discord.js");

      const hallData = await guildHallEngine.getHall(userClan.id);
      const files = [];
      try {
        const hallBuf = await drawGuildHall(hallData);
        files.push(new AttachmentBuilder(hallBuf, { name: "guild_hall.png" }));
      } catch (err) {
        // Fallback jika canvas worker terkendala
      }

      const furnituresList =
        hallData.layout.furniture.map((f) => `\`${f}\``).join(", ") ||
        "*Belum ada furnitur*";
      const payload = buildContainerV2({
        accentColorHex: "#F472B6",
        authorName: "🏰 2.5D Guild Hall & Lounge",
        title: `✨ Ruang Santai Klan ${userClan.name}`,
        description: [
          `Selamat datang di 2.5D Guild Hall milik klan **${userClan.name}**!`,
          ``,
          `💰 **Kas Brankas:** \`${(userClan.vault || 0).toLocaleString("id-ID")} Star Fragments\``,
          `🛋️ **Furnitur Terpasang:** ${furnituresList}`,
          `☕ **Fasilitas Barista:** \`${hallData.layout.furniture.includes("coffee_maker") ? "Tersedia (+25 Energy/hari)" : "Belum Dibeli"}\``,
          ``,
          `-# 💡 *Gunakan \`/survival rpg clan aksi:coffee\` untuk minum kopi atau \`aksi:furniture\` untuk membeli perabot baru!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, files, embeds: [] });
    }

    // 2.5 FEDERASI ALIANSI GLOBAL
    if (action === "federation") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(interaction, "Kamu belum bergabung dengan klan mana pun.");

      const guildFederationEngine = require("../../../src/survival/engines/guildFederationEngine");
      const hall = await guildFederationEngine.getHallOfFame(5);
      const topFedLines = hall
        .map(
          (f, i) =>
            `${i === 0 ? "🥇" : "🥈"} **[${f.tag}] ${f.name}** (Prestise: \`${f.prestige}\`, Anggota: \`${f.memberClans?.length || 1} Klan\`)`,
        )
        .join("\n");

      return card(interaction, {
        color: "#38BDF8",
        title: "🌐 Aliansi Federasi Antar-Server",
        expression: "info",
        description: [
          `Klan **${userClan.name}** dapat membentuk atau bergabung dengan Aliansi Federasi Lintas-Server!`,
          "",
          "🏆 **Top Aliansi Global:**",
          topFedLines,
          "",
          "> Gunakan `/survival federation` untuk mengakses menu lengkap Aliansi & Alliance Raid Boss.",
        ].join("\n"),
      });
    }

    // 3. MINUM KOPI LOUNGE (+25 ENERGY)
    if (action === "coffee") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(interaction, "Kamu belum bergabung dengan klan mana pun.");

      const guildHallEngine = require("../../../src/survival/engines/guildHallEngine");
      const coffeeRes = await guildHallEngine.claimCoffeeBuff(
        user.id,
        userClan.id,
      );

      if (!coffeeRes.success) {
        let msg = "Gagal meminum kopi di lounge klan.";
        if (coffeeRes.reason === "NO_COFFEE_MAKER")
          msg =
            "Klanmu belum memiliki mesin `coffee_maker` di Guild Hall! Beli dengan `/survival rpg clan aksi:furniture nama:coffee_maker`.";

        return fail(interaction, msg);
      }

      return card(interaction, {
        color: "#86EFAC",
        title: "☕ Secangkir Kopi Hangat Dinikmati!",
        description: `Kamu menikmati secangkir kopi segar di lounge klan **${coffeeRes.clanName}**! Memulihkan **+${coffeeRes.energyGained} Energy**!`,
      });
    }

    // 4. BELI FURNITUR LOUNGE
    if (action === "furniture") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(interaction, "Kamu belum bergabung dengan klan mana pun.");

      if (userClan.leaderId !== user.id) {
        return fail(
          interaction,
          "Hanya pemimpin klan yang berhak membeli dan menata dekorasi Guild Hall!",
        );
      }

      const furnitureId = clanNameInput || "arcade_cabinet";
      const guildHallEngine = require("../../../src/survival/engines/guildHallEngine");
      const buyRes = await guildHallEngine.buyFurniture(
        userClan.id,
        furnitureId,
      );

      if (!buyRes.success) {
        let msg = "Gagal membeli furnitur.";
        if (buyRes.reason === "INVALID_FURNITURE")
          msg = `ID Furnitur tidak valid! Pilihan: \`neon_sofa\` (2k), \`coffee_maker\` (3k), \`arcade_cabinet\` (5k), \`sakura_bonsai\` (4k), \`trophy_case\` (7.5k).`;
        if (buyRes.reason === "ALREADY_OWNED")
          msg = "Klanmu sudah memiliki furnitur ini di dalam Guild Hall!";
        if (buyRes.reason === "INSUFFICIENT_VAULT")
          msg = `Saldo kas klan tidak cukup! Butuh ${buyRes.cost.toLocaleString("id-ID")} ⭐, kas klan saat ini: ${buyRes.current.toLocaleString("id-ID")} ⭐.`;

        return fail(interaction, msg);
      }

      return card(interaction, {
        color: "#86EFAC",
        title: "🎉 Furnitur Baru Terpasang!",
        description: `Klan **${userClan.name}** berhasil membeli **${buyRes.item.emoji} ${buyRes.item.name}** seharga **${buyRes.item.cost.toLocaleString("id-ID")} ⭐**! Sisa kas: **${buyRes.remainingVault.toLocaleString("id-ID")} ⭐**.`,
      });
    }

    // 5. UBAH TEMA VISUAL GUILD HALL
    if (action === "theme") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(interaction, "Kamu belum bergabung dengan klan mana pun.");

      if (userClan.leaderId !== user.id) {
        return fail(
          interaction,
          "Hanya pemimpin klan yang berhak mengubah tema visual Guild Hall!",
        );
      }

      const guildHallEngine = require("../../../src/survival/engines/guildHallEngine");
      const themeInput = (clanNameInput || "CYBERPUNK_LOUNGE").toUpperCase();
      const themeRes = await guildHallEngine.customizeTheme(
        userClan.id,
        themeInput,
      );

      if (!themeRes.success) {
        return fail(
          interaction,
          "Tema tidak valid! Pilihan tema yang tersedia: `CYBERPUNK_LOUNGE`, `NEO_SHRINE`, `ASTRAL_OBSERVATORY`, `NATURE_SANCTUARY`.",
        );
      }

      return card(interaction, {
        color: "#A78BFA",
        title: "🎨 Suasana Guild Hall Diperbarui!",
        description: `Tema visual Guild Hall klan **${userClan.name}** berhasil diubah menjadi **${themeInput}**!`,
      });
    }

    // 6. UPGRADE FASILITAS GUILD HALL
    if (action === "upgrade") {
      const userClan = survival.clanId
        ? await GuildClan.findByPk(survival.clanId)
        : null;
      if (!userClan)
        return fail(interaction, "Kamu belum bergabung dengan klan mana pun.");

      if (userClan.leaderId !== user.id) {
        return fail(
          interaction,
          "Hanya pemimpin klan yang berhak meng-upgrade fasilitas klan!",
        );
      }

      const guildHallEngine = require("../../../src/survival/engines/guildHallEngine");
      const facilityId = clanNameInput || "lounge";
      const upgRes = await guildHallEngine.upgradeFacility(
        userClan.id,
        facilityId,
      );

      if (!upgRes.success) {
        if (upgRes.reason === "INSUFFICIENT_VAULT") {
          return fail(
            interaction,
            `Kas klan tidak cukup! Butuh ${upgRes.cost.toLocaleString("id-ID")} ⭐, saldo saat ini: ${upgRes.current.toLocaleString("id-ID")} ⭐.`,
          );
        }
        return fail(interaction, "Gagal meng-upgrade fasilitas klan.");
      }

      return card(interaction, {
        color: "#FBBF24",
        title: "⭐ Fasilitas Berhasil Di-Upgrade!",
        description: `Fasilitas **${facilityId}** klan **${userClan.name}** berhasil ditingkatkan ke **Level ${upgRes.newLevel}** seharga **${upgRes.cost.toLocaleString("id-ID")} ⭐**! Sisa kas: **${upgRes.remainingVault.toLocaleString("id-ID")} ⭐**.`,
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
        await survival.save({ fields: ["clanId"] });
        return card(interaction, {
          color: "#ff4757",
          title: `${e("shocked", "💥")} Klan Dibubarkan`,
          description: `Kamu adalah pemimpin klan. Karena kamu keluar, klan **${userClan.name}** resmi dibubarkan.`,
        });
      }

      userClan.members = userClan.members.filter((id) => id !== user.id);
      userClan.changed("members", true);
      await userClan.save({ fields: ["members"] });

      survival.clanId = null;
      await survival.save({ fields: ["clanId"] });

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
      await survival.save({ fields: ["clanId"] });

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
      await targetClan.save({ fields: ["members"] });

      survival.clanId = targetClan.id;
      await survival.save({ fields: ["clanId"] });

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

      // Rule 1.8: fields eksplisit agar penulisan kas/level tidak menimpa
      // kolom lain seperti questsState atau bossHp.
      await userClan.save({ fields: ["vault", "level"] });

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

      // Rule 1.8: potong stamina lewat debit atomik, bukan baca-ubah-tulis.
      const staminaDebit = await cacheManager.debitUserSurvival(
        user.id,
        "stamina",
        RAID_STAMINA,
      );
      if (!staminaDebit.ok) {
        return fail(
          interaction,
          `Staminamu tinggal **${survival.stamina || 0}**, sedangkan menyerang boss butuh **${RAID_STAMINA}**. Istirahat dulu ya, Naura khawatir.`,
        );
      }

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
      // Rule 1.8: fields eksplisit; vault ikut ditulis bila boss tumbang.
      await userClan.save(
        defeated ? { fields: ["bossHp", "vault"] } : { fields: ["bossHp"] },
      );

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

    if (action === "territory") {
      const ClanTerritory = require("../../../src/models/ClanTerritory");
      const territories = await ClanTerritory.findAll();

      if (territories.length === 0) {
        return card(interaction, {
          color: "#9CA3AF",
          title: "🏰 Peta Teritori Wilayah Klan",
          description:
            "Belum ada teritori yang tercatat dalam peta dunia Naura RPG.",
        });
      }

      const list = territories
        .map((t) => {
          const ownerClan = t.clanId
            ? `Klan ID \`#${t.clanId}\``
            : "*Netral / Belum Dikuasai*";
          return `📍 **${t.name}**\n- Penguasa: ${ownerClan}\n- Control Points: **${t.controlPoints} pts**\n- Hasil Pajak: ⭐ **${t.taxYield} NSF/hari**\n- Buff Wilayah: \`${t.buffEffect}\``;
        })
        .join("\n\n");

      return card(interaction, {
        color: "#38BDF8",
        title: "🏰 Peta Wilayah & Teritori Klan Lintas Server",
        description: `Berikut status penguasaan teritori strategis di dunia Naura RPG:\n\n${list}\n\n*Klan yang menguasai teritori memperoleh pendapatan pasif Star Fragments dan buff wilayah setiap reset mingguan.*`,
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
      "Naura belum mengenali aksi itu. Coba pilih **info**, **create**, **join**, **deposit**, **raid**, **territory**, atau **blessing** ya.",
    );
  },
};
