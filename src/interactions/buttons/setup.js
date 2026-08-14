"use strict";

const { EmbedBuilder, MessageFlags } = require("discord.js");
const { updateGuildSetting } = require("../../managers/guildSettingsService");

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

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("\ud83d\udcf4 Global Chat Dinonaktifkan")
        .setDescription(
          "Jaringan Global Chat untuk server ini telah dimatikan.",
        );

      return interaction.reply({
        embeds: [embed],
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

      const embed = new EmbedBuilder()
        .setColor("#FF69B4")
        .setTitle("\ud83d\udee1\ufe0f Automod Diaktifkan")
        .setDescription("Sistem Automod & Keamanan Naura sekarang berjalan.");

      return interaction.editReply({ embeds: [embed] });
    },
  },

  {
    id: "btn_automod_disable",
    label: "setup-automod-mati",
    async handler(interaction) {
      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.automod = { ...settings.automod, enabled: false };
      });

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("\ud83d\udee1\ufe0f Automod Dinonaktifkan")
        .setDescription("Sistem Automod & Keamanan Naura dinonaktifkan.");

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
