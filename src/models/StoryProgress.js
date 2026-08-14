const { DataTypes } = require("sequelize");
const { sequelize } = require("../managers/dbManager");

const StoryProgress = sequelize.define(
  "StoryProgress",
  {
    userId: {
      type: DataTypes.STRING(25),
      primaryKey: true,
      allowNull: false,
    },
    currentArc: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    currentChapter: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    alignment: {
      type: DataTypes.STRING,
      defaultValue: "neutral", // 'neutral', 'light' (Yang), 'dark' (Yin)
    },
    unlockedLore: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  },
  {
    tableName: "story_progress",
    timestamps: true,
  },
);

module.exports = StoryProgress;
