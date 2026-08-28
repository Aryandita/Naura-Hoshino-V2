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

function getStreakTimeline(currentDay) {
  const activeIndex = ((currentDay - 1) % 7) + 1;
  const icons = [];
  for (let i = 1; i <= 7; i++) {
    if (i < activeIndex) {
      icons.push(`✅\`D${i}\``);
    } else if (i === activeIndex) {
      icons.push(`🔥\`[D${i}]\``);
    } else if (i === 7) {
      icons.push(`🌟\`D7\``);
    } else {
      icons.push(`⚪\`D${i}\``);
    }
  }
  return icons.join(" ➔ ");
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

      return interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: buildContainerV2({
          accentColorHex: "#FBBF24",
          title: "⏳ Hadiah Harian Belum Siap!",
          description:
            `Hai **${displayName}**! Kamu sudah mengambil hadiah harianmu hari ini.\n\n` +
            `⏱️ **Bisa diklaim lagi dalam:** \`${remainingHours} jam ${remainingMinutes} menit\`\n` +
            `🔥 **Streak Saat Ini:** \`${currentStreak} Hari\`\n\n` +
            `**Jalur Streak Kamu:**\n${getStreakTimeline(currentStreak)}\n\n` +
            `🎁 **Hadiah Hari Berikutnya (Day ${nextDay}):**\n` +
            `• 💵 \`+${nextReward.gold.toLocaleString("id-ID")} Gold\`\n` +
            `• ⭐ \`+${nextReward.starFragments.toLocaleString("id-ID")} Star Fragments\`\n` +
            `• 💬 \`+${nextReward.xp} XP\`\n` +
            (nextReward.bonus ? `• ${nextReward.bonus}\n` : ""),
          expression: "sleepy",
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // ── 2. HITUNG STREAK BARU ────────────────────────────────────
    let newStreak = 1;
    let streakMessage = "";

    if (lastDaily === 0) {
      // Pertama kali klaim
      newStreak = 1;
      streakMessage =
        "🎉 **Klaim harian pertamamu!** Terus login setiap hari untuk combo reward!";
    } else if (timeDiff <= GRACE_PERIOD_MS) {
      // Dalam batas 48 jam -> Streak Berlanjut!
      newStreak = currentStreak + 1;
      streakMessage = `🔥 **Streak berlanjut!** Kamu sudah login berturut-turut selama **${newStreak} hari**!`;
    } else {
      // Lewat 48 jam -> Cek apakah punya Streak Shield di inventory
      const inv = safeParseInventory(profile.inventory);
      const shieldIndex = inv.findIndex((i) => i && i.id === "streak_shield");

      if (shieldIndex !== -1 && currentStreak > 1) {
        // Gunakan Streak Shield
        inv.splice(shieldIndex, 1);
        await cacheManager.updateProfile(userId, { inventory: inv });
        newStreak = currentStreak + 1;
        streakMessage = `🛡️ **Streak Shield Terpakai!** Streak kamu terselamatkan dan berlanjut ke **${newStreak} hari**!`;
      } else {
        // Streak Terputus
        newStreak = 1;
        streakMessage =
          "⚠️ *Yah, streak kamu terputus karena terlewat lebih dari 48 jam.* Mulai streak baru sekarang!";
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
      ? "🌟 COMBO 7-DAY MILESTONE REWARD! 🌟"
      : "🎁 Hadiah Harian Berhasil Diklaim!";
    const accentColor = isMilestone ? "#FFD700" : "#86EFAC";

    const desc =
      `Hai **${displayName}**! ${streakMessage}\n\n` +
      `**Jalur Streak:**\n${getStreakTimeline(newStreak)}\n\n` +
      `**Hadiah yang Kamu Dapatkan (Day ${dayInCycle}):**\n` +
      `• 💵 **+${reward.gold.toLocaleString("id-ID")} Gold** *(masuk ke dompet)*\n` +
      `• ⭐ **+${reward.starFragments.toLocaleString("id-ID")} Star Fragments**\n` +
      `• 💬 **+${reward.xp} Chat XP**\n` +
      (reward.coupons > 0
        ? `• 🎟️ **+${reward.coupons} Naura Coupon** *(Mata uang langka!)*\n`
        : "") +
      (reward.bonus ? `• **Bonus Spesial:** ${reward.bonus}\n` : "") +
      `\n-# *Tips: Pasang pengingat notifikasi harian di \`/notifications\` agar streak tidak terputus!*`;

    return interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: buildContainerV2({
        accentColorHex: accentColor,
        title: titleText,
        description: desc,
        expression: isMilestone ? "cheers" : "happy",
        footerText: ui.getFooter("core"),
      }),
    });
  },
};
