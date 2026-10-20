"use strict";

const cacheManager = require("../../managers/cacheManager");
const { addItemsAtomic } = require("./inventoryHelper");
const survivalLeveling = require("./survivalLeveling");

const DAILY_QUEST_STATE = "daily_quest";
const STREAK_STATE = "daily_quest_streak";
const WEEKLY_QUEST_STATE = "weekly_quest_board";

// Bonus streak persentase berdasarkan hari berturut-turut
const STREAK_BONUS_TIERS = [
  { minStreak: 1, bonusPercent: 0, label: "Mulai" },
  { minStreak: 3, bonusPercent: 25, label: "Semangat" },
  { minStreak: 6, bonusPercent: 50, label: "Terus" },
  { minStreak: 11, bonusPercent: 75, label: "Luar Biasa" },
  { minStreak: 21, bonusPercent: 100, label: "Legendaris" },
];

// Milestone streak berhadiah khusus kupon, Star Fragments, dan XP ekstra (3/7/14/30 hari)
const STREAK_MILESTONES = {
  3: { coupons: 1, bonusXp: 100, bonusNsf: 250, title: "🌟 Permulaan Hebat (3 Hari)" },
  7: { coupons: 1, bonusXp: 200, bonusNsf: 500, title: "🔥 Semangat Membara (7 Hari)" },
  14: { coupons: 2, bonusXp: 500, bonusNsf: 1000, title: "⚡ Petualang Gigih (14 Hari)" },
  30: { coupons: 5, bonusXp: 1200, bonusNsf: 2500, title: "👑 Legenda Tanpa Cuti (30 Hari)" },
};

function getStreakBonusPercent(streak) {
  let bonus = 0;
  let label = STREAK_BONUS_TIERS[0].label;
  for (const tier of STREAK_BONUS_TIERS) {
    if (streak >= tier.minStreak) {
      bonus = tier.bonusPercent;
      label = tier.label;
    } else {
      break;
    }
  }
  return { bonusPercent: bonus, label };
}

/**
 * Penskalaan kesulitan dan hadiah quest berdasarkan Survival Level pemain.
 * @param {number} level
 * @returns {{ tier: number, name: string, multiplier: number, bonusXp: number, couponChance: number }}
 */
function getTierByLevel(level) {
  const lvl = parseInt(level, 10) || 1;
  if (lvl < 10) {
    return {
      tier: 1,
      name: "Pemula",
      badge: "🌱",
      multiplier: 1.0,
      bonusXp: 40,
      couponChance: 0,
    };
  }
  if (lvl < 25) {
    return {
      tier: 2,
      name: "Petualang",
      badge: "🧭",
      multiplier: 1.5,
      bonusXp: 90,
      couponChance: 0,
    };
  }
  if (lvl < 40) {
    return {
      tier: 3,
      name: "Veteran",
      badge: "⚔️",
      multiplier: 2.2,
      bonusXp: 180,
      couponChance: 0.25,
    };
  }
  return {
    tier: 4,
    name: "Legenda",
    badge: "👑",
    multiplier: 3.0,
    bonusXp: 350,
    couponChance: 1.0,
  };
}

