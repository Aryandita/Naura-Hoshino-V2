"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const storyEngine = require("../../../src/survival/engines/storyEngine");
const visualNovelRenderer = require("../../../src/survival/engines/visualNovelRenderer");
const npcBackstoryEngine = require("../../../src/survival/engines/npcBackstoryEngine");
const npcScheduleEngine = require("../../../src/survival/engines/npcScheduleEngine");
const cacheManager = require("../../../src/managers/cacheManager");
const { createManagedCollector } = require("../../../src/utils/interactionPipeline");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("story")
    .setDescription("Visual Novel Story Mode - Jelajahi cerita Naura Wilds")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Mulai atau lanjutkan story mode"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("backstory")
        .setDescription("Baca latar belakang cerita NPC")
        .addStringOption((opt) =>
          opt
            .setName("npc")
            .setDescription("Pilih NPC")
            .setRequired(true)
            .addChoices(
              { name: "Ningsih", value: "ningsih" },
              { name: "Tari", value: "tari" },
              { name: "Bidan Sari", value: "bidan_sari" },
              { name: "Bu Ratna", value: "bu_ratna" },
              { name: "Bagas", value: "bagas" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("schedule")
        .setDescription("Lihat jadwal aktivitas NPC")
        .addStringOption((opt) =>
          opt
            .setName("npc")
            .setDescription("Pilih NPC (kosongkan untuk lihat semua)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("progress")
        .setDescription("Cek progres story mode kamu"),
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const lang = interaction.localeLang || "id";

    try {
      if (sub === "start") {
        return await handleStoryStart(interaction, userId, lang);
      } else if (sub === "backstory") {
        return await handleBackstory(interaction, userId, lang);
      } else if (sub === "schedule") {
        return await handleSchedule(interaction, userId, lang);
      } else if (sub === "progress") {
        return await handleProgress(interaction, userId, lang);
      }
    } catch (error) {
      const payload = buildErrorContainerV2({
        title: `${ui.getEmoji("hmph", "❌")} ${lang === "id" ? "Terjadi Kesalahan" : "Error Occurred"}`,
        description: error.message || (lang === "id" ? "Coba lagi nanti." : "Please try again later."),
        footerText: ui.getFooter("survival"),
      });
      await interaction.editReply(payload).catch(() => {});
    }
  },
};

/**
 * Handle Story Mode visual novel play
 */
async function handleStoryStart(interaction, userId, lang) {
  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: `${ui.getEmoji("hmph", "❌")} ${lang === "id" ? "Belum Memulai Petualangan" : "Adventure Not Started"}`,
        description:
          lang === "id"
            ? "Kamu harus memulai petualangan survival terlebih dahulu dengan `/survival start` sebelum bisa mengakses Story Mode."
            : "You must start your survival adventure with `/survival start` before accessing Story Mode.",
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const progress = await storyEngine.getUserStoryProgress(userId);
  const currentChapter = progress.currentChapter || "prologue";
  let currentSceneId = progress.currentScene || "start";

  let scene = storyEngine.getScene(currentChapter, currentSceneId);
  if (!scene) {
    currentSceneId = "start";
    scene = storyEngine.getScene(currentChapter, currentSceneId);
  }

  if (!scene) {
    // Chapter completed or no scene available
    const payload = buildContainerV2({
      accentColorHex: survivalUI.getColor("moss"),
      authorName: "Story Mode • Naura Wilds",
      title: "🎉 Bab Cerita Selesai!",
      description:
        lang === "id"
          ? `Selamat! Kamu telah menyelesaikan bab **${currentChapter}**.\nNantikan episode dan chapter berikutnya di pembaruan Naura Wilds!`
          : `Congratulations! You have completed chapter **${currentChapter}**.\nStay tuned for upcoming story chapters in Naura Wilds!`,
      buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
      footerText: ui.getFooter("survival"),
    });
    return interaction.editReply(payload);
  }

  return await renderVNStep(interaction, userId, currentChapter, currentSceneId, scene, lang);
}

/**
 * Render single scene step with interactive branching
 */
async function renderVNStep(interaction, userId, chapterId, sceneId, scene, lang) {
  // Transform choices or nextScene button
  const sceneData = {
    characterId: scene.character || (scene.dialog && scene.dialog.find((d) => d.character)?.character) || null,
    characterEmotion: scene.emotion || (scene.dialog && scene.dialog.find((d) => d.emotion)?.emotion) || "neutral",
    backgroundId: scene.background || "kebun_morning",
    speakerName: scene.speaker || (scene.dialog && scene.dialog[0]?.speaker) || "Narrator",
    title: scene.title || `Chapter: ${chapterId.toUpperCase()}`,
    dialog: scene.dialog,
    dialogText: scene.text || (scene.dialog && scene.dialog.map((d) => d.text).join("\n\n")),
    choices: [],
  };

  if (Array.isArray(scene.choices) && scene.choices.length > 0) {
    sceneData.choices = scene.choices.map((c) => ({
      label: c.label.replace("[Player]", interaction.user.username),
      style: ButtonStyle.Primary,
    }));
  } else if (scene.nextScene) {
    sceneData.choices = [
      {
        label: lang === "id" ? "Lanjutkan Cerita ➔" : "Continue Story ➔",
        style: ButtonStyle.Success,
      },
    ];
  }

  const payload = await visualNovelRenderer.renderScene(sceneData);
  const message = await interaction.editReply(payload);

  if (sceneData.choices.length > 0) {
    createManagedCollector(message, interaction.user, {
      time: 180000,
      componentType: ComponentType.Button,
      denyMessage: "Ini bukan sesi cerita kamu.",
      onCollect: async (i) => {
        await i.deferUpdate().catch(() => {});
        const choiceIdx = parseInt(i.customId.split("_").pop(), 10);

        let nextSceneId = null;
        if (Array.isArray(scene.choices) && scene.choices[choiceIdx]) {
          const res = await storyEngine.makeChoice(userId, chapterId, sceneId, choiceIdx);
          nextSceneId = res.nextSceneId;
        } else if (scene.nextScene) {
          nextSceneId = scene.nextScene;
          await storyEngine.updateUserStoryProgress(userId, {
            currentChapter: chapterId,
            currentScene: nextSceneId,
          });
        }

        if (nextSceneId) {
          const nextScene = storyEngine.getScene(chapterId, nextSceneId);
          if (nextScene) {
            return await renderVNStep(i, userId, chapterId, nextSceneId, nextScene, lang);
          }
        }

        // Selesai atau chapter tamat
        const finishPayload = buildContainerV2({
          accentColorHex: survivalUI.getColor("moss"),
          authorName: "Story Mode • Naura Wilds",
          title: "🎉 Bab Selesai!",
          description:
            lang === "id"
              ? "Kamu telah menyelesaikan adegan ini! Progres petualanganmu telah dicatat."
              : "You have completed this scene! Your story progress has been recorded.",
          buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
          footerText: ui.getFooter("survival"),
        });
        return i.editReply(finishPayload);
      },
    });
  }

  return message;
}

/**
 * Handle NPC Backstories list & detail reading
 */
async function handleBackstory(interaction, userId, lang) {
  const npcId = interaction.options.getString("npc");
  const backstories = await npcBackstoryEngine.getAvailableBackstories(userId, npcId);

  if (backstories.length === 0) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: `${ui.getEmoji("hmph", "❌")} ${lang === "id" ? "Tidak Ada Backstory" : "No Backstory Available"}`,
        description:
          lang === "id"
            ? "Kamu belum membuka backstory untuk NPC ini. Tingkatkan relationship level untuk membuka cerita latar belakang mereka."
            : "You haven't unlocked any backstory for this NPC yet. Increase your relationship level to unlock their background stories.",
        buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const lines = backstories.map((b) => {
    const status = b.isUnlocked ? "✅" : "🔒";
    return `${status} **Level ${b.level}:** ${b.title}`;
  });

  const unlockedBackstories = backstories.filter((b) => b.isUnlocked);
  const components = [];

  if (unlockedBackstories.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("story_read_backstory")
      .setPlaceholder(lang === "id" ? "Pilih kisah yang ingin dibaca..." : "Select story to read...")
      .addOptions(
        unlockedBackstories.map((b) => ({
          label: `Level ${b.level}: ${b.title}`.substring(0, 100),
          description: b.unlockCondition.substring(0, 100),
          value: `${b.level}`,
        })),
      );
    components.push(new ActionRowBuilder().addComponents(select));
  }

  components.push(survivalUI.buildSurvivalActionRow('town', userId));

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: lang === "id" ? "NPC Backstory Collection" : "NPC Backstory Collection",
    title: `${ui.getEmoji("book", "📚")} ${lang === "id" ? "Daftar Backstory" : "Backstory List"}`,
    description: `${lines.join("\n")}\n\n${lang === "id" ? "Pilih salah satu kisah yang sudah terbuka dari menu dropdown di bawah untuk membaca lengkap kisahnya." : "Select an unlocked story from dropdown below to read full lore."}`,
    buttonsRow: components,
    footerText: ui.getFooter("survival"),
  });

  const message = await interaction.editReply(payload);

  if (unlockedBackstories.length > 0) {
    createManagedCollector(message, interaction.user, {
      time: 120000,
      componentType: ComponentType.StringSelect,
      onCollect: async (i) => {
        await i.deferUpdate().catch(() => {});
        const selectedLevel = parseInt(i.values[0], 10);
        const storyItem = unlockedBackstories.find((b) => b.level === selectedLevel);

        if (!storyItem) return;

        const readerPayload = buildContainerV2({
          accentColorHex: survivalUI.getColor("moss"),
          authorName: `Backstory • ${npcId.toUpperCase()}`,
          title: `📖 ${storyItem.title}`,
          description: storyItem.content,
          buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
          footerText: ui.getFooter("survival"),
        });

        return i.editReply(readerPayload);
      },
    });
  }

  return message;
}

/**
 * Handle NPC schedule inspection
 */
async function handleSchedule(interaction, userId, lang) {
  const npcId = interaction.options.getString("npc");
  const survival = await cacheManager.getUserSurvival(userId);
  const hour = survival?.inGameHour || 8;

  if (npcId) {
    const state = npcScheduleEngine.getNpcStateAtTime(npcId, hour);
    const appearanceDesc = npcScheduleEngine.getAppearanceDescription(npcId, state.portraitVariant);

    const payload = buildContainerV2({
      accentColorHex: survivalUI.getColor("emerald"),
      authorName: lang === "id" ? "NPC Schedule" : "NPC Schedule",
      title: `${ui.getEmoji("clock", "🕐")} ${lang === "id" ? "Jadwal Aktivitas NPC" : "NPC Activity Schedule"}`,
      description:
        lang === "id"
          ? `**Jam In-Game:** ${hour}:00\n**Lokasi:** ${state.location}\n**Aktivitas:** ${state.activity}\n**Status:** ${state.isAvailable ? "Tersedia" : "Tidak Tersedia"}${appearanceDesc ? `\n**Penampilan:** ${appearanceDesc}` : ""}`
          : `**In-Game Hour:** ${hour}:00\n**Location:** ${state.location}\n**Activity:** ${state.activity}\n**Status:** ${state.isAvailable ? "Available" : "Unavailable"}${appearanceDesc ? `\n**Appearance:** ${appearanceDesc}` : ""}`,
      buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
      footerText: ui.getFooter("survival"),
    });

    return await interaction.editReply(payload);
  }

  const locations = ["town_square", "market", "cafe", "farm", "clinic", "school", "smithy"];
  const availableNpcs = [];

  for (const loc of locations) {
    const npcs = npcScheduleEngine.getAvailableNpcsAtLocation(loc, hour);
    availableNpcs.push(...npcs);
  }

  if (availableNpcs.length === 0) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: `${ui.getEmoji("hmph", "❌")} ${lang === "id" ? "Tidak Ada NPC" : "No NPCs Available"}`,
        description:
          lang === "id"
            ? `Tidak ada NPC yang tersedia pada jam ${hour}:00. Coba cek lagi di waktu lain.`
            : `No NPCs available at hour ${hour}:00. Try checking again at a different time.`,
        buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const lines = availableNpcs.slice(0, 10).map((npc) => {
    return `• **${npc.name}** (${npc.title})\n  📍 ${npc.currentState.location} - ${npc.currentState.activity}`;
  });

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: lang === "id" ? "NPC Schedule" : "NPC Schedule",
    title: `${ui.getEmoji("clock", "🕐")} ${lang === "id" ? "NPC Tersedia Saat Ini" : "Currently Available NPCs"}`,
    description: `${lang === "id" ? `**Jam In-Game:** ${hour}:00\n\n` : `**In-Game Hour:** ${hour}:00\n\n`}${lines.join("\n\n")}`,
    buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
    footerText: ui.getFooter("survival"),
  });

  return await interaction.editReply(payload);
}

