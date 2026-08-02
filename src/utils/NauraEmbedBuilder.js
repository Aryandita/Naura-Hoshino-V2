const { EmbedBuilder } = require('discord.js');
const ui = require('../config/ui');

/**
 * Custom Embed Builder for Naura Hoshino
 * Provides standard UI/UX aesthetics across the bot.
 */
class NauraEmbedBuilder extends EmbedBuilder {
    constructor(data) {
        super(data);
        // Default visual aesthetics
        this.setColor(ui.getColor('primary'));
        this.setFooter({ text: 'Naura Hoshino created by Aryandita ✨' });
        this.setTimestamp();
    }

    /**
     * Adds a standardized Markdown horizontal rule / divider
     * Can be used to cleanly separate sections.
     * Note: Discord native field dividers don't exist, so we append to description or use empty fields.
     * We return the instance to allow method chaining.
     */
    addDivider() {
        const currentDesc = this.data.description || '';
        this.setDescription(currentDesc ? `${currentDesc}\n\n---\n` : '---\n');
        return this;
    }

    /**
     * Appends a title formatted as a Markdown Header 1 inside the description,
     * following the user's requested layout style.
     */
    addHeader(text) {
        const currentDesc = this.data.description || '';
        this.setDescription(currentDesc ? `${currentDesc}\n# ${text}` : `# ${text}`);
        return this;
    }

    /**
     * Helper to append regular text to the description
     */
    addText(text) {
        const currentDesc = this.data.description || '';
        this.setDescription(currentDesc ? `${currentDesc}\n${text}` : text);
        return this;
    }
}

class SuccessEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.getColor('primary') || '#FFC0CB');
    }
}

class ErrorEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.getColor('primary') || '#FFC0CB');
    }
}

class WarnEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.getColor('primary') || '#FFC0CB');
    }
}

class InfoEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.getColor('primary') || '#FFC0CB');
    }
}

module.exports = {
    NauraEmbedBuilder,
    SuccessEmbed,
    ErrorEmbed,
    WarnEmbed,
    InfoEmbed
};
