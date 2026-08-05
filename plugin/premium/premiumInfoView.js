// Tampilan /premium info: kartu tier, menu pilihan paket, dan alur QRIS.
const {
    ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder,
    ButtonStyle, ComponentType, AttachmentBuilder, MessageFlags
} = require('discord.js');
const fs = require('fs');
const ui = require('../../src/config/ui');
const env = require('../../src/config/env');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { PREMIUM_TIERS, tierByKey } = require('./premiumTiers');
const store = require('./premiumStore');
const { buildTierCard } = require('./premiumCard');

const QRIS_PATH = './assets/general/qris.jpg';
const COLLECTOR_MS = 120000;

// Flag ephemeral wajib digabung, bukan ditimpa, agar IsComponentsV2 selamat.
function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

function buildSelectRow(disabled) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('premium_tier_select')
            .setPlaceholder(disabled ? 'Menu sudah tidak aktif' : 'Pilih paket langganan untuk melihat detailnya...')
            .setDisabled(Boolean(disabled))
            .addOptions(Object.entries(PREMIUM_TIERS).map(([key, t]) => ({
                label: `${t.name} - ${t.price}`,
                description: `Akses penuh selama ${t.days} hari`,
                value: key,
                emoji: t.emoji
            })))
    );
}

function buildInfoPayload({ isPremium, tierData, daysLeft, attachment, disabled }) {
    const badge = ui.getEmoji('premium_badge') || '\ud83d\udc8e';

    return buildContainerV2({
        accentColorHex: isPremium ? ui.getPremiumColor(tierData.tier) : ui.getColor('primary'),
        title: `${badge} Naura V.I.P Subscription`,
        expression: isPremium ? 'celebrate' : 'info',
        description: [
            isPremium
                ? `Kamu sedang aktif sebagai **${tierData.name}**, masih ada **${daysLeft} hari** lagi. Terima kasih ya!`
                : `Yuk buat pengalamanmu bersama Naura jadi lebih seru dengan fitur eksklusif ini.`,
            ``,
            `Pilih paket dari menu di bawah untuk melihat **harga**, **daftar fitur**, dan **cara pembayaran** lewat QRIS.`,
            ``,
            `Kalau mau membandingkan semua tier sekaligus, ketik \`/premium benefits\` ya.`
        ].join('\n'),
        bannerAttachmentName: attachment ? 'premium-card.png' : null,
        buttonsRow: buildSelectRow(disabled),
        footerText: ui.getFooter('premium')
    });
}

function buildDetailPayload(tierInfo, qrisName, selectRow) {
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`premium_contact_owner_${tierInfo.tier}`)
            .setLabel('Sudah bayar - konfirmasi ke owner')
            .setStyle(ButtonStyle.Success)
    );

    return buildContainerV2({
        accentColorHex: ui.getPremiumColor(tierInfo.tier),
        title: `${ui.getPremiumEmoji(tierInfo.tier)} Rincian paket: ${tierInfo.name}`,
        description: [
            `**Harga:** \`${tierInfo.price}\` untuk ${tierInfo.days} hari`,
            ``,
            `**Fitur yang kamu dapatkan:**`,
            ...tierInfo.features.map(f => `\u30fb ${f}`),
            ``,
            `**Cara pembayarannya gampang:**`,
            `1. Pindai QR di bawah dengan dompet digital apa pun`,
            `2. Kirim sesuai nominal **${tierInfo.price}**`,
            `3. Tekan tombol **Sudah bayar** di bawah`,
            `4. Owner akan segera memproses langgananmu`,
            ``,
            `-# QRIS berlaku untuk semua e-wallet dan mobile banking. Konfirmasinya masih manual ya.`
        ].join('\n'),
        bannerAttachmentName: qrisName,
        buttonsRow: [selectRow, btnRow],
        footerText: ui.getFooter(`premium_${tierInfo.tier}`)
    });
}

function buildConfirmPayload() {
    const owners = env.OWNER_IDS && env.OWNER_IDS.length
        ? env.OWNER_IDS.map(id => `<@${id}>`).join(', ')
        : 'owner Naura';

    return buildContainerV2({
        accentColorHex: ui.getColor('success'),
        title: 'Langkah terakhir, konfirmasi pembayaran',
        expression: 'success',
        description: [
            `Terima kasih sudah menyelesaikan pembayarannya!`,
            ``,
            `**Hubungi owner berikut ya:** ${owners}`,
            ``,
            `**Sertakan ini saat konfirmasi:**`,
            `\u30fb Username Discord kamu`,
            `\u30fb Bukti transfer atau tangkapan layar pembayaran`,
            `\u30fb Paket yang kamu beli`,
            ``,
            `-# Naura titip pesan ke owner, biasanya cepat kok diprosesnya.`
        ].join('\n'),
        footerText: ui.getFooter('premium')
    });
}

async function runInfo(interaction, profile) {
    const isPremium = store.isActive(profile);
    const daysLeft = isPremium ? store.daysLeft(profile) : 0;
    const tierKey = ui.getPremiumTier(daysLeft, isPremium);
    const tierData = tierByKey(tierKey) || { name: 'Regular Member', tier: 'none' };

    const attachment = await buildTierCard(
        interaction.user, tierData, isPremium, daysLeft, store.expiryOf(profile), 'premium-card.png'
    );

    const state = { isPremium, tierData, daysLeft, attachment, disabled: false };
    const files = attachment ? [attachment] : [];
    const messageObj = await interaction.editReply({ ...buildInfoPayload(state), files });

    const collector = messageObj.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: COLLECTOR_MS
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply(ephemeral(buildErrorContainerV2({
                description: 'Menu ini punya orang yang memanggil perintahnya ya.',
                footerText: ui.getFooter('premium')
            })));
        }

        const tierInfo = PREMIUM_TIERS[i.values[0]];
        if (!tierInfo) return;

        const detailFiles = [];
        let qrisName = null;
        if (fs.existsSync(QRIS_PATH)) {
            detailFiles.push(new AttachmentBuilder(QRIS_PATH, { name: 'qris-naura.jpg' }));
            qrisName = 'qris-naura.jpg';
        }

        const payload = buildDetailPayload(tierInfo, qrisName, buildSelectRow(false));
        await i.update({ ...payload, files: detailFiles }).catch(() => {});
    });

    const btnCollector = messageObj.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_MS
    });

    btnCollector.on('collect', async i => {
        if (!i.customId.startsWith('premium_contact_owner_')) return;

        if (i.user.id !== interaction.user.id) {
            return i.reply(ephemeral(buildErrorContainerV2({
                description: 'Tombol ini punya orang yang memanggil perintahnya ya.',
                footerText: ui.getFooter('premium')
            })));
        }

        await i.reply(ephemeral(buildConfirmPayload()));
    });

    collector.on('end', () => {
        // Panel dibangun ulang seutuhnya. Mengirim components saja akan
        // mengosongkan isi Container V2.
        const closing = buildInfoPayload({ ...state, disabled: true });
        interaction.editReply({ ...closing, files: [] }).catch(() => {});
    });
}

module.exports = { runInfo, ephemeral };
