"use strict";

const path = require("path");
const fs = require("fs");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

/**
 * Story Engine untuk Visual Novel Survival
 * Mengelola progres cerita, branch choices, dan unlock conditions
 */
class StoryEngine {
  constructor() {
    this.storyChapters = new Map();
    this.loadStoryData();
  }

  loadStoryData() {
    const storyDir = path.join(__dirname, "../data/story");
    if (fs.existsSync(storyDir)) {
      const files = fs.readdirSync(storyDir).filter((f) => f.endsWith(".js"));
      for (const file of files) {
        try {
          const chapter = require(path.join(storyDir, file));
          if (chapter && chapter.chapterId) {
            this.storyChapters.set(chapter.chapterId, chapter);
          }
        } catch (err) {
          logger.error(`[StoryEngine] Gagal memuat chapter ${file}: ${err.message}`);
        }
      }
    }
  }

  getChapter(chapterId = "prologue") {
    return this.storyChapters.get(chapterId) || null;
  }

  getScene(chapterId = "prologue", sceneId = "start") {
    const chapter = this.getChapter(chapterId);
    if (!chapter || !chapter.scenes) return null;
    return chapter.scenes[sceneId] || null;
  }

  /**
   * Dapatkan progres cerita user
   */
  async getUserStoryProgress(userId) {
    const survival = await cacheManager.getUserSurvival(userId);
    if (survival && survival.storyProgress) {
      let sp = survival.storyProgress;
      if (typeof sp === "string") {
        try {
          sp = JSON.parse(sp);
        } catch (_) {
          sp = null;
        }
      }
      if (sp && typeof sp === "object") {
        return {
          currentChapter: sp.currentChapter || "prologue",
          currentScene: sp.currentScene || "start",
          completedScenes: Array.isArray(sp.completedScenes) ? sp.completedScenes : [],
          unlockedBackstories: Array.isArray(sp.unlockedBackstories) ? sp.unlockedBackstories : [],
          choices: sp.choices || {},
          flags: sp.flags || {},
        };
      }
    }

    // Fallback ke model StoryProgress jika ada di database
    try {
      const StoryProgress = require("../../models/StoryProgress");
      const record = await StoryProgress.findOne({ where: { userId } });
      if (record) {
        return {
          currentChapter: record.currentChapter ? `chapter_${record.currentChapter}` : "prologue",
          currentScene: "start",
          completedScenes: Array.isArray(record.completedScenes) ? record.completedScenes : [],
          unlockedBackstories: Array.isArray(record.unlockedBackstories) ? record.unlockedBackstories : [],
          choices: record.choices || {},
          flags: record.flags || {},
        };
      }
    } catch (e) {
      logger.debug("[StoryEngine] Fallback query StoryProgress: " + (e?.message || e));
    }

    return {
      currentChapter: "prologue",
      currentScene: "start",
      completedScenes: [],
      unlockedBackstories: [],
      choices: {},
      flags: {},
    };
  }

  /**
   * Update progres cerita
   */
  async updateUserStoryProgress(userId, updates) {
    const progress = await this.getUserStoryProgress(userId);
    const newProgress = { ...progress, ...updates };

    await cacheManager.updateUserSurvival(userId, {
      storyProgress: newProgress,
    });

    // Sinkronisasi ke model StoryProgress
    try {
      const StoryProgress = require("../../models/StoryProgress");
      await StoryProgress.upsert({
        userId,
        currentArc: 1,
        currentChapter: typeof newProgress.currentChapter === "number" ? newProgress.currentChapter : 1,
        completedScenes: newProgress.completedScenes,
        flags: newProgress.flags,
        choices: newProgress.choices,
        unlockedBackstories: newProgress.unlockedBackstories,
      });
    } catch (err) {
      logger.debug("[StoryEngine] Sinkronisasi StoryProgress database: " + (err?.message || err));
    }

    return newProgress;
  }

  /**
   * Cek apakah scene sudah selesai
   */
  isSceneCompleted(progress, sceneId) {
    return progress.completedScenes.includes(sceneId);
  }

  /**
   * Tandai scene sebagai selesai
   */
  async markSceneCompleted(userId, sceneId) {
    const progress = await this.getUserStoryProgress(userId);
    if (!progress.completedScenes.includes(sceneId)) {
      progress.completedScenes.push(sceneId);
      await this.updateUserStoryProgress(userId, {
        completedScenes: progress.completedScenes,
      });
    }
  }

  /**
   * Set story flag untuk conditional branching
   */
  async setStoryFlag(userId, flagName, value) {
    const progress = await this.getUserStoryProgress(userId);
    progress.flags[flagName] = value;
    await this.updateUserStoryProgress(userId, { flags: progress.flags });
  }

  /**
   * Get story flag value
   */
  async getStoryFlag(userId, flagName) {
    const progress = await this.getUserStoryProgress(userId);
    return progress.flags[flagName];
  }

