"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const cacheManager = require("../../../src/managers/cacheManager");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const { renderOnboardingPrompt } = require("../../../src/survival/engines/playerOnboardingEngine");
const { logger } = require("../../../src/managers/logger");

module.exports = {
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const user = interaction.user;
    const userId = user.id;

    try {
      // 1. Verifikasi registrasi pemain
      const profile = await cacheManager.getUserProfile(userId);
      const inv = safeParseInventory(profile?.inventory);
      const hasStarted = inv.some((item) => item && item.id === "survival_started");

      if (!hasStarted) {
        const lang = typeof interaction.fetchLang === "function"
          ? await interaction.fetchLang()
          : interaction.localeLang || "id";
        const onboardingPayload = renderOnboardingPrompt(user, lang);
        return interaction.editReply(onboardingPayload);
      }

      // 2. Ambil data survival & vitals
      const survival = (await cacheManager.getUserSurvival(userId)) || {};
      const health = Math.max(0, Math.min(100, survival.health ?? 100));
      const energy = Math.max(0, Math.min(100, survival.energy ?? 100));
      const hunger = Math.max(0, Math.min(100, survival.hunger ?? 100));
      const thirst = Math.max(0, Math.min(100, survival.thirst ?? 100));
      const location = survival.currentLocation || "Desa Sukamaju";
      const cash = profile?.cash || 0;

      // 3. Bangun tombol navigasi interaktif (2 baris aksi cepat)
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`survival_act_inventory:${userId}`)
          .setLabel("Inventaris")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎒"),
        new ButtonBuilder()
          .setCustomId(`survival_act_mine:${userId}`)
          .setLabel("Tambang")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("⛏️"),
        new ButtonBuilder()
          .setCustomId(`survival_act_chop:${userId}`)
          .setLabel("Tebang")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🪓"),
        new ButtonBuilder()
          .setCustomId(`survival_act_fish:${userId}`)
          .setLabel("Mancing")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🎣"),
        new ButtonBuilder()
          .setCustomId(`survival_act_roam:${userId}`)
          .setLabel("Jelajah")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🗺️"),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`survival_act_dungeon:${userId}`)
          .setLabel("Dungeon")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("⚔️"),
        new ButtonBuilder()
          .setCustomId(`survival_act_shop:${userId}`)
          .setLabel("Toko")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🏪"),
        new ButtonBuilder()
          .setCustomId(`survival_act_craft:${userId}`)
          .setLabel("Tempa & Craft")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🔨"),
        new ButtonBuilder()
          .setCustomId(`survival_act_dailyquest:${userId}`)
          .setLabel("Quest")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📜"),
        new ButtonBuilder()
          .setCustomId(`survival_act_info:${userId}`)
          .setLabel("Status Lengkap")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📊"),
      );

      const payload = buildContainerV2({
        accentColorHex: survivalUI.getColor("emerald"),
        authorName: "Naura Wilds • Pusat Petualangan",
        title: `🌿 Command Center Survival: ${user.username}`,
        iconURL: user.displayAvatarURL(),
        expression: "Cheers",
        description:
          `Selamat datang di **Naura Wilds**, Kak **${user.displayName || user.username}**! ✨\n` +
          `Pilih langsung aktivitas petualanganmu melalui tombol di bawah tanpa perlu mengetik ulang perintah.\n\n` +
          `**Kondisi Fisik & Status Saat Ini:**\n` +
          `❤️ **HP**: \`${health}/100\` • ⚡ **Energi**: \`${energy}/100\`\n` +
          `🍖 **Kenyang**: \`${hunger}/100\` • 💧 **Hidrasi**: \`${thirst}/100\`\n` +
          `📍 **Lokasi**: \`${location}\` • 💰 **Dompet**: \`${cash.toLocaleString("id-ID")} Cash\`\n\n` +
          `*Tips: Sentuh tombol aksi di bawah untuk langsung membuka fitur terkait.*`,
        buttonsRow: [row1, row2],
        footerText: survivalUI.getFooter(),
      });

      return await interaction.editReply(payload);
    } catch (err) {
      logger.error("[Survival Hub] Error rendering hub:", err);
      const errPayload = survivalUI.buildErrorContainer(
        "Gagal Membuka Command Center",
        "Maaf, Naura mengalami kendala saat memuat menu utama. Coba lagi dalam beberapa saat ya!",
      );
      return interaction.editReply(errPayload);
    }
  },
};