const QUEST_TEMPLATES = [
  {
    id: "gather_wood",
    title: "Kumpulkan Kayu",
    description: "Tebang pohon di hutan pinus untuk stok perapian dan kerajinan.",
    type: "gather",
    baseTarget: 5,
    baseRewardNsf: 100,
    emoji: "🪵",
  },
  {
    id: "mine_stone",
    title: "Tambang Batu & Bijih",
    description: "Gali batu dan mineral di gua pertambangan untuk bahan tempa.",
    type: "mine",
    baseTarget: 3,
    baseRewardNsf: 150,
    emoji: "⛏️",
  },
  {
    id: "catch_fish",
    title: "Menangkap Ikan",
    description: "Pancing ikan di sungai atau pesisir pantai untuk cadangan ransum.",
    type: "fish",
    baseTarget: 2,
    baseRewardNsf: 120,
    emoji: "🎣",
  },
  {
    id: "eat_food",
    title: "Konsumsi Nutrisi",
    description: "Makan atau minum bekal lezat untuk memulihkan vitalitas tubuh.",
    type: "consume",
    baseTarget: 3,
    baseRewardNsf: 80,
    emoji: "🍎",
  },
  {
    id: "work_daily",
    title: "Bekerja di Kota",
    description: "Selesaikan giliran kerja di kota untuk membantu perputaran ekonomi.",
    type: "work",
    baseTarget: 1,
    baseRewardNsf: 200,
    emoji: "💼",
  },
  {
    id: "collect_daily",
    title: "Klaim & Panen Harian",
    description: "Ambil hasil panen kebun atau bekal logistik harianmu.",
    type: "collect",
    baseTarget: 1,
    baseRewardNsf: 100,
    emoji: "📦",
  },
  {
    id: "craft_item",
    title: "Keahlian Merakit",
    description: "Rakit peralatan atau perlengkapan bertualang di meja kerja.",
    type: "craft",
    baseTarget: 1,
    baseRewardNsf: 160,
    emoji: "🔨",
  },
  {
    id: "study_session",
    title: "Asah Pengetahuan",
    description: "Belajar atau ikuti ujian di kampus untuk menambah wawasan.",
    type: "study",
    baseTarget: 1,
    baseRewardNsf: 140,
    emoji: "📚",
  },
  {
    id: "rest_recover",
    title: "Rehat & Pemulihan",
    description: "Istirahat tidur di kasur untuk mengembalikan kesegaran pikiran.",
    type: "rest",
    baseTarget: 1,
    baseRewardNsf: 90,
    emoji: "🛏️",
  },
  {
    id: "pet_care",
    title: "Kasih Sayang Peliharaan",
    description: "Beri makan atau latih hewan peliharaan setiamu.",
    type: "pet",
    baseTarget: 2,
    baseRewardNsf: 130,
    emoji: "🐾",
  },
  {
    id: "dungeon_exp",
    title: "Penjelajahan Gua Bahaya",
    description: "Hadapi monster di dungeon untuk melindungi warga sekitar.",
    type: "dungeon",
    baseTarget: 1,
    baseRewardNsf: 250,
    emoji: "⚔️",
  },
];

const WEEKLY_TEMPLATES = [
  {
    id: "weekly_gather_master",
    title: "Penguasa Sumber Daya Alam",
    description: "Kumpulkan total 25 material dari alam liar (kayu, batu, atau ikan).",
    type: "gather",
    baseTarget: 25,
    reward: { starFragments: 1200, survivalXp: 300, coupons: 1 },
    emoji: "🌲",
  },
  {
    id: "weekly_hard_worker",
    title: "Dedikasi Warga Produktif",
    description: "Bekerja, layani pelanggan di kafe, atau belajar sebanyak 8 kali.",
    type: "work",
    baseTarget: 8,
    reward: { starFragments: 1500, survivalXp: 350, coupons: 1 },
    emoji: "💼",
  },
  {
    id: "weekly_wild_explorer",
    title: "Penjelajah Rimba Berani",
    description: "Taklukkan lantai dungeon, rakit perlengkapan, atau latih peliharaan 5 kali.",
    type: "adventure",
    baseTarget: 5,
    reward: { starFragments: 1800, survivalXp: 450, coupons: 1 },
    emoji: "🛡️",
  },
];

const GRAND_WEEKLY_REWARD = {
  starFragments: 2500,
  survivalXp: 800,
  coupons: 3,
  title: "Peti Berkah Mingguan Naura",
  emoji: "🏆",
};

function getRandomQuest() {
  return QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
}

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayKey() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return yesterday.toISOString().split("T")[0];
}

/**
 * Mendapatkan penanda awal pekan (Senin 00:00 UTC) sebagai kunci reset mingguan.
 */
function getWeeklyResetString() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
  return d.toISOString().split("T")[0];
}

async function getStreakState(userId) {
  const profile = await cacheManager.getUserProfile(userId);
  const rpgState = profile?.rpg_state || {};
  return (
    rpgState[STREAK_STATE] || {
      currentStreak: 0,
      maxStreak: 0,
      lastClaimDate: null,
      totalClaims: 0,
      claimedMilestones: [],
    }
  );
}

async function updateStreakState(userId, streakState) {
  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
    st[STREAK_STATE] = streakState;
    return st;
  });
}