  /**
   * Record user choice untuk branching
   */
  async recordChoice(userId, choicePointId, choiceValue) {
    const progress = await this.getUserStoryProgress(userId);
    progress.choices[choicePointId] = choiceValue;
    await this.updateUserStoryProgress(userId, { choices: progress.choices });
  }

  /**
   * Eksekusi pilihan user pada scene tertentu dan transisi ke nextScene
   */
  async makeChoice(userId, chapterId, sceneId, choiceIndex) {
    const scene = this.getScene(chapterId, sceneId);
    if (!scene || !Array.isArray(scene.choices) || !scene.choices[choiceIndex]) {
      return { success: false, error: "Pilihan tidak valid." };
    }

    const choice = scene.choices[choiceIndex];
    await this.recordChoice(userId, `${chapterId}_${sceneId}`, choice.label || choice.value);
    await this.markSceneCompleted(userId, sceneId);

    // Apply effects (afeksi NPC, dsb)
    if (choice.effects) {
      for (const [key, val] of Object.entries(choice.effects)) {
        if (key.startsWith("affection_")) {
          const npcId = key.replace("affection_", "");
          try {
            const UserNPC = require("../../models/UserNPC");
            const [npcData] = await UserNPC.findOrCreate({
              where: { userId, npcId },
              defaults: { affection: 0, relationshipLevel: 0 },
            });
            npcData.affection = Math.min(100, Math.max(0, (npcData.affection || 0) + val));
            await npcData.save({ fields: ["affection"] });
          } catch (e) {
            logger.debug("[StoryEngine] Gagal update afeksi dari choice: " + e.message);
          }
        }
      }
    }

    const nextSceneId = choice.nextScene || null;
    if (nextSceneId) {
      await this.updateUserStoryProgress(userId, {
        currentChapter: chapterId,
        currentScene: nextSceneId,
      });
    }

    return {
      success: true,
      choice,
      nextSceneId,
      nextScene: nextSceneId ? this.getScene(chapterId, nextSceneId) : null,
    };
  }

  /**
   * Check unlock condition untuk backstory
   */
  async checkBackstoryUnlock(userId, npcId, requiredLevel) {
    const UserNPC = require("../../models/UserNPC");
    const npcData = await UserNPC.findOne({
      where: { userId, npcId },
    });

    if (!npcData) return false;
    if (npcData.relationshipLevel < requiredLevel) return false;

    const progress = await this.getUserStoryProgress(userId);
    return !progress.unlockedBackstories.includes(npcId);
  }

  /**
   * Unlock backstory NPC
   */
  async unlockBackstory(userId, npcId) {
    const progress = await this.getUserStoryProgress(userId);
    if (!progress.unlockedBackstories.includes(npcId)) {
      progress.unlockedBackstories.push(npcId);
      await this.updateUserStoryProgress(userId, {
        unlockedBackstories: progress.unlockedBackstories,
      });
      return true;
    }
    return false;
  }

  /**
   * Generate mini quest/story trigger saat channel sepi (from pending_plugin/dreamWeaverStoryteller)
   * @param {string} guildId
   * @param {object} contextData - { lastMessageAgeMs, activePlayers, timeOfDay }
   * @returns {{ shouldTrigger: boolean, storyHook: object|null, promptPrepared: string }}
   */
  generateIdleStoryTrigger(guildId, contextData = {}) {
    try {
      const lastMessageAgeMs = contextData.lastMessageAgeMs || 0;
      const idleThresholdMs = 300000;

      if (lastMessageAgeMs < idleThresholdMs) {
        return { shouldTrigger: false, storyHook: null, promptPrepared: "" };
      }

      const timeOfDay = contextData.timeOfDay || "night";
      const hooks = [
        { title: "Suara Misterius di Kegelapan", type: "mystery", location: "Hutan Mistis" },
        { title: "Pedagang Langka Muncul", type: "encounter", location: "Desa Sukamaju" },
        { title: "Cahaya Aneh dari Reruntuhan", type: "exploration", location: "Kuil Kuno" },
        { title: "NPC Meminta Bantuan Darurat", type: "rescue", location: "Tambang Kristal" },
      ];

      const selectedHook = hooks[Math.floor(Math.random() * hooks.length)];

      let promptTemplate = `Buat narasi pembuka quest mini RPG untuk channel Discord yang sedang sepi.\n`;
      promptTemplate += `Waktu: ${timeOfDay}. Lokasi: ${selectedHook.location}.\n`;
      promptTemplate += `Tipe event: ${selectedHook.type}. Judul: "${selectedHook.title}".\n`;
      promptTemplate += `Buat 2-3 kalimat hook menarik dalam bahasa Indonesia untuk memancing interaksi pemain.`;

      return {
        shouldTrigger: true,
        storyHook: selectedHook,
        promptPrepared: promptTemplate,
        simulatedNarrative: `*Di kejauhan, terdengar suara aneh dari arah ${selectedHook.location}... Apakah ada petualang yang berani menyelidiki?*`,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error("[StoryEngine:IdleTrigger] Error:", error);
      return { shouldTrigger: false, storyHook: null, promptPrepared: "" };
    }
  }
}

module.exports = new StoryEngine();
