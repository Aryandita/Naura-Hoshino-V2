const { Collection } = require("discord.js");
const { logger } = require("../../managers/logger");
const UserLeveling = require("../../models/UserLeveling");
const cacheManager = require("../../managers/cacheManager");
const { getUserPremiumTier, getXpMultiplier } = require("../../premium/premiumHelper");
const { checkLevelUp } = require("../../leveling/levelingEngine");

// Cache session in memory
const voiceSessions = new Collection();

module.exports = {
  name: "voiceXp",
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;
    if (!member || !guild || member.user?.bot) return;

    const userId = member.id;
    const guildId = guild.id;
    const sessionKey = `${guildId}-${userId}`;

    const isAfkChannel = (channelId) =>
      guild.afkChannelId && channelId === guild.afkChannelId;

    const isDeafened = (state) =>
      Boolean(state?.selfDeaf || state?.serverDeaf);

    // Deteksi apakah user dalam status aktif di voice
    const isCurrentlyActive = (state) =>
      Boolean(
        state.channelId &&
          !isAfkChannel(state.channelId) &&
          !isDeafened(state),
      );

    const wasActive = isCurrentlyActive(oldState);
    const nowActive = isCurrentlyActive(newState);

    // ==========================================
    // 📈 SISTEM VOICE XP TRACKING
    // ==========================================
    // 1. User mulai aktif di voice (connect baru, undeafen, atau pindah dari AFK)
    if (!wasActive && nowActive) {
      voiceSessions.set(sessionKey, Date.now());
      return;
    }

    // 2. User berhenti aktif (disconnect, deafen, atau pindah ke AFK channel)
    if (wasActive && !nowActive) {
      const joinTime = voiceSessions.get(sessionKey);
      voiceSessions.delete(sessionKey);

      if (joinTime) {
        const durationMinutes = Math.floor((Date.now() - joinTime) / 60000);
        if (durationMinutes >= 1) {
          try {
            // Hitung multiplier XP berdasarkan status Premium user
            const userProfile = await cacheManager.getUserProfile(userId);
            const tier = getUserPremiumTier(userProfile);
            const multiplier = getXpMultiplier(tier);
            const earnedXp = Math.max(1, Math.floor(durationMinutes * 10 * multiplier));

            const [profile] = await UserLeveling.findOrCreate({
              where: { userId, guildId },
              defaults: { xp: 0, level: 1, messageCount: 0, voiceMinutes: 0, lastActivity: new Date() },
            });

            // Increment dengan safe fallback jika kolom voiceMinutes belum termigrasi
            try {
              await UserLeveling.increment(
                { xp: earnedXp, voiceMinutes: durationMinutes },
                { where: { userId, guildId } },
              );
            } catch (incErr) {
              if (incErr.message && /voiceMinutes/i.test(incErr.message)) {
                logger.warn(
                  `[VOICE XP] Kolom voiceMinutes belum ada di database, increment XP saja (${earnedXp} XP).`,
                );
                await UserLeveling.increment(
                  { xp: earnedXp },
                  { where: { userId, guildId } },
                );
              } else {
                throw incErr;
              }
            }

            await profile.reload().catch(() => {});

            const channelObj =
              newState.channel ||
              oldState.channel ||
              guild.channels.cache.get(newState.channelId || oldState.channelId);

            if (channelObj && member.user) {
              await checkLevelUp(profile, member.user, guild, channelObj);
            }
          } catch (err) {
            logger.error("[VOICE XP ERROR]", err);
          }
        }
      }
    }
  },
};
