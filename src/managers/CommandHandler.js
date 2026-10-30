const { REST, Routes, Collection } = require("discord.js");
const { logger } = require("./logger");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const glob = require("fast-glob");
const env = require("../config/env");

// Penanda deploy disimpan di .cache/ yang sudah masuk .gitignore.
//
// Sengaja berkas, bukan Redis. Pada urutan boot saat ini, load() dijalankan
// sebelum redisManager.connect(), jadi Redis dijamin belum siap di titik ini.
const CACHE_DIR = path.join(__dirname, "..", "..", ".cache");
const DEPLOY_CACHE_FILE = path.join(CACHE_DIR, "commands-deploy.json");

function readDeployCache() {
  try {
    return JSON.parse(fs.readFileSync(DEPLOY_CACHE_FILE, "utf8"));
  } catch (error) {
    // Berkas belum ada pada boot pertama. Itu wajar, bukan kesalahan.
    return {};
  }
}

function writeDeployCache(data) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(DEPLOY_CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    // Gagal menulis penanda berarti boot berikutnya akan deploy lagi.
    // Boros, tapi tidak merusak apa pun, jadi cukup diperingatkan.
    logger.warn(`[DEPLOY] Gagal menyimpan penanda deploy: ${error.message}`);
  }
}

// Command yang TIDAK didaftarkan sebagai slash command, tetapi tetap dimuat
// ke dalam Collection (prefix, alias, /help, dan pemanggilan dari hub tetap jalan).
//
// Alasannya: Discord membatasi 100 CHAT_INPUT + 15 USER + 15 MESSAGE per scope,
// dan bulk overwrite menolak array di atas 130 entri dengan BASE_TYPE_MAX_LENGTH
// "Must be 130 or fewer in length". Bot ini mendaftarkan 132 command, sehingga
// SELURUH deploy gagal dan tidak ada satu pun slash command yang terdaftar.
//
// Setiap entri di bawah sudah diverifikasi punya jalur akses lain, jadi tidak
// ada fitur yang hilang:
// - "hub": modulnya dipanggil langsung oleh handler hub (hubSelects/hubModals),
//   jadi tetap tersedia lewat /fun, /tool, /ai, /minigame.
// - "subcommand:/x": command induk /x me-require file handler yang persis sama.
//
// Catatan: command yang punya subcommand sendiri (mystery, persona, story,
// voice, holo-arcade, minigame) SENGAJA tidak dimasukkan, karena handler hub
// memanggil execute() yang membaca getSubcommand() dan akan gagal tanpa
// registrasi slash.
const SLASH_DEPLOY_EXCLUDE = new Map([
  // Terjangkau dari hub /fun, /tool, /ai, /minigame (15)
  ["akinator", "hub:/minigame"],
  ["calculator", "hub:/tool"],
  ["coinflip", "hub:/fun"],
  ["color", "hub:/tool"],
  ["diceroll", "hub:/fun"],
  ["downloader", "hub:/tool"],
  ["fortune", "hub:/fun"],
  ["hangman", "hub:/minigame"],
  ["meme", "hub:/fun"],
  ["minesweeper", "hub:/minigame"],
  ["password", "hub:/tool"],
  ["qr", "hub:/tool"],
  ["quote", "hub:/fun"],
  ["sensei", "hub:/ai"],
  ["shorten", "hub:/tool"],
  // Sudah jadi subcommand di hub yang me-require file handler yang sama (10)
  ["anime", "subcommand:/media"],
  ["movie", "subcommand:/media"],
  ["github", "subcommand:/dev"],
  ["npm", "subcommand:/dev"],
  ["run", "subcommand:/dev"],
  ["nickname", "subcommand:/moderation"],
  ["slowmode", "subcommand:/moderation"],
  ["steal", "subcommand:/moderation"],
  ["lockdown", "subcommand:/moderation"],
  ["voicemod", "subcommand:/moderation"],
  // Duplikat fungsi: /core language melakukan hal yang sama (1)
  ["language", "subcommand:/core"],
]);

