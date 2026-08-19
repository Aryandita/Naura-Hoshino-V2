"use strict";

const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorTag: { type: String, default: "" },
    authorAvatar: { type: String, default: "" },
    content: { type: String, default: "" },
    embeds: { type: Array, default: [] },
    attachments: { type: Array, default: [] },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const TicketTranscriptSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    creatorId: { type: String, required: true },
    closedById: { type: String, default: "" },
    closeReason: { type: String, default: "" },
    category: { type: String, default: "support" },
    messages: [MessageSchema],
    htmlTranscript: { type: String, default: "" },
    totalMessages: { type: Number, default: 0 },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "ticket_transcripts",
  },
);

module.exports =
  mongoose.models.TicketTranscript ||
  mongoose.model("TicketTranscript", TicketTranscriptSchema);
