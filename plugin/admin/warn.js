const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const UserWarn = require('../../src/models/UserWarn');
const ui = require('../../src/config/ui');
const GuildSettings = require('../../src/models/GuildSettings');
const { logger } = require('../../src/managers/logger');

const MUTE_MS = 60 * 60 * 1000;
const DESC_LIMIT = 3800;

function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

function deny(interaction, description) {
    return interaction.reply(ephemeral(buildErrorContainerV2({
        title: 'Belum bisa Naura lakukan',
        description,
        footerText: ui.getFooter('core')
    })));
}

function notice(interaction, description, expression) {
    return interaction.reply(buildContainerV2({
        accentColorHex: ui.getColor('success'),
        title: 'Beres!',
        expression: expression || 'success',
        description,
        footerText: ui.getFooter('core')
    }));
}

// Tindakan hanya diumumkan kalau benar-benar berhasil dijalankan.
async function applyPunishment(action, member, totalWarns) {
    if (action === 'mute') {
        if (!member.moderatable) return null;
        await member.timeout(MUTE_MS, 'Tangga hukuman peringatan');
        return `<@${member.id}> Naura bisukan otomatis selama satu jam karena sudah mencapai ${totalWarns} peringatan.`;
    }
    if (action === 'kick') {
        if (!member.kickable) return null;
        await member.kick('Tangga hukuman peringatan');
        return `<@${member.id}> Naura keluarkan otomatis karena sudah mencapai ${totalWarns} peringatan.`;
    }
    if (action === 'ban') {
        if (!member.bannable) return null;
        await member.ban({ reason: 'Tangga hukuman peringatan' });
        return `<@${member.id}> Naura larang masuk otomatis karena sudah mencapai ${totalWarns} peringatan.`;
    }
    return null;
}

async function ladderAction(guildId, totalWarns) {
    const settings = await GuildSettings.findOne({ where: { guildId } });
    if (!settings || !settings.settings || !settings.settings.warn_punishments) return null;
    return settings.settings.warn_punishments[totalWarns] || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Sistem peringatan untuk anggota server')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .addSubcommand(sub => sub.setName('add').setDescription('Beri peringatan kepada anggota')
            .addUserOption(opt => opt.setName('user').setDescription('Anggota yang diberi peringatan').setRequired(true))
            .addStringOption(opt => opt.setName('alasan').setDescription('Alasan peringatan').setRequired(true)))
        .addSubcommand(sub => sub.setName('check').setDescription('Lihat daftar peringatan anggota')
            .addUserOption(opt => opt.setName('user').setDescription('Anggota yang diperiksa').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Hapus satu peringatan berdasarkan ID')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID peringatan').setRequired(true)))
        .addSubcommand(sub => sub.setName('clear').setDescription('Hapus semua peringatan milik anggota')
            .addUserOption(opt => opt.setName('user').setDescription('Anggota yang dibersihkan').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'add') {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('alasan');

            if (user.bot) return deny(interaction, 'Bot tidak bisa diberi peringatan ya.');
            if (user.id === interaction.user.id) return deny(interaction, 'Kamu tidak bisa memperingatkan dirimu sendiri, hehe.');

            const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (targetMember) {
                if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                    return deny(interaction, 'Anggota itu punya role yang setara atau lebih tinggi darimu.');
                }
                if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                    return deny(interaction, 'Rolenya lebih tinggi dari role Naura, jadi Naura tidak bisa bertindak.');
                }
            }

            await UserWarn.create({
                userId: user.id,
                guildId,
                moderatorId: interaction.user.id,
                reason
            });

            await interaction.reply(buildContainerV2({
                accentColorHex: ui.getColor('warning') || ui.getColor('error'),
                authorName: 'Peringatan Diberikan',
                title: `Peringatan untuk ${user.username}`,
                iconURL: user.displayAvatarURL(),
                expression: 'warning',
                description:
                    `**Anggota:** ${user} (${user.tag})\n` +
                    `**Moderator:** ${interaction.user}\n` +
                    `**Alasan:** ${reason}`,
                footerText: ui.getFooter('core')
            }));

            let totalWarns = null;
            let action = null;
            try {
                totalWarns = await UserWarn.count({ where: { guildId, userId: user.id } });
                action = await ladderAction(guildId, totalWarns);
            } catch (err) {
                logger.error('[Warn] Gagal membaca tangga hukuman: ' + err.message);
            }

            // Pemberitahuan dikirim satu kali saja, tidak lagi dua kali.
            const urutan = totalWarns ? ` ke-${totalWarns}` : '';
            await user.send(
                `Kamu mendapat peringatan${urutan} di server **${interaction.guild.name}**.\n` +
                `**Alasan:** ${reason}\n\n` +
                'Naura yakin kamu bisa lebih baik lagi setelah ini!'
            ).catch(() => null);

            if (action && action !== 'dm' && targetMember) {
                try {
                    const announcement = await applyPunishment(action, targetMember, totalWarns);
                    if (announcement) await interaction.channel.send(announcement);
                    else logger.error(`[Warn] Tindakan ${action} dilewati, izin Naura tidak cukup.`);
                } catch (err) {
                    logger.error('[Warn] Gagal menjalankan tangga hukuman: ' + err.message);
                }
            }
            return;
        }

        if (subcommand === 'check') {
            const user = interaction.options.getUser('user');
            const warns = await UserWarn.findAll({ where: { userId: user.id, guildId } });

            let desc = warns.length === 0
                ? 'Anggota ini bersih, belum ada peringatan sama sekali. Bagus sekali!'
                : `Anggota ini punya **${warns.length}** peringatan:\n\n` + warns.map(w =>
                    `**ID:** \`${w.id}\` | **Mod:** <@${w.moderatorId}>\n` +
                    `**Alasan:** ${w.reason}\n` +
                    `**Tanggal:** <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`
                ).join('\n\n');

            if (desc.length > DESC_LIMIT) {
                desc = desc.slice(0, DESC_LIMIT) + '\n\n... sisanya Naura potong ya, daftarnya panjang sekali.';
            }

            return interaction.reply(buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: `Daftar Peringatan: ${user.tag}`,
                title: `Catatan ${user.username}`,
                iconURL: user.displayAvatarURL(),
                expression: 'info',
                description: desc,
                footerText: ui.getFooter('core')
            }));
        }

        if (subcommand === 'remove') {
            const id = interaction.options.getInteger('id');
            const warn = await UserWarn.findOne({ where: { id, guildId } });

            if (!warn) return deny(interaction, `Peringatan dengan ID \`${id}\` tidak Naura temukan di server ini.`);

            await warn.destroy();
            return notice(interaction, `Peringatan dengan ID \`${id}\` sudah Naura hapus.`);
        }

        const user = interaction.options.getUser('user');
        const deletedCount = await UserWarn.destroy({ where: { userId: user.id, guildId } });

        if (deletedCount === 0) return deny(interaction, `${user} belum punya peringatan yang bisa dihapus.`);

        return notice(interaction, `Semua peringatan milik ${user} sudah Naura bersihkan, totalnya ${deletedCount}.`);
    }
};
