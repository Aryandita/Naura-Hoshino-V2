'use strict';

const { ActionRowBuilder,
    ChannelSelectMenuBuilder,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle, MessageFlags } = require('discord.js');

const { updateGuildSetting } = require('../../managers/guildSettingsService');

const SPECIAL_CHANNEL_LABELS = {
    ai: '\ud83e\udd16 AI Chat',
    levelUp: '\ud83d\udcc8 Level-Up',
    counting: '\ud83d\udd22 Counting Game',
    tod: '\ud83d\ude08 Truth or Dare'
};

function labelFor(type) {
    return SPECIAL_CHANNEL_LABELS[type] || SPECIAL_CHANNEL_LABELS.tod;
}

function successEmbed(title, description) {
    return new EmbedBuilder().setColor('#FF69B4').setTitle(title).setDescription(description);
}

module.exports = [
    {
        id: 'select_setup_channel_type',
        label: 'setup-pilih-tipe-channel',
        handler(interaction) {
            const channelType = interaction.values[0];

            const embed = successEmbed(
                '\ud83d\udcfa Setup Special Channel',
                `Pilih channel baru untuk **${labelFor(channelType)}**:`
            );

            const menu = new ChannelSelectMenuBuilder()
                .setCustomId(`select_special_channel_submit_${channelType}`)
                .setPlaceholder('Pilih channel...');

            return interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        id: 'select_announcement_channel',
        label: 'setup-channel-pengumuman',
        async handler(interaction) {
            const channelId = interaction.values[0];

            await updateGuildSetting(interaction.guild.id, (settings) => {
                settings.announcementChannel = channelId;
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83d\udce2 Setup Announcement Channel Berhasil!',
                        `Channel pengumuman otomatis (Welcome/Logs) disetel ke <#${channelId}>.`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        id: 'select_globalchat_channel',
        label: 'setup-channel-globalchat',
        async handler(interaction, client) {
            const channelId = interaction.values[0];

            await updateGuildSetting(interaction.guild.id, (settings) => {
                settings.globalChat = { enabled: true, channelId };
            });

            if (!client.globalChatChannels) client.globalChatChannels = new Map();
            for (const [chanId, gId] of client.globalChatChannels.entries()) {
                if (gId === interaction.guild.id) client.globalChatChannels.delete(chanId);
            }
            client.globalChatChannels.set(channelId, interaction.guild.id);

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83c\udf10 Setup Global Chat Berhasil!',
                        `Channel <#${channelId}> terhubung ke Naura Global Chat!`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        id: 'select_starboard_channel',
        label: 'setup-channel-starboard',
        async handler(interaction) {
            const channelId = interaction.values[0];
            let threshold = 3;

            await updateGuildSetting(interaction.guild.id, (settings) => {
                threshold = settings.starboard?.threshold || 3;
                settings.starboard = { enabled: true, channelId, threshold };
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\u2b50 Setup Starboard Berhasil!',
                        `Channel Starboard disetel ke <#${channelId}> dengan batas minimal **${threshold} \u2b50**.`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        id: 'select_sticky_channel',
        label: 'setup-channel-sticky',
        handler(interaction) {
            const channelId = interaction.values[0];

            const modal = new ModalBuilder()
                .setCustomId(`modal_setup_sticky_content_${channelId}`)
                .setTitle('\ud83d\udccc Isi Pesan Sticky');

            const input = new TextInputBuilder()
                .setCustomId('input_sticky_message')
                .setLabel('Tulis pesan lengket:')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Tulis pesan yang akan selalu menempel di bawah channel ini...')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
    },

    {
        id: 'select_automod_log',
        label: 'setup-log-automod',
        async handler(interaction) {
            const channelId = interaction.values[0];

            await updateGuildSetting(interaction.guild.id, (settings) => {
                if (!settings.automod) settings.automod = {};
                settings.automod.logChannel = channelId;
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83d\udee1\ufe0f Log Automod Disetel',
                        `Channel log audit keamanan disetel ke <#${channelId}>.`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        prefix: 'select_special_channel_submit_',
        label: 'setup-channel-khusus',
        async handler(interaction) {
            const channelType = interaction.customId.split('_')[4];
            const channelId = interaction.values[0];

            await updateGuildSetting(interaction.guild.id, (settings) => {
                if (!settings.channels) settings.channels = {};
                settings.channels[channelType] = channelId;
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83d\udcfa Special Channel Disetel!',
                        `Channel untuk **${labelFor(channelType)}** berhasil disetel ke <#${channelId}>.`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    {
        id: 'select_autorole_role',
        label: 'setup-autorole',
        async handler(interaction) {
            const roleId = interaction.values[0];

            await updateGuildSetting(interaction.guild.id, (settings) => {
                settings.autoRole = roleId;
            });

            return interaction.reply({
                embeds: [
                    successEmbed(
                        '\ud83c\udfad Setup Auto-Role Berhasil!',
                        `Member baru bergabung akan otomatis diberikan role <@&${roleId}>.`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    }
];
