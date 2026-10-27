"use strict";

/**
 * 📋 Command Registry Service - Naura Hoshino V2
 * -----------------------------------------------
 * Central registry for all bot commands with metadata indexing.
 * Provides command lookup, category management, and syntax formatting.
 *
 * Features:
 * - Automatic command discovery from client or plugin directory
 * - Category-based organization with metadata
 * - Subcommand and alias indexing
 * - Syntax formatting for help display
 * - Dynamic category support
 *
 * @module src/services/commandRegistry
 */

const PUBLIC_CATEGORIES = [
  "core",
  "music",
  "survival",
  "card",
  "ai",
  "leveling",
  "minigames",
  "fun",
  "utility",
  "premium",
  "naura",
  "admin",
  "modmail",
];

/** @type {Object.<string, CategoryMetadata>} Category metadata definitions */
const CATEGORY_METADATA = {
  core: {
    id: "core",
    emoji: "⚙️",
    label: "Core System",
    description: "Sistem inti, status telemetri, ping, dan informasi bot",
  },
  music: {
    id: "music",
    emoji: "🎵",
    label: "Musik & Audio",
    description: "Pemutar lagu studio Lavalink, federasi Hi-Fi, dan filter audio",
  },
  survival: {
    id: "survival",
    emoji: "🏕️",
    label: "Naura Wilds RPG",
    description: "Petualangan RPG, dungeon, crafting, vitals, dan ekonomi",
  },
  card: {
    id: "card",
    emoji: "🃏",
    label: "Koleksi Kartu",
    description: "Koleksi kartu anime, fusion, gacha, dan duel kartu",
  },
  ai: {
    id: "ai",
    emoji: "🤖",
    label: "Kecerdasan AI",
    description: "AI Ensemble multi-model, percakapan, story mode, dan visi",
  },
  leveling: {
    id: "leveling",
    emoji: "⭐",
    label: "Leveling & XP",
    description: "Peringkat server, leaderboard, dan kartu profil level",
  },
  minigames: {
    id: "minigames",
    emoji: "🎮",
    label: "Minigame & Arcade",
    description: "Permainan interaktif, tebak angka, tic-tac-toe, dan tantangan",
  },
  fun: {
    id: "fun",
    emoji: "🎉",
    label: "Hiburan & Sosial",
    description: "Hub hiburan santai: omikuji, dadu, bola ajaib, ship, dan tod",
  },
  utility: {
    id: "utility",
    emoji: "🧰",
    label: "Utilitas & Alat",
    description: "Alat produktivitas, downloader, kalkulator, cuaca, dan profil",
  },
  premium: {
    id: "premium",
    emoji: "💎",
    label: "Naura VIP Premium",
    description: "Informasi langganan, aktivasi voucher, dan benefit khusus",
  },
  naura: {
    id: "naura",
    emoji: "🌸",
    label: "Companion Naura",
    description: "Interaksi personal, afeksi, ruang santai, dan kisah Naura",
  },
  admin: {
    id: "admin",
    emoji: "🛠️",
    label: "Admin & Keamanan",
    description: "Moderasi, keamanan server, pembersihan pesan, dan audit",
  },
  modmail: {
    id: "modmail",
    emoji: "📬",
    label: "Modmail & Tiket",
    description: "Layanan pesan bantuan staf dan pelaporan tiket server",
  },
};

// ============================================================================
// COMMAND REGISTRY CLASS
// ============================================================================

class CommandRegistry {
  constructor() {
    /** @type {Map<string, CommandEntry>} Command name → entry */
    this.commands = new Map();

    /** @type {Map<string, Array<CommandEntry>>} Category → commands list */
    this.categories = new Map();

    /** @type {Map<string, SubcommandEntry>} Full subcommand path → entry */
    this.subcommandIndex = new Map();

    /** @type {Map<string, string>} Alias → command name */
    this.aliasIndex = new Map();

    /** @type {boolean} Whether registry has been built */
    this.isBuilt = false;
  }

  // ============================================================================
  // CATEGORY NORMALIZATION
  // ============================================================================

  /**
   * Normalize category name to standard form.
   * Handles aliases and variations.
   * @param {string} rawCategory - Raw category name
   * @returns {string} Normalized category name
   */
  normalizeCategory(rawCategory) {
    if (!rawCategory) return "utility";

    const cat = String(rawCategory).toLowerCase().trim();

    // Handle common aliases
    if (cat === "minigame") return "minigames";
    if (cat === "ticket") return "modmail";
    if (cat === "moderation") return "admin";

    // Return as-is if in public categories
    if (PUBLIC_CATEGORIES.includes(cat)) return cat;

    return cat;
  }

