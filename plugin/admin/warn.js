const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const UserWarn = require("../../src/models/UserWarn");
const UserStrike = require("../../src/models/UserStrike");
const ui = require("../../src/config/ui");
const cacheManager = require("../../src/managers/cacheManager");
const { logger } = require("../../src/managers/logger");

const MUTE_MS = 60 * 60 * 1000;
const DESC_LIMIT = 3800;

function ephemeral(payload) {
  return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

function deny(interaction, description) {
  return interaction.reply(
    ephemeral(
      buildErrorContainerV2({
        title: "Belum bisa Naura lakukan",
        description,
        footerText: ui.getFooter("core"),
      }),
    ),
  );
}

function notice(interaction, description, expression) {
  return interaction.reply(
    buildContainerV2({
      accentColorHex: ui.getColor("success"),
      title: "Beres!",
      expression: expression || "success",
      description,
      footerText: ui.getFooter("core"),
    }),
  );
}

// Tindakan hanya diumumkan kalau benar-benar berhasil dijalankan.
async function applyPunishment(action, member, totalWarns) {
  if (action === "mute") {
    if (!member.moderatable) return null;
    await member.timeout(MUTE_MS, "Tangga hukuman peringatan");
    return `<@${member.id}> Naura bisukan otomatis selama satu jam karena sudah mencapai ${totalWarns} peringatan.`;
  }
  if (action === "kick") {
    if (!member.kickable) return null;
    await member.kick("Eskalasi Peringatan");
    return `<@${member.id}> Naura keluarkan otomatis karena akumulasi peringatan/strike.`;
  }
  if (action === "ban") {
    if (!member.bannable) return null;
    await member.ban({ reason: "Eskalasi Peringatan: Ban Permanen" });
    return `<@${member.id}> Naura larang masuk permanen karena telah mencapai 5 strikes.`;
  }
  if (action === "tempban") {
    if (!member.bannable) return null;
    await member.ban({ reason: "Eskalasi Peringatan: Tempban 1 Hari" });
    return `<@${member.id}> Naura larang masuk selama 1 hari karena telah mencapai 3 strikes.`;
  }
  return null;
}

async function ladderAction(guildId, totalWarns) {
  const settings = await cacheManager.getGuildSettings(guildId);
  if (!settings || !settings.settings || !settings.settings.warn_punishments)
    return null;
  return settings.settings.warn_punishments[totalWarns] || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Sistem peringatan untuk anggota server")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Beri peringatan kepada anggota")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang diberi peringatan")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan peringatan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Lihat daftar peringatan anggota")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang diperiksa")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Hapus satu peringatan berdasarkan ID")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID peringatan").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Hapus semua peringatan milik anggota")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang dibersihkan")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === "add") {
      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("alasan");

      if (user.bot)
        return deny(interaction, "Bot tidak bisa diberi peringatan ya.");
      if (user.id === interaction.user.id)
        return deny(
          interaction,
          "Kamu tidak bisa memperingatkan dirimu sendiri, hehe.",
        );

      const targetMember = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (targetMember) {
        if (
          targetMember.roles.highest.position >=
          interaction.member.roles.highest.position
        ) {
          return deny(
            interaction,
            "Anggota itu punya role yang setara atau lebih tinggi darimu.",
          );
        }
        if (
          targetMember.roles.highest.position >=
          interaction.guild.members.me.roles.highest.position
        ) {
          return deny(
            interaction,
            "Rolenya lebih tinggi dari role Naura, jadi Naura tidak bisa bertindak.",
          );
        }
      }

      await UserWarn.create({
        userId: user.id,
        guildId,
        moderatorId: interaction.user.id,
        reason,
      });

      await interaction.reply(
        buildContainerV2({
          accentColorHex: ui.getColor("warning") || ui.getColor("error"),
          authorName: "Peringatan Diberikan",
          title: `Peringatan untuk ${user.username}`,
          iconURL: user.displayAvatarURL(),
          expression: "warning",
          description:
            `**Anggota:** ${user} (${user.tag})\n` +
            `**Moderator:** ${interaction.user}\n` +
            `**Alasan:** ${reason}`,
          footerText: ui.getFooter("core"),
        }),
      );

      // Tambahkan sistem Strike
      let strikeAction = null;
      let currentStrikes = 1;
      try {
        const [strikeRecord] = await UserStrike.findOrCreate({
          where: { userId: user.id, guildId },
        });
        strikeRecord.strikes += 1;
        strikeRecord.lastStrikeAt = new Date();
        currentStrikes = strikeRecord.strikes;

        if (strikeRecord.strikes >= 5) {
          strikeAction = "ban";
        } else if (strikeRecord.strikes >= 3) {
          strikeAction = "tempban";
          strikeRecord.isTempBanned = true;
          strikeRecord.tempbanExpiresAt = new Date(Date.now() + 86400000); // 1 hari
        }

        await strikeRecord.save({
          fields: [
            "strikes",
            "lastStrikeAt",
            "isTempBanned",
            "tempbanExpiresAt",
          ],
        });
      } catch (err) {
        logger.error("[Warn] Gagal mengelola strike: " + err.message);
      }

      let totalWarns = null;
      let action = null;
      try {
        totalWarns = await UserWarn.count({
          where: { guildId, userId: user.id },
        });
        action = await ladderAction(guildId, totalWarns);
      } catch (err) {
        logger.error("[Warn] Gagal membaca tangga hukuman: " + err.message);
      }

      // Utamakan action dari strike sistem (jika >=3 atau >=5)
      const finalAction = strikeAction || action;

      const severityHex = currentStrikes >= 5 ? "#EF4444" : currentStrikes >= 3 ? "#F59E0B" : "#10B981";

      await interaction.reply(
        buildContainerV2({
          accentColorHex: severityHex,
          authorName: "Peringatan Diberikan",
          title: `Peringatan untuk ${user.username}`,
          iconURL: user.displayAvatarURL(),
          expression: currentStrikes >= 3 ? "angry" : "warning",
          description: [
            `**Anggota:** ${user} (\`${user.tag}\`)`,
            `**Moderator:** ${interaction.user}`,
            `**Alasan:** ${reason}`,
            ``,
            `⚠️ **Total Peringatan:** ${totalWarns || 1} | **Strikes:** ${currentStrikes}/5`,
            finalAction ? `⚡ **Eskalasi Otomatis:** ${finalAction.toUpperCase()}` : null,
          ].filter(Boolean).join("\n"),
          footerText: ui.getFooter("core"),
        }),
      );

      const urutan = totalWarns
        ? `ke-${totalWarns} (${currentStrikes} Strike)`
        : `${currentStrikes} Strike`;

      await user
        .send(
          buildContainerV2({
            accentColorHex: severityHex,
            title: "Pemberitahuan Peringatan Server",
            expression: "warning",
            description: [
              `Kamu menerima peringatan **${urutan}** di server **${interaction.guild.name}**.`,
              ``,
              `📝 **Alasan:** ${reason}`,
              `🛡️ **Moderator:** ${interaction.user.tag}`,
              `⚠️ **Status Akumulasi:** ${totalWarns || 1} Peringatan (${currentStrikes}/5 Strike)`,
              ``,
              `Harap patuhi norma komunitas server agar akun tetap aman dari pembatasan akses.`,
            ].join("\n"),
            footerText: ui.getFooter("core"),
          })
        )
        .catch(() => null);

      if (finalAction && finalAction !== "dm" && targetMember) {
        try {
          const announcement = await applyPunishment(
            finalAction,
            targetMember,
            totalWarns,
          );
          if (announcement) await interaction.channel.send(announcement);
          else
            logger.error(
              `[Warn] Tindakan ${finalAction} dilewati, izin Naura tidak cukup.`,
            );
        } catch (err) {
          logger.error(
            "[Warn] Gagal menjalankan tangga hukuman: " + err.message,
          );
        }
      }
      return;
    }

    if (subcommand === "check") {
      const user = interaction.options.getUser("user");
      const warns = await UserWarn.findAll({
        where: { userId: user.id, guildId },
        order: [["createdAt", "DESC"]],
      });

      const strikeRecord = await UserStrike.findOne({
        where: { userId: user.id, guildId },
      }).catch(() => null);
      const strikes = strikeRecord ? strikeRecord.strikes : 0;

      let severityColor = "#10B981";
      let severityBadge = "🟢 Ringan (1-2)";
      if (warns.length >= 5 || strikes >= 5) {
        severityColor = "#EF4444";
        severityBadge = "🔴 Kritis (5+)";
      } else if (warns.length >= 3 || strikes >= 3) {
        severityColor = "#F59E0B";
        severityBadge = "🟡 Peringatan Serius (3-4)";
      }

      let desc = "";
      if (warns.length === 0) {
        desc = "Anggota ini memiliki rekam jejak bersih tanpa catatan peringatan sama sekali.";
      } else {
        const warnLines = warns.map((w, idx) => {
          const time = Math.floor(new Date(w.createdAt).getTime() / 1000);
          return `**#${idx + 1}** ID: \`${w.id}\` | Mod: <@${w.moderatorId}> | <t:${time}:R>\n> 📝 ${w.reason}`;
        });
        desc = [
          `📊 **Tingkat Keparahan:** ${severityBadge}`,
          `⚠️ **Total Peringatan:** ${warns.length} | **Strikes:** ${strikes}/5`,
          ``,
          `**Riwayat Pelanggaran Terakhir:**`,
          warnLines.join("\n\n"),
        ].join("\n");
      }

      if (desc.length > DESC_LIMIT) {
        desc =
          desc.slice(0, DESC_LIMIT) +
          "\n\n-# Sebagian riwayat dipotong karena batas tampilan Discord.";
      }

      return interaction.reply(
        buildContainerV2({
          accentColorHex: severityColor,
          authorName: `Catatan Peringatan: ${user.tag}`,
          title: `Rekam Jejak ${user.username}`,
          iconURL: user.displayAvatarURL(),
          expression: warns.length === 0 ? "happy" : warns.length >= 3 ? "warning" : "info",
          description: desc,
          footerText: ui.getFooter("core"),
        }),
      );
    }

    if (subcommand === "remove") {
      const id = interaction.options.getInteger("id");
      const warn = await UserWarn.findOne({ where: { id, guildId } });

      if (!warn)
        return deny(
          interaction,
          `Peringatan dengan ID \`${id}\` tidak Naura temukan di server ini.`,
        );

      await warn.destroy();
      return notice(
        interaction,
        `Peringatan dengan ID \`${id}\` sudah Naura hapus.`,
      );
    }

    const user = interaction.options.getUser("user");
    const warnCount = await UserWarn.count({
      where: { userId: user.id, guildId },
    });

    if (warnCount === 0) {
      return deny(
        interaction,
        `${user} belum memiliki riwayat peringatan yang bisa dibersihkan.`,
      );
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_clear_warn_${user.id}`)
        .setLabel(`Bersihkan (${warnCount} Catatan)`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`cancel_clear_warn_${user.id}`)
        .setLabel("Batalkan")
        .setStyle(ButtonStyle.Secondary),
    );

    const confirmPayload = buildContainerV2({
      accentColorHex: ui.getColor("warning") || "#F59E0B",
      title: "Konfirmasi Pembersihan Peringatan",
      expression: "warning",
      description: [
        `Apakah Anda yakin ingin menghapus seluruh riwayat peringatan milik anggota ini?`,
        ``,
        `👤 **Target:** <@${user.id}> (\`${user.tag || user.username}\`)`,
        `🗑️ **Jumlah Peringatan Dihapus:** ${warnCount} catatan`,
        `🛡️ **Moderator:** <@${interaction.user.id}>`,
        ``,
        `⚠️ Tindakan ini permanen dan akan mereset strike ke nol. Klik konfirmasi dalam 30 detik.`,
      ].join("\n"),
      buttonsRow: confirmRow,
      footerText: ui.getFooter("core"),
    });

    const reply = await interaction.reply({
      ...confirmPayload,
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return;

      if (i.customId.startsWith("cancel_clear_warn_")) {
        const cancelPayload = buildContainerV2({
          accentColorHex: ui.getColor("neutral") || "#64748B",
          title: "Pembersihan Dibatalkan",
          expression: "neutral",
          description: `Pembersihan riwayat peringatan untuk <@${user.id}> telah dibatalkan.`,
          buttonsRow: [],
          footerText: ui.getFooter("core"),
        });
        return i.update({ ...cancelPayload, components: [] });
      }

      if (i.customId.startsWith("confirm_clear_warn_")) {
        await i.deferUpdate().catch(() => {});

        const deletedCount = await UserWarn.destroy({
          where: { userId: user.id, guildId },
        });

        await UserStrike.destroy({ where: { userId: user.id, guildId } }).catch(() => {});

        const successPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10B981",
          title: "Peringatan Berhasil Dibersihkan",
          expression: "success",
          description: `Semua catatan peringatan milik <@${user.id}> (${deletedCount} catatan) dan strike berhasil dibersihkan.`,
          buttonsRow: [],
          footerText: ui.getFooter("core"),
        });

        return i.editReply({ ...successPayload, components: [] });
      }
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        const timeoutPayload = buildContainerV2({
          accentColorHex: ui.getColor("neutral") || "#64748B",
          title: "Waktu Konfirmasi Habis",
          expression: "neutral",
          description: "Operasi pembersihan dibatalkan otomatis karena tidak ada respons.",
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply({ ...timeoutPayload, components: timeoutPayload.components }).catch(() => {});
      }
    });
  },
};
