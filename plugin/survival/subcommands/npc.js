"use strict";

/**
 * @module npc
 * @description Subcommand /survival npc - Interaksi dengan NPC penduduk desa dengan dialog dan friendship system.
 * 
 * Fitur Utama:
 * - NPC location-based availability
 * - Dialog tree dengan pilihan respons
 * - Friendship level progression
 * - Gift giving mechanic
 * - Marriage proposal system (level 4)
 */

const { logger } = require("../../../src/managers/logger");

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require("discord.js");
// ============================================================================
// CONSTANTS
// ============================================================================

const path = require("path");

const UserSurvival = require("../../../src/models/UserSurvival");
const UserNPC = require("../../../src/models/UserNPC");
const cacheManager = require("../../../src/managers/cacheManager");
const languageManager = require("../../../src/managers/languageManager");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const npcConfig = require("../../../src/survival/data/npcs");
const geminiClient = require("../../../src/ai/geminiClient");
const actions = require("../../../src/survival/helpers/npcActions");
const {
  COLLECTOR_MS,
  e,
  findPortrait,
  timeOfDayKey,
  isSameDay,
  buildActions,
  MAX_DAILY_GIFTS,
} = require("../../../src/survival/helpers/npcHelpers");
const storyIntegration = require("../../../src/survival/helpers/storyIntegration");
const npcScheduleEngine = require("../../../src/survival/engines/npcScheduleEngine");