function calculateNewStreak(oldStreak, lastClaimDate) {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();

  if (!lastClaimDate) {
    return { currentStreak: 1, maxStreak: Math.max(1, oldStreak?.maxStreak || 0) };
  }

  if (lastClaimDate === yesterday) {
    const newCurrent = (oldStreak?.currentStreak || 0) + 1;
    return {
      currentStreak: newCurrent,
      maxStreak: Math.max(newCurrent, oldStreak?.maxStreak || 0),
    };
  }

  if (lastClaimDate === today) {
    return {
      currentStreak: oldStreak?.currentStreak || 0,
      maxStreak: oldStreak?.maxStreak || 0,
    };
  }

  return { currentStreak: 1, maxStreak: Math.max(1, oldStreak?.maxStreak || 0) };
}

async function getQuestState(userId) {
  const profile = await cacheManager.getUserProfile(userId);
  const rpgState = profile?.rpg_state || {};
  const questState = rpgState[DAILY_QUEST_STATE] || {};
  const todayKey = getTodayKey();

  if (questState.date !== todayKey) {
    return {
      date: todayKey,
      quest: null,
      progress: 0,
      claimed: false,
      isNew: true,
    };
  }

  return {
    date: questState.date,
    quest: questState.quest || null,
    progress: questState.progress || 0,
    claimed: questState.claimed || false,
    isNew: false,
  };
}

/**
 * Menghasilkan quest harian baru dengan tingkat kesulitan berskala level pemain.
 */
async function generateDailyQuest(userId) {
  const state = await getQuestState(userId);

  if (state.quest && !state.claimed) {
    return {
      ok: false,
      reason: "QUEST_ALREADY_ACTIVE",
      message: "Kakak sudah memiliki quest aktif hari ini. Selesaikan dulu sebelum menggantinya!",
    };
  }

  const survival = await cacheManager.getUserSurvival(userId);
  const playerLevel = survival?.survival_level || 1;
  const tier = getTierByLevel(playerLevel);

  const template = getRandomQuest();
  const target = Math.max(1, Math.round(template.baseTarget * tier.multiplier));
  const starFragments = Math.round(template.baseRewardNsf * tier.multiplier);

  const coupons = Math.random() < tier.couponChance ? 1 : 0;

  const newState = {
    date: getTodayKey(),
    quest: {
      id: template.id,
      title: template.title,
      description: template.description,
      type: template.type,
      target,
      reward: {
        starFragments,
        survivalXp: tier.bonusXp,
        coupons,
      },
      emoji: template.emoji,
      tier: tier.name,
      tierBadge: tier.badge,
      playerLevel,
    },
    progress: 0,
    claimed: false,
  };

  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
    st[DAILY_QUEST_STATE] = newState;
    return st;
  });

  return { ok: true, quest: newState.quest, tier };
}

