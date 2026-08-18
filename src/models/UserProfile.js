const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserProfile = sequelize.define(
  "UserProfile",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    afk_mentions: { type: DataTypes.JSON, defaultValue: [] },
    afk_reason: { type: DataTypes.STRING, allowNull: true },
    afk_timestamp: { type: DataTypes.DATE, allowNull: true },

    // --- ECONOMY ---
    economy_wallet: { type: DataTypes.INTEGER, defaultValue: 0 },
    economy_bank: { type: DataTypes.INTEGER, defaultValue: 0 },
    economy_lastInterest: { type: DataTypes.DATE, allowNull: true },
    economy_deposit: {
      type: DataTypes.JSON,
      defaultValue: {
        amount: 0,
        unlockDate: null,
        interestRate: 0,
        termName: null,
      },
    },
    economy_investments: {
      type: DataTypes.JSON,
      defaultValue: {
        gold: 0,
        goldBuyDay: 0,
        prop: 0,
        propBuyDay: 0,
        tech: 0,
        techBuyDay: 0,
        energy: 0,
        energyBuyDay: 0,
        capital: 0,
        capitalBuyDay: 0,
      },
    },

    // --- DATA FLEKSIBEL ---
    inventory: {
      type: DataTypes.JSON,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("inventory");
        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }
        return Array.isArray(raw) ? raw : [];
      },
    },
    tool_pickaxeLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
    tool_pickaxeDurability: { type: DataTypes.INTEGER, defaultValue: 100 },
    tool_axeLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
    tool_axeDurability: { type: DataTypes.INTEGER, defaultValue: 100 },
    tool_fishingRodLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
    tool_fishingRodDurability: { type: DataTypes.INTEGER, defaultValue: 100 },
    weapon_level: { type: DataTypes.INTEGER, defaultValue: 1 },
    weapon_element: { type: DataTypes.STRING, defaultValue: "netral" },
    dungeon_floor: { type: DataTypes.INTEGER, defaultValue: 1 },

    // --- SOCIAL MEDIA ---
    social_youtube: { type: DataTypes.STRING, allowNull: true },
    social_instagram: { type: DataTypes.STRING, allowNull: true },
    social_x: { type: DataTypes.STRING, allowNull: true },
    social_facebook: { type: DataTypes.STRING, allowNull: true },

    cooldowns: { type: DataTypes.JSON, defaultValue: {} },

    // --- MINIGAMES ---
    minigame_mathScore: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_triviaScore: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_rpsWin: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_tttWin: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_wordleWin: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_duelScore: { type: DataTypes.INTEGER, defaultValue: 0 },

    reputation: { type: DataTypes.INTEGER, defaultValue: 0 },
    language: { type: DataTypes.STRING, defaultValue: null },
    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    premiumUntil: { type: DataTypes.DATE, allowNull: true },

    minecraft_ign: { type: DataTypes.STRING, allowNull: true },
    minecraft_playtime: { type: DataTypes.INTEGER, defaultValue: 0 },

    // --- MUSIC PROFILE ---
    music_tracksListened: { type: DataTypes.INTEGER, defaultValue: 0 },
    music_totalDurationMs: { type: DataTypes.BIGINT, defaultValue: 0 },
    music_favoriteGenre: {
      type: DataTypes.STRING,
      defaultValue: "Belum Terdeteksi",
    },
    music_lastListened: {
      type: DataTypes.STRING,
      defaultValue: "Belum ada lagu",
    },
    music_playlist: { type: DataTypes.JSON, defaultValue: [] },

    // ==========================================
    // 📊 DATA ANALITIK CANVAS (YANG SEBELUMNYA HILANG)
    // ==========================================
    music_topTrack: {
      type: DataTypes.JSON,
      defaultValue: { name: "Belum ada data", durationMs: 0 },
    },
    music_topFriend: {
      type: DataTypes.JSON,
      defaultValue: { name: "Belum mabar", durationMs: 0 },
    },
    music_topServer: {
      type: DataTypes.JSON,
      defaultValue: { name: "Belum ada server", durationMs: 0 },
    },
    music_trackingData: {
      type: DataTypes.JSON,
      defaultValue: { tracks: {}, friends: {}, servers: {} },
    },

    // --- LEVELING ---
    leveling_xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    leveling_level: { type: DataTypes.INTEGER, defaultValue: 1 },
    leveling_lastXp: { type: DataTypes.DATE, allowNull: true },

    // --- PREFERENSI NOTIFIKASI ---
    dailyNotify: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
    },
    dailyReminded: { type: DataTypes.BOOLEAN, defaultValue: false },
    
    // --- PREFERENSI NOTIFIKASI DM ---
    notification_prefs: {
      type: DataTypes.JSON,
      defaultValue: {
        dm_authorized: false, // Apakah user sudah menyetujui penerimaan DM
        stamina_full: true,   // Notif Stamina
        quest_reset: true,    // Notif Quest
        event_news: true      // Notif Event Baru
      }
    },
    
    // --- AI PERSONA ---
    aiPersona: {
      type: DataTypes.JSON,
      defaultValue: {
        name: null,
        systemPrompt: null,
        avatarUrl: null
      }
    },

    // --- KOSMETIK ---
    activeBanners: {
      type: DataTypes.JSON,
      defaultValue: {
        profile: null,
        music: null
      }
    }
  },
  {
    tableName: "user_profiles",
    timestamps: false,
    hooks: {
      beforeUpdate: (profile, options) => {
        if (profile.changed("cooldowns")) {
          profile.dailyReminded = false;
        }
      },
    },
  },
);

module.exports = UserProfile;