/** Minta AI merangkai sapaan. Selalu ada kalimat cadangan supaya NPC tak bisu. */
async function composeGreeting(ctx) {
  const {
    npc,
    lang,
    lokasi,
    timeOfDay,
    inGameHour,
    username,
    affection,
    relLabel,
    fallback,
  } = ctx;

  let seasonInfoEn = "";
  let seasonInfoId = "";
  const {
    getCurrentSeason,
  } = require("../../../src/survival/helpers/survivalContext");
  const season = getCurrentSeason();
  if (season) {
    if (season.name === "ramadhan") {
      seasonInfoEn =
        "\nCurrently, it is the holy month of Ramadan. Many people are fasting. Mention the festive or fasting vibe.";
      seasonInfoId =
        "\nSaat ini sedang bulan Ramadhan. Banyak orang sedang berpuasa. Singgung suasana puasa atau persahabatan di bulan suci ini.";
    } else if (season.name === "kemerdekaan") {
      seasonInfoEn =
        "\nCurrently, it is Independence Day (Kemerdekaan) month. Mention the red and white flag or patriotic spirit.";
      seasonInfoId =
        "\nSaat ini sedang bulan Kemerdekaan Indonesia. Singgung semangat merah putih, lomba tujuh belasan, atau hari kemerdekaan.";
    } else if (season.name === "naura_birthday") {
      seasonInfoEn =
        "\nCurrently, it is Naura's Birthday celebration! People are happy and festive.";
      seasonInfoId =
        "\nSaat ini sedang perayaan Ulang Tahun Naura! Suasana sangat ceria dan penuh pesta.";
    } else if (season.name === "new_year") {
      seasonInfoEn =
        "\nCurrently, it is New Year! Mention fireworks, new resolutions or festive vibes.";
      seasonInfoId =
        "\nSaat ini adalah perayaan Tahun Baru! Singgung soal kembang api, resolusi baru, atau perayaan meriah.";
    } else if (season.name === "lebaran") {
      seasonInfoEn =
        "\nCurrently, it is Eid al-Fitr (Lebaran)! People are wearing new clothes, eating Ketupat and asking for forgiveness.";
      seasonInfoId =
        "\nSaat ini sedang Hari Raya Idul Fitri (Lebaran)! Singgung saling bermaaf-maafan, baju baru, atau ketupat.";
    }
  }

  const prompt =
    lang === "en"
      ? `You are an NPC in a Discord RPG called Naura Hoshino.\nYour name: ${npc.name}.\nYour job: ${npc.title}.\nYour personality: ${npc.personality}.\nYou are currently in: ${lokasi}, during the ${timeOfDay} (in-game hour ${inGameHour}).\nYour closeness with the player (${username}) is ${affection}/100 (${relLabel}).\nMatch your warmth to that closeness: polite with acquaintances, affectionate with a partner or spouse.${seasonInfoEn}\nReply with one short, natural greeting in English. Two short sentences at most.`
      : `Kamu adalah karakter NPC di sebuah game RPG Discord bernama Naura Hoshino.\nNama kamu: ${npc.name}.\nPekerjaan: ${npc.title}.\nSifat kamu: ${npc.personality}.\nKamu sedang berada di: ${lokasi}, pada ${timeOfDay} (jam dalam game ${inGameHour}).\nTingkat kedekatan kamu dengan pemain (${username}) adalah ${affection}/100 (${relLabel}).\nSesuaikan kehangatanmu dengan kedekatan itu: sopan pada kenalan, mesra pada pacar atau pasangan.${seasonInfoId}\nBerikan satu sapaan pendek yang natural dalam bahasa Indonesia. Maksimal dua kalimat pendek.`;

  try {
    const response = await geminiClient.generate({ parts: [{ text: prompt }] });
    if (response) return response;
  } catch (error) {
    logger.debug("[npc:composeGreeting] Subrutin AI atau memori gagal: " + (error?.message || error));
  }
  return fallback;
}

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  /**
   * Handler utama untuk command /survival npc
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = interaction.user;
    const lang =
      interaction.lang || (await languageManager.getUserLanguage(user.id));
    const t = (key, placeholders) =>
      languageManager.translateSync(lang, key, placeholders);

    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });
    const profile = await cacheManager.getUserProfile(user.id);

    const coin = e("sc", e("nsf", "\uD83E\uDE99"));
    const lokasi = survival.currentLocation || "desa";
    const inGameHour = survival.inGameHour || 6;
    const timeOfDay = t(timeOfDayKey(inGameHour));

    // Sebagian NPC punya jadwal berpindah, jadi daftarnya ikut berubah
    // mengikuti jam dalam game.
    const presentNPCs = Object.values(npcConfig).filter((n) => {
      const loc =
        typeof n.getLocation === "function"
          ? n.getLocation(inGameHour)
          : n.location;
      return loc === lokasi;
    });

    if (presentNPCs.length === 0) {
      return ui.sendError(
        interaction,
        t("npc.empty", { location: lokasi.toUpperCase() }),
        true,
      );
    }

    const npcSelect = new StringSelectMenuBuilder()
      .setCustomId("npc_select")
      .setPlaceholder(t("npc.placeholder"));

    presentNPCs.forEach((n) => {
      npcSelect.addOptions({
        label: n.name,
        description: n.title,
        value: n.id,
      });
    });

    const selectRow = new ActionRowBuilder().addComponents(npcSelect);

    let lastPayloadBuilder = () =>
      buildContainerV2({
        accentColorHex: survivalUI.getColor("moss"),
        title: `${e("happy", "\uD83D\uDC65")} ${t("npc.list_title", { location: lokasi.toUpperCase() })}`,
        description: t("npc.list_desc", {
          location: lokasi.toUpperCase(),
          timeOfDay,
          count: presentNPCs.length,
        }),
        footerText: ui.getFooter("survival"),
      });

    const listPayload = buildContainerV2({
      accentColorHex: survivalUI.getColor("moss"),
      title: `${e("happy", "\uD83D\uDC65")} ${t("npc.list_title", { location: lokasi.toUpperCase() })}`,
      description: t("npc.list_desc", {
        location: lokasi.toUpperCase(),
        timeOfDay,
        count: presentNPCs.length,
      }),
      buttonsRow: [selectRow],
      footerText: ui.getFooter("survival"),
    });

    const response =
      interaction.deferred || interaction.replied
        ? await interaction.followUp({ ...listPayload, fetchReply: true })
        : await interaction.reply({ ...listPayload, fetchReply: true });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    let currentNpcId = null;

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      // Memilih warga
      if (i.isStringSelectMenu() && i.customId === "npc_select") {
        currentNpcId = i.values[0];
        const npc = npcConfig[currentNpcId];
        const [npcData] = await UserNPC.findOrCreate({
          where: { userId: user.id, npcId: currentNpcId },
        });

        // Check first encounter story scene
        const firstEncounter = await storyIntegration.checkFirstEncounter(user.id, currentNpcId);
        if (firstEncounter && (firstEncounter.type === "first_encounter" || firstEncounter.type === "vn_scene")) {
          // Render VN scene untuk first encounter
          const vnPayload = await storyIntegration.renderStoryScene(firstEncounter.scene);
          lastPayloadBuilder = () => vnPayload;
          return i.editReply(vnPayload);
        }

        const relLabel = t(`npc.rel_${npcData.relationshipLevel || 0}`);
        const affectionBar = ui.createProgressBar(npcData.affection, 100, 10);
        const giftsToday = isSameDay(npcData.lastInteraction, new Date())
          ? npcData.dailyGifts || 0
          : 0;

        // Get NPC current state dari schedule engine
        const npcState = npcScheduleEngine.getNpcStateAtTime(currentNpcId, inGameHour);
        const appearanceDesc = npcScheduleEngine.getAppearanceDescription(currentNpcId, npcState.portraitVariant);

        let aiDialog = await composeGreeting({
          npc,
          lang,
          lokasi,
          timeOfDay,
          inGameHour,
          username: user.username,
          affection: npcData.affection,
          relLabel,
          fallback: t("npc.ai_fallback"),
        });

        // Enhance dengan contextual dialog jika tersedia
        const contextualDialog = npcScheduleEngine.getContextualDialog(currentNpcId, inGameHour);
        if (contextualDialog) {
          aiDialog = contextualDialog;
        }

        // Potret NPC - hanya coba variant jika NPC punya schedule eksplisit
        let portrait = null;

        // Cek apakah NPC ini punya schedule yang didefinisikan
        const hasSchedule = npcScheduleEngine.schedules && npcScheduleEngine.schedules[currentNpcId];

        if (hasSchedule && npcState.portraitVariant) {
          // Hanya ambil variant portrait jika NPC memang punya schedule
          portrait = npcScheduleEngine.getPortraitPath(currentNpcId, npcState.portraitVariant);
        }

        // Selalu fallback ke base portrait dari config npcs.js
        if (!portrait) {
          portrait = findPortrait(npc);
        }

        const files = [];
        let iconURL = null; // Jangan default ke bot avatar

        if (portrait) {
          const fileName = `npc_${npc.id}${path.extname(portrait)}`;
          files.push(new AttachmentBuilder(portrait, { name: fileName }));
          iconURL = `attachment://${fileName}`;
        }
        // Jika tidak ada portrait sama sekali, iconURL tetap null (header tanpa icon)

        // Build description dengan activity info
        const activityInfo = npcState.isAvailable 
          ? `\n📍 *Sedang ${npcState.activity} di ${npcState.location}*`
          : `\n💤 *Tidak tersedia saat ini*`;

        const appearanceInfo = appearanceDesc 
          ? `\n👔 *${appearanceDesc}*`
          : "";

        const description = [
          `*${npc.personality}*`,
          activityInfo,
          appearanceInfo,
          "",
          `**${t("npc.status")}:** ${relLabel}`,
          `**${t("npc.affection")}:** ${npcData.affection}/100`,
          affectionBar,
          `-# ${t("npc.gift_left")}: ${Math.max(0, MAX_DAILY_GIFTS - giftsToday)}/${MAX_DAILY_GIFTS}`,
          "",
          `${e("chirping", "\uD83D\uDCAC")} **${npc.name}:** "${aiDialog}"`,
        ].filter(line => line !== "").join("\n");

        lastPayloadBuilder = () =>
          buildContainerV2({
            accentColorHex: survivalUI.getColor("moss"),
            authorName: `Warga ${String(lokasi).toUpperCase()} • ${npc.type === "romansa" ? "💖 Romansa" : "💙 Teman"}`,
            title: `${npc.name} (${npc.title})`,
            iconURL,
            description,
            files,
            footerText: ui.getFooter("survival"),
          });

        const infoPayload = buildContainerV2({
          accentColorHex: survivalUI.getColor("moss"),
          authorName: `Warga ${String(lokasi).toUpperCase()} • ${npc.type === "romansa" ? "💖 Romansa" : "💙 Teman"}`,
          title: `${npc.name} (${npc.title})`,
          iconURL,
          description,
          files,
          buttonsRow: [selectRow, buildActions(npc, npcData, t)],
          footerText: ui.getFooter("survival"),
        });

        return i.editReply(infoPayload);
      }

      if (!i.isButton() || !currentNpcId) return;

      if (i.customId.startsWith("vn_choice_")) {
        const choiceIndex = parseInt(i.customId.replace("vn_choice_", ""), 10);
        const firstMeetScene = storyIntegration.getFirstEncounterScene(currentNpcId);
        const choice = firstMeetScene?.choices?.[choiceIndex];
        
        let bonusAfeksi = 0;
        const [npcData] = await UserNPC.findOrCreate({
          where: { userId: user.id, npcId: currentNpcId },
        });

        if (choice?.effect?.affection) {
          bonusAfeksi = choice.effect.affection;
          npcData.affection = Math.min(100, Math.max(0, (npcData.affection || 0) + bonusAfeksi));
          await npcData.save({ fields: ["affection"] });
        }

        const updatedNpc = npcConfig[currentNpcId];
        const replyPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          authorName: `Pertemuan Pertama • ${updatedNpc?.name || "NPC"}`,
          title: "✨ Tanggapan Pilihan",
          description: `Kamu menjawab: *${choice?.label || "..."}*\n\n${updatedNpc?.name || "NPC"} tersenyum ramah kepadamu.\n${bonusAfeksi > 0 ? `💖 **+${bonusAfeksi} Afeksi**` : ""}\n\nSekarang kamu bisa mulai berinteraksi secara reguler dengan warga ini!`,
          buttonsRow: [selectRow, buildActions(updatedNpc, npcData, t)],
          footerText: ui.getFooter("survival"),
        });

        lastPayloadBuilder = () => replyPayload;
        return i.editReply(replyPayload);
      }

      const handler = actions[i.customId];
      if (!handler) return;

      const npc = npcConfig[currentNpcId];
      const [npcData] = await UserNPC.findOrCreate({
        where: { userId: user.id, npcId: currentNpcId },
      });

      return handler(i, {
        npc,
        npcData,
        survival,
        profile,
        t,
        coin,
        now: new Date(),
      });
    });

    // Saat sesi habis, tombolnya dicabut tapi isi kartunya dibiarkan utuh.
    collector.on("end", async () => {
      try {
        await response.edit(lastPayloadBuilder());
      } catch (error) {
        logger.debug("[npc:execute] Galat pada rutinitas aplikasi: " + (error?.message || error));
      }
    });
  },
};
