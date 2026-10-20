"use strict";

/**
 * @namespace: plugin/utility/daily.js
 * @type: Command
 * @description: Interactive Daily Hub (Klaim Harian, Misi, & Proteksi Streak)
 *
 * Mengintegrasikan kartu status checklist interaktif:
 * - [🎁 Klaim Hadiah] / [✅ Hadiah Diklaim]
 * - [📋 Misi Harian] dengan pelacak progres misi aktif
 * - [🛡️ Pelindung Streak] penyelamat rantai streak via item streak_shield
 *
 * Mematuhi prinsip Components V2 dan bebas karakter em-dash (U+2014).
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const cacheManager = require("../../src/managers/cacheManager");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const {
  safeParseInventory,
  findItem,
  takeItemsAtomic,
} = require("../../src/survival/engines/inventoryHelper");
const UserQuest = require("../../src/models/UserQuest");

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 jam
const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 jam sebelum streak putus

// Tabel Hadiah Berjenjang (Day 1 - 7 Milestone Cycle)
const REWARD_TABLE = [
  { day: 1, gold: 1000, starFragments: 500, xp: 50, coupons: 0, bonus: null },
  { day: 2, gold: 1500, starFragments: 750, xp: 75, coupons: 0, bonus: null },
  {
    day: 3,
    gold: 2000,
    starFragments: 1000,
    xp: 100,
    coupons: 0,
    bonus: "📦 1x Mystery Lootbox",
  },
  { day: 4, gold: 2500, starFragments: 1500, xp: 150, coupons: 0, bonus: null },
  {
    day: 5,
    gold: 3500,
    starFragments: 2000,
    xp: 200,
    coupons: 1,
    bonus: "🎟️ 1x Naura Coupon",
  },
  { day: 6, gold: 5000, starFragments: 2500, xp: 250, coupons: 0, bonus: null },
  {
    day: 7,
    gold: 10000,
    starFragments: 5000,
    xp: 500,
    coupons: 3,
    bonus: "🌟 3x Naura Coupon + 🎴 Rare Card Pack",
  },
];

function getStreakCalendarCard(currentDay) {
  const activeIndex = ((currentDay - 1) % 7) + 1;
  const days = [
    { day: 1, label: "Day 1", reward: "1.000 NSF", icon: "🪙" },
    { day: 2, label: "Day 2", reward: "1.500 NSF", icon: "🪙" },
    { day: 3, label: "Day 3", reward: "Mystery Box", icon: "📦" },
    { day: 4, label: "Day 4", reward: "2.500 NSF", icon: "🪙" },
    { day: 5, label: "Day 5", reward: "1x Kupon", icon: "🎟️" },
    { day: 6, label: "Day 6", reward: "5.000 NSF", icon: "🪙" },
    { day: 7, label: "Day 7", reward: "Jackpot Kosmik", icon: "👑" },
  ];

  const stampRow1 = days
    .slice(0, 4)
    .map((d) => {
      const isClaimed = d.day < activeIndex;
      const isToday = d.day === activeIndex;
      const badge = isClaimed ? "✅" : isToday ? "🔥" : "🔒";
      return `\`[${d.label}]\` ${badge} ${d.icon} **${d.reward}**`;
    })
    .join("  •  ");

  const stampRow2 = days
    .slice(4)
    .map((d) => {
      const isClaimed = d.day < activeIndex;
      const isToday = d.day === activeIndex;
      const badge = isClaimed ? "✅" : isToday ? "🔥" : "🔒";
      return `\`[${d.label}]\` ${badge} ${d.icon} **${d.reward}**`;
    })
    .join("  •  ");

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("🎁 Klaim hadiah harian, pantau misi, dan kelola Daily Login Streak! 🔥"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const displayName =
      interaction.user.displayName || interaction.user.username;
    const now = Date.now();

    const profile = await cacheManager.getUserProfile(userId);
    const cooldowns = profile.cooldowns || {};
    const lastDaily = cooldowns.daily ? new Date(cooldowns.daily).getTime() : 0;
    const currentStreak = cooldowns.daily_streak || 0;
    const timeDiff = now - lastDaily;
    const isClaimedToday = timeDiff < COOLDOWN_MS;

    const inv = safeParseInventory(profile.inventory);
    const shieldItem = findItem(inv, "streak_shield");
    const shieldCount = shieldItem ? (shieldItem.count || 1) : 0;

    // Ambil data misi harian untuk checklist
    const userQuest = await UserQuest.findByPk(userId).catch(() => null);
    let questsCompleted = 0;
    const totalQuests = 3;
    if (userQuest) {
      if (userQuest.workCount >= 1) questsCompleted++;
      if (userQuest.dungeonKills >= 1) questsCompleted++;
      if (userQuest.collectCount >= 3) questsCompleted++;
      if (userQuest.isClaimed) questsCompleted = 3;
    }

    // ─────────────────────────────────────────────────────────────
    // FUNGSI EKSEKUSI KLAIM HADIAH HARIAN
    // ─────────────────────────────────────────────────────────────
    const executeClaim = async () => {
      let newStreak = 1;
      let streakMessage = "";

      if (lastDaily === 0) {
        newStreak = 1;
        streakMessage = "Selamat datang di klaim harian pertamamu. Masuk setiap hari untuk bonus bertingkat.";
      } else if (timeDiff <= GRACE_PERIOD_MS) {
        newStreak = currentStreak + 1;
        streakMessage = `Konsistensi luar biasa. Kamu telah login selama **${newStreak} hari berturut-turut**.`;
      } else {
        // Cek Jimat Pelindung Streak jika lewat batas 48 jam
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
        cacheManager.incrementUserProfile(userId, "economy_wallet", reward.gold),
        cacheManager.incrementUserProfile(userId, "leveling_xp", reward.xp),
        cacheManager.incrementUserSurvival(userId, "starFragments", reward.starFragments),
        reward.coupons > 0
          ? cacheManager.incrementUserSurvival(userId, "coupons", reward.coupons)
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

      const updatedShieldCount = shieldItem ? Math.max(0, (shieldItem.count || 1) - (streakMessage.includes("Jimat Pelindung") ? 1 : 0)) : 0;
      const checklistText = buildChecklistSection({
        isClaimedToday: true,
        currentStreak: newStreak,
        questsCompleted,
        totalQuests,
        shieldCount: updatedShieldCount,
      });

      const desc = [
        `Halo **${displayName}**. ${streakMessage}`,
        ``,
        checklistText,
        ``,
        `${getStreakCalendarCard(newStreak)}`,
        ``,
        `**Perolehan Hadiah (Hari ke-${dayInCycle}):**`,
        `• 💵 **+${reward.gold.toLocaleString("id-ID")} Gold** (Saldo dompet)`,
        `• ⭐ **+${reward.starFragments.toLocaleString("id-ID")} Star Fragments**`,
        `• 💬 **+${reward.xp} Chat XP**`,
        reward.coupons > 0 ? `• 🎟️ **+${reward.coupons} Naura Coupon** (Mata uang langka)` : "",
        reward.bonus ? `• **Bonus Tambahan:** ${reward.bonus}` : "",
        ``,
        `-# Tips: Pasang jimat di toko survival agar streak tetap terlindungi jika berhalangan.`,
      ].filter(Boolean).join("\n");

      return buildContainerV2({
        accentColorHex: accentColor,
        authorName: "Daily Rewards & Streak Hub",
        title: titleText,
        description: desc,
        buttonsRow: buildDailyHubRow(true, updatedShieldCount),
        expression: isMilestone ? "cheers" : "happy",
        footerText: ui.getFooter("core"),
      });
    };

    // ─────────────────────────────────────────────────────────────
    // TAMPILAN HUB KETIKA MASIH DALAM WAKTU TUNGGU (COOLDOWN)
    // ─────────────────────────────────────────────────────────────
    if (isClaimedToday) {
      const remainingMs = COOLDOWN_MS - timeDiff;
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      const remainingMinutes = Math.floor(
        (remainingMs % (60 * 60 * 1000)) / (60 * 1000),
      );

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
        ``,
        checklistText,
        ``,
        `⏳ **Waktu Tunggu:** \`${remainingHours} jam ${remainingMinutes} menit\` lagi`,
        ``,
        `${getStreakCalendarCard(currentStreak)}`,
        ``,
        `**Pratinjau Hadiah Berikutnya (Hari ke-${nextDay}):**`,
        `• 💵 \`+${nextReward.gold.toLocaleString("id-ID")} Gold\``,
        `• ⭐ \`+${nextReward.starFragments.toLocaleString("id-ID")} Star Fragments\``,
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

      const reply = await interaction.reply({
        ...container,
        fetchReply: true,
      });

      setupDailyCollector(reply, interaction, userId, questsCompleted, totalQuests, shieldCount, currentStreak);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // JIKA BELUM KLAIM: JALANKAN KLAIM & TAMPILKAN HUB
    // ─────────────────────────────────────────────────────────────
    const claimPayload = await executeClaim();
    const reply = await interaction.reply({
      ...claimPayload,
      fetchReply: true,
    });

    setupDailyCollector(reply, interaction, userId, questsCompleted, totalQuests, shieldCount, currentStreak + 1);
  },
};

/**
 * Setup collector untuk tombol interaktif Daily Hub
 */
