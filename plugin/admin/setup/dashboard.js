const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ComponentType,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(interaction, { currentSettings }) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Ambil semua status untuk ditampilkan di dashboard
  const softbanChan = currentSettings.softbanChannelId || currentSettings.honeypotChannelId;
  const autoModStatus = currentSettings.automod?.enabled ? "🟢 Aktif" : "🔴 Nonaktif";
  const aiAutomodStatus = currentSettings.aiAutomod?.enabled ? "🟢 Aktif" : "🔴 Nonaktif";
  
  const welcomeChan = currentSettings.greetings?.welcome?.channelId;
  const welcomeStatus = currentSettings.greetings?.welcome?.enabled ? `🟢 <#${welcomeChan}>` : "🔴 Nonaktif";
  
  const modmailCat = currentSettings.modmailCategory;
  const modmailStatus = modmailCat ? "✅ Kategori OK" : "🔴 Belum Diatur";
  
  const ticketMode = currentSettings.ticketMode === "thread" ? "Thread Mode" : (currentSettings.ticketMode === "channel" ? "Channel Mode" : "🔴 Belum Diatur");
  const ticketStatus = currentSettings.ticketMode ? `🟢 ${ticketMode}` : "🔴 Belum Diatur";
  
  const tempvoiceChan = currentSettings.tempvoiceChannel;
  const tempvoiceStatus = tempvoiceChan ? `✅ <#${tempvoiceChan}>` : "🔴 Belum Diatur";
  
  const aiChan = currentSettings.aiChannelId;
  const aiStatus = aiChan ? `✅ <#${aiChan}>` : "🔴 Belum Diatur";
  
  const autoRole = currentSettings.autoroleId;
  const autoRoleStatus = autoRole ? `✅ <@&${autoRole}>` : "🔴 Belum Diatur";
  
  const vanityRole = currentSettings.vanityRoleId;
  const vanityStatus = vanityRole ? `✅ <@&${vanityRole}>` : "🔴 Belum Diatur";
  
  const minecraftStatus = currentSettings.minecraft?.bridgeEnabled ? "🟢 Aktif" : "🔴 Belum Diatur";

  const adminName = ui.ux.resolveUserName(interaction);

  // Membangun tampilan UI Dashboard 
  const dashboardDesc = 
    `Selamat datang Kak **${adminName}** di Master Setup Dashboard! Di sini kamu bisa mengonfigurasikan seluruh sistem server secara terpusat dengan cepat dan mudah.\n\n` +
    `**${ui.getEmoji("setup_category_security") || "🔒"} KEAMANAN & MODERASI**\n` +
    `${ui.getEmoji("setup_softban") || "🛡️"} **Softban Trap:** ${softbanChan ? `✅ <#${softbanChan}>` : "🔴 Belum Diatur"}\n` +
    `${ui.getEmoji("setup_automod") || "🤖"} **Automod:** ${autoModStatus}\n` +
    `${ui.getEmoji("setup_automod") || "🤖"} **AI Automod:** ${aiAutomodStatus}\n\n` +
    
    `**${ui.getEmoji("setup_category_channel") || "📢"} CHANNEL & SISTEM**\n` +
    `${ui.getEmoji("setup_welcome") || "👋"} **Welcome:** ${welcomeStatus}\n` +
    `${ui.getEmoji("setup_modmail") || "📩"} **Modmail:** ${modmailStatus}\n` +
    `${ui.getEmoji("setup_ticket") || "🎫"} **Tiket:** ${ticketStatus}\n` +
    `${ui.getEmoji("setup_tempvoice") || "🔊"} **TempVoice:** ${tempvoiceStatus}\n\n` +
    
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
      ]),
  );

  const initialPayload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#2b2d31",
    authorName: "Naura Admin Governance Engine",
    title: "⚙️ Naura Master Setup Dashboard",
    iconURL: interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
    description: dashboardDesc,
    buttonsRow: row,
    footerText: ui.getFooter("core"),
  });

  const reply = await interaction.editReply(initialPayload);

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000,
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        ...buildErrorContainerV2({
          title: "Akses Ditolak",
          description: "❌ Ini bukan menu setup milikmu.",
          footerText: ui.getFooter("core"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const selection = i.values[0];

    // Handler interaktif untuk modul tertentu yang sederhana
    if (selection === "setup_softban") {
      const chanSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("select_softban_channel")
          .setPlaceholder("Pilih channel perangkap scammer...")
          .addChannelTypes(ChannelType.GuildText),
      );
      await i.update(buildContainerV2({
        title: "🛡️ Setup Softban / Honeypot",
        description: "Silakan pilih channel yang akan dijadikan Softban / Honeypot Scammer Trap:",
        buttonsRow: chanSelect,
        footerText: ui.getFooter("core"),
      }));
    } else if (selection === "setup_greetings") {
      const chanSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("select_welcome_channel")
          .setPlaceholder("Pilih channel Welcome...")
          .addChannelTypes(ChannelType.GuildText),
      );
      await i.update(buildContainerV2({
        title: "👋 Setup Greetings (Welcome)",
        description: "Silakan pilih channel untuk Pesan Selamat Datang (Welcome):",
        buttonsRow: chanSelect,
        footerText: ui.getFooter("core"),
      }));
    } else if (selection === "setup_autorole") {
      const roleSelect = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("select_auto_role")
          .setPlaceholder("Pilih Auto-Role member baru..."),
      );
      await i.update(buildContainerV2({
        title: "🎭 Setup Auto-Role",
        description: "Silakan pilih role otomatis untuk member baru:",
        buttonsRow: roleSelect,
        footerText: ui.getFooter("core"),
      }));
    } else if (selection === "setup_ai") {
      const chanSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("select_ai_channel")
          .setPlaceholder("Pilih channel AI Chat...")
          .addChannelTypes(ChannelType.GuildText),
      );
      await i.update(buildContainerV2({
        title: "🧠 Setup AI Channel",
        description: "Silakan pilih channel untuk percakapan otomatis dengan AI Naura:",
        buttonsRow: chanSelect,
        footerText: ui.getFooter("core"),
      }));
    } else if (selection === "setup_tempvoice") {
      const chanSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("select_tempvoice_channel")
          .setPlaceholder("Pilih voice channel generator...")
          .addChannelTypes(ChannelType.GuildVoice),
      );
      await i.update(buildContainerV2({
        title: "🔊 Setup TempVoice",
        description: "Silakan pilih Voice Channel yang akan menjadi generator (bila dijoin, otomatis buat room baru):",
        buttonsRow: chanSelect,
        footerText: ui.getFooter("core"),
      }));
    } else {
      // Untuk modul yang butuh banyak input (seperti ticket, minecraft, dll), arahkan ke subcommand
      await i.update(buildContainerV2({
        title: "💡 Info Config",
        description: `Modul **${selection.replace("setup_", "")}** membutuhkan beberapa argumen sekaligus.\n\nSilakan gunakan subcommand langsung:\n\`/setup ${selection.replace("setup_", "")}\``,
        footerText: ui.getFooter("core"),
      }));
    }
  });
};
