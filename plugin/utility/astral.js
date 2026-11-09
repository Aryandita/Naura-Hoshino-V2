"use strict";
const { logger } = require("../../src/managers/logger");

const {
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const astralService = require("../../src/services/astralService");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("astral")
    .setDescription(
      "ðŸŒŒ Masuki Hoshino Astral Sanctuary untuk ramalan bintang & cuaca kosmik server",
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
        .setName("spread")
        .setDescription(
          "Tarik 3 Kartu Tarot Astral (Past, Present, Future) dengan ramalan mendalam & buff",
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
      } catch (err) {
        if (err?.code && [10008, 40060, 50027, 50013, 50007, 10062].includes(err.code)) {
          // Intentional: Abaikan error siklus interaksi / izin Discord yang sudah diketahui
        } else {
          logger.debug("[astral:execute] Pemanggilan Discord API gagal: " + (err?.message || err));
        }
      }

      const weather = await astralService.getGuildAstralWeather(
        interaction.guildId,
        sampleTexts,
      );
      const bannerBuffer = await canvasWorkerPool.execute({
        task: "renderAstralWeather",
        payload: { weather },
        userId: user.id,
      });
      const attachment = new AttachmentBuilder(bannerBuffer, {
        name: "astral-weather.png",
      });

      const buffList = Object.entries(weather.buffs || {})
        .map(([k, v]) => `â€¢ **${k}**: \`+${v}%\``)
        .join("\n");

      const auraSection = weather.isAiEvaluated
        ? `\n\n**ðŸ”® Suasana Server Hari Ini (Aura Vibe: \`${weather.sentimentScore}%\`):**\n> *"${weather.auraReason}"*`
        : `\n\n> *"${weather.lore}"*`;

      const payload = buildContainerV2({
        authorName: "HOSHINO ASTRAL SANCTUARY",
        title: `${weather.emoji} Cuaca Astral: ${weather.name}`,
        description: `Halo, **${displayName}**! Berikut adalah kondisi pancaran energi kosmik yang menaungi server hari ini:\n\n${weather.description}\n\n**âœ¨ Efek & Buff Server Aktif:**\n${buffList}${auraSection}`,
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
          title: "âœ¦ Omikuji Harian Sudah Ditarik âœ¦",
          description: omikujiResult.message,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const omikuji = omikujiResult.result;
      const cardBuffer = await canvasWorkerPool.execute({
        task: "renderAstralOmikuji",
        payload: { omikuji, user },
        userId: user.id,
      });
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
      } catch (err) {
        logger.error("[astral:execute] Mutasi saldo ekonomi/survival gagal: " + (err?.message || err), err);
      }

      const payload = buildContainerV2({
        authorName: "HOSHINO ASTRAL SANCTUARY",
        title: `ðŸŽ´ Tarot Omikuji: ${omikuji.tier?.name || "Berkah Bintang"}`,
        description: `Halo, **${displayName}**! Bintang-bintang telah berputar dan mengungkap takdirmu untuk hari ini:\n\n> *${omikuji.personalQuote}*\n\n**ðŸŽ Hadiah Berkah Bintang:**\nâ€¢ Koin: \`+${omikuji.tier?.rewardCoin?.toLocaleString("id-ID") || 0}\` Koin\nâ€¢ Stamina: \`+${omikuji.tier?.rewardStamina || 0}\` Stamina`,
        mediaUrl: "attachment://tarot-omikuji.png",
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({
        ...payload,
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "spread") {
      const tarotHandler = require("./tarot");
      return tarotHandler.execute(interaction);
    }

    if (subcommand === "observe") {
      await interaction.deferReply();
      const cdKey = "astral:observe:cd:" + user.id;
      const CD_MS = 5 * 60 * 1000;
      let last = 0;
      try {
        if (require("../../src/managers/redisManager").client && require("../../src/managers/redisManager").client.isReady) {
          last = Number(await require("../../src/managers/redisManager").client.get(cdKey)) || 0;
        }
      } catch (e) {}
      if (Date.now() - last < CD_MS) {
        const remainingSec = Math.ceil((CD_MS - (Date.now() - last)) / 1000);
        return interaction.editReply({ ...buildContainerV2({ authorName: "HOSHINO ASTRAL SANCTUARY", title: "Teropong Beristirahat", description: "Teropong masih mendinginkan. Tunggu " + remainingSec + " detik lagi (maks 1x per 5 menit).", footerText: ui.getFooter("utility") }), flags: MessageFlags.IsComponentsV2 });
      }
      try {
        if (require("../../src/managers/redisManager").client && require("../../src/managers/redisManager").client.isReady) {
          await require("../../src/managers/redisManager").client.setEx(cdKey, 300, String(Date.now()));
        }
      } catch (e) {}
      const obs = astralService.observeConstellation(user.id, displayName);
      const stardustGain = 50;
      try {
        await cacheManager.incrementUserSurvival(user.id, "starFragments", stardustGain);
      } catch (err) {
        logger.error("[astral:execute] Mutasi saldo ekonomi/survival gagal: " + (err?.message || err), err);
      }
      const payload = buildContainerV2({
        authorName: "HOSHINO ASTRAL SANCTUARY",
        title: "Teropong Bintang: Rasi " + obs.constellation.name,
        description: "Melalui lensa teropong kristal, **" + displayName + "** mengamati langit malam dan menemukan rasi bintang **" + obs.constellation.name + "** yang berpusat pada bintang utama **" + obs.constellation.star + "**!\n\nPengamatan Berhasil:\n- Stardust Kosmik: `+" + stardustGain + "` Star Fragments (maks 1x per 5 menit)\n- Energi Teropong: Stabil",
        footerText: ui.getFooter("utility"),
      });
      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }
  },
};

