"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const survivalUI = require("../../utils/survivalUIHelper");

/**
 * Render empty quest state card.
 * @param {string} lang
 * @param {object} [streakInfo]
 * @param {object} [tierInfo]
 * @returns {object}
 */
function renderEmptyQuest(lang = "id", streakInfo = null, tierInfo = null) {
  const isEn = lang === "en";
  const title = isEn ? "Naura Wilds Daily Quest" : "Quest Harian Naura Wilds";
  const desc = isEn
    ? "No active quest. Click the button below to generate a daily quest scaled to your level.\n\nComplete daily tasks to earn Naura Star Fragments, XP, and streak bonuses!"
    : "Belum ada quest aktif. Klik tombol di bawah untuk menghasilkan quest harian yang disesuaikan dengan levelmu.\n\nSelesaikan tugas harian untuk mendapatkan Naura Star Fragments, XP, dan bonus streak!";

  const descLines = [desc];

  if (tierInfo) {
    descLines.push(
      "",
      `🎯 **${isEn ? "Rank Tier" : "Tingkat Kemampuan"}:** ${tierInfo.badge || "🌱"} **${tierInfo.name || "Pemula"}** (Pengali Hadiah: **${tierInfo.multiplier}x**)`,
    );
  }

  if (streakInfo && streakInfo.currentStreak > 0) {
    const streakEmoji =
      streakInfo.currentStreak >= 21
        ? "🏆"
        : streakInfo.currentStreak >= 11
          ? "🌟"
          : streakInfo.currentStreak >= 6
            ? "🔥"
            : streakInfo.currentStreak >= 3
              ? "⚡"
              : "🌱";
    descLines.push(
      "",
      `${streakEmoji} **Streak: ${streakInfo.currentStreak} ${isEn ? "days active" : "hari berturut-turut"}**`,
      `${isEn ? "Best streak" : "Streak terbaik"}: ${streakInfo.maxStreak} hari`,
      `${isEn ? "Active bonus" : "Bonus aktif"}: +${streakInfo.bonusPercent}% NSF (${streakInfo.bonusLabel})`,
    );
  }

  const btnLabel = isEn ? "Generate Daily Quest" : "Buat Quest Harian";

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_dailyquest_generate")
      .setLabel(btnLabel)
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📜"),
    new ButtonBuilder()
      .setCustomId("btn_weeklyquest_view")
      .setLabel(isEn ? "Weekly Board" : "Papan Mingguan")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🗓️"),
  );

  return buildContainerV2({
    accentColorHex: survivalUI.survivalColors.emerald,
    authorName: "NAURA WILDS • Daily Quest",
    title: `📜 ${title}`,
    description: descLines.join("\n"),
    buttonsRow: [buttonRow],
    footerText: survivalUI.getFooter(),
  });
}

/**
 * Render active quest card.
 * @param {object} state
 * @param {string} lang
 * @param {object} [streakInfo]
 * @param {object} [tierInfo]
 * @returns {object}
 */
function renderQuestCard(state, lang = "id", streakInfo = null, tierInfo = null) {
  const isEn = lang === "en";
  const quest = state.quest;
  const progressPercent = Math.min(
    100,
    Math.round(((state.progress || 0) / (quest.target || 1)) * 100),
  );
  const bar = survivalUI.buildVitalsBar({
    current: state.progress || 0,
    target: quest.target || 1,
    length: 10,
  });

  const isComplete = (state.progress || 0) >= (quest.target || 1);
  const claimed = state.claimed;

  const title = isEn ? "Daily Quest Active" : "Quest Harian Aktif";
  const tierBadge = quest.tierBadge || tierInfo?.badge || "🌱";
  const tierName = quest.tier || tierInfo?.name || "Pemula";
  const playerLvl = quest.playerLevel || tierInfo?.tier || 1;

  const rewardParts = [`💎 ${quest.reward.starFragments || 0} NSF`];
  if (quest.reward.survivalXp) rewardParts.push(`🌟 +${quest.reward.survivalXp} XP`);
  if (quest.reward.coupons) rewardParts.push(`🎟️ +${quest.reward.coupons} Kupon`);

  const descLines = [
    `${quest.emoji} **${quest.title}** \`[${tierBadge} ${tierName} • Lv. ${playerLvl}]\``,
    quest.description,
    "",
    `${isEn ? "Progress" : "Progres"}: \`${bar.bar}\` **${state.progress || 0}/${quest.target}** (${progressPercent}%)`,
    `${isEn ? "Rewards" : "Hadiah"}: ${rewardParts.join(" • ")}`,
  ];

  if (streakInfo && streakInfo.bonusPercent > 0) {
    descLines.push(`🔥 Streak bonus: **+${streakInfo.bonusPercent}% NSF** (${streakInfo.bonusLabel})`);
  }

  descLines.push("");

  if (claimed) {
    descLines.push(isEn ? "✅ Quest completed and claimed!" : "✅ Quest sudah selesai & diklaim!");
  } else if (isComplete) {
    descLines.push(
      isEn
        ? "🎉 Quest completed! Claim your rewards below."
        : "🎉 Target tercapai! Ambil hadiahmu sekarang.",
    );
  } else {
    descLines.push(
      isEn
        ? "Lakukan aktivitas survival di atas untuk mengumpulkan progres secara otomatis."
        : "Lakukan aktivitas survival di atas untuk mengumpulkan progres secara otomatis.",
    );
  }

  if (streakInfo && streakInfo.currentStreak > 0) {
    const streakEmoji =
      streakInfo.currentStreak >= 21
        ? "🏆"
        : streakInfo.currentStreak >= 11
          ? "🌟"
          : streakInfo.currentStreak >= 6
            ? "🔥"
            : streakInfo.currentStreak >= 3
              ? "⚡"
              : "🌱";
    descLines.push(
      "",
      `${streakEmoji} **Streak:** ${streakInfo.currentStreak} hari aktif (Terbaik: ${streakInfo.maxStreak})`,
    );
  }

  const buttons = [];

  if (isComplete && !claimed) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("btn_dailyquest_claim")
        .setLabel(isEn ? "Claim Reward" : "Klaim Hadiah")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎁"),
    );
  }

  if (!claimed && !isComplete) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("btn_dailyquest_reroll")
        .setLabel(isEn ? "Reroll Quest" : "Ulangi Quest")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔄"),
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId("btn_weeklyquest_view")
      .setLabel(isEn ? "Weekly Board" : "Papan Mingguan")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🗓️"),
  );

  const buttonRow = new ActionRowBuilder().addComponents(buttons);

  return buildContainerV2({
    accentColorHex: isComplete
      ? survivalUI.survivalColors.moss
      : survivalUI.survivalColors.amber,
    authorName: "NAURA WILDS • Daily Quest",
    title: `📜 ${title}`,
    description: descLines.join("\n"),
    buttonsRow: [buttonRow],
    footerText: survivalUI.getFooter(),
  });
}

