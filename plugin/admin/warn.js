const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const UserWarn = require('../../src/models/UserWarn');
const ui = require('../../src/config/ui');
const GuildSettings = require('../../src/models/GuildSettings');
const { logger } = require('../../src/managers/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('⚠️ Sistem peringatan untuk member.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .addSubcommand(sub =>
            sub.setName('add')
            .setDescription('Berikan peringatan kepada member.')
            .addUserOption(opt => opt.setName('user').setDescription('User yang akan diberi peringatan').setRequired(true))
            .addStringOption(opt => opt.setName('alasan').setDescription('Alasan peringatan').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('check')
            .setDescription('Lihat daftar peringatan milik member.')
            .addUserOption(opt => opt.setName('user').setDescription('User yang akan diperiksa').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
            .setDescription('Hapus satu peringatan berdasarkan ID.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID Peringatan yang akan dihapus').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('clear')
            .setDescription('Hapus SEMUA peringatan milik member.')
            .addUserOption(opt => opt.setName('user').setDescription('User yang akan dihapus semua peringatannya').setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'add') {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('alasan');

            if (user.bot) return interaction.reply({ content: '❌ Kamu tidak bisa memberikan peringatan kepada bot.', ephemeral: true });

            const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
            if(targetMember) {
                 if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                     return interaction.reply({ content: '❌ Kamu tidak bisa memberi peringatan kepada member dengan role yang sama atau lebih tinggi darimu.', ephemeral: true });
                 }
                 if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                     return interaction.reply({ content: '❌ Aku tidak bisa memberikan tindakan pada member yang rolenya lebih tinggi dariku.', ephemeral: true });
                 }
            }
            if (user.id === interaction.user.id) return interaction.reply({ content: '❌ Kamu tidak bisa memberikan peringatan kepada diri sendiri.', ephemeral: true });

            await UserWarn.create({
                userId: user.id,
                guildId: guildId,
                moderatorId: interaction.user.id,
                reason: reason
            });

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('error') || '#ff0000',
                authorName: '⚠️ Peringatan Diberikan',
                title: `Peringatan: ${user.username}`,
                iconURL: user.displayAvatarURL(),
                description: `**User:** ${user} (${user.tag})\n**Moderator:** ${interaction.user}\n**Alasan:** ${reason}`,
                footerText: ui.getFooter('core')
            });

            await interaction.reply(payload);

            // Punishment Ladder System
            try {
                const totalWarns = await UserWarn.count({ where: { guildId, userId: user.id } });
                const settings = await GuildSettings.findOne({ where: { guildId } });

                if (settings && settings.settings && settings.settings.warn_punishments) {
                    const action = settings.settings.warn_punishments[totalWarns];

                    if (action === 'dm') {
                         await user.send(`⚠️ Kamu mendapat peringatan ke-${totalWarns} di server **${interaction.guild.name}**.\nAlasan: ${reason}`).catch(() => null);
                    }
                    else if (action === 'mute' && targetMember) {
                         // Timeout 1 Jam
                         await targetMember.timeout(60 * 60 * 1000, 'Warn Punishment Ladder').catch(e => logger.error(e));
                         await interaction.channel.send(`🤫 <@${user.id}> telah di-timeout otomatis selama 1 jam karena mencapai ${totalWarns} Peringatan.`);
                    }
                    else if (action === 'kick' && targetMember) {
                         await targetMember.kick('Warn Punishment Ladder').catch(e => logger.error(e));
                         await interaction.channel.send(`👢 <@${user.id}> telah di-kick otomatis karena mencapai ${totalWarns} Peringatan.`);
                    }
                    else if (action === 'ban' && targetMember) {
                         await targetMember.ban({ reason: 'Warn Punishment Ladder' }).catch(e => logger.error(e));
                         await interaction.channel.send(`🔨 <@${user.id}> telah di-ban otomatis karena mencapai ${totalWarns} Peringatan.`);
                    }
                }
            } catch (err) {
                logger.error('[Warn] Failed to execute punishment ladder: ' + err.message);
            }

            try {
                await user.send(`⚠️ Kamu mendapat peringatan di server **${interaction.guild.name}**!\n**Alasan:** ${reason}`);
            } catch (e) {
                // User may have DMs disabled
            }
        }
        else if (subcommand === 'check') {
            const user = interaction.options.getUser('user');
            const warns = await UserWarn.findAll({ where: { userId: user.id, guildId: guildId } });

            const desc = warns.length === 0
                ? '✅ User ini bersih, tidak memiliki peringatan.'
                : `User ini memiliki **${warns.length}** peringatan:\n\n` +
                  warns.map(w => `**ID:** \`${w.id}\` | **Mod:** <@${w.moderatorId}>\n**Alasan:** ${w.reason}\n**Tanggal:** <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`).join('\n\n');

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#2b2d31',
                authorName: `Daftar Peringatan: ${user.tag}`,
                title: `📊 Log Warn ${user.username}`,
                iconURL: user.displayAvatarURL(),
                description: desc,
                footerText: ui.getFooter('core')
            });

            await interaction.reply(payload);
        }
        else if (subcommand === 'remove') {
            const id = interaction.options.getInteger('id');
            const warn = await UserWarn.findOne({ where: { id: id, guildId: guildId } });

            if (!warn) {
                return interaction.reply({ content: `❌ Peringatan dengan ID \`${id}\` tidak ditemukan di server ini.`, ephemeral: true });
            }

            await warn.destroy();
            await interaction.reply(`✅ Berhasil menghapus peringatan dengan ID \`${id}\`.`);
        }
        else if (subcommand === 'clear') {
            const user = interaction.options.getUser('user');

            const deletedCount = await UserWarn.destroy({ where: { userId: user.id, guildId: guildId } });

            if (deletedCount === 0) {
                return interaction.reply({ content: `❌ User ${user} tidak memiliki peringatan untuk dihapus.`, ephemeral: true });
            }

            await interaction.reply(`✅ Berhasil menghapus semua (${deletedCount}) peringatan milik ${user}.`);
        }
    }
};
