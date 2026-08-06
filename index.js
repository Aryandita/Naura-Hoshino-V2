try { process.loadEnvFile(); } catch (e) {}
const { Client, Collection } = require('discord.js');
const path = require('path');

// Penambal kompatibilitas ephemeral -> flags harus dipasang sebelum command dimuat.
const { applyEphemeralPatch } = require('./src/utils/ephemeralPatch');
applyEphemeralPatch();

// Penambal bahasa memasang interaction.localeLang, interaction.t(), dan padanannya
// pada message. Harus dipasang sebelum command dimuat agar command apa pun dapat
// membaca bahasa pilihan user sejak interaksi pertama.
const { applyLocalePatch } = require('./src/utils/localePatch');
applyLocalePatch();

const { CommandHandler } = require('./src/managers/CommandHandler');
const { loadEvents } = require('./src/managers/eventLoader');
const clientOptions = require('./src/config/clientOptions');
const MusicManager = require('./plugin/music/musicManager');
const redisManager = require('./src/managers/redisManager');
const { logger } = require('./src/managers/logger');
const RssManager = require('./src/managers/rssManager');
const { connectToDatabase, seedInitialData } = require('./src/managers/dbManager');
const env = require('./src/config/env');

// Kode keluar khusus untuk konfigurasi yang tidak lengkap. shard.js membaca kode
// ini dan mematikan respawn, sehingga tidak terjadi siklus lahir-mati tanpa henti.
const EXIT_CODE_BAD_CONFIG = 78;

// Batas waktu shutdown. Bila salah satu koneksi menggantung, proses tetap harus mati
// sebelum panel mengirim SIGKILL dan membuang antrean tulis yang belum selesai.
const SHUTDOWN_TIMEOUT_MS = 10_000;

// Identitas shard. SHARD_ID hanya terisi bila proses ini dijalankan oleh ShardingManager.
const isShardChild = typeof process.env.SHARD_ID !== 'undefined';
const isPrimaryShard = !isShardChild || process.env.SHARD_ID === '0';

// Saat berjalan mandiri (node index.js), validasi wajib bersifat fatal.
// Saat menjadi anak shard, shard.js sudah memvalidasi lebih dulu; di sini kita tetap
// berhenti, tetapi dengan kode keluar khusus agar respawn dimatikan.
if (!env.validateEnv({ fatal: !isShardChild })) {
    logger.error(`[BOOT] Konfigurasi wajib belum lengkap. Shard berhenti dengan kode ${EXIT_CODE_BAD_CONFIG} (tanpa respawn).`);
    process.exit(EXIT_CODE_BAD_CONFIG);
}

const client = new Client({
    intents: clientOptions.intents,
    partials: clientOptions.partials
});

client.commands = new Collection();
client.musicManager = new MusicManager(client);
client.rssManager = new RssManager(client);

const { setupErrorHandlers } = require('./src/managers/errorHandler');
setupErrorHandlers(client);

loadEvents(client, path.join(__dirname, 'src', 'events'));

