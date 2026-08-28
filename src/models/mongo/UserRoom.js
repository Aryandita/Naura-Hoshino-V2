"use strict";

const mongoose = require("mongoose");

const GuestbookEntrySchema = new mongoose.Schema({
  fromUserId: { type: String, required: true },
  fromName: { type: String, required: true },
  message: { type: String, required: true, maxlength: 200 },
  giftType: { type: String, default: "tea" },
  timestamp: { type: Date, default: Date.now },
});

const FurnitureItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // 'bed', 'desk', 'decor', 'plant', 'audio', 'aquarium'
  icon: { type: String, default: "🛋️" },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  rarity: { type: String, default: "COMMON" },
  comfortValue: { type: Number, default: 25 },
});

const UserRoomSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, default: "Pengelana" },
    roomName: { type: String, default: "Cozy Cyber Pod" },
    theme: { type: String, default: "cyber_midnight" },
    level: { type: Number, default: 1 },
    comfortScore: { type: Number, default: 100 },
    furniture: [FurnitureItemSchema],
    holoCardId: { type: String, default: null },
    holoCardName: { type: String, default: null },
    holoCardUrl: { type: String, default: null },
    guestbook: [GuestbookEntrySchema],
    likesCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.UserRoom || mongoose.model("UserRoom", UserRoomSchema);
