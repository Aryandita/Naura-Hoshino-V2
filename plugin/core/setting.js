const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const cacheManager = require("../../src/managers/cacheManager");
const guildSettingsService = require("../../src/managers/guildSettingsService");
const languageManager = require("../../src/managers/languageManager");

const USER_SETTING_KEYS = [
  "aiChatEnabled",
  "musicAutoJoin",
  "survivalNotifications",
  "minigameChallenges",
  "premiumReminders",
];

const GUILD_FEATURE_KEYS = [
  "leveling",
  "economy",
  "music",
  "automod",
  "starboard",
  "qotd",
  "ticket",
  "tempVoice",
  "modmail",
  "antiRaid",
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function boolIcon(val) {
  return val ? "✅" : "❌";
}

async function getUserSettings(userId) {
  const profile = await cacheManager.getUserProfile(userId);
  const prefs = profile?.notification_prefs || {};
  const lang = await languageManager.getUserLanguage(userId, null);
  
  return {
    aiChatEnabled: prefs.dm_authorized !== false,
    musicAutoJoin: false,
    survivalNotifications: prefs.stamina_full !== false && prefs.quest_reset !== false,
    minigameChallenges: true,
    premiumReminders: prefs.event_news !== false,
    language: lang || "id",
  };
}

async function setUserSetting(userId, key, value) {
  if (key === "language") {
    await languageManager.setUserLanguage(userId, value === "default" ? null : value);
    return;
  }

  const profile = await cacheManager.getUserProfile(userId);
  const prefs = profile?.notification_prefs || {
    dm_authorized: false,
    stamina_full: true,
    quest_reset: true,
    event_news: true,
  };

  switch (key) {
    case "aiChatEnabled":
      prefs.dm_authorized = value;
      break;
    case "survivalNotifications":
      prefs.stamina_full = value;
      prefs.quest_reset = value;
      break;
    case "premiumReminders":
      prefs.event_news = value;
      break;
    default:
      break;
  }

  await cacheManager.updateUserProfile(userId, { notification_prefs: prefs });
}

function canManageGuild(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

async function viewUserSettings(interaction) {
  const userId = interaction.user.id;
  const settings = await getUserSettings(userId);
  const lang = interaction.localeLang || "id";

  const lines = [
    `**${lang === "id" ? "Bahasa" : lang === "ja" ? "言語" : lang === "es" ? "Idioma" : "Language"}:** ${settings.language === "id" ? "🇮🇩 Indonesia" : settings.language === "ja" ? "🇯🇵 日本語" : settings.language === "es" ? "🇪🇸 Español" : "🇬🇧 English"}`,
    "",
    `**${lang === "id" ? "Notifikasi Survival" : "Survival Notifications"}:** ${boolIcon(settings.survivalNotifications)}`,
    `**${lang === "id" ? "Pengingat Premium" : "Premium Reminders"}:** ${boolIcon(settings.premiumReminders)}`,
    `**AI Chat DM:** ${boolIcon(settings.aiChatEnabled)}`,
  ];

  const title = lang === "id" 
    ? `${e("read", "⚙️")} Pengaturan Akunmu`
    : `${e("read", "⚙️")} Your Account Settings`;

  const footer = lang === "id"
    ? "Gunakan /setting toggle untuk mengubah pengaturan."
    : "Use /setting toggle to change your preferences.";

  return buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: lang === "id" ? "Pengaturan Pengguna" : "User Settings",
    title,
    iconURL: interaction.user.displayAvatarURL(),
    description: lines.join("\n"),
    footerText: footer,
  });
}

