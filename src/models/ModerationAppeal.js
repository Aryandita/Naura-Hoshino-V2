const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ModerationAppeal = sequelize.define(
  "ModerationAppeal",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    moderatorId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    actionType: {
      type: DataTypes.ENUM("ban", "kick", "mute", "warn"),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    appealText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      defaultValue: "pending",
      allowNull: false,
    },
    reviewerId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reviewNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "moderation_appeals",
    timestamps: true,
    indexes: [
      { fields: ["guildId", "userId"] },
      { fields: ["status"] },
      { fields: ["createdAt"] },
    ],
  },
);

module.exports = ModerationAppeal;
