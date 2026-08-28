const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Menginvalidasi cache setelah setiap penulisan.
 *
 * Dipasang di level model, bukan di setiap pemanggil, karena penulis
 * GuildSettings tersebar di interactionCreate, dashboard, cron, dan berbagai
 * plugin. Menaruhnya di satu tempat berarti tidak ada penulis baru yang bisa
 * lupa melakukannya.
 *
 * Hook mengembalikan promise, sehingga Sequelize menunggunya selesai sebelum
 * save() dianggap tuntas. Tanpa itu, pembacaan yang terjadi tepat setelah save()
 * masih berpeluang mengisi ulang cache dengan data lama.
 */
function invalidateGuildCache(guildId) {
  if (!guildId) return Promise.resolve();
  // Lazy require memutus siklus: modul ini <- cacheManager <- cacheInvalidator.
  const cacheInvalidator = require("../managers/cacheInvalidator");
  return cacheInvalidator.invalidateGuild(guildId).catch(() => {});
}

/** Mengambil guildId dari klausa where pada operasi bulk, bila ada. */
function guildIdFromOptions(options) {
  const where = options && options.where;
  if (!where) return null;
  return typeof where.guildId === "string" ? where.guildId : null;
}

const GuildSettings = sequelize.define(
  "GuildSettings",
  {
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },

    // Menggabungkan pengaturan ke dalam objek JSON
    music: {
      type: DataTypes.JSON,
      defaultValue: {
        twentyFourSeven: false,
        defaultVolume: 100,
        textChannel: null,
        voiceChannel: null,
        djRoleId: null,
      },
    },

    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        globalChat: { enabled: false, channelId: null },
        starboard: { enabled: false, channelId: null, threshold: 3 },
        qotd: {
          enabled: false,
          channelId: null,
          questions: [],
          lastAsked: null,
          time: "08:00",
        },
        ticket: { channelId: null, categoryId: null },
        minecraft: { ip: null, port: null },
        tempVoice: { channelId: null, categoryId: null },
        warn_punishments: { 1: "dm", 2: "mute", 3: "kick", 4: "ban" },
        sticky_roles: false,
        stickyMessage: { channelId: null, message: null },
        announcementChannel: null,
        auditLogChannel: null,
        autoRole: null,
        autoReplies: [],
        vanityRoles: {
          enabled: false,
          text: null,
          roles: [],
          channelId: null,
          message: null,
        },
        features: {
          leveling: false,
          economy: false,
          music: true,
        },
        antinuke: { enabled: false, actions: ["kick"], whitelist: [] },
        automod: {
          enabled: true,
          antiInvite: false,
          antiCaps: false,
          massMention: 5,
          antiSpam: true,
          badWords: [], // List kata kasar kustom per server
        },
        modmail: {
          enabled: false,
          categoryId: null,
          logChannelId: null, // Tempat mengirim transkrip saat ditutup
        },
        antiRaid: {
          enabled: false,
          joins: 5,
          seconds: 10,
          lockdown: false,
        },
        aiPersona: {
          name: null,
          systemPrompt: null,
        },
      },
    },

    system: {
      type: DataTypes.JSON,
      defaultValue: { prefix: "n!", language: "id" },
    },

    channels: {
      type: DataTypes.JSON,
      defaultValue: { counting: null, tod: null },
    },

    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    aiVoiceEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    premiumUntil: { type: DataTypes.DATE, allowNull: true },

    countingGame: {
      type: DataTypes.JSON,
      defaultValue: { currentNumber: 0, lastUser: null },
    },
  },
  {
    tableName: "guild_settings",
    timestamps: false,
    hooks: {
      afterCreate: (row) => invalidateGuildCache(row && row.guildId),
      afterUpdate: (row) => invalidateGuildCache(row && row.guildId),
      afterDestroy: (row) => invalidateGuildCache(row && row.guildId),
      afterUpsert: (result) => {
        const row = Array.isArray(result) ? result[0] : result;
        return invalidateGuildCache(row && row.guildId);
      },
      // Operasi bulk tidak memanggil hook instance kecuali individualHooks: true,
      // jadi jalur ini ditangani terpisah.
      afterBulkUpdate: (options) =>
        invalidateGuildCache(guildIdFromOptions(options)),
      afterBulkDestroy: (options) =>
        invalidateGuildCache(guildIdFromOptions(options)),
    },
  },
);

module.exports = GuildSettings;
