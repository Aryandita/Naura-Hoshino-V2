"use strict";

const { handleVoiceState } = require("../../services/voiceRewards");

module.exports = {
  async execute(oldState, newState, client) {
    try {
      await handleVoiceState(oldState, newState);
    } catch (e) {
      console.error("[VoiceRewards] Error handling voice state:", e);
    }
  },
};
