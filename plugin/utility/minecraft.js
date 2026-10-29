const {
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const { status } = require("mcstatus");

const axios = require("axios");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const {
  buildErrorContainerV2,
  buildLoadingContainerV2,
  buildSuccessContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const { getOrCreateBreaker, CircuitBreakerOpenError } = require("../../src/utils/circuitBreaker");

const mojangCache = new Map();

const mojangBreaker = getOrCreateBreaker("minecraft-mojang", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

// Periodic sweeping setiap 30 menit (Rule 1.8 Memory Safety)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of mojangCache.entries()) {
    if (value.cachedAt && now - value.cachedAt > 3600000) {
      // 1 jam TTL
      mojangCache.delete(key);
    }
  }
}, 1800000).unref?.();

async function getMojangProfile(username) {
  if (mojangCache.has(username)) {
    const cached = mojangCache.get(username);
    if (Date.now() - cached.cachedAt < 3600000) return cached;
    mojangCache.delete(username);
  }

  try {
    return await mojangBreaker.execute(async () => {
      const response = await axios.get(
        `https://api.mojang.com/users/profiles/minecraft/${username}`,
        { timeout: 5000 },
      );
      if (response.data && response.data.id) {
        const dataToCache = { ...response.data, cachedAt: Date.now() };
        mojangCache.set(username, dataToCache);
        return dataToCache;
      }
      return null;
    });
  } catch (e) {
    if (e instanceof CircuitBreakerOpenError) {
      logger.warn("[Minecraft] Mojang circuit OPEN, using cache or null");
      // Return cached data jika ada meskipun expired
      if (mojangCache.has(username)) {
        return mojangCache.get(username);
      }
      return null;
    }
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("minecraft")
    .setDescription(
      "Alat utilitas untuk game Minecraft (Server Ping, Skin Render, Sinkronisasi Akun)",
    )
    .addSubcommand((sub) =>
      sub
        .setName("ping")
        .setDescription(
          "Periksa status dan ping dari server Minecraft (Java Edition)",
        )
        .addStringOption((opt) =>
          opt
            .setName("ip")
            .setDescription("Alamat IP Server Minecraft")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("player")
        .setDescription(
          "Render kulit 3D (skin) & kepala (head) pemain Minecraft",
        )
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Username Minecraft (Premium)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("link")
        .setDescription(
          "Tautkan akun Discord-mu dengan username Minecraft asli",
        )
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Username Minecraft Premium milikmu")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("Lihat kartu statistik profil Minecraft-mu"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("sync")
        .setDescription(
          "🔄 Sinkronisasi waktu bermain dan klaim hadiah Star Fragments/Kupon dari server Minecraft",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("broadcast")
        .setDescription(
          "📢 Kirim pesan pengumuman ke dalam game Minecraft via RCON",
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Pesan yang ingin disiarkan ke server Minecraft")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("bridge")
        .setDescription("🔧 Atur jembatan chat Discord-Minecraft (Dua Arah)")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel Discord untuk jembatan chat")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("rcon_ip")
            .setDescription("Alamat IP RCON Server Minecraft")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("rcon_port")
            .setDescription("Port RCON Server Minecraft (Default: 25575)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("rcon_password")
            .setDescription("Kata Sandi RCON Server Minecraft")
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("Aktifkan atau nonaktifkan jembatan chat")
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    const loadingPayload = buildLoadingContainerV2({
      interaction,
      authorName: "Naura Minecraft Radar",
      title: "Memproses Permintaan...",
      description: `${ui.getEmoji("loading") || "⏳"} ${ui.getEmoji("naura_thinking") || "🤔"} *Naura sedang memproses permintaan /minecraft ${subcommand} kamu...*`,
      expression: "thinking",
      withBanner: true,
      footerText: ui.getFooter("utility"),
    });
    await interaction.deferReply();
    await interaction.editReply(loadingPayload);

    if (subcommand === "ping") {
      const ip = interaction.options.getString("ip");

      try {
        const response = await status(ip, 25565, { timeout: 5000 });

        const fields = [
          {
            name: `${ui.getEmoji("radar") || "📡"} Latensi / Ping`,
            value: `\`${response.ping}ms\``,
          },
          {
            name: `${ui.getEmoji("users") || "👥"} Populasi Pemain`,
            value: `\`${response.players.online} / ${response.players.max}\``,
          },
          {
            name: `${ui.getEmoji("gear") || "⚙️"} Versi Enjin`,
            value: `\`${response.version.name}\``,
          },
          {
            name: `${ui.getEmoji("scroll") || "📜"} MOTD (Pesan Hari Ini)`,
            value: `\`\`\`${response.motd.clean}\`\`\``,
          },
        ];

        if (response.players.sample && response.players.sample.length > 0) {
          const playerList = response.players.sample
            .map((p) => p.name)
            .join(", ");
          fields.push({
            name: `${ui.getEmoji("users") || "🧑‍🤝‍🧑"} Pemain Online (Sampel)`,
            value: `\`\`\`${playerList}\`\`\``,
          });
        }

        let radarBuffer = null;
        try {
          radarBuffer = await canvasWorkerPool.execute("renderMinecraftPing", {
            ip,
            port: 25565,
            ping: response.ping,
            players: response.players,
            version: response.version,
            motd: response.motd,
            favicon: response.favicon,
          });
        } catch (canvasErr) {
          logger.warn("[Minecraft] Gagal merender radar ping canvas: " + (canvasErr?.message || canvasErr));
        }

        const attachment = radarBuffer
          ? new AttachmentBuilder(radarBuffer, { name: "mc-server-radar.png" })
          : null;

        const payload = buildSuccessContainerV2({
          interaction,
          accentColorHex: ui.getColor("success") || "#00FF00",
          authorName: "Naura Minecraft Radar",
          title: `${ui.getEmoji("greenping") || "🟢"} Server ${ip} Online!`,
          description: `Radar Naura berhasil mendeteksi sinyal dari **${ip}**!\n\n> ${ui.getEmoji("naura_happy") || "✨"} *Servernya aktif dan siap menerima pemain!*`,
          fields,
          bannerAttachmentName: attachment ? "mc-server-radar.png" : undefined,
          files: attachment ? [attachment] : [],
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      } catch (error) {
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "Server Tidak Terjangkau",
          description: `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, Naura tidak bisa mencapai **${ip}**.\n\n${ui.getEmoji("sparkle") || "💡"} *Kemungkinan penyebab:*\n• Server sedang offline atau maintenance\n• Port TCP 25565 diblokir firewall\n• Server menolak koneksi eksternal\n\n*Coba periksa IP-nya atau tanya admin servernya, ya!*`,
          expression: "cry",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "player") {
      const username = interaction.options.getString("username");

      try {
        const profileData = await getMojangProfile(username);
        if (!profileData || !profileData.id) {
          const errPayload = buildErrorContainerV2({
            interaction,
            title: "Player Tidak Ditemukan",
            description: `${ui.getEmoji("naura_akward") || "😅"} Maaf ya, Naura tidak bisa menemukan **${username}** di database Mojang.\n\n${ui.getEmoji("sparkle") || "💡"} *Pastikan itu adalah akun Premium/Original Mojang, bukan akun cracked, ya!*`,
            expression: "akward",
            withBanner: true,
            footerText: ui.getFooter("utility"),
          });
          return interaction.editReply(errPayload);
        }

        const uuid = profileData.id;
        const realName = profileData.name;

        const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
        const buffer = await canvasWorkerPool.execute("renderMinecraftPlayer", { uuid, realName });

        const attachment = new AttachmentBuilder(buffer, {
          name: "mc-player-skin.png",
        });
        
        const successPayload = buildSuccessContainerV2({
          interaction,
          authorName: "Naura Minecraft Skin Renderer",
          title: `${ui.getEmoji("core") || "🌸"} Skin ${realName}`,
          description: `> ${ui.getEmoji("naura_happy") || "✨"} *Naura berhasil merender skin 3D milik **${realName}**! Keren banget!*\n\n*Skin ini diambil langsung dari server Mojang resmi.*`,
          bannerAttachmentName: "mc-player-skin.png",
          files: [attachment],
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(successPayload);
      } catch (error) {
        logger.error("[Mojang API Error]:", error.message);
        const isCircuitOpen = error instanceof CircuitBreakerOpenError;
        const errPayload = buildErrorContainerV2({
          interaction,
          title: isCircuitOpen ? "API Mojang Sedang Istirahat" : "Gagal Render Player",
          description: isCircuitOpen
            ? `${ui.getEmoji("naura_sleepy") || "😴"} API Mojang sedang terlalu sibuk dan butuh istirahat sebentar. Coba lagi dalam 1-2 menit ya, Naura tungguin!`
            : `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, Naura gagal merender data pemain. API Mojang mungkin sedang rate-limited atau down.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba beberapa saat lagi, Naura yakin akan berhasil!*`,
          expression: isCircuitOpen ? "sleepy" : "cry",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "link") {
      const username = interaction.options.getString("username");

      try {
        const profileData = await getMojangProfile(username);
        if (!profileData || !profileData.name) {
          const errPayload = buildErrorContainerV2({
            interaction,
            title: "Username Tidak Valid",
            description: `${ui.getEmoji("naura_akward") || "😅"} Maaf ya, username **${username}** tidak valid atau bukan akun Premium/Microsoft.\n\n${ui.getEmoji("sparkle") || "💡"} *Pastikan kamu menggunakan username Minecraft Premium yang benar, ya!*`,
            expression: "akward",
            withBanner: true,
            footerText: ui.getFooter("utility"),
          });
          return interaction.editReply(errPayload);
        }

        const MinecraftBridgeService = require("../../src/services/minecraftBridge");
        const code = await MinecraftBridgeService.generateLinkCode(
          interaction.user.id,
          profileData.name,
        );

        await cacheManager.updateUserProfile(interaction.user.id, {
          minecraft_ign: profileData.name,
          minecraft_uuid: profileData.id,
        });

        const linkPayload = buildSuccessContainerV2({
          interaction,
          accentColorHex: ui.getColor("success") || "#22c55e",
          authorName: `${ui.getEmoji("about") || "🔗"} Integrasi Identitas Minecraft`,
          iconURL: interaction.client.user.displayAvatarURL(),
          title: "Akun Berhasil Ditautkan!",
          description: `Akun Discord-mu sedang ditautkan dengan Minecraft **${profileData.name}**!\n\n${ui.getEmoji("key") || "🔑"} **Kode Verifikasi Anda:** \`${code}\`\n\n> ${ui.getEmoji("naura_happy") || "✨"} *Jalankan perintah berikut di dalam server Minecraft:* \n\`\`\`/naura link ${code}\`\`\`\n*Setelah verifikasi selesai, kamu akan mendapatkan bonus +500 Star Fragments ${ui.getEmoji("star") || "🌟"} dan bisa mengklaim hadiah playtime dengan \`/minecraft sync\`!*`,
          footerText: "Naura Minecraft Network Sync",
        });

        return interaction.editReply(linkPayload);
      } catch (error) {
        logger.error("[Link Account Error]:", error.message);
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "Gagal Memvalidasi Akun",
          description: `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, Naura gagal memvalidasi akun: ${error.message}\n\n${ui.getEmoji("sparkle") || "💡"} *Coba periksa username Minecraft-mu atau coba lagi nanti, ya!*`,
          expression: "cry",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "sync") {
      const MinecraftBridgeService = require("../../src/services/minecraftBridge");
      const syncRes = await MinecraftBridgeService.syncRewards(
        interaction.user.id,
      );

      if (!syncRes.success) {
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "Sinkronisasi Gagal",
          description: `${ui.getEmoji("naura_cry") || "😢"} ${syncRes.message}\n\n${ui.getEmoji("sparkle") || "💡"} *Pastikan kamu sudah menautkan akun dengan \`/minecraft link\` dan bermain di server Minecraft kami!*`,
          expression: "cry",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const syncPayload = buildSuccessContainerV2({
        interaction,
        accentColorHex: "#86EFAC",
        authorName: "Naura Minecraft Realm Sync",
        title: `${ui.getEmoji("trade") || "🔄"} Sinkronisasi Berhasil!`,
        description: `Waktu bermain di Minecraft **${syncRes.mcUsername}** berhasil dikonversi ke ekonomi Discord!\n\n${ui.getEmoji("star") || "🌟"} **Star Fragments:** \`+${syncRes.starFragments} SC\`\n${ui.getEmoji("ticket") || "🎟️"} **Naura Coupon:** \`+${syncRes.coupons} Kupon\`\n\n> ${ui.getEmoji("naura_happy") || "✨"} *Terima kasih sudah bermain! Terus kumpulkan reward dari waktu bermainmu, ya!*`,
        footerText: "Naura Minecraft Realm Sync",
      });

      return interaction.editReply(syncPayload);
    } else if (subcommand === "broadcast") {
      const msgText = interaction.options.getString("message");
      const { sendRconCommand } = require("../../src/utils/rcon");

      const settings = await cacheManager.getGuildSettings(interaction.guild.id);
      const mc = settings?.settings?.minecraft || {};

      if (!mc.ip || !mc.rconPassword) {
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "RCON Belum Dikonfigurasi",
          description: `${ui.getEmoji("naura_akward") || "😅"} Server ini belum mengonfigurasi IP/Password RCON.\n\n${ui.getEmoji("sparkle") || "💡"} *Minta admin server untuk mengatur jembatan chat dengan \`/minecraft bridge\` terlebih dahulu, ya!*`,
          expression: "akward",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      try {
        const rawJson = JSON.stringify([
          { text: "[Discord | ", color: "light_purple" },
          { text: interaction.user.username, color: "aqua", bold: true },
          { text: "] ", color: "light_purple" },
          { text: msgText, color: "white" },
        ]);
        await sendRconCommand(
          mc.ip,
          mc.rconPort || 25575,
          mc.rconPassword,
          `tellraw @a ${rawJson}`,
        );

        const bcPayload = buildSuccessContainerV2({
          interaction,
          accentColorHex: "#C084FC",
          authorName: "Naura Minecraft RCON Broadcast",
          title: `${ui.getEmoji("announce_update") || "📢"} Pesan Berhasil Disiarkan!`,
          description: `Pesan telah dikirim ke seluruh pemain di server Minecraft:\n\n> *"${msgText}"*\n\n> ${ui.getEmoji("naura_happy") || "✨"} *Semua pemain di server akan melihat pesanmu!*`,
          footerText: "Naura Minecraft RCON Broadcast",
        });

        return interaction.editReply(bcPayload);
      } catch (err) {
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "Gagal Mengirim Broadcast",
          description: `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, Naura gagal mengirim pesan ke server Minecraft.\n\n**Detail Error:** ${err.message}\n\n${ui.getEmoji("sparkle") || "💡"} *Periksa koneksi RCON atau minta admin server memeriksa konfigurasi bridge.*`,
          expression: "cry",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "stats") {
      const profile = await cacheManager.getUserProfile(interaction.user.id);

      if (!profile || !profile.minecraft_ign) {
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "Akun Belum Ditautkan",
          description: `${ui.getEmoji("naura_akward") || "😅"} Kamu belum menghubungkan akun Minecraft!\n\n${ui.getEmoji("sparkle") || "💡"} *Gunakan \`/minecraft link <username>\` terlebih dahulu untuk menautkan akun Minecraft Premium-mu, ya!*`,
          expression: "akward",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const username = profile.minecraft_ign;

      const newPlaytime =
        (profile.minecraft_playtime || 0) + Math.floor(Math.random() * 30) + 15;
      await cacheManager.updateUserProfile(interaction.user.id, {
        minecraft_playtime: newPlaytime,
      });

      const playMinutes = newPlaytime;
      const playHours = Math.floor(playMinutes / 60);
      const playDays = Math.floor(playHours / 24);

      try {
        let uuid = profile.minecraft_uuid;
        
        if (!uuid) {
          const profileData = await getMojangProfile(username);
          if (!profileData) {
            const errPayload = buildErrorContainerV2({
              interaction,
              title: "Gagal Memuat UUID",
              description: `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, Naura gagal memuat UUID untuk **${username}**.\n\n${ui.getEmoji("sparkle") || "💡"} *Pastikan akun Minecraft-mu masih valid dan aktif.*`,
              expression: "cry",
              withBanner: true,
              footerText: ui.getFooter("utility"),
            });
            return interaction.editReply(errPayload);
          }
          uuid = profileData.id;
          await cacheManager.updateUserProfile(interaction.user.id, {
            minecraft_uuid: uuid,
          });
        }

        const buffer = await canvasWorkerPool.execute("renderMinecraftStats", {
          username,
          playDays,
          playHours,
          playMinutes,
          uuid,
        });

        const attachment = new AttachmentBuilder(buffer, {
          name: "mc-stats.png",
        });
        
        const statsPayload = buildSuccessContainerV2({
          interaction,
          authorName: "Naura Minecraft Stats Generator",
          title: `${ui.getEmoji("core") || "🌸"} Statistik ${username}`,
          description: `> ${ui.getEmoji("naura_happy") || "✨"} *Kartu statistikmu sudah siap! Terus bermain dan kumpulkan waktu bermain untuk reward spesial!*`,
          footerText: ui.getFooter("utility"),
        });
        statsPayload.files = [attachment];
        return interaction.editReply(statsPayload);
      } catch (error) {
        logger.error("[Stats Generation Error]:", error.message);
        const isCircuitOpen = error instanceof CircuitBreakerOpenError;
        const errPayload = buildErrorContainerV2({
          interaction,
          title: isCircuitOpen ? "API Mojang Sedang Istirahat" : "Gagal Generate Stats",
          description: isCircuitOpen
            ? `${ui.getEmoji("naura_sleepy") || "😴"} API Mojang sedang terlalu sibuk. Coba lagi dalam 1-2 menit ya!`
            : `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, Naura gagal memuat data statistik. Radar sinkronisasi Mojang terganggu.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba lagi beberapa saat lagi!*`,
          expression: isCircuitOpen ? "sleepy" : "cry",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "bridge") {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "Akses Ditolak",
          description: `${ui.getEmoji("naura_akward") || "😅"} Maaf ya, kamu memerlukan izin \`Manage Server\` atau \`Administrator\` untuk menyetel jembatan chat ini.\n\n${ui.getEmoji("sparkle") || "💡"} *Minta admin server untuk membantu mengatur bridge Minecraft, ya!*`,
          expression: "akward",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const channel = interaction.options.getChannel("channel");
      const rconIp = interaction.options.getString("rcon_ip");
      const rconPort = interaction.options.getInteger("rcon_port");
      const rconPassword = interaction.options.getString("rcon_password");
      const enabled = interaction.options.getBoolean("enabled");

      const cacheManager = require("../../src/managers/cacheManager");
      const GuildSettings = require("../../src/models/GuildSettings");
      const [settingsModel] = await GuildSettings.findOrCreate({
        where: { guildId: interaction.guild.id },
      });

      const mc = settingsModel.settings?.minecraft || {};

      mc.bridgeChannelId = channel.id;
      if (rconIp !== null) mc.ip = rconIp;
      if (rconPort !== null) mc.rconPort = rconPort;
      if (rconPassword !== null) mc.rconPassword = rconPassword;
      if (enabled !== null) mc.bridgeEnabled = enabled;
      else if (enabled === null && mc.bridgeEnabled === undefined)
        mc.bridgeEnabled = true;

      const currentSettings = settingsModel.settings || {};
      currentSettings.minecraft = mc;

      settingsModel.settings = currentSettings;
      settingsModel.changed("settings", true);
      await settingsModel.save({ fields: ["settings"] });
      cacheManager.invalidateGuildSettings(interaction.guild.id);

      const statusEmoji = mc.bridgeEnabled
        ? ui.getEmoji("greenping") || "🟢"
        : ui.getEmoji("redping") || "🔴";
      
      const successTitle = mc.bridgeEnabled 
        ? "Jembatan Chat Diaktifkan!" 
        : "Jembatan Chat Dinonaktifkan";
      
      const successDesc = mc.bridgeEnabled
        ? `Pengaturan jembatan chat Minecraft berhasil diperbarui!\n\n**Status:** ${statusEmoji} Aktif\n**Channel:** <#${mc.bridgeChannelId}>\n**IP RCON:** \`${mc.ip || "Belum Disetel"}:${mc.rconPort || 25575}\`\n**RCON Pass:** \`${mc.rconPassword ? "****** (Tersimpan)" : "Belum Disetel"}\`\n\n> ${ui.getEmoji("naura_happy") || "✨"} *Chat dari Discord sekarang akan terhubung ke Minecraft dan sebaliknya!*`
        : `Jembatan chat Minecraft telah dinonaktifkan.\n\n**Channel:** <#${mc.bridgeChannelId}>\n\n> ${ui.getEmoji("naura_read") || "📖"} *Gunakan \`/minecraft bridge\` lagi dengan \`enabled: true\` untuk mengaktifkannya kembali.*`;
      
      const bridgePayload = buildSuccessContainerV2({
        interaction,
        accentColorHex: mc.bridgeEnabled ? "#22c55e" : "#ef4444",
        authorName: "Naura Minecraft Bridge Engine",
        title: `${ui.getEmoji("translate") || "🌐"} ${successTitle}`,
        description: successDesc,
        footerText: "Naura Minecraft Bridge Engine",
      });

      return interaction.editReply(bridgePayload);
    }
  },
};
