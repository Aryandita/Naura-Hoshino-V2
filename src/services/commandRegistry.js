"use strict";

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

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.categories = new Map();
    this.subcommandIndex = new Map();
    this.aliasIndex = new Map();
    this.isBuilt = false;
  }

  normalizeCategory(rawCategory) {
    if (!rawCategory) return "utility";
    const cat = String(rawCategory).toLowerCase().trim();
    if (cat === "minigame") return "minigames";
    if (cat === "ticket") return "modmail";
    if (cat === "moderation") return "admin";
    if (PUBLIC_CATEGORIES.includes(cat)) return cat;
    return cat;
  }

  ensureBuilt(client = null) {
    if (!this.isBuilt) {
      this.buildRegistry(client);
    }
    return this;
  }

  buildRegistry(client) {
    this.commands.clear();
    this.categories.clear();
    this.subcommandIndex.clear();
    this.aliasIndex.clear();

    for (const catId of PUBLIC_CATEGORIES) {
      this.categories.set(catId, []);
    }

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
          if (command.isSubcommand) continue;

          if (("data" in command || "name" in command) && ("execute" in command || "executePrefix" in command)) {
            const rawData =
              typeof command.data?.toJSON === "function"
                ? command.data.toJSON()
                : (command.data || command);
            const cmdName = (rawData.name || command.name).toLowerCase();
            const relPath = path.relative(pluginDir, filePath);
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

  populateFromClient(client) {
    if (!client || !client.commands) {
      return this;
    }

    if (client.aliases) {
      for (const [alias, target] of client.aliases.entries()) {
        this.aliasIndex.set(alias.toLowerCase(), target.toLowerCase());
      }
    }

    for (const [rawCmdName, cmdObj] of client.commands.entries()) {
      const rawData =
        typeof cmdObj.data?.toJSON === "function"
          ? cmdObj.data.toJSON()
          : (cmdObj.data || cmdObj);

      const name = (rawData.name || cmdObj.name || rawCmdName).toLowerCase();
      const rawCat = cmdObj.category || "utility";
      const normalizedCat = this.normalizeCategory(rawCat);

      if (normalizedCat === "owner") {
        continue;
      }

      const description =
        rawData.description || cmdObj.description || "Tidak ada deskripsi.";
      const aliases = Array.isArray(cmdObj.aliases) ? cmdObj.aliases : [];
      for (const a of aliases) {
        this.aliasIndex.set(a.toLowerCase(), name);
      }

      const subcommands = [];
      const rootOptions = [];

      if (Array.isArray(rawData.options)) {
        for (const opt of rawData.options) {
          if (opt.type === 1) {
            const subOpts = Array.isArray(opt.options)
              ? opt.options.map((so) => ({
                  name: so.name,
                  description: so.description || "",
                  required: Boolean(so.required),
                  type: so.type,
                  choices: Array.isArray(so.choices)
                    ? so.choices.map((c) => c.name || c.value)
                    : [],
                }))
              : [];

            const subItem = {
              name: opt.name,
              fullName: `${name} ${opt.name}`,
              description: opt.description || "",
              options: subOpts,
              syntax: this.formatSyntax(name, opt.name, subOpts),
            };

            subcommands.push(subItem);
            this.subcommandIndex.set(`${name} ${opt.name}`, {
              ...subItem,
              root: name,
              category: normalizedCat,
            });

            if (!this.subcommandIndex.has(opt.name)) {
              this.subcommandIndex.set(opt.name, {
                ...subItem,
                root: name,
                category: normalizedCat,
              });
            }
          } else if (opt.type === 2 && Array.isArray(opt.options)) {
            for (const nested of opt.options) {
              if (nested.type === 1) {
                const subOpts = Array.isArray(nested.options)
                  ? nested.options.map((so) => ({
                      name: so.name,
                      description: so.description || "",
                      required: Boolean(so.required),
                      type: so.type,
                      choices: Array.isArray(so.choices)
                        ? so.choices.map((c) => c.name || c.value)
                        : [],
                    }))
                  : [];

                const subItem = {
                  name: nested.name,
                  group: opt.name,
                  fullName: `${name} ${opt.name} ${nested.name}`,
                  description: nested.description || "",
                  options: subOpts,
                  syntax: this.formatSyntax(`${name} ${opt.name}`, nested.name, subOpts),
                };

                subcommands.push(subItem);
                this.subcommandIndex.set(`${name} ${opt.name} ${nested.name}`, {
                  ...subItem,
                  root: name,
                  category: normalizedCat,
                });

                if (!this.subcommandIndex.has(nested.name)) {
                  this.subcommandIndex.set(nested.name, {
                    ...subItem,
                    root: name,
                    category: normalizedCat,
                  });
                }
              }
            }
          } else {
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

      const syntax =
        subcommands.length > 0
          ? `/${name} <subcommand> [opsi]`
          : this.formatSyntax(name, null, rootOptions);

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

      if (this.categories.has(normalizedCat)) {
        this.categories.get(normalizedCat).push(commandEntry);
      } else {
        this.categories.set(normalizedCat, [commandEntry]);
      }
    }

    for (const [, list] of this.categories.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    this.isBuilt = true;
    return this;
  }

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

  getCategoryKeys() {
    const keys = [...PUBLIC_CATEGORIES];
    for (const catId of this.categories.keys()) {
      if (!keys.includes(catId) && catId !== "owner") {
        keys.push(catId);
      }
    }
    return keys;
  }

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

  getCommandDetail(query) {
    if (!query || typeof query !== "string") return null;

    let clean = query.trim().toLowerCase();
    clean = clean.replace(/^\/+/, "").replace(/\s+\/+/g, " ").trim();
    if (!clean) return null;

    const parts = clean.split(/\s+/);

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

    let rootName = parts[0];
    if (this.aliasIndex.has(rootName)) {
      rootName = this.aliasIndex.get(rootName);
    }

    const rootEntry = this.commands.get(rootName);
    if (rootEntry) {
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

  getAllCommands() {
    return Array.from(this.commands.values());
  }

  getTotalCommandCount() {
    return this.commands.size;
  }
}

const commandRegistry = new CommandRegistry();

module.exports = commandRegistry;
module.exports.CommandRegistry = CommandRegistry;
module.exports.PUBLIC_CATEGORIES = PUBLIC_CATEGORIES;
module.exports.CATEGORY_METADATA = CATEGORY_METADATA;
