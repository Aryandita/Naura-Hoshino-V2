const { logger } = require('../../src/managers/logger');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        // Load and execute all voiceStateUpdate handlers dynamically
        const handlersPath = path.join(__dirname, 'voiceStateUpdate');
        if (fs.existsSync(handlersPath)) {
            const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));
            for (const file of handlerFiles) {
                try {
                    const handler = require(path.join(handlersPath, file));
                    if (handler.execute) {
                        await handler.execute(oldState, newState, client);
                    }
                } catch (error) {
                    logger.error(`[VOICESTATEUPDATE HANDLER ERROR] Failed to load/execute ${file}:`, error);
                }
            }
        }
    }
};
