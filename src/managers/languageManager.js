const fs = require('fs');
const { logger } = require('../../src/managers/logger');
const path = require('path');
const UserProfile = require('../models/UserProfile');

class LanguageManager {
    constructor() {
        this.strings = {
            id: {},
            en: {}
        };
        this.loadLanguages();
    }

    loadLanguages() {
        try {
            const langPath = path.join(__dirname, '..', '..', 'language');
            if (fs.existsSync(langPath)) {
                const idPath = path.join(langPath, 'id.json');
                const enPath = path.join(langPath, 'en.json');

                if (fs.existsSync(idPath)) this.strings.id = JSON.parse(fs.readFileSync(idPath, 'utf8'));
                if (fs.existsSync(enPath)) this.strings.en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
                logger.info('[LanguageManager] Languages loaded successfully.');
            }
        } catch (error) {
            logger.error('[LanguageManager] Failed to load language files:', error);
        }
    }

    async getUserLanguage(userId) {
        try {
            const profile = await UserProfile.findOne({ where: { userId } });
            return profile?.language === 'en' ? 'en' : 'id';
        } catch (error) {
            return 'id'; // default
        }
    }

    async translate(userId, key, placeholders = {}) {
        const lang = await this.getUserLanguage(userId);
        let text = this.strings[lang][key] || this.strings['id'][key] || key;

        for (const [placeholder, value] of Object.entries(placeholders)) {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), value);
        }

        return text;
    }

    translateSync(lang, key, placeholders = {}) {
        let text = this.strings[lang][key] || this.strings['id'][key] || key;

        for (const [placeholder, value] of Object.entries(placeholders)) {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), value);
        }

        return text;
    }
}

module.exports = new LanguageManager();
