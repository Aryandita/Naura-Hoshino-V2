'use strict';

/**
 * Pembungkus eksekusi tunggal untuk seluruh komponen interaksi.
 *
 * Semua penanganan galat yang sebelumnya ditulis ulang di setiap cabang (dan
 * sering kali tidak ditulis sama sekali) sekarang tinggal di sini.
 */

const { EmbedBuilder, MessageFlags } = require('discord.js');
const { logger } = require('../managers/logger');

/**
 * Galat Discord yang tidak berguna untuk dilaporkan:
 *
 *   10062 Unknown interaction  - token interaksi kedaluwarsa (batas 3 detik)
 *   40060 Already acknowledged - interaksi sudah dijawab di tempat lain
 *   10008 Unknown message      - pesan sudah dihapus
 *   50027 Invalid webhook token- token balasan kedaluwarsa (batas 15 menit)
 *
 * Semuanya berarti pengguna sudah tidak bisa menerima balasan apa pun, jadi
 * mencoba membalas hanya menghasilkan galat kedua.
 */
const IGNORED_CODES = new Set([10062, 40060, 10008, 50027]);

// Batas keras Discord untuk membalas interaksi adalah 3 detik.
const ACK_WARNING_MS = 2500;

const DEFAULT_ERROR = 'Terjadi kesalahan saat memproses aksi ini. Coba lagi sebentar lagi ya.';

function isIgnorable(error) {
    return Boolean(error && IGNORED_CODES.has(error.code));
}

/** Kirim pesan galat ke pengguna, apa pun keadaan interaksinya. */
async function respondError(interaction, message) {
    const embed = new EmbedBuilder().setColor('#FF0000').setDescription(`\u274c **${message}**`);

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        if (!isIgnorable(error)) {
            logger.warn(`[INTERAKSI] Tidak bisa mengirim pesan galat: ${error.message}`);
        }
    }
}

/**
 * Jalankan satu penangan komponen dengan jaring pengaman.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {Object} entry - entri dari registry
 * @param {import('discord.js').Client} client
 */
async function safeExecute(interaction, entry, client) {
    // Peringatan bila sebuah penangan berisiko melewati batas 3 detik. Sengaja
    // hanya memperingatkan, bukan defer otomatis: sebagian penangan memanggil
    // showModal() atau update(), dan keduanya tidak boleh didahului deferReply.
    const watchdog = setTimeout(() => {
        if (!interaction.replied && !interaction.deferred) {
            logger.warn(
                `[INTERAKSI] "${entry.label}" belum membalas setelah ${ACK_WARNING_MS} ms. ` +
                'Pertimbangkan menambahkan defer pada entri registry-nya.'
            );
        }
    }, ACK_WARNING_MS);

    try {
        if (entry.defer === 'reply' && !interaction.replied && !interaction.deferred) {
            await interaction.deferReply({ ephemeral: entry.ephemeral !== false });
        } else if (entry.defer === 'update' && !interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }

        await entry.handler(interaction, client);
    } catch (error) {
        if (isIgnorable(error)) {
            logger.debug?.(`[INTERAKSI] "${entry.label}" diabaikan: ${error.message}`);
            return;
        }

        logger.error(`[INTERAKSI] Galat pada "${entry.label}" (${entry.source}):`, error);
        await respondError(interaction, entry.onError || DEFAULT_ERROR);
    } finally {
        clearTimeout(watchdog);
    }
}

module.exports = { safeExecute, respondError, isIgnorable, IGNORED_CODES };
