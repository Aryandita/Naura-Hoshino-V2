"use strict";

/**
 * @namespace: plugin/utility/daily.js
 * @type: Command
 * @description: Sistem Daily Login Streak & Combo Rewards (Sprint 21 / Retensi P0)
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const cacheManager = require("../../src/managers/cacheManager");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const {
  safeParseInventory,
} = require("../../src/survival/engines/inventoryHelper");

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription(
      "🎁 Klaim hadiah harianmu dan bangun Daily Login Streak! 🔥",
    ),

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

    // ── 1. CEK COOLDOWN (Belum 24 Jam) ───────────────────────────
    if (timeDiff < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - timeDiff;
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      const remainingMinutes = Math.floor(
        (remainingMs % (60 * 60 * 1000)) / (60 * 1000),
      );

      const nextDay = (currentStreak % 7) + 1;
      const nextReward = REWARD_TABLE[nextDay - 1];

      const container = buildContainerV2({
        accentColorHex: "#FBBF24",
        title: "Klaim Harian Dalam Waktu Tunggu",
        description:
          `Halo **${displayName}**. Hadiah harian kamu untuk hari ini telah selesai diambil.\n\n` +
          `Waktu tunggu berikutnya: \`${remainingHours} jam ${remainingMinutes} menit\`\n` +
          `Streak Aktif: **${currentStreak} Hari Berturut-turut**\n\n` +
          `${getStreakCalendarCard(currentStreak)}\n\n` +
          `**Pratinjau Hadiah Berikutnya (Hari ke-${nextDay}):**\n` +
          `• 💵 \`+${nextReward.gold.toLocaleString("id-ID")} Gold\`\n` +
          `• ⭐ \`+${nextReward.starFragments.toLocaleString("id-ID")} Star Fragments\`\n` +
          `• 💬 \`+${nextReward.xp} XP\`\n` +
          (nextReward.bonus ? `• ${nextReward.bonus}\n` : ""),
        expression: "sleepy",
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...container,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    // ── 2. HITUNG STREAK BARU ────────────────────────────────────
    let newStreak = 1;
    let streakMessage = "";

    if (lastDaily === 0) {
      // Pertama kali klaim
      newStreak = 1;
      streakMessage =
        "Selamat datang di klaim harian pertamamu. Masuk setiap hari untuk bonus bertingkat.";
    } else if (timeDiff <= GRACE_PERIOD_MS) {
      // Dalam batas 48 jam -> Streak Berlanjut
      newStreak = currentStreak + 1;
      streakMessage = `Konsistensi luar biasa. Kamu telah login selama **${newStreak} hari berturut-turut**.`;
    } else {
      // Lewat 48 jam -> Cek apakah punya Streak Shield di inventory
      const inv = safeParseInventory(profile.inventory);
      const shieldIndex = inv.findIndex((i) => i && i.id === "streak_shield");

      if (shieldIndex !== -1 && currentStreak > 1) {
        // Gunakan Streak Shield
        inv.splice(shieldIndex, 1);
        await cacheManager.updateProfile(userId, { inventory: inv });
        newStreak = currentStreak + 1;
        streakMessage = `🛡️ **Streak Shield Digunakan.** Streak kamu berhasil dilindungi dan bertambah ke **${newStreak} hari**.`;
      } else {
        // Streak Terputus
        newStreak = 1;
        streakMessage =
          "Streak sebelumnya terhenti karena melewati batas waktu 48 jam. Memulai kembali streak baru.";
      }
    }

    // ── 3. TENTUKAN REWARD HARI INI ─────────────────────────────
    const dayInCycle = ((newStreak - 1) % 7) + 1;
    const reward = REWARD_TABLE[dayInCycle - 1];

    // ── 4. EKSEKUSI REWARD VIA CACHEMANAGER ATOMIK ─────────────────
    await Promise.all([
      // Tambah Gold di wallet & XP Chat
      cacheManager.incrementProfile(userId, "economy_wallet", reward.gold),
      cacheManager.incrementProfile(userId, "leveling_xp", reward.xp),
      // Tambah Star Fragments & Naura Coupons di UserSurvival
      cacheManager.incrementSurvival(
        userId,
        "starFragments",
        reward.starFragments,
      ),
      reward.coupons > 0
        ? cacheManager.incrementSurvival(userId, "coupons", reward.coupons)
        : Promise.resolve(),
      // Perbarui cooldowns JSON secara mutasi aman
      cacheManager.mutateProfileJson(userId, "cooldowns", (cd) => {
        cd.daily = new Date(now).toISOString();
        cd.daily_streak = newStreak;
        return cd;
      }),
      // Reset dailyReminded
      cacheManager.updateProfile(userId, { dailyReminded: false }),
    ]);

    // Smart Canvas cache invalidation
    cacheManager.smartInvalidateUserCanvas(userId);

    // ── 5. RENDER CONTAINER V2 ──────────────────────────────────
    const isMilestone = dayInCycle === 7;
    const titleText = isMilestone
      ? "Pencapaian Spesial: Hadiah Siklus 7 Hari Selesai"
      : "Klaim Hadiah Harian Berhasil";
    const accentColor = isMilestone ? "#FBBF24" : "#34D399";

    const desc =
      `Halo **${displayName}**. ${streakMessage}\n\n` +
      `${getStreakCalendarCard(newStreak)}\n\n` +
      `**Perolehan Hadiah (Hari ke-${dayInCycle}):**\n` +
      `• 💵 **+${reward.gold.toLocaleString("id-ID")} Gold** (Saldo dompet)\n` +
      `• ⭐ **+${reward.starFragments.toLocaleString("id-ID")} Star Fragments**\n` +
      `• 💬 **+${reward.xp} Chat XP**\n` +
      (reward.coupons > 0
        ? `• 🎟️ **+${reward.coupons} Naura Coupon** (Mata uang langka)\n`
        : "") +
      (reward.bonus ? `• **Bonus Tambahan:** ${reward.bonus}\n` : "") +
      `\n-# Tips: Pasang pengingat di /notifications agar streak tetap terjaga.`;

    const successContainer = buildContainerV2({
      accentColorHex: accentColor,
      title: titleText,
      description: desc,
      expression: isMilestone ? "cheers" : "happy",
      footerText: ui.getFooter("core"),
    });

    return interaction.reply({
      ...successContainer,
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
