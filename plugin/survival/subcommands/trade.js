// plugin/survival/subcommands/trade.js
const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const ui = require('../../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');

module.exports = {
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user');
        const nsfAmount = interaction.options.getInteger('nsf') || 0;
        const sender = interaction.user;

        if (!targetUser) {
            return interaction.reply({
                ...buildErrorContainerV2({ errorMessage: 'Harap sebutkan pengguna yang ingin kamu ajak trading (misal: `/survival trade user:@member nsf:100`).' }),
                flags: MessageFlags.Ephemeral
            });
        }

        if (targetUser.bot || targetUser.id === sender.id) {
            return interaction.reply({
                ...buildErrorContainerV2({ errorMessage: 'Tidak bisa bertransaksi dengan bot atau dirimu sendiri.' }),
                flags: MessageFlags.Ephemeral
            });
        }

        if (nsfAmount <= 0) {
            return interaction.reply({
                ...buildErrorContainerV2({ errorMessage: 'Jumlah Star Fragment (NSF) yang ingin ditukarkan harus lebih dari 0.' }),
                flags: MessageFlags.Ephemeral
            });
        }

        const [senderSurvival] = await UserSurvival.findOrCreate({ where: { userId: sender.id } });
        const [targetSurvival] = await UserSurvival.findOrCreate({ where: { userId: targetUser.id } });

        if ((senderSurvival.starFragments || 0) < nsfAmount) {
            return interaction.reply({
                ...buildErrorContainerV2({
                    errorMessage: `Saldo NSF milikmu tidak cukup. Saldo saat ini: **${senderSurvival.starFragments || 0}** ${ui.getEmoji('nsf') || '🪙'} NSF.`
                }),
                flags: MessageFlags.Ephemeral
            });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trade_accept').setLabel('Terima Transfer').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('success') || '✅'),
            new ButtonBuilder().setCustomId('trade_reject').setLabel('Tolak').setStyle(ButtonStyle.Danger).setEmoji(ui.getEmoji('error') || '❌')
        );

        const tradePayload = buildContainerV2({
            accentColorHex: '#00FFFF',
            authorName: 'Naura Secure P2P Trading Engine',
            title: `🤝 Penawaran Transfer Star Fragment`,
            description: [
                `<@${sender.id}> ingin mentransfer **${nsfAmount.toLocaleString('id-ID')}** ${ui.getEmoji('nsf') || '🪙'} Star Fragment kepada <@${targetUser.id}>!`,
                '',
                `Tekan **Terima Transfer** di bawah ini untuk mengonfirmasi penerimaan.`
            ].join('\n'),
            buttonsRow: confirmRow,
            footerText: ui.getFooter('survival')
        });

        const reply = await interaction.reply({ ...tradePayload, fetchReply: true });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== targetUser.id) {
                return i.reply({ content: 'Penawaran transfer ini bukan untukmu!', ephemeral: true });
            }

            if (i.customId === 'trade_accept') {
                // Re-check saldo sender
                await senderSurvival.reload();
                if ((senderSurvival.starFragments || 0) < nsfAmount) {
                    return i.update({
                        ...buildErrorContainerV2({ errorMessage: 'Transfer gagal: Saldo pengirim sudah tidak mencukupi.' }),
                        components: []
                    });
                }

                senderSurvival.starFragments -= nsfAmount;
                targetSurvival.starFragments = (targetSurvival.starFragments || 0) + nsfAmount;

                await senderSurvival.save();
                await targetSurvival.save();

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#00FF00',
                    authorName: 'Naura Secure P2P Trading Engine',
                    title: `✅ Transfer Berhasil!`,
                    description: `Transfer **${nsfAmount.toLocaleString('id-ID')}** ${ui.getEmoji('nsf') || '🪙'} NSF dari <@${sender.id}> ke <@${targetUser.id}> telah selesai dilakukan!`,
                    footerText: ui.getFooter('survival')
                });

                return i.update(successPayload);
            } else {
                const rejectPayload = buildContainerV2({
                    accentColorHex: ui.getColor('error') || '#FF0000',
                    authorName: 'Naura Secure P2P Trading Engine',
                    title: `❌ Transfer Ditolak`,
                    description: `<@${targetUser.id}> menolak penawaran transfer dari <@${sender.id}>.`,
                    footerText: ui.getFooter('survival')
                });
                return i.update(rejectPayload);
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    ...buildErrorContainerV2({ errorMessage: 'Penawaran transfer kedaluwarsa (Waktu habis).' }),
                    components: []
                }).catch(() => {});
            }
        });
    }
};
