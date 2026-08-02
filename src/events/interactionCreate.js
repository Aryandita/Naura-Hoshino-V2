const { Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ModMail = require('../models/ModMail');
const GuildSettings = require('../models/GuildSettings');
const UserProfile = require('../models/UserProfile');
const cacheManager = require('../managers/cacheManager');
const env = require('../config/env');
const ui = require('../config/ui');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // --- 🌍 LANGUAGE INJECTION ---
        const languageManager = require('../../src/managers/languageManager');
        interaction.localeLang = await languageManager.getUserLanguage(interaction.user.id);

        if (client.isShuttingDown) {
            return interaction.reply({ content: '⚠️ **Naura sedang dalam proses restart/shutdown.** Mohon tunggu beberapa saat.', ephemeral: true }).catch(() => {});
        }

        // ==========================================
        // 1. 🤖 SLASH COMMAND ROUTER
        // ==========================================
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            // Global Slash Command Rate Limiting
            const rateLimiter = require('../../src/utils/rateLimiter');
            const isLimited = await rateLimiter.isRateLimited(interaction.user.id, `slash_${interaction.commandName}`, 5, 5);
            if (isLimited) {
                return interaction.reply({ content: '⚠️ **Slow down!** Kamu mengirim perintah terlalu cepat. Harap tunggu beberapa detik.', ephemeral: true }).catch(() => {});
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(`\x1b[31m[COMMAND ERROR]\x1b[0m Error saat mengeksekusi ${interaction.commandName}:`, error);

                const errEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription('❌ **Terjadi kesalahan sistem saat memproses perintah ini.**');

                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
                } else {
                    await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
                }
            }
        }

        // ==========================================
        // 2. 🎛️ BUTTON ROUTER (Music, Ticket, TempVoice)
        // ==========================================
        if (interaction.isButton()) {

            // --- AUTO ROLE BUTTONS ---
            if (interaction.customId.startsWith('autorole_')) {
                const roleId = interaction.customId.split('_')[1];
                if (!roleId) return;
                try {
                    const member = interaction.member;
                    if (member.roles.cache.has(roleId)) {
                        await member.roles.remove(roleId);
                        return interaction.reply({ content: `✅ Role <@&${roleId}> telah dihapus darimu.`, ephemeral: true });
                    } else {
                        await member.roles.add(roleId);
                        return interaction.reply({ content: `✅ Role <@&${roleId}> telah ditambahkan kepadamu.`, ephemeral: true });
                    }
                } catch (error) {
                    return interaction.reply({ content: `❌ Gagal memproses role. Mungkin posisi role bot lebih rendah.`, ephemeral: true });
                }
            }

            // --- OPT-OUT DAILY NOTIFY ---
            if (interaction.customId.startsWith('daily_notify_off_')) {
                const targetUserId = interaction.customId.split('_')[3];
                if (interaction.user.id !== targetUserId) {
                    return interaction.reply({ content: '❌ Tombol ini bukan untukmu.', ephemeral: true });
                }
                try {
                    await UserProfile.update({ dailyNotify: false }, { where: { userId: targetUserId } });
                    return interaction.reply({ content: '🔕 Notifikasi Daily Reminder telah dimatikan. Kamu tidak akan menerima pesan ini lagi.', ephemeral: true });
                } catch (err) {
                    return interaction.reply({ content: '❌ Terjadi kesalahan saat mematikan notifikasi.', ephemeral: true });
                }
            }

            // --- MUSIC PLAYER CONTROLLER ---
            if (interaction.customId.startsWith('music_')) {
                const musicButtonsHandler = require('../../plugin/music/musicButtons');
                try {
                    await musicButtonsHandler(interaction, client);
                } catch (error) {
                    logger.error('[Music Buttons Handler Error]', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await ui.sendError(interaction, 'err_sys_71', true);
                    }
                }
                return;
            }

            // --- TICKET SYSTEM (ModMail Panel di Server) ---
            if (interaction.customId === 'ticket_open') {
                const { createTicketChannel } = require('../../plugin/modmail/modmailHelper');
                const guildData = await cacheManager.getGuildSettings(interaction.guild.id);
                if (!guildData || !guildData.settings?.modmail?.categoryId) {
                    return ui.sendError(interaction, 'err_sys_72', true);
                }

                await interaction.deferReply({ ephemeral: true });
                try {
                    await createTicketChannel(interaction, { id: interaction.guild.id, categoryId: guildData.settings.modmail.categoryId }, client);
                } catch (error) {
                    await interaction.editReply({ content: '❌ Terjadi kesalahan saat membuat tiket.' });
                }
                return;
            }

            if (interaction.customId === 'mm_close') {
                const ticket = await ModMail.findOne({ where: { channelId: interaction.channelId, closed: false } });
                if (!ticket) return ui.sendError(interaction, 'err_sys_73', true);

                ticket.closed = true;
                await ticket.save();

                const logEmbed = new EmbedBuilder().setColor('#FF0000').setDescription('🔒 Tiket ini ditutup oleh Staf.');
                await interaction.channel.send({ embeds: [logEmbed] });

                const user = await client.users.fetch(ticket.userId).catch(() => null);
                if (user) {
                    const notifyEmbed = new EmbedBuilder().setColor('#FF0000').setDescription(`🔒 Tiket bantuanmu dengan **${interaction.guild.name}** telah ditutup.`).setTimestamp();
                    user.send({ embeds: [notifyEmbed] }).catch(() => {});
                }

                await interaction.reply('⏳ Channel ini akan dihapus dalam 5 detik...');
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
                return;
            }

            if (interaction.customId === 'mm_reply' || interaction.customId === 'mm_reply_anon') {
                const modal = new ModalBuilder()
                    .setCustomId(interaction.customId === 'mm_reply' ? 'mm_modal_reply' : 'mm_modal_anon')
                    .setTitle(interaction.customId === 'mm_reply' ? '💬 Balas Tiket' : '🕵️ Balas Anonim');

                const input = new TextInputBuilder()
                    .setCustomId('mm_text_input')
                    .setLabel('Tulis balasanmu:')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            // --- TEMP VOICE PANEL (Private Room VIP) ---
            if (interaction.customId.startsWith('tvc_')) {
                const memberVoice = interaction.member.voice.channel;
                if (!memberVoice) return ui.sendError(interaction, 'err_sys_74', true);

                // Cari apakah user ini adalah pembuat ruangan (berdasarkan awalan nama)
                const isOwner = memberVoice.name.includes(interaction.user.username);
                // Admin bisa mem-bypass ini
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

                if (!isOwner && !isAdmin) return ui.sendError(interaction, 'err_sys_75', true);

                try {
                    // Fitur Khusus Premium
                    let profile;
                    try {
                        profile = await UserProfile.findOne({ where: { userId: interaction.user.id } });
                    } catch (e) {}
                    const isPremium = profile ? profile.isPremium : false;
                    const isBotOwner = env.OWNER_IDS && env.OWNER_IDS.includes(interaction.user.id);

                    if (interaction.customId === 'tvc_lock') { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.Connect]: false }); return ui.sendError(interaction, 'err_sys_76', true); }
                    if (interaction.customId === 'tvc_unlock') { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.Connect]: null }); return ui.sendError(interaction, 'err_sys_77', true); }

                    if (interaction.customId === 'tvc_hide') {
                        if (!isPremium && !isBotOwner && !isAdmin) {
                            return interaction.reply({ content: '👑 **Fitur Eksklusif!** Mode Invisible (Ghosting) hanya untuk pengguna Premium.', ephemeral: true });
                        }
                        await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.ViewChannel]: false, [PermissionFlagsBits.Connect]: false });
                        return ui.sendError(interaction, 'err_sys_78', true);
                    }
                    if (interaction.customId === 'tvc_unhide') {
                        await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.ViewChannel]: null, [PermissionFlagsBits.Connect]: null });
                        return ui.sendError(interaction, 'err_sys_79', true);
                    }
                    if (interaction.customId === 'tvc_stage') {
                        const isMuted = memberVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionFlagsBits.Speak);
                        if (isMuted) { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { Speak: null }); return ui.sendError(interaction, 'err_sys_80', true); }
                        else { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { Speak: false }); await memberVoice.permissionOverwrites.edit(interaction.user.id, { Speak: true }); return ui.sendError(interaction, 'err_sys_81', true); }
                    }
                    if (interaction.customId === 'tvc_waiting') {
                        const waitingName = `⏳ Wait - ${interaction.user.username}`;
                        const existingWaiting = interaction.guild.channels.cache.find(c => c.name === waitingName && c.parentId === memberVoice.parentId);
                        if (existingWaiting) { await existingWaiting.delete().catch(()=>{}); return ui.sendError(interaction, 'err_sys_82', true); }
                        else {
                            await interaction.guild.channels.create({ name: waitingName, type: ChannelType.GuildVoice, parent: memberVoice.parentId, permissionOverwrites: [{ id: interaction.guild.id, allow: [PermissionFlagsBits.Connect], deny: [PermissionFlagsBits.Speak] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }]});
                            return ui.sendError(interaction, 'err_sys_83', true);
                        }
                    }
                    if (interaction.customId === 'tvc_move') {
                        const waitingName = `⏳ Wait - ${interaction.user.username}`;
                        const waitingRoom = interaction.guild.channels.cache.find(c => c.name === waitingName && c.parentId === memberVoice.parentId);
                        if (!waitingRoom || waitingRoom.members.size === 0) return ui.sendError(interaction, 'err_sys_84', true);
                        const selectMenu = new StringSelectMenuBuilder().setCustomId('tvc_move_select').setPlaceholder('Pilih user...').addOptions(waitingRoom.members.map(m => ({ label: m.user.username, value: m.id })));
                        return interaction.reply({ components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
                    }
                    if (interaction.customId === 'tvc_rename') {
                        const modal = new ModalBuilder().setCustomId('modal_tvc_rename').setTitle('✏️ Ubah Nama');
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_name').setLabel('Nama baru:').setStyle(TextInputStyle.Short).setRequired(true)));
                        return interaction.showModal(modal);
                    }
                    if (interaction.customId === 'tvc_limit') {
                        const modal = new ModalBuilder().setCustomId('modal_tvc_limit').setTitle('👥 Batas Pengguna');
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_limit').setLabel('Batas (0 Bebas):').setStyle(TextInputStyle.Short).setRequired(true)));
                        return interaction.showModal(modal);
                    }
                    if (interaction.customId === 'tvc_status') {
                        const modal = new ModalBuilder().setCustomId('modal_tvc_status').setTitle('💬 Ubah Voice Status');
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_status').setLabel('Status baru:').setStyle(TextInputStyle.Short).setRequired(true)));
                        return interaction.showModal(modal);
                    }
                    if (interaction.customId === 'tvc_region') {
                        if (!isPremium && !isBotOwner && !isAdmin) {
                            return interaction.reply({ content: '👑 **Fitur Eksklusif!** Ubah Region hanya untuk pengguna Premium.', ephemeral: true });
                        }
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId('tvc_region_select')
                            .setPlaceholder('Pilih Region Voice Server...')
                            .addOptions([
                                { label: 'Otomatis', value: 'auto' },
                                { label: 'Singapore', value: 'singapore' },
                                { label: 'Japan', value: 'japan' },
                                { label: 'Sydney', value: 'sydney' },
                                { label: 'US Central', value: 'us-central' },
                                { label: 'Rotterdam', value: 'rotterdam' }
                            ]);
                        return interaction.reply({ components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
                    }
                    if (interaction.customId === 'tvc_save') {
                        if (!isPremium && !isBotOwner && !isAdmin) {
                            return interaction.reply({ content: '👑 **Fitur Eksklusif!** Simpan Sesi hanya untuk pengguna Premium.', ephemeral: true });
                        }
                        // Implementasi Sederhana: Menyimpan informasi ke DB (Bisa dikembangkan lebih lanjut)
                        let [db] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                        let userTempSettings = db.settings.userTempSettings || {};
                        userTempSettings[interaction.user.id] = {
                            name: memberVoice.name,
                            limit: memberVoice.userLimit,
                            bitrate: memberVoice.bitrate,
                            rtcRegion: memberVoice.rtcRegion
                        };
                        db.settings.userTempSettings = userTempSettings;
                        db.changed('settings', true);
                        await db.save();

                        return ui.sendError(interaction, 'err_sys_85', true);
                    }
                } catch (error) { return ui.sendError(interaction, 'err_sys_86', true); }
            }
            
            // --- UNIFIED SETUP DASHBOARD BUTTONS ---
            if (interaction.customId === 'btn_globalchat_disable') {
                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                if (currentSettings.globalChat) {
                    currentSettings.globalChat.enabled = false;
                }

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                // Clear from cache
                if (client.globalChatChannels) {
                    for (const [chanId, gId] of client.globalChatChannels.entries()) {
                        if (gId === interaction.guild.id) {
                            client.globalChatChannels.delete(chanId);
                        }
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('📴 Global Chat Dinonaktifkan')
                    .setDescription('Jaringan Global Chat untuk server ini telah dimatikan.');

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'btn_automod_enable') {
                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                
                let punishRole = interaction.guild.roles.cache.get(currentSettings.automod?.punishRole);
                if (!punishRole) {
                    punishRole = await interaction.guild.roles.create({
                        name: 'Anak Nakal (Isolasi)',
                        color: '#010101',
                        reason: 'Automod: Pembuatan role isolasi untuk poin tata krama habis'
                    }).catch(() => null);
                    if (punishRole) {
                        for (const channel of interaction.guild.channels.cache.values()) {
                            if (channel.isTextBased() || channel.isVoiceBased()) {
                                await channel.permissionOverwrites.create(punishRole, {
                                    ViewChannel: false,
                                    SendMessages: false,
                                    Connect: false
                                }).catch(() => {});
                            }
                        }
                    }
                }

                currentSettings.automod = {
                    ...currentSettings.automod,
                    enabled: true,
                    punishRole: punishRole ? punishRole.id : undefined
                };

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🛡️ Automod Diaktifkan')
                    .setDescription('Sistem Automod & Keamanan Naura sekarang berjalan.');

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'btn_automod_disable') {
                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                currentSettings.automod = {
                    ...currentSettings.automod,
                    enabled: false
                };

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🛡️ Automod Dinonaktifkan')
                    .setDescription('Sistem Automod & Keamanan Naura dinonaktifkan.');

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'mm_select_server' || interaction.customId === 'modmail_select_guild') {
                const { createTicketChannel } = require('../../plugin/modmail/modmailHelper');
                const targetGuildId = interaction.values[0];
                const guildData = await cacheManager.getGuildSettings(targetGuildId);
                if (!guildData || !guildData.settings?.modmail?.categoryId) return ui.sendError(interaction, 'err_sys_87', true);

                const loadingEmbed2 = new EmbedBuilder()
                    .setColor(ui.getColor('primary') || '#FFB6C1')
                    .setAuthor({ name: 'Naura Loading System...', iconURL: interaction.client.user.displayAvatarURL() })
                    .setDescription(`${ui.getEmoji('loading') || '⏳'} Naura sedang mengetuk pintu server... Sabar ya! 🌸`)
                    .setFooter({ text: `Sedang menyiapkan untuk ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
                await interaction.update({ content: null, embeds: [loadingEmbed2], components: [] });
                const fetchedMessages = await interaction.channel.messages.fetch({ limit: 5 }).catch(() => null);
                const originalMessage = fetchedMessages ? fetchedMessages.find(m => m.author.id === interaction.user.id) : null;
                try {
                    await createTicketChannel(originalMessage || interaction, { id: targetGuildId, categoryId: guildData.settings.modmail.categoryId }, client);
                } catch (error) { 
                    const errEmbed = new EmbedBuilder()
                        .setColor(ui.getColor('error'))
                        .setDescription('❌ Terjadi kesalahan saat memproses tiket modmail.');
                    await interaction.editReply({ embeds: [errEmbed], components: [] }).catch(()=>{}); 
                }
                return;
            }

            if (interaction.customId === 'tvc_move_select') {
                const targetId = interaction.values[0];
                const targetMember = await interaction.guild.members.fetch(targetId).catch(()=>null);
                const ownerVoice = interaction.member.voice.channel;
                if (!targetMember || !targetMember.voice.channel || !ownerVoice) return ui.sendError(interaction, 'err_sys_88', true);
                try {
                    await ownerVoice.permissionOverwrites.edit(targetId, { Connect: true, Speak: true, ViewChannel: true });
                    await targetMember.voice.setChannel(ownerVoice);
                    return ui.sendError(interaction, `✅ Berhasil memindahkan <@${targetId}> ke ruanganmu!`, true);
                } catch (error) { return ui.sendError(interaction, 'err_sys_89', true); }
            }

            if (interaction.customId === 'tvc_region_select') {
                const region = interaction.values[0];
                const memberVoice = interaction.member.voice.channel;
                if (!memberVoice) return ui.sendError(interaction, 'err_sys_90', true);

                try {
                    await memberVoice.setRTCRegion(region === 'auto' ? null : region);
                    return interaction.reply({ content: `✅ Voice Region diubah ke **${region}**.`, ephemeral: true });
                } catch (error) {
                    return interaction.reply({ content: `❌ Gagal mengubah region. Pastikan bot punya izin yang cukup.`, ephemeral: true });
                }
            }

            if (interaction.customId === 'select_setup_channel_type') {
                const channelType = interaction.values[0];

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('📺 Setup Special Channel')
                    .setDescription(`Pilih channel baru untuk **${channelType === 'ai' ? '🤖 AI Chat' : channelType === 'levelUp' ? '📈 Level-Up' : channelType === 'counting' ? '🔢 Counting Game' : '😈 Truth or Dare'}**:`);

                const menu = new ChannelSelectMenuBuilder()
                    .setCustomId(`select_special_channel_submit_${channelType}`)
                    .setPlaceholder('Pilih channel...');

                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            }
        }

        // ==========================================
        // 4. 📝 MODALS ROUTER (SUBMIT FORMULIR MODMAIL)
        // ==========================================
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'mm_modal_reply' || interaction.customId === 'mm_modal_anon') {
                const replyText = interaction.fields.getTextInputValue('mm_text_input');
                const isAnon = interaction.customId === 'mm_modal_anon';
                const ticket = await ModMail.findOne({ where: { channelId: interaction.channelId, closed: false } });
                
                if (!ticket) return ui.sendError(interaction, `${ui.getEmoji('error') || '❌'} Gagal: Tiket sudah ditutup.`, true);
                const user = await client.users.fetch(ticket.userId).catch(() => null);
                if (!user) return ui.sendError(interaction, `${ui.getEmoji('error') || '❌'} Gagal: User sudah meninggalkan Discord.`, true);

                const replyEmbed = new EmbedBuilder()
                    .setAuthor({ name: isAnon ? `Staf ${interaction.guild.name}` : `Balasan dari ${interaction.member.displayName}`, iconURL: interaction.guild.iconURL() })
                    .setDescription(replyText)
                    .setColor('#FFB6C1')
                    .setTimestamp();

                try {
                    await user.send({ embeds: [replyEmbed] });
                    await interaction.reply({ content: `${ui.getEmoji('success') || '✅'} Pesan ${isAnon ? '(Anonim)' : ''} berhasil dikirim.`, ephemeral: true });
                    
                    const logEmbed = new EmbedBuilder()
                        .setColor(ui.getColor('success'))
                        .setAuthor({ name: isAnon ? `[ANONIM] ${interaction.user.tag}` : interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                        .setDescription(`**Membalas:** ${replyText}`);
                    await interaction.channel.send({ embeds: [logEmbed] });
                } catch (e) {
                    await ui.sendError(interaction, 'err_sys_91', true);
                }
                return;
            }

            if (interaction.customId.startsWith('modal_tvc_')) {
                const memberVoice = interaction.member.voice.channel;
                if (!memberVoice) return ui.sendError(interaction, 'err_sys_92', true);
                try {
                    if (interaction.customId === 'modal_tvc_rename') {
                        let profile;
                        try {
                            profile = await UserProfile.findOne({ where: { userId: interaction.user.id } });
                        } catch (e) {}

                        let newName = interaction.fields.getTextInputValue('input_name');
                        const isBotOwner = env.OWNER_IDS && env.OWNER_IDS.includes(interaction.user.id);

                        if (isBotOwner) {
                            newName = `「👑」・${newName} Owner Voice`;
                        } else if (profile && profile.isPremium) {
                            newName = `「🌟」・${newName} VIP Voice`;
                        } else {
                            newName = `🔊 ${newName} voice`;
                        }

                        await memberVoice.setName(newName);
                        return ui.sendError(interaction, 'err_sys_93', true);
                    }
                    if (interaction.customId === 'modal_tvc_limit') {
                        let limit = parseInt(interaction.fields.getTextInputValue('input_limit'));
                        if (isNaN(limit) || limit < 0 || limit > 99) limit = 0;
                        await memberVoice.setUserLimit(limit);
                        return ui.sendError(interaction, 'err_sys_94', true);
                    }
                    if (interaction.customId === 'modal_tvc_status') {
                        try {
                            // Cek Discord API feature support
                            const fetch = require('isomorphic-unfetch');
                            const newStatus = interaction.fields.getTextInputValue('input_status');

                            const response = await fetch(`https://discord.com/api/v10/channels/${memberVoice.id}/voice-status`, {
                                method: 'PUT',
                                headers: {
                                    Authorization: `Bot ${client.token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ status: newStatus })
                            });

                            if (response.ok) {
                                return ui.sendError(interaction, `✅ Status Voice Channel diubah menjadi: **${newStatus}**`, true);
                            } else {
                                return ui.sendError(interaction, 'err_sys_95', true);
                            }
                        } catch (err) {
                            return ui.sendError(interaction, 'err_sys_96', true);
                        }
                    }
                } catch (err) {
                    logger.error('[TVC Modal Submit Error]', err);
                    return ui.sendError(interaction, `❌ Terjadi kesalahan pada Voice Channel Control: ${err.message}`, true);
                }
            }

            // --- UNIFIED SETUP DASHBOARD MODALS ---
            if (interaction.customId === 'modal_setup_minecraft') {
                const ip = interaction.fields.getTextInputValue('input_minecraft_ip');
                const portStr = interaction.fields.getTextInputValue('input_minecraft_port') || '25565';
                const port = parseInt(portStr) || 25565;

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                currentSettings.minecraft = { ip, port };
                
                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🎮 Setup Minecraft Status Berhasil!')
                    .setDescription(`Server IP: **${ip}:${port}** telah disimpan.\nNaura akan melacak status server ini.`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId.startsWith('modal_setup_sticky_content_')) {
                const channelId = interaction.customId.split('_')[4];
                const messageText = interaction.fields.getTextInputValue('input_sticky_message');

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                currentSettings.stickyMessage = { channelId, message: messageText, lastId: null };

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('📌 Setup Pesan Lengket Berhasil!')
                    .setDescription(`Pesan lengket dipasang di <#${channelId}>:\n>>> ${messageText}`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'modal_setup_autoreply') {
                const trigger = interaction.fields.getTextInputValue('input_autoreply_trigger').toLowerCase().trim();
                const response = interaction.fields.getTextInputValue('input_autoreply_response');

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                if (!currentSettings.autoReplies) currentSettings.autoReplies = [];

                const existingIndex = currentSettings.autoReplies.findIndex(r => r.trigger === trigger);
                if (existingIndex !== -1) {
                    currentSettings.autoReplies[existingIndex].response = response;
                } else {
                    currentSettings.autoReplies.push({ trigger, response });
                }

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🤖 Setup Auto Responder Berhasil!')
                    .setDescription(`Naura akan otomatis membalas kata kunci **"${trigger}"** dengan:\n>>> ${response}`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        // ==========================================
        // 5. 📺 SELECT MENUS ROUTER (Channel & Role Setups)
        // ==========================================
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'select_announcement_channel') {
                const channelId = interaction.values[0];

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                currentSettings.announcementChannel = channelId;

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('📢 Setup Announcement Channel Berhasil!')
                    .setDescription(`Channel pengumuman otomatis (Welcome/Logs) disetel ke <#${channelId}>.`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'select_globalchat_channel') {
                const channelId = interaction.values[0];

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                currentSettings.globalChat = { enabled: true, channelId };

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                // Update fast global chat cache map
                if (!client.globalChatChannels) client.globalChatChannels = new Map();
                for (const [chanId, gId] of client.globalChatChannels.entries()) {
                    if (gId === interaction.guild.id) {
                        client.globalChatChannels.delete(chanId);
                    }
                }
                client.globalChatChannels.set(channelId, interaction.guild.id);

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🌐 Setup Global Chat Berhasil!')
                    .setDescription(`Channel <#${channelId}> terhubung ke Naura Global Chat!`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'select_starboard_channel') {
                const channelId = interaction.values[0];

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                const threshold = currentSettings.starboard?.threshold || 3;
                currentSettings.starboard = { enabled: true, channelId, threshold };

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('⭐ Setup Starboard Berhasil!')
                    .setDescription(`Channel Starboard disetel ke <#${channelId}> dengan batas minimal **${threshold} ⭐**.`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId === 'select_sticky_channel') {
                const channelId = interaction.values[0];

                // Show the Modal to write the message
                const modal = new ModalBuilder()
                    .setCustomId(`modal_setup_sticky_content_${channelId}`)
                    .setTitle('📌 Isi Pesan Sticky');
                
                const input = new TextInputBuilder()
                    .setCustomId('input_sticky_message')
                    .setLabel('Tulis pesan lengket:')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Tulis pesan yang akan selalu menempel di bawah channel ini...')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'select_automod_log') {
                const channelId = interaction.values[0];

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                
                if (!currentSettings.automod) currentSettings.automod = {};
                currentSettings.automod.logChannel = channelId;

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🛡️ Log Automod Disetel')
                    .setDescription(`Channel log audit keamanan disetel ke <#${channelId}>.`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.customId.startsWith('select_special_channel_submit_')) {
                const channelType = interaction.customId.split('_')[4];
                const channelId = interaction.values[0];

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                if (!currentSettings.channels) currentSettings.channels = {};
                currentSettings.channels[channelType] = channelId;

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('📺 Special Channel Disetel!')
                    .setDescription(`Channel untuk **${channelType === 'ai' ? '🤖 AI Chat' : channelType === 'levelUp' ? '📈 Level-Up' : channelType === 'counting' ? '🔢 Counting Game' : '😈 Truth or Dare'}** berhasil disetel ke <#${channelId}>.`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'select_autorole_role') {
                const roleId = interaction.values[0];

                let [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                const currentSettings = guildData.settings || {};
                currentSettings.autoRole = roleId;

                guildData.settings = currentSettings;
                guildData.changed('settings', true);
                await guildData.save();

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🎭 Setup Auto-Role Berhasil!')
                    .setDescription(`Member baru bergabung akan otomatis diberikan role <@&${roleId}>.`);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};
