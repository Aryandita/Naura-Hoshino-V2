// src/managers/guildSettingsService.js
const GuildSettings = require('../models/GuildSettings');
const cacheManager = require('./cacheManager');

/**
 * Satu-satunya jalur yang disarankan untuk mengubah GuildSettings.settings.
 *
 * Pola berikut sebelumnya tersalin di tiga belas tempat pada interactionCreate.js,
 * dan setiap salinan adalah kesempatan baru untuk lupa menginvalidasi cache:
 *
 *   const [row] = await GuildSettings.findOrCreate({ where: { guildId } });
 *   const settings = row.settings || {};
 *   settings.automod = { ...settings.automod, enabled: true };
 *   row.settings = settings;
 *   row.changed('settings', true);
 *   await row.save();
 *
 * Menjadi:
 *
 *   await updateGuildSetting(guildId, s => {
 *       s.automod = { ...s.automod, enabled: true };
 *   });
 *
 * Invalidasi cache ditangani oleh hook pada model, jadi tidak perlu dipanggil
 * di sini maupun oleh pemanggil.
 *
 * @param {string} guildId
 * @param {(settings: Object) => void | Promise<void>} mutator - Mengubah objek settings di tempat.
 * @returns {Promise<Object>} Objek settings setelah diubah.
 */
async function updateGuildSetting(guildId, mutator) {
    if (!guildId) throw new Error('updateGuildSetting membutuhkan guildId.');
    if (typeof mutator !== 'function') throw new Error('updateGuildSetting membutuhkan fungsi mutator.');

    const [row] = await GuildSettings.findOrCreate({ where: { guildId } });
    const settings = row.settings || {};

    await mutator(settings);

    row.settings = settings;
    // Sequelize tidak mendeteksi perubahan di dalam kolom JSON secara otomatis.
    row.changed('settings', true);
    await row.save({ fields: ['settings'] });

    return settings;
}

/**
 * Membaca settings lewat cache. Pembungkus tipis agar pemanggil cukup mengenal
 * satu modul untuk baca dan tulis.
 *
 * @param {string} guildId
 */
async function getGuildSetting(guildId) {
    return cacheManager.getGuildSettings(guildId);
}

module.exports = { updateGuildSetting, getGuildSetting };
