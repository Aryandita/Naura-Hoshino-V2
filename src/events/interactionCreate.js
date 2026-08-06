'use strict';

/**
 * Router interaksi.
 *
 * Berkas ini dulu berisi 900+ baris logika fitur. Sekarang tugasnya hanya satu:
 * menentukan jenis interaksi, mencari penanganya di registry, lalu menyerahkan
 * eksekusinya ke safeExecute.
 *
 * Logika masing-masing tombol, select menu, dan modal ada di src/interactions/.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { logger } = require('../managers/logger');
const languageManager = require('../managers/languageManager');
const rateLimiter = require('../utils/rateLimiter');
const registry = require('../interactions/registry');
const handleAutocomplete = require('../interactions/autocomplete');
const { safeExecute, respondError } = require('../interactions/safeExecute');

// Batas laju perintah slash (tidak berubah dari versi sebelumnya).
const SLASH_LIMIT = { max: 5, seconds: 5 };

// Batas laju komponen. Sebelumnya tidak ada sama sekali, sehingga tombol bisa
// ditekan secepat mungkin dan setiap tekanan memicu kueri database.
const COMPONENT_LIMIT = { max: 8, seconds: 5 };

function kindOf(interaction) {
    if (interaction.isButton()) return 'buttons';
    if (interaction.isModalSubmit()) return 'modals';
    if (interaction.isAnySelectMenu()) return 'selects';
    return null;
}

async function handleSlashCommand(interaction, client) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return undefined;

    const limited = await rateLimiter.isRateLimited(
        interaction.user.id,
        `slash_${interaction.commandName}`,
        SLASH_LIMIT.max,
        SLASH_LIMIT.seconds
    );

    if (limited) {
        return interaction
            .reply({
                content: '\u26a0\ufe0f **Slow down!** Kamu mengirim perintah terlalu cepat. Harap tunggu beberapa detik.',
                ephemeral: true
            })
            .catch(() => {});
    }

    try {
        await command.execute(interaction, client);
    } catch (error) {
        logger.error(`[COMMAND ERROR] Galat saat mengeksekusi /${interaction.commandName}:`, error);
        await respondError(interaction, 'Terjadi kesalahan sistem saat memproses perintah ini.');
    }

    return undefined;
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction, client) {
        // Autocomplete didahulukan dan sengaja tidak menunggu apa pun. Discord
        // hanya memberi tiga detik, dan jalur ini tidak butuh bahasa maupun
        // pemeriksaan lain.
        if (interaction.isAutocomplete()) {
            return handleAutocomplete(interaction, client);
        }

        interaction.localeLang = await languageManager
            .getUserLanguage(interaction.user.id)
            .catch(() => 'id');

        if (client.isShuttingDown) {
            return interaction
                .reply({
                    content: '\u26a0\ufe0f **Naura sedang dalam proses restart/shutdown.** Mohon tunggu beberapa saat.',
                    ephemeral: true
                })
                .catch(() => {});
        }

        if (interaction.isChatInputCommand()) {
            return handleSlashCommand(interaction, client);
        }

        const kind = kindOf(interaction);
        if (!kind) return undefined;

        const entry = registry.resolve(kind, interaction.customId);

        // Komponen dari pesan lama yang penanganya sudah dihapus. Versi sebelumnya
        // diam saja di sini, dan pengguna hanya melihat "This interaction failed".
        if (!entry) {
            logger.warn(`[INTERAKSI] Tidak ada penangan untuk ${kind}:${interaction.customId}`);
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setDescription(
                    '\u23f3 **Komponen ini sudah kedaluwarsa.** Jalankan ulang perintahnya untuk mendapatkan panel yang baru.'
                );
            return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }

        const cooldown = entry.cooldown || COMPONENT_LIMIT;
        const limited = await rateLimiter.isRateLimited(
            interaction.user.id,
            `component_${entry.label}`,
            cooldown.max,
            cooldown.seconds
        );

        if (limited) {
            return interaction
                .reply({
                    content: '\u26a0\ufe0f **Pelan-pelan ya!** Kamu menekan tombol terlalu cepat.',
                    ephemeral: true
                })
                .catch(() => {});
        }

        return safeExecute(interaction, entry, client);
    }
};