/**
 * Render claim result card with streak info and milestone alerts.
 * @param {object} result
 * @param {string} lang
 * @returns {object}
 */
function renderClaimResult(result, lang = "id") {
  const isEn = lang === "en";

  const descLines = [
    result.emoji || "🎁",
    `**${result.title || (isEn ? "Quest Result" : "Hasil Quest")}**`,
    "",
    result.message,
  ];

  if (result.streak && result.streak.currentStreak > 0) {
    const streakEmoji =
      result.streak.currentStreak >= 21
        ? "🏆"
        : result.streak.currentStreak >= 11
          ? "🌟"
          : result.streak.currentStreak >= 6
            ? "🔥"
            : streakInfoEmoji(result.streak.currentStreak);
    descLines.push(
      "",
      `${streakEmoji} **Streak saat ini:** ${result.streak.currentStreak} hari`,
      `🏆 **Streak terbaik:** ${result.streak.maxStreak || 0} hari`,
    );

    if (result.bonusPercent > 0) {
      descLines.push(
        `💰 **Bonus streak:** +${result.bonusPercent}% NSF (+${result.reward?.bonusNsf || 0} NSF)`,
      );
    }
  }

  descLines.push("");

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_dailyquest_view")
      .setLabel(isEn ? "View Daily Quest" : "Lihat Quest Harian")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📜"),
    new ButtonBuilder()
      .setCustomId("btn_weeklyquest_view")
      .setLabel(isEn ? "Weekly Board" : "Papan Mingguan")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🗓️"),
  );

  return buildContainerV2({
    accentColorHex: result.ok
      ? survivalUI.survivalColors.moss
      : survivalUI.survivalColors.danger,
    authorName: "NAURA WILDS • Daily Quest",
    title: result.ok
      ? `🎁 ${isEn ? "Quest Completed!" : "Quest Selesai!"}`
      : `❌ ${isEn ? "Claim Failed" : "Gagal Klaim"}`,
    description: descLines.join("\n"),
    buttonsRow: [buttonRow],
    footerText: survivalUI.getFooter(),
  });
}

function streakInfoEmoji(streak) {
  if (streak >= 11) return "🌟";
  if (streak >= 6) return "🔥";
  if (streak >= 3) return "⚡";
  return "🌱";
}

/**
 * Render Weekly Quest Board (#3).
 * @param {object} board
 * @param {string} [lang='id']
 * @returns {object}
 */