/**
 * Handle user's story progress report
 */
async function handleProgress(interaction, userId, lang) {
  const progress = await storyEngine.getUserStoryProgress(userId);

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: lang === "id" ? "Story Progress" : "Story Progress",
    title: `${ui.getEmoji("chart", "📊")} ${lang === "id" ? "Progres Story Mode" : "Story Mode Progress"}`,
    iconURL: interaction.user.displayAvatarURL(),
    fields: [
      {
        name: lang === "id" ? "Chapter Saat Ini" : "Current Chapter",
        value: progress.currentChapter || "Prologue",
      },
      {
        name: lang === "id" ? "Scene Saat Ini" : "Current Scene",
        value: progress.currentScene || "Start",
      },
      {
        name: lang === "id" ? "Scenes Selesai" : "Completed Scenes",
        value: `${progress.completedScenes.length}`,
      },
      {
        name: lang === "id" ? "Backstories Terbuka" : "Unlocked Backstories",
        value: `${progress.unlockedBackstories.length}`,
      },
      {
        name: lang === "id" ? "Story Flags" : "Story Flags",
        value:
          Object.keys(progress.flags).length > 0
            ? Object.entries(progress.flags)
                .slice(0, 5)
                .map(([k, v]) => `• ${k}: ${v}`)
                .join("\n")
            : lang === "id"
              ? "Belum ada"
              : "None",
      },
    ],
    buttonsRow: [survivalUI.buildSurvivalActionRow('town', userId)],
    footerText: ui.getFooter("survival"),
  });

  return await interaction.editReply(payload);
}
