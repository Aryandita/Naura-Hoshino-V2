const { 
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType, ChannelType, MessageFlags 
} = require('discord.js');
const GuildSettings = require('../../src/models/GuildSettings');
const ui = require('../../src/config/ui');
const { logger } = require('../../src/managers/logger');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const cacheManager = require('../../src/managers/cacheManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('⚙️ [ADMIN] Master Setup Dashboard Governance Naura Hoshino.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('dashboard')
            .setDescription('🖥️ Buka Master Dashboard Setup Interaktif')
        )
        .addSubcommand(sub =>
            sub.setName('softban')
            .setDescription('🛡️ Atur Channel Softban / Perangkap Scammer (Honeypot Trap)')
            .addChannelOption(opt =>
                opt.setName('channel')
                .setDescription('Pilih channel yang dijadikan perangkap scammer (Pesan di sana = Auto-Ban)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
            sub.setName('greetings')
            .setDescription('👋 Atur channel & status pesan Welcome/Leave')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel Selamat Datang').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addBooleanOption(opt => opt.setName('aktif').setDescription('Aktifkan pesan selamat datang?').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('automod')
            .setDescription('🛡️ Atur modul Automod & Log Audit Security')
            .addBooleanOption(opt => opt.setName('aktif').setDescription('Aktifkan sistem Anti-Spam & Automod?').setRequired(true))
            .addChannelOption(opt => opt.setName('log').setDescription('Channel log audit keamanan').addChannelTypes(ChannelType.GuildText).setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('modmail')
            .setDescription('📩 Atur kategori & role staff Modmail')
            .addChannelOption(opt => opt.setName('kategori').setDescription('Kategori untuk tiket Modmail').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role Staff Modmail').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('ticket')
            .setDescription('🎫 Atur kategori & log Sistem Tiket')
            .addChannelOption(opt => opt.setName('kategori').setDescription('Kategori channel tiket').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
            .addChannelOption(opt => opt.setName('log').setDescription('Channel log penutupan tiket').addChannelTypes(ChannelType.GuildText).setRequired(false))
            .addChannelOption(opt => opt.setName('panel').setDescription('Channel tempat mengirim pesan Panel Buka Tiket').addChannelTypes(ChannelType.GuildText).setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('tempvoice')
            .setDescription('🔊 Atur generator Voice Channel dinamis')
            .addChannelOption(opt => opt.setName('channel').setDescription('Voice Channel generator').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
            .addChannelOption(opt => opt.setName('kategori').setDescription('Kategori tempat room dibuat').addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('autorole')
            .setDescription('🎭 Atur role otomatis saat member baru bergabung')
            .addRoleOption(opt => opt.setName('role').setDescription('Role member baru').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('vanity')
            .setDescription('✍️ Atur role reward untuk Custom Status member')
            .addStringOption(opt => opt.setName('teks').setDescription('Teks status yang dicari (mis. .gg/nama-server)').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role reward vanity').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('minecraft')
            .setDescription('🎮 Atur Jembatan Chat & Status Server Minecraft')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel jembatan chat Discord-Minecraft').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addStringOption(opt => opt.setName('ip').setDescription('Alamat IP RCON').setRequired(false))
            .addIntegerOption(opt => opt.setName('port').setDescription('Port RCON (Default 25575)').setRequired(false))
            .addStringOption(opt => opt.setName('password').setDescription('Password RCON').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('ai-automod')
            .setDescription('🤖 Atur AI Auto-mod berbasis Gemini (Report Pesan)')
            .addBooleanOption(opt => opt.setName('aktif').setDescription('Aktifkan fitur AI Report?').setRequired(true))
            .addChannelOption(opt => opt.setName('audit-channel').setDescription('Channel log laporan AI Automod').addChannelTypes(ChannelType.GuildText).setRequired(false))
            .addIntegerOption(opt => opt.setName('threshold').setDescription('Skor minimum pelanggaran untuk aksi otomatis (0-100, default 70)').setMinValue(0).setMaxValue(100).setRequired(false))
            .addBooleanOption(opt => opt.setName('learning-mode').setDescription('Mode belajar: log saja, tidak ada aksi otomatis').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('ai-config')
            .setDescription('🤖 Atur Persona & Custom System Prompt Gemini AI Server')
            .addStringOption(opt => opt.setName('persona').setDescription('Tulis instruksi persona/sifat khusus AI untuk server ini').setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand() || 'dashboard';

        let [settingsRecord] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
        let currentSettings;
        try {
            currentSettings = typeof settingsRecord.settings === 'string' ? JSON.parse(settingsRecord.settings) : (settingsRecord.settings || {});
        } catch (e) {
            currentSettings = {};
        }

        const saveSettings = async (newSettings) => {
            settingsRecord.settings = newSettings;
            settingsRecord.changed('settings', true);
            await settingsRecord.save();
            // ✅ Rule 1.9: Invalidate cache setelah settings berubah
            await cacheManager.invalidateGuildSettings(interaction.guild.id).catch(() => {});
        };

        // ==========================================
        // 🛡️ SUBCOMMAND: SOFTBAN / SCAMMER TRAP CHANNEL
        // ==========================================
        if (subcommand === 'softban') {
            const trapChannel = interaction.options.getChannel('channel');
            currentSettings.softbanChannelId = trapChannel.id;
            currentSettings.honeypotChannelId = trapChannel.id;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: '#FF0000',
                authorName: 'Naura Anti-Scammer Governance',
                title: '🛡️ Channel Softban (Scammer Trap) Berhasil Diatur!',
                description: `Channel <#${trapChannel.id}> kini resmi dikonfigurasikan sebagai **Perangkap Scammer (Honeypot)**!\n\n` +
                             `⚠️ **Cara Kerja:** Setiap akun biasa (bukan Admin/Bot) yang mengirim pesan di channel <#${trapChannel.id}> akan **langsung di-banned dari server secara instan**, dan seluruh riwayat pesannya selama 7 hari akan dibersihkan!\n\n` +
                             `💡 **Saran:** Buat channel bernama \`#verify-here\` atau \`#click-to-verify\` agar para bot scammer terjebak di sana.`,
                footerText: ui.getFooter('core')
            });

            return interaction.reply(payload);
        }

        // ==========================================
        // 👋 SUBCOMMAND: GREETINGS
        // ==========================================
        if (subcommand === 'greetings') {
            const welcomeChan = interaction.options.getChannel('channel');
            const enabled = interaction.options.getBoolean('aktif') ?? true;

            if (!currentSettings.greetings) currentSettings.greetings = {};
            currentSettings.greetings.welcome = {
                enabled,
                channelId: welcomeChan.id,
                message: currentSettings.greetings.welcome?.message || 'Selamat datang di server {user}!',
                image: true
            };
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('success'),
                authorName: 'Naura Greetings Module',
                title: '👋 Setup Greetings Berhasil',
                description: `Pesan Selamat Datang kini **${enabled ? 'Aktif 🟢' : 'Nonaktif 🔴'}** dan diarahkan ke <#${welcomeChan.id}>.`,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // 🛡️ SUBCOMMAND: AUTOMOD
        // ==========================================
        if (subcommand === 'automod') {
            const enabled = interaction.options.getBoolean('aktif');
            const logChan = interaction.options.getChannel('log');

            if (!currentSettings.automod) currentSettings.automod = {};
            currentSettings.automod.enabled = enabled;
            if (logChan) currentSettings.automod.logChannel = logChan.id;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: 'Naura Security Module',
                title: '🛡️ Setup Automod Berhasil',
                description: `Status Automod: **${enabled ? '🟢 Aktif' : '🔴 Nonaktif'}**\nChannel Audit Log: ${logChan ? `<#${logChan.id}>` : '*Tidak Diubah*'}`,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // 📩 SUBCOMMAND: MODMAIL
        // ==========================================
        if (subcommand === 'modmail') {
            const category = interaction.options.getChannel('kategori');
            const role = interaction.options.getRole('role');

            currentSettings.modmailCategory = category.id;
            if (role) currentSettings.modmailStaffRole = role.id;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: 'Naura Modmail Module',
                title: '📩 Setup Modmail Berhasil',
                description: `Kategori Tiket: <#${category.id}>\nRole Staff: ${role ? `<@&${role.id}>` : '*Belum Diatur*'}`,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // 🎫 SUBCOMMAND: TICKET
        // ==========================================
        if (subcommand === 'ticket') {
            const category = interaction.options.getChannel('kategori');
            const logChan = interaction.options.getChannel('log');
            const panel = interaction.options.getChannel('panel');

            currentSettings.ticketCategory = category.id;
            if (logChan) currentSettings.ticketLogChannel = logChan.id;
            await saveSettings(currentSettings);

            let extraMsg = '';
            if (panel) {
                try {
                    const panelPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary'),
                        authorName: 'Naura Helpdesk Services',
                        title: '🎫 Pusat Bantuan & Pelayanan',
                        description: 'Selamat datang di Pusat Bantuan!\n\nJika kamu memiliki pertanyaan, ingin melaporkan sesuatu, atau membutuhkan bantuan dari Staff/Admin, silakan buat tiket baru dengan menekan tombol di bawah.\n\n⚠️ **Mohon jangan menyalahgunakan sistem tiket!**',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('btn_ticket_open')
                                .setLabel('Buka Tiket Baru')
                                .setEmoji('🎫')
                                .setStyle(ButtonStyle.Primary)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await panel.send(panelPayload);
                    extraMsg = `\n✅ Pesan panel tiket berhasil dikirim ke <#${panel.id}>.`;
                } catch (err) {
                    logger.error(`[SetupTicket] Gagal mengirim panel: ${err.message}`);
                    extraMsg = `\n❌ Gagal mengirim panel ke <#${panel.id}>. Pastikan bot memiliki izin Send Messages & View Channel.`;
                }
            }

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: 'Naura Ticketing Module',
                title: '🎫 Setup Tiket Berhasil',
                description: `Kategori Tiket: <#${category.id}>\nChannel Log Tiket: ${logChan ? `<#${logChan.id}>` : '*Belum Diatur*'}${extraMsg}`,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // 🔊 SUBCOMMAND: TEMPVOICE
        // ==========================================
        if (subcommand === 'tempvoice') {
            const voiceChan = interaction.options.getChannel('channel');
            const category = interaction.options.getChannel('kategori');

            currentSettings.tempvoiceChannel = voiceChan.id;
            if (category) currentSettings.tempvoiceCategory = category.id;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: 'Naura TempVoice Module',
                title: '🔊 Setup TempVoice Berhasil',
                description: `Generator Voice: <#${voiceChan.id}>\nKategori Voice: ${category ? `<#${category.id}>` : '*Otomatis*'}`,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // 🎭 SUBCOMMAND: AUTOROLE
        // ==========================================
        if (subcommand === 'autorole') {
            const role = interaction.options.getRole('role');
            currentSettings.autoroleId = role.id;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: 'Naura Roles Module',
                title: '🎭 Setup Auto-Role Berhasil',
                description: `Role Baru Member: <@&${role.id}>`,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // ✍️ SUBCOMMAND: VANITY ROLES
        // ==========================================
        if (subcommand === 'vanity') {
            const text = interaction.options.getString('teks');
            const role = interaction.options.getRole('role');

            currentSettings.vanityText = text;
            currentSettings.vanityRoleId = role.id;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: 'Naura Vanity Status Module',
                title: '✍️ Setup Vanity Reward Berhasil',
                description: `Teks Status Dilihat: \`${text}\`\nRole Reward: <@&${role.id}>`,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // 🎮 SUBCOMMAND: MINECRAFT CHAT BRIDGE
        // ==========================================
        if (subcommand === 'minecraft') {
            const channel = interaction.options.getChannel('channel');
            const ip = interaction.options.getString('ip');
            const port = interaction.options.getInteger('port');
            const password = interaction.options.getString('password');

            if (!currentSettings.minecraft) currentSettings.minecraft = {};
            currentSettings.minecraft.bridgeEnabled = true;
            currentSettings.minecraft.bridgeChannelId = channel.id;
            if (ip) currentSettings.minecraft.ip = ip;
            if (port) currentSettings.minecraft.rconPort = port;
            if (password) currentSettings.minecraft.rconPassword = password;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary'),
                authorName: 'Naura Minecraft Bridge Module',
                title: '🎮 Setup Jembatan Chat Minecraft Berhasil',
                description: `Channel Chat Bridge: <#${channel.id}>\nIP RCON: \`${currentSettings.minecraft.ip || 'localhost'}\` | Port: \`${currentSettings.minecraft.rconPort || 25575}\``,
                footerText: ui.getFooter('core')
            });
            return interaction.reply(payload);
        }

        // ==========================================
        // 🤖 SUBCOMMAND: AI AUTOMOD
        // ==========================================
        if (subcommand === 'ai-automod') {
            const enabled = interaction.options.getBoolean('aktif');
            const auditChannel = interaction.options.getChannel('audit-channel');
            const threshold = interaction.options.getInteger('threshold') ?? 70;
            const learningMode = interaction.options.getBoolean('learning-mode') ?? false;

            if (!currentSettings.aiAutomod) currentSettings.aiAutomod = {};
            currentSettings.aiAutomod.enabled = enabled;
            currentSettings.aiAutomod.toxicityThreshold = threshold;
            currentSettings.aiAutomod.learningMode = learningMode;
            if (auditChannel) currentSettings.aiAutomod.auditChannelId = auditChannel.id;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: enabled ? '#00FF88' : '#FF4444',
                authorName: 'Naura AI Automod Module',
                title: '🤖 Setup AI Automod Berhasil',
                description: [
                    `**Status:** ${enabled ? '🟢 Aktif' : '🔴 Nonaktif'}`,
                    `**Threshold Aksi:** Skor ≥ ${threshold}/100`,
                    `**Mode Belajar:** ${learningMode ? '✅ Aktif (hanya log, tidak ada aksi)' : '❌ Nonaktif (aksi otomatis)'}`,
                    auditChannel ? `**Channel Audit:** <#${auditChannel.id}>` : '**Channel Audit:** *Belum Diatur*',
                    '',
                    enabled ? `ℹ️ Gunakan **klik kanan pada pesan** → **Apps** → **⚑ Report Pesan** untuk melaporkan pesan kepada AI.` : ''
                ].join('\n'),
                footerText: ui.getFooter('core')
            });

            return interaction.reply(payload);
        }

        // ==========================================
        // 🤖 SUBCOMMAND: AI CONFIG (CUSTOM PERSONA)
        // ==========================================
        if (subcommand === 'ai-config') {
            const persona = interaction.options.getString('persona');
            currentSettings.aiPersona = persona;
            await saveSettings(currentSettings);

            const payload = buildContainerV2({
                accentColorHex: '#00FFFF',
                authorName: 'Naura AI Central Setup Module',
                title: '🤖 Persona AI Server Berhasil Diatur',
                description: `Persona/Sifat khusus AI di server ini telah berhasil diperbarui!\n\n**Persona Baru:**\n> *"${persona}"*`,
                footerText: ui.getFooter('core')
            });

            return interaction.reply(payload);
        }

        // ==========================================
        // 🖥️ DEFAULT: MASTER INTERACTIVE DASHBOARD
        // ==========================================
        const softbanChan = currentSettings.softbanChannelId || currentSettings.honeypotChannelId;
        const autoModStatus = currentSettings.automod?.enabled ? '🟢 Aktif' : '🔴 Nonaktif';
        const welcomeStatus = currentSettings.greetings?.welcome?.enabled ? '🟢 Aktif' : '🔴 Nonaktif';

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('master_setup_menu')
                .setPlaceholder('Pilih kategori setup untuk diedit...')
                .addOptions([
                    { label: '🛡️ Softban Channel (Scammer Trap)', value: 'setup_softban', description: 'Atur channel perangkap auto-ban scammer', emoji: '🛡️' },
                    { label: '👋 Greetings (Welcome/Leave)', value: 'setup_greetings', description: 'Atur pesan selamat datang dan keluar', emoji: '👋' },
                    { label: '📩 Modmail', value: 'setup_modmail', description: 'Atur kategori tiket dan role staff', emoji: '📩' },
                    { label: '🛡️ Automod & Security', value: 'setup_automod', description: 'Atur filter chat dan punishment', emoji: '🛡️' },
                    { label: '🎫 Ticketing System', value: 'setup_ticket', description: 'Atur sistem bantuan member server', emoji: '🎫' },
                    { label: '🔊 TempVoice', value: 'setup_tempvoice', description: 'Atur Voice Channel dinamis', emoji: '🔊' },
                    { label: '🎭 Roles (Auto-Role)', value: 'setup_autorole', description: 'Atur pemberian role otomatis', emoji: '🎭' },
                    { label: '✍️ Vanity Roles', value: 'setup_vanity', description: 'Atur reward role untuk custom status member', emoji: '✍️' },
                    { label: '🎮 Minecraft Status', value: 'setup_minecraft', description: 'Lacak & atur chat bridge Minecraft', emoji: '🎮' }
                ])
        );

        const initialPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#2b2d31',
            authorName: 'Naura Admin Governance Engine',
            title: '⚙️ Naura Master Setup Dashboard',
            iconURL: interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
            description: `Selamat datang di Master Setup Dashboard! Di sini kamu bisa mengonfigurasikan seluruh sistem server secara terpusat.\n\n` +
                         `**Status Sistem Saat Ini:**\n` +
                         `• 🛡️ **Softban Trap Channel:** ${softbanChan ? `<#${softbanChan}>` : '*Belum Diatur*'}\n` +
                         `• 🤖 **Automod:** ${autoModStatus}\n` +
                         `• 👋 **Greetings Welcome:** ${welcomeStatus}\n\n` +
                         `Gunakan menu pilihan di bawah ini untuk mengonfigurasi modul:`,
            buttonsRow: row,
            footerText: ui.getFooter('core')
        });

        initialPayload.flags = MessageFlags.Ephemeral;
        const reply = await interaction.reply(initialPayload);

        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Ini bukan menumu!', flags: MessageFlags.Ephemeral });
            }

            const selection = i.values[0];

            if (selection === 'setup_softban') {
                const chanSelect = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_softban_channel')
                        .setPlaceholder('Pilih channel perangkap scammer...')
                        .addChannelTypes(ChannelType.GuildText)
                );
                await i.update({
                    content: '🛡️ **Silakan pilih channel yang akan dijadikan Softban / Honeypot Scammer Trap:**',
                    embeds: [],
                    components: [chanSelect]
                });
            } else if (selection === 'setup_greetings') {
                const chanSelect = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_welcome_channel')
                        .setPlaceholder('Pilih channel Welcome...')
                        .addChannelTypes(ChannelType.GuildText)
                );
                await i.update({
                    content: '👋 **Silakan pilih channel untuk Pesan Selamat Datang (Welcome):**',
                    embeds: [],
                    components: [chanSelect]
                });
            } else if (selection === 'setup_autorole') {
                const roleSelect = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId('select_auto_role')
                        .setPlaceholder('Pilih Auto-Role member baru...')
                );
                await i.update({
                    content: '🎭 **Silakan pilih role otomatis untuk member baru:**',
                    embeds: [],
                    components: [roleSelect]
                });
            } else {
                await i.update({
                    content: `💡 Untuk mengonfigurasi **${selection}**, kamu juga dapat menggunakan sub-command langsung seperti \`/setup ${selection.replace('setup_', '')}\`.`,
                    embeds: [],
                    components: []
                });
            }
        });
    }
};
