'use strict';

const { MessageFlags } = require('discord.js');

const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { safeParseInventory } = require('../inventoryHelper');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const STARTER_FLAG = 'survival_started';

// Daftar ini yang benar-benar masuk ke tas pemain. Deskripsi di bawah dibangun
// dari daftar yang sama supaya tidak pernah lagi menjanjikan barang yang tidak ada.
const STARTER_KIT = [
    { id: 'survival_started', name: 'Surat Pendaftaran', note: 'Bukti kamu resmi jadi warga', icon: '\uD83D\uDCDC' },
    { id: 'mineral_water', name: 'Air Mineral', note: 'Biar nggak kehausan di jalan', icon: '\uD83D\uDCA7' },
    { id: 'apple', name: 'Apel Segar', note: 'Camilan kecil dari Naura', icon: '\uD83C\uDF4E' }
];

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;

        const profile = await cacheManager.getUserProfile(user.id);
        await UserSurvival.findOrCreate({ where: { userId: user.id } });

        const inventory = safeParseInventory(profile.inventory);

        if (inventory.some(item => item?.id === STARTER_FLAG)) {
            const payload = buildErrorContainerV2({
                title: `${e('akward', '\uD83C\uDF92')} Kamu sudah pernah ambil, lho`,
                description: 'Starter Kit ini cuma bisa diambil sekali yaa. Tapi tenang, Naura tetap nemenin petualanganmu kok!',
                footerText: ui.getFooter('survival')
            });
            return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        }

        await UserProfile.update(
            { inventory: inventory.concat(STARTER_KIT.map(({ id, name }) => ({ id, name }))) },
            { where: { userId: user.id } }
        );

        const daftarBarang = STARTER_KIT
            .map(item => `${item.icon} **${item.name}** \u2014 ${item.note}`)
            .join('\n');

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('success') || '#00FF00',
            authorName: 'Naura Survival Onboarding',
            title: `${e('cheers', '\uD83C\uDF92')} Selamat datang, petualang baru!`,
            iconURL: user.displayAvatarURL(),
            description: `Halo **${user.displayName}**! Naura senang banget kamu ikut bertualang di sini.\n\n`
                + `Naura sudah siapkan bekal kecil buat kamu, semoga membantu di hari pertama:\n\n${daftarBarang}\n\n`
                + 'Semua sudah Naura masukkan ke tasmu. Coba mulai dengan `/survival collect` buat mengumpulkan bahan pertamamu, yaa!',
            footerText: ui.getFooter('survival')
        });

        return interaction.reply(payload);
    }
};
