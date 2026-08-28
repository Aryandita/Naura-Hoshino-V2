"use strict";

const { MessageFlags } = require("discord.js");
const { updateGuildSetting } = require("../../managers/guildSettingsService");
const {
  buildContainerV2,
  buildSuccessContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

/** Bersihkan peta global chat di memori untuk satu guild. */
function clearGlobalChatCache(client, guildId) {
  if (!client.globalChatChannels) return;
  for (const [
    channelId,
    mappedGuildId,
  ] of client.globalChatChannels.entries()) {
    if (mappedGuildId === guildId) client.globalChatChannels.delete(channelId);
  }
}

module.exports = [
  {
    id: "btn_globalchat_disable",
    label: "setup-globalchat-mati",
    async handler(interaction, client) {
      await updateGuildSetting(interaction.guild.id, (settings) => {
        if (settings.globalChat) settings.globalChat.enabled = false;
      });

      clearGlobalChatCache(client, interaction.guild.id);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("danger") || "#EF4444",
        authorName: "Naura Setup Security",
        title: `${ui.getEmoji("offline") || "📴"} Global Chat Dinonaktifkan`,
        description: "Jaringan Global Chat untuk server ini telah dimatikan.",
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },

  {
    id: "btn_automod_enable",
    label: "setup-automod-nyala",
    // Membuat role isolasi lalu menulis izin ke setiap channel bisa memakan
    // waktu jauh lebih dari tiga detik di server besar.
    defer: "reply",
    onError:
      "Gagal mengaktifkan Automod. Periksa izin Kelola Role dan Kelola Channel milik bot.",
    async handler(interaction) {
      const existing = await updateGuildSetting(interaction.guild.id, () => {});
      let punishRole = interaction.guild.roles.cache.get(
        existing.automod?.punishRole,
      );

      if (!punishRole) {
        punishRole = await interaction.guild.roles
          .create({
            name: "Anak Nakal (Isolasi)",
            color: "#010101",
            reason:
              "Automod: Pembuatan role isolasi untuk poin tata krama habis",
          })
          .catch(() => null);

        if (punishRole) {
          for (const channel of interaction.guild.channels.cache.values()) {
            if (channel.isTextBased() || channel.isVoiceBased()) {
              await channel.permissionOverwrites
                .create(punishRole, {
                  ViewChannel: false,
                  SendMessages: false,
                  Connect: false,
                })
                .catch(() => {});
            }
          }
        }
      }

      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.automod = {
          ...settings.automod,
          enabled: true,
          punishRole: punishRole ? punishRole.id : undefined,
        };
      });

      const payload = buildSuccessContainerV2({
        authorName: "Naura AutoMod Guard",
        title: `${ui.getEmoji("shield") || "🛡️"} Automod Diaktifkan`,
        description:
          "Sistem Automod & Keamanan Naura sekarang berjalan aktif di server ini.",
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    },
  },

  {
    id: "btn_automod_disable",
    label: "setup-automod-mati",
    async handler(interaction) {
      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.automod = { ...settings.automod, enabled: false };
      });

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("danger") || "#EF4444",
        authorName: "Naura AutoMod Guard",
        title: `${ui.getEmoji("shield") || "🛡️"} Automod Dinonaktifkan`,
        description: "Sistem Automod & Keamanan Naura telah dinonaktifkan.",
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
