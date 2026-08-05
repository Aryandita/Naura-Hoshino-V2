// Orkestrator /survival. Definisi command ada di survivalData.js, sedangkan
// interceptor balasan dan objek tiruan prefix ada di survivalContext.js.
const fs = require('fs');
const path = require('path');
const { logger } = require('../../src/managers/logger');
const { safeParseInventory } = require('./inventoryHelper');
const cacheManager = require('../../src/managers/cacheManager');
const ui = require('../../src/config/ui');
const languageManager = require('../../src/managers/languageManager');
const data = require('./survivalData');
const { attachAutoDelete, createMockInteraction } = require('./survivalContext');

// Pemuat dinamis untuk seluruh subcommand di folder subcommands/.
const subcommands = new Map();
const subCommandFiles = fs.readdirSync(path.join(__dirname, 'subcommands')).filter(file => file.endsWith('.js'));
for (const file of subCommandFiles) {
    const subCmd = require(`./subcommands/${file}`);
    subcommands.set(file.replace('.js', ''), subCmd);
}

// Alias perintah prefix.
const ALIAS_MAP = {
    'w': 'work', 'f': 'fish', 'm': 'mine', 'c': 'chop',
    'i': 'inventory', 'inv': 'inventory', 'bag': 'inventory',
    'stat': 'info', 'profile': 'info',
    'hunt': 'dungeon', 'store': 'shop'
};

module.exports = {
    data,

    async execute(interaction) {
        const subCommandName = interaction.options.getSubcommand();
        const cmd = subcommands.get(subCommandName);

        attachAutoDelete(interaction);

        // Defer secepatnya supaya tidak kena "didn't respond in time".
        await interaction.deferReply().catch(() => {});

        // Pastikan bahasa pilihan user sudah berada di cache sebelum teks dibangun,
        // sehingga balasan pertama pun sudah memakai bahasa yang benar.
        const lang = typeof interaction.fetchLang === 'function'
            ? await interaction.fetchLang()
            : interaction.localeLang;

        // Pengecekan pendaftaran (starter kit).
        if (subCommandName !== 'start') {
            const profile = await cacheManager.getUserProfile(interaction.user.id);
            const inv = safeParseInventory(profile.inventory);
            const hasStarted = inv.some(item => item && item.id === 'survival_started');

            if (!hasStarted) {
                return ui.sendError(interaction, languageManager.translateSync(lang, 'survival_not_started'), true);
            }
        }

        if (!cmd) {
            return ui.sendError(interaction, languageManager.translateSync(lang, 'survival_not_implemented'), true);
        }

        try {
            await cmd.execute(interaction, interaction.client);
        } catch (error) {
            logger.error(`[Survival] Error executing ${subCommandName}:`, error);
            await ui.sendError(interaction, languageManager.translateSync(lang, 'survival_sys_error'), true);
        }
    },

    // --- DUKUNGAN PREFIX (LEGACY) ---
    async executePrefix(message, args, client) {
        const inputSubCmd = args[0] ? args[0].toLowerCase() : 'info';
        const subCmdName = ALIAS_MAP[inputSubCmd] || inputSubCmd;
        const cmd = subcommands.get(subCmdName);

        const lang = await languageManager.getUserLanguage(message.author.id);
        if (!cmd) return ui.sendError(message, languageManager.translateSync(lang, 'err_sys_27'));

        const mockInteraction = createMockInteraction({ message, client, subCmdName, args });

        try {
            await cmd.execute(mockInteraction, client);
        } catch (error) {
            logger.error(`[Survival Prefix Error] ${subCmdName}:`, error);
            await ui.sendError(message, languageManager.translateSync(lang, 'err_sys_28'));
        }
    }
};
