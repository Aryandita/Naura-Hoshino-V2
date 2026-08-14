const { DataTypes } = require("sequelize");
const { sequelize } = require("../managers/dbManager");

const Giveaway = sequelize.define(
  "Giveaway",
  {
    messageId: { type: DataTypes.STRING, primaryKey: true },
    channelId: { type: DataTypes.STRING, allowNull: false },
    guildId: { type: DataTypes.STRING, allowNull: false },
    prize: { type: DataTypes.STRING, allowNull: false },
    winnersCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    endTime: { type: DataTypes.DATE, allowNull: false },
    hostId: { type: DataTypes.STRING, allowNull: false },
    ended: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Persyaratan ikut giveaway (verifikasi real-time saat klik tombol)
    requirements: {
      type: DataTypes.JSON,
      defaultValue: null,
      comment: 'JSON: { requiredRoleId, minLevel, minAccountAgeDays, mustBeBooster }',
    },
    // Daftar peserta (userId[]) yang sudah klik tombol dan lulus verifikasi
    participants: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    // Daftar pemenang (userId[]) yang sudah diundi
    winners: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  },
  {
    tableName: "giveaways",
    timestamps: false,
    indexes: [
      { fields: ["guildId"] },
      { fields: ["ended", "endTime"] }
    ]
  },
);

module.exports = Giveaway;
