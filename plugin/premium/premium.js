const {
    SlashCommandBuilder, AttachmentBuilder,
    ActionRowBuilder, StringSelectMenuBuilder,
    ComponentType, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const UserProfile = require('../../src/models/UserProfile');
const PremiumVoucher = require('../../src/models/PremiumVoucher');
const env = require('../../src/config/env');
const ui = require('../../src/config/ui');
const { CanvasUtils } = require('../../plugin/canvas/Canvas');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

// ==========================================
// 💎 PREMIUM TIERS — Single Source of Truth
// ==========================================
const PREMIUM_TIERS = {
    tier_1: {
        name: '🌟 Naura Supporter',
        tier: 'supporter',
        days: 30,
        price: 'Rp 25.000',
        emoji: '🌟',
        description: 'Paket entry-level untuk mendukung Naura Project.',
        features: [
            '✅ **1.5x Global XP Boost** — Naik level lebih cepat di semua server',
            '✅ **Banner Profil Custom** — Upload banner unik di kartu profilmu',
            '✅ **AI Chat Limit Tinggi** — Memori chat 10 pesan terakhir',
            '✅ **Download Harian 10x** — Downloader & Translate dengan limit tinggi',
            '❌ Musik 24/7',
            '❌ Audio DSP Filters',
            '❌ Playlist Unlimited',
            '❌ Dungeon Unlimited',
            '❌ Gold Card & AI Studio',
        ]
    },
    tier_2: {
        name: '💫 Naura Friends',
        tier: 'friends',
        days: 90,
        price: 'Rp 45.000',
        emoji: '💫',
        description: 'Paket terbaik untuk penikmat musik & konten harian.',
        features: [
            '✅ **Semua fitur Supporter**',
            '✅ **Mode Siaga 24/7** — Musik tanpa henti sepanjang waktu',
            '✅ **DSP Audio Filters** — Nightcore, Vaporwave, 8D Surround & Karaoke',
            '✅ **Playlist Unlimited** — Simpan & impor tanpa batas',
            '✅ **Download Unlimited** — Tanpa batas harian & karakter translate',
            '✅ **1.75x Global XP Boost** — Naik level bahkan lebih cepat',
            '❌ Dungeon > Floor 50',
            '❌ Bonus Gaji & Bunga Bank',
            '❌ Gold Card & AI Studio',
        ]
    },
    tier_3: {
        name: '👑 Naura V.I.P',
        tier: 'vip',
        days: 365,
        price: 'Rp 75.000',
        emoji: '👑',
        description: 'Paket premium paling lengkap — semua akses tanpa batas.',
        features: [
            '✅ **Semua fitur Friends**',
            '✅ **2x Global XP Boost** — Level tercepat di seluruh server',
            '✅ **Dungeon Unlimited** — Jelajahi beyond Floor 50 tanpa batas',
            '✅ **+50% Bonus Gaji Survival** — Koin ekstra di setiap shift kerja',
            '✅ **+2% Bunga Deposito Bank** — Pertumbuhan investasi lebih tinggi',
            '✅ **AI Studio Full** — Limit tinggi `/ai imagine` + memori 20 pesan',
            '✅ **Gold Glow Card** — Kartu profil & rank emas dengan efek *Gold Glow*',
        ]
    }
};

// ==========================================
// 🔑 HELPER — Cek Owner
// ==========================================
function isOwner(userId) {
    return env.OWNER_IDS && env.OWNER_IDS.includes(userId);
}

// ==========================================
// 📧 HELPER — DM Notifikasi Premium
// ==========================================
async function sendPremiumDM(client, userId, type, { username, tierName, daysLeft, premiumUntil } = {}) {
    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return;

        let payload;
        const eVip = ui.getEmoji('premium_vip') || '👑';

        if (type === 'activated') {
            const expTimestamp = premiumUntil ? `<t:${Math.floor(premiumUntil.getTime() / 1000)}:F>` : 'Tidak diketahui';
            payload = buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                authorName: 'Naura V.I.P Service',
                title: `${eVip} Selamat Bergabung di V.I.P Club!`,
                iconURL: null,
                description: [
                    `Hei **${username}**, status **${tierName}** kamu kini telah aktif! 🎉`,
                    ``,
                    `⏳ **Berlaku hingga:** ${expTimestamp}`,
                    ``,
                    `Kamu sekarang bisa menikmati semua fitur eksklusif yang tersedia. Gunakan \`/premium check\` untuk melihat status dan sisa waktu langgananmu kapan saja.`,
                    ``,
                    `-# Terima kasih telah mendukung Naura Project! 💎`
                ].join('\n'),
                footerText: ui.getFooter('premium')
            });
        } else if (type === 'removed') {
            payload = buildContainerV2({
                accentColorHex: ui.getColor('error'),
                authorName: 'Naura V.I.P Service',
                title: '🔔 Status Premium Dicabut',
                description: [
                    `Hei **${username}**, status V.I.P kamu telah dicabut oleh tim Naura.`,
                    ``,
                    `Kamu masih bisa menikmati fitur reguler seperti biasa. Jika ada pertanyaan, hubungi owner.`,
                    ``,
                    `-# Gunakan \`/premium info\` untuk berlangganan kembali.`
                ].join('\n'),
                footerText: ui.getFooter('core')
            });
        } else if (type === 'redeemed') {
            const expTimestamp = premiumUntil ? `<t:${Math.floor(premiumUntil.getTime() / 1000)}:F>` : 'Tidak diketahui';
            payload = buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                authorName: 'Naura V.I.P Service',
                title: `🎉 Voucher Berhasil Ditukarkan!`,
                description: [
                    `Voucher **${tierName}** kamu berhasil diaktifkan! 🎊`,
                    ``,
                    `⏳ **Berlaku hingga:** ${expTimestamp}`,
                    ``,
                    `Gunakan \`/premium check\` untuk melihat status dan detail langgananmu.`,
                    ``,
                    `-# Terima kasih atas dukunganmu! 💎`
                ].join('\n'),
                footerText: ui.getFooter('premium')
            });
        }

        if (payload) await user.send(payload).catch(() => {});
    } catch (_) {}
}

