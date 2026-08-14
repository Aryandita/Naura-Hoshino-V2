"use strict";

const redisManager = require("../managers/redisManager");
const cacheManager = require("../managers/cacheManager");

const NSF_PER_MINUTE = 1;

async function handleVoiceState(oldState, newState) {
  if (!redisManager.isReady) return;
  if (newState.member?.user?.bot) return;

  const userId = newState.member?.id;
  const guildId = newState.guild?.id;
  if (!userId || !guildId) return;

  const redisKey = `voice:active:${guildId}:${userId}`;

  const joinedChannel = !oldState.channelId && newState.channelId;
  const leftChannel = oldState.channelId && !newState.channelId;
  const switchedChannel =
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId;
  const stateChanged =
    oldState.selfMute !== newState.selfMute ||
    oldState.selfDeaf !== newState.selfDeaf;

  // User is AFK if they are muted AND deafened, or server muted/deafened
  const isAfk =
    newState.selfDeaf ||
    newState.serverDeaf ||
    (newState.selfMute && newState.serverMute);

  if (
    joinedChannel ||
    (switchedChannel && !isAfk) ||
    (stateChanged && !isAfk)
  ) {
    // Start or restart tracking
    const now = Date.now();
    await redisManager.setCache(redisKey, now, 24 * 60 * 60 * 1000); // Max tracking 24 hours
  } else if (leftChannel || (stateChanged && isAfk)) {
    // Stop tracking and reward
    const joinTime = await redisManager.getCache(redisKey);
    if (joinTime) {
      await redisManager.client.del(redisKey);
      const durationMs = Date.now() - joinTime;
      const minutes = Math.floor(durationMs / 60000);

      if (minutes >= 1) {
        // Reward user
        const nsfReward = minutes * NSF_PER_MINUTE;

        await cacheManager.incrementUserSurvival(
          userId,
          "starFragments",
          nsfReward,
        );
      }
    }
  }
}

module.exports = {
  handleVoiceState,
};
