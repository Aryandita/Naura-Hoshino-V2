"use strict";

/**
 * Model UserPortfolio
 *
 * Satu baris per user. Menyimpan konfigurasi tampilan halaman portfolio publik.
 * Hanya user yang login sebagai dirinya sendiri (via Discord OAuth) yang bisa
 * menulis data ini. Siapa pun bisa membaca jika isPublic = true.
 *
 * Aturan penting:
 * - Gunakan findOrCreate agar tidak ada duplikat per userId.
 * - Fitur bertanda [PREMIUM] hanya boleh disimpan jika UserProfile.isPremium = true.
 *   Validasi dilakukan di route, bukan di model.
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const VALID_THEMES = ["default", "sakura", "cyber", "midnight"];
const VALID_BG_TYPES = ["particles", "gradient", "image"];
const VALID_SECTIONS = [
  "survival",
  "music",
  "cards",
  "economy",
  "achievements",
  "pets",
  "clan",
  "social",
  "minigames",
];

const UserPortfolio = sequelize.define(
  "UserPortfolio",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      comment: "Discord User ID. Relasi 1:1 dengan UserProfile.",
    },

    // --- VISIBILITAS ---
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment:
        "Jika false, halaman portfolio hanya bisa dilihat oleh pemilik saat login.",
    },

    // --- IDENTITAS ---
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Deskripsi singkat diri. Maksimal 500 karakter.",
    },
    tagline: {
      type: DataTypes.STRING(80),
      allowNull: true,
      comment: "Kalimat pendek di bawah nama. Maksimal 80 karakter.",
    },

    // --- TEMA & TAMPILAN ---
    theme: {
      type: DataTypes.STRING(20),
      defaultValue: "default",
      allowNull: false,
      validate: {
        isIn: {
          args: [VALID_THEMES],
          msg: `Tema harus salah satu dari: ${VALID_THEMES.join(", ")}`,
        },
      },
      comment: "Tema warna halaman. default/sakura/cyber/midnight.",
    },
    accentColor: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        is: {
          args: /^#[0-9A-Fa-f]{6}$/,
          msg: "Format warna aksen harus hex (#RRGGBB).",
        },
      },
      comment: "[PREMIUM] Warna aksen kustom dalam format hex (#RRGGBB).",
    },
    bgType: {
      type: DataTypes.STRING(20),
      defaultValue: "particles",
      allowNull: false,
      validate: {
        isIn: {
          args: [VALID_BG_TYPES],
          msg: `Tipe background harus salah satu dari: ${VALID_BG_TYPES.join(", ")}`,
        },
      },
      comment: "Tipe background: particles (default), gradient, atau image.",
    },
    bgValue: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "[PREMIUM] URL gambar background jika bgType = image.",
    },

    // --- KONTEN ---
    showcaseSections: {
      type: DataTypes.JSON,
      defaultValue: ["survival", "music", "cards", "economy", "achievements"],
      comment: "Urutan dan daftar seksi yang ditampilkan di halaman publik.",
      get() {
        const raw = this.getDataValue("showcaseSections");
        if (typeof raw === "string") {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        }
        return Array.isArray(raw) ? raw : [];
      },
    },
    pinnedCardId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "ID UserCard yang di-pin di bagian paling atas kartu.",
    },

    // --- SOCIAL LINKS (OVERRIDE) ---
    socialLinks: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment:
        "Override link sosmed: { youtube, instagram, x, tiktok, github }. Prioritas di atas UserProfile.social_*.",
      get() {
        const raw = this.getDataValue("socialLinks");
        if (typeof raw === "string") {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        }
        return raw && typeof raw === "object" ? raw : {};
      },
    },

    // --- PREMIUM BADGE ---
    customBadge: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment:
        "[PREMIUM] Teks badge kustom di bawah username. Maksimal 20 karakter.",
    },

    // --- STATISTIK ---
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: "Jumlah kali halaman portfolio dilihat (publik).",
    },
  },
  {
    tableName: "user_portfolios",
    timestamps: true,
  },
);

module.exports = UserPortfolio;
module.exports.VALID_THEMES = VALID_THEMES;
module.exports.VALID_BG_TYPES = VALID_BG_TYPES;
module.exports.VALID_SECTIONS = VALID_SECTIONS;