// ==========================================
// 📊 HELPER — Build Benefits Comparison
// ==========================================
function buildBenefitsDescription() {
    const lines = [];

    lines.push('Berikut perbandingan lengkap fitur setiap tier **Naura V.I.P Subscription**:\n');

    for (const [key, tier] of Object.entries(PREMIUM_TIERS)) {
        const color = tier.tier === 'vip' ? '🟡' : tier.tier === 'friends' ? '🟣' : '⚪';
        lines.push(`${color} **${tier.name}** — \`${tier.price}\` / ${tier.days} Hari`);
        lines.push(`*${tier.description}*`);
        for (const feat of tier.features) {
            lines.push(`・ ${feat}`);
        }
        lines.push('');
    }

    lines.push('-# Gunakan `/premium info` untuk berlangganan atau `/premium check` untuk cek status.');
    return lines.join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('💎 Kelola dan lihat informasi sistem V.I.P Premium Naura.')
        .addSubcommand(sub => sub.setName('info').setDescription('Lihat paket & harga berlangganan V.I.P.'))
        .addSubcommand(sub => sub.setName('benefits').setDescription('Lihat perbandingan fitur lengkap semua tier V.I.P.'))
        .addSubcommand(sub => sub.setName('check').setDescription('Cek status premium kamu atau orang lain.')
            .addUserOption(opt => opt.setName('user').setDescription('Pilih user (Opsional)')))
        .addSubcommand(sub => sub.setName('redeem').setDescription('Tukar kode voucher V.I.P.')
            .addStringOption(opt => opt.setName('kode').setDescription('Masukkan kode voucher').setRequired(true)))
        .addSubcommand(sub => sub.setName('add').setDescription('[OWNER] Berikan status premium ke user.')
            .addUserOption(opt => opt.setName('user').setDescription('Pilih user').setRequired(true))
            .addIntegerOption(opt => opt.setName('days').setDescription('Lama premium dalam hari').setRequired(true).setMinValue(1)))
        .addSubcommand(sub => sub.setName('remove').setDescription('[OWNER] Cabut status premium user.')
            .addUserOption(opt => opt.setName('user').setDescription('Pilih user').setRequired(true)))
        .addSubcommand(sub => sub.setName('generate_voucher').setDescription('[OWNER] Buat kode redeem V.I.P baru.')
            .addIntegerOption(opt => opt.setName('days').setDescription('Lama VIP dalam hari').setRequired(true))
            .addIntegerOption(opt => opt.setName('expired_in_days').setDescription('Batas waktu klaim kode (Opsional)').setRequired(false)))
        .addSubcommand(sub => sub.setName('stats').setDescription('[OWNER] Lihat statistik subscriber aktif.')),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand(false) || 'info';
        const eSuccess = ui.getEmoji('success') || '✅';
        const eError = ui.getEmoji('error') || '❌';
        const client = interaction.client;

        // ── Cek Otoritas Owner ─────────────────────────────────
        if (['add', 'remove', 'generate_voucher', 'stats'].includes(subcommand)) {
            if (!isOwner(interaction.user.id)) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Akses Ditolak',
                    description: `${eError} | Akses Ditolak! Hanya Owner yang dapat menggunakan sub-command ini.`,
                    footerText: ui.getFooter('premium')
                }));
            }
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const cacheManager = require('../../src/managers/cacheManager');
        const profile = await cacheManager.getUserProfile(targetUser.id);

        // =====================================================
        // SUB: info
        // =====================================================
        if (subcommand === 'info') {
            const isPremium = profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date();
            let daysLeft = 0;
            if (isPremium) {
                daysLeft = Math.ceil((profile.premiumUntil.getTime() - Date.now()) / (1000 * 3600 * 24));
            }
            const tierName = ui.getPremiumTier(daysLeft, isPremium);
            const tierData = PREMIUM_TIERS[Object.keys(PREMIUM_TIERS).find(k => PREMIUM_TIERS[k].tier === tierName)] || { name: 'Regular Member', tier: 'none' };

            // Buat Canvas card
            let attachment;
            try {
                const canvas = await CanvasUtils.generatePremiumTierCard(
                    targetUser, tierData, isPremium, daysLeft,
                    isPremium ? profile.premiumUntil : null
                );
                const buffer = canvas.encodeSync ? canvas.encodeSync('png') : canvas.toBuffer('image/png');
                attachment = new AttachmentBuilder(buffer, { name: 'premium-card.png' });
            } catch (_) {
                attachment = null;
            }

            // Select menu 3 tier
            const selectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('premium_tier_select')
                    .setPlaceholder('📦 Pilih Paket Langganan untuk melihat detail...')
                    .addOptions(Object.entries(PREMIUM_TIERS).map(([key, t]) => ({
                        label: `${t.name} — ${t.price}`,
                        description: `Akses penuh selama ${t.days} hari`,
                        value: key,
                        emoji: t.emoji
                    })))
            );

            const infoPayload = buildContainerV2({
                accentColorHex: isPremium ? ui.getPremiumColor(tierName) : ui.getColor('primary'),
                title: `${ui.getEmoji('premium_badge') || '💎'} Naura V.I.P Subscription`,
                description: [
                    isPremium
                        ? `✨ Kamu sedang aktif sebagai **${tierData.name}** dengan **${daysLeft} hari tersisa**!`
                        : `Tingkatkan pengalamanmu dengan fitur **super eksklusif** Naura Hoshino!`,
                    ``,
                    `Pilih paket dari menu di bawah untuk melihat **detail harga**, **daftar fitur**, dan **cara pembayaran** via QRIS.`,
                    ``,
                    `Atau gunakan \`/premium benefits\` untuk melihat perbandingan lengkap semua tier.`
                ].join('\n'),
                bannerAttachmentName: attachment ? 'premium-card.png' : null,
                buttonsRow: selectRow,
                footerText: ui.getFooter('premium')
            });

            const files = attachment ? [attachment] : [];
            const messageObj = await interaction.editReply({ ...infoPayload, files });

            // ── Collector select menu ─────────────────────────
            const collector = messageObj.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 120000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        ...buildErrorContainerV2({ description: '❌ Menu ini hanya untuk pemanggil perintah.', footerText: ui.getFooter('premium') }),
                        ephemeral: true
                    });
                }

                const selected = i.values[0];
                const tierInfo = PREMIUM_TIERS[selected];
                if (!tierInfo) return;

                // Cek & lampirkan QRIS
                const qrisPath = './assets/general/qris.jpg';
                const hasQris = fs.existsSync(qrisPath);
                const files = [];
                let qrisAttachmentName = null;

                if (hasQris) {
                    files.push(new AttachmentBuilder(qrisPath, { name: 'qris-naura.jpg' }));
                    qrisAttachmentName = 'qris-naura.jpg';
                }

                // Tombol
                const btnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`premium_contact_owner_${selected}`)
                        .setLabel('✅ Sudah Bayar — Konfirmasi ke Owner')
                        .setStyle(ButtonStyle.Success)
                );

                const tierColor = ui.getPremiumColor(tierInfo.tier);
                const detailDesc = [
                    `## ${tierInfo.name}`,
                    `**Harga:** \`${tierInfo.price}\` / ${tierInfo.days} hari`,
                    ``,
                    `**🔥 Fitur yang kamu dapatkan:**`,
                    ...tierInfo.features.map(f => `・ ${f}`),
                    ``,
                    `**💳 Cara Pembayaran:**`,
                    `1. Scan QR Code di bawah menggunakan aplikasi dompet digital apapun`,
                    `2. Transfer sesuai nominal: **${tierInfo.price}**`,
                    `3. Setelah berhasil, tekan tombol **Sudah Bayar** di bawah`,
                    `4. Owner akan segera memproses langgananmu!`,
                    ``,
                    `-# QRIS berlaku untuk semua e-wallet & mobile banking. Konfirmasi manual diperlukan.`
                ].join('\n');

                const detailPayload = buildContainerV2({
                    accentColorHex: tierColor,
                    title: `${ui.getPremiumEmoji(tierInfo.tier)} Rincian Paket: ${tierInfo.name}`,
                    description: detailDesc,
                    bannerAttachmentName: qrisAttachmentName,
                    buttonsRow: [selectRow, btnRow],
                    footerText: ui.getFooter(`premium_${tierInfo.tier}`)
                });

                await i.update({ ...detailPayload, files }).catch(() => {});
            });

            // ── Collector tombol konfirmasi owner ────────────
            const btnCollector = messageObj.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000
            });

            btnCollector.on('collect', async i => {
                if (!i.customId.startsWith('premium_contact_owner_')) return;
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        ...buildErrorContainerV2({ description: '❌ Tombol ini hanya untuk pemanggil perintah.', footerText: ui.getFooter('premium') }),
                        ephemeral: true
                    });
                }

                const ownerMentions = env.OWNER_IDS ? env.OWNER_IDS.map(id => `<@${id}>`).join(', ') : 'Owner Naura';
                const confirmPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success'),
                    title: '📬 Langkah Konfirmasi Pembayaran',
                    description: [
                        `Terima kasih sudah melakukan pembayaran! 🎉`,
                        ``,
                        `**Hubungi owner berikut untuk konfirmasi:**`,
                        `👉 ${ownerMentions}`,
                        ``,
                        `**Sertakan informasi berikut saat konfirmasi:**`,
                        `・ Username Discord kamu`,
                        `・ Bukti transfer / screenshot pembayaran`,
                        `・ Paket yang dibeli`,
                        ``,
                        `-# Owner akan segera memproses dalam waktu singkat. Terima kasih! 💎`
                    ].join('\n'),
                    footerText: ui.getFooter('premium')
                });

                await i.reply({ ...confirmPayload, ephemeral: true });
            });

            collector.on('end', () => {
                selectRow.components[0].setDisabled(true);
                interaction.editReply({ components: [selectRow] }).catch(() => {});
            });

            return;
        }

        // =====================================================
        // SUB: benefits
        // =====================================================
        if (subcommand === 'benefits') {
            const benefitsDesc = buildBenefitsDescription();
            const payload = buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                authorName: 'Naura V.I.P Subscription',
                title: `${ui.getEmoji('premium_badge') || '💎'} Perbandingan Fitur V.I.P`,
                description: benefitsDesc,
                footerText: ui.getFooter('premium')
            });
            return interaction.editReply(payload);
        }

        // =====================================================
        // SUB: check
        // =====================================================
        if (subcommand === 'check') {
            const isPremium = profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date();

            // Lazy expiry
            if (profile.isPremium && profile.premiumUntil && profile.premiumUntil <= new Date()) {
                profile.isPremium = false;
                profile.premiumUntil = null;
                await profile.save();
            }

            let daysLeft = 0;
            if (isPremium) {
                daysLeft = Math.ceil((profile.premiumUntil.getTime() - Date.now()) / (1000 * 3600 * 24));
            }

            const tierKey = ui.getPremiumTier(daysLeft, isPremium);
            const tierData = PREMIUM_TIERS[Object.keys(PREMIUM_TIERS).find(k => PREMIUM_TIERS[k].tier === tierKey)] || { name: 'Regular Member', tier: 'none' };

            // Buat Canvas card
            let attachment = null;
            try {
                const canvas = await CanvasUtils.generatePremiumTierCard(
                    targetUser, tierData, isPremium, daysLeft,
                    isPremium ? profile.premiumUntil : null
                );
                const buffer = canvas.encodeSync ? canvas.encodeSync('png') : canvas.toBuffer('image/png');
                attachment = new AttachmentBuilder(buffer, { name: 'premium-status.png' });
            } catch (_) {}

            const tierEmoji = ui.getPremiumEmoji(tierKey);
            const tierColor = ui.getPremiumColor(tierKey !== 'none' ? tierKey : 'vip');

            let descLines;
            if (isPremium) {
                const expTimestamp = Math.floor(profile.premiumUntil.getTime() / 1000);
                descLines = [
                    `${tierEmoji} **${targetUser.username}** adalah member **${tierData.name}**!`,
                    ``,
                    `⏳ **Berakhir:** <t:${expTimestamp}:F> (<t:${expTimestamp}:R>)`,
                    `📅 **Sisa Waktu:** **${daysLeft} hari**`,
                    ``,
                    `Kamu menikmati semua keuntungan eksklusif tier ini. Gunakan \`/premium benefits\` untuk melihat detail fiturmu.`
                ];
            } else {
                descLines = [
                    `👤 **${targetUser.username}** saat ini menggunakan status **Reguler**.`,
                    ``,
                    `Upgrade ke **Naura V.I.P** dan nikmati fitur eksklusif seperti:`,
                    `・ 2x Global XP Boost`,
                    `・ Mode Musik 24/7`,
                    `・ Dungeon Unlimited & Bonus Economy`,
                    `・ Gold Glow Profile Card`,
                    ``,
                    `Gunakan \`/premium info\` untuk berlangganan sekarang!`
                ];
            }

            const payload = buildContainerV2({
                accentColorHex: isPremium ? tierColor : ui.getColor('primary'),
                authorName: 'Naura V.I.P Subscription',
                iconURL: targetUser.displayAvatarURL(),
                title: isPremium ? `${tierEmoji} Status V.I.P — Aktif` : '👤 Status V.I.P — Tidak Aktif',
                description: descLines.join('\n'),
                bannerAttachmentName: attachment ? 'premium-status.png' : null,
                footerText: ui.getFooter(isPremium ? `premium_${tierKey}` : 'premium')
            });

            const files = attachment ? [attachment] : [];
            return interaction.editReply({ ...payload, files });
        }

        // =====================================================
        // SUB: add
        // =====================================================
        if (subcommand === 'add') {
            const days = interaction.options.getInteger('days');
            const newExpiry = new Date();

            if (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date()) {
                newExpiry.setTime(profile.premiumUntil.getTime() + (days * 24 * 60 * 60 * 1000));
            } else {
                newExpiry.setDate(newExpiry.getDate() + days);
            }

            profile.isPremium = true;
            profile.premiumUntil = newExpiry;
            await profile.save();

            // Deteksi tier berdasarkan hari
            const tierKey = ui.getPremiumTier(days, true);
            const tierInfo = PREMIUM_TIERS[Object.keys(PREMIUM_TIERS).find(k => PREMIUM_TIERS[k].tier === tierKey)];
            const tierDisplayName = tierInfo ? tierInfo.name : `V.I.P (${days} hari)`;

            // Kirim DM notifikasi ke user
            await sendPremiumDM(client, targetUser.id, 'activated', {
                username: targetUser.username,
                tierName: tierDisplayName,
                premiumUntil: newExpiry
            });

            return interaction.editReply(buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                authorName: 'Naura V.I.P Management',
                iconURL: targetUser.displayAvatarURL(),
                title: `${ui.getEmoji('premium_crown') || '💎'} V.I.P Premium Diberikan!`,
                description: [
                    `${eSuccess} | **${targetUser.username}** kini resmi menjadi member **${tierDisplayName}**!`,
                    ``,
                    `⏳ **Berlaku Sampai:** <t:${Math.floor(newExpiry.getTime() / 1000)}:F>`,
                    ``,
                    `-# DM notifikasi telah dikirimkan ke user.`
                ].join('\n'),
                footerText: ui.getFooter('premium')
            }));
        }

        // =====================================================
        // SUB: remove
        // =====================================================
        if (subcommand === 'remove') {
            profile.isPremium = false;
            profile.premiumUntil = null;
            await profile.save();

            // Kirim DM notifikasi ke user
            await sendPremiumDM(client, targetUser.id, 'removed', { username: targetUser.username });

            return interaction.editReply(buildContainerV2({
                accentColorHex: ui.getColor('error'),
                authorName: 'Naura V.I.P Management',
                title: '🚫 Status Premium Dicabut',
                description: [
                    `${eSuccess} | Status Premium untuk **${targetUser.username}** telah dicabut.`,
                    `-# DM notifikasi telah dikirimkan ke user.`
                ].join('\n'),
                footerText: ui.getFooter('premium')
            }));
        }

        // =====================================================
        // SUB: generate_voucher
        // =====================================================
        if (subcommand === 'generate_voucher') {
            const days = interaction.options.getInteger('days');
            const expDays = interaction.options.getInteger('expired_in_days');
            const code = 'NAURA-VIP-' + Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

            let expiresAt = null;
            if (expDays) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + expDays);
            }

            await PremiumVoucher.create({ code, durationDays: days, expiresAt });

            return interaction.editReply(buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                title: '🎟️ Voucher V.I.P Dibuat!',
                description: [
                    `${eSuccess} Berhasil membuat voucher!`,
                    ``,
                    `**Kode:** \`${code}\``,
                    `**Durasi:** ${days} Hari`,
                    `**Kadaluarsa:** ${expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'Tidak Pernah'}`,
                    ``,
                    `-# Bagikan kode ini kepada user yang berhak.`
                ].join('\n'),
                footerText: ui.getFooter('premium')
            }));
        }

        // =====================================================
        // SUB: redeem
        // =====================================================
        if (subcommand === 'redeem') {
            const code = interaction.options.getString('kode').toUpperCase().trim();
            const voucher = await PremiumVoucher.findOne({ where: { code } });

            if (!voucher) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Voucher Gagal', description: `${eError} Kode voucher tidak ditemukan atau salah!`, footerText: ui.getFooter('premium')
                }));
            }
            if (voucher.isRedeemed) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Voucher Gagal', description: `${eError} Kode ini sudah pernah digunakan.`, footerText: ui.getFooter('premium')
                }));
            }
            if (voucher.expiresAt && voucher.expiresAt < new Date()) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Voucher Gagal', description: `${eError} Kode voucher ini sudah kedaluwarsa.`, footerText: ui.getFooter('premium')
                }));
            }

            const newExpiry = new Date();
            if (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date()) {
                newExpiry.setTime(profile.premiumUntil.getTime() + (voucher.durationDays * 24 * 60 * 60 * 1000));
            } else {
                newExpiry.setDate(newExpiry.getDate() + voucher.durationDays);
            }

            profile.isPremium = true;
            profile.premiumUntil = newExpiry;
            await profile.save();

            voucher.isRedeemed = true;
            voucher.redeemedBy = interaction.user.id;
            voucher.redeemedAt = new Date();
            await voucher.save();

            const tierKey = ui.getPremiumTier(voucher.durationDays, true);
            const tierInfo = PREMIUM_TIERS[Object.keys(PREMIUM_TIERS).find(k => PREMIUM_TIERS[k].tier === tierKey)];
            const tierDisplayName = tierInfo ? tierInfo.name : `V.I.P (${voucher.durationDays} hari)`;

            // Kirim DM
            await sendPremiumDM(client, interaction.user.id, 'redeemed', {
                username: interaction.user.username,
                tierName: tierDisplayName,
                premiumUntil: newExpiry
            });

            return interaction.editReply(buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                title: `🎉 Voucher V.I.P Berhasil Ditebus!`,
                description: [
                    `${eSuccess} Selamat! Kamu berhasil menukar kode dan mendapatkan status **${tierDisplayName}**!`,
                    ``,
                    `⏳ **Berlaku Sampai:** <t:${Math.floor(newExpiry.getTime() / 1000)}:F>`,
                    ``,
                    `-# Gunakan \`/premium check\` untuk melihat detail langgananmu.`
                ].join('\n'),
                footerText: ui.getFooter('premium')
            }));
        }

        // =====================================================
        // SUB: stats (Owner Only)
        // =====================================================
        if (subcommand === 'stats') {
            const now = new Date();

            const activeSubscribers = await UserProfile.findAll({
                where: {
                    isPremium: true,
                    premiumUntil: { [Op.gt]: now }
                },
                attributes: ['userId', 'premiumUntil'],
                order: [['premiumUntil', 'ASC']]
            });

            const total = activeSubscribers.length;

            // Hitung distribusi tier berdasarkan sisa hari
            const dist = { supporter: 0, friends: 0, vip: 0 };
            for (const sub of activeSubscribers) {
                const d = Math.ceil((sub.premiumUntil.getTime() - now.getTime()) / (1000 * 3600 * 24));
                const t = ui.getPremiumTier(d, true);
                if (dist[t] !== undefined) dist[t]++;
            }

            // Daftar 10 terdekat expired
            const soonList = activeSubscribers.slice(0, 10).map((sub, idx) => {
                const d = Math.ceil((sub.premiumUntil.getTime() - now.getTime()) / (1000 * 3600 * 24));
                return `${idx + 1}. <@${sub.userId}> — **${d} hari tersisa** (<t:${Math.floor(sub.premiumUntil.getTime() / 1000)}:R>)`;
            });

            const statsDesc = [
                `## 📊 Statistik Premium Aktif`,
                ``,
                `**Total Subscriber Aktif:** \`${total}\``,
                ``,
                `**Distribusi Tier:**`,
                `・ 🌟 Supporter: \`${dist.supporter}\` user`,
                `・ 💫 Friends: \`${dist.friends}\` user`,
                `・ 👑 V.I.P: \`${dist.vip}\` user`,
                ``,
                total > 0
                    ? `**10 Subscriber Paling Dekat Expired:**\n${soonList.join('\n')}`
                    : `*Belum ada subscriber aktif.*`
            ].join('\n');

            return interaction.editReply(buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                authorName: 'Naura V.I.P Management — Owner Panel',
                title: `${ui.getEmoji('premium_crown') || '👑'} Statistik Subscriber`,
                description: statsDesc,
                footerText: ui.getFooter('premium')
            }));
        }
    },

    // =====================================================
    // PREFIX HANDLER (legacy)
    // =====================================================
    async executePrefix(message, args, client) {
        if (!args || args.length === 0) return message.reply('Gunakan `/premium` untuk GUI interaktif atau `n!premium check`.');

        const subcommand = args[0].toLowerCase();
        const eError = ui.getEmoji('error') || '❌';

        if (['add', 'remove'].includes(subcommand) && !isOwner(message.author.id)) {
            return message.reply(buildErrorContainerV2({
                title: 'Akses Ditolak',
                description: `${eError} | Hanya Owner yang dapat mengatur status V.I.P.`,
                footerText: ui.getFooter('premium')
            }));
        }

        const targetUser = message.mentions.users.first() || message.author;
        const cacheManager = require('../../src/managers/cacheManager');
        const profile = await cacheManager.getUserProfile(targetUser.id);

        if (subcommand === 'add') {
            if (!args[1] || !message.mentions.users.first()) return message.reply('Format salah: `n!premium add @user <hari>`');
            const days = parseInt(args[args.length - 1]);
            if (isNaN(days) || days < 1) return message.reply('Jumlah hari tidak valid.');

            const newExpiry = new Date();
            const currentExpiry = profile.premiumUntil ? new Date(profile.premiumUntil) : null;
            if (profile.isPremium && currentExpiry && currentExpiry > new Date()) {
                newExpiry.setTime(currentExpiry.getTime() + (days * 24 * 60 * 60 * 1000));
            } else {
                newExpiry.setDate(newExpiry.getDate() + days);
            }

            await cacheManager.updateUserProfile(targetUser.id, {
                isPremium: true,
                premiumUntil: newExpiry
            });

            const tierKey = ui.getPremiumTier(days, true);
            const tierInfo = PREMIUM_TIERS[Object.keys(PREMIUM_TIERS).find(k => PREMIUM_TIERS[k].tier === tierKey)];
            await sendPremiumDM(client, targetUser.id, 'activated', {
                username: targetUser.username,
                tierName: tierInfo ? tierInfo.name : 'V.I.P',
                premiumUntil: newExpiry
            });

            return message.reply(buildContainerV2({
                accentColorHex: ui.getColor('premium_vip'),
                title: '💎 V.I.P Status Diberikan',
                description: `💎 **${targetUser.username}** resmi menjadi **Premium** sampai <t:${Math.floor(newExpiry.getTime() / 1000)}:R>!`,
                footerText: ui.getFooter('premium')
            }));
        }

        if (subcommand === 'remove') {
            await cacheManager.updateUserProfile(targetUser.id, {
                isPremium: false,
                premiumUntil: null
            });

            await sendPremiumDM(client, targetUser.id, 'removed', { username: targetUser.username });

            return message.reply(buildContainerV2({
                accentColorHex: ui.getColor('error'),
                title: '🚫 Status Premium Dicabut',
                description: `✅ Status premium **${targetUser.username}** telah dicabut.`,
                footerText: ui.getFooter('premium')
            }));
        }

        if (subcommand === 'check') {
            const isPremium = profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date();
            const daysLeft = isPremium
                ? Math.ceil((profile.premiumUntil.getTime() - Date.now()) / (1000 * 3600 * 24))
                : 0;
            const tierKey = ui.getPremiumTier(daysLeft, isPremium);
            const tierInfo = PREMIUM_TIERS[Object.keys(PREMIUM_TIERS).find(k => PREMIUM_TIERS[k].tier === tierKey)];

            if (isPremium) {
                return message.reply(buildContainerV2({
                    accentColorHex: ui.getPremiumColor(tierKey),
                    title: `${ui.getPremiumEmoji(tierKey)} Status V.I.P — Aktif`,
                    description: `💎 **${targetUser.username}** adalah member **${tierInfo ? tierInfo.name : 'Premium'}** (Berakhir <t:${Math.floor(profile.premiumUntil.getTime() / 1000)}:R>).`,
                    footerText: ui.getFooter(`premium_${tierKey}`)
                }));
            } else {
                return message.reply(buildContainerV2({
                    accentColorHex: ui.getColor('primary'),
                    title: '👤 Status V.I.P — Tidak Aktif',
                    description: `👤 **${targetUser.username}** adalah member reguler. Gunakan \`/premium info\` untuk berlangganan.`,
                    footerText: ui.getFooter('premium')
                }));
            }
        }
    }
};
