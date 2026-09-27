"use strict";

const mongoose = require("mongoose");

const AliasItemSchema = new mongoose.Schema({
  name: { type: String, required: true, lowercase: true, trim: true },
  targetCommand: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const UserAliasSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    aliases: [AliasItemSchema],
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.UserAlias || mongoose.model("UserAlias", UserAliasSchema);
