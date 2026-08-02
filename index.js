try { process.loadEnvFile(); } catch (e) {}
const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, Partials } = require('discord.js');
const fs = require('fs');

// ==========================================
// 🛠️ DEPRECATION PATCH: ephemeral -> flags
// ==========================================
// Automatically converts deprecated "ephemeral: true" options to "flags: ['Ephemeral']"
const djs = require('discord.js');
function patchOptions(options) {
    if (options && typeof options === 'object') {
        if (options.ephemeral) {
            options.flags = options.flags || [];
            if (Array.isArray(options.flags)) {
                if (!options.flags.includes('Ephemeral') && !options.flags.includes(64)) {
                    options.flags.push('Ephemeral');
                }
            } else {
                options.flags |= 64;
            }
            delete options.ephemeral;
        }
    }
    return options;
}
const patchProto = (proto) => {
    if (!proto) return;
    if (proto.reply && !proto.reply.__patched) {
        const orig = proto.reply;
        proto.reply = function (options) { return orig.call(this, patchOptions(options)); };
        proto.reply.__patched = true;
    }
    if (proto.deferReply && !proto.deferReply.__patched) {
        const orig = proto.deferReply;
        proto.deferReply = function (options) { return orig.call(this, patchOptions(options)); };
        proto.deferReply.__patched = true;
    }
    if (proto.followUp && !proto.followUp.__patched) {
        const orig = proto.followUp;
        proto.followUp = function (options) { return orig.call(this, patchOptions(options)); };
        proto.followUp.__patched = true;
    }
};
[djs.CommandInteraction, djs.MessageComponentInteraction, djs.ModalSubmitInteraction].forEach(cls => {
    if (cls && cls.prototype) patchProto(cls.prototype);
});

const path = require('path');
const os = require('os');

const { CommandHandler } = require('./src/managers/CommandHandler');
const MusicManager = require('./plugin/music/musicManager');
const redisManager = require('./src/managers/redisManager');
const { logError, logger } = require('./src/managers/logger');
const RssManager = require('./src/managers/rssManager');
const { connectToDatabase, seedInitialData } = require('./src/managers/dbManager');
const env = require('./src/config/env');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();
client.musicManager = new MusicManager(client);
client.rssManager = new RssManager(client);

// ==========================================
// 🛡️ SISTEM ANTI-CRASH PROFESIONAL
// ==========================================
const { setupErrorHandlers } = require('./src/managers/errorHandler');
setupErrorHandlers(client);

// ==========================================
// 📂 EVENT HANDLER ROUTER
// ==========================================
const glob = require('fast-glob');
const eventsPath = path.join(__dirname, 'src', 'events');
if (fs.existsSync(eventsPath)) {
    // Gunakan fast-glob agar bisa membaca file event di dalam sub-folder secara rekursif
    const searchPattern = path.posix.join(eventsPath.split(path.sep).join('/'), '**/*.js');
    const eventFiles = glob.sync(searchPattern);

    for (const filePath of eventFiles) {
        const event = require(filePath);
        // Mendapatkan nama file tanpa ekstensi sebagai eventName fallback
        const eventName = path.basename(filePath, '.js');

        if (typeof event === 'function') {
            client.on(eventName, (...args) => event(client, ...args));
        } else if (event.name) {
            if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
            else client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

// ==========================================
// 🚀 FUNGSI UTAMA (BOOT SEQUENCE)
// ==========================================
async function startBot() {
    console.log('\n\x1b[46m\x1b[30m ⚙️ BOOT SEQUENCE \x1b[0m \x1b[36mMemulai proses inisialisasi sistem...\x1b[0m\n');

    let sysStatus = {
        db: '\x1b[31m🔴 OFFLINE   \x1b[0m',
        redis: '\x1b[33m🟡 SKIPPED   \x1b[0m',
        music: '\x1b[32m🟢 INITIALIZED\x1b[0m',
        cmds: '\x1b[33m🟡 BACKGROUND\x1b[0m',
        rss: '\x1b[32m🟢 ACTIVE    \x1b[0m'
    };

    try {
        const commandPath = path.join(__dirname, 'plugin');
        const commandHandler = new CommandHandler(client, commandPath);

        // Selalu mendeploy Slash Command secara otomatis saat booting
        const shouldDeploy = true;
        await commandHandler.load(shouldDeploy);
        sysStatus.cmds = '\x1b[32m🟢 LOADED    \x1b[0m';

        try {
            const dbConnected = await connectToDatabase();
            if (dbConnected) {
                sysStatus.db = '\x1b[32m🟢 CONNECTED \x1b[0m';
                // Seed data awal (dipisah dari connectToDatabase, sesuai Rule 1.7)
                await seedInitialData();
            } else {
                sysStatus.db = '\x1b[31m🔴 FALLBACK  \x1b[0m';
            }
        } catch (error) {
            sysStatus.db = '\x1b[31m🔴 ERROR     \x1b[0m';
        }

        if (env.REDIS_URL) {
            await redisManager.connect();
            sysStatus.redis = '\x1b[32m🟢 CONNECTED \x1b[0m';
        }

        client.once('clientReady', () => {
            if (client.musicManager.initialize) client.musicManager.initialize();
            if (client.rssManager.init) client.rssManager.init();
            try {
                require('./src/dashboard/server.js')(client);
            } catch (err) {
                logger.error('\x1b[41m\x1b[37m 💥 ERROR \x1b[0m \x1b[31mGagal menjalankan Web Dashboard:\x1b[0m', err.message
                );
            }
        });

        const cronManager = require('./src/managers/cronManager');
        cronManager.init(client);

        client.login(env.TOKEN);

        await new Promise(r => setTimeout(r, 1500));

        const { displayBootScreen } = require('./src/utils/bootScreen');
        displayBootScreen(client, sysStatus);
    } catch (error) {
        logger.error('\n\x1b[41m\x1b[37m 💥 FATAL ERROR \x1b[0m \x1b[31mTerjadi kesalahan fatal saat booting:\x1b[0m\n', error
        );
    }
}

startBot();

// ==========================================
// 🛑 GRACEFUL SHUTDOWN HANDLER
// ==========================================
async function shutdown() {
    console.log('\n\x1b[41m\x1b[37m 🛑 SHUTDOWN \x1b[0m \x1b[31mMenutup semua koneksi dengan aman...\x1b[0m');
    client.isShuttingDown = true; // Flag agar bot menolak interaksi baru

    try {
        // 1. Drain cache write queues to prevent data loss
        const cacheManager = require('./src/managers/cacheManager');
        if (cacheManager && cacheManager.writeQueue && cacheManager.writeQueue.size > 0) {
            console.log(`[-] Menyimpan ${cacheManager.writeQueue.size} data cache ke database...`);
            await cacheManager._processWriteQueue();
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

        console.log('\x1b[42m\x1b[30m ✨ SUCCESS \x1b[0m \x1b[32mShutdown selesai dengan aman.\x1b[0m');
        process.exit(0);
    } catch (error) {
        console.error('Error saat shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
