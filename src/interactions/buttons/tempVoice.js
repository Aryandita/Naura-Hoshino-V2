'use strict';

const {
    ActionRowBuilder,
    ChannelType,
    ModalBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const ui = require('../../config/ui');
const { updateGuildSetting } = require('../../managers/guildSettingsService');
const { resolveVoiceContext, PREMIUM_ONLY } = require('../shared/tempVoice');

const REGIONS = [
    { label: 'Otomatis', value: 'auto' },
    { label: 'Singapore', value: 'singapore' },
    { label: 'Japan', value: 'japan' },
    { label: 'Sydney', value: 'sydney' },
    { label: 'US Central', value: 'us-central' },
    { label: 'Rotterdam', value: 'rotterdam' }
];

function textModal(customId, title, inputId, label) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(inputId)
                .setLabel(label)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        )
    );
    return modal;
}

/** Tiap aksi panel dipetakan ke satu fungsi, bukan satu rantai if. */
const ACTIONS = {
    async tvc_lock(interaction, ctx) {
        await ctx.channel.permissionOverwrites.edit(interaction.guild.id, {
            [PermissionFlagsBits.Connect]: false
        });
        return ui.sendError(interaction, 'err_sys_76', true);
    },

    async tvc_unlock(interaction, ctx) {
        await ctx.channel.permissionOverwrites.edit(interaction.guild.id, {
            [PermissionFlagsBits.Connect]: null
        });
        return ui.sendError(interaction, 'err_sys_77', true);
    },

    async tvc_hide(interaction, ctx) {
        if (!ctx.isPrivileged) {
            return interaction.reply({ content: PREMIUM_ONLY('Mode Invisible (Ghosting)'), ephemeral: true });
        }
        await ctx.channel.permissionOverwrites.edit(interaction.guild.id, {
            [PermissionFlagsBits.ViewChannel]: false,
            [PermissionFlagsBits.Connect]: false
        });
        return ui.sendError(interaction, 'err_sys_78', true);
    },

    async tvc_unhide(interaction, ctx) {
        await ctx.channel.permissionOverwrites.edit(interaction.guild.id, {
            [PermissionFlagsBits.ViewChannel]: null,
            [PermissionFlagsBits.Connect]: null
        });
        return ui.sendError(interaction, 'err_sys_79', true);
    },

    async tvc_stage(interaction, ctx) {
        const overwrite = ctx.channel.permissionOverwrites.cache.get(interaction.guild.id);
        const isMuted = overwrite?.deny.has(PermissionFlagsBits.Speak);

        if (isMuted) {
            await ctx.channel.permissionOverwrites.edit(interaction.guild.id, { Speak: null });
            return ui.sendError(interaction, 'err_sys_80', true);
        }

        await ctx.channel.permissionOverwrites.edit(interaction.guild.id, { Speak: false });
        await ctx.channel.permissionOverwrites.edit(interaction.user.id, { Speak: true });
        return ui.sendError(interaction, 'err_sys_81', true);
    },

    async tvc_waiting(interaction, ctx) {
        const waitingName = `\u23f3 Wait - ${interaction.user.username}`;
        const existing = interaction.guild.channels.cache.find(
            (c) => c.name === waitingName && c.parentId === ctx.channel.parentId
        );

        if (existing) {
            await existing.delete().catch(() => {});
            return ui.sendError(interaction, 'err_sys_82', true);
        }

        await interaction.guild.channels.create({
            name: waitingName,
            type: ChannelType.GuildVoice,
            parent: ctx.channel.parentId,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    allow: [PermissionFlagsBits.Connect],
                    deny: [PermissionFlagsBits.Speak]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak
                    ]
                }
            ]
        });
        return ui.sendError(interaction, 'err_sys_83', true);
    },

    async tvc_move(interaction, ctx) {
        const waitingName = `\u23f3 Wait - ${interaction.user.username}`;
        const waitingRoom = interaction.guild.channels.cache.find(
            (c) => c.name === waitingName && c.parentId === ctx.channel.parentId
        );

        if (!waitingRoom || waitingRoom.members.size === 0) {
            return ui.sendError(interaction, 'err_sys_84', true);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('tvc_move_select')
            .setPlaceholder('Pilih user...')
            .addOptions(waitingRoom.members.map((m) => ({ label: m.user.username, value: m.id })));

        return interaction.reply({
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral: true
        });
    },

    tvc_rename(interaction) {
        return interaction.showModal(
            textModal('modal_tvc_rename', '\u270f\ufe0f Ubah Nama', 'input_name', 'Nama baru:')
        );
    },

    tvc_limit(interaction) {
        return interaction.showModal(
            textModal('modal_tvc_limit', '\ud83d\udc65 Batas Pengguna', 'input_limit', 'Batas (0 Bebas):')
        );
    },

    tvc_status(interaction) {
        return interaction.showModal(
            textModal('modal_tvc_status', '\ud83d\udcac Ubah Voice Status', 'input_status', 'Status baru:')
        );
    },

    tvc_region(interaction, ctx) {
        if (!ctx.isPrivileged) {
            return interaction.reply({ content: PREMIUM_ONLY('Ubah Region'), ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('tvc_region_select')
            .setPlaceholder('Pilih Region Voice Server...')
            .addOptions(REGIONS);

        return interaction.reply({
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral: true
        });
    },

    async tvc_save(interaction, ctx) {
        if (!ctx.isPrivileged) {
            return interaction.reply({ content: PREMIUM_ONLY('Simpan Sesi'), ephemeral: true });
        }

        await updateGuildSetting(interaction.guild.id, (settings) => {
            if (!settings.userTempSettings) settings.userTempSettings = {};
            settings.userTempSettings[interaction.user.id] = {
                name: ctx.channel.name,
                limit: ctx.channel.userLimit,
                bitrate: ctx.channel.bitrate,
                rtcRegion: ctx.channel.rtcRegion
            };
        });

        return ui.sendError(interaction, 'err_sys_85', true);
    }
};

module.exports = [
    {
        prefix: 'tvc_',
        label: 'temp-voice-panel',
        onError: 'Terjadi kesalahan pada panel Voice Channel.',
        async handler(interaction) {
            const ctx = await resolveVoiceContext(interaction);
            if (!ctx) return ui.sendError(interaction, 'err_sys_74', true);
            if (!ctx.isOwner && !ctx.isAdmin) return ui.sendError(interaction, 'err_sys_75', true);

            const action = ACTIONS[interaction.customId];

            // Versi lama diam saja untuk tombol tvc_ yang tidak dikenal, sehingga
            // pengguna hanya melihat "This interaction failed".
            if (!action) {
                return interaction.reply({
                    content: '\u2753 Tombol ini sudah tidak berlaku. Panggil ulang panelnya ya.',
                    ephemeral: true
                });
            }

            return action(interaction, ctx);
        }
    }
];
