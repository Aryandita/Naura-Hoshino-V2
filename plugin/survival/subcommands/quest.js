"use strict";

/**
 * @module quest
 * @description Subcommand /survival quest - Quest tracker dengan active/completed tabs dan reward claiming.
 * 
 * Fitur Utama:
 * - Active quest listing
 * - Quest progress tracking
 * - Reward claim button
 * - Quest chain navigation
 */


// ============================================================================
// CONSTANTS
// ============================================================================

const UserQuest = require("../../../src/models/UserQuest");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const {
  generateQuestsForUser,
} = require("../../../src/survival/engines/questGenerator");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const currency = require("../../../src/survival/engines/currency");
const {
  rollCouponDrop,
  dropLine,
} = require("../../../src/survival/helpers/couponRewards");

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function parseState(raw) {
  if (typeof raw !== "string") return raw || null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Ikon status memakai wajah Naura: bangga kalau sudah beres, semangat kalau
// tinggal sedikit lagi, dan santai kalau masih panjang jalannya.
function statusIcon(quest) {
  if (quest.claimed) return e("cheers", "\u2705");
  if (quest.current >= quest.target) return e("impressed", "\u2B50");
  return e("thinking", "\u23F3");
}

function renderQuests(list, scEmoji) {
  return list
    .map((q, idx) => {
      const goalBar = ui.ux.buildGoalGradientBar({
        current: q.current || 0,
        target: q.target || 1,
        length: 8,
        lang: "id",
      });
      return (
        `**${idx + 1}.** ${statusIcon(q)} ${q.title}\n` +
        `> \`${goalBar.bar}\` \`${q.current} / ${q.target}\` (${goalBar.percent}%) \u2022 Hadiah: ${scEmoji} **${q.reward} SC**`
      );
    })
    .join("\n\n");
}

module.exports = async function questBoard(interaction, user, survivalData) {
  const today = new Date().toISOString().split("T")[0];
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  todayDate.setDate(
    todayDate.getDate() -
      (todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1),
  );
  const currentWeek = todayDate.toISOString().split("T")[0];

  const profile = await cacheManager.getUserProfile(user.id);

  const [quest] = await UserQuest.findOrCreate({
    where: { userId: user.id },
    defaults: { lastReset: today },
  });

  let state = parseState(quest.questsState);
  let needsSave = false;

  if (!state || !state.daily || !state.weekly) {
    state = generateQuestsForUser(profile, survivalData);
    needsSave = true;
  } else {
    if (state.lastDailyReset !== today) {
      state.daily = generateQuestsForUser(profile, survivalData).daily;
      state.lastDailyReset = today;
      needsSave = true;
    }
    if (state.lastWeeklyReset !== currentWeek) {
      state.weekly = generateQuestsForUser(profile, survivalData).weekly;
      state.lastWeeklyReset = currentWeek;
      needsSave = true;
    }
  }

  // Klaim otomatis semua misi yang sudah tuntas.
  const claimed = [];
  let rewardTotal = 0;
  let weeklyCleared = 0;

  for (const q of state.daily) {
    if (q.current >= q.target && !q.claimed) {
      q.claimed = true;
      rewardTotal += q.reward;
      claimed.push(q.title);
      needsSave = true;
    }
  }

  for (const q of state.weekly) {
    if (q.current >= q.target && !q.claimed) {
      q.claimed = true;
      rewardTotal += q.reward;
      claimed.push(q.title);
      weeklyCleared += 1;
      needsSave = true;
    }
  }

  // Hadiah SC lewat modul mata uang supaya saldo tidak lagi disentuh langsung.
  if (rewardTotal > 0) {
    await currency.reward(
      currency.FRAGMENT,
      { survival: survivalData, profile },
      rewardTotal,
    );
  }

  // Voucher Beasiswa (VB) hanya jatuh dari misi jangka panjang, bukan misi harian,
  // supaya papan misi tidak berubah jadi mesin kupon setiap hari.
  let coupon = { gained: 0 };
  if (weeklyCleared > 0) {
    coupon = await rollCouponDrop("quest_weekly", { survival: survivalData });
  }

  if (needsSave) {
    quest.questsState = state;
    quest.changed("questsState", true);
    quest.lastReset = today;
    // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain.
    await quest.save({ fields: ["questsState", "lastReset"] });
  }

  const scEmoji = currency.emojiOf(currency.FRAGMENT);
  const dailyText =
    renderQuests(state.daily, scEmoji) ||
    "*Belum ada misi harian buat hari ini.*";
  const weeklyText =
    renderQuests(state.weekly, scEmoji) || "*Belum ada misi mingguan.*";

  const userName = ui.ux.resolveUserName(interaction);
  const parts = [
    `Halo Kak **${userName}**! Ini papan misimu hari ini. Selesaikan pelan-pelan ya, hadiahnya Naura kirimkan otomatis begitu tuntas! ✨`,
    "",
    `**${e("read", "\uD83D\uDCC5")} Misi Harian • ${today}**`,
    dailyText,
    "",
    `**${e("impressed", "\uD83D\uDC51")} Misi Mingguan • Minggu ini**`,
    weeklyText,
  ];

  if (rewardTotal > 0) {
    parts.push(
      "",
      `**${e("cheers", "\uD83C\uDF81")} Hebat, Naura ikut bangga!**`,
      `Kak **${userName}** baru saja menyelesaikan:`,
      claimed.map((title) => `- **${title}**`).join("\n"),
      "",
      `Hadiahnya sudah masuk: ${currency.format(currency.FRAGMENT, rewardTotal)}!`,
    );

    const line = dropLine(coupon);
    if (line) {
      parts.push(
        "",
        `**${e("impressed", "\u2728")} Bonus Misi Mingguan**`,
        line,
      );
    } else if (weeklyCleared > 0) {
      parts.push(
        "",
        `${e("shy", "\uD83D\uDE3F")} Naura sudah coba cari voucher beasiswa buat kamu, tapi belum ketemu kali ini. Minggu depan kita coba lagi, ya!`,
      );
    }
  }

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
  const survivalUI = require("../../../src/utils/survivalUIHelper");
  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_dailyquest_view")
      .setLabel("Quest Harian V2")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📜"),
    new ButtonBuilder()
      .setCustomId("btn_weeklyquest_view")
      .setLabel("Papan Mingguan V2")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🗓️"),
  );

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("moss"),
    authorName: "Naura Quest Board",
    title: `${e("read", "\uD83D\uDCDC")} Papan Misi ${userName}`,
    iconURL: user.displayAvatarURL(),
    expression: rewardTotal > 0 ? "success" : "info",
    description: parts.join("\n"),
    buttonsRow: [buttonsRow, survivalUI.buildSurvivalActionRow("gathering", user.id)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply({ ...payload, embeds: [] });
};
