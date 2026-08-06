'use strict';

const ui = require('../../config/ui');
const env = require('../../config/env');
const UserProfile = require('../../models/UserProfile');

const DISCORD_API = 'https://discord.com/api/v10';

async function renameChannel(interaction, channel) {
    let profile = null;
    try {
        profile = await UserProfile.findOne({ where: { userId: interaction.user.id } });
    } catch (error) {
        profile = null;
    }

    const raw = interaction.fields.getTextInputValue('input_name');
    const isBotOwner = Boolean(env.OWNER_IDS?.includes(interaction.user.id));

    let newName;
    if (isBotOwner) newName = `\u300c\ud83d\udc51\u300d\u30fb${raw} Owner Voice`;
    else if (profile?.isPremium) newName = `\u300c\ud83c\udf1f\u300d\u30fb${raw} VIP Voice`;
    else newName = `\ud83d\udd0a ${raw} voice`;

    await channel.setName(newName);
    return ui.sendError(interaction, 'err_sys_93', true);
}

async function setLimit(interaction, channel) {
    let limit = parseInt(interaction.fields.getTextInputValue('input_limit'), 10);
    if (Number.isNaN(limit) || limit < 0 || limit > 99) limit = 0;

    await channel.setUserLimit(limit);
    return ui.sendError(interaction, 'err_sys_94', true);
}

async function setVoiceStatus(interaction, channel, client) {
    // Voice Status belum tersedia di discord.js, jadi endpointnya dipanggil langsung.
    const fetch = require('isomorphic-unfetch');
    const newStatus = interaction.fields.getTextInputValue('input_status');

    try {
        const response = await fetch(`${DISCORD_API}/channels/${channel.id}/voice-status`, {
            method: 'PUT',
            headers: {
                Authorization: `Bot ${client.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) return ui.sendError(interaction, 'err_sys_95', true);
        return ui.sendError(interaction, `\u2705 Status Voice Channel diubah menjadi: **${newStatus}**`, true);
    } catch (error) {
        return ui.sendError(interaction, 'err_sys_96', true);
    }
}

const ACTIONS = {
    modal_tvc_rename: renameChannel,
    modal_tvc_limit: setLimit,
    modal_tvc_status: setVoiceStatus
};

module.exports = [
    {
        prefix: 'modal_tvc_',
        label: 'temp-voice-modal',
        onError: 'Terjadi kesalahan pada Voice Channel Control.',
        async handler(interaction, client) {
            const channel = interaction.member?.voice?.channel;
            if (!channel) return ui.sendError(interaction, 'err_sys_92', true);

            const action = ACTIONS[interaction.customId];
            if (!action) {
                return interaction.reply({
                    content: '\u2753 Formulir ini sudah tidak berlaku.',
                    ephemeral: true
                });
            }

            return action(interaction, channel, client);
        }
    }
];