async function claimDailyQuestReward(userId) {
  const state = await getQuestState(userId);

  if (!state.quest) {
    return { ok: false, reason: "NO_ACTIVE_QUEST", message: "Tidak ada quest aktif saat ini." };
  }

  if (state.claimed) {
    return { ok: false, reason: "ALREADY_CLAIMED", message: "Hadiah quest harian ini sudah diklaim." };
  }

  if (state.progress < state.quest.target) {
    return {
      ok: false,
      reason: "QUEST_NOT_COMPLETE",
      message: `Quest belum selesai! Progres: ${state.progress}/${state.quest.target}`,
    };
  }

  // Hitung streak dan bonus
  const streakState = await getStreakState(userId);
  const newStreak = calculateNewStreak(streakState, streakState.lastClaimDate);
  const { bonusPercent, label } = getStreakBonusPercent(newStreak.currentStreak);

  const reward = state.quest.reward;
  const itemsToAdd = [];
  let bonusNsf = 0;

  // 1. Alokasi Star Fragments (Base + Streak Bonus)
  const baseNsf = Number(reward.starFragments) || 0;
  if (baseNsf > 0) {
    bonusNsf = Math.floor((baseNsf * bonusPercent) / 100);
    const totalNsf = baseNsf + bonusNsf;
    await cacheManager.incrementUserSurvival(userId, "starFragments", totalNsf);
  }

  // 2. Alokasi Survival XP
  const xpReward = Number(reward.survivalXp) || 0;
  if (xpReward > 0) {
    await survivalLeveling.addPlayerXP(userId, xpReward);
  }

  // 3. Alokasi Kupon dari Tier Hadiah (jika ada)
  let extraCoupons = Number(reward.coupons) || 0;

  // 4. Periksa Milestone Streak (7, 14, 30 hari)
  const claimedMilestones = Array.isArray(streakState.claimedMilestones)
    ? [...streakState.claimedMilestones]
    : [];
  let milestoneAchieved = null;

  for (const [daysStr, mData] of Object.entries(STREAK_MILESTONES)) {
    const days = parseInt(daysStr, 10);
    if (newStreak.currentStreak >= days && !claimedMilestones.includes(days)) {
      claimedMilestones.push(days);
      extraCoupons += mData.coupons;
      if (mData.bonusXp > 0) {
        await survivalLeveling.addPlayerXP(userId, mData.bonusXp);
      }
      if (mData.bonusNsf > 0) {
        bonusNsf += mData.bonusNsf;
        await cacheManager.incrementUserSurvival(userId, "starFragments", mData.bonusNsf);
      }
      milestoneAchieved = mData;
      break;
    }
  }

  if (extraCoupons > 0) {
    await cacheManager.incrementUserSurvival(userId, "coupons", extraCoupons);
  }

  if (itemsToAdd.length > 0) {
    await addItemsAtomic(userId, itemsToAdd);
  }

  // Tandai quest sebagai claimed
  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
    if (!st[DAILY_QUEST_STATE]) return st;
    st[DAILY_QUEST_STATE].claimed = true;
    return st;
  });

  // Simpan status streak terbaru
  const updatedStreak = {
    currentStreak: newStreak.currentStreak,
    maxStreak: newStreak.maxStreak,
    lastClaimDate: getTodayKey(),
    totalClaims: (streakState.totalClaims || 0) + 1,
    claimedMilestones,
  };
  await updateStreakState(userId, updatedStreak);

  const bonusText = bonusPercent > 0 ? ` (+${bonusPercent}% streak = +${bonusNsf} NSF)` : "";
  const milestoneText = milestoneAchieved
    ? `\n🎉 **Milestone Tercapai!** ${milestoneAchieved.title} (+${milestoneAchieved.coupons} Kupon)`
    : "";

  return {
    ok: true,
    reward: {
      ...reward,
      bonusNsf,
      totalNsf: baseNsf + bonusNsf,
      coupons: extraCoupons,
      streak: newStreak.currentStreak,
    },
    streak: newStreak,
    bonusPercent,
    bonusLabel: label,
    milestoneAchieved,
    message: `Quest harian selesai! Hadiah telah dikirimkan.${bonusText}${milestoneText}`,
  };
}

