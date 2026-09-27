"use strict";

const mongoose = require("mongoose");

const ModNoteSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    targetTag: { type: String, default: "" },
    moderatorId: { type: String, required: true },
    moderatorTag: { type: String, default: "" },
    note: { type: String, required: true },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "mod_notes",
  },
);

ModNoteSchema.index({ guildId: 1, targetId: 1, createdAt: -1 });

module.exports =
  mongoose.models.ModNote || mongoose.model("ModNote", ModNoteSchema);
