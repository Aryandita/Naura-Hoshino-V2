"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const cacheManager = require("../../managers/cacheManager");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");
const { safeParseInventory, findItem, takeItemsAtomic } = require("../../survival/engines/inventoryHelper");
const UserQuest = require("../../models/UserQuest");
const canvasWorkerPool = require("../../canvas/canvasWorkerPool");
const { logger } = require("../../managers/logger");
const { withDistributedLock } = require("../../utils/redisLockHelper");

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

const REWARD_TABLE = [
  { day: 1, sukamajuCoins: 1000, xp: 50, scholarshipVouchers: 0, bonus: null },
  { day: 2, sukamajuCoins: 1500, xp: 75, scholarshipVouchers: 0, bonus: null },
  { day: 3, sukamajuCoins: 2000, xp: 100, scholarshipVouchers: 0, bonus: "📦 1x Mystery Lootbox" },
  { day: 4, sukamajuCoins: 2500, xp: 150, scholarshipVouchers: 0, bonus: null },
  { day: 5, sukamajuCoins: 3500, xp: 200, scholarshipVouchers: 1, bonus: "🎟️ 1x Voucher Beasiswa" },
  { day: 6, sukamajuCoins: 5000, xp: 250, scholarshipVouchers: 0, bonus: null },
  { day: 7, sukamajuCoins: 10000, xp: 500, scholarshipVouchers: 3, bonus: "🌟 3x Voucher Beasiswa + 🎴 Rare Card Pack" },
];

function getStreakCalendarCard(currentDay) {
  const activeIndex = ((currentDay - 1) % 7) + 1;
  const days = [
    { day: 1, label: "Day 1", reward: "1.000 SC", icon: "🪙" },
    { day: 2, label: "Day 2", reward: "1.500 SC", icon: "🪙" },
    { day: 3, label: "Day 3", reward: "Mystery Box", icon: "📦" },
    { day: 4, label: "Day 4", reward: "2.500 SC", icon: "🪙" },
    { day: 5, label: "Day 5", reward: "1x VB", icon: "🎟️" },
    { day: 6, label: "Day 6", reward: "5.000 SC", icon: "🪙" },
    { day: 7, label: "Day 7", reward: "Jackpot Kosmik", icon: "👑" },
  ];

  const stampRow1 = days.slice(0, 4).map((d) => {
    const isClaimed = d.day < activeIndex;
    const isToday = d.day === activeIndex;
    const badge = isClaimed ? "✅" : isToday ? "🔥" : "🔒";
    return `\`[${d.label}]\` ${badge} ${d.icon} **${d.reward}**`;
  }).join("  •  ");

  const stampRow2 = days.slice(4).map((d) => {
    const isClaimed = d.day < activeIndex;
    const isToday = d.day === activeIndex;
    const badge = isClaimed ? "✅" : isToday ? "🔥" : "🔒";
    return `\`[${d.label}]\` ${badge} ${d.icon} **${d.reward}**`;
  }).join("  •  ");

  const progressPercent = Math.round((activeIndex / 7) * 100);
  const filledBars = Math.round(progressPercent / 10);
  const progressBar = "🟩".repeat(filledBars) + "⬜".repeat(10 - filledBars);

  return [
    "📅 **KALENDER STAMP LOGIN 7 HARI:**",
    stampRow1,
    stampRow2,
    "",
    `📈 **Progres Mingguan:** ${progressBar} \`${progressPercent}%\` *(Hari ${activeIndex}/7)*`,
  ].join("\n");
}

function buildChecklistSection({ isClaimedToday, currentStreak, questsCompleted, totalQuests, shieldCount }) {
  const claimIcon = isClaimedToday ? "✅" : "⏳";
  const claimStatus = isClaimedToday ? "Sudah Diambil" : "Siap Diklaim";
  const questIcon = questsCompleted >= totalQuests ? "✅" : "📋";
  const shieldIcon = shieldCount > 0 ? "🛡️" : "⚪";

  return [
    "📌 **CHECKLIST AKTIVITAS HARIAN:**",
    `• ${claimIcon} **Hadiah Harian:** \`${claimStatus}\` (Streak: **${currentStreak} Hari**)`,
    `• ${questIcon} **Misi Harian:** \`${questsCompleted}/${totalQuests} Selesai\` *(Gunakan tombol di bawah)*`,
    `• ${shieldIcon} **Pelindung Streak:** \`${shieldCount} Tersedia di Tas\` *(Mencegah streak putus)*`,
  ].join("\n");
}