async function getStreakInfo(userId) {
  const streakState = await getStreakState(userId);
  const { bonusPercent, label } = getStreakBonusPercent(streakState.currentStreak || 0);
  return {
    currentStreak: streakState.currentStreak || 0,
    maxStreak: streakState.maxStreak || 0,
    totalClaims: streakState.totalClaims || 0,
    lastClaimDate: streakState.lastClaimDate || null,
    bonusPercent,
    bonusLabel: label,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY QUEST BOARD SYSTEM (#3)
// ─────────────────────────────────────────────────────────────────────────────

async function getWeeklyQuestState(userId) {
  const profile = await cacheManager.getUserProfile(userId);
  const rpgState = profile?.rpg_state || {};
  const board = rpgState[WEEKLY_QUEST_STATE];
  const currentWeek = getWeeklyResetString();

  if (!board || board.weekKey !== currentWeek) {
    const survival = await cacheManager.getUserSurvival(userId);
    const playerLevel = survival?.survival_level || 1;
    const tier = getTierByLevel(playerLevel);

    const quests = WEEKLY_TEMPLATES.map((tmpl) => {
      const target = Math.max(3, Math.round(tmpl.baseTarget * tier.multiplier));
      const starFragments = Math.round(tmpl.reward.starFragments * tier.multiplier);
      const survivalXp = Math.round(tmpl.reward.survivalXp * tier.multiplier);

      return {
        id: tmpl.id,
        title: tmpl.title,
        description: tmpl.description,
        type: tmpl.type,
        target,
        progress: 0,
        reward: {
          starFragments,
          survivalXp,
          coupons: tmpl.reward.coupons || 0,
        },
        emoji: tmpl.emoji,
        claimed: false,
      };
    });

    const newBoard = {
      weekKey: currentWeek,
      playerLevel,
      tierName: tier.name,
      quests,
      grandClaimed: false,
    };

    await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
      st[WEEKLY_QUEST_STATE] = newBoard;
      return st;
    });

    return newBoard;
  }

  return board;
}

async function claimWeeklyQuestReward(userId, questIndex) {
  const board = await getWeeklyQuestState(userId);
  const idx = parseInt(questIndex, 10);

  if (isNaN(idx) || idx < 0 || idx >= board.quests.length) {
    return { ok: false, reason: "INVALID_QUEST", message: "Quest mingguan tidak valid." };
  }

  const quest = board.quests[idx];
  if (quest.claimed) {
    return { ok: false, reason: "ALREADY_CLAIMED", message: "Hadiah quest mingguan ini sudah diambil." };
  }

  if (quest.progress < quest.target) {
    return {
      ok: false,
      reason: "QUEST_NOT_COMPLETE",
      message: `Misi belum selesai! Progres: ${quest.progress}/${quest.target}`,
    };
  }

  const reward = quest.reward;
  const nsfAmount = Number(reward.starFragments) || 0;
  const xpAmount = Number(reward.survivalXp) || 0;
  const couponAmount = Number(reward.coupons) || 0;

  if (nsfAmount > 0) {
    await cacheManager.incrementUserSurvival(userId, "starFragments", nsfAmount);
  }

  if (xpAmount > 0) {
    await survivalLeveling.addPlayerXP(userId, xpAmount);
  }

  if (couponAmount > 0) {
    await cacheManager.incrementUserSurvival(userId, "coupons", couponAmount);
  }

  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
    if (st[WEEKLY_QUEST_STATE]?.quests?.[idx]) {
      st[WEEKLY_QUEST_STATE].quests[idx].claimed = true;
    }
    return st;
  });

  return {
    ok: true,
    reward: {
      starFragments: nsfAmount,
      survivalXp: xpAmount,
      coupons: couponAmount,
    },
    quest,
    message: `Berhasil menyelesaikan **${quest.title}**! Hadiah telah masuk ke kantongmu.`,
  };
}

