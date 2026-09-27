const {
  SlashCommandBuilder,
  PermissionsBitField,
  GuildVerificationLevel,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { sendModLog } = require("../../src/utils/modLogHelper");
const GuildSettings = require("../../src/models/GuildSettings");

function ephemeral(payload) {
  return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

const VERIFICATION_NAMES = {
  0: "None (Bebas)",
  1: "Low (Email Terverifikasi)",
  2: "Medium (Terdaftar > 5 Menit)",
  3: "High (Member Server > 10 Menit)",
  4: "Very High (Nomor HP Terverifikasi)",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shield")
    .setDescription("Sistem pertahanan darurat Anti-Raid Panic Shield untuk server")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("on")
        .setDescription("Aktifkan mode darurat Anti-Raid Panic Shield")
        .addBooleanOption((opt) =>
          opt
            .setName("lockdown")
            .setDescription("Kunci juga izin kirim pesan @everyone di channel ini?")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan aktivasi shield darurat")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("off")
        .setDescription("Nonaktifkan mode darurat dan pulihkan keamanan server"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Periksa status pertahanan Panic Shield saat ini"),
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Akses Ditolak",
            description: "Hanya Administrator server yang dapat mengontrol Anti-Raid Panic Shield.",
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply(
        ephemeral(
          buildErrorContainerV2({
            title: "Izin Bot Kurang",
            description: "Naura memerlukan izin **Manage Server** (ManageGuild) untuk mengatur tingkat verifikasi server.",
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const author = interaction.user;

    await interaction.deferReply();

    try {
      const [settingsRow] = await GuildSettings.findOrCreate({
        where: { guildId: guild.id },
        defaults: { guildId: guild.id, settings: {} },
      });

      const currentSettings = { ...(settingsRow.settings || {}) };
      const currentShield = currentSettings.shield || { active: false };

      if (subcommand === "on") {
        if (currentShield.active) {
          return interaction.editReply(
            ephemeral(
              buildErrorContainerV2({
                title: "Shield Sudah Aktif",
                description: "Panic Shield sudah dalam kondisi aktif di server ini.",
                footerText: ui.getFooter("core"),
              }),
            ),
          );
        }

        const isLockdown = interaction.options.getBoolean("lockdown") || false;
        const reason = interaction.options.getString("alasan") || "Aktivasi Darurat Anti-Raid";
        const prevLevel = guild.verificationLevel;

        // Naikkan level verifikasi ke Very High (4)
        if (guild.verificationLevel !== GuildVerificationLevel.VeryHigh) {
          await guild.setVerificationLevel(
            GuildVerificationLevel.VeryHigh,
            `[Anti-Raid Shield ON] ${reason} oleh ${author.tag}`,
          );
        }

        if (isLockdown) {
          const everyoneRole = guild.roles.everyone;
          await interaction.channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: false,
          }).catch((err) => {
            logger.warn("[Shield] Gagal lockdown channel interaksi:", err.message);
          });
        }

        currentSettings.shield = {
          active: true,
          previousLevel: prevLevel,
          lockdown: isLockdown,
          lockdownChannelId: isLockdown ? interaction.channel.id : null,
          activatedBy: author.id,
          activatedAt: new Date().toISOString(),
          reason,
        };

        settingsRow.settings = currentSettings;
        settingsRow.changed("settings", true);
        await settingsRow.save();

        const shieldOnContainer = buildContainerV2({
          accentColorHex: ui.getColor("error") || "#ef4444",
          title: "PANIC SHIELD DIAKTIFKAN",
          expression: "angry",
          description: "Mode pertahanan darurat server telah diaktifkan! Tingkat verifikasi server dinaikkan ke level tertinggi untuk menyaring serangan serbuan raid.",
          fields: [
            { label: "Status Shield", value: "AKTIF (SIAGA TINGGI)", inline: true },
            { label: "Level Verifikasi", value: "Very High (SMS / Phone)", inline: true },
            { label: "Channel Lockdown", value: isLockdown ? "Ya (Channel Ini Dikunci)" : "Tidak (Hanya Filter Gabung)", inline: true },
            { label: "Diaktifkan Oleh", value: `<@${author.id}>`, inline: true },
            { label: "Alasan", value: reason, inline: false },
          ],
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(shieldOnContainer);

        // Siaran audit log
        await sendModLog(guild, shieldOnContainer);
        return;
      }

      if (subcommand === "off") {
        if (!currentShield.active) {
          return interaction.editReply(
            ephemeral(
              buildErrorContainerV2({
                title: "Shield Tidak Aktif",
                description: "Panic Shield saat ini sedang tidak aktif.",
                footerText: ui.getFooter("core"),
              }),
            ),
          );
        }

        const restoreLevel = typeof currentShield.previousLevel === "number"
          ? currentShield.previousLevel
          : GuildVerificationLevel.Medium;

        await guild.setVerificationLevel(
          restoreLevel,
          `[Anti-Raid Shield OFF] Dinonaktifkan oleh ${author.tag}`,
        ).catch((err) => {
          logger.warn("[Shield] Gagal mengembalikan verification level:", err.message);
        });

        if (currentShield.lockdown && currentShield.lockdownChannelId) {
          const lockedChannel = guild.channels.cache.get(currentShield.lockdownChannelId);
          if (lockedChannel) {
            await lockedChannel.permissionOverwrites.edit(guild.roles.everyone, {
              SendMessages: null,
            }).catch(() => null);
          }
        }

        currentSettings.shield = {
          active: false,
          deactivatedBy: author.id,
          deactivatedAt: new Date().toISOString(),
        };

        settingsRow.settings = currentSettings;
        settingsRow.changed("settings", true);
        await settingsRow.save();

        const shieldOffContainer = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10b981",
          title: "PANIC SHIELD DINONAKTIFKAN",
          expression: "success",
          description: "Status darurat server telah dicabut. Tingkat keamanan dan izin channel telah dikembalikan ke kondisi normal.",
          fields: [
            { label: "Status Shield", value: "NONAKTIF (NORMAL)", inline: true },
            { label: "Level Verifikasi", value: VERIFICATION_NAMES[restoreLevel] || `${restoreLevel}`, inline: true },
            { label: "Dinonaktifkan Oleh", value: `<@${author.id}>`, inline: true },
          ],
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(shieldOffContainer);
        await sendModLog(guild, shieldOffContainer);
        return;
      }

      if (subcommand === "status") {
        const currentLevel = guild.verificationLevel;
        const isActive = !!currentShield.active;

        const statusContainer = buildContainerV2({
          accentColorHex: isActive
            ? (ui.getColor("error") || "#ef4444")
            : (ui.getColor("primary") || "#6366f1"),
          title: "Status Pertahanan Anti-Raid Shield",
          expression: isActive ? "serious" : "happy",
          description: isActive
            ? "Server saat ini berada dalam perlindungan darurat siaga tinggi."
            : "Sistem keamanan server berada dalam parameter operasional standar.",
          fields: [
            {
              label: "Status Panic Shield",
              value: isActive ? "AKTIF" : "NONAKTIF",
              inline: true,
            },
            {
              label: "Tingkat Verifikasi",
              value: VERIFICATION_NAMES[currentLevel] || `Level ${currentLevel}`,
              inline: true,
            },
            {
              label: "Karantina Lockdown",
              value: currentShield.lockdown ? "Aktif" : "Tidak Aktif",
              inline: true,
            },
            {
              label: "Diperbarui Terakhir",
              value: currentShield.activatedAt
                ? `<t:${Math.floor(new Date(currentShield.activatedAt).getTime() / 1000)}:R>`
                : "Belum pernah",
              inline: true,
            },
          ],
          footerText: ui.getFooter("core"),
        });

        return interaction.editReply(statusContainer);
      }
    } catch (err) {
      logger.error("[Shield] Gagal memproses perintah shield:", err);
      return interaction.editReply(
        ephemeral(
          buildErrorContainerV2({
            title: "Kegagalan Sistem Shield",
            description: `Terjadi kendala saat mengatur status shield: ${err.message}`,
            footerText: ui.getFooter("core"),
          }),
        ),
      );
    }
  },
};
