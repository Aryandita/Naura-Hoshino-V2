'use strict';

const { EmbedBuilder, MessageFlags } = require('discord.js');
const { updateGuildSetting } = require('../../managers/guildSettingsService');

function successEmbed(title, description) {
    return new EmbedBuilder().setColor('#FF69B4').setTitle(title).setDescription(description);
}

module.exports = [
    {
        id: 'modal_setup_minecraft',
        label: 'setup-minecraft',
        async handler(interaction) {
            const ip = interaction.fields.getTextInputValue('input_minecraft_ip');
            const port = parseInt(interaction.fields.getTextInputValue('input_minecraft_port'), 10) || 25565;

            await updateGuildSetting(interaction.guild.id, (settings) => {
                settings.minecraft = { ...settings.minecraft, ip, port };
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83c\udfae Setup Minecraft Status Berhasil!',
                        `Server IP: **${ip}:${port}** telah disimpan.\nNaura akan melacak status server ini.`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        prefix: 'modal_setup_sticky_content_',
        label: 'setup-sticky',
        async handler(interaction) {
            const channelId = interaction.customId.split('_')[4];
            const messageText = interaction.fields.getTextInputValue('input_sticky_message');

            await updateGuildSetting(interaction.guild.id, (settings) => {
                settings.stickyMessage = { channelId, message: messageText, lastId: null };
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83d\udccc Setup Pesan Lengket Berhasil!',
                        `Pesan lengket dipasang di <#${channelId}>:\n>>> ${messageText}`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        id: 'modal_setup_autoreply',
        label: 'setup-autoreply',
        async handler(interaction) {
            const trigger = interaction.fields.getTextInputValue('input_autoreply_trigger').toLowerCase().trim();
            const response = interaction.fields.getTextInputValue('input_autoreply_response');

            await updateGuildSetting(interaction.guild.id, (settings) => {
                if (!Array.isArray(settings.autoReplies)) settings.autoReplies = [];

                const existing = settings.autoReplies.find((r) => r.trigger === trigger);
                if (existing) existing.response = response;
                else settings.autoReplies.push({ trigger, response });
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83e\udd16 Setup Auto Responder Berhasil!',
                        `Naura akan otomatis membalas kata kunci **"${trigger}"** dengan:\n>>> ${response}`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    }
];
