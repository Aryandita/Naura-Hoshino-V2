const { EmbedBuilder } = require('discord.js');
const ui = require('../config/ui');
const nauraExpression = require('./nauraExpression');

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

        // Lampiran gambar ekspresi. EmbedBuilder tidak bisa membawa file sendiri,
        // jadi disimpan di sini dan diambil lewat getFiles() saat mengirim pesan.
        this._files = [];
        this._expression = null;
    }

    /**
     * Pasang wajah Naura pada embed ini.
     *
     * @param {string} nameOrMood - Nama ekspresi ('Cheers') atau mood ('success', 'afk')
     * @param {{ as?: 'thumbnail'|'image'|'author', authorName?: string }} [options]
     * @returns {this}
     *
     * @example
     * const embed = new SuccessEmbed().withExpression('success').setDescription('Beres!');
     * await interaction.reply({ embeds: [embed], files: embed.getFiles() });
     */
    withExpression(nameOrMood, options = {}) {
        const { files, expression } = nauraExpression.decorate(this, nameOrMood, options);
        if (files.length > 0) {
            this._files.push(...files);
            this._expression = expression;
        }
        return this;
    }

    /** Lampiran yang perlu ikut dikirim bersama embed ini. */
    getFiles() {
        return this._files;
    }

    /** Nama ekspresi yang sedang terpasang, atau null. */
    getExpression() {
        return this._expression;
    }

    /**
     * Payload siap kirim: embed beserta lampirannya.
     * @example await interaction.reply(embed.toPayload());
     */
    toPayload(extra = {}) {
        return { embeds: [this], files: this._files, ...extra };
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

// Warna dibedakan supaya kontrasnya terasa dan pengguna langsung paham nadanya.
// Nilai diambil dari ui.colors bila tersedia, dengan cadangan yang tetap serasi
// dengan palet pastel Naura.

class SuccessEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.colors.success || '#00FF00');
    }
}

class ErrorEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.colors.error || '#FF0000');
    }
}

class WarnEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.colors.warning || '#FFB347');
    }
}

class InfoEmbed extends NauraEmbedBuilder {
    constructor(data) {
        super(data);
        this.setColor(ui.colors.info || '#57C7FF');
    }
}

module.exports = {
    NauraEmbedBuilder,
    SuccessEmbed,
    ErrorEmbed,
    WarnEmbed,
    InfoEmbed
};