async function viewGuildSettings(interaction) {
  if (!interaction.guild) {
    return buildErrorContainerV2({
      title: `${e("hmph", "❌")} Khusus Server`,
      description: "Perintah ini hanya bisa dipakai di dalam server.",
      footerText: ui.getFooter("core"),
    });
  }

  if (!canManageGuild(interaction.member)) {
    return buildErrorContainerV2({
      title: `${e("hmph", "❌")} Izin Tidak Cukup`,
      description: "Hanya Administrator atau Pengelola Server yang bisa melihat pengaturan guild.",
      footerText: ui.getFooter("core"),
    });
  }

  const guildData = await guildSettingsService.getGuildSetting(interaction.guild.id);
  const features = guildData?.settings?.features || {};
  const automod = guildData?.settings?.automod || {};
  const lang = interaction.localeLang || "id";

  const lines = [
    `**${lang === "id" ? "Fitur Aktif" : "Active Features"}:**`,
    `  Leveling: ${boolIcon(features.leveling)}`,
    `  Economy: ${boolIcon(features.economy)}`,
    `  Music: ${boolIcon(features.music !== false)}`,
    "",
    `**Auto-Moderation:** ${boolIcon(automod.enabled)}`,
    `  Anti-Spam: ${boolIcon(automod.antiSpam !== false)}`,
    `  Anti-Invite: ${boolIcon(automod.antiInvite)}`,
    `  Anti-Caps: ${boolIcon(automod.antiCaps)}`,
  ];

  const title = lang === "id"
    ? `${e("read", "⚙️")} Pengaturan Server - ${interaction.guild.name}`
    : `${e("read", "⚙️")} Server Settings - ${interaction.guild.name}`;

  return buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: lang === "id" ? "Pengaturan Guild" : "Guild Settings",
    title,
    iconURL: interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
    description: lines.join("\n"),
    footerText: ui.getFooter("admin"),
  });
}

async function toggleUserSetting(interaction) {
  const key = interaction.options.getString("fitur");
  const value = interaction.options.getBoolean("status");
  const lang = interaction.localeLang || "id";

  if (key === "language") {
    const langValue = interaction.options.getString("nilai");
    if (!langValue) {
      return buildErrorContainerV2({
        title: `${e("hmph", "❌")} Parameter Hilang`,
        description: lang === "id" ? "Pilih bahasa: id, en, atau default." : "Choose language: id, en, or default.",
        footerText: ui.getFooter("core"),
      });
    }
    await setUserSetting(interaction.user.id, "language", langValue);
    
    const newLang = langValue === "default" ? "server default" : langValue === "id" ? "Indonesia" : langValue === "ja" ? "日本語" : langValue === "es" ? "Español" : "English";
    return buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: `${e("cheers", "✅")} ${lang === "id" ? "Berhasil" : "Done"}`,
      description: lang === "id" 
        ? `Bahasa diubah ke **${newLang}**.`
        : `Language changed to **${newLang}**.`,
      footerText: ui.getFooter("core"),
    });
  }

  if (!USER_SETTING_KEYS.includes(key)) {
    return buildErrorContainerV2({
      title: `${e("hmph", "❌")} Fitur Tidak Dikenal`,
      description: lang === "id"
        ? `Fitur \`${key}\` tidak tersedia untuk pengguna.`
        : `Feature \`${key}\` is not available for users.`,
      footerText: ui.getFooter("core"),
    });
  }

  await setUserSetting(interaction.user.id, key, value);

  const featureNames = {
    aiChatEnabled: { id: "AI Chat DM", en: "AI Chat DM" },
    musicAutoJoin: { id: "Auto Join Voice", en: "Auto Join Voice" },
    survivalNotifications: { id: "Notifikasi Survival", en: "Survival Notifications" },
    minigameChallenges: { id: "Tantangan Minigame", en: "Minigame Challenges" },
    premiumReminders: { id: "Pengingat Premium", en: "Premium Reminders" },
  };

  const name = featureNames[key]?.[lang] || key;
  const statusText = value 
    ? (lang === "id" ? "diaktifkan" : "enabled")
    : (lang === "id" ? "dinonaktifkan" : "disabled");

  return buildContainerV2({
    accentColorHex: ui.getColor("success") || "#22c55e",
    title: `${e("cheers", "✅")} ${lang === "id" ? "Berhasil" : "Done"}`,
    description: `**${name}** ${statusText}.`,
    footerText: ui.getFooter("core"),
  });
}

