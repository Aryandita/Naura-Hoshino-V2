const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { sendModLog } = require("../../src/utils/modLogHelper");
const incidentService = require("../../src/services/incidentService");
const cacheManager = require("../../src/managers/cacheManager");

async function getAuditChannelId(guildId) {
  try {
    const row = await cacheManager.getGuildSettings(guildId);
    return (
      row?.settings?.auditLogChannel ||
      row?.settings?.modLogChannel ||
      row?.settings?.logChannelId ||
      null
    );
  } catch (_) {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("moderation")
    .setDescription("Kumpulan alat moderasi canggih untuk Admin")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("purge")
        .setDescription(
          "Hapus pesan dalam jumlah banyak sekaligus (hingga 1000 pesan)",
        )
        .addIntegerOption((opt) =>
          opt
            .setName("jumlah")
            .setDescription("Jumlah pesan yang dihapus (1-1000)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000),
        )
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Hanya hapus pesan dari user ini")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("nuke")
        .setDescription(
          "Kloning dan hapus channel ini (Darurat/Pembersihan Total)",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("roleall")
        .setDescription("Tambahkan atau cabut role dari SEMUA member di server")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role yang akan diproses")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Tambah atau Cabut?")
            .setRequired(true)
            .addChoices(
              { name: "Tambah", value: "add" },
              { name: "Cabut", value: "remove" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Bisukan anggota server sementara (Discord Timeout)")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang akan dibisukan")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("durasi")
            .setDescription("Durasi pembisuan")
            .setRequired(true)
            .addChoices(
              { name: "60 Detik (1 Menit)", value: "60s" },
              { name: "5 Menit", value: "5m" },
              { name: "10 Menit", value: "10m" },
              { name: "1 Jam", value: "1h" },
              { name: "1 Hari (24 Jam)", value: "1d" },
              { name: "1 Minggu (7 Hari)", value: "1w" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan pembisuan")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("untimeout")
        .setDescription("Lepas status pembisuan dari anggota server")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang akan dipulihkan suaranya")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan pelepasan status timeout")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Keluarkan anggota dari server")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang akan dikeluarkan")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan pengeluaran")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ban")
        .setDescription("Larang anggota masuk server secara permanen")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Anggota yang akan di-ban")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("hapus_pesan")
            .setDescription("Hapus riwayat pesan target")
            .setRequired(false)
            .addChoices(
              { name: "Jangan hapus pesan", value: 0 },
              { name: "Hapus pesan 24 jam terakhir", value: 86400 },
              { name: "Hapus pesan 7 hari terakhir", value: 604800 },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan pemblokiran (ban)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unban")
        .setDescription("Buka pemblokiran (unban) pengguna lewat User ID")
        .addStringOption((opt) =>
          opt
            .setName("user_id")
            .setDescription("ID pengguna yang akan di-unban")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan pembatalan ban")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("panic")
        .setDescription("Karantina darurat server saat terjadi serbuan bot raid atau kekacauan massal")
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Aktifkan karantina darurat atau pulihkan izin semula")
            .setRequired(true)
            .addChoices(
              { name: "Aktifkan Panic Lockdown", value: "enable" },
              { name: "Pulihkan Server (Restore)", value: "restore" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("slowmode")
        .setDescription("🐌 Atur mode lambat (slowmode) di channel ini.")
        .addStringOption((opt) =>
          opt
            .setName("durasi")
            .setDescription("Durasi slowmode (contoh: 5s, 10s, 1m, 1h, off)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan mengatur slowmode")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lockdown")
        .setDescription("🔒 Kunci channel atau seluruh server.")
        .addStringOption((opt) =>
          opt
            .setName("target")
            .setDescription("Kunci channel saat ini atau seluruh server?")
            .setRequired(true)
            .addChoices(
              { name: "Channel Ini", value: "channel" },
              { name: "Seluruh Server", value: "server" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan lockdown")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("nickname")
        .setDescription("✏️ Paksa ganti atau reset nama panggilan (nickname) member.")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("User yang ingin diubah namanya")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("nama_baru")
            .setDescription("Nama baru (kosongkan untuk mereset)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("steal")
        .setDescription("Mencuri emoji custom untuk dimasukkan ke server ini")
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("Emoji custom yang ingin diambil")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama baru emoji (opsional)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("voicemod")
        .setDescription("🎙️ Moderasi Voice: Mute, Unmute, Deafen, atau Putus Sambungan.")
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Aksi moderasi voice")
            .setRequired(true)
            .addChoices(
              { name: "Mute", value: "mute" },
              { name: "Unmute", value: "unmute" },
              { name: "Deafen", value: "deafen" },
              { name: "Undeafen", value: "undeafen" },
              { name: "Disconnect", value: "disconnect" },
            ),
        )
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("User yang akan dimoderasi")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan moderasi voice")
            .setRequired(false),
        ),
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "slowmode") {
      const slowmodeCmd = require("./slowmode");
      return slowmodeCmd.execute(interaction, client);
    }
    if (subcommand === "lockdown") {
      const lockdownCmd = require("./lockdown");
      return lockdownCmd.execute(interaction, client);
    }
    if (subcommand === "nickname") {
      const nickCmd = require("./nickname");
      return nickCmd.execute(interaction, client);
    }
    if (subcommand === "steal") {
      const stealCmd = require("./steal-emoji");
      return stealCmd.execute(interaction, client);
    }
    if (subcommand === "voicemod") {
      const vmCmd = require("./voicemod");
      return vmCmd.execute(interaction, client);
    }

    if (subcommand === "purge") {
      const amount = interaction.options.getInteger("jumlah");
      const targetUser = interaction.options.getUser("user");

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        let deletedCount = 0;
        let skippedOldCount = 0;
        let fetchAmount = amount;
        let lastMessageId = null;

        const statusPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          title: "🧹 Pembersihan Pesan (Purge)",
          expression: "thinking",
          description: `${ui.getEmoji("loading") || "⏳"} Sedang menghapus pesan dari channel... Mohon tunggu (0/${amount})`,
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(statusPayload);

        while (fetchAmount > 0) {
          const fetchLimit = Math.min(fetchAmount, 100);
          const options = { limit: fetchLimit };
          if (lastMessageId) options.before = lastMessageId;

          let messages = await interaction.channel.messages.fetch(options);
          if (messages.size === 0) break;

          lastMessageId = messages.last().id;

          if (targetUser) {
            messages = messages.filter((m) => m.author.id === targetUser.id);
          }

          if (messages.size > 0) {
            const deleted = await interaction.channel.bulkDelete(
              messages,
              true,
            );
            deletedCount += deleted.size;

            if (deleted.size < messages.size) {
              skippedOldCount += (messages.size - deleted.size);
              break;
            }
          }

          fetchAmount -= fetchLimit;

          if (fetchAmount > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const updatePayload = buildContainerV2({
              accentColorHex: ui.getColor("primary") || "#FFB6C1",
              title: "🧹 Pembersihan Pesan (Purge)",
              expression: "thinking",
              description: `${ui.getEmoji("loading") || "⏳"} Sedang menghapus pesan... (${deletedCount}/${amount})`,
              footerText: ui.getFooter("core"),
            });
            await interaction.editReply(updatePayload).catch(() => {});
          }
        }

        const auditChannelId = await getAuditChannelId(interaction.guild.id);

        const finalPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          title: "✅ Pembersihan Pesan (Purge) Selesai",
          expression: "success",
          description: [
            `Proses pembersihan riwayat pesan selesai dilaksanakan.`,
            ``,
            `🗑️ **Pesan Terhapus:** **${deletedCount}** pesan`,
            targetUser ? `🎯 **Filter Pengguna:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)` : null,
            skippedOldCount > 0 ? `⚠️ **Dilewati (>14 hari):** ${skippedOldCount} pesan` : null,
            `📍 **Channel:** <#${interaction.channel.id}>`,
            `🛡️ **Moderator:** <@${interaction.user.id}>`,
            `⏱️ **Waktu Selesai:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            auditChannelId ? `\n-# 📝 Log moderasi terkirim ke <#${auditChannelId}>` : null,
          ].filter(Boolean).join("\n"),
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(finalPayload);
        await sendModLog(interaction.guild, finalPayload);
      } catch (error) {
        logger.error("[Purge Error]:", error);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Melakukan Purge",
          description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan saat menghapus pesan: ${error.message}`,
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(errPayload);
      }
    } else if (subcommand === "nuke") {
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageChannels,
        )
      ) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("error") || "❌"} Kamu tidak punya izin **Manage Channels**.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const confirmPayload = buildContainerV2({
        accentColorHex: "#ff0000",
        title: `${ui.getEmoji("radioactive") || "☢️"} TACTICAL NUKE INCOMING!`,
        description: `Kamu yakin ingin me-nuke channel ini?\n\nChannel akan dihapus dan dikloning. Semua pesan akan hilang selamanya.\nKetik \`CONFIRM\` dalam 10 detik di obrolan ini untuk melanjutkan.`,
        footerText: ui.getFooter("core"),
      });

      await interaction.reply({
        ...confirmPayload,
        flags: MessageFlags.IsComponentsV2,
      });

      const filter = (m) =>
        m.author.id === interaction.user.id && m.content === "CONFIRM";
      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 10000,
        max: 1,
      });

      collector.on("collect", async () => {
        try {
          const channel = interaction.channel;
          const position = channel.position;

          const newChannel = await channel.clone();
          await newChannel.setPosition(position);
          await channel.delete();

          const successPayload = buildContainerV2({
            accentColorHex: "#00FFFF",
            title: `${ui.getEmoji("radioactive") || "☢️"} Channel Di-nuke`,
            description: `${ui.getEmoji("radioactive") || "☢️"} **Channel berhasil di-nuke oleh ${interaction.user.username}**`,
            footerText: ui.getFooter("core"),
          });

          await newChannel.send(successPayload);
        } catch (e) {
          logger.error("[Nuke Error]:", e);
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          const cancelPayload = buildErrorContainerV2({
            title: "Nuke Dibatalkan",
            description: `${ui.getEmoji("error") || "❌"} Operasi nuke dibatalkan (Waktu habis).`,
            footerText: ui.getFooter("core"),
          });
          interaction.editReply(cancelPayload).catch(() => {});
        }
      });
    } else if (subcommand === "roleall") {
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageRoles,
        )
      ) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("error") || "❌"} Kamu tidak punya izin **Manage Roles**.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const targetRole = interaction.options.getRole("role");
      const action = interaction.options.getString("aksi");

      if (
        targetRole.position >=
        interaction.guild.members.me.roles.highest.position
      ) {
        const errPayload = buildErrorContainerV2({
          title: "Role Lebih Tinggi",
          description: `${ui.getEmoji("error") || "❌"} Role tersebut lebih tinggi atau sama dengan role tertinggi saya. Saya tidak bisa memodifikasinya.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply();

      const members = await interaction.guild.members.fetch();
      let successCount = 0;
      let skipCount = 0;

      const processingPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `${ui.getEmoji("loading") || "⏳"} Memproses Role All`,
        description: `${ui.getEmoji("loading") || "⏳"} Sedang memproses pemberian/pencabutan role **${targetRole.name}** ke ${members.size} member...`,
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(processingPayload);

      for (const [, member] of members) {
        try {
          if (action === "add") {
            if (!member.roles.cache.has(targetRole.id)) {
              await member.roles.add(targetRole);
              successCount++;
            } else skipCount++;
          } else {
            if (member.roles.cache.has(targetRole.id)) {
              await member.roles.remove(targetRole);
              successCount++;
            } else skipCount++;
          }
        } catch (e) {}
      }

      const finalPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: `${ui.getEmoji("success") || "✅"} Operasi Role-All Selesai`,
        description: `**Aksi:** ${action === "add" ? "Penambahan" : "Pencabutan"} Role <@&${targetRole.id}>\n\n**Berhasil:** ${successCount} member\n**Dilewati (Sudah sesuai/Gagal):** ${skipCount} member`,
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(finalPayload);
    } else if (subcommand === "timeout") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak memiliki izin **Moderate Members** untuk melakukan timeout.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const targetUser = interaction.options.getUser("user");
      const durationKey = interaction.options.getString("durasi");
      const reason = interaction.options.getString("alasan") || "Tidak ada alasan yang diberikan.";

      if (targetUser.id === interaction.user.id) {
        const errPayload = buildErrorContainerV2({
          title: "Tindakan Tidak Sah",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak bisa membisukan diri sendiri.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      if (targetUser.id === interaction.client.user.id) {
        const errPayload = buildErrorContainerV2({
          title: "Tindakan Tidak Sah",
          description: `${ui.getEmoji("error") || "❌"} Naura tidak bisa membisukan diri sendiri!`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply();

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        const errPayload = buildErrorContainerV2({
          title: "Member Tidak Ditemukan",
          description: `${ui.getEmoji("error") || "❌"} Pengguna tersebut tidak berada di dalam server ini.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }

      if (!targetMember.moderatable) {
        const errPayload = buildErrorContainerV2({
          title: "Hierarki Role Lebih Tinggi",
          description: `${ui.getEmoji("error") || "❌"} Naura tidak dapat membisukan <@${targetUser.id}> karena role mereka lebih tinggi atau setara dengan role Naura.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }

      const durationMap = {
        "60s": { ms: 60 * 1000, label: "60 Detik (1 Menit)" },
        "5m": { ms: 5 * 60 * 1000, label: "5 Menit" },
        "10m": { ms: 10 * 60 * 1000, label: "10 Menit" },
        "1h": { ms: 60 * 60 * 1000, label: "1 Jam" },
        "1d": { ms: 24 * 60 * 60 * 1000, label: "1 Hari (24 Jam)" },
        "1w": { ms: 7 * 24 * 60 * 60 * 1000, label: "1 Minggu (7 Hari)" },
      };

      const durationInfo = durationMap[durationKey] || durationMap["5m"];

      try {
        // Coba kirim notifikasi DM sebelum timeout
        await targetUser.send({
          ...buildContainerV2({
            accentColorHex: "#F59E0B",
            title: "Pemberitahuan Pembisuan Server",
            description: `Anda telah dibisukan di server **${interaction.guild.name}**.\n\n⏱️ **Durasi:** ${durationInfo.label}\n📝 **Alasan:** ${reason}\n🛡️ **Moderator:** ${interaction.user.tag}`,
            footerText: ui.getFooter("core"),
          }),
        }).catch(() => {});

        await targetMember.timeout(durationInfo.ms, `${reason} (Oleh: ${interaction.user.tag})`);

        const auditChannelId = await getAuditChannelId(interaction.guild.id);

        const responsePayload = buildContainerV2({
          accentColorHex: "#F59E0B",
          title: "⏳ Anggota Berhasil Dibisukan (Timeout)",
          expression: "warning",
          description: [
            `Tindakan pembisuan sementara telah berhasil diterapkan.`,
            ``,
            `👤 **Target:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)`,
            `⏱️ **Durasi:** ${durationInfo.label}`,
            `📝 **Alasan:** ${reason}`,
            `🛡️ **Moderator:** <@${interaction.user.id}>`,
            `📅 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            auditChannelId ? `\n-# 📝 Log moderasi tercatat di <#${auditChannelId}>` : null,
          ].filter(Boolean).join("\n"),
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(responsePayload);

        // Kirim siaran audit log ke channel admin
        await sendModLog(interaction.guild, responsePayload);
      } catch (err) {
        logger.error("[Timeout Error]:", err);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Melakukan Timeout",
          description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(errPayload);
      }
    } else if (subcommand === "untimeout") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak memiliki izin **Moderate Members** untuk menghapus timeout.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const targetUser = interaction.options.getUser("user");
      const reason = interaction.options.getString("alasan") || "Status pembisuan dicabut oleh moderator.";

      await interaction.deferReply();

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        const errPayload = buildErrorContainerV2({
          title: "Member Tidak Ditemukan",
          description: `${ui.getEmoji("error") || "❌"} Pengguna tersebut tidak berada di dalam server ini.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }

      if (!targetMember.isCommunicationDisabled()) {
        const errPayload = buildErrorContainerV2({
          title: "Tidak Sedang Dibisukan",
          description: `${ui.getEmoji("info") || "ℹ️"} <@${targetUser.id}> saat ini tidak dalam status timeout.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }

      try {
        await targetMember.timeout(null, `${reason} (Oleh: ${interaction.user.tag})`);

        const auditChannelId = await getAuditChannelId(interaction.guild.id);

        const responsePayload = buildContainerV2({
          accentColorHex: "#10B981",
          title: "🔊 Status Pembisuan Dicabut (Untimeout)",
          expression: "success",
          description: [
            `Pembisuan telah dicabut dan anggota kini dapat kembali berinteraksi di server.`,
            ``,
            `👤 **Target:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)`,
            `📝 **Alasan:** ${reason}`,
            `🛡️ **Moderator:** <@${interaction.user.id}>`,
            `📅 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            auditChannelId ? `\n-# 📝 Log moderasi tercatat di <#${auditChannelId}>` : null,
          ].filter(Boolean).join("\n"),
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(responsePayload);
        await sendModLog(interaction.guild, responsePayload);
      } catch (err) {
        logger.error("[Untimeout Error]:", err);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Menghapus Timeout",
          description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(errPayload);
      }
    } else if (subcommand === "kick") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak memiliki izin **Kick Members**.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const targetUser = interaction.options.getUser("user");
      const reason = interaction.options.getString("alasan") || "Tidak ada alasan yang diberikan.";

      if (targetUser.id === interaction.user.id) {
        const errPayload = buildErrorContainerV2({
          title: "Tindakan Tidak Sah",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak bisa mengeluarkan diri sendiri.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        const errPayload = buildErrorContainerV2({
          title: "Member Tidak Ditemukan",
          description: `${ui.getEmoji("error") || "❌"} Pengguna tersebut tidak berada di dalam server ini.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      if (!targetMember.kickable) {
        const errPayload = buildErrorContainerV2({
          title: "Hierarki Role Lebih Tinggi",
          description: `${ui.getEmoji("error") || "❌"} Naura tidak dapat mengeluarkan <@${targetUser.id}> karena role mereka lebih tinggi atau setara dengan role Naura.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_kick_${targetUser.id}`)
          .setLabel("Ya, Keluarkan (Kick)")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("👢"),
        new ButtonBuilder()
          .setCustomId(`cancel_kick_${targetUser.id}`)
          .setLabel("Batalkan")
          .setStyle(ButtonStyle.Secondary),
      );

      const confirmPayload = buildContainerV2({
        accentColorHex: "#F97316",
        title: "Konfirmasi Pengeluaran Anggota",
        expression: "warning",
        description: [
          `Apakah Anda yakin ingin mengeluarkan anggota berikut dari server?`,
          ``,
          `👤 **Target:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)`,
          `📝 **Alasan:** ${reason}`,
          `🛡️ **Moderator:** <@${interaction.user.id}>`,
          ``,
          `⚠️ Target dapat bergabung kembali jika memiliki tautan undangan yang sah. Klik konfirmasi dalam 30 detik.`,
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

        if (i.customId.startsWith("cancel_kick_")) {
          const cancelPayload = buildContainerV2({
            accentColorHex: ui.getColor("neutral") || "#64748B",
            title: "Pengeluaran Dibatalkan",
            expression: "neutral",
            description: `Tindakan pengeluaran terhadap <@${targetUser.id}> telah dibatalkan oleh Anda.`,
            footerText: ui.getFooter("core"),
          });
          return i.update({ ...cancelPayload, components: cancelPayload.components });
        }

        try {
          await targetUser.send({
            ...buildContainerV2({
              accentColorHex: "#F97316",
              title: "Pemberitahuan Pengeluaran Server",
              description: `Anda telah dikeluarkan (kick) dari server **${interaction.guild.name}**.\n\n📝 **Alasan:** ${reason}\n🛡️ **Moderator:** ${interaction.user.tag}`,
              footerText: ui.getFooter("core"),
            }),
          }).catch(() => {});

          await targetMember.kick(`${reason} (Oleh: ${interaction.user.tag})`);

          const auditChannelId = await getAuditChannelId(interaction.guild.id);

          const responsePayload = buildContainerV2({
            accentColorHex: "#F97316",
            title: "👢 Anggota Berhasil Dikeluarkan (Kick)",
            expression: "success",
            description: [
              `Anggota telah dikeluarkan dari server.`,
              ``,
              `👤 **Target:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)`,
              `📝 **Alasan:** ${reason}`,
              `🛡️ **Moderator:** <@${interaction.user.id}>`,
              `⏱️ **Waktu Eksekusi:** <t:${Math.floor(Date.now() / 1000)}:F>`,
              auditChannelId ? `\n-# 📝 Log moderasi tercatat di <#${auditChannelId}>` : null,
            ].filter(Boolean).join("\n"),
            footerText: ui.getFooter("core"),
          });

          await i.update({ ...responsePayload, components: responsePayload.components });
          await sendModLog(interaction.guild, responsePayload);
        } catch (err) {
          logger.error("[Kick Error]:", err);
          const errPayload = buildErrorContainerV2({
            title: "Gagal Mengeluarkan Anggota",
            description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
            footerText: ui.getFooter("core"),
          });
          await i.update({ ...errPayload, components: errPayload.components });
        }
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          const timeoutPayload = buildContainerV2({
            accentColorHex: ui.getColor("neutral") || "#64748B",
            title: "Waktu Konfirmasi Habis",
            expression: "neutral",
            description: "Operasi pengeluaran dibatalkan otomatis karena tidak ada respons.",
            footerText: ui.getFooter("core"),
          });
          await interaction.editReply({ ...timeoutPayload, components: timeoutPayload.components }).catch(() => {});
        }
      });
    } else if (subcommand === "ban") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak memiliki izin **Ban Members**.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const targetUser = interaction.options.getUser("user");
      const deleteSeconds = interaction.options.getInteger("hapus_pesan") || 0;
      const reason = interaction.options.getString("alasan") || "Tidak ada alasan yang diberikan.";

      if (targetUser.id === interaction.user.id) {
        const errPayload = buildErrorContainerV2({
          title: "Tindakan Tidak Sah",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak bisa memblokir diri sendiri.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (targetMember && !targetMember.bannable) {
        const errPayload = buildErrorContainerV2({
          title: "Hierarki Role Lebih Tinggi",
          description: `${ui.getEmoji("error") || "❌"} Naura tidak dapat memblokir <@${targetUser.id}> karena role mereka lebih tinggi atau setara dengan role Naura.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_ban_${targetUser.id}`)
          .setLabel("Ya, Ban Permanen")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔨"),
        new ButtonBuilder()
          .setCustomId(`cancel_ban_${targetUser.id}`)
          .setLabel("Batalkan")
          .setStyle(ButtonStyle.Secondary),
      );

      const confirmPayload = buildContainerV2({
        accentColorHex: "#EF4444",
        title: "Konfirmasi Pemblokiran Anggota",
        expression: "warning",
        description: [
          `Apakah Anda yakin ingin memblokir anggota berikut secara permanen?`,
          ``,
          `👤 **Target:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)`,
          `📝 **Alasan:** ${reason}`,
          `🗑️ **Pembersihan Pesan:** ${deleteSeconds === 0 ? "Tidak ada" : deleteSeconds === 86400 ? "24 Jam Terakhir" : "7 Hari Terakhir"}`,
          `🛡️ **Moderator:** <@${interaction.user.id}>`,
          ``,
          `⚠️ Tindakan ini permanen dan akan menghapus akses target dari server. Klik tombol konfirmasi dalam 30 detik.`,
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

        if (i.customId.startsWith("cancel_ban_")) {
          const cancelPayload = buildContainerV2({
            accentColorHex: ui.getColor("neutral") || "#64748B",
            title: "Pemblokiran Dibatalkan",
            expression: "neutral",
            description: `Tindakan pemblokiran terhadap <@${targetUser.id}> telah dibatalkan oleh Anda.`,
            footerText: ui.getFooter("core"),
          });
          return i.update({ ...cancelPayload, components: cancelPayload.components });
        }

        try {
          await targetUser.send({
            ...buildContainerV2({
              accentColorHex: "#EF4444",
              title: "Pemberitahuan Pemblokiran Server",
              description: `Anda telah diblokir secara permanen dari server **${interaction.guild.name}**.\n\n📝 **Alasan:** ${reason}\n🛡️ **Moderator:** ${interaction.user.tag}`,
              footerText: ui.getFooter("core"),
            }),
          }).catch(() => {});

          await interaction.guild.members.ban(targetUser.id, {
            deleteMessageSeconds: deleteSeconds,
            reason: `${reason} (Oleh: ${interaction.user.tag})`,
          });

          const auditChannelId = await getAuditChannelId(interaction.guild.id);

          const responsePayload = buildContainerV2({
            accentColorHex: "#EF4444",
            title: "🔨 Anggota Berhasil Diblokir (Ban)",
            expression: "success",
            description: [
              `Pengguna telah dilarang masuk server secara permanen.`,
              ``,
              `👤 **Target:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)`,
              `🗑️ **Pembersihan Pesan:** ${deleteSeconds === 0 ? "Tidak ada" : deleteSeconds === 86400 ? "24 Jam Terakhir" : "7 Hari Terakhir"}`,
              `📝 **Alasan:** ${reason}`,
              `🛡️ **Moderator:** <@${interaction.user.id}>`,
              `⏱️ **Waktu Eksekusi:** <t:${Math.floor(Date.now() / 1000)}:F>`,
              auditChannelId ? `\n-# 📝 Log moderasi tercatat di <#${auditChannelId}>` : null,
            ].filter(Boolean).join("\n"),
            footerText: ui.getFooter("core"),
          });

          await i.update({ ...responsePayload, components: responsePayload.components });
          await sendModLog(interaction.guild, responsePayload);
        } catch (err) {
          logger.error("[Ban Error]:", err);
          const errPayload = buildErrorContainerV2({
            title: "Gagal Memblokir Anggota",
            description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
            footerText: ui.getFooter("core"),
          });
          await i.update({ ...errPayload, components: errPayload.components });
        }
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          const timeoutPayload = buildContainerV2({
            accentColorHex: ui.getColor("neutral") || "#64748B",
            title: "Waktu Konfirmasi Habis",
            expression: "neutral",
            description: "Operasi pemblokiran dibatalkan otomatis karena tidak ada konfirmasi dalam 30 detik.",
            footerText: ui.getFooter("core"),
          });
          await interaction.editReply({ ...timeoutPayload, components: timeoutPayload.components }).catch(() => {});
        }
      });
    } else if (subcommand === "unban") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("error") || "❌"} Anda tidak memiliki izin **Ban Members** untuk membatalkan ban.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
      }

      const targetUserId = interaction.options.getString("user_id").trim();
      const reason = interaction.options.getString("alasan") || "Pemblokiran dibatalkan oleh moderator.";

      await interaction.deferReply();

      try {
        const unbannedUser = await interaction.guild.members.unban(
          targetUserId,
          `${reason} (Oleh: ${interaction.user.tag})`
        );

        const auditChannelId = await getAuditChannelId(interaction.guild.id);

        const responsePayload = buildContainerV2({
          accentColorHex: "#10B981",
          title: "🔓 Pemblokiran Berhasil Dicabut (Unban)",
          expression: "success",
          description: [
            `Pengguna telah diizinkan kembali untuk bergabung ke server.`,
            ``,
            `👤 **Target:** ${unbannedUser ? unbannedUser.tag : targetUserId} (\`${targetUserId}\`)`,
            `📝 **Alasan:** ${reason}`,
            `🛡️ **Moderator:** <@${interaction.user.id}>`,
            `⏱️ **Waktu:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            auditChannelId ? `\n-# 📝 Log moderasi tercatat di <#${auditChannelId}>` : null,
          ].filter(Boolean).join("\n"),
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(responsePayload);
        await sendModLog(interaction.guild, responsePayload);
      } catch (err) {
        logger.error("[Unban Error]:", err);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Mencabut Ban",
          description: `${ui.getEmoji("error") || "❌"} Tidak dapat membatalkan ban untuk ID \`${targetUserId}\`. Pastikan ID valid dan pengguna memang sedang dalam daftar ban.`,
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(errPayload);
      }
    }

    if (subcommand === "panic") {
      if (
        !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: "Anda memerlukan izin **Manage Guild** atau **Administrator** untuk mengelola status Panic Lockdown.",
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const action = interaction.options.getString("aksi");
      await interaction.deferReply();

      try {
        if (action === "enable") {
          const result = await incidentService.activatePanicLockdown(interaction.guild, interaction.user.tag);
          const responsePayload = buildContainerV2({
            accentColorHex: ui.getColor("danger") || "#EF4444",
            title: "🚨 Panic Lockdown Diaktifkan",
            expression: "warning",
            description: `Server sedang dalam status darurat anti-raid.\n\n🛡️ **Channel Terkunci:** ${result.affectedChannels} channel\n👤 **Diaktifkan Oleh:** <@${interaction.user.id}>\n⏱️ **Slowmode Darurat:** 15 detik untuk @everyone\n\nGunakan \`/moderation panic aksi:restore\` jika situasi telah aman kembali.`,
            footerText: ui.getFooter("core"),
          });
          await interaction.editReply(responsePayload);
          await sendModLog(interaction.guild, responsePayload);
        } else {
          const result = await incidentService.restorePanicLockdown(interaction.guild, interaction.user.tag);
          const responsePayload = buildContainerV2({
            accentColorHex: ui.getColor("success") || "#10B981",
            title: "✅ Panic Lockdown Dipulihkan",
            expression: "success",
            description: `Karantina darurat server telah diangkat.\n\n🔓 **Channel Dipulihkan:** ${result.restoredChannels} channel\n👤 **Dipulihkan Oleh:** <@${interaction.user.id}>\n\nIzin kirim pesan @everyone dan pengaturan slowmode telah dikembalikan ke kondisi semula.`,
            footerText: ui.getFooter("core"),
          });
          await interaction.editReply(responsePayload);
          await sendModLog(interaction.guild, responsePayload);
        }
      } catch (err) {
        logger.error("[Panic Error]:", err);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Mengatur Panic Lockdown",
          description: `${ui.getEmoji("error") || "❌"} Terjadi kendala saat memproses Panic Lockdown: ${err.message}`,
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(errPayload);
      }
    }
  },
};
