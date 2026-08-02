const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');
const Giveaway = require('../../src/models/Giveaway');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Sistem Giveaway Canggih Naura')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addSubcommand(sub => sub
            .setName('start')
            .setDescription('Mulai giveaway baru')
            .addStringOption(opt => opt.setName('durasi').setDescription('Contoh: 1h, 1d, 30m').setRequired(true))
            .addIntegerOption(opt => opt.setName('pemenang').setDescription('Jumlah pemenang').setRequired(true))
            .addStringOption(opt => opt.setName('hadiah').setDescription('Hadiah giveaway').setRequired(true))
            .addRoleOption(opt => opt.setName('role_syarat').setDescription('Role wajib yang harus dimiliki (Opsional)').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('end')
            .setDescription('Akhiri giveaway secara paksa')
            .addStringOption(opt => opt.setName('message_id').setDescription('ID Pesan Giveaway').setRequired(true))
        ),

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'start') {
            const durasiStr = interaction.options.getString('durasi');
            const durasiMs = ms(durasiStr);
            if (!durasiMs) {
                const errPayload = buildErrorContainerV2({ title: 'Format Salah', description: 'Format waktu salah! Gunakan: 1h, 1d, 30m.', footerText: ui.getFooter('core') });
                return interaction.reply({ ...errPayload, ephemeral: true });
            }

            const pemenang = interaction.options.getInteger('pemenang');
            const hadiah = interaction.options.getString('hadiah');
            const reqRole = interaction.options.getRole('role_syarat');
            
            const endTimeDate = new Date(Date.now() + durasiMs);
            const unixEnd = Math.floor(endTimeDate.getTime() / 1000);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('accent') || '#f9a8d4',
                title: `${ui.getEmoji('reward') || '🎉'} GIVEAWAY: ${hadiah} ${ui.getEmoji('reward') || '🎉'}`,
                description: `Klik reaksi 🎉 untuk ikut serta!\n\n${ui.getEmoji('progressDot') || '🔹'} **Jumlah Pemenang:** ${pemenang}\n${ui.getEmoji('progressDot') || '🔹'} **Disponsori oleh:** <@${interaction.user.id}>\n${ui.getEmoji('progressDot') || '🔹'} **Berakhir:** <t:${unixEnd}:R>\n${reqRole ? `${ui.getEmoji('progressDot') || '🔹'} **Syarat:** Harus punya role <@&${reqRole.id}>` : ''}`,
                footerText: ui.getFooter('core')
            });

            const reply = await interaction.reply({ ...payload, fetchReply: true });
            await reply.react('🎉');

            await Giveaway.create({
                messageId: reply.id,
                channelId: interaction.channelId,
                guildId: interaction.guildId,
                prize: hadiah,
                winnersCount: pemenang,
                endTime: endTimeDate,
                hostId: interaction.user.id
            });
        }
        
        if (subCmd === 'end') {
            const msgId = interaction.options.getString('message_id');
            const gwData = await Giveaway.findByPk(msgId);
            if (!gwData || gwData.ended) {
                const errPayload = buildErrorContainerV2({ title: 'Giveaway Tidak Ditemukan', description: 'Giveaway tidak ditemukan atau sudah berakhir.', footerText: ui.getFooter('core') });
                return interaction.reply({ ...errPayload, ephemeral: true });
            }
            
            const endPayload = buildContainerV2({ title: 'Mengakhiri Giveaway', description: 'Mengakhiri giveaway secara manual...', footerText: ui.getFooter('core') });
            await interaction.reply({ ...endPayload, ephemeral: true });
            
            const { client } = interaction;
            const gwManager = new (require('../../src/managers/giveawayManager'))(client);
            await gwManager.endGiveaway(gwData, true);
        }
    }
};