async function toggleGuildSetting(interaction) {
  if (!interaction.guild) {
    return buildErrorContainerV2({
      title: `${e("hmph", "❌")} Khusus Server`,
      description: "Pengaturan guild hanya bisa diubah di dalam server.",
      footerText: ui.getFooter("core"),
    });
  }

  if (!canManageGuild(interaction.member)) {
    return buildErrorContainerV2({
      title: `${e("hmph", "❌")} Izin Tidak Cukup`,
      description: "Hanya Administrator atau Pengelola Server yang bisa mengubah pengaturan guild.",
      footerText: ui.getFooter("core"),
    });
  }

  const key = interaction.options.getString("fitur");
  const value = interaction.options.getBoolean("status");
  const lang = interaction.localeLang || "id";

  if (!GUILD_FEATURE_KEYS.includes(key)) {
    return buildErrorContainerV2({
      title: `${e("hmph", "❌")} Fitur Tidak Dikenal`,
      description: lang === "id"
        ? `Fitur \`${key}\` tidak tersedia untuk guild.`
        : `Feature \`${key}\` is not available for guilds.`,
      footerText: ui.getFooter("core"),
    });
  }

  await guildSettingsService.updateGuildSetting(interaction.guild.id, (settings) => {
    if (!settings.features) settings.features = {};
    
    if (key === "automod") {
      if (!settings.automod) settings.automod = {};
      settings.automod.enabled = value;
    } else {
      settings.features[key] = value;
    }
  });

  const featureNames = {
    leveling: { id: "Leveling System", en: "Leveling System" },
    economy: { id: "Sistem Ekonomi", en: "Economy System" },
    music: { id: "Music Player", en: "Music Player" },
    automod: { id: "Auto-Moderation", en: "Auto-Moderation" },
    starboard: { id: "Starboard", en: "Starboard" },
    qotd: { id: "Question of the Day", en: "Question of the Day" },
    ticket: { id: "Ticket System", en: "Ticket System" },
    tempVoice: { id: "Temporary Voice", en: "Temporary Voice" },
    modmail: { id: "Modmail", en: "Modmail" },
    antiRaid: { id: "Anti-Raid Protection", en: "Anti-Raid Protection" },
  };

  const name = featureNames[key]?.[lang] || key;
  const statusText = value 
    ? (lang === "id" ? "diaktifkan" : "enabled")
    : (lang === "id" ? "dinonaktifkan" : "disabled");

  return buildContainerV2({
    accentColorHex: ui.getColor("success") || "#22c55e",
    title: `${e("cheers", "✅")} ${lang === "id" ? "Berhasil" : "Done"}`,
    description: `**${name}** ${statusText} untuk server ini.`,
    footerText: ui.getFooter("admin"),
  });
}

