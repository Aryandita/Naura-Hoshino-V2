const { logger } = require('../../../src/managers/logger');
module.exports = {
    async execute(manager, node, error) {
        logger.error(`\x1b[41m\x1b[37m ⚠️ NODE ERROR \x1b[0m Node ${node.name} encountered an error: ${error.message}`);
    }
};