  // ============================================================================
  // REGISTRY BUILDING
  // ============================================================================

  /**
   * Ensure registry is built, building if necessary.
   * @param {object} [client=null] - Discord client (optional)
   * @returns {CommandRegistry} This instance
   */
  ensureBuilt(client = null) {
    if (!this.isBuilt) {
      this.buildRegistry(client);
    }
    return this;
  }

  /**
   * Build command registry from client or auto-scan plugin directory.
   * @param {object} [client] - Discord client with commands map
   * @returns {CommandRegistry} This instance
   */
  buildRegistry(client) {
    // Clear existing data
    this.commands.clear();
    this.categories.clear();
    this.subcommandIndex.clear();
    this.aliasIndex.clear();

    // Initialize categories
    for (const catId of PUBLIC_CATEGORIES) {
      this.categories.set(catId, []);
    }

    // Determine source: client or auto-scan
    let targetClient = client;
    if (targetClient === undefined || targetClient === null) {
      try {
        const { container } = require("../core/container");
        if (container && container.has("client")) {
          targetClient = container.resolve("client");
        }
      } catch (_) {}
    }

    if (targetClient && targetClient.commands && targetClient.commands.size > 0) {
      this.populateFromClient(targetClient);
    } else if (client === undefined || client === null) {
      this.autoScanPluginDirectory();
    }

    this.isBuilt = true;
    return this;
  }

  /**
   * Auto-scan plugin directory for command files.
   * @param {string} [customPluginDir=null] - Custom plugin directory path
   * @returns {CommandRegistry} This instance
   */
  autoScanPluginDirectory(customPluginDir = null) {
    const path = require("node:path");
    const fs = require("node:fs");
    const pluginDir = customPluginDir || path.resolve(__dirname, "../../plugin");

    if (!fs.existsSync(pluginDir)) return this;

    try {
      const glob = require("fast-glob");
      const searchPattern = path.posix.join(
        pluginDir.split(path.sep).join("/"),
        "**/*.js",
      );

      const commandFiles = glob.sync(searchPattern, {
        ignore: [
          "**/subcommands/**",
          "**/helpers/**",
          "**/*.test.js",
          "**/*.spec.js",
        ],
      });

      const mockCommands = new Map();
      const mockAliases = new Map();

      for (const filePath of commandFiles) {
        const normalizedPath = filePath.replace(/\\/g, "/");

        // Skip excluded paths
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
          const command = require(absPath);

          // Skip subcommands
          if (command.isSubcommand) continue;

          // Validate command structure
          if (("data" in command || "name" in command) && ("execute" in command || "executePrefix" in command)) {
            const rawData =
              typeof command.data?.toJSON === "function"
                ? command.data.toJSON()
                : (command.data || command);

            const cmdName = (rawData.name || command.name).toLowerCase();
            const relPath = path.relative(pluginDir, filePath);

            // Determine category from file path
            let category = command.category;
            if (!category) {
              const parts = relPath.split(path.sep);
              if (parts.length > 1) {
                category = parts[0];
              } else {
                category = path.basename(pluginDir).replace(/\.js$/, "");
              }
            }
            command.category = category;

            mockCommands.set(cmdName, command);

            // Register aliases
            if (Array.isArray(command.aliases)) {
              for (const a of command.aliases) {
                mockAliases.set(a.toLowerCase(), cmdName);
              }
            }
          }
        } catch (_) {}
      }

      this.populateFromClient({ commands: mockCommands, aliases: mockAliases });
    } catch (_) {}