async function resetSettings(interaction) {
  const scope = interaction.options.getString("scope") || "user";
  const lang = interaction.localeLang || "id";

  if (scope === "guild") {
    if (!interaction.guild) {
      return buildErrorContainerV2({
        title: `${e("hmph", "❌")} Khusus Server`,
        description: "Reset guild hanya bisa dilakukan di dalam server.",
        footerText: ui.getFooter("core"),
      });
    }

    if (!canManageGuild(interaction.member)) {
      return buildErrorContainerV2({
        title: `${e("hmph", "❌")} Izin Tidak Cukup`,
        description: "Hanya Administrator yang bisa mereset pengaturan guild.",
        footerText: ui.getFooter("core"),
      });
    }

    await guildSettingsService.updateGuildSetting(interaction.guild.id, (settings) => {
      settings.features = { leveling: false, economy: false, music: true };
      settings.automod = { enabled: true, antiInvite: false, antiCaps: false, massMention: 5, antiSpam: true, badWords: [] };
    });

    return buildContainerV2({
      accentColorHex: ui.getColor("warning") || "#f59e0b",
      title: `${e("impressed", "🔄")} ${lang === "id" ? "Reset Berhasil" : "Reset Complete"}`,
      description: lang === "id"
        ? "Pengaturan server dikembalikan ke default."
        : "Server settings restored to defaults.",
      footerText: ui.getFooter("admin"),
    });
  }

  const defaultPrefs = {
    dm_authorized: false,
    stamina_full: true,
    quest_reset: true,
    event_news: true,
  };

  await cacheManager.updateUserProfile(interaction.user.id, { notification_prefs: defaultPrefs });
  await languageManager.setUserLanguage(interaction.user.id, null);

  return buildContainerV2({
    accentColorHex: ui.getColor("warning") || "#f59e0b",
    title: `${e("impressed", "🔄")} ${lang === "id" ? "Reset Berhasil" : "Reset Complete"}`,
    description: lang === "id"
      ? "Pengaturan akunmu dikembalikan ke default."
      : "Your account settings restored to defaults.",
    footerText: ui.getFooter("core"),
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setting")
    .setDescription("Kelola pengaturan fitur Naura untuk akun atau server kamu.")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat pengaturan yang sedang aktif.")
        .addStringOption((opt) =>
          opt
            .setName("scope")
            .setDescription("Lihat pengaturan user atau guild?")
            .setRequired(false)
            .addChoices(
              { name: "Akun Saya", value: "user" },
              { name: "Server Ini", value: "guild" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Aktifkan atau nonaktifkan fitur tertentu.")
        .addStringOption((opt) =>
          opt
            .setName("fitur")
            .setDescription("Fitur yang ingin diubah.")
            .setRequired(true)
            .addChoices(
              { name: "AI Chat DM", value: "aiChatEnabled" },
              { name: "Notifikasi Survival", value: "survivalNotifications" },
              { name: "Pengingat Premium", value: "premiumReminders" },
              { name: "Bahasa (ID/EN)", value: "language" },
              { name: "[Guild] Leveling", value: "leveling" },
              { name: "[Guild] Economy", value: "economy" },
              { name: "[Guild] Music", value: "music" },
              { name: "[Guild] AutoMod", value: "automod" },
              { name: "[Guild] Starboard", value: "starboard" },
              { name: "[Guild] QOTD", value: "qotd" },
              { name: "[Guild] Ticket", value: "ticket" },
              { name: "[Guild] Temp Voice", value: "tempVoice" },
              { name: "[Guild] Modmail", value: "modmail" },
              { name: "[Guild] Anti-Raid", value: "antiRaid" },
            ),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("status")
            .setDescription("Aktifkan (true) atau nonaktifkan (false)?")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("nilai")
            .setDescription("Nilai untuk setting bahasa: id, en, atau default.")
            .setRequired(false)
            .addChoices(
              { name: "🇮🇩 Indonesia", value: "id" },
              { name: "🇬🇧 English", value: "en" },
              { name: "⚙️ Default Server", value: "default" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Kembalikan pengaturan ke default.")
        .addStringOption((opt) =>
          opt
            .setName("scope")
            .setDescription("Reset pengaturan user atau guild?")
            .setRequired(false)
            .addChoices(
              { name: "Akun Saya", value: "user" },
              { name: "Server Ini (Admin)", value: "guild" },
            ),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();

    try {
      let payload;

      if (sub === "view") {
        const scope = interaction.options.getString("scope") || "user";
        payload = scope === "guild" 
          ? await viewGuildSettings(interaction)
          : await viewUserSettings(interaction);
      } else if (sub === "toggle") {
        const fitur = interaction.options.getString("fitur");
        const isGuildFeature = GUILD_FEATURE_KEYS.includes(fitur);
        
        if (isGuildFeature) {
          payload = await toggleGuildSetting(interaction);
        } else {
          payload = await toggleUserSetting(interaction);
        }
      } else if (sub === "reset") {
        payload = await resetSettings(interaction);
      }

      await interaction.editReply(payload);
    } catch (err) {
      const lang = interaction.localeLang || "id";
      const payload = buildErrorContainerV2({
        title: `${e("hmph", "❌")} ${lang === "id" ? "Terjadi Kesalahan" : "Something Went Wrong"}`,
        description: err.message || (lang === "id" ? "Coba lagi nanti." : "Please try again later."),
        footerText: ui.getFooter("core"),
      });
      await interaction.editReply(payload);
    }
  },
};
