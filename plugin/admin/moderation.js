const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Kumpulan alat moderasi canggih untuk Admin')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('purge')
            .setDescription('Hapus pesan dalam jumlah banyak sekaligus (hingga 1000 pesan)')
            .addIntegerOption(opt => opt.setName('jumlah').setDescription('Jumlah pesan yang dihapus (1-1000)').setRequired(true).setMinValue(1).setMaxValue(1000))
            .addUserOption(opt => opt.setName('user').setDescription('Hanya hapus pesan dari user ini').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('nuke')
            .setDescription('Kloning dan hapus channel ini (Darurat/Pembersihan Total)')
        )
        .addSubcommand(sub =>
            sub.setName('roleall')
            .setDescription('Tambahkan atau cabut role dari SEMUA member di server')
            .addRoleOption(opt => opt.setName('role').setDescription('Role yang akan diproses').setRequired(true))
            .addStringOption(opt => opt.setName('aksi').setDescription('Tambah atau Cabut?').setRequired(true).addChoices(
                { name: 'Tambah', value: 'add' },
                { name: 'Cabut', value: 'remove' }
            ))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'purge') {
            const amount = interaction.options.getInteger('jumlah');
            const targetUser = interaction.options.getUser('user');

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                let deletedCount = 0;
                let fetchAmount = amount;
                let lastMessageId = null;

                const statusPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFB6C1',
                    title: `${ui.getEmoji('tools_generic') || '🧹'} Purge Messages`,
                    description: `${ui.getEmoji('loading') || '⏳'} Sedang menghapus pesan... Mohon tunggu (0/${amount})`,
                    footerText: ui.getFooter('core')
                });
                await interaction.editReply(statusPayload);

                while (fetchAmount > 0) {
                    const fetchLimit = Math.min(fetchAmount, 100);
                    const options = { limit: fetchLimit };
                    if (lastMessageId) options.before = lastMessageId;

                    let messages = await interaction.channel.messages.fetch(options);
                    if (messages.size === 0) break;

                    lastMessageId = messages.last().id;

                    if (targetUser) {
                        messages = messages.filter(m => m.author.id === targetUser.id);
                    }

                    if (messages.size > 0) {
                        const deleted = await interaction.channel.bulkDelete(messages, true);
                        deletedCount += deleted.size;

                        if (deleted.size < messages.size) {
                            break;
                        }
                    }

                    fetchAmount -= fetchLimit;

                    if (fetchAmount > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        const updatePayload = buildContainerV2({
                            accentColorHex: ui.getColor('primary') || '#FFB6C1',
                            title: `${ui.getEmoji('tools_generic') || '🧹'} Purge Messages`,
                            description: `${ui.getEmoji('loading') || '⏳'} Sedang menghapus pesan... Mohon tunggu (${deletedCount}/${amount})`,
                            footerText: ui.getFooter('core')
                        });
                        await interaction.editReply(updatePayload).catch(() => {});
                    }
                }

                const finalPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: `${ui.getEmoji('success') || '✅'} Purge Selesai`,
                    description: `${ui.getEmoji('success') || '✅'} Berhasil menghapus **${deletedCount}** pesan${targetUser ? ` dari ${targetUser.username}` : ''}.\n*(Pesan yang usianya lebih dari 14 hari diabaikan oleh Discord)*`,
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(finalPayload);
            } catch (error) {
                logger.error("[Purge Error]:", error);
                const errPayload = buildErrorContainerV2({ title: 'Gagal Purge', description: `${ui.getEmoji('error') || '❌'} Terjadi kesalahan fatal saat menghapus pesan.`, footerText: ui.getFooter('core') });
                await interaction.editReply(errPayload);
            }
        }

        else if (subcommand === 'nuke') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                const errPayload = buildErrorContainerV2({ title: 'Akses Ditolak', description: `${ui.getEmoji('error') || '❌'} Kamu tidak punya izin **Manage Channels**.`, footerText: ui.getFooter('core') });
                return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
            }

            const confirmPayload = buildContainerV2({
                accentColorHex: '#ff0000',
                title: `${ui.getEmoji('radioactive') || '☢️'} TACTICAL NUKE INCOMING!`,
                description: `Kamu yakin ingin me-nuke channel ini?\n\nChannel akan dihapus dan dikloning. Semua pesan akan hilang selamanya.\nKetik \`CONFIRM\` dalam 10 detik di obrolan ini untuk melanjutkan.`,
                footerText: ui.getFooter('core')
            });

            await interaction.reply({ ...confirmPayload, ephemeral: false });

            const filter = m => m.author.id === interaction.user.id && m.content === 'CONFIRM';
            const collector = interaction.channel.createMessageCollector({ filter, time: 10000, max: 1 });

            collector.on('collect', async () => {
                try {
                    const channel = interaction.channel;
                    const position = channel.position;

                    const newChannel = await channel.clone();
                    await newChannel.setPosition(position);
                    await channel.delete();

                    const successPayload = buildContainerV2({
                        accentColorHex: '#00FFFF',
                        title: `${ui.getEmoji('radioactive') || '☢️'} Channel Di-nuke`,
                        description: `${ui.getEmoji('radioactive') || '☢️'} **Channel berhasil di-nuke oleh ${interaction.user.username}**`,
                        footerText: ui.getFooter('core')
                    });

                    await newChannel.send(successPayload);
                } catch (e) {
                    logger.error("[Nuke Error]:", e);
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    const cancelPayload = buildErrorContainerV2({ title: 'Nuke Dibatalkan', description: `${ui.getEmoji('error') || '❌'} Operasi nuke dibatalkan (Waktu habis).`, footerText: ui.getFooter('core') });
                    interaction.editReply(cancelPayload).catch(()=>{});
                }
            });
        }

        else if (subcommand === 'roleall') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                const errPayload = buildErrorContainerV2({ title: 'Akses Ditolak', description: `${ui.getEmoji('error') || '❌'} Kamu tidak punya izin **Manage Roles**.`, footerText: ui.getFooter('core') });
                return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
            }

            const targetRole = interaction.options.getRole('role');
            const action = interaction.options.getString('aksi');

            if (targetRole.position >= interaction.guild.members.me.roles.highest.position) {
                const errPayload = buildErrorContainerV2({ title: 'Role Lebih Tinggi', description: `${ui.getEmoji('error') || '❌'} Role tersebut lebih tinggi atau sama dengan role tertinggi saya. Saya tidak bisa memodifikasinya.`, footerText: ui.getFooter('core') });
                return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply();

            const members = await interaction.guild.members.fetch();
            let successCount = 0;
            let skipCount = 0;

            const processingPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: `${ui.getEmoji('loading') || '⏳'} Memproses Role All`,
                description: `${ui.getEmoji('loading') || '⏳'} Sedang memproses pemberian/pencabutan role **${targetRole.name}** ke ${members.size} member...`,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(processingPayload);

            for (const [, member] of members) {
                try {
                    if (action === 'add') {
                        if (!member.roles.cache.has(targetRole.id)) {
                            await member.roles.add(targetRole);
                            successCount++;
                        } else skipCount++;
                    } else {
                        if (member.roles.cache.has(targetRole.id)) {
                            await member.roles.remove(targetRole);
                            successCount++;
                        } else skipCount++;
                    }
                } catch (e) {
                }
            }

            const finalPayload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: `${ui.getEmoji('success') || '✅'} Operasi Role-All Selesai`,
                description: `**Aksi:** ${action === 'add' ? 'Penambahan' : 'Pencabutan'} Role <@&${targetRole.id}>\n\n**Berhasil:** ${successCount} member\n**Dilewati (Sudah sesuai/Gagal):** ${skipCount} member`,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(finalPayload);
        }
    }
};
