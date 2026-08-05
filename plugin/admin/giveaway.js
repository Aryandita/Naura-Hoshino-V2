const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const ms = require('ms');
const Giveaway = require('../../src/models/Giveaway');
const ui = require('../../src/config/ui');
const { logger } = require('../../src/managers/logger');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

const PARTY = '\ud83c\udf89';

// Flag digabung, bukan ditimpa, supaya IsComponentsV2 tidak hilang.
function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

function dot() {
    return ui.getEmoji('progressDot') || '\u2022';
}

// Instans milik client didahulukan agar penjadwalnya tidak berlipat.
function managerOf(client) {
    if (client.giveawayManager) return client.giveawayManager;
    const GiveawayManager = require('../../src/managers/giveawayManager');
    client.giveawayManager = new GiveawayManager(client);
    return client.giveawayManager;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Sistem giveaway Naura')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addSubcommand(sub => sub
            .setName('start')
            .setDescription('Mulai giveaway baru')
            .addStringOption(opt => opt.setName('durasi').setDescription('Contoh: 1h, 1d, 30m').setRequired(true))
            .addIntegerOption(opt => opt.setName('pemenang').setDescription('Jumlah pemenang').setRequired(true).setMinValue(1))
            .addStringOption(opt => opt.setName('hadiah').setDescription('Hadiah giveaway').setRequired(true))
            .addRoleOption(opt => opt.setName('role_syarat').setDescription('Role wajib yang harus dimiliki (opsional)').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('end')
            .setDescription('Akhiri giveaway secara paksa')
            .addStringOption(opt => opt.setName('message_id').setDescription('ID pesan giveaway').setRequired(true))
        ),

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'start') {
            const durasiStr = interaction.options.getString('durasi');
            const durasiMs = ms(durasiStr);

            if (!durasiMs || durasiMs <= 0) {
                return interaction.reply(ephemeral(buildErrorContainerV2({
                    title: 'Formatnya belum pas',
                    description: 'Naura belum paham durasinya. Coba tulis seperti `1h`, `1d`, atau `30m` ya!',
                    footerText: ui.getFooter('core')
                })));
            }

            const pemenang = interaction.options.getInteger('pemenang');
            const hadiah = interaction.options.getString('hadiah');
            const reqRole = interaction.options.getRole('role_syarat');

            const endTimeDate = new Date(Date.now() + durasiMs);
            const unixEnd = Math.floor(endTimeDate.getTime() / 1000);

            const syarat = reqRole
                ? `\n${dot()} **Syarat:** harus punya role <@&${reqRole.id}>`
                : '';

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('accent'),
                title: `GIVEAWAY: ${hadiah}`,
                expression: 'celebrate',
                description:
                    `Klik reaksi ${PARTY} untuk ikut serta ya! Naura doakan kamu menang.\n\n` +
                    `${dot()} **Jumlah pemenang:** ${pemenang}\n` +
                    `${dot()} **Disponsori oleh:** <@${interaction.user.id}>\n` +
                    `${dot()} **Berakhir:** <t:${unixEnd}:R>${syarat}`,
                footerText: ui.getFooter('core')
            });

            await interaction.deferReply();
            await interaction.editReply(payload);
            const reply = await interaction.fetchReply();

            try {
                await Giveaway.create({
                    messageId: reply.id,
                    channelId: interaction.channelId,
                    guildId: interaction.guildId,
                    prize: hadiah,
                    winnersCount: pemenang,
                    endTime: endTimeDate,
                    hostId: interaction.user.id
                });
            } catch (error) {
                logger.error('[Giveaway] Gagal menyimpan giveaway: ' + error.message);
                await interaction.editReply(buildErrorContainerV2({
                    title: 'Aduh, gagal disimpan',
                    description: 'Naura tidak bisa menyimpan giveaway ini, jadi dibatalkan dulu ya. Coba lagi sebentar lagi!',
                    footerText: ui.getFooter('core')
                }));
                return;
            }

            await reply.react(PARTY).catch(() => null);
            return;
        }

        const msgId = interaction.options.getString('message_id');
        const gwData = await Giveaway.findByPk(msgId);

        if (!gwData || gwData.ended) {
            return interaction.reply(ephemeral(buildErrorContainerV2({
                title: 'Giveawaynya tidak ada',
                description: 'Naura tidak menemukan giveaway itu, atau giveawaynya sudah berakhir.',
                footerText: ui.getFooter('core')
            })));
        }

        await interaction.reply(ephemeral(buildContainerV2({
            accentColorHex: ui.getColor('primary'),
            title: 'Sedang Naura akhiri',
            expression: 'loading',
            description: 'Naura sedang mengundi pemenangnya, tunggu sebentar ya!',
            footerText: ui.getFooter('core')
        })));

        try {
            await managerOf(interaction.client).endGiveaway(gwData, true);
        } catch (error) {
            logger.error('[Giveaway] Gagal mengakhiri giveaway: ' + error.message);
            await interaction.editReply(buildErrorContainerV2({
                title: 'Belum berhasil',
                description: 'Naura gagal mengakhiri giveaway itu. Coba periksa apakah pesannya masih ada ya.',
                footerText: ui.getFooter('core')
            })).catch(() => {});
        }
    }
};