function setupDailyCollector(message, interaction, userId, questsCompleted, totalQuests, shieldCount, streak) {
  if (!message || !message.createMessageComponentCollector) return;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === userId,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    // 1. Tombol Misi Harian
    if (i.customId === "daily_btn_quests") {
      const userQuest = await UserQuest.findByPk(userId).catch(() => null);
      const wCount = userQuest ? userQuest.workCount || 0 : 0;
      const dCount = userQuest ? userQuest.dungeonKills || 0 : 0;
      const cCount = userQuest ? userQuest.collectCount || 0 : 0;
      const claimed = userQuest ? userQuest.isClaimed : false;

      const questLines = [
        `📋 **STATUS MISI HARIAN NAURA WILDS:**`,
        ``,
        `1. **Bekerja di Kota:** \`${wCount}/1 Selesai\` ${wCount >= 1 ? "✅" : "⏳"} *(Gunakan \`/survival work\`)*`,
        `2. **Taklukkan Monster Dungeon:** \`${dCount}/1 Selesai\` ${dCount >= 1 ? "✅" : "⏳"} *(Gunakan \`/survival dungeon\`)*`,
        `3. **Kumpulkan Bahan Alam:** \`${cCount}/3 Selesai\` ${cCount >= 3 ? "✅" : "⏳"} *(Gunakan \`/survival collect\`)*`,
        ``,
        `🎁 **Hadiah Penyelesaian Semua Misi:** \`+2.500 NSF\`, \`+150 XP\`, \`+1x Mystery Crate\``,
        claimed ? `\n✅ *Semua hadiah misi harian telah berhasil diklaim hari ini!*` : `\n💡 *Selesaikan ketiga misi di atas lalu jalankan \`/survival quest\` untuk klaim hadiah!*`,
      ].join("\n");

      const questPayload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "Pusat Misi Harian • Naura Wilds",
        title: "🎯 Daftar Misi Harian Aktif",
        description: questLines,
        footerText: ui.getFooter("survival"),
      });

      return i.reply({
        ...questPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    // 2. Tombol Pelindung Streak
    if (i.customId === "daily_btn_shield") {
      const shieldDesc = shieldCount > 0
        ? `🛡️ **Jimat Pelindung Streak Aktif!**\n\n` +
          `Kamu memiliki **${shieldCount}x Jimat Pelindung Streak** di tas penyimpanan.\n` +
          `Jika suatu saat kamu berhalangan hadir dan melewatkan login harian (antara 48 s/d 72 jam), jimat ini akan otomatis digunakan untuk menyelamatkan rantai streak milikmu agar tidak tereset ke Hari ke-1.\n\n` +
          `• **Streak Saat Ini:** **${streak} Hari**\n` +
          `• **Status Perlindungan:** **AMAN & AKTIF** 🛡️`
        : `⚪ **Belum Memiliki Pelindung Streak**\n\n` +
          `Kamu saat ini tidak memiliki Jimat Pelindung Streak di tas.\n` +
          `Jika kamu melewatkan login lebih dari 48 jam, streak harianmu akan terputus dan kembali ke Hari ke-1.\n\n` +
          `💡 **Tips:** Dapatkan **Jimat Pelindung Streak** di Toko Survival (\`/survival shop\`) untuk mengamankan streak panjangmu!`;

      const shieldPayload = buildContainerV2({
        accentColorHex: shieldCount > 0 ? "#10B981" : "#F59E0B",
        authorName: "Sistem Proteksi Streak • Naura",
        title: shieldCount > 0 ? "🛡️ Streak Kamu Dilindungi" : "⚠️ Perhatian Streak Harian",
        description: shieldDesc,
        footerText: ui.getFooter("core"),
      });

      return i.reply({
        ...shieldPayload,
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}
