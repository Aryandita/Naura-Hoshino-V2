const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const { status } = require("mcstatus");
const { createCanvas, loadImage } = require("../../src/canvas/canvasRuntime");
const axios = require("axios");
const UserProfile = require("../../src/models/UserProfile");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const mojangCache = new Map();

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
    const response = await axios.get(
      `https://api.mojang.com/users/profiles/minecraft/${username}`,
    );
    if (response.data && response.data.id) {
      const dataToCache = { ...response.data, cachedAt: Date.now() };
      mojangCache.set(username, dataToCache);
      return dataToCache;
    }
  } catch (e) {
    return null;
  }
  return null;
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
    await interaction.deferReply();

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

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#00FF00",
          authorName: "Naura Minecraft Radar",
          title: `🟢 Status Server ${ip}`,
          description: `Radar Naura berhasil mendeteksi sinyal dari **${ip}**!`,
          fields,
          footerText: ui.getFooter("utility"),
        });

        if (
          response.favicon &&
          response.favicon.startsWith("data:image/png;base64,")
        ) {
          const base64Data = response.favicon.replace(
            /^data:image\/png;base64,/,
            "",
          );
          const buffer = Buffer.from(base64Data, "base64");
          const attachment = new AttachmentBuilder(buffer, {
            name: "server-icon.png",
          });
          payload.files = [attachment];
        }

        return interaction.editReply(payload);
      } catch (error) {
        return interaction.editReply(
          `${ui.getEmoji("cross")} Gagal mencapai **${ip}**. Server mungkin *offline*, memblokir port (TCP 25565), atau menolak koneksi eksternal.`,
        );
      }
    } else if (subcommand === "player") {
      const username = interaction.options.getString("username");

      try {
        const profileData = await getMojangProfile(username);
        if (!profileData || !profileData.id) {
          const errPayload = buildErrorContainerV2({
            title: "Player Tidak Ditemukan",
            description: `${ui.getEmoji("error") || "❌"} Radar Naura tidak dapat menemukan **${username}**. Pastikan itu adalah akun Premium/Original Mojang.`,
            footerText: ui.getFooter("core"),
          });
          return interaction.editReply(errPayload);
        }

        const uuid = profileData.id;
        const realName = profileData.name;

        const canvas = createCanvas(800, 500);
        const ctx = canvas.getContext("2d");

        const gradient = ctx.createRadialGradient(400, 250, 50, 400, 250, 600);
        gradient.addColorStop(0, "#1e293b");
        gradient.addColorStop(1, "#020617");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 50px sans-serif";
        ctx.fillText(realName, 50, 100);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "20px sans-serif";
        ctx.fillText(`UUID: ${uuid}`, 50, 140);

        try {
          const headRes = await axios.get(
            `https://crafatar.com/renders/head/${uuid}?overlay=true&scale=10`,
            { responseType: "arraybuffer" },
          );
          const headImg = await loadImage(Buffer.from(headRes.data));
          ctx.drawImage(headImg, 50, 180, 150, 150);
        } catch (e) {}

        try {
          const bodyRes = await axios.get(
            `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`,
            { responseType: "arraybuffer" },
          );
          const bodyImg = await loadImage(Buffer.from(bodyRes.data));
          ctx.drawImage(bodyImg, 500, 50, 200, 420);
        } catch (e) {}

        ctx.fillStyle = "#3b82f6";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("✦ 3D Skin & Head Rendered ✦", 50, 420);
        ctx.fillStyle = "#64748b";
        ctx.font = "16px sans-serif";
        ctx.fillText("Powered by Crafatar & Naura", 50, 450);

        const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
          name: "mc-player-skin.png",
        });
        return interaction.editReply({ files: [attachment] });
      } catch (error) {
        logger.error("[Mojang API Error]:", error.message);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Render Player",
          description: `${ui.getEmoji("error") || "❌"} Gagal merender data pemain. API Mojang mungkin sedang *rate-limited* atau *down*. Coba beberapa saat lagi.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "link") {
      const username = interaction.options.getString("username");

      try {
        const profileData = await getMojangProfile(username);
        if (!profileData || !profileData.name) {
          const errPayload = buildErrorContainerV2({
            title: "Username Tidak Valid",
            description: `${ui.getEmoji("error") || "❌"} Gagal! Username **${username}** tidak valid atau bukan akun Premium/Microsoft.`,
            footerText: ui.getFooter("core"),
          });
          return interaction.editReply(errPayload);
        }

        const MinecraftBridgeService = require("../../src/services/minecraftBridge");
        const code = await MinecraftBridgeService.generateLinkCode(
          interaction.user.id,
          profileData.name,
        );

        const cacheManager = require("../../src/managers/cacheManager");
        await cacheManager.updateUserProfile(interaction.user.id, {
          minecraft_ign: profileData.name,
        });

        const linkPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          authorName: "🔗 Integrasi Identitas Minecraft",
          iconURL: interaction.client.user.displayAvatarURL(),
          description: `Akun Discord-mu sedang ditautkan dengan Minecraft **${profileData.name}**!\n\n🔑 **Kode Verifikasi Anda:** \`${code}\`\n\n> 💡 *Jalankan perintah berikut di dalam server Minecraft:* \n\`\`\`/naura link ${code}\`\`\`\n*Setelah verifikasi selesai, kamu akan mendapatkan bonus +500 Star Fragments 🌟 dan bisa mengklaim hadiah playtime dengan \`/minecraft sync\`!*`,
          footerText: "Naura Minecraft Network Sync",
        });

        return interaction.editReply(linkPayload);
      } catch (error) {
        logger.error("[Link Account Error]:", error.message);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Memvalidasi Akun",
          description: `${ui.getEmoji("error") || "❌"} Gagal memvalidasi akun: ${error.message}`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "sync") {
      const MinecraftBridgeService = require("../../src/services/minecraftBridge");
      const syncRes = await MinecraftBridgeService.syncRewards(
        interaction.user.id,
      );

      if (!syncRes.success) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Sinkronisasi Gagal",
            description: syncRes.message,
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const syncPayload = buildContainerV2({
        accentColorHex: "#86EFAC",
        title: "🔄 Sinkronisasi Realm Berhasil!",
        description: `Waktu bermain di Minecraft **${syncRes.mcUsername}** berhasil dikonversi ke ekonomi Discord!\n\n🌟 **Star Fragments:** \`+${syncRes.starFragments} NSF\`\n🎟️ **Naura Coupon:** \`+${syncRes.coupons} Kupon\``,
        footerText: "Naura Minecraft Realm Sync",
      });

      return interaction.editReply(syncPayload);
    } else if (subcommand === "broadcast") {
      const msgText = interaction.options.getString("message");
      const GuildSettings = require("../../src/models/GuildSettings");
      const { sendRconCommand } = require("../../src/utils/rcon");

      const settings = await GuildSettings.findOne({
        where: { guildId: interaction.guild.id },
      });
      const mc = settings?.settings?.minecraft || {};

      if (!mc.ip || !mc.rconPassword) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "RCON Belum Dikonfigurasi",
            description:
              "Server ini belum mengonfigurasi IP/Password RCON. Gunakan `/minecraft bridge` terlebih dahulu.",
            footerText: ui.getFooter("core"),
          }),
        });
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

        const bcPayload = buildContainerV2({
          accentColorHex: "#C084FC",
          title: "📢 Pesan Berhasil Disiarkan ke Minecraft!",
          description: `Pesan telah dikirim ke seluruh pemain di server Minecraft:\n\n> *"${msgText}"*`,
          footerText: "Naura Minecraft RCON Broadcast",
        });

        return interaction.editReply(bcPayload);
      } catch (err) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Gagal Mengirim Broadcast RCON",
            description: `Koneksi ke server Minecraft RCON gagal: ${err.message}`,
            footerText: ui.getFooter("core"),
          }),
        });
      }
    } else if (subcommand === "stats") {
      const profile = await UserProfile.findOne({
        where: { userId: interaction.user.id },
      });

      if (!profile || !profile.minecraft_ign) {
        const errPayload = buildErrorContainerV2({
          title: "Akun Belum Pertaut",
          description: `${ui.getEmoji("cross") || "❌"} Kamu belum menghubungkan akun Minecraft! Gunakan \`/minecraft link <username>\` terlebih dahulu.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }

      const username = profile.minecraft_ign;

      profile.minecraft_playtime =
        (profile.minecraft_playtime || 0) + Math.floor(Math.random() * 30) + 15;
      await profile.save({ fields: ["minecraft_playtime"] });

      const playMinutes = profile.minecraft_playtime;
      const playHours = Math.floor(playMinutes / 60);
      const playDays = Math.floor(playHours / 24);

      try {
        const profileData = await getMojangProfile(username);
        if (!profileData) {
          const errPayload = buildErrorContainerV2({
            title: "Gagal Memuat UUID",
            description: `${ui.getEmoji("error") || "❌"} Gagal memuat UUID. Pastikan akun **${username}** valid.`,
            footerText: ui.getFooter("core"),
          });
          return interaction.editReply(errPayload);
        }
        const uuid = profileData.id;

        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = 2;
        for (let i = 0; i < 800; i += 40) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 400);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(800, i);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.roundRect(40, 40, 450, 320, 15);
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fill();

        ctx.fillStyle = "#34d399";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("VERMILION NETWORK - MICROSOFT LINK", 60, 80);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 45px sans-serif";
        ctx.fillText(username.toUpperCase(), 60, 140);

        ctx.fillStyle = "#9ca3af";
        ctx.font = "22px sans-serif";
        ctx.fillText("Total Waktu Bermain:", 60, 200);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 35px sans-serif";
        ctx.fillText(
          `${playDays}H ${playHours % 24}J ${playMinutes % 60}M`,
          60,
          240,
        );

        ctx.fillStyle = "#6b7280";
        ctx.font = "16px sans-serif";
        ctx.fillText("*Waktu dihitung dari sinkronisasi Discord.", 60, 330);

        try {
          const bodyRes = await axios.get(
            `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`,
            { responseType: "arraybuffer" },
          );
          const bodyImg = await loadImage(Buffer.from(bodyRes.data));
          ctx.drawImage(bodyImg, 530, 20, 180, 360);
        } catch (e) {}

        const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
          name: "mc-stats.png",
        });
        return interaction.editReply({ files: [attachment] });
      } catch (error) {
        logger.error("[Stats Generation Error]:", error.message);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Stats",
          description: `${ui.getEmoji("error") || "❌"} Gagal memuat data statistik. Radar sinkronisasi Mojang terganggu.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(errPayload);
      }
    } else if (subcommand === "bridge") {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: `${ui.getEmoji("cross") || "❌"} Kamu memerlukan izin \`Manage Server\` atau \`Administrator\` untuk menyetel jembatan chat ini.`,
          footerText: ui.getFooter("core"),
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
      let [settingsModel] = await GuildSettings.findOrCreate({
        where: { guildId: interaction.guild.id },
      });

      let mc = settingsModel.settings?.minecraft || {};

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
      await settingsModel.save();
      cacheManager.invalidateGuildSettings(interaction.guild.id);

      const statusEmoji = mc.bridgeEnabled ? "🟢" : "🔴";
      const bridgePayload = buildContainerV2({
        accentColorHex: mc.bridgeEnabled ? "#22c55e" : "#ef4444",
        title: "🌐 Minecraft Chat Bridge Configuration",
        description: `Pengaturan jembatan chat Minecraft berhasil diperbarui!\n\n**Status:** ${statusEmoji} ${mc.bridgeEnabled ? "Aktif" : "Nonaktif"}\n**Channel:** <#${mc.bridgeChannelId}>\n**IP RCON:** \`${mc.ip || "Belum Disetel"}:${mc.rconPort || 25575}\`\n**RCON Pass:** \`${mc.rconPassword ? "****** (Tersimpan)" : "Belum Disetel"}\``,
        footerText: "Naura Minecraft Bridge Engine",
      });

      return interaction.editReply(bridgePayload);
    }
  },
};
