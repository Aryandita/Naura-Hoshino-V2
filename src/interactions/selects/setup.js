"use strict";

const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

const { updateGuildSetting } = require("../../managers/guildSettingsService");
const {
  buildContainerV2,
  buildSuccessContainerV2,
} = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

const SPECIAL_CHANNEL_LABELS = {
  ai: `${ui.getEmoji("robot") || "🤖"} AI Chat`,
  levelUp: `${ui.getEmoji("chart") || "📈"} Level-Up`,
  counting: `${ui.getEmoji("numbers") || "🔢"} Counting Game`,
  tod: `${ui.getEmoji("sparkles") || "✨"} Truth or Dare`,
};

function labelFor(type) {
  return SPECIAL_CHANNEL_LABELS[type] || SPECIAL_CHANNEL_LABELS.tod;
}

module.exports = [
  {
    id: "select_setup_channel_type",
    label: "setup-pilih-tipe-channel",
    handler(interaction) {
      const channelType = interaction.values[0];

      const menu = new ChannelSelectMenuBuilder()
        .setCustomId(`select_special_channel_submit_${channelType}`)
        .setPlaceholder("Pilih channel...");

      const row = new ActionRowBuilder().addComponents(menu);

      const payload = buildContainerV2({
        authorName: "Naura Channel Config",
        title: `${ui.getEmoji("tv") || "📺"} Setup Special Channel`,
        description: `Pilih channel baru untuk **${labelFor(channelType)}**:`,
        buttonsRow: row,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_announcement_channel",
    label: "setup-channel-pengumuman",
    async handler(interaction) {
      const channelId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.announcementChannel = channelId;
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Setup Manager",
        title: `${ui.getEmoji("announcement") || "📢"} Setup Announcement Channel Berhasil!`,
        description: `Channel pengumuman otomatis (Welcome/Logs) disetel ke <#${channelId}>.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_globalchat_channel",
    label: "setup-channel-globalchat",
    async handler(interaction, client) {
      const channelId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.globalChat = { enabled: true, channelId };
      });

      if (!client.globalChatChannels) client.globalChatChannels = new Map();
      for (const [chanId, gId] of client.globalChatChannels.entries()) {
        if (gId === interaction.guild.id)
          client.globalChatChannels.delete(chanId);
      }
      client.globalChatChannels.set(channelId, interaction.guild.id);

      const payload = buildSuccessContainerV2({
        authorName: "Naura Global Chat",
        title: `${ui.getEmoji("globe") || "🌐"} Setup Global Chat Berhasil!`,
        description: `Channel <#${channelId}> telah terhubung ke Naura Global Chat!`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_starboard_channel",
    label: "setup-channel-starboard",
    async handler(interaction) {
      const channelId = interaction.values[0];
      let threshold = 3;

      await updateGuildSetting(interaction.guild.id, (settings) => {
        threshold = settings.starboard?.threshold || 3;
        settings.starboard = { enabled: true, channelId, threshold };
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Starboard",
        title: `${ui.getEmoji("star") || "⭐"} Setup Starboard Berhasil!`,
        description: `Channel Starboard disetel ke <#${channelId}> dengan batas minimal **${threshold} ⭐**.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_sticky_channel",
    label: "setup-channel-sticky",
    handler(interaction) {
      const channelId = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`modal_setup_sticky_content_${channelId}`)
        .setTitle("Isi Pesan Sticky");

      const input = new TextInputBuilder()
        .setCustomId("input_sticky_message")
        .setLabel("Tulis pesan lengket:")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "Tulis pesan yang akan selalu menempel di bawah channel ini...",
        )
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    },
  },

  {
    id: "select_automod_log",
    label: "setup-log-automod",
    async handler(interaction) {
      const channelId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        if (!settings.automod) settings.automod = {};
        settings.automod.logChannel = channelId;
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura AutoMod Guard",
        title: `${ui.getEmoji("shield") || "🛡️"} Log Automod Disetel`,
        description: `Channel log audit keamanan disetel ke <#${channelId}>.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    prefix: "select_special_channel_submit_",
    label: "setup-channel-khusus",
    async handler(interaction) {
      const channelType = interaction.customId.split("_")[4];
      const channelId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        if (!settings.channels) settings.channels = {};
        settings.channels[channelType] = channelId;
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Channel Config",
        title: `${ui.getEmoji("tv") || "📺"} Special Channel Disetel!`,
        description: `Channel untuk **${labelFor(channelType)}** berhasil disetel ke <#${channelId}>.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_auto_role",
    label: "setup-autorole",
    async handler(interaction) {
      const roleId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.autoRole = roleId;
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Auto-Role",
        title: `${ui.getEmoji("theater") || "🎭"} Setup Auto-Role Berhasil!`,
        description: `Member baru bergabung akan otomatis diberikan role <@&${roleId}>.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_softban_channel",
    label: "setup-softban",
    async handler(interaction) {
      const channelId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.softbanChannelId = channelId;
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Scammer Trap",
        title: `${ui.getEmoji("shield") || "🛡️"} Setup Softban Berhasil!`,
        description: `Channel Honeypot Scammer Trap berhasil disetel ke <#${channelId}>.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_welcome_channel",
    label: "setup-welcome",
    async handler(interaction) {
      const channelId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.announcementChannel = channelId;
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura Greetings",
        title: `${ui.getEmoji("wave") || "👋"} Setup Greetings Berhasil!`,
        description: `Channel Welcome/Leave berhasil disetel ke <#${channelId}>.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "select_ai_channel",
    label: "setup-ai",
    async handler(interaction) {
      const channelId = interaction.values[0];

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.aiChannelId = channelId;
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura AI Assistant",
        title: `${ui.getEmoji("brain") || "🧠"} Setup AI Channel Berhasil!`,
        description: `Channel percakapan otomatis AI berhasil disetel ke <#${channelId}>.`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
