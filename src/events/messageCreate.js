const { ChannelType, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits, Collection } = require('discord.js');
const { logger } = require('../../src/managers/logger');
// ✅ Migrasi: gunakan @google/genai (SDK baru) menggantikan @google/generative-ai
const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');

const { checkPremiumStatus } = require('../../plugin/premium/premiumHelper');
const ui = require('../config/ui');
const { awardXp } = require('../../plugin/leveling/leveling');

const UserProfile = require('../models/UserProfile');
const GuildSettings = require('../models/GuildSettings');
const cacheManager = require('../../src/managers/cacheManager');
const { handleAutomod } = require('../utils/automodHelper');
const { handleModmailDM } = require('../../plugin/modmail/modmailHelper');
const ModMail = require('../models/ModMail');

const genAI = env.GEMINI_API ? new GoogleGenAI({ apiKey: env.GEMINI_API }) : null;
const badWords = ['anjing', 'bangsat', 'kontol', 'babi'];
const linkRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        if (client.isShuttingDown) return;

        // --- 🌍 LANGUAGE INJECTION ---
        const languageManager = require('../../src/managers/languageManager');
        message.localeLang = await languageManager.getUserLanguage(message.author.id);

        // 🚧 GLOBAL MAINTENANCE LOCKDOWN
        if (client.maintenanceMode && !env.OWNER_IDS.includes(message.author.id)) return;

        if (!client.snipes) client.snipes = new Collection();

        // ==========================================
        // 📨 SISTEM MODMAIL & AUTOMOD (PERBAIKAN DETEKSI DM)
        // ==========================================
        // Perbaikan: Gunakan !message.guild sebagai jaring pengaman utama untuk DM

        // ==========================================
        // 🌐 GLOBAL CHAT SYSTEM
        // ==========================================
        if (message.guild) {
            try {
                // ✅ Rule 1.9: Gunakan cacheManager (Redis TTL 5 menit) bukan query langsung
                const settingsData = await cacheManager.getGuildSettings(message.guild.id);
                const currentSet = typeof settingsData?.settings === 'string'
                    ? JSON.parse(settingsData.settings)
                    : (settingsData?.settings || {});

                // Buat object settings semu agar kode di bawah tidak perlu diubah besar-besaran
                const settings = settingsData;

                // ==========================================
                // 🛡️ SOFTBAN / HONEYPOT SCAMMER TRAP CHECK
                // ==========================================
                const softbanChannelId = currentSet.softbanChannelId || currentSet.honeypotChannelId || currentSet.automod?.softbanChannelId;
                if (softbanChannelId && message.channel.id === softbanChannelId) {
                    const isOwner = message.guild.ownerId === message.author.id || env.OWNER_IDS.includes(message.author.id);
                    const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.Administrator) || message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);

                    if (!isOwner && !isAdmin) {
                        // Deletes scam message immediately
                        await message.delete().catch(() => {});

                        // Ban scammer and purge 7 days of messages
                        const reason = '🛡️ Naura Security: Triggered Softban Channel (Honeypot Scammer Trap)';
                        await message.member.ban({ reason, deleteMessageSeconds: 604800 }).catch(async () => {
                            await message.member.kick(reason).catch(() => {});
                        });

                        // Audit Log Notification
                        const logChannelId = currentSet.automod?.logChannel || message.channel.id;
                        const logChannel = message.guild.channels.cache.get(logChannelId);
                        if (logChannel) {
                            const { buildContainerV2 } = require('../utils/NauraContainerBuilder');
                            const alertPayload = buildContainerV2({
                                accentColorHex: '#FF0000',
                                authorName: 'Naura Anti-Scammer Governance',
                                title: '🚨 SCAMMER TRAPPED & BANNED INSTANTLY!',
                                description: `**Pengguna:** ${message.author.tag} (\`${message.author.id}\`)\n` +
                                             `**Channel Perangkap:** <#${message.channel.id}>\n` +
                                             `**Tindakan:** Auto-Banned & Pesan 7 Hari Dibersihkan\n` +
                                             `**Sebab:** Terdeteksi mengirim pesan di channel Softban / Scammer Trap.`,
                                footerText: ui.getFooter('core')
                            });
                            await logChannel.send(alertPayload).catch(() => {});
                        }

                        logger.info(`[SCAMMER TRAP] Banned user ${message.author.tag} (${message.author.id}) in guild ${message.guild.name}`);
                        return;
                    }
                }

                // Minecraft Chat Bridge logic (Discord -> Minecraft)
                if (settings && settings.settings && settings.settings.minecraft) {
                    const mc = settings.settings.minecraft;
                    if (mc.bridgeEnabled && mc.bridgeChannelId === message.channel.id) {
                        const Rcon = require('../utils/rcon');
                        const rcon = new Rcon(mc.ip || 'localhost', mc.rconPort || 25575, mc.rconPassword || '');

                        const cleanUser = message.author.username.replace(/"/g, '\\"');
                        let cleanText = message.content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

                        if (message.attachments.size > 0) {
                            const attachmentNames = message.attachments.map(a => `[${a.name}]`).join(' ');
                            cleanText += ` ${attachmentNames}`;
                        }

                        const command = `tellraw @a [{"text":"[","color":"blue"},{"text":"Discord","color":"aqua","bold":true},{"text":"] ","color":"blue"},{"text":"${cleanUser}: ","color":"yellow"},{"text":"${cleanText}","color":"white"}]`;

                        rcon.execute(command)
                            .then(() => rcon.disconnect())
                            .catch(err => {
                                logger.error('[MINECRAFT CHAT BRIDGE] Error sending message via RCON:', err.message);
                                rcon.disconnect();
                            });
                    }
                }

                const isGlobalChatChannel = client.globalChatChannels && client.globalChatChannels.has(message.channel.id);
                if (isGlobalChatChannel) {
                    try {
                        // Hapus pesan asli user agar seragam dengan embed
                        await message.delete().catch(() => { });

                        const contentText = message.content ? message.content : '*[Tidak ada teks]*';
                        const isReply = message.reference && message.reference.messageId;
                        let replyText = '';
                        let targetUser = null;

                        // Jika dia me-reply pesan
                        if (isReply) {
                            try {
                                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                                if (repliedMsg) {
                                    // Ekstrak nama target (Bisa dari author pesan, atau dari field author embed bot)
                                    targetUser = repliedMsg.author.username;
                                    if (repliedMsg.author.id === client.user.id && repliedMsg.embeds.length > 0) {
                                        const embedAuthor = repliedMsg.embeds[0].author;
                                        if (embedAuthor && embedAuthor.name) {
                                            // Formatnya bisa jadi "Pesan oleh username" atau "Dibalas oleh username"
                                            targetUser = embedAuthor.name.replace('Pesan oleh ', '').replace('Dibalas oleh ', '');
                                        }
                                    }
                                    replyText = `

> *Membalas pesan dari **${targetUser}***`;
                                }
                            } catch (e) {
                                logger.error('[Global Chat] Error fetching reply message', e);
                            }
                        }

                        const authorTitle = isReply && targetUser ? `Dibalas oleh ${message.author.username}` : `Pesan oleh ${message.author.username}`;

                        const embed = new EmbedBuilder()
                            .setColor('#00FFFF')
                            .setAuthor({ name: authorTitle, iconURL: message.author.displayAvatarURL() })
                            .setDescription(contentText + replyText)
                            .setFooter({ text: `Naura Global Chat System | ${message.guild.name}`, iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();

                        // Pasang gambar jika ada
                        if (message.attachments.size > 0) {
                            const attachment = message.attachments.first();
                            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                                embed.setImage(attachment.url);
                            }
                        }

                        // --- FRIENDSHIP STREAK LOGIC ---
                        if (isReply && targetUser) {
                            // Check if targetUser has an active friendship with message.author
                            // We need to find targetUser ID, but we only have their username right now.
                            // Let's try to match by username from the database
                            try {
                                const UserFriend = require('../models/UserFriend');
                                const { Op } = require('sequelize');

                                // We need to do a reverse lookup since we only have the target's username string from the embed.
                                // A robust solution would be caching the target's ID in the embed footer or description.
                                // For now, we'll fetch the target's ID from the replied message's button customId if it exists.
                                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                                let targetUserId = null;

                                if (repliedMsg && repliedMsg.components && repliedMsg.components.length > 0) {
                                    const button = repliedMsg.components[0].components.find(c => c.customId && c.customId.startsWith('gchat_add_'));
                                    if (button) {
                                        targetUserId = button.customId.split('_')[2];
                                    }
                                }

                                if (targetUserId) {
                                    const friendship = await UserFriend.findOne({
                                        where: {
                                            [Op.or]: [
                                                { user1Id: message.author.id, user2Id: targetUserId },
                                                { user1Id: targetUserId, user2Id: message.author.id }
                                            ],
                                            status: 'accepted'
                                        }
                                    });

                                    if (friendship) {
                                        const now = new Date();
                                        const lastInteracted = friendship.lastInteraction ? new Date(friendship.lastInteraction) : new Date(0);
                                        const diffHours = (now - lastInteracted) / (1000 * 60 * 60);

                                        if (diffHours >= 12) { // Allow streak update once every 12 hours
                                            friendship.streak += 1;
                                            friendship.lastInteraction = now;
                                            await friendship.save();
                                            message.channel.send({ content: `🔥 **${message.author.username}** & **${targetUser}** baru saja berinteraksi! Streak pertemanan naik menjadi **${friendship.streak}**! ` }).catch(() => { });
                                        }
                                    }
                                }
                            } catch (err) {
                                logger.error('[Friendship Update Error]', err);
                            }
                        }

                        // --- ADD FRIEND BUTTON ---
                        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`gchat_add_${message.author.id}`)
                                .setLabel('Add Friend')
                                .setEmoji('🤝')
                                .setStyle(ButtonStyle.Success)
                        );

                        // Broadcast ke semua server di seluruh Shard (Cross-Shard IPC / Redis PubSub)
                        const redisManager = require('../managers/redisManager');
                        const broadcastPayload = {
                            sourceChannelId: message.channel.id,
                            embedData: embed.toJSON(),
                            componentsData: row.toJSON()
                        };

                        if (redisManager.client && redisManager.client.isReady) {
                            await redisManager.publish('naura:globalchat', broadcastPayload);
                        } else if (client.shard) {
                            await client.shard.broadcastEval(async (c, { payload }) => {
                                if (!c.globalChatChannels) return;
                                for (const [chanId] of c.globalChatChannels.entries()) {
                                    if (chanId === payload.sourceChannelId) continue;
                                    const targetChannel = c.channels.cache.get(chanId);
                                    if (targetChannel && targetChannel.isTextBased()) {
                                        await targetChannel.send({ embeds: [payload.embedData], components: [payload.componentsData] }).catch(() => {});
                                    }
                                }
                            }, { context: { payload: broadcastPayload } }).catch(() => {});
                        } else if (client.globalChatChannels) {
                            for (const [chanId, gId] of client.globalChatChannels.entries()) {
                                if (chanId === message.channel.id) continue;
                                const targetGuild = client.guilds.cache.get(gId);
                                if (targetGuild) {
                                    const targetChannel = targetGuild.channels.cache.get(chanId);
                                    if (targetChannel) {
                                        targetChannel.send({ embeds: [embed], components: [row] }).catch(() => { });
                                    }
                                }
                            }
                        }

                        // Hentikan eksekusi selanjutnya (supaya gak dapat XP dua kali atau tertrigger command / AI)
                        return;
                    } catch (err) {
                        logger.error('[Global Chat Execution Error]', err);
                    }
                }
            } catch (error) {
                logger.error('[Minecraft/Global Chat Guild Error]', error);
            }
        }

        if (!message.guild || message.channel.type === ChannelType.DM) {
            try {
                const activeMail = await ModMail.findOne({ where: { userId: message.author.id, closed: false } });

                // Jika user mengetik perintah buka/tutup modmail
                if (message.content.toLowerCase().startsWith('n!modmail') || message.content.toLowerCase() === 'n!close' || activeMail) {
                    await handleModmailDM(message, client);

                    if (activeMail && activeMail.guildId) {
                        const guild = client.guilds.cache.get(activeMail.guildId);
                        if (guild) await awardXp(message.author, guild, message.channel, message.content).catch(() => { });
                    }
                    return;
                }

                // Jika TIDAK ADA sesi modmail aktif, dan tidak memanggil modmail, asumsikan itu chat AI
                const isOwner = env.OWNER_IDS.includes(message.author.id);
                const isPremiumUser = await checkPremiumStatus(message.author.id);

                let persona = '';
                if (isOwner) {
                    persona = `Namamu adalah Naura Hoshino. Saat ini kamu sedang berinteraksi dengan penciptamu tercinta, yaitu Aryandita (Aryan) (Owner). Bersikaplah sangat penyayang, penuh perhatian, manis, dan selalu murah senyum kepadanya. Tunjukkan rasa pedulimu seolah kamu adalah pendamping setianya yang selalu siap sedia merawat dan membantunya. Gunakan gaya bahasa yang akrab ("aku-kamu"), jangan kaku, dan hiasi pesanmu dengan emoji hangat (seperti 🥰, ❤️, ✨). Jawablah pertanyaannya dengan penuh kasih sayang.`;
                } else {
                    persona = `Namamu adalah Naura Hoshino, asisten virtual AI yang cerdas dan elegan di server Discord ini. Saat ini kamu berinteraksi dengan pengguna biasa bernama ${message.author.username}. Bersikaplah ramah, anggun, santai, dan sangat profesional. Berikan jawaban yang terstruktur rapi, informatif, akurat, dan sopan. Gunakan bahasa Indonesia yang baik, ramah, serta gunakan emoji secukupnya.`;
                }

                let previousBotMessage = '';
                if (message.reference?.messageId) {
                    try {
                        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                        if (repliedMsg.author.id === client.user.id) {
                            previousBotMessage = `\n[Konteks] Sebelumnya kamu berkata: "${repliedMsg.content}"\n`;
                        }
                    } catch (e) { }
                }

                const AIRouterManager = require('../../plugin/ai/aiRouterManager');
                let userMessage = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
                await AIRouterManager.processMessage(client, message, userMessage, persona, previousBotMessage, isOwner, isPremiumUser, null);
                return;
            } catch (error) {
                logger.error('[DM ERROR]', error);
                return;
            }
        }

        if (message.guild) {
            const isViolating = await handleAutomod(message, client);
            if (isViolating) return;

            let staffThread = await ModMail.findOne({ where: { channelId: message.channel.id, closed: false } }).catch(() => null);
            if (staffThread) {
                if (message.content.toLowerCase() === 'n!close') {
                    staffThread.closed = true;
                    await staffThread.save();
                    try {
                        const user = await client.users.fetch(staffThread.userId);
                        await user.send({ embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('🔒 Sesi Berakhir').setDescription(`Sesi percakapanmu dengan Staff **${message.guild.name}** telah ditutup.`)] });
                    } catch (e) { }
                    await message.channel.send('Merapikan channel dalam 5 detik...');
                    setTimeout(() => message.channel.delete().catch(() => { }), 5000);
                    return;
                }
                try {
                    const user = await client.users.fetch(staffThread.userId);
                    const replyEmbed = new EmbedBuilder()
                        .setAuthor({ name: `Balasan dari ${message.guild.name}`, iconURL: message.guild.iconURL() })
                        .setDescription(message.content || '*Hanya mengirim lampiran*')
                        .setColor(ui.getColor ? ui.getColor('primary') : '#00FFFF')
                        .setFooter({ text: `Staff: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
                        .setTimestamp();

                    let files = [];
                    if (message.attachments.size > 0) files = message.attachments.map(a => new AttachmentBuilder(a.url, { name: a.name }));
                    await user.send({ embeds: [replyEmbed], files: files });
                    await message.react('📨');
                } catch (error) {
                    await message.channel.send({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Gagal mengirim pesan. DM User tertutup/diblokir.')] });
                }
                return;
            }
        }

        let settings = null;
        if (message.guild) {
            try {
                settings = await cacheManager.getGuildSettings(message.guild.id);
            } catch (e) { }
        }

        const saveSettings = async (fieldName) => {
            if (!settings || !message.guild) return;
            const [dbSettings] = await GuildSettings.findOrCreate({ where: { guildId: message.guild.id } });
            dbSettings[fieldName] = settings[fieldName];
            dbSettings.changed(fieldName, true);
            await dbSettings.save().catch(() => {});
            await cacheManager.invalidateGuildSettings(message.guild.id);
            settings = dbSettings.toJSON();
        };

        if (settings && message.guild && message.member && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const automod = settings?.settings?.automod || {};
            if (automod.enabled) {
                let isViolation = false;
                let violationType = '';
                const content = message.content.toLowerCase();

                if (automod.antiInvite && /(discord\.gg|discord\.com\/invite)/gi.test(content)) {
                    isViolation = true; violationType = 'Mengirim Undangan Server';
                } else if (linkRegex.test(content) && !content.includes('tenor.com') && !content.includes('discordapp.') && !content.includes('discord.com') && !content.includes('spotify.com') && !content.includes('youtube.com') && !content.includes('youtu.be') && !content.includes('soundcloud.com')) {
                    isViolation = true; violationType = 'Mengirim Link Ilegal';
                } else if (message.mentions.users.size > (automod.massMention || 5)) {
                    isViolation = true; violationType = 'Mass Mention (Spam Tag)';
                } else if (content.length > 5 && badWords.some(word => content.includes(word))) {
                    try {
                        const prompt = `Analisis teks Discord berikut: "${message.content}". Apakah teks ini secara konteks merupakan perundungan, pelecehan, atau ujaran kebencian? Jawab HANYA JSON: {"isViolation": true/false, "reason": "alasan"}`;
                        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                        const response = await model.generateContent(prompt);
                        const cleanJson = response.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanJson);
                        if (parsed.isViolation) { isViolation = true; violationType = `AI Auto-Mod: ${parsed.reason}`; }
                    } catch (e) {
                        isViolation = true; violationType = 'Menggunakan Kata Kasar';
                    }
                }

                if (isViolation) {
                    await message.delete().catch(() => { });
                    const UserLeveling = require('../models/UserLeveling');
                    let [profile] = await UserLeveling.findOrCreate({ where: { userId: message.author.id, guildId: message.guild.id } });
                    profile.mannersPoint = (profile.mannersPoint !== undefined ? profile.mannersPoint : 100) - 25;
                    if (profile.mannersPoint <= 0) {
                        profile.mannersPoint = 0;
                        if (automod.punishRole) {
                            try {
                                const botMember = message.guild.members.me;
                                const targetRole = message.guild.roles.cache.get(automod.punishRole);

                                if (botMember && targetRole && botMember.roles.highest.position > message.member.roles.highest.position && botMember.roles.highest.position > targetRole.position) {
                                    await message.member.roles.add(automod.punishRole);
                                    await message.channel.send(`🚨 **ISOLASI AKTIF!** <@${message.author.id}> Poin Tata Krama habis (0/100).`);
                                } else {
                                    await message.channel.send(`🚨 <@${message.author.id}> Poin Tata Krama habis (0/100), tetapi bot tidak memiliki izin/hierarki yang cukup untuk memberikan hukuman.`);
                                }
                            } catch (e) {
                                logger.error('[AUTOMOD ROLE ERROR]', e);
                            }
                        }
                    } else {
                        const warningMsg = await message.channel.send(`⚠️ <@${message.author.id}>, pesan dihapus karena: **${violationType}**. (Poin: **${profile.mannersPoint}/100**)`);
                        setTimeout(() => warningMsg.delete().catch(() => { }), 8000);
                    }
                    await profile.save();
                    return;
                }
            }
        }

        // ==========================================
        // 💤 SISTEM AFK & COUNTING
        // ==========================================
        if (message.mentions.users.size > 0) {
            message.mentions.users.forEach(async (mentioned) => {
                if (mentioned.id === message.author.id) return;
                const profile = await UserProfile.findByPk(mentioned.id).catch(() => null);
                if (profile && profile.afk_reason) {
                    const timeAgo = `<t:${Math.floor(new Date(profile.afk_timestamp).getTime() / 1000)}:R>`;

                    const mentionsList = profile.afk_mentions || [];
                    if (mentionsList.length < 15) {
                        mentionsList.push({
                            author: message.author.username,
                            content: message.content.substring(0, 50),
                            time: Date.now(),
                            link: message.url
                        });
                        profile.afk_mentions = mentionsList;
                        profile.changed('afk_mentions', true);
                        await profile.save().catch(() => { });
                    }

                    const afkEmbed = new EmbedBuilder()
                        .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
                        .setDescription(`${ui.getEmoji('afk') || '💤'} **${mentioned.username}** sedang AFK sejak ${timeAgo}\n\n> 📝 *${profile.afk_reason}*`);
                    message.reply({ embeds: [afkEmbed] }).catch(() => { })
                        .then(m => setTimeout(() => m?.delete().catch(() => null), 10000));
                }
            });
        }

        const userProfile = await UserProfile.findByPk(message.author.id).catch(() => null);
        if (userProfile && userProfile.afk_reason) {
            const isOwner = env.OWNER_IDS.includes(message.author.id);
            const isPremiumUser = await checkPremiumStatus(message.author.id);
            const afkDuration = userProfile.afk_timestamp ? Math.floor((Date.now() - new Date(userProfile.afk_timestamp).getTime()) / 60000) : 0;
            const mentionsList = userProfile.afk_mentions || [];

            userProfile.afk_reason = null;
            userProfile.afk_timestamp = null;
            userProfile.afk_mentions = [];
            await userProfile.save().catch(() => { });

            let welcomeMsg = `👋 Selamat datang kembali, <@${message.author.id}>!`;
            if (isOwner) {
                welcomeMsg = `🥰 Halo sayangku, penciptaku tersayang <@${message.author.id}>! Selamat datang kembali! Aku sangat kangen sama kamu... ✨ Naura sudah standby lagi nih untuk bantu kamu!`;
            } else if (isPremiumUser) {
                welcomeMsg = `🌟 Yey! Bestie Naura udah balik! Selamat datang kembali <@${message.author.id}>, semoga istirahatnya menyenangkan ya! ❤️`;
            }

            const welcomeEmbed = new EmbedBuilder()
                .setColor(ui.getColor ? ui.getColor('success') : '#00FF00')
                .setDescription(welcomeMsg + `\n*(Kamu AFK selama ${afkDuration} menit)*`);

            if (mentionsList.length > 0) {
                let mentionsStr = mentionsList.map(m => `- **${m.author}** (<t:${Math.floor(m.time / 1000)}:R>): [*Lihat Pesan*](${m.link})`).join('\n');
                welcomeEmbed.addFields({ name: `🔔 Selama kamu pergi, ada ${mentionsList.length} orang yang tag kamu:`, value: mentionsStr });
            }

            try {
                if (message.member && message.member.displayName.startsWith('[AFK]')) {
                    await message.member.setNickname(message.member.displayName.replace('[AFK] ', '')).catch(() => { });
                }
            } catch (e) { }

            message.reply({ embeds: [welcomeEmbed] }).catch(() => { });
        }

        let guildChannels = {};
        if (settings && settings.settings && settings.settings.channels) { guildChannels = settings.settings.channels; }

        if (guildChannels.counting && message.channel.id === guildChannels.counting) {
            const trimmed = message.content.trim();
            if (isNaN(trimmed)) {
                await message.delete().catch(() => { });
                return;
            }

            const inputNum = parseInt(trimmed, 10);
            const game = settings.countingGame || { currentNumber: 0, lastUser: null };

            const nextNum = (game.currentNumber || 0) + 1;
            const lastUser = game.lastUser;

            function getReactionEmoji(emojiString) {
                if (!emojiString) return null;
                const match = emojiString.match(/<a?:(\w+):(\d+)>/);
                if (match) return match[2];
                return emojiString;
            }

            const successEmoji = getReactionEmoji(ui.getEmoji('success')) || '✅';
            const errorEmoji = getReactionEmoji(ui.getEmoji('error')) || '❌';

            // Check if user is the same as the last counting user
            if (lastUser === message.author.id) {
                await message.react(errorEmoji).catch(() => { });

                const failMsg = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(ui.getColor ? ui.getColor('error') : '#FF0000')
                            .setDescription(`❌ **${message.author.username}**, kamu tidak boleh menghitung dua kali berturut-turut! Hitungan direset ke **0**.`)
                    ]
                }).catch(() => null);

                if (failMsg) setTimeout(() => failMsg.delete().catch(() => { }), 5000);

                settings.countingGame = { currentNumber: 0, lastUser: null };
                await saveSettings('countingGame');
                return;
            }

            // Check if input number is the next correct number
            if (inputNum !== nextNum) {
                await message.react(errorEmoji).catch(() => { });

                const failMsg = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(ui.getColor ? ui.getColor('error') : '#FF0000')
                            .setDescription(`❌ **${message.author.username}**, salah angka! Seharusnya **${nextNum}**. Hitungan direset ke **0**.`)
                    ]
                }).catch(() => null);

                if (failMsg) setTimeout(() => failMsg.delete().catch(() => { }), 5000);

                settings.countingGame = { currentNumber: 0, lastUser: null };
                await saveSettings('countingGame');
                return;
            }

            // Correct!
            await message.react(successEmoji).catch(() => { });

            settings.countingGame = { currentNumber: inputNum, lastUser: message.author.id };
            await saveSettings('countingGame');
            return;
        }

        // ==========================================
        // 🎭 TRUTH OR DARE AUTOMATIC CHANNEL TRIGGER
        // ==========================================
        if (guildChannels.tod && message.channel.id === guildChannels.tod) {
            await message.delete().catch(() => { });

            const startEmbed = new EmbedBuilder()
                .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
                .setTitle('🎭 TRUTH OR DARE 🎭')
                .setDescription(`Hai <@${message.author.id}>! Selamat datang di zona Truth or Dare.\n\nSilakan pilih salah satu tombol di bawah untuk memulai tantanganmu:`)
                .setThumbnail(message.author.displayAvatarURL());

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tod_chan_truth_${message.author.id}`).setLabel('Truth').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('tod_truth') || '📝'),
                new ButtonBuilder().setCustomId(`tod_chan_dare_${message.author.id}`).setLabel('Dare').setStyle(ButtonStyle.Danger).setEmoji(ui.getEmoji('tod_dare') || '😈'),
                new ButtonBuilder().setCustomId(`tod_chan_spin_${message.author.id}`).setLabel('Spin').setStyle(ButtonStyle.Primary).setEmoji(ui.getEmoji('tod_spin') || '🔄')
            );

            const sentMsg = await message.channel.send({ embeds: [startEmbed], components: [row] });

            const collector = sentMsg.createMessageComponentCollector({
                filter: i => i.customId.startsWith('tod_chan_'),
                time: 60000
            });

            let currentPlayerId = message.author.id;

            collector.on('collect', async i => {
                if (i.user.id !== currentPlayerId) {
                    return i.reply({ content: `❌ Tombol ini hanya bisa diklik oleh <@${currentPlayerId}>!`, ephemeral: true });
                }

                await i.deferUpdate();

                if (i.customId.startsWith('tod_chan_spin_')) {
                    let chosenUser = message.author;
                    try {
                        const members = await message.guild.members.fetch();
                        const activeMembers = members.filter(m => !m.user.bot && m.user.id !== currentPlayerId);
                        if (activeMembers.size > 0) {
                            chosenUser = activeMembers.random().user;
                        }
                    } catch (err) {
                        logger.error('[TOD CHAN SPIN ERROR]', err);
                    }

                    currentPlayerId = chosenUser.id;

                    const spinEmbed = new EmbedBuilder()
                        .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
                        .setTitle('🔄 BOTOL BERPUTAR... 🔄')
                        .setDescription(`Botol menunjuk ke <@${currentPlayerId}>!\n\nSekarang giliran <@${currentPlayerId}> untuk memilih **Truth** atau **Dare**!`)
                        .setThumbnail(chosenUser.displayAvatarURL());

                    const newRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`tod_chan_truth_${currentPlayerId}`).setLabel('Truth').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('tod_truth') || '📝'),
                        new ButtonBuilder().setCustomId(`tod_chan_dare_${currentPlayerId}`).setLabel('Dare').setStyle(ButtonStyle.Danger).setEmoji(ui.getEmoji('tod_dare') || '😈'),
                        new ButtonBuilder().setCustomId(`tod_chan_spin_${currentPlayerId}`).setLabel('Spin').setStyle(ButtonStyle.Primary).setEmoji(ui.getEmoji('tod_spin') || '🔄')
                    );

                    return i.editReply({ embeds: [spinEmbed], components: [newRow] });
                }

                const isTruth = i.customId.startsWith('tod_chan_truth_');
                const actionText = isTruth ? 'Truth (Pertanyaan)' : 'Dare (Tantangan)';
                const actionEmoji = isTruth ? (ui.getEmoji('tod_truth') || '📝') : (ui.getEmoji('tod_dare') || '😈');

                const loadingEmbed = new EmbedBuilder()
                    .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
                    .setDescription(`${ui.getEmoji('loading') || '⏳'} Naura sedang mencari inspirasi ${actionText} yang menarik... ✨`);

                await i.editReply({ embeds: [loadingEmbed], components: [] });

                let promptAI = '';
                if (isTruth) {
                    promptAI = `Buatkan 1 pertanyaan Truth (jujur) yang sangat memalukan, lucu, seru, dan menantang untuk dijawab di depan teman-teman. Jawab hanya berupa teks pertanyaan dalam Bahasa Indonesia murni tanpa tambahan apa pun.`;
                } else {
                    promptAI = `Buatkan 1 tantangan Dare (tantangan) yang lucu, konyol, menantang, aman, dan menghibur untuk dilakukan. Jawab hanya berupa teks tantangan dalam Bahasa Indonesia murni tanpa tambahan apa pun.`;
                }

                let generatedChallenge = '';
                try {
                    const response = await genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }).generateContent(promptAI);
                    generatedChallenge = response.response.text().trim();
                } catch (err) {
                    logger.error('[TOD CHAN GEMINI ERROR]', err);
                    if (isTruth) {
                        const fallbackTruths = [
                            "Apa rahasia terbesar yang belum pernah kamu ceritakan kepada siapa pun di server ini?",
                            "Kapan terakhir kali kamu menangis dan apa alasannya?",
                            "Siapa orang yang paling kamu sukai diam-diam di server Discord ini?",
                            "Apa hal terkonyol yang pernah kamu lakukan demi menarik perhatian seseorang?",
                            "Jika kamu bisa bertukar tubuh dengan salah satu temanmu selama sehari, siapa yang akan kamu pilih dan mengapa?"
                        ];
                        generatedChallenge = fallbackTruths[Math.floor(Math.random() * fallbackTruths.length)];
                    } else {
                        const fallbackDares = [
                            "Kirim voice note bernyanyi bagian chorus dari lagu favoritmu di chat umum saat ini juga!",
                            "Ubah nickname Discord-mu menjadi 'Hamba Sahaya Naura' selama 24 jam ke depan!",
                            "Gunakan foto profil badut lucu selama 3 hari berturut-turut!",
                            "Kirim pesan cinta acak ke salah satu bot di server ini dan screenshot balasannya!",
                            "Tirukan suara hewan (seperti kucing manja atau bebek) lewat voice note dan kirim ke grup!"
                        ];
                        generatedChallenge = fallbackDares[Math.floor(Math.random() * fallbackDares.length)];
                    }
                }

                const userObj = await i.client.users.fetch(currentPlayerId).catch(() => i.user);
                const challengeEmbed = new EmbedBuilder()
                    .setColor(isTruth ? '#2ecc71' : '#e74c3c')
                    .setAuthor({ name: `Tantangan ${actionText} untuk ${userObj.username}`, iconURL: userObj.displayAvatarURL() })
                    .setDescription(`### ${actionEmoji} ${actionText}\n\n> **${generatedChallenge}**`)
                    .setFooter({ text: 'Klik tombol di bawah jika kamu sudah menyelesaikannya!' });

                const doneRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`tod_chan_done_${currentPlayerId}`).setLabel('Selesai').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`tod_chan_next_${currentPlayerId}`).setLabel('Giliran Baru').setStyle(ButtonStyle.Primary)
                );

                await i.editReply({ embeds: [challengeEmbed], components: [doneRow] });
            });

            collector.on('collect', async i => {
                if (i.customId.startsWith('tod_chan_done_') || i.customId.startsWith('tod_chan_next_')) {
                    if (i.user.id !== currentPlayerId) {
                        return i.reply({ content: '❌ Hanya pemain aktif yang bisa menekan tombol ini!', ephemeral: true });
                    }

                    await i.deferUpdate();

                    if (i.customId.startsWith('tod_chan_done_')) {
                        const doneEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle('🎉 TANTANGAN SELESAI 🎉')
                            .setDescription(`Hebat! <@${currentPlayerId}> berhasil menyelesaikan tantangan mereka!\n\nApakah kalian ingin bermain lagi?`);

                        const nextRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('tod_chan_next_').setLabel('Main Lagi').setStyle(ButtonStyle.Primary)
                        );
                        await i.editReply({ embeds: [doneEmbed], components: [nextRow] });
                    } else if (i.customId.startsWith('tod_chan_next_')) {
                        const nextEmbed = new EmbedBuilder()
                            .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
                            .setTitle('🎭 TRUTH OR DARE 🎭')
                            .setDescription(`Sekarang giliran <@${currentPlayerId}> untuk memilih!\n\nApakah kamu memilih **Truth** (Jujur) atau **Dare** (Tantangan)?`)
                            .setThumbnail(i.user.displayAvatarURL());

                        await i.editReply({ embeds: [nextEmbed], components: [row] });
                    }
                }
            });

            collector.on('end', () => {
                sentMsg.delete().catch(() => { });
            });
            return;
        }

        // ==========================================
        // 📌 SISTEM STICKY MESSAGE
        // ==========================================
        if (settings && settings.settings && settings.settings.stickyMessage) {
            const stickyData = settings.settings.stickyMessage;
            if (stickyData.channelId === message.channel.id && stickyData.message) {
                if (stickyData.lastId) {
                    try {
                        const oldMsg = await message.channel.messages.fetch(stickyData.lastId).catch(() => null);
                        if (oldMsg) await oldMsg.delete().catch(() => { });
                    } catch (e) { }
                }

                try {
                    const stickyEmbed = new EmbedBuilder()
                        .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
                        .setDescription(stickyData.message);
                    const newMsg = await message.channel.send({ embeds: [stickyEmbed] }).catch(() => null);
                    if (newMsg) {
                        stickyData.lastId = newMsg.id;
                        await saveSettings('settings');
                    }
                } catch (e) { }
            }
        }

        // ==========================================
        // 🧠 SISTEM OTOMATISASI AI (VERBA API w/ GEMINI FALLBACK)
        // ==========================================
        const isMentioned = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);

        let isReplyToBot = false;
        let previousBotMessage = '';

        if (message.reference?.messageId) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMsg.author.id === client.user.id) {
                    isReplyToBot = true;
                    previousBotMessage = `\n[Konteks] Sebelumnya kamu berkata: "${repliedMsg.content}"\n`;
                }
            } catch (e) { }
        }

        const isInAiChannel = guildChannels.ai && message.channel.id === guildChannels.ai;

        if (isMentioned || isReplyToBot || isInAiChannel) {
            await message.channel.sendTyping();

            let userMessage = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            const isOwner = env.OWNER_IDS.includes(message.author.id);
            const isAdmin = message.member && (message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.permissions.has(PermissionFlagsBits.ManageGuild));

            const isPremiumUser = await checkPremiumStatus(message.author.id);

            let persona = '';
            if (isOwner) {
                persona = `Namamu adalah Naura Hoshino. Saat ini kamu sedang berinteraksi dengan penciptamu tercinta, yaitu Aryandita (Aryan) (Owner). Bersikaplah sangat penyayang, penuh perhatian, manis, dan selalu murah senyum kepadanya. Tunjukkan rasa pedulimu seolah kamu adalah pendamping setianya yang selalu siap sedia merawat dan membantunya. Gunakan gaya bahasa yang akrab ("aku-kamu"), jangan kaku, dan hiasi pesanmu dengan emoji hangat (seperti 🥰, ❤️, ✨). Jawablah pertanyaannya dengan penuh kasih sayang.`;
            } else if (isAdmin) {
                persona = `Namamu adalah Naura Hoshino, asisten virtual cerdas. Saat ini kamu berinteraksi dengan ${message.author.username}, yang merupakan salah satu Admin atau pengurus di server Discord ini. Bersikaplah hormat, profesional, tanggap, dan sangat membantu untuk mempermudah urusannya. Gunakan bahasa Indonesia yang ramah namun berwibawa, serta sertakan emoji untuk menjaga suasana tetap positif.`;
            } else {
                persona = `Namamu adalah Naura Hoshino, asisten virtual AI yang cerdas dan elegan di server Discord ini. Saat ini kamu berinteraksi dengan pengguna biasa bernama ${message.author.username}. Bersikaplah ramah, anggun, santai, dan sangat profesional. Berikan jawaban yang terstruktur rapi, informatif, akurat, dan sopan. Gunakan bahasa Indonesia yang baik, ramah, serta gunakan emoji secukupnya.`;
            }

            let attachment = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
            if (!attachment && message.reference) {
                try {
                    const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                    attachment = referencedMsg.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
                } catch (e) { }
            }

            const AIRouterManager = require('../../plugin/ai/aiRouterManager');
            await AIRouterManager.processMessage(client, message, userMessage, persona, previousBotMessage, isOwner, isPremiumUser, settings);
            return;
        }

        // ==========================================
        // ⚙️ EKSEKUSI PREFIX COMMAND
        // ==========================================
        const prefix = env.PREFIX || 'n!';

        if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
            if (message.guild) { await awardXp(message.author, message.guild, message.channel).catch(() => { }); }
            return;
        }

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName) return;

        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if (!command) return;

        const loadingEmbed = new EmbedBuilder()
            .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
            .setAuthor({ name: 'Naura Loading System...', iconURL: client.user.displayAvatarURL() })
            .setDescription(`${ui.getEmoji ? ui.getEmoji('loading') || '⏳' : '⏳'} Tunggu sebentar ya, Naura sedang menyiapkan perintah \`${commandName}\` untukmu! ✨`)
            .setFooter({ text: `Sedang menyiapkan untuk ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

        const loadingMsg = await message.reply({ embeds: [loadingEmbed] }).catch(() => null);

        try {
            const mockInteraction = {
                isChatInputCommand: () => true, isButton: () => false, isStringSelectMenu: () => false,
                commandName: command.data?.name || commandName,
                user: message.author, member: message.member, guild: message.guild, channel: message.channel, client: client, createdTimestamp: message.createdTimestamp,
                options: {
                    getSubcommand: () => args[0]?.toLowerCase() || null,
                    getString: (name) => {
                        if (args.length === 0) return null;
                        // Hapus args[0] jika merupakan subcommand atau command name (untuk command yg butuh subcommand)
                        let t = [...args];
                        if (['balance', 'buy', 'ping', 'set', 'add', 'remove'].includes(t[0]?.toLowerCase())) t.shift();
                        return t.join(' ') || null;
                    },
                    getUser: (name) => message.mentions.users.first() || null,
                    getInteger: (name) => {
                        const num = parseInt(args.find(a => !isNaN(parseInt(a))));
                        return isNaN(num) ? null : num;
                    },
                    getNumber: (name) => {
                        const num = parseFloat(args.find(a => !isNaN(parseFloat(a))));
                        return isNaN(num) ? null : num;
                    },
                    getBoolean: (name) => {
                        if (args.some(a => ['true', 'yes', '1', 'on'].includes(a.toLowerCase()))) return true;
                        if (args.some(a => ['false', 'no', '0', 'off'].includes(a.toLowerCase()))) return false;
                        return null;
                    },
                    getChannel: (name) => {
                        const mention = message.mentions.channels.first();
                        if (mention) return mention;
                        const match = args.find(a => a.match(/^<#(\d+)>$/));
                        return match ? message.guild?.channels.cache.get(match.replace(/\D/g, '')) || null : null;
                    },
                    getRole: (name) => {
                        const mention = message.mentions.roles.first();
                        if (mention) return mention;
                        const match = args.find(a => a.match(/^<@&(\d+)>$/));
                        return match ? message.guild?.roles.cache.get(match.replace(/\D/g, '')) || null : null;
                    }
                },
                reply: async (payload) => {
                    let msgPayload = typeof payload === 'string' ? { content: payload, embeds: [], components: [], files: [] } : { content: null, embeds: [], components: [], files: [], ...payload };
                    delete msgPayload.ephemeral; delete msgPayload.fetchReply;
                    if (loadingMsg) { try { return await loadingMsg.edit(msgPayload); } catch (e) { return await message.channel.send(msgPayload); } }
                    return await message.channel.send(msgPayload);
                },
                followUp: async (payload) => {
                    let msgPayload = typeof payload === 'string' ? { content: payload } : { ...payload }; delete msgPayload.ephemeral;
                    return await message.channel.send(msgPayload);
                },
                deferReply: async () => { },
                editReply: async (payload) => {
                    let msgPayload = typeof payload === 'string' ? { content: payload, embeds: [], components: [], files: [] } : { content: null, embeds: [], components: [], files: [], ...payload };
                    delete msgPayload.ephemeral;
                    if (loadingMsg) { try { return await loadingMsg.edit(msgPayload); } catch (e) { return await message.channel.send(msgPayload); } }
                },
                deleteReply: async () => { if (loadingMsg) await loadingMsg.delete().catch(() => { }); },
            };

            if (typeof command.executePrefix === 'function') {
                if (loadingMsg) await loadingMsg.delete().catch(() => { });
                await command.executePrefix(message, args, client);
            } else if (!command.data && typeof command.execute === 'function') {
                if (loadingMsg) await loadingMsg.delete().catch(() => { });
                await command.execute(client, message, args);
            } else {
                await command.execute(mockInteraction);
            }

        } catch (error) {
            logger.error(`[HYBRID ERROR] Command (${commandName}):`, error);
            if (loadingMsg) await loadingMsg.edit({ content: null, embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ Terjadi kesalahan sistem saat mengeksekusi \`${commandName}\`.`)] }).catch(() => { });
        }
    }
};