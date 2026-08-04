'use strict';

const UserQuest = require('../../../src/models/UserQuest');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { generateQuestsForUser } = require('../questGenerator');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const currency = require('../currency');
const { rollCouponDrop, dropLine } = require('../couponRewards');

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function parseState(raw) {
    if (typeof raw !== 'string') return raw || null;
    try {
        return JSON.parse(raw);
    } catch (err) {
        return null;
    }
}

// Ikon status memakai wajah Naura: bangga kalau sudah beres, semangat kalau
// tinggal sedikit lagi, dan santai kalau masih panjang jalannya.
function statusIcon(quest) {
    if (quest.claimed) return e('cheers', '\u2705');
    if (quest.current >= quest.target) return e('impressed', '\u2B50');
    return e('thinking', '\u23F3');
}

function renderQuests(list, nsfEmoji) {
    return list
        .map((q, idx) => `**${idx + 1}.** ${statusIcon(q)} ${q.title}\n`
            + `> Progres: \`${q.current} / ${q.target}\` \u2022 Hadiah: ${nsfEmoji} **${q.reward} NSF**`)
        .join('\n\n');
}

module.exports = async function questBoard(interaction, user, survivalData) {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().substring(0, 7);

    const profile = await cacheManager.getUserProfile(user.id);

    const [quest] = await UserQuest.findOrCreate({
        where: { userId: user.id },
        defaults: { lastReset: today }
    });

    let state = parseState(quest.questsState);
    let needsSave = false;

    if (!state || !state.daily || !state.monthly) {
        state = generateQuestsForUser(profile, survivalData);
        needsSave = true;
    } else {
        if (state.lastDailyReset !== today) {
            state.daily = generateQuestsForUser(profile, survivalData).daily;
            state.lastDailyReset = today;
            needsSave = true;
        }
        if (state.lastMonthlyReset !== currentMonth) {
            state.monthly = generateQuestsForUser(profile, survivalData).monthly;
            state.lastMonthlyReset = currentMonth;
            needsSave = true;
        }
    }

    // Klaim otomatis semua misi yang sudah tuntas.
    const claimed = [];
    let rewardTotal = 0;
    let monthlyCleared = 0;

    for (const q of state.daily) {
        if (q.current >= q.target && !q.claimed) {
            q.claimed = true;
            rewardTotal += q.reward;
            claimed.push(q.title);
            needsSave = true;
        }
    }

    for (const q of state.monthly) {
        if (q.current >= q.target && !q.claimed) {
            q.claimed = true;
            rewardTotal += q.reward;
            claimed.push(q.title);
            monthlyCleared += 1;
            needsSave = true;
        }
    }

    // Hadiah NSF lewat modul mata uang supaya saldo tidak lagi disentuh langsung.
    if (rewardTotal > 0) {
        await currency.reward(currency.FRAGMENT, { survival: survivalData, profile }, rewardTotal);
    }

    // Naura Coupon hanya jatuh dari misi jangka panjang, bukan misi harian,
    // supaya papan misi tidak berubah jadi mesin kupon setiap hari.
    let coupon = { gained: 0 };
    if (monthlyCleared > 0) {
        coupon = await rollCouponDrop('quest_weekly', { survival: survivalData });
    }

    if (needsSave) {
        quest.questsState = state;
        quest.changed('questsState', true);
        quest.lastReset = today;
        await quest.save();
    }

    const nsfEmoji = currency.emojiOf(currency.FRAGMENT);
    const dailyText = renderQuests(state.daily, nsfEmoji) || '*Belum ada misi harian buat hari ini.*';
    const monthlyText = renderQuests(state.monthly, nsfEmoji) || '*Belum ada misi bulanan.*';

    const parts = [
        'Ini papan misimu hari ini! Selesaikan saja pelan-pelan, hadiahnya Naura kasih otomatis begitu tuntas.',
        '',
        `**${e('read', '\uD83D\uDCC5')} Misi Harian \u2014 ${today}**`,
        dailyText,
        '',
        `**${e('impressed', '\uD83D\uDC51')} Misi Bulanan \u2014 ${currentMonth}**`,
        monthlyText
    ];

    if (rewardTotal > 0) {
        parts.push(
            '',
            `**${e('cheers', '\uD83C\uDF81')} Hebat, Naura ikut senang!**`,
            'Kamu baru saja menyelesaikan:',
            claimed.map(title => `- **${title}**`).join('\n'),
            '',
            `Hadiahnya sudah masuk: ${currency.format(currency.FRAGMENT, rewardTotal)}!`
        );

        const line = dropLine(coupon);
        if (line) {
            parts.push('', `**${e('impressed', '\u2728')} Bonus Misi Bulanan**`, line);
        } else if (monthlyCleared > 0) {
            parts.push(
                '',
                `${e('shy', '\uD83D\uDE3F')} Naura sudah coba cari kupon buat kamu, tapi belum ketemu kali ini. Bulan depan kita coba lagi, ya!`
            );
        }
    }

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('primary') || '#FFB6C1',
        authorName: 'Naura Quest Board',
        title: `${e('read', '\uD83D\uDCDC')} Papan Misi ${user.username}`,
        iconURL: user.displayAvatarURL(),
        expression: rewardTotal > 0 ? 'success' : 'info',
        description: parts.join('\n'),
        footerText: ui.getFooter('survival')
    });

    return interaction.editReply({ ...payload, embeds: [] });
};
