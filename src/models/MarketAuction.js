const { DataTypes } = require("sequelize");
const { sequelize } = require("../managers/dbManager");

const MarketAuction = sequelize.define(
  "MarketAuction",
  {
    id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    sellerId: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    itemId: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    currency: {
      type: DataTypes.ENUM("nsf", "coin"),
      allowNull: false,
      defaultValue: "nsf",
    },
    startingPrice: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    currentBid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    highestBidderId: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "sold", "expired", "claimed"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "market_auctions",
    timestamps: true,
    indexes: [
      {
        fields: ["status", "expiresAt"],
      },
      {
        fields: ["sellerId", "status"],
      },
    ],
  },
);

module.exports = MarketAuction;