function buildDailyHubRow(isClaimedToday, shieldCount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("daily_btn_claim")
      .setLabel(isClaimedToday ? "Hadiah Diklaim" : "Klaim Hadiah")
      .setEmoji(isClaimedToday ? "✅" : "🎁")
      .setStyle(isClaimedToday ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(isClaimedToday),
    new ButtonBuilder()
      .setCustomId("daily_btn_quests")
      .setLabel("Misi Harian")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("daily_btn_shield")
      .setLabel(`Pelindung Streak (${shieldCount})`)
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Secondary),
  );
}

async function handleDailyClaim(interaction) {
  const userId = interaction.user.id;
  return withDistributedLock(`daily_claim:${userId}`, async () => {
    const displayName = ui.ux.resolveUserName(interaction);
    const now = Date.now();

  const profile = await cacheManager.getUserProfile(userId);
  const cooldowns = profile?.cooldowns || {};
  const lastDaily = cooldowns.daily ? new Date(cooldowns.daily).getTime() : 0;
  const currentStreak = Number(cooldowns.daily_streak || 0);
  const timeDiff = now - lastDaily;
  const isClaimedToday = timeDiff < COOLDOWN_MS;

  const inv = safeParseInventory(profile?.inventory);
  const shieldItem = findItem(inv, "streak_shield");
  const shieldCount = shieldItem ? (shieldItem.count || 1) : 0;

  const userQuest = await UserQuest.findByPk(userId).catch(() => null);
  let questsCompleted = 0;
  const totalQuests = 3;
  if (userQuest) {
    if (userQuest.workCount >= 1) questsCompleted++;
    if (userQuest.dungeonKills >= 1) questsCompleted++;
    if (userQuest.collectCount >= 3) questsCompleted++;
    if (userQuest.isClaimed) questsCompleted = 3;
  }

  if (isClaimedToday) {
    const remainingMs = COOLDOWN_MS - timeDiff;
    const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    const nextDay = (currentStreak % 7) + 1;
    const nextReward = REWARD_TABLE[nextDay - 1];

    const checklistText = buildChecklistSection({
      isClaimedToday: true,
      currentStreak,
      questsCompleted,
      totalQuests,
      shieldCount,
    });

    const desc = [
      `Halo **${displayName}**. Hadiah harian kamu untuk hari ini telah selesai diambil.`,
      "",
      checklistText,
      "",
      `⏳ **Waktu Tunggu:** \`${remainingHours} jam ${remainingMinutes} menit\` lagi`,
      "",
      `${getStreakCalendarCard(currentStreak)}`,
      "",
      `**Pratinjau Hadiah Berikutnya (Hari ke-${nextDay}):**`,
      `• 🪙 \`+${nextReward.sukamajuCoins.toLocaleString("id-ID")} SC\``,
      `• 💬 \`+${nextReward.xp} XP\``,
      nextReward.bonus ? `• ${nextReward.bonus}` : "",
    ].filter(Boolean).join("\n");

    const container = buildContainerV2({
      accentColorHex: "#FBBF24",
      authorName: "Daily Rewards & Streak Hub",
      title: "Klaim Harian Dalam Waktu Tunggu",
      description: desc,
      buttonsRow: buildDailyHubRow(true, shieldCount),
      expression: "sleepy",
      footerText: ui.getFooter("core"),
    });

    return interaction.editReply(container);
  }

  let newStreak = 1;
  let streakMessage = "";

  if (lastDaily === 0) {
    newStreak = 1;
    streakMessage = "Selamat datang di klaim harian pertamamu. Masuk setiap hari untuk bonus bertingkat.";
  } else if (timeDiff <= GRACE_PERIOD_MS) {
    newStreak = currentStreak + 1;
    streakMessage = `Konsistensi luar biasa. Kamu telah login selama **${newStreak} hari berturut-turut**.`;
  } else {
    const shieldIdx = inv.findIndex((i) => i && i.id === "streak_shield");
    if (shieldIdx !== -1 && currentStreak > 1) {
      await takeItemsAtomic(userId, [{ id: "streak_shield", amount: 1 }]);
      newStreak = currentStreak + 1;
      streakMessage = `🛡️ **Jimat Pelindung Streak Digunakan.** Streak kamu berhasil diselamatkan dan bertambah ke **${newStreak} hari**.`;
    } else {
      newStreak = 1;
      streakMessage = "Streak sebelumnya terhenti karena melewati batas waktu 48 jam. Memulai kembali streak baru.";
    }
  }

  const dayInCycle = ((newStreak - 1) % 7) + 1;
  const reward = REWARD_TABLE[dayInCycle - 1];

  await Promise.all([
    cacheManager.incrementUserSurvival(userId, "sukamajuCoins", reward.sukamajuCoins),
    cacheManager.incrementUserProfile(userId, "leveling_xp", reward.xp),
    reward.scholarshipVouchers > 0
      ? cacheManager.incrementUserSurvival(userId, "scholarshipVouchers", reward.scholarshipVouchers)
      : Promise.resolve(),
    cacheManager.mutateUserProfileJson(userId, "cooldowns", (cd) => {
      cd.daily = new Date(now).toISOString();
      cd.daily_streak = newStreak;
      return cd;
    }),
    cacheManager.updateUserProfile(userId, { dailyReminded: false }),
  ]);

  cacheManager.smartInvalidateUserCanvas(userId);

  const isMilestone = dayInCycle === 7;
  const titleText = isMilestone
    ? "Pencapaian Spesial: Hadiah Siklus 7 Hari Selesai"
    : "Klaim Hadiah Harian Berhasil";
  const accentColor = isMilestone ? "#FBBF24" : "#34D399";

  const updatedShieldCount = shieldItem
    ? Math.max(0, (shieldItem.count || 1) - (streakMessage.includes("Jimat Pelindung") ? 1 : 0))
    : 0;

  const checklistText = buildChecklistSection({
    isClaimedToday: true,
    currentStreak: newStreak,
    questsCompleted,
    totalQuests,
    shieldCount: updatedShieldCount,
  });

  const desc = [
    `Halo **${displayName}**. ${streakMessage}`,
    "",
    checklistText,
    "",
    `${getStreakCalendarCard(newStreak)}`,
    "",
    `**Perolehan Hadiah (Hari ke-${dayInCycle}):**`,
    `• 🪙 **+${reward.sukamajuCoins.toLocaleString("id-ID")} Sukamaju Koin (SC)**`,
    `• 💬 **+${reward.xp} Chat XP**`,
    reward.scholarshipVouchers > 0 ? `• 🎟️ **+${reward.scholarshipVouchers} Voucher Beasiswa (VB)**` : "",
    reward.bonus ? `• **Bonus Tambahan:** ${reward.bonus}` : "",
    "",
    "-# Tips: Pasang jimat di toko survival agar streak tetap terlindungi jika berhalangan.",
  ].filter(Boolean).join("\n");

  let cardBuf = null;
  try {
    cardBuf = await canvasWorkerPool.execute("renderDailyCard", {
      username: displayName,
      avatarURL: interaction.user.displayAvatarURL ? interaction.user.displayAvatarURL({ extension: "png" }) : null,
      streak: newStreak,
      rewardCoins: reward.sukamajuCoins,
      claimed: true,
      bonusMultiplier: isMilestone ? "1.5x" : "1.0x",
      activeMission: "Misi Harian Komunitas",
      missionProgress: questsCompleted,
      missionTotal: totalQuests,
    });
  } catch (err) {
    logger.warn("[dailyButtons:handleDailyClaim] Render visual canvas gagal: " + (err?.message || err));
  }

  const container = buildContainerV2({
    accentColorHex: accentColor,
    authorName: "Daily Rewards & Streak Hub",
    title: titleText,
    description: desc,
    buttonsRow: buildDailyHubRow(true, updatedShieldCount),
    expression: isMilestone ? "cheers" : "happy",
    footerText: ui.getFooter("core"),
    imageURL: cardBuf ? "attachment://daily_card.png" : null,
  });

  const files = [];
  if (cardBuf) {
    files.push(new AttachmentBuilder(cardBuf, { name: "daily_card.png" }));
  }

    return interaction.editReply({ ...container, files });
  });
}

