const { Collection } = require('discord.js');
const { logger } = require('../../managers/logger');
const UserLeveling = require('../../models/UserLeveling');
const { checkLevelUp } = require('../../../plugin/leveling/leveling');

// Cache session in memory
const voiceSessions = new Collection();

module.exports = {
    name: 'voiceXp',
    async execute(oldState, newState, client) {
        const { member, guild } = newState;
        if (!member || member.user.bot) return;

        const userId = member.id;
        const guildId = guild.id;

        // ==========================================
        // 📈 SISTEM VOICE XP TRACKING
        // ==========================================
        if (!oldState.channelId && newState.channelId) {
            voiceSessions.set(`${guildId}-${userId}`, Date.now());
        }

        if (oldState.channelId && !newState.channelId) {
            const joinTime = voiceSessions.get(`${guildId}-${userId}`);
            if (joinTime) {
                const durationMinutes = Math.floor((Date.now() - joinTime) / 60000);
                if (durationMinutes >= 1) {
                    try {
                        const [profile] = await UserLeveling.findOrCreate({ where: { userId, guildId } });

                        await UserLeveling.increment(
                            { xp: durationMinutes * 10, voiceMinutes: durationMinutes },
                            { where: { userId, guildId } }
                        );
                        await profile.reload();

                        const guildObj = oldState.guild || newState.guild;
                        const memberObj = oldState.member || newState.member;
                        const channelObj = oldState.channel || newState.channel;
                        if (guildObj && memberObj && channelObj) {
                            await checkLevelUp(profile, memberObj.user, guildObj, channelObj);
                        }
                    } catch (err) {
                        logger.error('[VOICE XP ERROR]', err);
                    }
                }
                voiceSessions.delete(`${guildId}-${userId}`);
            }
        }
    }
};
