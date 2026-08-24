"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserCardDeck = sequelize.define(
  "UserCardDeck",
  {
    userId: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    activeDeck: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [], // Array of 3 cardCodes
    },
    towerFloor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    highestFloor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    wins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    losses: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    eloRating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
    },
  },
  {
    tableName: "user_card_decks",
    timestamps: true,
    indexes: [
      {
        name: "idx_user_card_decks_userId",
        fields: ["userId"],
      },
      {
        name: "idx_user_card_decks_elo",
        fields: ["eloRating"],
      },
    ],
  },
);

module.exports = UserCardDeck;
