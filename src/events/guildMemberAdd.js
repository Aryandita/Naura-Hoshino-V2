const { Events } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');
const StickyRole = require('../models/StickyRole');
const cacheManager = require('../managers/cacheManager');
const { logger } = require('../managers/logger');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        if (member.user.bot) return;

        try {
            const settings = await cacheManager.getGuildSettings(member.guild.id);
            if (!settings || !settings.settings) return;

            // 1. AutoRole
            if (settings.settings.autoRole) {
                const roleId = settings.settings.autoRole;
                const role = member.guild.roles.cache.get(roleId);

                if (role && role.position < member.guild.members.me.roles.highest.position) {
                    await member.roles.add(role).catch(err => logger.warn(`[AutoRole] Failed to add role to ${member.user.tag}: ${err.message}`));
                }
            }

            // 2. Sticky Roles
            if (settings.settings.sticky_roles) {
                const stickyData = await StickyRole.findOne({
                    where: { guildId: member.guild.id, userId: member.user.id }
                });

                if (stickyData) {
                    const savedRoles = JSON.parse(stickyData.roles);
                    if (savedRoles.length > 0) {
                        const validRoles = savedRoles.filter(id => {
                            const r = member.guild.roles.cache.get(id);
                            return r && r.position < member.guild.members.me.roles.highest.position && !r.managed && r.id !== member.guild.id;
                        });

                        if(validRoles.length > 0) {
                            await member.roles.add(validRoles).catch(err => logger.warn(`[StickyRoles] Failed to add roles: ${err.message}`));
                            logger.info(`[StickyRoles] Restored roles for ${member.user.tag}`);
                        }
                    }
                }
            }

            // 3. Welcomer Greetings
            const greetings = settings.settings.greetings;
            if (greetings && greetings.welcome && greetings.welcome.enabled && greetings.welcome.channelId) {
                const welcomeData = greetings.welcome;
                const channel = member.guild.channels.cache.get(welcomeData.channelId);
                if (channel) {
                    const ui = require('../config/ui');
                    const { generateWelcomeImage } = require('../../plugin/canvas/CanvasUtils');
                    const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

                    let parsedMessage = welcomeData.message || 'Selamat datang {member}!';
                    parsedMessage = parsedMessage
                        .replace(/\{member\}/g, `<@${member.id}>`)
                        .replace(/\{user\}/g, member.user.username)
                        .replace(/\{guild\}/g, member.guild.name)
                        .replace(/\{count\}/g, member.guild.memberCount);

                    parsedMessage = parsedMessage.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, p1) => {
                        const emoji = ui.getEmoji(p1.toLowerCase());
                        return emoji && emoji !== '💠' ? emoji : match;
                    });

                    const embed = new EmbedBuilder()
                        .setColor(welcomeData.color || ui.getColor('welcome'))
                        .setDescription(parsedMessage);

                    const payload = { embeds: [embed] };

                    if (welcomeData.image) {
                        try {
                            const bgUrl = welcomeData.background || ui.getBackground('welcome');
                            const imageBuffer = await generateWelcomeImage(member, 'welcome', ui, bgUrl, welcomeData);
                            const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
                            embed.setImage('attachment://welcome.png');
                            payload.files = [attachment];
                        } catch (err) {
                            logger.error('[Welcomer Image Error]', err);
                        }
                    }

                    await channel.send(payload).catch(err => logger.error('[Welcomer Send Error]', err));
                }
            }
        } catch (error) {
            logger.error(`[Event: GuildMemberAdd] Error: ${error.message}`);
        }
    }
};
