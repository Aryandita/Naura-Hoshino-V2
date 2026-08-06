'use strict';

const ui = require('../../config/ui');

module.exports = [
    {
        id: 'tvc_move_select',
        label: 'temp-voice-pindah',
        onError: 'Gagal memindahkan pengguna.',
        async handler(interaction) {
            const targetId = interaction.values[0];
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
            const ownerVoice = interaction.member.voice.channel;

            if (!targetMember || !targetMember.voice.channel || !ownerVoice) {
                return ui.sendError(interaction, 'err_sys_88', true);
            }

            try {
                await ownerVoice.permissionOverwrites.edit(targetId, {
                    Connect: true,
                    Speak: true,
                    ViewChannel: true
                });
                await targetMember.voice.setChannel(ownerVoice);
                return ui.sendError(interaction, `\u2705 Berhasil memindahkan <@${targetId}> ke ruanganmu!`, true);
            } catch (error) {
                return ui.sendError(interaction, 'err_sys_89', true);
            }
        }
    },

    {
        id: 'tvc_region_select',
        label: 'temp-voice-region',
        async handler(interaction) {
            const region = interaction.values[0];
            const memberVoice = interaction.member.voice.channel;
            if (!memberVoice) return ui.sendError(interaction, 'err_sys_90', true);

            try {
                await memberVoice.setRTCRegion(region === 'auto' ? null : region);
                return interaction.reply({
                    content: `\u2705 Voice Region diubah ke **${region}**.`,
                    ephemeral: true
                });
            } catch (error) {
                return interaction.reply({
                    content: '\u274c Gagal mengubah region. Pastikan bot punya izin yang cukup.',
                    ephemeral: true
                });
            }
        }
    }
];
