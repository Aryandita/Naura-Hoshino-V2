const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("🌐 Terjemahkan teks ke bahasa lain.")
    .addSubcommand((sub) =>
      sub
        .setName("text")
        .setDescription("Terjemahkan teks yang kamu ketik.")
        .addStringOption((opt) =>
          opt
            .setName("teks")
            .setDescription("Teks yang ingin diterjemahkan")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("ke")
            .setDescription(
              "Bahasa tujuan (contoh: id, en, ja, ko, ar, de, fr, es)",
            )
            .setAutocomplete(true)
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const text = interaction.options.getString("teks");
    const targetLang = interaction.options.getString("ke");

    // Check VIP status for text character limit (>500 chars)
    const cacheManager = require("../../src/managers/cacheManager");
    const profile = await cacheManager.getUserProfile(interaction.user.id);
    const isPremium =
      profile.isPremium &&
      profile.premiumUntil &&
      new Date(profile.premiumUntil) > new Date();

    if (!isPremium && text.length > 500) {
      const errPayload = buildErrorContainerV2({
        title: `${ui.getEmoji("vip") || "💎"} Batas Karakter Terjemahan`,
        description: `Pengguna standar hanya dapat menerjemahkan maksimal **500 karakter** per teks (teks kamu: ${text.length} karakter).\nGunakan \`/premium\` untuk batas terjemahan tanpa batas!`,
        footerText: ui.getFooter("utility"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      // Using a free translation API without requiring an API key
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
      );
      const data = await response.json();

      const translatedText = data[0].map((item) => item[0]).join("");
      const sourceLang = data[2];

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#3498db",
        authorName: "Google Translate Integration",
        title: `${ui.getEmoji("translate") || "🌐"} Hasil Terjemahan Teks`,
        iconURL:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Google_Translate_logo.svg/512px-Google_Translate_logo.svg.png",
        fields: [
          {
            name: `${ui.getEmoji("deposit") || "📥"} Teks Asal (${sourceLang.toUpperCase()})`,
            value: text,
          },
          {
            name: `${ui.getEmoji("success") || "📤"} Terjemahan (${targetLang.toUpperCase()})`,
            value: translatedText,
          },
        ],
        footerText: ui.getFooter("utility"),
      });

      await interaction.editReply(payload);
    } catch (error) {
      logger.error("[Translate Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Menerjemahkan",
        description:
          "Terjadi kesalahan saat menerjemahkan teks. Pastikan kode bahasa tujuan benar (contoh: id, en, ja, ko).",
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },

  async autocomplete(interaction) {
    const {
      choice,
      safeRespond,
      fuzzyFilter,
    } = require("../../src/utils/autocompleteHelper");
    const focusedValue = interaction.options.getFocused().toLowerCase();

    const languages = [
      { name: "🇮🇩 Indonesian (Bahasa Indonesia)", code: "id" },
      { name: "🇬🇧 English (English)", code: "en" },
      { name: "🇯🇵 Japanese (日本語)", code: "ja" },
      { name: "🇰🇷 Korean (한국어)", code: "ko" },
      { name: "🇸🇦 Arabic (العربية)", code: "ar" },
      { name: "🇨🇳 Chinese Simplified (简体中文)", code: "zh-CN" },
      { name: "🇹🇼 Chinese Traditional (繁體中文)", code: "zh-TW" },
      { name: "🇩🇪 German (Deutsch)", code: "de" },
      { name: "🇫🇷 French (Français)", code: "fr" },
      { name: "🇪🇸 Spanish (Español)", code: "es" },
      { name: "🇷🇺 Russian (Русский)", code: "ru" },
      { name: "🇮🇹 Italian (Italiano)", code: "it" },
      { name: "🇵🇹 Portuguese (Português)", code: "pt" },
      { name: "🇳🇱 Dutch (Nederlands)", code: "nl" },
      { name: "🇹🇷 Turkish (Türkçe)", code: "tr" },
      { name: "🇻🇳 Vietnamese (Tiếng Việt)", code: "vi" },
      { name: "🇹🇭 Thai (ไทย)", code: "th" },
      { name: "🇵🇭 Tagalog / Filipino", code: "tl" },
      { name: "🇮🇳 Hindi (हिन्दी)", code: "hi" },
      { name: "🇲🇾 Malay (Bahasa Melayu)", code: "ms" },
    ];

    const choices = languages.map((l) => choice(l.name, l.code));
    return safeRespond(interaction, fuzzyFilter(choices, focusedValue, 25));
  },
};
