"use strict";

/**
 * @module OwnerOpsCommand
 * @description Operasi darurat & panel manajemen teknis khusus Owner bot.
 * 
 * Fitur Utama:
 * - Maintenance Mode: Aktifkan/nonaktifkan pemeliharaan global bot
 * - Kill Switch: Matikan modul/command spesifik tanpa shutdown bot
 * - Doctor Diagnostic: Cek kesehatan 6 pilar infrastruktur
 * - Logs Viewer: Tinjau log error terbaru langsung di DM Discord
 * - Key Management: Terbitkan, list, dan cabut kunci akses dev untuk Code Runner
 * - Player Repair: Pulihkan status pemain yang freeze/deadlock
 * - Player Heal: Pemulihan vital parsial/penuh (HP, stamina, hunger, thirst, sick)
 * - Premium Management: Grant/revoke status VIP Booster Premium
 * - Owner Panel: Ringkasan seluruh operasi khusus Owner
 * 
 * Keamanan Ketat:
 * - Hanya dapat diakses oleh user dalam OWNER_IDS
 * - Command diagnostik & key management WAJIB via DM (bukan guild channel)
 * - Audit trail mencatat callerTag untuk setiap operasi
 * 
 * Subcommands yang boleh dijalankan di Guild: heal, repair, panel, premium
 * Subcommands yang WAJIB di DM: maintenance, killswitch, doctor, logs, keygen, keylist, keyrevoke
 */

const { logger } = require("../../src/managers/logger");

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const env = require("../../src/config/env");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const incidentService = require("../../src/services/incidentService");
const accessKeyService = require("../../src/services/accessKeyService");

// ============================================================================
// SECTION 1: KONSTANTA & HELPER KEAMANAN
// ============================================================================

/** @constant {Array<string>} SUBCOMMANDS_ALLOWED_IN_GUILD - Subcommand yang boleh dijalankan di server */
const SUBCOMMANDS_ALLOWED_IN_GUILD = ["heal", "repair", "panel", "premium"];

/** @constant {number} DEFAULT_LOG_LIMIT - Jumlah default baris log yang ditampilkan */
const DEFAULT_LOG_LIMIT = 15;

/** @constant {number} MAX_LOG_TEXT_LENGTH - Batas karakter untuk blok log */
const MAX_LOG_TEXT_LENGTH = 3500;

/** @constant {number} DEFAULT_KEY_MAX_USES - Kuota eksekusi default untuk dev key */
const DEFAULT_KEY_MAX_USES = 10;

/** @constant {number} DEFAULT_KEY_DURATION_HOURS - Masa aktif default dev key (jam) */
const DEFAULT_KEY_DURATION_HOURS = 24;

/** @constant {number} DEFAULT_PREMIUM_DAYS - Durasi default premium grant (hari) */
const DEFAULT_PREMIUM_DAYS = 30;

/** @constant {number} MAX_VITAL_VALUE - Nilai maksimal untuk stamina/hunger/thirst (0-100) */
const MAX_VITAL_VALUE = 100;

/** @constant {number} MIN_HP_VALUE - Nilai minimal HP (tidak boleh 0) */
const MIN_HP_VALUE = 1;

/** @constant {number} KEYLIST_DISPLAY_LIMIT - Jumlah kunci yang ditampilkan dalam list */
const KEYLIST_DISPLAY_LIMIT = 15;

/**
 * Cek apakah userId adalah Owner bot berdasarkan konfigurasi env.
 * 
 * @param {string} userId - Discord User ID
 * @returns {boolean} true jika user ada di daftar OWNER_IDS
 */
function isOwner(userId) {
  return Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(userId);
}

