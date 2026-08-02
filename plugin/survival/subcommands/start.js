const { MessageFlags } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        
        // Panggil atau buat data pemain di database via cacheManager
        const profile = await cacheManager.getUserProfile(user.id);
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        const currentInv = safeParseInventory(profile.inventory);
        
        // ✨ PERBAIKAN LOGIKA: Cek apakah pemain sudah punya item Starter Kit spesifik
        const hasClaimedStarter = currentInv.some(item => item?.id === 'survival_started');

        if (hasClaimedStarter) {
            const errPayload = buildErrorContainerV2({
                title: 'Starter Kit Sudah Diambil',
                description: 'Kamu sudah mengambil Starter Kit ini sebelumnya!',
                footerText: ui.getFooter('survival')
            });
            return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        // Berikan Item Pemula (Starter Kit)
        const starterKit = [
            { id: 'survival_started', name: 'Surat Pendaftaran' },
            { id: 'mineral_water', name: 'Air Mineral' },
            { id: 'apple', name: 'Apel Segar' }
        ];

        // ✨ PERBAIKAN LOGIKA: Gabungkan item starter dengan item yang mungkin sudah mereka miliki
        const newInv = currentInv.concat(starterKit);

        // Simpan inventory baru ke database
        await UserProfile.update({ inventory: newInv }, { where: { userId: user.id } });

        const welcomePayload = buildContainerV2({
            accentColorHex: ui.getColor('success'),
            authorName: 'Naura Survival Onboarding',
            title: '🎒 Starter Kit Survival Naura',
            iconURL: user.displayAvatarURL(),
            description: `Selamat datang di petualangan Survival, **${user.displayName}**!\n\nSebagai bantuan awal, kamu mendapatkan paket perlengkapan berikut:\n\n${ui.getEmoji('axe') || '🪓'} **Kapak Kayu Tua** (Untuk menebang di Hutan)\n${ui.getEmoji('pickaxe') || '⛏️'} **Beliung Kayu Tua** (Untuk menambang)\n${ui.getEmoji('dagger') || '🗡️'} **Pedang Tua** (Senjata dasar di Dungeon)\n${ui.getEmoji('food') || '🍲'} **Ransum Dasar** (Air & Apel)\n\n*Barang-barang ini telah ditambahkan ke dalam tasmu. Gunakan perintah \`/survival collect\` untuk mulai mencari sumber daya!*`,
            footerText: ui.getFooter('survival')
        });

        await interaction.reply(welcomePayload);
    }
};