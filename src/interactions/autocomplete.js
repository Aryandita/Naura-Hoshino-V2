'use strict';

/**
 * Penanganan autocomplete.
 *
 * Sebelumnya tidak ada sama sekali. Setiap perintah yang mendaftarkan opsi
 * dengan `setAutocomplete(true)` akan menampilkan "Loading options failed"
 * kepada pengguna, karena Discord menunggu balasan yang tidak pernah dikirim.
 *
 * Aturan penting: autocomplete HANYA boleh dijawab dengan respond(). Tidak boleh
 * reply, defer, maupun followUp. Batas waktunya juga 3 detik, jadi jalur ini
 * sengaja dibuat sesingkat mungkin dan tidak menunggu apa pun selain penangan
 * milik perintahnya sendiri.
 */

const { logger } = require('../managers/logger');
const { isIgnorable } = require('./safeExecute');

// Discord menolak lebih dari 25 pilihan.
const MAX_CHOICES = 25;

async function handleAutocomplete(interaction, client) {
    const command = client.commands?.get(interaction.commandName);

    // Perintah tanpa penangan autocomplete tetap harus dijawab, kalau tidak
    // pengguna melihat pesan galat di dalam kotak pilihan.
    if (!command || typeof command.autocomplete !== 'function') {
        return interaction.respond([]).catch(() => {});
    }

    try {
        const result = await command.autocomplete(interaction, client);

        // Perintah boleh menjawab sendiri lewat interaction.respond(). Bila sudah,
        // jangan menjawab dua kali.
        if (interaction.responded) return undefined;

        const choices = Array.isArray(result) ? result.slice(0, MAX_CHOICES) : [];
        return await interaction.respond(choices);
    } catch (error) {
        if (!isIgnorable(error)) {
            logger.error(`[AUTOCOMPLETE] Galat pada /${interaction.commandName}:`, error);
        }
        return interaction.respond([]).catch(() => {});
    }
}

module.exports = handleAutocomplete;