function signatureOf(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
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
      logger.warn(
        `[ALIAS] "${alias}" dilewati: bentrok dengan nama command asli.`,
      );
      return false;
    }

    const existing = this.aliases.get(alias);
    if (existing && existing !== commandName) {
      logger.warn(
        `[ALIAS] "${alias}" sudah dipakai /${existing}, permintaan dari /${commandName} dilewati.`,
      );
      return false;
    }

    this.aliases.set(alias, commandName);
    return true;
  }

  async load(autoDeploy = false) {
    const commandsArray = [];
    const commandNames = new Set();
    const pendingAliases = [];
    const excludedFromSlash = [];

    try {
      // Menggunakan fast-glob untuk pencarian rekursif
      // Tanda backslash pada Windows akan diubah ke forward slash oleh fast-glob (disarankan)
      const searchPattern = path.posix.join(
        this.commandsPath.split(path.sep).join("/"),
        "**/*.js",
      );
      const commandFiles = await glob(searchPattern, {
        ignore: [
          "**/subcommands/**",
          "**/helpers/**",
          "**/*.test.js",
          "**/*.spec.js",
        ],
      });

      for (const filePath of commandFiles) {
        const normalizedPath = filePath.replace(/\\/g, "/");
        if (
          normalizedPath.includes("/subcommands/") ||
          normalizedPath.includes("/helpers/") ||
          normalizedPath.endsWith(".test.js") ||
          normalizedPath.endsWith(".spec.js")
        ) {
          continue;
        }

        try {
          const absPath = path.resolve(filePath);
          delete require.cache[require.resolve(absPath)];
          const command = require(absPath);

          if (command.isSubcommand) continue;

          // Pastikan file tersebut adalah command yang valid
          if (
            ("data" in command || "name" in command) &&
            "execute" in command
          ) {
            const cmdName = command.data ? command.data.name : command.name;

            if (commandNames.has(cmdName)) {
              logger.warn(
                `[COMMANDS] Duplikat command "/${cmdName}" pada file ${path.basename(filePath)}. File dilewati.`,
              );
              continue;
            }

            commandNames.add(cmdName);

            // Menentukan kategori berdasarkan nama folder tempat file itu berada
            // Misalnya plugin/music/subfolder/cmd.js -> kategorinya 'music'
            const relativePath = path.relative(this.commandsPath, filePath);
            const category = relativePath.split(path.sep)[0];
            command.category = command.category || category;

            this.commands.set(cmdName, command);

            // Alias didaftarkan belakangan, setelah semua nama command
            // asli dikenal. Kalau diproses sekarang, pemeriksaan bentrok
            // tidak bisa melihat command yang belum sempat dimuat.
            if (command.aliases && Array.isArray(command.aliases)) {
              pendingAliases.push([cmdName, command.aliases]);
            }

            if (command.data) {
              // Command tetap masuk Collection (prefix/alias/help jalan),
              // tapi tidak dikirim ke Discord bila sudah punya jalur akses lain.
              if (SLASH_DEPLOY_EXCLUDE.has(cmdName)) {
                excludedFromSlash.push([cmdName, SLASH_DEPLOY_EXCLUDE.get(cmdName)]);
              } else {
                const json = command.data.toJSON();
                // Apps Anywhere (User-Installable Apps): Izinkan perintah personal dijalankan di mana saja
                const USER_INSTALLABLE_COMMANDS = new Set([
                  "profile",
                  "ask",
                  "weather",
                  "card",
                  "translate",
                  "calculator",
                  "coinflip",
                  "8ball",
                ]);
                if (USER_INSTALLABLE_COMMANDS.has(cmdName)) {
                  if (!json.integration_types) json.integration_types = [0, 1];
                  if (!json.contexts) json.contexts = [0, 1, 2];
                }
                commandsArray.push(json);
              }
            }
          }
        } catch (err) {
          logger.error(
            `[COMMANDS] Gagal memuat file command ${path.basename(filePath)}: ${err.message}`,
          );
        }
      }

      // Muat Context Menu Commands (Pintasan Klik Kanan)
      try {
        const {
          getContextMenuCommands,
        } = require("../interactions/contextMenus");
        const contextMenus = getContextMenuCommands();
        for (const cm of contextMenus) {
          commandsArray.push(cm);
        }
      } catch (err) {
        logger.warn(
          `[COMMANDS] Gagal memuat context menu commands: ${err.message}`,
        );
      }

      // Register default hybrid short aliases
      const defaultAliases = {
        survival: [
          "s",
          "surv",
          "w",
          "work",
          "f",
          "fish",
          "m",
          "mine",
          "c",
          "chop",
          "inv",
          "i",
          "bag",
          "shop",
          "bank",
          "craft",
        ],
        music: [
          "p",
          "play",
          "q",
          "queue",
          "np",
          "nowplaying",
          "skip",
          "stop",
          "pause",
          "resume",
          "vol",
          "volume",
          "loop",
          "shuffle",
          "lyrics",
          "ly",
        ],
        rank: ["r", "level", "lvl"],
        leaderboard: ["lb", "top"],
        ai: ["chat", "img", "imagine"],
        daily: ["claim"],
        pay: ["transfer"],
        setup: ["settings", "config"],
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

      logger.info(
        `[COMMANDS] Memuat ${this.commands.size} command dan ${aliasCount} alias.`,
      );

      if (excludedFromSlash.length > 0) {
        logger.info(
          `[COMMANDS] ${excludedFromSlash.length} command tidak didaftarkan sebagai slash ` +
            `(tetap aktif via prefix/hub): ${excludedFromSlash.map(([n, why]) => `${n} [${why}]`).join(", ")}`,
        );
      }

      try {
        const commandRegistry = require("../services/commandRegistry");
        commandRegistry.buildRegistry(this.client);
      } catch (regErr) {
        logger.warn(
          `[COMMANDS] Gagal menginisialisasi CommandRegistry: ${regErr.message}`,
        );
      }

      // ==========================================
      // 🚀 AUTO DEPLOY SLASH COMMANDS
      // ==========================================
      if (commandsArray.length > 0 && autoDeploy) {
        await this.deploy(commandsArray);
      }
    } catch (error) {
      logger.error("[COMMANDS] Gagal memuat atau deploy command:", error);
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
      logger.error("[DEPLOY] CLIENT_ID tidak ada di .env. Deploy dibatalkan.");
      return false;
    }

    const rawGuildId = env.GUILD_ID ? String(env.GUILD_ID).trim() : "";
    const guildId = /^\d{17,20}$/.test(rawGuildId) ? rawGuildId : null;

    // Tanda tangan ikut memuat clientId dan guildId. Tanpa itu, memindahkan
    // bot ke aplikasi lain atau mengganti server pengembangan tidak akan
    // memicu deploy ulang, padahal seharusnya iya.
    const signature = signatureOf({
      clientId,
      guildId,
      commands: commandsArray,
    });
    const force = process.argv.includes("--deploy");
    const cache = readDeployCache();

    if (!force && cache.signature === signature) {
      logger.info(
        `[DEPLOY] Daftar command tidak berubah sejak ${cache.deployedAt || "deploy terakhir"}. Deploy dilewati.`,
      );
      logger.info(
        "[DEPLOY] Jalankan `npm run deploy` untuk memaksa sinkronisasi.",
      );
      return false;
    }

    const rest = new REST({ version: "10" }).setToken(env.TOKEN);

    try {
      logger.info(
        `[DEPLOY] Sinkronisasi ${commandsArray.length} slash command ke Discord...`,
      );

      // Pre-flight check ukuran payload untuk setiap command (Batas Discord: 8000 bytes)
      for (let i = 0; i < commandsArray.length; i++) {
        const cmd = commandsArray[i];
        const cmdSize = JSON.stringify(cmd).length;
        if (cmdSize >= 8000) {
          logger.error(
            `[DEPLOY ERROR] Command "/${cmd.name}" (index #${i}) berukuran ${cmdSize} bytes, MELEBIHI batas Discord API (8000 bytes)!`,
          );
        } else if (cmdSize >= 7000) {
          logger.warn(
            `[DEPLOY WARNING] Command "/${cmd.name}" (index #${i}) berukuran ${cmdSize} bytes mendekati batas maksimal 8000 bytes.`,
          );
        }
      }

      // Pre-flight check jumlah command. Discord membatasi 100 CHAT_INPUT +
      // 15 USER + 15 MESSAGE per scope, dan bulk overwrite menolak array di
      // atas 130 entri dengan BASE_TYPE_MAX_LENGTH "Must be 130 or fewer".
      // Tanpa penjagaan ini seluruh deploy gagal dan bot tampil tanpa satu
      // pun slash command, padahal hanya beberapa yang kelebihan.
      const MAX_TOTAL_COMMANDS = 130;
      const MAX_CHAT_INPUT = 100;
      const chatInputCount = commandsArray.filter(
        (c) => !c.type || c.type === 1,
      ).length;

      if (commandsArray.length > MAX_TOTAL_COMMANDS) {
        logger.error(
          `[DEPLOY ERROR] Total ${commandsArray.length} command dikirim, MELEBIHI batas Discord (${MAX_TOTAL_COMMANDS}). ` +
            `Deploy pasti ditolak. Kurangi jumlah command atau gabungkan beberapa ke dalam subcommand.`,
        );
      }
      if (chatInputCount > MAX_CHAT_INPUT) {
        logger.error(
          `[DEPLOY ERROR] ${chatInputCount} slash command (CHAT_INPUT) terdaftar, MELEBIHI batas Discord (${MAX_CHAT_INPUT}). ` +
            `Gabungkan command sejenis menjadi subcommand dari satu command induk.`,
        );
      }

      // Deploy strategy: Guild-only in development (instant), Global in production.
      // Deploying both simultaneously causes duplicate entries in Discord's command list.
      const isDev = env.NODE_ENV !== "production";

      if (isDev && guildId) {
        // Development: deploy to guild only (instant, no global pollution)
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: commandsArray,
        });
        logger.info(
          `[DEPLOY] ${commandsArray.length} command didaftarkan ke guild ${guildId} (dev mode).`,
        );
      } else {
        // Production: deploy globally only (takes up to 1 hour to propagate)
        await rest.put(Routes.applicationCommands(clientId), {
          body: commandsArray,
        });
        logger.info(
          `[DEPLOY] ${commandsArray.length} command didaftarkan secara global.`,
        );

        // Clear any leftover guild commands from dev mode to prevent duplicates
        if (guildId) {
          try {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
              body: [],
            });
            logger.info(
              `[DEPLOY] Guild commands dibersihkan untuk mencegah duplikasi.`,
            );
          } catch (cleanErr) {
            logger.warn(
              `[DEPLOY] Gagal membersihkan guild commands: ${cleanErr.message}`,
            );
          }
        }
      }

      writeDeployCache({
        signature,
        clientId,
        guildId,
        count: commandsArray.length,
        deployedAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      if (error.rawError && error.rawError.errors) {
        for (const [key, val] of Object.entries(error.rawError.errors)) {
          // "_errors" adalah galat level dokumen (mis. array command terlalu
          // panjang), bukan index command. Sebelumnya key ini di-parseInt
          // menjadi NaN sehingga log menyebut "index #_errors (/unknown)"
          // dan menyembunyikan penyebab sebenarnya.
          if (key === "_errors") {
            logger.error(
              `[DEPLOY DETAIL] Galat pada keseluruhan payload (bukan satu command tertentu): ${JSON.stringify(val)}`,
            );
            continue;
          }
          const idx = parseInt(key, 10);
          const offendingCmd = Number.isNaN(idx) ? null : commandsArray[idx];
          logger.error(
            `[DEPLOY DETAIL] Galat pada command index #${key} (/${offendingCmd?.name || "unknown"}):`,
            JSON.stringify(val),
          );
        }
      }
      // Penanda sengaja tidak ditulis saat gagal, supaya boot berikutnya
      // mencoba lagi alih-alih menganggap deploy sudah beres.
      logger.error("[DEPLOY] Gagal menyinkronkan slash command:", error);
      return false;
    }
  }
}

module.exports = { CommandHandler };
