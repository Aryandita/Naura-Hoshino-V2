// Alur /premium redeem.
const PremiumVoucher = require('../../src/models/PremiumVoucher');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { tierDisplayName } = require('./premiumTiers');
const store = require('./premiumStore');
const { sendPremiumDM } = require('./premiumNotify');

function failure(interaction, description) {
    return interaction.editReply(buildErrorContainerV2({
        title: 'Voucher belum bisa dipakai',
        description,
        footerText: ui.getFooter('premium')
    }));
}

// Mengembalikan alasan penolakan, atau null bila voucher sah.
function rejectionReason(voucher) {
    if (!voucher) return 'Kode voucher ini tidak Naura temukan. Coba periksa ejaannya lagi ya.';
    if (voucher.isRedeemed) return 'Kode ini sudah pernah ditukarkan sebelumnya.';

    const expiry = store.toDate(voucher.expiresAt);
    if (expiry && expiry.getTime() <= Date.now()) return 'Sayangnya masa berlaku kode ini sudah habis.';

    return null;
}

async function runRedeem(interaction, profile) {
    const code = interaction.options.getString('kode').toUpperCase().trim();
    const voucher = await PremiumVoucher.findOne({ where: { code } });

    const reason = rejectionReason(voucher);
    if (reason) return failure(interaction, reason);

    // Voucher ditandai terpakai lebih dulu agar tidak bisa ditukar dua kali
    // ketika perintahnya dikirim berulang dengan cepat.
    voucher.isRedeemed = true;
    voucher.redeemedBy = interaction.user.id;
    voucher.redeemedAt = new Date();
    await voucher.save();

    const newExpiry = await store.grantPremium(interaction.user.id, profile, voucher.durationDays);

    const tierKey = ui.getPremiumTier(voucher.durationDays, true);
    const displayName = tierDisplayName(tierKey, voucher.durationDays);

    await sendPremiumDM(interaction.client, interaction.user.id, 'redeemed', {
        username: interaction.user.username,
        tierName: displayName,
        premiumUntil: newExpiry
    });

    return interaction.editReply(buildContainerV2({
        accentColorHex: ui.getColor('premium_vip'),
        title: 'Voucher V.I.P berhasil ditukarkan!',
        expression: 'celebrate',
        description: [
            `Selamat! Kamu sekarang menjadi member **${displayName}**.`,
            ``,
            `Berlaku sampai <t:${Math.floor(newExpiry.getTime() / 1000)}:F>.`,
            ``,
            `-# Ketik \`/premium check\` kalau mau melihat detail langgananmu.`
        ].join('\n'),
        footerText: ui.getFooter('premium')
    }));
}

module.exports = { runRedeem };
