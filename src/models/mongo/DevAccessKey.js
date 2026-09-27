"use strict";

const mongoose = require("mongoose");

const DevAccessKeySchema = new mongoose.Schema(
  {
    keyString: { type: String, required: true, unique: true, index: true },
    createdBy: { type: String, required: true },
    assignedToUserId: { type: String, default: null, index: true },
    maxUses: { type: Number, default: 10 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.DevAccessKey ||
  mongoose.model("DevAccessKey", DevAccessKeySchema);