module.exports = [
  {
    id: "btn_daily_claim",
    label: "daily-claim-digest",
    defer: "update",
    async handler(interaction) {
      return handleDailyClaim(interaction);
    },
  },
  {
    id: "daily_btn_claim",
    label: "daily-claim-hub",
    defer: "update",
    async handler(interaction) {
      return handleDailyClaim(interaction);
    },
  },
  {
    id: "digest_btn_daily",
    label: "daily-claim-digest-alias",
    defer: "update",
    async handler(interaction) {
      return handleDailyClaim(interaction);
    },
  },
  {
    id: "daily_btn_quests",
    label: "daily-quests-status",
    defer: "reply",
    flags: MessageFlags.Ephemeral,
    async handler(interaction) {
      const userId = interaction.user.id;
      const userQuest = await UserQuest.findByPk(userId).catch(() => null);
      const wCount = userQuest ? userQuest.workCount || 0 : 0;
      const dCount = userQuest ? userQuest.dungeonKills || 0 : 0;
      const cCount = userQuest ? userQuest.collectCount || 0 : 0;
      const claimed = userQuest ? userQuest.isClaimed : false;

      const questLines = [
        "📋 **STATUS MISI HARIAN NAURA WILDS:**",
        "",
        `1. **Bekerja di Kota:** \`${wCount}/1 Selesai\` ${wCount >= 1 ? "✅" : "⏳"} *(Gunakan \`/survival work\`)*`,
        `2. **Taklukkan Monster Dungeon:** \`${dCount}/1 Selesai\` ${dCount >= 1 ? "✅" : "⏳"} *(Gunakan \`/survival dungeon\`)*`,
        `3. **Kumpulkan Bahan Alam:** \`${cCount}/3 Selesai\` ${cCount >= 3 ? "✅" : "⏳"} *(Gunakan \`/survival collect\`)*`,
        "",
        "🎁 **Hadiah Penyelesaian Semua Misi:** `+2.500 SC`, `+150 XP`, `+1x Mystery Crate`",
        claimed
          ? "\n✅ *Semua hadiah misi harian telah berhasil diklaim hari ini!*"
          : "\n💡 *Selesaikan ketiga misi di atas lalu jalankan `/survival quest` untuk klaim hadiah!*",
      ].join("\n");

      const questPayload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "Pusat Misi Harian • Naura Wilds",
        title: "🎯 Daftar Misi Harian Aktif",
        description: questLines,
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({
        ...questPayload,
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    },
  },
  {
    id: "daily_btn_shield",
    label: "daily-shield-status",
    defer: "reply",
    flags: MessageFlags.Ephemeral,
    async handler(interaction) {
      const userId = interaction.user.id;
      const profile = await cacheManager.getUserProfile(userId);
      const inv = safeParseInventory(profile?.inventory);
      const shieldItem = findItem(inv, "streak_shield");
      const shieldCount = shieldItem ? (shieldItem.count || 1) : 0;
      const currentStreak = profile?.cooldowns?.daily_streak || 0;

      const shieldDesc = shieldCount > 0
        ? "🛡️ **Jimat Pelindung Streak Aktif!**\n\n" +
          `Kamu memiliki **${shieldCount}x Jimat Pelindung Streak** di tas penyimpanan.\n` +
          "Jika suatu saat kamu berhalangan hadir dan melewatkan login harian (antara 48 s/d 72 jam), jimat ini akan otomatis digunakan untuk menyelamatkan rantai streak milikmu agar tidak tereset ke Hari ke-1.\n\n" +
          `• **Streak Saat Ini:** **${currentStreak} Hari**\n` +
          "• **Status Perlindungan:** **AMAN & AKTIF** 🛡️"
        : "⚪ **Belum Memiliki Pelindung Streak**\n\n" +
          "Kamu saat ini tidak memiliki Jimat Pelindung Streak di tas.\n" +
          "Jika kamu melewatkan login lebih dari 48 jam, streak harianmu akan terputus dan kembali ke Hari ke-1.\n\n" +
          "💡 **Tips:** Dapatkan **Jimat Pelindung Streak** di Toko Survival (`/survival shop`) untuk mengamankan streak panjangmu!";

      const shieldPayload = buildContainerV2({
        accentColorHex: shieldCount > 0 ? "#10B981" : "#F59E0B",
        authorName: "Sistem Proteksi Streak • Naura",
        title: shieldCount > 0 ? "🛡️ Streak Kamu Dilindungi" : "⚠️ Perhatian Streak Harian",
        description: shieldDesc,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply({
        ...shieldPayload,
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    },
  },
];
