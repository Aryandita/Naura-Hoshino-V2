// Tiga varian DM notifikasi premium. Nada bicaranya dibuat hangat, seperti
// Naura sendiri yang mengabari usernya.
const ui = require('../../src/config/ui');
const { logger } = require('../../src/managers/logger');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

function stamp(date) {
    if (!date) return 'belum diketahui';
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function activatedPayload({ username, tierName, premiumUntil }) {
    const crown = ui.getEmoji('premium_vip') || '\ud83d\udc51';
    return buildContainerV2({
        accentColorHex: ui.getColor('premium_vip'),
        authorName: 'Naura V.I.P Service',
        title: `${crown} Selamat bergabung di V.I.P Club!`,
        expression: 'celebrate',
        description: [
            `Hei **${username}**, status **${tierName}** kamu sudah aktif sekarang!`,
            ``,
            `Berlaku sampai ${stamp(premiumUntil)}.`,
            ``,
            `Semua fitur eksklusifnya sudah terbuka. Kalau mau melihat sisa waktunya kapan saja, tinggal ketik \`/premium check\` ya.`,
            ``,
            `-# Terima kasih sudah menemani Naura Project sejauh ini.`
        ].join('\n'),
        footerText: ui.getFooter('premium')
    });
}

function removedPayload({ username }) {
    return buildContainerV2({
        accentColorHex: ui.getColor('error'),
        authorName: 'Naura V.I.P Service',
        title: 'Status V.I.P kamu dicabut',
        expression: 'info',
        description: [
            `Hei **${username}**, status V.I.P kamu baru saja dicabut oleh tim Naura.`,
            ``,
            `Kamu tetap bisa memakai semua fitur reguler seperti biasa. Kalau menurutmu ini keliru, jangan ragu menghubungi owner ya.`,
            ``,
            `-# Ketik \`/premium info\` kalau nanti mau berlangganan lagi.`
        ].join('\n'),
        footerText: ui.getFooter('core')
    });
}

function redeemedPayload({ tierName, premiumUntil }) {
    return buildContainerV2({
        accentColorHex: ui.getColor('premium_vip'),
        authorName: 'Naura V.I.P Service',
        title: 'Voucher kamu berhasil ditukarkan!',
        expression: 'celebrate',
        description: [
            `Voucher **${tierName}** sudah Naura aktifkan.`,
            ``,
            `Berlaku sampai ${stamp(premiumUntil)}.`,
            ``,
            `Ketik \`/premium check\` kalau mau melihat detail langgananmu.`,
            ``,
            `-# Terima kasih banyak atas dukungannya.`
        ].join('\n'),
        footerText: ui.getFooter('premium')
    });
}

const BUILDERS = {
    activated: activatedPayload,
    removed: removedPayload,
    redeemed: redeemedPayload
};

// Mengembalikan true bila DM benar-benar terkirim, agar pemanggilnya bisa
// memberi tahu owner ketika DM user tertutup.
async function sendPremiumDM(client, userId, type, data = {}) {
    const builder = BUILDERS[type];
    if (!builder || !client) return false;

    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return false;

        await user.send(builder(data));
        return true;
    } catch (error) {
        logger.warn(`[Premium DM] Gagal mengirim DM ${type} ke ${userId}: ${error.message}`);
        return false;
    }
}

module.exports = { sendPremiumDM };