async function claimWeeklyGrandReward(userId) {
  const board = await getWeeklyQuestState(userId);

  if (board.grandClaimed) {
    return { ok: false, reason: "ALREADY_CLAIMED", message: "Peti Berkah Mingguan sudah diklaim pekan ini." };
  }

  const allComplete = board.quests.every((q) => q.claimed);
  if (!allComplete) {
    return {
      ok: false,
      reason: "NOT_ALL_COMPLETED",
      message: "Selesaikan dan klaim seluruh 3 misi mingguan terlebih dahulu untuk membuka Peti Berkah Mingguan!",
    };
  }

  const reward = GRAND_WEEKLY_REWARD;
  await cacheManager.incrementUserSurvival(userId, "starFragments", reward.starFragments);
  await cacheManager.incrementUserSurvival(userId, "coupons", reward.coupons);
  await survivalLeveling.addPlayerXP(userId, reward.survivalXp);

  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
    if (st[WEEKLY_QUEST_STATE]) {
      st[WEEKLY_QUEST_STATE].grandClaimed = true;
    }
    return st;
  });

  return {
    ok: true,
    reward,
    message: `🏆 **Luar Biasa!** Kamu telah membuka **${reward.title}**! Mendapatkan +${reward.starFragments} NSF, +${reward.coupons} Kupon, dan +${reward.survivalXp} XP!`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-TRACKING ENGINE (#2): Menangkap Semua Aksi Survival Secara Otomatis
// ─────────────────────────────────────────────────────────────────────────────

function actionMatches(questType, action) {
  const qType = (questType || "").toLowerCase();
  const act = (action || "").toLowerCase();

  if (qType === act) return true;

  // Gathering / Collecting
  if (qType === "gather" && (act === "chop" || act === "collect" || act === "gather")) return true;
  if (qType === "mine" && (act === "mine" || act === "mine_stone" || act === "collect")) return true;
  if (qType === "fish" && (act === "fish" || act === "catch_fish" || act === "collect")) return true;

  // Consumption
  if (qType === "consume" && (act === "consume" || act === "eat" || act === "drink" || act === "rest")) return true;

  // Work & City
  if (qType === "work" && (act.startsWith("work") || act.startsWith("cafe") || act === "study")) return true;

  // Crafting
  if (qType === "craft" && (act === "craft" || act === "forge" || act === "enchant")) return true;

  // Study
  if (qType === "study" && (act === "study" || act === "exam")) return true;

  // Rest
  if (qType === "rest" && (act === "rest" || act === "sleep")) return true;

  // Pet
  if (qType === "pet" && act.startsWith("pet")) return true;

  // Adventure & Dungeon
  if (qType === "dungeon" && (act === "dungeon" || act === "boss_kill" || act === "abyss")) return true;
  if (qType === "adventure" && (act === "dungeon" || act === "boss_kill" || act === "craft" || act.startsWith("pet") || act === "travel" || act === "heist")) {
    return true;
  }

  // Generic collect
  if (qType === "collect" && (act === "collect" || act === "collect_daily" || act === "farm_harvest")) return true;

  return false;
}

/**
 * Merekam penambahan progres quest harian dan mingguan secara terpadu.
 * @param {string} userId
 * @param {string} action
 * @param {number} [amount=1]
 * @param {object} [metadata={}]
 */
async function recordQuestProgress(userId, action, amount = 1, metadata = {}) {
  try {
    const todayKey = getTodayKey();
    let dailyUpdated = false;
    let weeklyUpdated = false;

    await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
      // 1. Periksa Quest Harian Aktif
      const dailyState = st[DAILY_QUEST_STATE];
      if (
        dailyState &&
        dailyState.date === todayKey &&
        dailyState.quest &&
        !dailyState.claimed
      ) {
        if (actionMatches(dailyState.quest.type, action)) {
          const newProg = Math.min(
            dailyState.quest.target,
            (dailyState.progress || 0) + amount,
          );
          if (newProg !== dailyState.progress) {
            dailyState.progress = newProg;
            dailyUpdated = true;
          }
        }
      }

      // 2. Periksa Papan Quest Mingguan
      const currentWeek = getWeeklyResetString();
      const weeklyBoard = st[WEEKLY_QUEST_STATE];
      if (weeklyBoard && weeklyBoard.weekKey === currentWeek && Array.isArray(weeklyBoard.quests)) {
        for (const wQuest of weeklyBoard.quests) {
          if (!wQuest.claimed && actionMatches(wQuest.type, action)) {
            const wProg = Math.min(wQuest.target, (wQuest.progress || 0) + amount);
            if (wProg !== wQuest.progress) {
              wQuest.progress = wProg;
              weeklyUpdated = true;
            }
          }
        }
      }

      return st;
    });

    return { dailyUpdated, weeklyUpdated };
  } catch (err) {
    console.error("[QuestEngine] Gagal merekam progres:", err);
    return { dailyUpdated: false, weeklyUpdated: false };
  }
}

async function getDailyQuestPayload(userId, lang = "id") {
  const state = await getQuestState(userId);
  const streakInfo = await getStreakInfo(userId);
  const survival = await cacheManager.getUserSurvival(userId);
  const playerLevel = survival?.survival_level || 1;
  const tier = getTierByLevel(playerLevel);

  const { renderEmptyQuest, renderQuestCard } = require("./dailyQuestUI");
  if (!state.quest) {
    return renderEmptyQuest(lang, streakInfo, tier);
  }

  return renderQuestCard(state, lang, streakInfo, tier);
}

module.exports = {
  DAILY_QUEST_STATE,
  STREAK_STATE,
  WEEKLY_QUEST_STATE,
  QUEST_TEMPLATES,
  WEEKLY_TEMPLATES,
  GRAND_WEEKLY_REWARD,
  STREAK_BONUS_TIERS,
  STREAK_MILESTONES,
  getRandomQuest,
  getTodayKey,
  getYesterdayKey,
  getWeeklyResetString,
  getTierByLevel,
  getQuestState,
  getStreakState,
  getStreakInfo,
  calculateNewStreak,
  getStreakBonusPercent,
  generateDailyQuest,
  claimDailyQuestReward,
  getWeeklyQuestState,
  claimWeeklyQuestReward,
  claimWeeklyGrandReward,
  recordQuestProgress,
  actionMatches,
  getDailyQuestPayload,
};
