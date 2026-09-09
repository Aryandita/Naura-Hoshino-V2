"use strict";

const {
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const astralService = require("../../src/services/astralService");
const {
  renderOmikujiCard,
  renderAstralWeatherBanner,
} = require("../../src/canvas/astralCanvas");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("astral")
    .setDescription(
      "🌌 Masuki Hoshino Astral Sanctuary untuk ramalan bintang & cuaca kosmik server",
    )
    .addSubcommand((sub) =>
      sub
        .setName("weather")
        .setDescription(
          "Lihat kondisi Cuaca Astral Server dan bonus buff aktif hari ini",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("omikuji")
        .setDescription(
          "Tarik Kartu Tarot Omikuji Bintang harian untuk berkah, rezeki, dan panduan",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("observe")
        .setDescription(
          "Gunakan Teropong Bintang untuk mengamati rasi bintang dan mengumpulkan Stardust",
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.user;
    const displayName =
      interaction.member?.displayName || user.displayName || user.username;

    if (subcommand === "weather") {
      await interaction.deferReply();

      let sampleTexts = [];
      try {
        if (interaction.channel && interaction.channel.messages) {
          const fetched = await interaction.channel.messages.fetch({ limit: 25 });
          sampleTexts = fetched
            .filter((m) => !m.author.bot && m.content && m.content.trim().length > 5)
            .map((m) => m.content.trim());
        }
      } catch (_) {
        // Fallback jika tidak ada izin baca riwayat pesan
      }

      const weather = await astralService.getGuildAstralWeather(
        interaction.guildId,
        sampleTexts,
      );
      const bannerBuffer = await renderAstralWeatherBanner(weather);
      const attachment = new AttachmentBuilder(bannerBuffer, {
        name: "astral-weather.png",
      });

      const buffList = Object.entries(weather.buffs || {})
        .map(([k, v]) => `• **${k}**: \`+${v}%\``)
        .join("\n");

      const auraSection = weather.isAiEvaluated
        ? `\n\n**🔮 Suasana Server Hari Ini (Aura Vibe: \`${weather.sentimentScore}%\`):**\n> *"${weather.auraReason}"*`
        : `\n\n> *"${weather.lore}"*`;

      const payload = buildContainerV2({
        authorName: "HOSHINO ASTRAL SANCTUARY",
        title: `${weather.emoji} Cuaca Astral: ${weather.name}`,
        description: `Halo, **${displayName}**! Berikut adalah kondisi pancaran energi kosmik yang menaungi server hari ini:\n\n${weather.description}\n\n**✨ Efek & Buff Server Aktif:**\n${buffList}${auraSection}`,
        mediaUrl: "attachment://astral-weather.png",
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({
        ...payload,
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "omikuji") {
      await interaction.deferReply();
      const omikujiResult = await astralService.drawDailyOmikuji(
        user.id,
        displayName,
      );

      if (!omikujiResult.canClaim) {
        const payload = buildContainerV2({
          authorName: "HOSHINO ASTRAL SANCTUARY",
          title: "✦ Omikuji Harian Sudah Ditarik ✦",
          description: omikujiResult.message,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const omikuji = omikujiResult.result;
      const cardBuffer = await renderOmikujiCard(omikuji, user);
      const attachment = new AttachmentBuilder(cardBuffer, {
        name: "tarot-omikuji.png",
      });

      // Berikan reward koin dan stamina secara atomik
      try {
        if (omikuji.tier?.rewardCoin) {
          await cacheManager.incrementUserProfile(
            user.id,
            "economy_wallet",
            omikuji.tier.rewardCoin,
          );
        }
        if (omikuji.tier?.rewardStamina) {
          await cacheManager.incrementUserSurvival(
            user.id,
            "stamina",
            omikuji.tier.rewardStamina,
          );
        }
      } catch (_) {}

      const payload = buildContainerV2({
        authorName: "HOSHINO ASTRAL SANCTUARY",
        title: `🎴 Tarot Omikuji: ${omikuji.tier?.name || "Berkah Bintang"}`,
        description: `Halo, **${displayName}**! Bintang-bintang telah berputar dan mengungkap takdirmu untuk hari ini:\n\n> *${omikuji.personalQuote}*\n\n**🎁 Hadiah Berkah Bintang:**\n• Koin: \`+${omikuji.tier?.rewardCoin?.toLocaleString("id-ID") || 0}\` Koin\n• Stamina: \`+${omikuji.tier?.rewardStamina || 0}\` Stamina`,
        mediaUrl: "attachment://tarot-omikuji.png",
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({
        ...payload,
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "observe") {
      await interaction.deferReply();
      const obs = astralService.observeConstellation(user.id, displayName);
      const stardustGain = obs.constellation?.stardust || 150;

      try {
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          stardustGain,
        );
      } catch (_) {}

      const payload = buildContainerV2({
        authorName: "HOSHINO ASTRAL SANCTUARY",
        title: `🔭 Teropong Bintang: Rasi ${obs.constellation.name}`,
        description: `Melalui lensa teropong kristal, **${displayName}** mengamati langit malam dan menemukan rasi bintang **${obs.constellation.name}** yang berpusat pada bintang utama **${obs.constellation.star}**!\n\n✨ **Pengamatan Berhasil:**\n• Stardust Kosmik: \`+${stardustGain}\` Star Fragments\n• Energi Teropong: \`Stabil\``,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
