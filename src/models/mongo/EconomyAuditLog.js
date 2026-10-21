"use strict";

const mongoose = require("mongoose");

const EconomyAuditLogSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    actorId: { type: String, required: true, index: true },
    actorType: {
      type: String,
      enum: ["USER", "ADMIN", "OWNER", "SYSTEM", "CRON"],
      default: "SYSTEM",
    },
    targetUserId: { type: String, required: true, index: true },
    currency: {
      type: String,
      enum: [
        "sukamajuCoins",
        "pratamaDollars",
        "scholarshipVouchers",
        "starFragments",
        "economy_wallet",
        "coupons",
      ],
      required: true,
    },
    action: {
      type: String,
      enum: ["CREDIT", "DEBIT", "TRANSFER", "SET", "ROLLBACK", "RESET"],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    reason: { type: String, required: true, maxlength: 255 },
    metadata: { type: Object, default: {} },
    guildId: { type: String, default: null },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 90, // Auto TTL: 90 hari
    },
  },
  {
    timestamps: true,
    collection: "economy_audit_logs",
  },
);

EconomyAuditLogSchema.index({ targetUserId: 1, createdAt: -1 });
EconomyAuditLogSchema.index({ actorId: 1, createdAt: -1 });
EconomyAuditLogSchema.index({ currency: 1, createdAt: -1 });

module.exports =
  mongoose.models.EconomyAuditLog ||
  mongoose.model("EconomyAuditLog", EconomyAuditLogSchema);
