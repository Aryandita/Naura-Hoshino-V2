"use strict";

/**
 * @file power.js
 * @description Command manajemen siklus hidup bot (Graceful Restart, Shutdown, Flush, Maintenance).
 * Eksklusif untuk Owner bot (env.OWNER_IDS) dengan Components V2 & proteksi konfirmasi ganda.
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const env = require("../../src/config/env");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { createManagedCollector } = require("../../src/utils/interactionPipeline");
const lifecycleManager = require("../../src/managers/lifecycleManager");

function isOwner(userId) {
  return env.OWNER_IDS && env.OWNER_IDS.includes(String(userId));
}

function buildMainPanelPayload(client, noticeText = null, disabled = false) {
  const health = lifecycleManager.getSystemHealth(client);

  const pgStatus = health.databases.postgres ? "🟢 Postgres OK" : "🔴 Postgres Off";
  const redisStatus = health.databases.redis ? "🟢 Redis OK" : "🟡 Redis Standby";
  const mongoStatus = health.databases.mongo ? "🟢 Mongo OK" : "⚪ Mongo Off";

  const maintBadge = health.isMaintenance
    ? "🔴 **AKTIF (Hanya Owner)**"
    : "🟢 **NORMAL (Publik Aktif)**";

  const description = [
    ...(noticeText ? [noticeText, ""] : []),
    "Selamat datang di **Pusat Manajemen Daya & Siklus Hidup** Naura Hoshino.",
    "Gunakan tombol di bawah untuk mengontrol operasional bot secara aman dengan mekanisme **Graceful Shutdown**.",
    "",
    "📊 **Kesehatan Sistem Saat Ini:**",
    `• **Waktu Aktif (Uptime):** \`${health.uptimeFormatted}\``,
    `• **Penggunaan RAM:** \`RSS: ${health.memory.rssMb} MB\` | \`Heap: ${health.memory.heapUsedMb} / ${health.memory.heapTotalMb} MB\``,
    `• **Koneksi Database:** \`${pgStatus}\` · \`${redisStatus}\` · \`${mongoStatus}\``,
    `• **Kluster Audio Poru:** \`${health.audio.activePlayers} Pemutar Aktif\` | \`${health.audio.connectedNodes}/${health.audio.totalNodes} Nodes Terhubung\``,
    `• **Antrean Tulis Cache:** \`${health.cache.pendingWrites} antrean pending\``,
    `• **Mode Pemeliharaan:** ${maintBadge}`,
    "",
    "-# 🔒 *Panel ini dilindungi oleh otentikasi level sistem dan hanya dapat diakses oleh Developer terdaftar.*",
  ].join("\n");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pwr_restart")
      .setLabel("Restart Bot")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
      .setEmoji(ui.parseEmoji("🔄") || { name: "🔄" }),
    new ButtonBuilder()
      .setCustomId("pwr_shutdown")
      .setLabel("Matikan Bot")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
      .setEmoji(ui.parseEmoji("🛑") || { name: "🛑" }),
    new ButtonBuilder()
      .setCustomId("pwr_maintenance")
      .setLabel(health.isMaintenance ? "Buka Akses Publik" : "Mode Maintenance")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
      .setEmoji(ui.parseEmoji("🛠️") || { name: "🛠️" }),
    new ButtonBuilder()
      .setCustomId("pwr_flush")
      .setLabel("Flush Cache Data")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
      .setEmoji(ui.parseEmoji("💾") || { name: "💾" }),
  );

  return buildContainerV2({
    accentColorHex: health.isMaintenance ? "#F59E0B" : "#6366F1",
    authorName: "Naura Hoshino • Power & Lifecycle Engine",
    title: "⚡ Panel Kontrol Daya & Pemeliharaan Sistem",
    description,
    buttonsRow: row,
    footerText: ui.getFooter("core"),
  });
}

function buildConfirmationPayload(action) {
  const isRestart = action === "restart";
  const title = isRestart ? "🔄 Konfirmasi Restart Bot" : "🛑 Konfirmasi Shutdown Bot";
  const color = isRestart ? "#3B82F6" : "#EF4444";

  const description = [
    `Apakah kamu yakin ingin melakukan **${isRestart ? "Graceful Restart" : "Full Shutdown"}** pada Naura Hoshino?`,
    "",
    "⚠️ **Prosedur Pengamanan Otomatis:**",
    "1. Penyangga XP leveling akan disetor seketika ke database.",
    "2. Seluruh antrean tulis tertunda di cache akan di-flush ke PostgreSQL.",
    "3. Pemutar musik di voice channel akan dilepaskan secara bersih.",
    "4. Pool koneksi database dan Discord Gateway akan ditutup secara teratur.",
    isRestart
      ? "\n*Bot akan menyala kembali secara otomatis dalam beberapa detik.*"
      : "\n*Bot akan berhenti beroperasi sampai dinyalakan kembali secara manual di server hosting.*",
  ].join("\n");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pwr_do_${action}`)
      .setLabel(isRestart ? "Ya, Restart Sekarang" : "Ya, Matikan Sekarang")
      .setStyle(isRestart ? ButtonStyle.Primary : ButtonStyle.Danger)
      .setEmoji(ui.parseEmoji(isRestart ? "🔄" : "🛑") || { name: isRestart ? "🔄" : "🛑" }),
    new ButtonBuilder()
      .setCustomId("pwr_cancel")
      .setLabel("Batal")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji("❌") || { name: "❌" }),
  );

  return buildContainerV2({
    accentColorHex: color,
    authorName: "Peringatan Tindakan Kritis",
    title,
    description,
    buttonsRow: row,
    footerText: ui.getFooter("core"),
  });
}

async function attachPowerCollector(replyMessage, authorUser, client) {
  createManagedCollector(replyMessage, authorUser, {
    time: 120000,
    footerCategory: "core",
    denyMessage: "Hanya Owner bot yang memiliki wewenang untuk mengelola siklus hidup Naura.",
    async onCollect(interaction) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Akses Ditolak",
            description: "Hanya Owner bot yang memiliki wewenang untuk mengelola siklus hidup Naura.",
            footerText: ui.getFooter("core"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const customId = interaction.customId;

      if (customId === "pwr_restart") {
        const confirmPayload = buildConfirmationPayload("restart");
        await interaction.update(confirmPayload);
        return;
      }

      if (customId === "pwr_shutdown") {
        const confirmPayload = buildConfirmationPayload("shutdown");
        await interaction.update(confirmPayload);
        return;
      }

      if (customId === "pwr_cancel") {
        const mainPayload = buildMainPanelPayload(client);
        await interaction.update(mainPayload);
        return;
      }

      if (customId === "pwr_flush") {
        await interaction.deferUpdate();
        const res = await lifecycleManager.flushAllData();
        const notice = `✅ **Emergency Flush Berhasil:** ${res.flushedWrites} antrean cache tersimpan ke database.`;
        const mainPayload = buildMainPanelPayload(client, notice);
        await interaction.editReply(mainPayload);
        return;
      }

      if (customId === "pwr_maintenance") {
        await interaction.deferUpdate();
        const currentHealth = lifecycleManager.getSystemHealth(client);
        const newMaintState = !currentHealth.isMaintenance;
        await lifecycleManager.setMaintenanceMode(
          client,
          newMaintState,
          newMaintState ? `Pemeliharaan sistem oleh ${interaction.user.tag}` : "Normal",
        );
        const mainPayload = buildMainPanelPayload(client);
        await interaction.editReply(mainPayload);
        return;
      }

      if (customId === "pwr_do_restart") {
        const loadingPayload = buildLoadingContainerV2({
          authorName: "Naura Lifecycle Manager",
          title: "Memulai Graceful Restart...",
          loadingMessage: "Menyimpan data tertunda dan memulai ulang proses bot...",
          withBanner: false,
          footerText: ui.getFooter("core"),
        });
        await interaction.update(loadingPayload);

        // Beri jeda 800ms agar Discord REST selesai memperbarui pesan sebelum koneksi ditutup
        setTimeout(() => {
          lifecycleManager.executeRestart(client, {
            user: interaction.user.tag,
            reason: "Restart via Discord Power Panel",
          });
        }, 800).unref?.();
        return;
      }

      if (customId === "pwr_do_shutdown") {
        const shutdownSuccessPayload = buildContainerV2({
          accentColorHex: "#EF4444",
          authorName: "Naura Lifecycle Manager",
          title: "🛑 Bot Dinonaktifkan",
          description: "Seluruh data telah disimpan ke database dan koneksi ditutup secara bersih. Naura Hoshino kini telah nonaktif.",
          footerText: ui.getFooter("core"),
        });
        await interaction.update(shutdownSuccessPayload);

        setTimeout(() => {
          lifecycleManager.executeShutdown(client, {
            user: interaction.user.tag,
            reason: "Shutdown via Discord Power Panel",
          });
        }, 800).unref?.();
      }
    },
    async onEnd(_, reason) {
      if (reason === "navigated" || reason === "user") return;
      try {
        const health = lifecycleManager.getSystemHealth(client);
        if (!health.isShuttingDown) {
          const disabledPayload = buildMainPanelPayload(client, null, true);
          await replyMessage.edit(disabledPayload).catch(() => {});
        }
      } catch (_) {}
    },
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("power")
    .setDescription("⚡ Pusat kendali siklus hidup bot (Restart, Shutdown, Maintenance - Owner Only)")
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("📊 Buka panel kendali daya interaktif dengan metrik kesehatan sistem."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("restart")
        .setDescription("🔄 Lakukan Graceful Restart pada bot."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("shutdown")
        .setDescription("🛑 Lakukan Graceful Shutdown pada bot."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("flush")
        .setDescription("💾 Simpan seluruh data penyangga dan cache ke database tanpa restart."),
    ),
  aliases: ["restart", "shutdown", "reboot", "maintenance"],
  category: "owner",

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Akses Ditolak",
          description: "Perintah ini merupakan fasilitas sistem level tinggi yang dibatasi khusus untuk Owner bot.",
          footerText: ui.getFooter("core"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand(false) || "panel";

    if (sub === "restart") {
      const confirmPayload = buildConfirmationPayload("restart");
      const replyMsg = await interaction.reply({ ...confirmPayload, fetchReply: true });
      attachPowerCollector(replyMsg, interaction.user, interaction.client);
      return;
    }

    if (sub === "shutdown") {
      const confirmPayload = buildConfirmationPayload("shutdown");
      const replyMsg = await interaction.reply({ ...confirmPayload, fetchReply: true });
      attachPowerCollector(replyMsg, interaction.user, interaction.client);
      return;
    }

    if (sub === "flush") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await lifecycleManager.flushAllData();
      return interaction.editReply({
        ...buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22C55E",
          title: "💾 Emergency Flush Selesai",
          description: `Berhasil menyetorkan **${res.flushedWrites}** antrean transaksi cache dan penyangga XP ke database secara atomik.`,
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // Default: Buka panel kontrol lengkap
    const mainPayload = buildMainPanelPayload(interaction.client);
    const replyMsg = await interaction.reply({ ...mainPayload, fetchReply: true });
    attachPowerCollector(replyMsg, interaction.user, interaction.client);
  },

  async executePrefix(message, args, client) {
    if (!isOwner(message.author.id)) {
      return ui.sendError(message, "err_sys_23");
    }

    const invokedCommand = message.content
      .slice((env.PREFIX || "n!").length)
      .trim()
      .split(/ +/)[0]
      ?.toLowerCase();

    // Jika dipanggil via shortcut langsung: n!restart / n!reboot
    if (invokedCommand === "restart" || invokedCommand === "reboot" || args[0] === "restart") {
      const confirmPayload = buildConfirmationPayload("restart");
      const replyMsg = await message.reply(confirmPayload);
      attachPowerCollector(replyMsg, message.author, client);
      return;
    }

    // Jika dipanggil via shortcut langsung: n!shutdown
    if (invokedCommand === "shutdown" || args[0] === "shutdown") {
      const confirmPayload = buildConfirmationPayload("shutdown");
      const replyMsg = await message.reply(confirmPayload);
      attachPowerCollector(replyMsg, message.author, client);
      return;
    }

    // Jika dipanggil via shortcut langsung: n!power flush
    if (args[0] === "flush") {
      const res = await lifecycleManager.flushAllData();
      return message.reply(
        buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22C55E",
          title: "💾 Emergency Flush Selesai",
          description: `Berhasil menyetorkan **${res.flushedWrites}** antrean transaksi cache dan penyangga XP ke database secara atomik.`,
          footerText: ui.getFooter("core"),
        }),
      );
    }

    // Default: Panel lengkap
    const mainPayload = buildMainPanelPayload(client);
    const replyMsg = await message.reply(mainPayload);
    attachPowerCollector(replyMsg, message.author, client);
  },
};
