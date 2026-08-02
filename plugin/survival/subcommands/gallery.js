const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const SHY_DIALOGS = [
    'U-Um... ini gambarnya... J-Jangan dilihat terlalu lama ya, bikin malu saja... 😳👉👈',
    'I-Ini kan memori khusus... Kamu benar-benar mau lihat? Ugh... janji ya jangan ketawa! 🫣✨',
    'H-Hmph! Aku kasih lihat foto ini cuma karena kamu member VIP ya, bukan karena aku suka padamu atau gimana... 💖',
    'I-Ini foto kenangannya... Simpan baik-baik ya, jangan sampai hilang... 🥺✨',
    'E-Eh? Kamu benar-benar pengen lihat memori ini denganku? M-Muka aku jadi hangat... 🙈💗'
];

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const profile = await cacheManager.getUserProfile(user.id);
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        // 💎 PROTEKSI VIP PREMIUM ONLY
        const isVIP = (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date());
        if (!isVIP) {
            const vipPayload = buildContainerV2({
                accentColorHex: '#FFD700',
                title: '👑 Galeri Memori Eksklusif VIP',
                iconURL: client.user.displayAvatarURL(),
                description: `${ui.getEmoji('star') || '⭐'} Fitur **Galeri Memori Survival** adalah hak istimewa khusus pengguna **VIP Premium**!\n\nBuka kenangan indah petualanganmu bersama Naura dengan mengaktifkan status VIP via \`/vip\` atau bergabung dengan donatur bot.`,
                footerText: 'Naura Premium Perks'
            });
            return interaction.reply({ ...vipPayload, flags: 64 });
        }

        const rpgState = survival.rpg_state || {};
        const unlockedCutscenes = rpgState.unlocked_cutscenes || [];

        if (unlockedCutscenes.length === 0) {
            const emptyPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: '📸 Galeri Memori Survival (VIP Edition)',
                description: 'Kamu belum membuka memori apapun. Teruslah berpetualang dan selesaikan event penting!',
                footerText: 'Naura Survival Gallery • VIP Prestige'
            });
            return interaction.reply(emptyPayload);
        }

        const options = [];
        if (unlockedCutscenes.includes('wedding')) {
            options.push({ label: 'Pernikahan Suci', value: 'wedding', emoji: ui.getEmoji('ring') || '💍', description: 'Memori saat kamu melamar kekasihmu.' });
        }

        const galleryPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: '📸 Galeri Memori Survival (VIP Edition)',
            description: `Buka kembali kenangan indah (atau buruk) yang telah kamu lalui di Naura RPG.\n\n**Cutscene Terbuka:** ${unlockedCutscenes.length}`,
            footerText: 'Naura Survival Gallery • VIP Prestige'
        });

        if (options.length === 0) return interaction.reply(galleryPayload);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('gallery_select')
            .setPlaceholder('Pilih Memori...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.reply({ ...galleryPayload, components: [row] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const memory = i.values[0];

            if (memory === 'wedding') {
                const randomShyDialog = SHY_DIALOGS[Math.floor(Math.random() * SHY_DIALOGS.length)];
                const weddingBanner = ui.getBanner ? ui.getBanner('wedding') : null;

                let files = [];
                let bannerAttachmentName;
                if (weddingBanner) {
                    files.push(new AttachmentBuilder(weddingBanner, { name: 'wedding.png' }));
                    bannerAttachmentName = 'wedding.png';
                }

                const weddingPayload = buildContainerV2({
                    accentColorHex: '#FF69B4',
                    title: '💍 Pernikahan Suci',
                    description: `*Momen paling membahagiakan dalam hidupmu...*\n\n> *"${randomShyDialog}"*`,
                    bannerAttachmentName,
                    footerText: 'Naura Survival Gallery • VIP Prestige'
                });

                return i.editReply({ ...weddingPayload, components: [row], files });
            }
        });
    }
};
