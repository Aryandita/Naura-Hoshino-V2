const { logger } = require("../managers/logger");
const ui = require("../config/ui");
const backupManager = require("./backupManager");
const cacheManager = require("./cacheManager");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");

class SecurityManager {
  /**
   * Logika Anti-Nuke Full Auto-Mitigation:
   * 1. Cabut semua role admin dari akun pelaku.
   * 2. Ban pelaku dari server secara instan.
   * 3. Otomatis restore channel/role dari snapshot backupManager jika tersedia.
   * 4. Kirim notifikasi darurat ke owner & audit log.
   */
  static async handleAuditLog(guild, entry, type) {
    const guildSettingsData = await cacheManager.getGuildSettings(guild.id);
    const settings = guildSettingsData?.settings?.antinuke;

    // Default aktif jika antinuke tidak dimatikan secara eksplisit
    const isEnabled = settings?.enabled ?? true;
    if (!isEnabled) return;

    const executor = entry.executor;
    if (
      !executor ||
      executor.id === guild.ownerId ||
      (executor.bot && executor.id === guild.client.user.id)
    )
      return;

    // Whitelist check
    const whitelist = settings?.whitelist || [];
    if (whitelist.includes(executor.id)) return;

    try {
      logger.warn(
        `[ANTI-NUKE] Triggered on guild ${guild.name} (${guild.id}) by ${executor.tag} (${executor.id}) for action: ${type}`,
      );

      // 1. Cabut semua role dari pelaku (Strip Permissions)
      const targetMember = await guild.members
        .fetch(executor.id)
        .catch(() => null);
      if (targetMember && targetMember.manageable) {
        await targetMember.roles
          .set(
            [],
            "🛡️ Naura Anti-Nuke: Stripping all permissions from attacker",
          )
          .catch(() => {});
      }

      // 2. Ban pelaku secara instan & hapus 7 hari pesannya
      await guild.members
        .ban(executor.id, {
          reason: `🛡️ Naura Anti-Nuke Auto-Mitigation: Triggered on bulk ${type}`,
          deleteMessageSeconds: 604800,
        })
        .catch(() => {});

      // 3. Auto-Restore dari Backup
      let restoreStatus = "TIDAK TERSEDIA (Belum ada backup)";
      try {
        const latestBackup = await backupManager.getLatestBackup(guild.id);
        if (latestBackup) {
          await backupManager.restoreGuildBackup(guild.id, latestBackup.id);
          restoreStatus = `BERHASIL (Pulih dari snapshot ID \`${latestBackup.id}\`)`;
        }
      } catch (restoreErr) {
        logger.error("[Anti-Nuke Restore Error]", restoreErr);
        restoreStatus = `GAGAL RESTORE: ${restoreErr.message}`;
      }

      // 4. Kirim Laporan Darurat ke Guild Owner
      const owner = await guild.fetchOwner().catch(() => null);
      const alertPayload = buildContainerV2({
        accentColorHex: "#FF0000",
        authorName: "Naura Emergency Security Governance",
        title: "🚨 ANTI-NUKE AUTO-MITIGATION TRIGGERED!",
        description: [
          `⚠️ **Tindakan Berbahaya Terdeteksi:** \`${type}\``,
          `👤 **Pelaku:** ${executor.tag} (\`${executor.id}\`)`,
          `🛡️ **Tindakan Keamanan:** Hak akses dicabut & Pelaku di-banned secara instan!`,
          `🔄 **Status Pemulihan Data:** ${restoreStatus}`,
          "",
          ` Server Anda telah berhasil dilindungi oleh mesin Naura Security.`,
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });

      if (owner) {
        await owner.send(alertPayload).catch(() => {});
      }

      // Kirim ke log channel jika ada
      const logChannelId = guildSettingsData?.settings?.automod?.logChannel;
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          await logChannel.send(alertPayload).catch(() => {});
        }
      }
    } catch (err) {
      logger.error("[Security Manager Error]", err);
    }
  }
}

module.exports = SecurityManager;
