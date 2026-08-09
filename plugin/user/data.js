'use strict';

const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { getUserProfile, getUserSurvival } = require('../../src/managers/cacheManager');
const { UserCosmetic, UserPet, UserFriend } = require('../../src/models');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { logger } = require('../../src/managers/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('data')
        .setDescription('Mengelola data privasi akunmu di sistem Naura.')
        .addSubcommand(sub =>
            sub
                .setName('export')
                .setDescription('Mengekspor seluruh datamu dan mengirimkannya via DM.')
        )
        .addSubcommand(sub =>
            sub
                .setName('delete')
                .setDescription('Menghapus SELURUH datamu dari Naura Hoshino.')
                .addBooleanOption(opt =>
                    opt
                        .setName('konfirmasi')
                        .setDescription('Kamu harus yakin 100% karena data TIDAK BISA KEMBALI.')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'export') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                // Kumpulkan semua data user
                const profile = await getUserProfile(userId);
                const survival = await getUserSurvival(userId);
                const cosmetics = await UserCosmetic.findAll({ where: { userId }, raw: true });
                const pets = await UserPet.findAll({ where: { userId }, raw: true });
                
                const dataExport = {
                    metadata: {
                        exportedAt: new Date().toISOString(),
                        user: interaction.user.tag,
                        userId: userId,
                        bot: "Naura Hoshino V2"
                    },
                    profile: profile ? profile.toJSON() : null,
                    survival: survival ? survival.toJSON() : null,
                    cosmetics: cosmetics || [],
                    pets: pets || []
                };

                const buffer = Buffer.from(JSON.stringify(dataExport, null, 4), 'utf-8');
                const attachment = new AttachmentBuilder(buffer, { name: `naura_data_export_${userId}.json` });

                const dmChannel = await interaction.user.createDM();
                
                const container = buildContainerV2({
                    title: '📂 Ekspor Data Privasimu!',
                    description: `Halo kak ${interaction.user.username}! Ini Naura bawain salinan seluruh datamu di sistem Naura yaa! (≧▽≦)\n\nSemua catatan level, koin, pet, dan item kakak udah Naura masukin rapi ke file JSON di bawah ini. Jaga baik-baik ya kak!`,
                    color: '#FFB6C1',
                    footerText: 'Naura Privacy Compliance'
                });

                await dmChannel.send({ ...container, files: [attachment] });

                return await interaction.editReply({
                    content: '✅ Ekspor data berhasil! Naura sudah mengirimkan datamu langsung ke DM ya kak~'
                });
            } catch (err) {
                logger.error(`[DATA EXPORT] Gagal ekspor data user ${userId}:`, err);
                return await interaction.editReply({
                    content: '❌ Uh oh, Naura kesulitan membungkus datamu tadi. Coba lagi nanti ya kak!'
                });
            }
        }

        if (sub === 'delete') {
            const confirmed = interaction.options.getBoolean('konfirmasi');
            
            if (!confirmed) {
                return await interaction.reply({
                    content: 'Pilihan konfirmasi harus disetel ke `True` jika kakak benar-benar ingin menghapus data. Hati-hati ya kak, ini tidak bisa dibatalkan! 🥺',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Tampilkan tombol konfirmasi kedua
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`data_delete_confirm_${userId}`)
                    .setLabel('Ya, Hapus Semuanya!')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`data_delete_cancel_${userId}`)
                    .setLabel('Batal, Aku Berubah Pikiran')
                    .setStyle(ButtonStyle.Secondary)
            );

            const container = buildContainerV2({
                title: '⚠️ Konfirmasi Hapus Data!',
                description: `Kak ${interaction.user.username}... kamu yakin mau menghapus **semua** data kakak di Naura? 🥺\n\nLevel, Koin, Pet, Item, semuanya akan hangus selamanya dan Naura nggak bisa mengembalikannya. Klik tombol merah di bawah kalau kakak sudah yakin 100% ya...`,
                color: '#EF4444',
                buttonsRow: row
            });

            await interaction.reply({ ...container, flags: MessageFlags.Ephemeral });
        }
    }
};
