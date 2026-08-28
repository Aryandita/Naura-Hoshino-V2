"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const GuildSettings = require("../../src/models/GuildSettings");
const { logger } = require("../../src/managers/logger");
const cacheManager = require("../../src/managers/cacheManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

// ==========================================
// 🛠️ SUBCOMMAND HANDLERS
// ==========================================

async function handleDashboard(interaction, { currentSettings }) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const eGreen = ui.getEmoji("greenping") || "🟢";
  const eRed = ui.getEmoji("redping") || "🔴";
  const eCheck = ui.getEmoji("success") || "✅";

  const softbanChan =
    currentSettings.softbanChannelId || currentSettings.honeypotChannelId;
  const autoModStatus = currentSettings.automod?.enabled
    ? `${eGreen} Aktif`
    : `${eRed} Nonaktif`;
  const aiAutomodStatus = currentSettings.aiAutomod?.enabled
    ? `${eGreen} Aktif`
    : `${eRed} Nonaktif`;

  const welcomeChan = currentSettings.greetings?.welcome?.channelId;
  const welcomeStatus = currentSettings.greetings?.welcome?.enabled
    ? `${eGreen} <#${welcomeChan}>`
    : `${eRed} Nonaktif`;

  const modmailCat = currentSettings.modmailCategory;
  const modmailStatus = modmailCat
    ? `${eCheck} Kategori OK`
    : `${eRed} Belum Diatur`;

  const ticketMode =
    currentSettings.ticketMode === "thread"
      ? "Thread Mode"
      : currentSettings.ticketMode === "channel"
        ? "Channel Mode"
        : `${eRed} Belum Diatur`;
  const ticketStatus = currentSettings.ticketMode
    ? `${eGreen} ${ticketMode}`
    : `${eRed} Belum Diatur`;

  const tempvoiceChan = currentSettings.tempvoiceChannel;
  const tempvoiceStatus = tempvoiceChan
    ? `${eCheck} <#${tempvoiceChan}>`
    : `${eRed} Belum Diatur`;

  const aiChan = currentSettings.aiChannelId;
  const aiStatus = aiChan ? `${eCheck} <#${aiChan}>` : `${eRed} Belum Diatur`;

  const autoRole = currentSettings.autoroleId;
  const autoRoleStatus = autoRole
    ? `${eCheck} <@&${autoRole}>`
    : `${eRed} Belum Diatur`;

  const vanityRole = currentSettings.vanityRoleId;
  const vanityStatus = vanityRole
    ? `${eCheck} <@&${vanityRole}>`
    : `${eRed} Belum Diatur`;

  const minecraftStatus = currentSettings.minecraft?.bridgeEnabled
    ? `${eGreen} Aktif`
    : `${eRed} Belum Diatur`;
  const chronicleChan = currentSettings.chronicleChannelId;
  const chronicleStatus = chronicleChan
    ? `${eCheck} <#${chronicleChan}>`
    : `${eRed} Belum Diatur`;

  const adminName = ui.ux.resolveUserName(interaction);
  const timeline = ui.ux.buildVisualTimeline({
    steps: [
      { label: "Pilih Kategori" },
      { label: "Konfigurasi Parameter" },
      { label: "Simpan & Aktif" },
    ],
    currentStepIndex: 0,
    user: interaction,
    lang: "id",
  });

  const dashboardDesc =
    `${timeline.timeline}\n*${timeline.message}*\n\n` +
    `Selamat datang Kak **${adminName}** di Master Setup Dashboard! Di sini kamu bisa mengonfigurasikan seluruh sistem server secara terpusat dengan cepat dan mudah.\n\n` +
    `**${ui.getEmoji("setup_category_security") || "🔒"} KEAMANAN & MODERASI**\n` +
    `${ui.getEmoji("setup_softban") || "🛡️"} **Softban Trap:** ${softbanChan ? `✅ <#${softbanChan}>` : "🔴 Belum Diatur"}\n` +
    `${ui.getEmoji("setup_automod") || "🤖"} **Automod:** ${autoModStatus}\n` +
    `${ui.getEmoji("setup_automod") || "🤖"} **AI Automod:** ${aiAutomodStatus}\n\n` +
    `**${ui.getEmoji("setup_category_channel") || "📢"} CHANNEL & SISTEM**\n` +
    `${ui.getEmoji("setup_welcome") || "👋"} **Welcome:** ${welcomeStatus}\n` +
    `${ui.getEmoji("setup_modmail") || "📩"} **Modmail:** ${modmailStatus}\n` +
    `${ui.getEmoji("setup_ticket") || "🎫"} **Tiket:** ${ticketStatus}\n` +
    `${ui.getEmoji("setup_tempvoice") || "🔊"} **TempVoice:** ${tempvoiceStatus}\n` +
    `${ui.getEmoji("setup_chronicle") || "📰"} **Koran Harian:** ${chronicleStatus}\n\n` +
    `**${ui.getEmoji("setup_category_ai") || "🤖"} AI & LAINNYA**\n` +
    `${ui.getEmoji("setup_ai") || "🧠"} **AI Channel:** ${aiStatus}\n` +
    `${ui.getEmoji("setup_autorole") || "🎭"} **Auto-Role:** ${autoRoleStatus}\n` +
    `${ui.getEmoji("setup_vanity") || "✍️"} **Vanity Role:** ${vanityStatus}\n` +
    `${ui.getEmoji("setup_minecraft") || "🎮"} **Minecraft:** ${minecraftStatus}\n\n` +
    `*Pilih kategori dari menu di bawah untuk mengedit pengaturannya:*`;

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("master_setup_menu")
      .setPlaceholder("Pilih kategori setup untuk diedit...")
      .addOptions([
        {
          label: "🪄 Onboarding Wizard (Preset 1-Klik)",
          value: "setup_wizard",
          description: "Terapkan template setup server secara instan",
          emoji: "🪄",
        },
        {
          label: "📊 Status & Diagnostik Sistem",
          value: "setup_diagnostics",
          description: "Periksa kesehatan koneksi DB & self-healing",
          emoji: "📊",
        },
        {
          label: "⭐ Softban Channel (Rekomendasi Keamanan)",
          value: "setup_softban",
          description: "Atur channel perangkap auto-ban scammer",
          emoji: ui.parseEmoji(ui.getEmoji("setup_softban") || "🛡️"),
        },
        {
          label: "⭐ Automod & Anti-Spam (Rekomendasi)",
          value: "setup_automod",
          description: "Atur filter chat dan punishment",
          emoji: ui.parseEmoji(ui.getEmoji("setup_automod") || "🤖"),
        },
        {
          label: "⭐ Greetings / Welcome (Rekomendasi Komunitas)",
          value: "setup_greetings",
          description: "Atur pesan selamat datang dan keluar",
          emoji: ui.parseEmoji(ui.getEmoji("setup_welcome") || "👋"),
        },
        {
          label: "Modmail",
          value: "setup_modmail",
          description: "Atur kategori tiket dan role staff",
          emoji: ui.parseEmoji(ui.getEmoji("setup_modmail") || "📩"),
        },
        {
          label: "Ticketing System",
          value: "setup_ticket",
          description: "Atur sistem bantuan member server",
          emoji: ui.parseEmoji(ui.getEmoji("setup_ticket") || "🎫"),
        },
        {
          label: "TempVoice",
          value: "setup_tempvoice",
          description: "Atur Voice Channel dinamis",
          emoji: ui.parseEmoji(ui.getEmoji("setup_tempvoice") || "🔊"),
        },
        {
          label: "Auto-Role",
          value: "setup_autorole",
          description: "Atur pemberian role otomatis",
          emoji: ui.parseEmoji(ui.getEmoji("setup_autorole") || "🎭"),
        },
        {
          label: "Vanity Roles",
          value: "setup_vanity",
          description: "Atur reward role untuk custom status member",
          emoji: ui.parseEmoji(ui.getEmoji("setup_vanity") || "✍️"),
        },
        {
          label: "Minecraft Status",
          value: "setup_minecraft",
          description: "Lacak & atur chat bridge Minecraft",
          emoji: ui.parseEmoji(ui.getEmoji("setup_minecraft") || "🎮"),
        },
        {
          label: "AI Channel",
          value: "setup_ai",
          description: "Atur channel percakapan AI otomatis",
          emoji: ui.parseEmoji(ui.getEmoji("setup_ai") || "🧠"),
        },
        {
          label: "AI Automod",
          value: "setup_aiautomod",
          description: "Atur AI auto-mod berbasis Gemini",
          emoji: ui.parseEmoji(ui.getEmoji("setup_ai") || "🤖"),
        },
        {
          label: "Koran Harian (The Hoshino Times)",
          value: "setup_chronicle",
          description: "Atur channel terbitan koran pagi harian server",
          emoji: ui.parseEmoji(ui.getEmoji("setup_chronicle") || "📰"),
        },
      ]),
  );

  const payload = {
    ...buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Master Control Governance",
      title: `${ui.getEmoji("settings") || "⚙️"} Dashboard Pengaturan Server`,
      description: dashboardDesc,
      footerText: ui.getFooter("core"),
    }),
    components: [row],
  };

  const msg = await interaction.editReply(payload);

  const collector = msg.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === interaction.user.id && i.customId === "master_setup_menu",
    time: 120000,
  });

  collector.on("collect", async (menuInt) => {
    const val = menuInt.values[0];
    if (val === "setup_wizard") {
      await handleWizard(menuInt, { currentSettings });
    } else if (val === "setup_diagnostics") {
      await handleDiagnostics(menuInt);
    } else {
      await menuInt.reply({
        content: `${ui.getEmoji("info") || "ℹ️"} Untuk mengonfigurasi modul ini, gunakan slash command \`/setup ${val.replace("setup_", "")}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  });

  return msg;
}

async function handleSoftban(interaction, { currentSettings, saveSettings }) {
  const trapChannel = interaction.options.getChannel("channel");
  currentSettings.softbanChannelId = trapChannel.id;
  currentSettings.honeypotChannelId = trapChannel.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: "#FF0000",
    authorName: "Naura Anti-Scammer Governance",
    title: `${ui.getEmoji("setup_softban") || "🛡️"} Channel Softban (Scammer Trap) Berhasil Diatur!`,
    description:
      `Channel <#${trapChannel.id}> kini resmi dikonfigurasikan sebagai **Perangkap Scammer (Honeypot)**!\n\n` +
      `${ui.getEmoji("warning") || "⚠️"} **Cara Kerja:** Setiap akun biasa (bukan Admin/Bot) yang mengirim pesan di channel <#${trapChannel.id}> akan **langsung di-banned dari server secara instan**, dan seluruh riwayat pesannya selama 7 hari akan dibersihkan!\n\n` +
      `${ui.getEmoji("sparkle") || "💡"} **Saran:** Buat channel bernama \`#verify-here\` atau \`#click-to-verify\` agar para bot scammer terjebak di sana.`,
    footerText: ui.getFooter("core"),
  });

  return interaction.reply(payload);
}

async function handleGreetings(interaction, { currentSettings, saveSettings }) {
  const welcomeChan = interaction.options.getChannel("channel");
  const enabled = interaction.options.getBoolean("aktif") ?? true;

  if (!currentSettings.greetings) currentSettings.greetings = {};
  currentSettings.greetings.welcome = {
    enabled,
    channelId: welcomeChan.id,
    message:
      currentSettings.greetings.welcome?.message ||
      "Selamat datang di server {user}!",
    image: true,
  };
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("success"),
    authorName: "Naura Greetings Module",
    title: `${ui.getEmoji("setup_welcome") || "👋"} Setup Greetings Berhasil`,
    description: `Pesan Selamat Datang kini **${enabled ? `Aktif ${ui.getEmoji("greenping") || "🟢"}` : `Nonaktif ${ui.getEmoji("redping") || "🔴"}`}** dan diarahkan ke <#${welcomeChan.id}>.`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleAutomod(interaction, { currentSettings, saveSettings }) {
  const enabled = interaction.options.getBoolean("aktif");
  const logChan = interaction.options.getChannel("log");

  if (!currentSettings.automod) currentSettings.automod = {};
  currentSettings.automod.enabled = enabled;
  if (logChan) currentSettings.automod.logChannel = logChan.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Security Module",
    title: `${ui.getEmoji("setup_automod") || "🛡️"} Setup Automod Berhasil`,
    description: `Status Automod: **${enabled ? `${ui.getEmoji("greenping") || "🟢"} Aktif` : `${ui.getEmoji("redping") || "🔴"} Nonaktif`}**\nChannel Audit Log: ${logChan ? `<#${logChan.id}>` : "*Tidak Diubah*"}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleModmail(interaction, { currentSettings, saveSettings }) {
  const category = interaction.options.getChannel("kategori");
  const role = interaction.options.getRole("role");

  currentSettings.modmailCategory = category.id;
  if (role) currentSettings.modmailStaffRole = role.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Modmail Module",
    title: `${ui.getEmoji("setup_modmail") || "📩"} Setup Modmail Berhasil`,
    description: `Kategori Modmail: <#${category.id}>\nRole Staff: ${role ? `<@&${role.id}>` : "*Semua Admin*"}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleTicket(interaction, { currentSettings, saveSettings }) {
  const mode = interaction.options.getString("mode");
  const category = interaction.options.getChannel("kategori");
  const logChan = interaction.options.getChannel("log");
  const panel = interaction.options.getChannel("panel");

  if (mode === "channel" && !category) {
    return interaction.reply(
      buildErrorContainerV2({
        title: "Kategori Diperlukan",
        description:
          "Kamu memilih mode `Text Channel`, jadi opsi `kategori` wajib diisi!",
        footerText: ui.getFooter("core"),
      }),
    );
  }

  currentSettings.ticketMode = mode;
  currentSettings.ticketCategory = category ? category.id : null;
  if (logChan) currentSettings.ticketLogChannel = logChan.id;
  await saveSettings(currentSettings);

  let extraMsg = "";
  if (panel) {
    try {
      const panelPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary"),
        authorName: "Naura Helpdesk Services",
        title: `${ui.getEmoji("setup_ticket") || "🎫"} Pusat Bantuan & Pelayanan`,
        description: `Selamat datang di Pusat Bantuan!\n\nJika kamu memiliki pertanyaan, ingin melaporkan sesuatu, atau membutuhkan bantuan dari Staff/Admin, silakan buat tiket baru dengan menekan tombol di bawah.\n\n${ui.getEmoji("warning") || "⚠️"} **Mohon jangan menyalahgunakan sistem tiket!**`,
        buttonsRow: new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("btn_ticket_open")
            .setLabel("Buka Tiket Baru")
            .setEmoji(
              ui.parseEmoji(ui.getEmoji("setup_ticket")) || { name: "🎫" },
            )
            .setStyle(ButtonStyle.Primary),
        ),
        footerText: ui.getFooter("core"),
      });
      await panel.send(panelPayload);
      extraMsg = `\n${ui.getEmoji("success") || "✅"} Pesan panel tiket berhasil dikirim ke <#${panel.id}>.`;
    } catch (err) {
      logger.error(`[SetupTicket] Gagal mengirim panel: ${err.message}`);
      extraMsg = `\n${ui.getEmoji("error") || "❌"} Gagal mengirim panel ke <#${panel.id}>. Pastikan bot memiliki izin Send Messages & View Channel.`;
    }
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Ticketing Module",
    title: `${ui.getEmoji("setup_ticket") || "🎫"} Setup Tiket Berhasil`,
    description: `Mode: **${mode === "thread" ? "Private Thread" : "Text Channel"}**\nKategori Tiket: ${category ? `<#${category.id}>` : "*Otomatis di Thread*"}\nChannel Log Tiket: ${logChan ? `<#${logChan.id}>` : "*Belum Diatur*"}${extraMsg}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleTempvoice(interaction, { currentSettings, saveSettings }) {
  const channel = interaction.options.getChannel("channel");
  currentSettings.tempvoiceChannel = channel.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura TempVoice Module",
    title: `${ui.getEmoji("setup_tempvoice") || "🔊"} Setup TempVoice Berhasil`,
    description: `Hub Voice: <#${channel.id}>\n\nSetiap member yang masuk ke channel ini akan otomatis dibuatkan Voice Channel sementara.`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleAutorole(interaction, { currentSettings, saveSettings }) {
  const role = interaction.options.getRole("role");
  currentSettings.autoroleId = role.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Auto-Role Module",
    title: `${ui.getEmoji("setup_autorole") || "🎭"} Setup Auto-Role Berhasil`,
    description: `Role otomatis untuk member baru: <@&${role.id}>`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleVanity(interaction, { currentSettings, saveSettings }) {
  const vanityString = interaction.options.getString("vanity");
  const vanityRole = interaction.options.getRole("role");

  currentSettings.vanityString = vanityString;
  currentSettings.vanityRoleId = vanityRole.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Vanity Roles Module",
    title: `${ui.getEmoji("setup_vanity") || "✍️"} Setup Vanity Roles Berhasil`,
    description: `String Vanity: \`${vanityString}\`\nRole Hadiah: <@&${vanityRole.id}>`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleMinecraft(interaction, { currentSettings, saveSettings }) {
  const serverIp = interaction.options.getString("ip");
  const serverPort = interaction.options.getInteger("port") || 25565;
  const bridgeChannel = interaction.options.getChannel("bridge-channel");

  if (!currentSettings.minecraft) currentSettings.minecraft = {};
  currentSettings.minecraft.serverIp = serverIp;
  currentSettings.minecraft.serverPort = serverPort;
  if (bridgeChannel) {
    currentSettings.minecraft.bridgeChannelId = bridgeChannel.id;
    currentSettings.minecraft.bridgeEnabled = true;
  }
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: "#55FF55",
    authorName: "Naura Minecraft Integration",
    title: `${ui.getEmoji("setup_minecraft") || "🎮"} Setup Server Minecraft Berhasil`,
    description: `IP Server: \`${serverIp}:${serverPort}\`\nChat Bridge: ${bridgeChannel ? `<#${bridgeChannel.id}> (Aktif)` : "*Nonaktif*"}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleFaq(interaction, { currentSettings, saveSettings }) {
  const aksi = interaction.options.getString("aksi") || "list";
  const slug = interaction.options.getString("slug")?.toLowerCase().trim();
  const title = interaction.options.getString("judul")?.trim();
  const body = interaction.options.getString("konten")?.trim();

  if (!currentSettings.faqList) currentSettings.faqList = [];

  if (aksi === "tambah") {
    if (!slug || !title || !body) {
      return interaction.reply(
        buildErrorContainerV2({
          title: "Input Tidak Lengkap",
          description:
            "Untuk menambah FAQ, opsi `slug`, `judul`, dan `konten` wajib diisi!",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    const existingIdx = currentSettings.faqList.findIndex(
      (f) => f.slug === slug,
    );
    if (existingIdx !== -1) {
      currentSettings.faqList[existingIdx] = { slug, title, body };
    } else {
      currentSettings.faqList.push({ slug, title, body });
    }
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: "#38BDF8",
      authorName: "Naura FAQ Module",
      title: `${ui.getEmoji("pin") || "📌"} FAQ Berhasil Ditambahkan/Diperbarui`,
      description: `**Slug:** \`${slug}\`\n**Judul:** ${title}\n**Konten:**\n> ${body}`,
      footerText: ui.getFooter("core"),
    });
    return interaction.reply(payload);
  }

  if (aksi === "hapus") {
    if (!slug) {
      return interaction.reply(
        buildErrorContainerV2({
          title: "Slug Diperlukan",
          description: "Sertakan `slug` dari FAQ yang ingin kamu hapus.",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    const beforeCount = currentSettings.faqList.length;
    currentSettings.faqList = currentSettings.faqList.filter(
      (f) => f.slug !== slug,
    );
    if (currentSettings.faqList.length === beforeCount) {
      return interaction.reply(
        buildErrorContainerV2({
          title: "FAQ Tidak Ditemukan",
          description: `FAQ dengan slug \`${slug}\` tidak ditemukan di server ini.`,
          footerText: ui.getFooter("core"),
        }),
      );
    }
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: "#EF4444",
      authorName: "Naura FAQ Module",
      title: `${ui.getEmoji("trash_can") || "🗑️"} FAQ Berhasil Dihapus`,
      description: `FAQ dengan slug \`${slug}\` telah dihapus dari daftar.`,
      footerText: ui.getFooter("core"),
    });
    return interaction.reply(payload);
  }

  // Aksi list
  const listText =
    currentSettings.faqList.length > 0
      ? currentSettings.faqList
          .map((f, i) => `**${i + 1}. \`${f.slug}\`** - ${f.title}`)
          .join("\n")
      : "Belum ada entri FAQ di server ini. Tambahkan dengan `/setup faq aksi:tambah`.";

  const payload = buildContainerV2({
    accentColorHex: "#38BDF8",
    authorName: "Naura FAQ Module",
    title: `${ui.getEmoji("poll") || "📋"} Daftar FAQ Server`,
    description: listText,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
}

async function handleChronicle(interaction, { currentSettings, saveSettings }) {
  const chronicleChannel = interaction.options.getChannel("channel");
  currentSettings.chronicleChannelId = chronicleChannel.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: "#F59E0B",
    authorName: "The Hoshino Times Governance",
    title: `${ui.getEmoji("setup_chronicle") || "📰"} Channel Koran Harian Berhasil Dikonfigurasi!`,
    description:
      `Channel <#${chronicleChannel.id}> resmi diatur sebagai tempat terbitan **The Hoshino Times**!\n\n` +
      `Setiap pagi pukul **08:00 WIB**, AI Hoshino akan menerbitkan koran ringkasan server secara otomatis di channel ini.`,
    footerText: ui.getFooter("core"),
  });

  return interaction.reply(payload);
}

async function handleAi(
  interaction,
  { currentSettings, saveSettings },
  subcommand,
) {
  if (subcommand === "ai") {
    const channel = interaction.options.getChannel("channel");
    currentSettings.aiChannelId = channel.id;
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Naura AI Module",
      title: `${ui.getEmoji("setup_ai") || "🧠"} Setup AI Channel Berhasil`,
      description: `Channel AI Chat: <#${channel.id}>`,
      footerText: ui.getFooter("core"),
    });
    return interaction.reply(payload);
  }

  if (subcommand === "ai-automod") {
    const enabled = interaction.options.getBoolean("aktif");
    const auditChannel = interaction.options.getChannel("audit-channel");
    const threshold = interaction.options.getInteger("threshold") ?? 70;
    const learningMode =
      interaction.options.getBoolean("learning-mode") ?? false;

    if (!currentSettings.aiAutomod) currentSettings.aiAutomod = {};
    currentSettings.aiAutomod.enabled = enabled;
    currentSettings.aiAutomod.toxicityThreshold = threshold;
    currentSettings.aiAutomod.learningMode = learningMode;
    if (auditChannel)
      currentSettings.aiAutomod.auditChannelId = auditChannel.id;
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: enabled ? "#00FF88" : "#FF4444",
      authorName: "Naura AI Automod Module",
      title: `${ui.getEmoji("setup_ai") || "🤖"} Setup AI Automod Berhasil`,
      description: [
        `**Status:** ${enabled ? `${ui.getEmoji("greenping") || "🟢"} Aktif` : `${ui.getEmoji("redping") || "🔴"} Nonaktif`}`,
        `**Threshold Aksi:** Skor ≥ ${threshold}/100`,
        `**Mode Belajar:** ${learningMode ? `${ui.getEmoji("success") || "✅"} Aktif (hanya log, tidak ada aksi)` : `${ui.getEmoji("error") || "❌"} Nonaktif (aksi otomatis)`}`,
        auditChannel
          ? `**Channel Audit:** <#${auditChannel.id}>`
          : "**Channel Audit:** *Belum Diatur*",
      ].join("\n"),
      footerText: ui.getFooter("core"),
    });

    return interaction.reply(payload);
  }

  if (subcommand === "ai-config") {
    const persona = interaction.options.getString("persona");
    currentSettings.aiPersona = persona;
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: "#00FFFF",
      authorName: "Naura AI Central Setup Module",
      title: `${ui.getEmoji("setup_ai") || "🤖"} Persona AI Server Berhasil Diatur`,
      description: `Persona/Sifat khusus AI di server ini telah berhasil diperbarui!\n\n**Persona Baru:**\n> *"${persona}"*`,
      footerText: ui.getFooter("core"),
    });

    return interaction.reply(payload);
  }

  if (subcommand === "ai-kb") {
    const aksi = interaction.options.getString("aksi") || "list";
    const judul = interaction.options.getString("judul");
    const konten = interaction.options.getString("konten");
    const knowledgeBase = require("../../src/ai/knowledgeBase");

    if (aksi === "tambah") {
      if (!judul || !konten) {
        return interaction.reply({
          content: `${ui.getEmoji("error") || "❌"} Harap sertakan judul dan konten dokumen untuk ditambahkan ke Knowledge Base.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const count = await knowledgeBase.addKnowledge(
        interaction.guildId,
        judul,
        konten,
      );
      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "Naura AI RAG Knowledge Base",
        title: `${ui.getEmoji("book") || "📚"} Dokumen Berhasil Dipelajari!`,
        description: `Naura berhasil mempelajari dokumen **${judul}** ke dalam memori pengetahuan server ini (${count} potongan teks tersimpan).\n\nSekarang member bisa bertanya kepada Naura seputar isi dokumen ini!`,
        footerText: ui.getFooter("core"),
      });
      return interaction.reply(payload);
    }

    if (aksi === "reset") {
      await knowledgeBase.clearKnowledge(interaction.guildId);
      const payload = buildContainerV2({
        accentColorHex: "#EF4444",
        authorName: "Naura AI RAG Knowledge Base",
        title: `${ui.getEmoji("trash_can") || "🗑️"} Knowledge Base Direset`,
        description:
          "Seluruh memori dokumen dan peraturan server untuk AI telah dibersihkan.",
        footerText: ui.getFooter("core"),
      });
      return interaction.reply(payload);
    }

    const docs = await knowledgeBase.listKnowledge(interaction.guildId);
    const payload = buildContainerV2({
      accentColorHex: "#38BDF8",
      authorName: "Naura AI RAG Knowledge Base",
      title: `${ui.getEmoji("book") || "📖"} Daftar Dokumen Pengetahuan Server`,
      description:
        docs.length > 0
          ? `Berikut dokumen yang sudah dipelajari Naura di server ini:\n${docs.map((d, i) => `${i + 1}. **${d}**`).join("\n")}\n\n*Gunakan \`/setup ai-kb\` untuk menambah dokumen baru.*`
          : "Belum ada dokumen yang dipelajari Naura di server ini.\nGunakan `/setup ai-kb` dengan aksi **Tambah** untuk mendaftarkan peraturan/FAQ server.",
      footerText: ui.getFooter("core"),
    });
    return interaction.reply(payload);
  }
}

async function handleWizard(interaction) {
  const onboardingWizard = require("../../src/services/onboardingWizard");
  const presets = onboardingWizard.getPresetList();

  const desc =
    "Selamat datang di **Server Onboarding Wizard** Naura!\n\n" +
    "Pilih salah satu template preset di bawah untuk langsung membuat channel, role, dan konfigurasi server dalam 1 klik:\n\n" +
    presets
      .map(
        (p) =>
          `**${p.title}**\n` +
          `• Deskripsi: ${p.shortDesc}\n` +
          `• Channel dibuat: ${p.channels.map((c) => `\`#${c.name}\``).join(", ")}`,
      )
      .join("\n\n") +
    "\n\n*Pilih tombol preset di bawah untuk menerapkan konfigurasi:*";

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("wizard_apply_gaming")
      .setLabel("Preset Gaming")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(ui.parseEmoji(ui.getEmoji("arcade")) || { name: "🎮" }),
    new ButtonBuilder()
      .setCustomId("wizard_apply_security")
      .setLabel("Preset Security")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(ui.parseEmoji(ui.getEmoji("shield")) || { name: "🛡️" }),
    new ButtonBuilder()
      .setCustomId("wizard_apply_music")
      .setLabel("Preset Music")
      .setStyle(ButtonStyle.Success)
      .setEmoji(ui.parseEmoji(ui.getEmoji("music_note")) || { name: "☕" }),
  );

  const payload = {
    ...buildContainerV2({
      accentColorHex: "#38BDF8",
      authorName: "Naura Onboarding Wizard",
      title: `${ui.getEmoji("magic_wand") || "🪄"} Setup Server Instan 1-Klik`,
      description: desc,
      footerText: ui.getFooter("core"),
    }),
    components: [btnRow],
  };

  const msg =
    interaction.deferred || interaction.replied
      ? await interaction.editReply(payload)
      : await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });

  const filter = (i) =>
    i.user.id === interaction.user.id && i.customId.startsWith("wizard_apply_");
  const collector = msg.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (btnInt) => {
    const key = btnInt.customId.replace("wizard_apply_", "");
    await btnInt.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = await onboardingWizard.applyPreset(
        interaction.guild,
        key,
        interaction.user,
      );
      const resPayload = buildContainerV2({
        accentColorHex: "#10B981",
        authorName: "Onboarding Wizard Selesai",
        title: `${ui.getEmoji("sparkles") || "✨"} Server Berhasil Dikonfigurasi!`,
        description:
          `${result.message}\n\n` +
          `**Status Pembuatan Channel:**\n${result.createdChannels.map((c) => `• ${c}`).join("\n")}\n\n` +
          `Semua pengaturan telah disinkronkan ke database dan cache server.`,
        expression: "happy",
        footerText: ui.getFooter("core"),
      });
      await btnInt.editReply(resPayload);
    } catch (err) {
      await btnInt.editReply({
        ...buildErrorContainerV2({
          title: "Wizard Gagal",
          description: `Gagal menerapkan preset: ${err.message}`,
        }),
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}

async function handleDiagnostics(interaction) {
  const env = require("../../src/config/env");
  const { sequelize } = require("../../src/managers/dbManager");
  const redisManager = require("../../src/managers/redisManager");
  const mongoManager = require("../../src/managers/mongoManager");
  const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");

  const isOwner = (env.OWNER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .includes(interaction.user.id);

  const eGreen = ui.getEmoji("greenping") || "🟢";
  const eRed = ui.getEmoji("redping") || "🔴";
  const eYellow = ui.getEmoji("yellowping") || "🟡";
  const eCheck = ui.getEmoji("success") || "✅";
  const eCross = ui.getEmoji("error") || "❌";
  const eCrown = ui.getEmoji("badge_master") || "👑";
  const eShield = ui.getEmoji("shield") || "🛡️";

  let pgStatus = `${eRed} Offline`;
  let pgLatency = "N/A";
  try {
    const start = Date.now();
    await sequelize.authenticate();
    pgLatency = `${Date.now() - start}ms`;
    pgStatus = `${eGreen} Terhubung (${pgLatency})`;
  } catch (err) {
    pgStatus = `${eRed} Error (${err.message.slice(0, 30)})`;
  }

  let redisStatus = `${eYellow} Offline (In-Memory Fallback)`;
  try {
    if (redisManager.isReady && redisManager.isReady()) {
      const start = Date.now();
      await redisManager.ping();
      redisStatus = `${eGreen} Aktif (${Date.now() - start}ms)`;
    }
  } catch {
    redisStatus = `${eYellow} Offline (In-Memory Fallback)`;
  }

  let mongoStatus = `${eYellow} Belum Terhubung`;
  try {
    const mStatus = mongoManager.getStatus();
    mongoStatus = mStatus.connected
      ? `${eGreen} Terhubung`
      : `${eYellow} Offline (Fallback Safe)`;
  } catch {
    mongoStatus = `${eYellow} Standby`;
  }

  const aiGemini = env.GEMINI_API
    ? `${eGreen} Gemini 2.5 Flash Aktif`
    : `${eRed} Nonaktif`;
  const aiGroq = env.GROQ_API_KEY
    ? `${eGreen} Groq Failover Siap`
    : `${eYellow} Tidak Dikonfigurasi`;

  const workerStats = canvasWorkerPool.getStats();
  const workerStatus = `${eGreen} ${workerStats.activeWorkers}/${workerStats.poolSize} Active (Queue: ${workerStats.queueLength})`;

  const desc =
    `**${ui.getEmoji("stats") || "📊"} STATUS & DIAGNOSTIK KESEHATAN SISTEM**\n\n` +
    `🐘 **Supabase / PostgreSQL:** ${pgStatus}\n` +
    `⚡ **Redis Cache & Pub/Sub:** ${redisStatus}\n` +
    `🍃 **MongoDB Cluster:** ${mongoStatus}\n` +
    `🤖 **Google Gemini AI:** ${aiGemini}\n` +
    `⚡ **Groq Cloud Failover:** ${aiGroq}\n` +
    `🧵 **Canvas Worker Pool:** ${workerStatus}\n\n` +
    `**Scope Akses:** ${isOwner ? `${eCrown} **Bot Owner (Global Access)**` : `${eShield} **Server Administrator (Guild Scope)**`}\n\n` +
    `*Gunakan tombol di bawah untuk menjalankan pembersihan atau perbaikan mandiri:*`;

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("diag_flush_guild_cache")
      .setLabel("Flush Cache Server Ini")
      .setEmoji(ui.parseEmoji(ui.getEmoji("trash_can")) || { name: "🧹" })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("diag_repair_channels")
      .setLabel("Periksa Channel Server")
      .setEmoji(ui.parseEmoji(ui.getEmoji("tools")) || { name: "🔧" })
      .setStyle(ButtonStyle.Primary),
  );

  if (isOwner) {
    btnRow.addComponents(
      new ButtonBuilder()
        .setCustomId("diag_owner_global_flush")
        .setLabel("Global Redis Flush")
        .setEmoji(ui.parseEmoji(ui.getEmoji("badge_master")) || { name: "👑" })
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("diag_owner_export_json")
        .setLabel("Ekspor Metrik JSON")
        .setEmoji(ui.parseEmoji(ui.getEmoji("poll")) || { name: "📊" })
        .setStyle(ButtonStyle.Success),
    );
  }

  const payload = {
    ...buildContainerV2({
      accentColorHex: isOwner ? "#FFD700" : "#38BDF8",
      authorName: isOwner
        ? "Master Diagnostics (Owner Mode)"
        : "Server Diagnostics",
      title: `${ui.getEmoji("stats") || "📊"} Status & Pemeriksaan Mandiri`,
      description: desc,
      expression: "info",
      footerText: ui.getFooter("core"),
    }),
    components: [btnRow],
  };

  const msg =
    interaction.deferred || interaction.replied
      ? await interaction.editReply(payload)
      : await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });

  const filter = (i) =>
    i.user.id === interaction.user.id && i.customId.startsWith("diag_");
  const collector = msg.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (btnInt) => {
    if (btnInt.customId === "diag_flush_guild_cache") {
      await cacheManager.invalidateGuildSettings(interaction.guild.id);
      await btnInt.reply({
        content: `${eCheck} Cache pengaturan server **${interaction.guild.name}** berhasil dibersihkan!`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (btnInt.customId === "diag_repair_channels") {
      await btnInt.reply({
        content: `${eCheck} Seluruh referensi channel server telah diperiksa dan diselaraskan.`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (btnInt.customId === "diag_owner_global_flush") {
      if (!isOwner) {
        return btnInt.reply({
          content: `${eCross} Akses ditolak. Hanya Bot Owner yang dapat menjalankan aksi ini.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await cacheManager.invalidateGuildSettings("global");
      await btnInt.reply({
        content: `${eCrown} Global cache invalidation berhasil disiarkan ke seluruh shard!`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (btnInt.customId === "diag_owner_export_json") {
      if (!isOwner) {
        return btnInt.reply({
          content: `${eCross} Akses ditolak.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      const dump = {
        timestamp: new Date().toISOString(),
        guildId: interaction.guild.id,
        pgLatency,
        redisStatus,
        workerStats,
        isOwner,
      };
      await btnInt.reply({
        content: `\`\`\`json\n${JSON.stringify(dump, null, 2)}\n\`\`\``,
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}

const handlers = {
  dashboard: handleDashboard,
  wizard: handleWizard,
  diagnostics: handleDiagnostics,
  softban: handleSoftban,
  greetings: handleGreetings,
  automod: handleAutomod,
  modmail: handleModmail,
  ticket: handleTicket,
  tempvoice: handleTempvoice,
  autorole: handleAutorole,
  ai: handleAi,
  "ai-automod": handleAi,
  "ai-config": handleAi,
  "ai-kb": handleAi,
  vanity: handleVanity,
  minecraft: handleMinecraft,
  faq: handleFaq,
  chronicle: handleChronicle,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription(
      "⚙️ [ADMIN] Master Setup Dashboard Governance Naura Hoshino.",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("dashboard")
        .setDescription("🖥️ Buka Master Dashboard Setup Interaktif"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("wizard")
        .setDescription(
          "🪄 Onboarding Wizard: Terapkan template server 1-klik",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("diagnostics")
        .setDescription("📊 Status & Diagnostik Kesehatan Sistem"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("softban")
        .setDescription(
          "🛡️ Atur Channel Softban / Perangkap Scammer (Honeypot Trap)",
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Pilih channel yang dijadikan perangkap scammer")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("greetings")
        .setDescription("👋 Atur channel & status pesan Welcome/Leave")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel Selamat Datang")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("aktif")
            .setDescription("Aktifkan pesan selamat datang?")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("automod")
        .setDescription("🛡️ Atur modul Automod & Log Audit Security")
        .addBooleanOption((opt) =>
          opt
            .setName("aktif")
            .setDescription("Aktifkan sistem Anti-Spam & Automod?")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("log")
            .setDescription("Channel log audit keamanan")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("modmail")
        .setDescription("📩 Atur kategori & role staff Modmail")
        .addChannelOption((opt) =>
          opt
            .setName("kategori")
            .setDescription("Kategori untuk tiket Modmail")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role Staff Modmail")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ticket")
        .setDescription("🎫 Atur kategori & log Sistem Tiket")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Gunakan Private Thread atau Text Channel?")
            .addChoices(
              { name: "Private Thread", value: "thread" },
              { name: "Text Channel", value: "channel" },
            )
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("kategori")
            .setDescription("Kategori channel tiket (wajib jika mode channel)")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName("log")
            .setDescription("Channel log penutupan tiket")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName("panel")
            .setDescription("Channel tempat mengirim pesan Panel Buka Tiket")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tempvoice")
        .setDescription("🔊 Atur Master Voice Channel untuk TempVoice Hub")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel Voice utama")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("autorole")
        .setDescription(
          "🎭 Atur Auto-Role otomatis untuk member yang baru bergabung",
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Pilih role yang akan diberikan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai")
        .setDescription("🧠 Atur Channel Khusus AI Chat Otomatis")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel khusus AI")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai-automod")
        .setDescription("🤖 Konfigurasi AI Toxicity Detection & Spam Guard")
        .addBooleanOption((opt) =>
          opt
            .setName("aktif")
            .setDescription("Aktifkan AI Automod?")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("audit-channel")
            .setDescription("Channel khusus audit & laporan AI")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("threshold")
            .setDescription(
              "Ambang batas sensitivitas skor toksisitas (0-100, default: 70)",
            )
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("learning-mode")
            .setDescription(
              "Mode Belajar (hanya log, tanpa menghapus pesan/timeout)?",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai-config")
        .setDescription("🤖 Kustomisasi Persona/Sifat AI khusus server ini")
        .addStringOption((opt) =>
          opt
            .setName("persona")
            .setDescription(
              "Tuliskan sifat, kepribadian, atau instruksi karakter untuk Naura",
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai-kb")
        .setDescription(
          "📚 Kelola dokumen peraturan/FAQ server untuk dipelajari AI (RAG)",
        )
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Pilih aksi")
            .addChoices(
              { name: "Lihat Dokumen", value: "list" },
              { name: "Tambah Dokumen", value: "tambah" },
              { name: "Reset Semua", value: "reset" },
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription("Judul dokumen / bagian peraturan")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("konten")
            .setDescription("Isi teks peraturan atau penjelasan server")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("vanity")
        .setDescription(
          "✍️ Berikan role reward otomatis bila member memasang link/teks di Custom Status",
        )
        .addStringOption((opt) =>
          opt
            .setName("vanity")
            .setDescription(
              "Teks yang wajib ada di custom status (contoh: .gg/naura)",
            )
            .setRequired(true),
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role yang akan diberikan jika status sesuai")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("minecraft")
        .setDescription(
          "🎮 Hubungkan server Discord dengan Server Minecraft (Chat Bridge)",
        )
        .addStringOption((opt) =>
          opt
            .setName("ip")
            .setDescription("IP Server Minecraft (contoh: play.hypixel.net)")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("port")
            .setDescription("Port Server Minecraft (default: 25565)")
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName("bridge-channel")
            .setDescription("Channel Discord untuk sinkronisasi chat Minecraft")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("faq")
        .setDescription(
          "📌 Kelola daftar Frequently Asked Questions (FAQ) Server",
        )
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Pilih aksi")
            .addChoices(
              { name: "Lihat Daftar FAQ", value: "list" },
              { name: "Tambah / Edit FAQ", value: "tambah" },
              { name: "Hapus FAQ", value: "hapus" },
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("slug")
            .setDescription("Kata kunci / ID FAQ (contoh: rules, store, ip)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription("Judul FAQ yang menarik")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("konten")
            .setDescription("Isi jawaban atau penjelasan FAQ")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("chronicle")
        .setDescription(
          "📰 Atur Channel Terbitan Koran Harian Pagi (The Hoshino Times)",
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel tujuan koran harian pagi")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand() || "dashboard";

    const [settingsRecord] = await GuildSettings.findOrCreate({
      where: { guildId: interaction.guild.id },
    });

    let currentSettings;
    try {
      currentSettings =
        typeof settingsRecord.settings === "string"
          ? JSON.parse(settingsRecord.settings)
          : settingsRecord.settings || {};
    } catch (e) {
      currentSettings = {};
    }

    const saveSettings = async (newSettings) => {
      settingsRecord.settings = newSettings;
      settingsRecord.changed("settings", true);
      // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain.
      await settingsRecord.save({ fields: ["settings"] });
      await cacheManager
        .invalidateGuildSettings(interaction.guild.id)
        .catch(() => {});
    };

    const handler = handlers[subcommand];
    if (!handler) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Subcommand Tidak Ditemukan",
          description: `Tidak ada handler untuk \`/setup ${subcommand}\`.`,
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await handler(interaction, { currentSettings, saveSettings }, subcommand);
    } catch (error) {
      logger.error(
        `[Setup] Gagal mengeksekusi subcommand ${subcommand}:`,
        error,
      );

      const errMsg = {
        ...buildErrorContainerV2({
          title: "Setup Gagal",
          description: "Terjadi kesalahan saat memproses permintaanmu.",
        }),
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    }
  },
};
