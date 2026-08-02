const { logger } = require('../../src/managers/logger');
try { process.loadEnvFile(); } catch (e) {}


// Helper untuk membersihkan tanda kutip yang tidak sengaja terbawa dari panel Pterodactyl
const cleanEnv = (val) => {
    if (!val) return val;
    return val.replace(/^["']|["']$/g, '').trim();
};

const env = {
    // 🤖 DISCORD CORE
    TOKEN: cleanEnv(process.env.DISCORD_TOKEN),
    CLIENT_ID: cleanEnv(process.env.CLIENT_ID),
    PREFIX: cleanEnv(process.env.PREFIX) || 'n!',
    GUILD_ID: cleanEnv(process.env.GUILD_ID),
    OWNER_IDS: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',').map(id => cleanEnv(id)) : [],

    // 🏷️ VERSION & PARTNERSHIP CONFIG
    BOT_VERSION: cleanEnv(process.env.BOT_VERSION) || '1.2.0',
    ENGINE_VERSION: cleanEnv(process.env.ENGINE_VERSION) || '1.1.0',
    PARTNERSHIP: cleanEnv(process.env.PARTNERSHIP) || 'Belum ada kolaborasi',

    // 🗄️ MYSQL DATABASE
    DB_HOST: cleanEnv(process.env.MYSQL_HOST) || '127.0.0.1',
    DB_PORT: parseInt(process.env.MYSQL_PORT) || 3306,
    DB_USER: cleanEnv(process.env.MYSQL_USER),
    DB_PASS: cleanEnv(process.env.MYSQL_PASSWORD),
    DB_NAME: cleanEnv(process.env.MYSQL_DATABASE),

    // 🛡️ MODMAIL
    STAFF_GUILD: cleanEnv(process.env.STAFF_GUILD_ID),
    MODMAIL_CATEGORY: cleanEnv(process.env.MODMAIL_CATEGORY_ID),

    // 🎵 LAVALINK
    LAVA_HOST: cleanEnv(process.env.LAVALINK_HOST) || 'localhost',
    LAVA_PORT: parseInt(process.env.LAVALINK_PORT) || 2333,
    LAVA_PASS: cleanEnv(process.env.LAVALINK_PASSWORD) || 'youshallnotpass',
    LAVA_SECURE: process.env.LAVALINK_SECURE === 'true',

    // 🔰 GEMINI AI
    GEMINI_API: cleanEnv(process.env.GEMINI_API_KEY),

    // 🧠 VERBA API
    VERBA_API_KEY: cleanEnv(process.env.VERBA_API_KEY),
    VERBA_SLUG_OWNER: cleanEnv(process.env.VERBA_SLUG_OWNER),
    VERBA_SLUG_PREMIUM: cleanEnv(process.env.VERBA_SLUG_PREMIUM),
    VERBA_SLUG_GENERAL: cleanEnv(process.env.VERBA_SLUG_GENERAL),
    VERBA_CHARACTER_SLUG: cleanEnv(process.env.VERBA_CHARACTER_SLUG), // Legacy support

    // 📦 REDIS
    REDIS_URL: cleanEnv(process.env.REDIS_URL),

    // 🧠 OLLAMA (Local AI Fallback)
    OLLAMA_BASE_URL: cleanEnv(process.env.OLLAMA_BASE_URL) || 'http://localhost:11434',
    OLLAMA_MODEL: cleanEnv(process.env.OLLAMA_MODEL) || 'llama3.1',

    // 🎨 FOOOCUS (Local Image Generation)
    FOOOCUS_BASE_URL: cleanEnv(process.env.FOOOCUS_BASE_URL) || 'http://localhost:7865',

    // 🚨 ERROR REPORTING
    ERROR_WEBHOOK_URL: cleanEnv(process.env.ERROR_WEBHOOK_URL),

    // 🌐 WEB DASHBOARD & PORTS (Dynamic Pterodactyl Resolution)
    DASHBOARD_PORT: parseInt(process.env.PORT || process.env.SERVER_PORT || process.env.DASHBOARD_PORT) || 3070,
    WEBHOOK_PORT: parseInt(process.env.WEBHOOK_PORT) || 3071,
    CALLBACK_URL: cleanEnv(process.env.DISCORD_CALLBACK_URL)
};

// Pengecekan Wajib (Mencegah Bot Menyala Jika Config Kosong)
const requiredKeys = ['TOKEN', 'CLIENT_ID', 'DB_USER', 'DB_NAME'];
for (const key of requiredKeys) {
    if (!env[key]) {
        logger.error(`\x1b[41m\x1b[37m 💥 FATAL ERROR \x1b[0m \x1b[31mVariabel ${key} belum diisi di dalam file .env! Bot dihentikan.\x1b[0m`);
        process.exit(1); 
    }
}


// Peringatan opsional
if (!env.GEMINI_API) {
    logger.warn('GEMINI_API_KEY tidak ditemukan di .env. Fitur AI utama mungkin tidak berfungsi.');
}
if (!env.VERBA_API_KEY) {
    logger.warn('VERBA_API_KEY tidak ditemukan di .env. Fallback ke Gemini akan digunakan.');
}

module.exports = env;