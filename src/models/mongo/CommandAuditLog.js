"use strict";

const mongoose = require("mongoose");

const CommandAuditLogSchema = new mongoose.Schema(
  {
    commandName: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    guildId: { type: String, default: "", index: true },
    channelId: { type: String, default: "" },
    shardId: { type: String, default: "0" },
    options: { type: Object, default: {} },
    executionTimeMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["SUCCESS", "ERROR", "COOLDOWN", "FORBIDDEN"],
      default: "SUCCESS",
    },
    errorMessage: { type: String, default: "" },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 60, // Auto TTL: 60 hari
    },
  },
  {
    timestamps: true,
    collection: "command_audit_logs",
  },
);

CommandAuditLogSchema.index({ guildId: 1, createdAt: -1 });

module.exports =
  mongoose.models.CommandAuditLog ||
  mongoose.model("CommandAuditLog", CommandAuditLogSchema);
