'use strict';

const { MessageFlags } = require('discord.js');

const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { safeParseInventory, addOrStackItem } = require('../inventoryHelper');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const STARTER_FLAG = 'survival_started';

// Semua ID di bawah ini sudah dicocokkan dengan katalog item:
// wooden_axe ada di items_static.js, sedangkan wooden_pickaxe dan wooden_sword
// didefinisikan di items_wooden.js. Kartu sambutan dibangun dari daftar yang
// sama, jadi teks dan isi tas tidak akan pernah lagi berbeda.
const STARTER_KIT = [
    { id: STARTER_FLAG, name: 'Surat Pendaftaran', amount: 1, icon: '\uD83D\uDCDC', note: 'Bukti kamu resmi jadi warga' },
    { id: 'wooden_axe', name: 'Kapak Kayu (Lv. 1)', amount: 1, icon: '\uD83E\uDE93', note: 'Buat menebang pohon di hutan' },
    { id: 'wooden_pickaxe', name: 'Beliung Kayu (Lv. 1)', amount: 1, icon: '\u26CF\uFE0F', note: 'Buat menambang batu di gua' },
    { id: 'wooden_sword', name: 'Pedang Kayu (Lv. 1)', amount: 1, icon: '\uD83D\uDDE1\uFE0F', note: 'Senjata latihan pertamamu' },
    { id: 'apple', name: 'Apel Segar', amount: 2, icon: '\uD83C\uDF4E', note: 'Camilan kecil dari Naura' },
    { id: 'mineral_water', name: 'Air Mineral', amount: 3, icon: '\uD83D\uDCA7', note: 'Biar nggak kehausan di jalan' }
];

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function grantStarterKit(inventory) {
    return STARTER_KIT.reduce(
        (inv, item) => addOrStackItem(inv, { id: item.id, name: item.name, amount: item.amount }),
        inventory
    );
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
            { inventory: grantStarterKit(inventory) },
            { where: { userId: user.id } }
        );

        const daftarBarang = STARTER_KIT
            .map(item => `${item.icon} **${item.name}**${item.amount > 1 ? ` \u00D7${item.amount}` : ''} \u2014 ${item.note}`)
            .join('\n');

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('success') || '#00FF00',
            authorName: 'Naura Survival Onboarding',
            title: `${e('cheers', '\uD83C\uDF92')} Selamat datang, petualang baru!`,
            iconURL: user.displayAvatarURL(),
            description: `Halo **${user.displayName}**! Naura senang banget kamu ikut bertualang di sini.\n\n`
                + `Naura sudah siapkan bekal lengkap buat kamu. Semuanya masih dari kayu, tapi cukup kok buat hari pertama:\n\n${daftarBarang}\n\n`
                + 'Semuanya sudah Naura masukkan ke tasmu. Coba mulai dengan `/survival collect` buat mengumpulkan bahan pertamamu, yaa!',
            footerText: ui.getFooter('survival')
        });

        return interaction.reply(payload);
    }
};
