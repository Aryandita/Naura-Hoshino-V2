const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { sendModLog } = require("../../src/utils/modLogHelper");

module.exports = {
  isSubcommand: true,
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription(
      "🔒 Mengunci channel atau server untuk mencegah pesan dari member biasa.",
    )
    .setDefaultMemberPermissions(
      PermissionsBitField.Flags.ManageChannels |
        PermissionsBitField.Flags.ManageRoles,
    )
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Kunci channel ini.")
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan lockdown")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("server")
        .setDescription("Kunci SELURUH SERVER (Hati-hati!).")
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan lockdown server")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlock")
        .setDescription(
          "Buka kunci channel atau server yang sedang di-lockdown.",
        )
        .addStringOption((opt) =>
          opt
            .setName("target")
            .setDescription("Apa yang ingin di-unlock?")
            .setRequired(true)
            .addChoices(
              { name: "Channel Ini", value: "channel" },
              { name: "Seluruh Server", value: "server" },
            ),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const reason =
      interaction.options.getString("alasan") || "Keadaan Darurat / Moderasi";
    const everyoneRole = interaction.guild.roles.everyone;

    await interaction.deferReply();

    try {
      if (subcommand === "channel") {
        await interaction.channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
        });

        const channelLockPayload = buildContainerV2({
          accentColorHex: ui.getColor("error") || "#EF4444",
          title: "🔒 Channel Dikunci",
          expression: "warning",
          description: [
            `Channel ini telah dikunci sementara oleh moderator.`,
            ``,
            `📝 **Alasan:** ${reason}`,
            `🛡️ **Moderator:** <@${interaction.user.id}>`,
            `⏱️ **Waktu:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });
        await interaction.channel.send(channelLockPayload);

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("error") || "#EF4444",
          title: "🔒 Penguncian Channel Berhasil",
          expression: "success",
          description: [
            `Channel <#${interaction.channel.id}> berhasil dikunci dari pesan publik.`,
            ``,
            `📝 **Alasan:** ${reason}`,
            `🛡️ **Moderator:** <@${interaction.user.id}>`,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(payload);
        await sendModLog(interaction.guild, payload);
      } else if (subcommand === "server") {
        const channels = await interaction.guild.channels.fetch();
        let lockedCount = 0;

        for (const [, channel] of channels) {
          if (
            channel &&
            channel.isTextBased() &&
            channel
              .permissionsFor(everyoneRole)
              .has(PermissionsBitField.Flags.ViewChannel)
          ) {
            await channel.permissionOverwrites
              .edit(everyoneRole, { SendMessages: false })
              .catch(() => {});
            lockedCount++;
          }
        }

        // Nyalakan antiRaid lockdown di database
        const cacheManager = require("../../src/managers/cacheManager");
        const guildSettingsService = require("../../src/managers/guildSettingsService");
        const guildData = await cacheManager.getGuildSettings(
          interaction.guild.id,
        );
        if (guildData?.settings) {
          if (!guildData.settings.antiRaid) guildData.settings.antiRaid = {};
          guildData.settings.antiRaid.lockdown = true;
          await guildSettingsService.updateGuildSetting(
            interaction.guild.id,
            "antiRaid",
            guildData.settings.antiRaid,
          );
        }

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("danger") || "#EF4444",
          title: "🚨 Server Lockdown Diaktifkan",
          expression: "warning",
          description: [
            `Seluruh server telah dikunci untuk melindungi keamanan komunitas.`,
            ``,
            `🛡️ **Channel Terkunci:** ${lockedCount} channel`,
            `📝 **Alasan:** ${reason}`,
            `👤 **Moderator:** <@${interaction.user.id}>`,
            `⏱️ **Waktu:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            ``,
            `Gunakan \`/moderation lockdown target:server\` atau \`/lockdown unlock target:server\` untuk membuka kunci kembali.`,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(payload);
        await sendModLog(interaction.guild, payload);
      } else if (subcommand === "unlock") {
        const target = interaction.options.getString("target");

        if (target === "channel") {
          await interaction.channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null,
          });

          const payload = buildContainerV2({
            accentColorHex: ui.getColor("success") || "#10B981",
            title: "🔓 Channel Dibuka",
            expression: "success",
            description: [
              `Penguncian channel <#${interaction.channel.id}> telah dicabut. Anggota kini dapat kembali mengirim pesan.`,
              ``,
              `👤 **Dibuka Oleh:** <@${interaction.user.id}>`,
              `⏱️ **Waktu:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            ].join("\n"),
            footerText: ui.getFooter("core"),
          });

          await interaction.editReply(payload);
          await sendModLog(interaction.guild, payload);
        } else {
          const channels = await interaction.guild.channels.fetch();
          let unlockedCount = 0;

          for (const [, channel] of channels) {
            if (channel && channel.isTextBased()) {
              await channel.permissionOverwrites
                .edit(everyoneRole, { SendMessages: null })
                .catch(() => {});
              unlockedCount++;
            }
          }

          // Matikan antiRaid lockdown di database
          const cacheManager = require("../../src/managers/cacheManager");
          const guildSettingsService = require("../../src/managers/guildSettingsService");
          const guildData = await cacheManager.getGuildSettings(
            interaction.guild.id,
          );
          if (guildData?.settings?.antiRaid) {
            guildData.settings.antiRaid.lockdown = false;
            await guildSettingsService.updateGuildSetting(
              interaction.guild.id,
              "antiRaid",
              guildData.settings.antiRaid,
            );
          }

          const payload = buildContainerV2({
            accentColorHex: ui.getColor("success") || "#10B981",
            title: "🔓 Server Lockdown Dicabut",
            expression: "success",
            description: [
              `Status lockdown server telah diangkat. Pengaturan ${unlockedCount} channel telah dikembalikan ke kondisi semula.`,
              ``,
              `👤 **Dipulihkan Oleh:** <@${interaction.user.id}>`,
              `⏱️ **Waktu:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            ].join("\n"),
            footerText: ui.getFooter("core"),
          });

          await interaction.editReply(payload);
          await sendModLog(interaction.guild, payload);
        }
      }
    } catch (error) {
      logger.error("[Lockdown Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Lockdown",
        description: `${ui.getEmoji("error") || "❌"} Gagal melakukan lockdown. Pastikan bot memiliki izin Administrator atau Manage Channels/Roles yang cukup.`,
        footerText: ui.getFooter("core"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
