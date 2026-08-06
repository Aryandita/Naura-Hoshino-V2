const { REST, Routes, Collection } = require('discord.js');
const { logger } = require('./logger');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const glob = require('fast-glob');
const env = require('../config/env');

// Penanda deploy disimpan di .cache/ yang sudah masuk .gitignore.
//
// Sengaja berkas, bukan Redis. Pada urutan boot saat ini, load() dijalankan
// sebelum redisManager.connect(), jadi Redis dijamin belum siap di titik ini.
const CACHE_DIR = path.join(__dirname, '..', '..', '.cache');
const DEPLOY_CACHE_FILE = path.join(CACHE_DIR, 'commands-deploy.json');

function readDeployCache() {
    try {
        return JSON.parse(fs.readFileSync(DEPLOY_CACHE_FILE, 'utf8'));
    } catch (error) {
        // Berkas belum ada pada boot pertama. Itu wajar, bukan kesalahan.
        return {};
    }
}

function writeDeployCache(data) {
    try {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(DEPLOY_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        // Gagal menulis penanda berarti boot berikutnya akan deploy lagi.
        // Boros, tapi tidak merusak apa pun, jadi cukup diperingatkan.
        logger.warn(`[DEPLOY] Gagal menyimpan penanda deploy: ${error.message}`);
    }
}

function signatureOf(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

class CommandHandler {
    constructor(client, commandsPath) {
        this.client = client;
        this.commandsPath = commandsPath;

        if (!client.commands) client.commands = new Collection();

        // Alias tidak lagi ikut masuk ke client.commands.
        //
        // Dulu setiap alias disimpan sebagai entri tersendiri di Collection yang
        // sama. Akibatnya satu command bisa muncul belasan kali: `survival`
        // sendirian menyumbang 13 entri lewat alias defaultnya. Apa pun yang
        // menghitung atau melakukan iterasi atas client.commands, termasuk menu
        // /help dan log jumlah command saat boot, membaca angka yang salah.
        if (!client.aliases) client.aliases = new Collection();

        this.commands = client.commands;
        this.aliases = client.aliases;
    }

    /**
     * Daftarkan satu alias.
     *
     * @returns {boolean} false bila alias ditolak karena bentrok.
     */
    registerAlias(alias, commandName) {
        // Alias tidak boleh menutupi nama command yang asli. Tanpa penjagaan ini,
        // sebuah alias bisa membajak command lain hanya karena urutan pemuatan
        // berkasnya kebetulan berbeda.
        if (this.commands.has(alias)) {
            logger.warn(`[ALIAS] "${alias}" dilewati: bentrok dengan nama command asli.`);
            return false;
        }

        const existing = this.aliases.get(alias);
        if (existing && existing !== commandName) {
            logger.warn(`[ALIAS] "${alias}" sudah dipakai /${existing}, permintaan dari /${commandName} dilewati.`);
            return false;
        }

        this.aliases.set(alias, commandName);
        return true;
    }

    async load(autoDeploy = false) {
        let commandsArray = [];
        let commandNames = new Set();
        const pendingAliases = [];

        try {
            // Menggunakan fast-glob untuk pencarian rekursif
            // Tanda backslash pada Windows akan diubah ke forward slash oleh fast-glob (disarankan)
            const searchPattern = path.posix.join(this.commandsPath.split(path.sep).join('/'), '**/*.js');
            const commandFiles = await glob(searchPattern);

            for (const filePath of commandFiles) {
                try {
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);

                    // Pastikan file tersebut adalah command yang valid
                    if (('data' in command || 'name' in command) && 'execute' in command) {
                        const cmdName = command.data ? command.data.name : command.name;

                        if (commandNames.has(cmdName)) {
                            logger.warn(`[COMMANDS] Duplikat command "/${cmdName}" pada file ${path.basename(filePath)}. File dilewati.`);
                            continue;
                        }

                        commandNames.add(cmdName);

                        // Menentukan kategori berdasarkan nama folder tempat file itu berada
                        // Misalnya plugin/music/subfolder/cmd.js -> kategorinya 'music'
                        const relativePath = path.relative(this.commandsPath, filePath);
                        const category = relativePath.split(path.sep)[0];
                        command.category = category;

                        this.commands.set(cmdName, command);

                        // Alias didaftarkan belakangan, setelah semua nama command
                        // asli dikenal. Kalau diproses sekarang, pemeriksaan bentrok
                        // tidak bisa melihat command yang belum sempat dimuat.
                        if (command.aliases && Array.isArray(command.aliases)) {
                            pendingAliases.push([cmdName, command.aliases]);
                        }

                        if (command.data) {
                            if (cmdName !== 'naura') {
                                commandsArray.push(command.data.toJSON());
                            }
                        }
                    }
                } catch (err) {
                    logger.error(`[COMMANDS] Gagal memuat file command ${path.basename(filePath)}: ${err.message}`);
                }
            }

            // Register default hybrid short aliases
            const defaultAliases = {
                'survival': ['s', 'surv', 'rpg', 'w', 'f', 'm', 'c', 'inv', 'i', 'bag', 'shop', 'bank', 'craft'],
                'music': ['p', 'play', 'q', 'queue', 'np', 'nowplaying', 'skip', 'stop'],
                'rank': ['r', 'level', 'lvl'],
                'leaderboard': ['lb', 'top'],
                'ai': ['chat', 'img', 'imagine'],
                'daily': ['claim'],
                'pay': ['transfer'],
                'setup': ['settings', 'config']
            };

            for (const [cmdName, aliases] of Object.entries(defaultAliases)) {
                if (this.commands.has(cmdName)) pendingAliases.push([cmdName, aliases]);
            }

            let aliasCount = 0;
            for (const [cmdName, aliases] of pendingAliases) {
                const cmd = this.commands.get(cmdName);
                if (!cmd) continue;
                if (!Array.isArray(cmd.aliases)) cmd.aliases = [];

                for (const alias of aliases) {
                    if (!this.registerAlias(alias, cmdName)) continue;
                    aliasCount += 1;

                    // Alias default dulu hanya masuk ke Collection, tidak pernah ke
                    // cmd.aliases. Padahal resolusi prefix punya jalur cadangan yang
                    // membaca cmd.aliases. Sekarang keduanya konsisten.
                    if (!cmd.aliases.includes(alias)) cmd.aliases.push(alias);
                }
            }

            logger.info(`[COMMANDS] Memuat ${this.commands.size} command dan ${aliasCount} alias.`);

            // ==========================================
            // 🚀 AUTO DEPLOY SLASH COMMANDS
            // ==========================================
            if (commandsArray.length > 0 && autoDeploy) {
                await this.deploy(commandsArray);
            }
        } catch (error) {
            logger.error('[COMMANDS] Gagal memuat atau deploy command:', error);
        }
    }

    /**
     * Kirim daftar slash command ke Discord, tapi hanya bila daftarnya berubah.
     *
     * Sebelumnya deploy dijalankan pada setiap boot tanpa syarat. Untuk bot yang
     * sering direstart, itu membakar kuota rate limit command Discord tanpa
     * menghasilkan perubahan apa pun, karena payload yang dikirim identik.
     */
    async deploy(commandsArray) {
        const clientId = env.CLIENT_ID;

        if (!clientId) {
            // Dulu baris ini `return console.log(...)`, yang mengembalikan
            // undefined dari console.log dan menyamarkan kegagalan sebagai
            // keluaran biasa.
            logger.error('[DEPLOY] CLIENT_ID tidak ada di .env. Deploy dibatalkan.');
            return false;
        }

        const rawGuildId = env.GUILD_ID ? String(env.GUILD_ID).trim() : '';
        const guildId = /^\d{17,20}$/.test(rawGuildId) ? rawGuildId : null;

        // Tanda tangan ikut memuat clientId dan guildId. Tanpa itu, memindahkan
        // bot ke aplikasi lain atau mengganti server pengembangan tidak akan
        // memicu deploy ulang, padahal seharusnya iya.
        const signature = signatureOf({ clientId, guildId, commands: commandsArray });
        const force = process.argv.includes('--deploy');
        const cache = readDeployCache();

        if (!force && cache.signature === signature) {
            logger.info(`[DEPLOY] Daftar command tidak berubah sejak ${cache.deployedAt || 'deploy terakhir'}. Deploy dilewati.`);
            logger.info('[DEPLOY] Jalankan `npm run deploy` untuk memaksa sinkronisasi.');
            return false;
        }

        const rest = new REST({ version: '10' }).setToken(env.TOKEN);

        try {
            logger.info(`[DEPLOY] Sinkronisasi ${commandsArray.length} slash command ke Discord...`);

            // 1. Daftar secara Global (agar tersedia di semua server, walau ada cache delay)
            await rest.put(Routes.applicationCommands(clientId), { body: commandsArray });
            logger.info(`[DEPLOY] ${commandsArray.length} command didaftarkan secara global.`);

            // 2. Daftar ke Guild Spesifik jika ada (ini dijamin 100% instan untuk testing/server utama)
            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandsArray });
                logger.info(`[DEPLOY] ${commandsArray.length} command instan ke server ${guildId}.`);
            }

            writeDeployCache({
                signature,
                clientId,
                guildId,
                count: commandsArray.length,
                deployedAt: new Date().toISOString()
            });

            return true;
        } catch (error) {
            // Penanda sengaja tidak ditulis saat gagal, supaya boot berikutnya
            // mencoba lagi alih-alih menganggap deploy sudah beres.
            logger.error('[DEPLOY] Gagal menyinkronkan slash command:', error);
            return false;
        }
    }
}

module.exports = { CommandHandler };
