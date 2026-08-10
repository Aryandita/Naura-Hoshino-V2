'use strict';

const { handleVoiceState } = require('../../../plugin/utility/voiceRewards');

module.exports = {
    async execute(oldState, newState, client) {
        try {
            await handleVoiceState(oldState, newState);
        } catch (e) {
            console.error('[VoiceRewards] Error handling voice state:', e);
        }
    }
};
