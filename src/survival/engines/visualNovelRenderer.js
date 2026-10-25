"use strict";

const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const { createManagedCollector } = require("../../utils/interactionPipeline");
const ui = require("../../config/ui");
const path = require("path");
const fs = require("fs");

/**
 * Visual Novel Renderer untuk Survival Story Mode
 * Mengintegrasikan Canvas rendering dengan Discord Components V2
 */
class VisualNovelRenderer {
  constructor() {
    this.canvasWorkerPool = null;
  }

  getCanvasPool() {
    if (!this.canvasWorkerPool) {
      this.canvasWorkerPool = require("../../canvas/canvasWorkerPool");
    }
    return this.canvasWorkerPool;
  }

  /**
   * Render VN scene dengan karakter, background, dan dialog
   */
  async renderScene(sceneData, options = {}) {
    const {
      characterId,
      characterEmotion = "neutral",
      backgroundId,
      speakerName,
      dialogText,
      dialog,
      choices = [],
      showNameBox = true,
      accentColor = "#FFB6C1",
    } = sceneData;

    const files = [];
    let portraitAttachment = null;
    let bgAttachment = null;
    let portraitFileName = null;
    let bgFileName = null;

    // Load character portrait
    if (characterId) {
      const portraitPath = this.getCharacterPortrait(characterId, characterEmotion);
      if (portraitPath && fs.existsSync(portraitPath)) {
        portraitFileName = `vn_char_${characterId}_${characterEmotion}${path.extname(portraitPath)}`;
        portraitAttachment = new AttachmentBuilder(portraitPath, { name: portraitFileName });
        files.push(portraitAttachment);
      }
    }

    // Load background
    if (backgroundId) {
      const bgPath = this.getBackground(backgroundId);
      if (bgPath && fs.existsSync(bgPath)) {
        bgFileName = `vn_bg_${backgroundId}${path.extname(bgPath)}`;
        bgAttachment = new AttachmentBuilder(bgPath, { name: bgFileName });
        files.push(bgAttachment);
      }
    }

    // Build dialog text with formatting
    const formattedDialog = this.formatDialog(dialogText, speakerName, showNameBox, dialog);

    // Build choice buttons jika ada
    let buttonsRow = null;
    if (choices.length > 0) {
      buttonsRow = new ActionRowBuilder();
      const prefix = options.customIdPrefix || "vn_choice";
      choices.forEach((choice, index) => {
        const labelText = typeof choice === "string" ? choice : (choice.label || choice.text || `Pilihan ${index + 1}`);
        buttonsRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`${prefix}_${index}`)
            .setLabel(labelText.substring(0, 80))
            .setStyle(choice.style || ButtonStyle.Primary),
        );
      });
    }

    // Build container payload
    const payload = buildContainerV2({
      accentColorHex: accentColor,
      authorName: speakerName || "Narrator",
      title: sceneData.title || "Story Mode",
      description: formattedDialog,
      bannerAttachmentName: bgFileName || undefined,
      iconURL: portraitFileName ? `attachment://${portraitFileName}` : undefined,
      files,
      buttonsRow: buttonsRow ? [buttonsRow] : undefined,
      footerText: ui.getFooter("survival"),
    });

    return payload;
  }

  /**
   * Format dialog text dengan styling
   */
  formatDialog(text, speakerName, showNameBox, dialogArray) {
    if (Array.isArray(dialogArray) && dialogArray.length > 0) {
      return dialogArray.map((d) => {
        if (!d.speaker || d.speaker === "Narrator") {
          return `*${d.text}*`;
        }
        return `**${d.speaker}:** "${d.text}"`;
      }).join("\n\n");
    }

    if (!showNameBox || !speakerName) {
      return `> ${text || ""}`;
    }

    return `**${speakerName}:**\n> ${text || ""}`;
  }

  /**
   * Get character portrait path berdasarkan emotion
   */
  getCharacterPortrait(characterId, emotion = "neutral") {
    const dirs = [
      path.join(process.cwd(), "assets", "survival", "roam", "npcs"),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "roam", "npcs"),
      path.join(process.cwd(), "assets", "survival", "vn", "characters"),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "vn", "characters"),
      path.join(process.cwd(), "assets", "survival", "characters"),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "characters"),
    ];

    const candidates = [];

    // Format: characterId/emotion.png
    for (const dir of dirs) {
      candidates.push(path.join(dir, characterId, `${emotion}.png`));
      candidates.push(path.join(dir, characterId, `${emotion}.webp`));
    }

    // Format: characterId_emotion.png
    for (const dir of dirs) {
      candidates.push(path.join(dir, `${characterId}_${emotion}.png`));
      candidates.push(path.join(dir, `${characterId}_${emotion}.webp`));
    }

    // Fallback to neutral/default
    for (const dir of dirs) {
      candidates.push(path.join(dir, characterId, "neutral.png"));
      candidates.push(path.join(dir, characterId, "default.png"));
      candidates.push(path.join(dir, `${characterId}_neutral.png`));
      candidates.push(path.join(dir, `${characterId}.png`));
      candidates.push(path.join(dir, `${characterId}.webp`));
    }

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch (e) {
        // Continue searching
      }
    }

    return null;
  }

  /**
   * Get background path
   */
  getBackground(backgroundId) {
    const dirs = [
      path.join(process.cwd(), "assets", "survival", "roam", "backgrounds"),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "roam", "backgrounds"),
      path.join(process.cwd(), "assets", "survival", "vn", "backgrounds"),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "vn", "backgrounds"),
      path.join(process.cwd(), "assets", "survival", "background"),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "background"),
    ];

    const extensions = [".png", ".webp", ".jpeg", ".jpg"];

    for (const dir of dirs) {
      for (const ext of extensions) {
        const candidate = path.join(dir, `${backgroundId}${ext}`);
        try {
          if (fs.existsSync(candidate)) return candidate;
        } catch (e) {
          // Continue
        }
      }
    }

    return null;
  }

  /**
   * Create interactive VN message dengan managed collector
   */
  async sendInteractiveScene(interaction, sceneData, onChoice) {
    const payload = await this.renderScene(sceneData);
    const message = await interaction.editReply(payload);

    if (sceneData.choices && sceneData.choices.length > 0) {
      createManagedCollector(message, interaction.user, {
        time: 300000,
        componentType: ComponentType.Button,
        denyMessage: "Ini bukan sesi story mode kamu.",
        onCollect: async (i) => {
          const choiceIndex = parseInt(i.customId.split("_").pop(), 10);
          const choice = sceneData.choices[choiceIndex];

          if (choice && typeof onChoice === "function") {
            await i.deferUpdate().catch(() => {});
            await onChoice(i, choice, choiceIndex);
          }
        },
      });
    }

    return message;
  }
}

module.exports = new VisualNovelRenderer();