function renderWeeklyBoard(board, lang = "id") {
  const isEn = lang === "en";
  const quests = board.quests || [];
  const completedCount = quests.filter((q) => q.claimed).length;

  const descLines = [
    `Pekan Aktif: \`[${board.weekKey}]\` • Tingkat: **${board.tierName || "Petualang"}**`,
    "Selesaikan tantangan mingguan berhadiah besar dan buka **Peti Berkah Mingguan**!",
    "",
  ];

  const actionButtons = [];

  quests.forEach((q, idx) => {
    const isDone = (q.progress || 0) >= q.target;
    const isClaimed = q.claimed;
    const bar = survivalUI.buildVitalsBar({
      current: q.progress || 0,
      target: q.target,
      length: 8,
    });

    const statusText = isClaimed
      ? "✅ *Sudah Diklaim*"
      : isDone
        ? "🎁 **Siap Diklaim!**"
        : `⏳ Progres: \`${q.progress || 0}/${q.target}\``;

    const rewardParts = [`💎 ${q.reward.starFragments} NSF`, `🌟 +${q.reward.survivalXp} XP`];
    if (q.reward.coupons) rewardParts.push(`🎟️ +${q.reward.coupons} Kupon`);

    descLines.push(
      `**${idx + 1}. ${q.emoji} ${q.title}**`,
      `> ${q.description}`,
      `> \`${bar.bar}\` (${Math.min(100, Math.round(((q.progress || 0) / q.target) * 100))}%) • ${statusText}`,
      `> Hadiah: ${rewardParts.join(" • ")}`,
      "",
    );

    if (isDone && !isClaimed) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`btn_weeklyquest_claim_${idx}`)
          .setLabel(`Klaim Misi #${idx + 1}`)
          .setStyle(ButtonStyle.Success)
          .setEmoji("🎁"),
      );
    }
  });

  // Grand Weekly Completion Box Status
  const allQuestsClaimed = quests.length > 0 && quests.every((q) => q.claimed);
  const grandClaimed = board.grandClaimed;

  descLines.push("───────────────────────────────");
  if (grandClaimed) {
    descLines.push("🏆 **Peti Berkah Mingguan:** ✅ *Sudah Diklaim untuk pekan ini.*");
  } else if (allQuestsClaimed) {
    descLines.push(
      "🏆 **Peti Berkah Mingguan SIAP DIBUKA!**",
      "> Berisi: 💎 **+2500 NSF**, 🎟️ **+3 Kupon**, 🌟 **+800 XP**!",
    );
    actionButtons.unshift(
      new ButtonBuilder()
        .setCustomId("btn_weeklyquest_claim_grand")
        .setLabel("Buka Peti Berkah 🏆")
        .setStyle(ButtonStyle.Success),
    );
  } else {
    descLines.push(
      `🏆 **Peti Berkah Mingguan:** Progres: **${completedCount}/${quests.length} Misi Selesai**`,
      "> Selesaikan semua misi di atas untuk membuka peti bonus spesial!",
    );
  }

  // Tombol navigasi kembali ke daily quest
  actionButtons.push(
    new ButtonBuilder()
      .setCustomId("btn_dailyquest_view")
      .setLabel(isEn ? "Daily Quest" : "Quest Harian")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📜"),
  );

  const buttonRows = [];
  while (actionButtons.length > 0) {
    buttonRows.push(new ActionRowBuilder().addComponents(actionButtons.splice(0, 5)));
  }

  return buildContainerV2({
    accentColorHex: allQuestsClaimed
      ? survivalUI.survivalColors.amber
      : survivalUI.survivalColors.emerald,
    authorName: "NAURA WILDS • Weekly Quest Board",
    title: "🗓️ Papan Misi Mingguan Rimba",
    description: descLines.join("\n"),
    buttonsRow: buttonRows,
    footerText: survivalUI.getFooter(),
  });
}

/**
 * Render claim result for weekly quest or grand chest.
 * @param {object} result
 * @param {string} lang
 * @returns {object}
 */
function renderWeeklyClaimResult(result, lang = "id") {
  const isEn = lang === "en";

  const descLines = [
    result.ok ? "🎉 **Selamat!**" : "❌ **Gagal Mengambil Hadiah**",
    "",
    result.message,
    "",
  ];

  if (result.reward) {
    const rewards = [];
    if (result.reward.starFragments) rewards.push(`💎 **+${result.reward.starFragments} NSF**`);
    if (result.reward.survivalXp) rewards.push(`🌟 **+${result.reward.survivalXp} XP**`);
    if (result.reward.coupons) rewards.push(`🎟️ **+${result.reward.coupons} Naura Coupon**`);
    if (rewards.length > 0) {
      descLines.push("**Hadiah yang Diterima:**", rewards.join("\n"), "");
    }
  }

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_weeklyquest_view")
      .setLabel(isEn ? "Weekly Board" : "Papan Mingguan")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🗓️"),
    new ButtonBuilder()
      .setCustomId("btn_dailyquest_view")
      .setLabel(isEn ? "Daily Quest" : "Quest Harian")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📜"),
  );

  return buildContainerV2({
    accentColorHex: result.ok
      ? survivalUI.survivalColors.moss
      : survivalUI.survivalColors.danger,
    authorName: "NAURA WILDS • Weekly Quest Board",
    title: result.ok ? "🎁 Hadiah Mingguan Berhasil Diambil!" : "❌ Gagal Klaim",
    description: descLines.join("\n"),
    buttonsRow: [buttonRow],
    footerText: survivalUI.getFooter(),
  });
}

module.exports = {
  renderEmptyQuest,
  renderQuestCard,
  renderClaimResult,
  renderWeeklyBoard,
  renderWeeklyClaimResult,
};
