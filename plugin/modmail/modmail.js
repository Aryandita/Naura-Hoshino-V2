const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const ModMail = require('../../src/models/ModMail');
const GuildSettings = require('../../src/models/GuildSettings');
const ui = require('../../src/config/ui');
const fs = require('fs');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modmail')
        .setDescription('🛠️ [MOD] Perintah untuk mengelola tiket Modmail.')
        .addSubcommand(sub =>
            sub.setName('reply')
               .setDescription('Membalas pesan pengguna di tiket ini.')
               .addStringOption(opt => opt.setName('pesan').setDescription('Isi pesan balasan').setRequired(true))
               .addBooleanOption(opt => opt.setName('anonim').setDescription('Sembunyikan namamu?').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('close')
               .setDescription('Menutup tiket modmail ini.')
               .addStringOption(opt => opt.setName('alasan').setDescription('Alasan penutupan tiket'))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        const ticket = await ModMail.findOne({
            where: { channelId: interaction.channel.id, closed: false }
        });

        if (!ticket) {
            return ui.sendError(interaction, 'err_sys_10', true);
        }

        const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);

        if (subcommand === 'reply') {
            const replyText = interaction.options.getString('pesan');
            const isAnon = interaction.options.getBoolean('anonim') || false;

            if (!user) return ui.sendError(interaction, 'err_sys_11', true);

            const replyPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                authorName: 'Staff Server',
                iconURL: interaction.guild.iconURL(),
                description: replyText,
                footerText: isAnon ? 'Dibalas oleh: Staff Server' : `Dibalas oleh: ${interaction.user.tag}`
            });

            try {
                await user.send(replyPayload);

                const logPayload = buildContainerV2({
                    accentColorHex: '#5865F2',
                    authorName: interaction.user.tag,
                    iconURL: interaction.user.displayAvatarURL(),
                    description: `**Balasan terkirim:**\n${replyText}`,
                    footerText: ui.getFooter('core')
                });

                await interaction.reply(logPayload);
            } catch (err) {
                return ui.sendError(interaction, 'err_sys_12', true);
            }

        } else if (subcommand === 'close') {
            const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';

            try {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const msgArray = Array.from(messages.values()).reverse();
                let txt = `=== MODMAIL TRANSCRIPT ===\nUser: ${user ? user.tag : 'Unknown'}\nStaff Closer: ${interaction.user.tag}\nReason: ${reason}\n\n`;

                msgArray.forEach(m => {
                    txt += `[${new Date(m.createdTimestamp).toUTCString()}] ${m.author.tag}: ${m.content}\n`;
                });

                const fileName = `transcript-${ticket.channelId}.txt`;
                fs.writeFileSync(fileName, txt);
                const attachment = new AttachmentBuilder(fileName);

                if (user) await user.send({ content: `🔒 Tiket modmail ini telah ditutup oleh **${interaction.user.tag}**.\nAlasan: ${reason}\nBerikut adalah riwayat percakapan Anda:`, files: [attachment] }).catch(()=>null);
                await interaction.channel.send({ content: `Transcript berhasil diarsipkan.`, files: [attachment] });

                setTimeout(() => { if(fs.existsSync(fileName)) fs.unlinkSync(fileName); }, 5000);
            } catch(e) {
                logger.error('[Modmail Close Error] ' + e.message);
                if (user) await user.send({ content: `🔒 Tiket modmail ini telah ditutup.\nAlasan: ${reason}` }).catch(()=>null);
            }

            ticket.closed = true;
            await ticket.save();

            const closePayload = buildContainerV2({
                accentColorHex: '#ED4245',
                title: '📩 Tiket Ditutup',
                description: `Tiketmu telah ditutup oleh staf.\n**Alasan:** ${reason}`,
                footerText: ui.getFooter('core')
            });

            if (user) await user.send(closePayload).catch(() => {});

            const successPayload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: 'Tiket Ditutup',
                description: `${ui.getEmoji('success') || '✅'} Tiket telah ditutup. Channel ini akan dihapus dalam 10 detik.`,
                footerText: ui.getFooter('core')
            });

            await interaction.reply(successPayload);

            const settings = await GuildSettings.findOne({ where: { guildId: interaction.guild.id } });
            const logChannelId = settings?.settings?.modmail?.logChannelId;
            if (logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    logChannel.send(`📁 **Transkrip Modmail:** Tiket <@${ticket.userId}> ditutup oleh <@${interaction.user.id}>.\n**Alasan:** ${reason}`);
                }
            }

            setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
        }
    }
};
