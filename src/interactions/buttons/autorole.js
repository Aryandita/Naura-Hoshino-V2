'use strict';
const { MessageFlags } = require('discord.js');
module.exports = [
    {
        prefix: 'autorole_',
        label: 'autorole',
        onError: 'Gagal memproses role. Kemungkinan posisi role bot lebih rendah dari role tersebut.',
        async handler(interaction) {
            const roleId = interaction.customId.split('_')[1];
            if (!roleId) return undefined;

            const member = interaction.member;

            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                return interaction.reply({
                    content: `\u2705 Role <@&${roleId}> telah dihapus darimu.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            await member.roles.add(roleId);
            return interaction.reply({
                content: `\u2705 Role <@&${roleId}> telah ditambahkan kepadamu.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
];
