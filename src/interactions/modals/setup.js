"use strict";

const { MessageFlags } = require("discord.js");
const { updateGuildSetting } = require("../../managers/guildSettingsService");
const {
  buildSuccessContainerV2,
} = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "modal_setup_minecraft",
    label: "setup-minecraft",
    async handler(interaction) {
      const ip = interaction.fields.getTextInputValue("input_minecraft_ip");
      const port =
        parseInt(
          interaction.fields.getTextInputValue("input_minecraft_port"),
          10,
        ) || 25565;

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.minecraft = { ...settings.minecraft, ip, port };
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Setup Manager",
        title: `${ui.getEmoji("minecraft") || "🎮"} Setup Minecraft Status Berhasil!`,
        description: `Server IP: **${ip}:${port}** telah disimpan.\nNaura akan melacak status server ini secara real-time.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    prefix: "modal_setup_sticky_content_",
    label: "setup-sticky",
    async handler(interaction) {
      const channelId = interaction.customId.split("_")[4];
      const messageText = interaction.fields.getTextInputValue(
        "input_sticky_message",
      );

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.stickyMessage = {
          channelId,
          message: messageText,
          lastId: null,
        };
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Setup Manager",
        title: `${ui.getEmoji("pin") || "📌"} Setup Pesan Lengket Berhasil!`,
        description: `Pesan lengket dipasang di <#${channelId}>:\n>>> ${messageText}`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "modal_setup_autoreply",
    label: "setup-autoreply",
    async handler(interaction) {
      const trigger = interaction.fields
        .getTextInputValue("input_autoreply_trigger")
        .toLowerCase()
        .trim();
      const response = interaction.fields.getTextInputValue(
        "input_autoreply_response",
      );

      await updateGuildSetting(interaction.guild.id, (settings) => {
        if (!Array.isArray(settings.autoReplies)) settings.autoReplies = [];

        const existing = settings.autoReplies.find(
          (r) => r.trigger === trigger,
        );
        if (existing) existing.response = response;
        else settings.autoReplies.push({ trigger, response });
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Auto Responder",
        title: `${ui.getEmoji("robot") || "🤖"} Setup Auto Responder Berhasil!`,
        description: `Naura akan otomatis membalas kata kunci **"${trigger}"** dengan:\n>>> ${response}`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
