const UserQuest = require('../../../src/models/UserQuest');
const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { generateQuestsForUser } = require('../questGenerator');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = async function(interaction, user, survivalData) {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    const profile = await cacheManager.getUserProfile(user.id);

    let [quest] = await UserQuest.findOrCreate({
        where: { userId: user.id },
        defaults: { lastReset: today }
    });

    let state = quest.questsState;
    if (typeof state === 'string') {
        try { state = JSON.parse(state); } catch (e) { state = null; }
    }

    let needsSave = false;

    // Reset atau buat baru jika data kosong
    if (!state || !state.daily || !state.monthly) {
        state = generateQuestsForUser(profile, survivalData);
        needsSave = true;
    } else {
        if (state.lastDailyReset !== today) {
            const newQuests = generateQuestsForUser(profile, survivalData);
            state.daily = newQuests.daily;
            state.lastDailyReset = today;
            needsSave = true;
        }
        if (state.lastMonthlyReset !== currentMonth) {
            const newQuests = generateQuestsForUser(profile, survivalData);
            state.monthly = newQuests.monthly;
            state.lastMonthlyReset = currentMonth;
            needsSave = true;
        }
    }

    // Auto-klaim misi yang sudah selesai
    let rewardMoney = 0;
    let claimedQuests = [];

    state.daily.forEach(q => {
        if (q.current >= q.target && !q.claimed) {
            q.claimed = true; rewardMoney += q.reward; claimedQuests.push(q.title); needsSave = true;
        }
    });
    state.monthly.forEach(q => {
        if (q.current >= q.target && !q.claimed) {
            q.claimed = true; rewardMoney += q.reward; claimedQuests.push(q.title); needsSave = true;
        }
    });

    if (rewardMoney > 0) {
        survivalData.starFragments = (survivalData.starFragments || 0) + rewardMoney;
        await survivalData.save();
    }

    if (needsSave) {
        quest.questsState = state;
        quest.changed('questsState', true);
        quest.lastReset = today;
        await quest.save();
    }

    // Bangun teks tampilan quest
    const nsfEmoji = ui.getEmoji('nsf') || '🪙';
    const dayEmoji = ui.getEmoji('day') || '📅';
    const crownEmoji = ui.getEmoji('admin') || '👑';

    let dailyText = '';
    state.daily.forEach((q, idx) => {
        const statusIcon = q.claimed ? (ui.getEmoji('success') || '✅') : (q.current >= q.target ? (ui.getEmoji('quest_star') || '⭐') : (ui.getEmoji('quest_clock') || '⏳'));
        dailyText += `**${idx + 1}.** ${statusIcon} ${q.title}\n> Progress: \`${q.current} / ${q.target}\` | Hadiah: ${nsfEmoji} **${q.reward} NSF**\n\n`;
    });

    let monthlyText = '';
    state.monthly.forEach((q, idx) => {
        const statusIcon = q.claimed ? (ui.getEmoji('success') || '✅') : (q.current >= q.target ? (ui.getEmoji('quest_star') || '⭐') : (ui.getEmoji('quest_clock') || '⏳'));
        monthlyText += `**${idx + 1}.** ${statusIcon} ${q.title}\n> Progress: \`${q.current} / ${q.target}\` | Hadiah: ${nsfEmoji} **${q.reward} NSF**\n\n`;
    });

    let claimText = '';
    if (rewardMoney > 0) {
        claimText = `\n\n**🎁 Hadiah Diklaim Otomatis!**\nKamu menyelesaikan:\n${claimedQuests.map(t => `- **${t}**`).join('\n')}\n\nMendapatkan total: ${ui.getEmoji('coin') || '🪙'} **${rewardMoney} Naura Star Fragment**!`;
    }

    const fullDesc = `Selesaikan misi di bawah ini untuk mendapatkan Naura Star Fragment secara otomatis!\n\n**${dayEmoji} Misi Harian (${today})**\n${dailyText || '*Tidak ada misi harian*'}\n**${crownEmoji} Misi Bulanan (${currentMonth})**\n${monthlyText || '*Tidak ada misi bulanan*'}${claimText}`;

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('primary') || '#ffb6c1',
        title: `${ui.getEmoji('quest') || '📜'} Quest Board: ${user.username}`,
        description: fullDesc,
        footerText: ui.getFooter('survival')
    });

    return interaction.editReply({ ...payload, embeds: [] });
};