async function startBot() {
    console.log('\n\x1b[46m\x1b[30m \u2699\ufe0f BOOT SEQUENCE \x1b[0m \x1b[36mMemulai proses inisialisasi sistem...\x1b[0m\n');

    let sysStatus = {
        db: '\x1b[31m\ud83d\udd34 OFFLINE   \x1b[0m',
        redis: '\x1b[33m\ud83d\udfe1 SKIPPED   \x1b[0m',
        music: '\x1b[32m\ud83d\udfe2 INITIALIZED\x1b[0m',
        cmds: '\x1b[33m\ud83d\udfe1 BACKGROUND\x1b[0m',
        rss: '\x1b[32m\ud83d\udfe2 ACTIVE    \x1b[0m'
    };

    try {
        const commandPath = path.join(__dirname, 'plugin');
        const commandHandler = new CommandHandler(client, commandPath);

        // Slash Command bersifat global, jadi cukup dideploy SEKALI per boot.
        // --deploy    : paksa deploy (dipakai `npm run deploy`)
        // --no-deploy : lewati deploy sepenuhnya
        const shouldDeploy = !process.argv.includes('--no-deploy')
            && (process.argv.includes('--deploy') || isPrimaryShard);

        if (!shouldDeploy) {
            logger.info(`[DEPLOY] Shard #${process.env.SHARD_ID} melewati deploy slash command (ditangani shard utama).`);
        }

        await commandHandler.load(shouldDeploy);
        sysStatus.cmds = '\x1b[32m\ud83d\udfe2 LOADED    \x1b[0m';

        try {
            const dbConnected = await connectToDatabase();
            if (dbConnected) {
                sysStatus.db = '\x1b[32m\ud83d\udfe2 CONNECTED \x1b[0m';
                await seedInitialData();
            } else {
                sysStatus.db = '\x1b[31m\ud83d\udd34 FALLBACK  \x1b[0m';
            }
        } catch (error) {
            sysStatus.db = '\x1b[31m\ud83d\udd34 ERROR     \x1b[0m';
            logger.error('[BOOT] Koneksi database gagal:', error.message);
        }

        if (env.REDIS_URL) {
            await redisManager.connect();
            sysStatus.redis = '\x1b[32m\ud83d\udfe2 CONNECTED \x1b[0m';
        }

        client.once('clientReady', () => {
            if (client.musicManager.initialize) client.musicManager.initialize();
            if (client.rssManager.init) client.rssManager.init();

            // Boot screen dicetak di sini, bukan setelah setTimeout, agar status yang
            // ditampilkan benar-benar mencerminkan koneksi yang sudah jadi.
            const { displayBootScreen } = require('./src/utils/bootScreen');
            displayBootScreen(client, sysStatus);

            // Web Dashboard hanya boleh dijalankan oleh satu proses. Bila setiap shard
            // mencoba listen di port yang sama, shard berikutnya crash dengan EADDRINUSE.
            if (!isPrimaryShard) {
                logger.info(`[DASHBOARD] Shard #${process.env.SHARD_ID} melewati Web Dashboard (dijalankan shard utama).`);
                return;
            }

            try {
                require('./src/dashboard/server.js')(client);
            } catch (err) {
                logger.error('\x1b[41m\x1b[37m \ud83d\udca5 ERROR \x1b[0m \x1b[31mGagal menjalankan Web Dashboard:\x1b[0m', err.message);
            }
        });

        const cronManager = require('./src/managers/cronManager');
        cronManager.init(client);

        // Tanpa await, token yang salah hanya muncul sebagai unhandled rejection.
        await client.login(env.TOKEN);
    } catch (error) {
        logger.error('\n\x1b[41m\x1b[37m \ud83d\udca5 FATAL ERROR \x1b[0m \x1b[31mTerjadi kesalahan fatal saat booting:\x1b[0m\n', error);
        process.exitCode = 1;
    }
}

startBot();

let isShuttingDown = false;

async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\n\x1b[41m\x1b[37m \ud83d\uded1 SHUTDOWN \x1b[0m \x1b[31mMenutup semua koneksi dengan aman...\x1b[0m');
    client.isShuttingDown = true; // Flag agar bot menolak interaksi baru

    // Watchdog: apa pun yang terjadi, proses harus berakhir.
    const forceExit = setTimeout(() => {
        console.error(`[SHUTDOWN] Melewati batas ${SHUTDOWN_TIMEOUT_MS} ms. Keluar paksa.`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    if (forceExit.unref) forceExit.unref();

    try {
        // Kosongkan antrean tulis cache lebih dulu agar tidak ada data yang hilang.
        const cacheManager = require('./src/managers/cacheManager');
        if (cacheManager && cacheManager.pendingWrites > 0) {
            console.log(`[-] Menyimpan ${cacheManager.pendingWrites} data cache ke database...`);
        }
        if (cacheManager && cacheManager.flushAll) {
            await cacheManager.flushAll();
        }

        if (client.musicManager && client.musicManager.poru) {
            console.log('[-] Menghancurkan Lavalink node(s)...');
            client.musicManager.poru.nodes.forEach(node => node.destroy());
        }

        console.log('[-] Menutup koneksi Discord Client...');
        client.destroy();

        const { sequelize } = require('./src/managers/dbManager');
        if (sequelize) {
            console.log('[-] Menutup koneksi Database MySQL/SQLite...');
            await sequelize.close();
        }

        if (redisManager && redisManager.client) {
            console.log('[-] Menutup koneksi Redis...');
            await redisManager.client.quit();
        }

        clearTimeout(forceExit);
        console.log('\x1b[42m\x1b[30m \u2728 SUCCESS \x1b[0m \x1b[32mShutdown selesai dengan aman.\x1b[0m');
        process.exit(0);
    } catch (error) {
        clearTimeout(forceExit);
        console.error('Error saat shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