// ============================================================================
// SECTION 2: SLASH COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("owner")
    .setDescription("🔒 Operasi darurat & panel manajemen teknis (Khusus DM Owner)")
    .addSubcommand((sub) =>
      sub
        .setName("maintenance")
        .setDescription("Aktifkan atau nonaktifkan pemeliharaan darurat global bot")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Status pemeliharaan")
            .setRequired(true)
            .addChoices(
              { name: "Aktifkan Pemeliharaan (ON)", value: "on" },
              { name: "Nonaktifkan Pemeliharaan (OFF)", value: "off" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Pesan alasan pemeliharaan untuk pengguna")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("killswitch")
        .setDescription("Matikan atau hidupkan modul perintah spesifik tanpa mematikan bot")
        .addStringOption((opt) =>
          opt
            .setName("modul")
            .setDescription("Nama modul / slash command (misal: music, auction, farm)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("Matikan atau Aktifkan?")
            .setRequired(true)
            .addChoices(
              { name: "Matikan Modul (DISABLED)", value: "matikan" },
              { name: "Aktifkan Kembali (ACTIVE)", value: "aktifkan" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("doctor")
        .setDescription("Jalankan diagnostik mandiri kesehatan 6 pilar infrastruktur"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("logs")
        .setDescription("Tinjau log error terbaru langsung di DM Discord")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Jumlah baris log terbaru (5-40)")
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(40),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("keygen")
        .setDescription("Terbitkan Kunci Akses (Dev Key) baru untuk Code Runner")
        .addUserOption((opt) =>
          opt
            .setName("target_user")
            .setDescription("Kunci khusus untuk user tertentu (opsional)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("max_uses")
            .setDescription("Batas kuota eksekusi (default: 10 kali)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("durasi_jam")
            .setDescription("Masa aktif kunci dalam hitungan jam (default: 24 jam)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(720),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("keylist")
        .setDescription("Lihat daftar kunci akses dev yang aktif saat ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("keyrevoke")
        .setDescription("Cabut kunci akses dev tertentu seketika")
        .addStringOption((opt) =>
          opt
            .setName("key")
            .setDescription("Kode kunci yang ingin dicabut (contoh: NAURA-DEV-XXXX-XXXX)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("repair")
        .setDescription("Pulihkan status pemain yang mengalami freeze / lock deadlock")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Pemain yang hendak dipulihkan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("heal")
        .setDescription("Pulihkan status vital pemain (Penuh atau Parsial)")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Pemain yang hendak dipulihkan (kosongkan untuk diri sendiri)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("user_id")
            .setDescription("Discord User ID jika target di luar server")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Pilih status yang hendak dipulihkan")
            .setRequired(false)
            .addChoices(
              { name: "Semua Status (Full Recovery 100%)", value: "all" },
              { name: "Hanya Stamina", value: "stamina" },
              { name: "Hanya Kesehatan (HP)", value: "hp" },
              { name: "Hanya Nutrisi (Lapar/Hunger)", value: "hunger" },
              { name: "Hanya Hidrasi (Haus/Thirst)", value: "thirst" },
              { name: "Sembuhkan Penyakit", value: "sick" },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("jumlah")
            .setDescription("Jumlah nilai pemulihan (misal 50, 100)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("premium")
        .setDescription("Suntik atau cabut status VIP Booster Premium untuk member")
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Tindakan pemberian atau pencabutan status")
            .setRequired(true)
            .addChoices(
              { name: "Berikan VIP Premium (Grant)", value: "grant" },
              { name: "Cabut VIP Premium (Revoke)", value: "revoke" },
            ),
        )
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Member Discord yang hendak diberi status VIP")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("user_id")
            .setDescription("User ID Discord jika member di luar server")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("durasi_hari")
            .setDescription("Masa aktif status premium dalam hari (default: 30 hari)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(3650),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Tampilkan ringkasan seluruh operasi khusus Owner & pemisahannya dengan moderasi guild"),
    ),

  async execute(interaction) {
    // Validasi keamanan: hanya Owner bot yang boleh mengakses
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "\u26d4 Perintah ini sangat rahasia dan hanya dapat diakses oleh Owner bot.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const callerTag = interaction.user.globalName || interaction.user.username;

    // Perintah operasional berisiko kebocoran log/token wajib dieksekusi di DM
    if (interaction.guildId && !SUBCOMMANDS_ALLOWED_IN_GUILD.includes(sub)) {
      return interaction.reply({
        content: "\u26d4 Perintah diagnostik dan manajemen kunci hanya dapat diakses melalui Direct Message (DM) bersama Owner bot demi keamanan.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // =========================================================================
    // SECTION 3: PANEL DIREKTORI OWNER
    // =========================================================================
    if (sub === "panel") {
      const { buildOwnerPanelPayload } = require("../../src/utils/ownerPanelHelper");
      const payload = buildOwnerPanelPayload();
      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    }

    // =========================================================================
    // SECTION 4: MAINTENANCE MODE
    // =========================================================================
    if (sub === "maintenance") {
      const mode = interaction.options.getString("mode");
      const reason =
        interaction.options.getString("alasan") || "Pemeliharaan rutin terjadwal";
      const isActivating = mode === "on";

      await incidentService.setGlobalMaintenance(isActivating, reason, callerTag);

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: isActivating ? "#EF4444" : "#10B981",
          authorName: "Naura Incident Response Desk",
          title: isActivating
            ? "🚨 Mode Pemeliharaan Global DIAKTIFKAN"
            : "✅ Mode Pemeliharaan Global DINONAKTIFKAN",
          description: [
            isActivating
              ? "Seluruh interaksi slash command dan tombol pengguna biasa kini ditahan sementara."
              : "Seluruh interaksi pengguna telah kembali berjalan normal.",
            "",
            `📌 **Alasan:** *"${reason}"*`,
            `👤 **Diatur Oleh:** **${callerTag}**`,
            `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
            "",
            "-# *Catatan: Akun Owner tetap memiliki bypass penuh untuk menjalankan perintah saat maintenance.*",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // =========================================================================
    // SECTION 5: KILL-SWITCH MODUL
    // =========================================================================
    if (sub === "killswitch") {
      const modul = interaction.options.getString("modul");
      const status = interaction.options.getString("status");
      const isKilling = status === "matikan";

      await incidentService.setModuleKillSwitch(modul, isKilling, callerTag);

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: isKilling ? "#F59E0B" : "#10B981",
          authorName: "Naura Module Emergency Guard",
          title: isKilling
            ? `🛑 Modul "${modul}" Dinonaktifkan`
            : `🟢 Modul "${modul}" Diaktifkan Kembali`,
          description: [
            isKilling
              ? `Perintah **/${modul}** kini diblokir sementara untuk pengguna umum.`
              : `Perintah **/${modul}** kini dapat digunakan kembali seperti biasa.`,
            "",
            `👤 **Diatur Oleh:** **${callerTag}**`,
            `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // =========================================================================
    // SECTION 6: DOCTOR DIAGNOSTIC
    // =========================================================================
    if (sub === "doctor") {
      await interaction.deferReply();
      const report = await incidentService.runDoctorDiagnostic(interaction.client);

      const statusIcons = {
        UP: "🟢",
        DEGRADED: "🟡",
        DOWN: "🔴",
      };

      const pillarLines = [
        `${statusIcons[report.pillars.relationalDb?.status] || "⚪"} **PostgreSQL / Supabase:** ${report.pillars.relationalDb?.status} (${report.pillars.relationalDb?.latencyMs ?? 0}ms)`,
        `${statusIcons[report.pillars.mongoDb?.status] || "⚪"} **MongoDB Atlas:** ${report.pillars.mongoDb?.status} ${report.pillars.mongoDb?.latencyMs ? `(${report.pillars.mongoDb.latencyMs}ms)` : `(${report.pillars.mongoDb?.note || ""})`}`,
        `${statusIcons[report.pillars.redis?.status] || "⚪"} **Redis Cache & Lock:** ${report.pillars.redis?.status} ${report.pillars.redis?.latencyMs ? `(${report.pillars.redis.latencyMs}ms)` : `(${report.pillars.redis?.note || ""})`}`,
        `${statusIcons[report.pillars.audio?.status] || "⚪"} **Lavalink Audio:** ${report.pillars.audio?.status}`,
        `${statusIcons[report.pillars.canvas?.status] || "⚪"} **Canvas Worker Pool:** ${report.pillars.canvas?.status}`,
        report.pillars.gateway
          ? `🟢 **Discord Gateway:** Ping ${report.pillars.gateway.pingMs}ms (Uptime: ${Math.floor(report.pillars.gateway.uptimeSeconds / 60)}m)`
          : "",
      ].filter(Boolean);

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("incident_flush_cache")
          .setLabel("Flush Cache")
          .setEmoji("🧹")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("incident_release_locks")
          .setLabel("Lepas Deadlock")
          .setEmoji("🔓")
          .setStyle(ButtonStyle.Primary),
      );

      return interaction.editReply(
        buildContainerV2({
          accentColorHex:
            report.overallStatus === "ALL_SYSTEMS_OPERATIONAL"
              ? "#10B981"
              : report.overallStatus === "DEGRADED_PERFORMANCE"
                ? "#F59E0B"
                : "#EF4444",
          authorName: "Naura Doctor Diagnostic Engine",
          title: `🩺 Diagnostik Kesehatan: ${report.overallStatus}`,
          description: [
            "Hasil pemindaian kesehatan instan 6 pilar ekosistem Naura Hoshino:",
            "",
            ...pillarLines,
            "",
            `⏱️ **Waktu Diagnostik:** \`${report.totalDurationMs}ms\``,
            "",
            "-# Gunakan tombol di bawah jika ada cache atau deadlock transaksi yang perlu dibersihkan.",
          ].join("\n"),
          buttonsRow: [actionRow],
          footerText: ui.getFooter("core"),
        }),
      );
    }

    // =========================================================================
    // SECTION 7: LOGS VIEWER
    // =========================================================================
    if (sub === "logs") {
      const limit = interaction.options.getInteger("limit") || DEFAULT_LOG_LIMIT;
      const lines = incidentService.getRecentLogs(limit);

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#3B82F6",
          authorName: "Naura Runtime Logs",
          title: `📜 ${limit} Log Error Terkini`,
          description: [
            "Berikut kutipan log error terbaru dari sistem:",
            "```text",
            lines.join("\n").substring(0, MAX_LOG_TEXT_LENGTH),
            "```",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // =========================================================================
    // SECTION 8: KEYGEN - TERBITKAN KUNCI AKSES
    // =========================================================================
    if (sub === "keygen") {
      const targetUser = interaction.options.getUser("target_user");
      const maxUses = interaction.options.getInteger("max_uses") || DEFAULT_KEY_MAX_USES;
      const durationHours = interaction.options.getInteger("durasi_jam") || DEFAULT_KEY_DURATION_HOURS;

      const key = await accessKeyService.createKey({
        createdBy: callerTag,
        assignedToUserId: targetUser?.id || null,
        maxUses,
        durationHours,
      });

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#8B5CF6",
          authorName: "Naura Access Key Generator",
          title: "🔑 Kunci Akses Dev Berhasil Diterbitkan!",
          description: [
            "Kunci akses berikut dapat diberikan kepada pengguna untuk menjalankan kode via `/run`:",
            "",
            `🔐 **Kunci Lisensi:**`,
            `\`\`\`text`,
            key.keyString,
            `\`\`\``,
            `👤 **Target User:** ${targetUser ? `<@${targetUser.id}> (${targetUser.tag})` : "Siapa Saja (Publik)"}`,
            `📊 **Batas Pemakaian:** \`${maxUses} kali eksekusi\``,
            `⏳ **Kedaluwarsa:** ${key.expiresAt ? `<t:${Math.floor(new Date(key.expiresAt).getTime() / 1000)}:R>` : "Permanen"}`,
            "",
            "-# *Pengguna dapat menjalankan kodingan dengan perintah:*",
            `- # \`/run code:<kode> key:${key.keyString}\``,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // =========================================================================
    // SECTION 9: KEYLIST - DAFTAR KUNCI AKSES
    // =========================================================================
    if (sub === "keylist") {
      const keys = await accessKeyService.listKeys(KEYLIST_DISPLAY_LIMIT);

      if (keys.length === 0) {
        return interaction.reply({
          content: "Belum ada kunci akses dev yang diterbitkan.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const keyItems = keys.map(
        (k) =>
          `• \`${k.keyString}\` | Kuota: \`${k.usedCount}/${k.maxUses}\` | Status: ${k.isActive ? "🟢 Aktif" : "🔴 Nonaktif"} ${k.assignedToUserId ? `(Khusus: <@${k.assignedToUserId}>)` : ""}`,
      );

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#8B5CF6",
          authorName: "Naura Access Key Desk",
          title: "📋 Daftar Kunci Akses Dev",
          description: [
            "Berikut daftar 15 kunci akses dev terbaru:",
            "",
            ...keyItems,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // =========================================================================
    // SECTION 10: KEYREVOKE - CABUT KUNCI AKSES
    // =========================================================================
    if (sub === "keyrevoke") {
      const keyString = interaction.options.getString("key");
      const revoked = await accessKeyService.revokeKey(keyString);

      if (!revoked) {
        return interaction.reply({
          content: `⚠️ Kunci akses \`${keyString}\` tidak ditemukan.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `✅ Kunci akses **\`${keyString}\`** telah berhasil dicabut dan tidak dapat digunakan lagi.`,
      });
    }

    // =========================================================================
    // SECTION 11: REPAIR - PULIHKAN PLAYER STATE
    // =========================================================================
    if (sub === "repair") {
      const targetUser = interaction.options.getUser("user");
      const repairRes = await incidentService.repairPlayerState(
        targetUser.id,
        callerTag,
      );

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#10B981",
          authorName: "Naura Player State Doctor",
          title: `🩹 Pemulihan Akun: ${targetUser.username}`,
          description: [
            `Proses perbaikan data dan pelepasan deadlock selesai dilakukan:`,
            "",
            `👤 **Pemain:** <@${targetUser.id}> (\`${targetUser.id}\`)`,
            `🔓 **Kunci Transaksi Dilepas:** \`${repairRes.locksReleased} lock\``,
            `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
            "",
            "-# *Pemain kini dapat kembali berinteraksi tanpa terhalang status freeze atau in-action.*",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // =========================================================================
    // SECTION 12: HEAL - PEMULIHAN VITAL PLAYER
    // =========================================================================
    if (sub === "heal") {
      const targetUser = interaction.options.getUser("user");
      const targetId = interaction.options.getString("user_id") || targetUser?.id || interaction.user.id;
      const statType = (interaction.options.getString("tipe") || "all").toLowerCase().trim();
      const rawAmount = interaction.options.getInteger("jumlah");

      const cacheManager = require("../../src/managers/cacheManager");
      const leveling = require("../../src/survival/engines/survivalLeveling");
      const redisManager = require("../../src/managers/redisManager");

      const survival = await cacheManager.getUserSurvival(targetId);
      if (!survival) {
        return interaction.reply({
          content: `⚠️ Data survival untuk <@${targetId}> (\`${targetId}\`) tidak ditemukan. Pastikan sudah terdaftar di Naura Wilds.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const maxHp = leveling.calculateMaxHp(
        survival,
        survival.rpg_state?.class_bonus?.hp || 0,
      );

      const patch = {};
      let title = "";
      let detailDesc = "";

      if (statType === "stamina") {
        const val = Number.isFinite(rawAmount) ? Math.max(0, Math.min(MAX_VITAL_VALUE, rawAmount)) : 100;
        patch.stamina = val;
        title = `⚡ Pemulihan Stamina: <@${targetId}>`;
        detailDesc = `⚡ **Stamina:** \`${val}/100\``;
      } else if (statType === "hp") {
        const val = Number.isFinite(rawAmount) ? Math.max(MIN_HP_VALUE, Math.min(maxHp, rawAmount)) : maxHp;
        patch.hp = val;
        title = `❤️ Pemulihan Kesehatan (HP): <@${targetId}>`;
        detailDesc = `❤️ **HP:** \`${val}/${maxHp}\``;
      } else if (statType === "hunger" || statType === "lapar") {
        const val = Number.isFinite(rawAmount) ? Math.max(0, Math.min(MAX_VITAL_VALUE, rawAmount)) : 100;
        patch.hunger = val;
        title = `🍖 Pemulihan Nutrisi: <@${targetId}>`;
        detailDesc = `🍖 **Lapar:** \`${val}/100\``;
      } else if (statType === "thirst" || statType === "haus") {
        const val = Number.isFinite(rawAmount) ? Math.max(0, Math.min(MAX_VITAL_VALUE, rawAmount)) : 100;
        patch.thirst = val;
        title = `💧 Pemulihan Hidrasi: <@${targetId}>`;
        detailDesc = `💧 **Haus:** \`${val}/100\``;
      } else if (statType === "sick" || statType === "sembuh") {
        patch.rpg_state = {
          ...(survival.rpg_state || {}),
          sick: false,
        };
        title = `🩺 Kesembuhan Medis: <@${targetId}>`;
        detailDesc = `🩺 **Status Penyakit:** \`Sembuh Total\``;
      } else {
        // Default: 'all'
        patch.hp = maxHp;
        patch.hunger = 100;
        patch.thirst = 100;
        patch.stamina = 100;
        patch.rpg_state = {
          ...(survival.rpg_state || {}),
          sick: false,
        };
        title = `💖 Pemulihan Vital Penuh: <@${targetId}>`;
        detailDesc = [
          `❤️ **HP:** \`${maxHp}/${maxHp}\``,
          "🍖 **Lapar:** `100/100`",
          "💧 **Haus:** `100/100`",
          "⚡ **Stamina:** `100/100`",
          "🩺 **Status Penyakit:** `Sembuh Total`",
        ].join("\n");
      }

      await cacheManager.updateUserSurvival(targetId, patch);
      await cacheManager.flushUser(targetId);

      if (redisManager.isReady && redisManager.client) {
        try {
          await redisManager.client.del(`user:survival:${targetId}`);
        } catch (err) {
          logger.warn("[ownerOps:execute] Operasi cache Redis gagal: " + (err?.message || err));
        }
      }

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#10B981",
          authorName: "Naura Survival Doctor",
          title,
          description: [
            "Tindakan intervensi medis petualang berhasil dieksekusi:",
            "",
            `👤 **Target:** <@${targetId}> (\`${targetId}\`)`,
            detailDesc,
            `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
            "",
            "-# *Data tersinkronisasi instan ke PostgreSQL Supabase dan Redis Cache.*",
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        }),
        flags: interaction.guildId ? MessageFlags.Ephemeral : undefined,
      });
    }

    // =========================================================================
    // SECTION 13: PREMIUM - GRANT/REVOKE VIP
    // =========================================================================
    if (sub === "premium") {
      const action = interaction.options.getString("aksi") || "grant";
      const targetUser = interaction.options.getUser("user");
      const targetId = interaction.options.getString("user_id") || targetUser?.id || interaction.user.id;
      const days = interaction.options.getInteger("durasi_hari") || DEFAULT_PREMIUM_DAYS;

      const store = require("../../src/premium/premiumStore");
      const { tierDisplayName } = require("../../src/premium/premiumTiers");
      const cacheManager = require("../../src/managers/cacheManager");
      const redisManager = require("../../src/managers/redisManager");

      const profile = await cacheManager.getUserProfile(targetId);

      if (action === "revoke") {
        await store.revokePremium(targetId, profile);
        await cacheManager.flushUser(targetId);
        if (redisManager.isReady && redisManager.client) {
          try {
            await redisManager.client.del(`user:profile:${targetId}`);
          } catch (err) {
            logger.warn("[ownerOps:execute] Operasi cache Redis gagal: " + (err?.message || err));
          }
        }

        return interaction.reply({
          ...buildContainerV2({
            accentColorHex: "#EF4444",
            authorName: "Naura VIP Desk",
            title: `🚫 Status VIP Dicabut: <@${targetId}>`,
            description: [
              `Status VIP Booster Premium untuk pengguna <@${targetId}> (\`${targetId}\`) telah **berhasil dicabut**.`,
              "",
              `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
            ].join("\n"),
            footerText: ui.getFooter("core"),
          }),
          flags: interaction.guildId ? MessageFlags.Ephemeral : undefined,
        });
      }

      // Grant
      const newExpiry = await store.grantPremium(targetId, profile, days);
      const tierKey = ui.getPremiumTier(days, true);
      const displayName = tierDisplayName(tierKey, days);
      await cacheManager.flushUser(targetId);

      if (redisManager.isReady && redisManager.client) {
        try {
          await redisManager.client.del(`user:profile:${targetId}`);
        } catch (err) {
          logger.warn("[ownerOps:execute] Operasi cache Redis gagal: " + (err?.message || err));
        }
      }

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#FBBF24",
          authorName: "Naura VIP Desk",
          title: "🌟 Status VIP Premium Berhasil Ditanamkan",
          description: [
            `Berhasil mengaktifkan status **${displayName}** untuk <@${targetId}> (\`${targetId}\`)!`,
            "",
            `📅 **Durasi:** \`${days} Hari\``,
            `⏳ **Masa Berlaku Hingga:** <t:${Math.floor(newExpiry.getTime() / 1000)}:F>`,
            `👤 **Diberikan Oleh:** **${callerTag}**`,
            "",
            "-# *Benefit premium langsung aktif seketika tanpa perlu restart bot.*",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
        flags: interaction.guildId ? MessageFlags.Ephemeral : undefined,
      });
    }

  },
};