    return this;
  }

  /**
   * Populate registry from client commands map.
   * @param {object} client - Client with commands and aliases maps
   * @returns {CommandRegistry} This instance
   */
  populateFromClient(client) {
    if (!client || !client.commands) {
      return this;
    }

    // Register aliases
    if (client.aliases) {
      for (const [alias, target] of client.aliases.entries()) {
        this.aliasIndex.set(alias.toLowerCase(), target.toLowerCase());
      }
    }

    // Process each command
    for (const [rawCmdName, cmdObj] of client.commands.entries()) {
      const rawData =
        typeof cmdObj.data?.toJSON === "function"
          ? cmdObj.data.toJSON()
          : (cmdObj.data || cmdObj);

      const name = (rawData.name || cmdObj.name || rawCmdName).toLowerCase();
      const rawCat = cmdObj.category || "utility";
      const normalizedCat = this.normalizeCategory(rawCat);

      // Skip owner-only commands
      if (normalizedCat === "owner") {
        continue;
      }

      const description =
        rawData.description || cmdObj.description || "Tidak ada deskripsi.";
      const aliases = Array.isArray(cmdObj.aliases) ? cmdObj.aliases : [];

      // Register aliases
      for (const a of aliases) {
        this.aliasIndex.set(a.toLowerCase(), name);
      }

      // Extract subcommands and options
      const subcommands = [];
      const rootOptions = [];

      if (Array.isArray(rawData.options)) {
        this._processOptions(rawData.options, name, normalizedCat, subcommands, rootOptions);
      }

      // Build syntax
      const syntax =
        subcommands.length > 0
          ? `/${name} <subcommand> [opsi]`
          : this.formatSyntax(name, null, rootOptions);

      // Create command entry
      const commandEntry = {
        name,
        description,
        category: normalizedCat,
        aliases,
        subcommands,
        options: rootOptions,
        syntax,
      };

      this.commands.set(name, commandEntry);

      // Add to category
      if (this.categories.has(normalizedCat)) {
        this.categories.get(normalizedCat).push(commandEntry);
      } else {
        this.categories.set(normalizedCat, [commandEntry]);
      }
    }

    // Sort commands within categories
    for (const [, list] of this.categories.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    this.isBuilt = true;
    return this;
  }

  /**
   * Process command options to extract subcommands and root options.
   * @private
   * @param {Array} options - Options array from command data
   * @param {string} rootName - Root command name
   * @param {string} category - Normalized category
   * @param {Array} subcommands - Output subcommands array
   * @param {Array} rootOptions - Output root options array
   */
  _processOptions(options, rootName, category, subcommands, rootOptions) {
    for (const opt of options) {
      // Type 1 = Subcommand
      if (opt.type === 1) {
        const subOpts = this._extractOptionDetails(opt.options);
        const subItem = {
          name: opt.name,
          fullName: `${rootName} ${opt.name}`,
          description: opt.description || "",
          options: subOpts,
          syntax: this.formatSyntax(rootName, opt.name, subOpts),
        };

        subcommands.push(subItem);
        this.subcommandIndex.set(`${rootName} ${opt.name}`, {
          ...subItem,
          root: rootName,
          category,
        });

        // Also index by short name if not taken
        if (!this.subcommandIndex.has(opt.name)) {
          this.subcommandIndex.set(opt.name, {
            ...subItem,
            root: rootName,
            category,
          });
        }
      }
      // Type 2 = Subcommand Group
      else if (opt.type === 2 && Array.isArray(opt.options)) {
        for (const nested of opt.options) {
          if (nested.type === 1) {
            const subOpts = this._extractOptionDetails(nested.options);
            const subItem = {
              name: nested.name,
              group: opt.name,
              fullName: `${rootName} ${opt.name} ${nested.name}`,
              description: nested.description || "",
              options: subOpts,
              syntax: this.formatSyntax(`${rootName} ${opt.name}`, nested.name, subOpts),
            };

            subcommands.push(subItem);
            this.subcommandIndex.set(`${rootName} ${opt.name} ${nested.name}`, {
              ...subItem,
              root: rootName,
              category,
            });

            if (!this.subcommandIndex.has(nested.name)) {
              this.subcommandIndex.set(nested.name, {
                ...subItem,
                root: rootName,
                category,
              });
            }
          }
        }
      }
      // Other types = Root options
      else {
        rootOptions.push({
          name: opt.name,
          description: opt.description || "",
          required: Boolean(opt.required),
          type: opt.type,
          choices: Array.isArray(opt.choices)
            ? opt.choices.map((c) => c.name || c.value)
            : [],
        });
      }
    }
  }

  /**
   * Extract option details from options array.
   * @private
   * @param {Array} options - Options array
   * @returns {Array} Extracted option details
   */
  _extractOptionDetails(options) {
    if (!Array.isArray(options)) return [];

    return options.map((so) => ({
      name: so.name,
      description: so.description || "",
      required: Boolean(so.required),
      type: so.type,
      choices: Array.isArray(so.choices)
        ? so.choices.map((c) => c.name || c.value)
        : [],
    }));
  }

  // ============================================================================
  // SYNTAX FORMATTING
  // ============================================================================

  /**
   * Format command syntax string for display.
   * @param {string} root - Root command name
   * @param {string|null} sub - Subcommand name (or null)
   * @param {Array} options - Options array
   * @returns {string} Formatted syntax string
   */
  formatSyntax(root, sub, options = []) {
    const parts = sub ? [`/${root} ${sub}`] : [`/${root}`];

    for (const opt of options) {
      if (opt.required) {
        parts.push(`<${opt.name}>`);
      } else {
        parts.push(`[${opt.name}]`);
      }
    }

    return parts.join(" ");
  }

  // ============================================================================
  // CATEGORY ACCESSORS
  // ============================================================================

  /**
   * Get all category keys including dynamic ones.
   * @returns {Array<string>} Category keys
   */
  getCategoryKeys() {
    const keys = [...PUBLIC_CATEGORIES];

    for (const catId of this.categories.keys()) {
      if (!keys.includes(catId) && catId !== "owner") {
        keys.push(catId);
      }
    }

    return keys;
  }

  /**
   * Get all categories with metadata and command lists.
   * @returns {Array<CategoryWithCommands>} Categories with commands
   */
  getCategories() {
    const keys = this.getCategoryKeys();

    return keys.map((id) => {
      const meta = CATEGORY_METADATA[id] || {
        id,
        emoji: "📁",
        label: id.charAt(0).toUpperCase() + id.slice(1),
        description: `Kumpulan perintah modul ${id}`,
      };

      const list = this.categories.get(id) || [];

      return {
        ...meta,
        count: list.length,
        commands: list,
      };
    });
  }

  /**
   * Get single category with metadata and commands.
   * @param {string} id - Category ID
   * @returns {CategoryWithCommands} Category with commands
   */
  getCategory(id) {
    const normalized = this.normalizeCategory(id);

    const meta = CATEGORY_METADATA[normalized] || {
      id: normalized,
      emoji: "📁",
      label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      description: `Kumpulan perintah modul ${normalized}`,
    };

    const list = this.categories.get(normalized) || [];

    return {
      ...meta,
      count: list.length,
      commands: list,
    };
  }

  // ============================================================================
  // COMMAND LOOKUP
  // ============================================================================

  /**
   * Get detailed command information by query.
   * Supports root commands, subcommands, groups, and aliases.
   * @param {string} query - Command query (e.g., "play", "music play", "/music play")
   * @returns {CommandDetail|null} Command details or null if not found
   */
  getCommandDetail(query) {
    if (!query || typeof query !== "string") return null;

    // Clean query
    let clean = query.trim().toLowerCase();
    clean = clean.replace(/^\/+/, "").replace(/\s+\/+/g, " ").trim();
    if (!clean) return null;

    const parts = clean.split(/\s+/);

    // Try full subcommand match first (e.g., "music play")
    if (parts.length >= 2) {
      const fullSubKey = parts.join(" ");
      const subMatch = this.subcommandIndex.get(fullSubKey);
      if (subMatch) {
        return {
          type: "subcommand",
          root: subMatch.root,
          name: subMatch.fullName,
          subcommand: subMatch.name,
          group: subMatch.group,
          description: subMatch.description,
          syntax: subMatch.syntax,
          options: subMatch.options,
          category: subMatch.category,
        };
      }
    }

    // Try root command with subcommand
    let rootName = parts[0];
    if (this.aliasIndex.has(rootName)) {
      rootName = this.aliasIndex.get(rootName);
    }

    const rootEntry = this.commands.get(rootName);
    if (rootEntry) {
      // Check for grouped subcommand (3 parts: command group subcommand)
      if (parts.length >= 3) {
        const groupName = parts[1];
        const subName = parts[2];
        const foundSub = rootEntry.subcommands.find(
          (s) => s.group === groupName && s.name === subName,
        );
        if (foundSub) {
          return {
            type: "subcommand",
            root: rootEntry.name,
            name: foundSub.fullName,
            subcommand: foundSub.name,
            group: foundSub.group,
            description: foundSub.description,
            syntax: foundSub.syntax,
            options: foundSub.options,
            category: rootEntry.category,
          };
        }
      }

      // Check for simple subcommand (2 parts: command subcommand)
      if (parts.length >= 2) {
        const subName = parts[1];
        const foundSub = rootEntry.subcommands.find(
          (s) => s.name === subName || s.fullName === `${rootEntry.name} ${subName}`,
        );
        if (foundSub) {
          return {
            type: "subcommand",
            root: rootEntry.name,
            name: foundSub.fullName,
            subcommand: foundSub.name,
            group: foundSub.group,
            description: foundSub.description,
            syntax: foundSub.syntax,
            options: foundSub.options,
            category: rootEntry.category,
          };
        }

        // Check for subcommand group
        const groupSubs = rootEntry.subcommands.filter((s) => s.group === subName);
        if (groupSubs.length > 0) {
          return {
            type: "group",
            root: rootEntry.name,
            name: `${rootEntry.name} ${subName}`,
            group: subName,
            description: `Grup perintah /${rootEntry.name} ${subName}`,
            syntax: `/${rootEntry.name} ${subName} <subcommand> [opsi]`,
            subcommands: groupSubs,
            category: rootEntry.category,
          };
        }
      }

      // Return root command
      return {
        type: "command",
        name: rootEntry.name,
        description: rootEntry.description,
        syntax: rootEntry.syntax,
        options: rootEntry.options,
        subcommands: rootEntry.subcommands,
        aliases: rootEntry.aliases,
        category: rootEntry.category,
      };
    }

    // Try subcommand-only match
    const subOnlyMatch = this.subcommandIndex.get(clean);
    if (subOnlyMatch) {
      return {
        type: "subcommand",
        root: subOnlyMatch.root,
        name: subOnlyMatch.fullName,
        subcommand: subOnlyMatch.name,
        group: subOnlyMatch.group,
        description: subOnlyMatch.description,
        syntax: subOnlyMatch.syntax,
        options: subOnlyMatch.options,
        category: subOnlyMatch.category,
      };
    }

    return null;
  }

  /**
   * Get all registered commands.
   * @returns {Array<CommandEntry>} All commands
   */
  getAllCommands() {
    return Array.from(this.commands.values());
  }

  /**
   * Get total number of registered commands.
   * @returns {number} Command count
   */
  getTotalCommandCount() {
    return this.commands.size;
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} CategoryMetadata
 * @property {string} id - Category identifier
 * @property {string} emoji - Category emoji
 * @property {string} label - Display label
 * @property {string} description - Category description
 */

/**
 * @typedef {Object} CommandEntry
 * @property {string} name - Command name
 * @property {string} description - Command description
 * @property {string} category - Normalized category
 * @property {Array<string>} aliases - Command aliases
 * @property {Array<SubcommandEntry>} subcommands - Subcommands list
 * @property {Array<OptionEntry>} options - Root options
 * @property {string} syntax - Formatted syntax string
 */

/**
 * @typedef {Object} SubcommandEntry
 * @property {string} name - Subcommand name
 * @property {string} [group] - Subcommand group (if nested)
 * @property {string} fullName - Full path (e.g., "music play")
 * @property {string} description - Description
 * @property {Array<OptionEntry>} options - Subcommand options
 * @property {string} syntax - Formatted syntax
 * @property {string} [root] - Root command name
 * @property {string} [category] - Category
 */

/**
 * @typedef {Object} OptionEntry
 * @property {string} name - Option name
 * @property {string} description - Option description
 * @property {boolean} required - Is required
 * @property {number} type - Option type
 * @property {Array<string>} choices - Available choices
 */

/**
 * @typedef {Object} CommandDetail
 * @property {'command'|'subcommand'|'group'} type - Result type
 * @property {string} name - Full name/path
 * @property {string} [root] - Root command (for subcommands)
 * @property {string} [subcommand] - Subcommand name
 * @property {string} [group] - Group name
 * @property {string} description - Description
 * @property {string} syntax - Syntax string
 * @property {Array<OptionEntry>} [options] - Options
 * @property {Array<SubcommandEntry>} [subcommands] - Subcommands (for groups)
 * @property {Array<string>} [aliases] - Aliases (for root commands)
 * @property {string} category - Category
 */

/**
 * @typedef {Object} CategoryWithCommands
 * @property {string} id - Category ID
 * @property {string} emoji - Emoji
 * @property {string} label - Label
 * @property {string} description - Description
 * @property {number} count - Number of commands
 * @property {Array<CommandEntry>} commands - Commands in category
 */

// ============================================================================
// EXPORTS
// ============================================================================

const commandRegistry = new CommandRegistry();

module.exports = commandRegistry;
module.exports.CommandRegistry = CommandRegistry;
module.exports.PUBLIC_CATEGORIES = PUBLIC_CATEGORIES;
module.exports.CATEGORY_METADATA = CATEGORY_METADATA;
