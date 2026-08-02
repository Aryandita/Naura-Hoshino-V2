// Lokasi: plugin/survival/questGenerator.js
const UserQuest = require('../../src/models/UserQuest');
const { safeParseInventory } = require('./inventoryHelper');

const QUEST_POOL = [
    {
        id: 'work_janitor',
        title: 'Bekerja Sebagai Tukang Sapu',
        action: 'work_janitor',
        baseTarget: 2,
        baseReward: 300,
        reqInt: 1
    },
    {
        id: 'work_office',
        title: 'Bekerja Shift Kantoran',
        action: 'work_office',
        baseTarget: 2,
        baseReward: 600,
        reqInt: 10
    },
    {
        id: 'work_doctor',
        title: 'Bekerja Sebagai Dokter',
        action: 'work_doctor',
        baseTarget: 2,
        baseReward: 1000,
        reqInt: 30
    },
    {
        id: 'work_ceo',
        title: 'Bekerja Sebagai CEO',
        action: 'work_ceo',
        baseTarget: 1,
        baseReward: 2000,
        reqInt: 80
    },
    {
        id: 'collect',
        title: 'Mengumpulkan Material Hutan/Laut/Tambang',
        action: 'collect',
        baseTarget: 5,
        baseReward: 400
    },
    {
        id: 'dungeon',
        title: 'Mengalahkan Monster di Dungeon',
        action: 'dungeon',
        baseTarget: 3,
        baseReward: 600,
        reqDungeonPass: true
    },
    {
        id: 'study',
        title: 'Belajar di Kampus',
        action: 'study',
        baseTarget: 3,
        baseReward: 300
    },
    {
        id: 'rest',
        title: 'Tidur / Istirahat di Kasur',
        action: 'rest',
        baseTarget: 1,
        baseReward: 200
    },
    {
        id: 'craft',
        title: 'Merakit Barang/Senjata',
        action: 'craft',
        baseTarget: 1,
        baseReward: 400
    },
    {
        id: 'gift_npc',
        title: 'Memberikan Hadiah ke Penduduk',
        action: 'gift_npc',
        baseTarget: 2,
        baseReward: 500
    },
    {
        id: 'date_npc',
        title: 'Kencan di Taman Hiburan',
        action: 'date_npc',
        baseTarget: 1,
        baseReward: 800
    },
    {
        id: 'travel',
        title: 'Menjelajahi Kota atau Desa Lain',
        action: 'travel',
        baseTarget: 3,
        baseReward: 300
    },
    {
        id: 'farm_harvest',
        title: 'Panen Hasil Pertanian',
        action: 'farm_harvest',
        baseTarget: 2,
        baseReward: 400
    },
    {
        id: 'heist',
        title: 'Misi Gelap: Merampok Bank',
        action: 'heist',
        baseTarget: 1,
        baseReward: 5000
    },
    {
        id: 'pet_feed',
        title: 'Memberi Makan Peliharaan',
        action: 'pet_feed',
        baseTarget: 3,
        baseReward: 250
    },
    {
        id: 'boss_kill',
        title: 'Mengalahkan Boss Dungeon',
        action: 'boss_kill',
        baseTarget: 1,
        baseReward: 3000,
        reqDungeonPass: true
    }
];

function generateQuestsForUser(profile, survival) {
    const level = survival.survival_level || 1;
    const intelligence = survival.intelligence || 1;
    const hasDungeonPass = safeParseInventory(profile.inventory).some(i => i && i.id === 'dungeon_pass');

    // Filter quest yang memenuhi syarat stats & assets user
    const eligiblePool = QUEST_POOL.filter(q => {
        if (q.reqInt && intelligence < q.reqInt) return false;
        if (q.reqDungeonPass && !hasDungeonPass) return false;
        return true;
    });

    // Jumlah quest harian: 3 - 10 berdasarkan level
    const numDaily = Math.min(10, Math.max(3, 3 + Math.floor(level / 10)));
    
    // Acak pool harian
    const shuffledDaily = [...eligiblePool].sort(() => Math.random() - 0.5);
    const dailyQuests = shuffledDaily.slice(0, numDaily).map(q => {
        // Skala target berdasarkan level
        const multiplier = 1 + Math.floor(level / 10) * 0.5;
        const target = Math.max(1, Math.round(q.baseTarget * multiplier));
        const reward = Math.round(q.baseReward * multiplier);
        return {
            id: q.id,
            action: q.action,
            title: q.title,
            current: 0,
            target: target,
            reward: reward,
            claimed: false
        };
    });

    // monthly quest: Kesulitan ganda
    const shuffledMonthly = [...eligiblePool].sort(() => Math.random() - 0.5);
    const monthlyQuests = shuffledMonthly.slice(0, 2).map(q => {
        // Kesulitan bulanan digandakan (5x target harian) dan hadiah jauh lebih besar
        const multiplier = (1 + Math.floor(level / 10) * 0.5) * 5;
        const target = Math.max(5, Math.round(q.baseTarget * multiplier));
        const reward = Math.round(q.baseReward * multiplier * 4);
        return {
            id: q.id + '_monthly',
            action: q.action,
            title: `[Monthly] ${q.title}`,
            current: 0,
            target: target,
            reward: reward,
            claimed: false
        };
    });

    return {
        daily: dailyQuests,
        monthly: monthlyQuests,
        lastDailyReset: new Date().toISOString().split('T')[0],
        lastMonthlyReset: new Date().toISOString().substring(0, 7) // YYYY-MM
    };
}

async function incrementQuestProgress(userId, action, amount = 1) {
    try {
        const quest = await UserQuest.findOne({ where: { userId } });
        if (!quest || !quest.questsState) return;

        let state = typeof quest.questsState === 'string' ? JSON.parse(quest.questsState) : quest.questsState;
        let changed = false;

        // Update daily quests
        if (state.daily) {
            state.daily.forEach(q => {
                if (q.action === action && q.current < q.target) {
                    q.current = Math.min(q.target, q.current + amount);
                    changed = true;
                }
            });
        }

        // Update monthly quests
        if (state.monthly) {
            state.monthly.forEach(q => {
                if (q.action === action && q.current < q.target) {
                    q.current = Math.min(q.target, q.current + amount);
                    changed = true;
                }
            });
        }

        if (changed) {
            quest.questsState = state;
            quest.changed('questsState', true);
            await quest.save();
        }
    } catch (e) {
        console.error('\x1b[41m\x1b[37m 💥 QuestTracker \x1b[0m \x1b[31mGagal menambah kemajuan quest:', e, '\x1b[0m');
    }
}

module.exports = { generateQuestsForUser, incrementQuestProgress };
