/**
 * @module AkinatorMinigame
 * @description Game Akinator yang mencoba menebak karakter yang dipikirkan pemain.
 * 
 * Fitur:
 * - Integrasi dengan aki-api untuk database karakter
 * - Region Indonesia untuk karakter lokal
 * - Tombol interaktif untuk jawaban (Ya/Tidak/Tidak Tahu/Mungkin)
 * - Deteksi kemenangan saat progress >= 80% atau step >= 79
 * - Fallback handling untuk SSL certificate issues
 * 
 * @example
 * /akinator
 * // Jawab pertanyaan dengan tombol hingga Akinator menebak
 * 
 * @author Naura Hoshino Development Team
 * @version 2.4.0
 */

const fs = require("fs");
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");

// ============================================================================
// AKI-API MODULE LOADER
// ============================================================================

let Aki;

/**
 * Lazy loader untuk aki-api module dengan fallback SSL handling
 * @returns {typeof import("aki-api").Aki | undefined} Aki class atau undefined jika gagal
 */
function getAki() {
  if (Aki) return Aki;
  try {
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = function (pathStr, options) {
      try {
        return originalReadFileSync.apply(this, arguments);
      } catch (err) {
        if (
          err &&
          err.code === "ENOENT" &&
          typeof pathStr === "string" &&
          (pathStr.includes("ca_bundle") || pathStr.endsWith(".pem"))
        ) {
          return "";
        }
        throw err;
      }
    };
    Aki = require("aki-api").Aki;
    fs.readFileSync = originalReadFileSync;
  } catch (e) {
    logger.error("[Akinator Init Error]", e);
  }
  return Aki;
}

const ui = require("../../src/config/ui");

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Timeout collector dalam milidetik (5 menit)
 * @type {number}
 */
const COLLECTOR_TIMEOUT = 300000;

/**
 * Threshold progress untuk menebak karakter
 * @type {number}
 */
const WIN_PROGRESS_THRESHOLD = 80;

/**
 * Maksimal step sebelum force win
 * @type {number}
 */
const MAX_STEPS = 79;

/**
 * Region untuk Akinator API
 * @type {string}
 */
const AKINATOR_REGION = "id";

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  /**
   * Definisi slash command untuk akinator
   * @type {import('discord.js').SlashCommandSubcommandBuilder}
   */
  data: new SlashCommandBuilder()
    .setName("akinator")
    .setDescription(
      "\ud83e\uddde\u200d\u2642\ufe0f Akinator akan mencoba menebak karakter yang sedang kamu pikirkan!",
    ),

  /**
   * Handler eksekusi command akinator
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    await interaction.deferReply();

    const AkiModule = getAki();
    if (!AkiModule) {
      const {
        buildErrorContainerV2,
      } = require("../../src/utils/NauraContainerBuilder");
      const errPayload = buildErrorContainerV2({
        title: "Akinator Offline",
        description:
          "\u274c Fitur Akinator saat ini sedang tidak tersedia karena masalah modul server.",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(errPayload);
    }

    try {
      const aki = new AkiModule({ region: AKINATOR_REGION });
      await aki.start();

      const {
        buildContainerV2,
      } = require("../../src/utils/NauraContainerBuilder");

      /**
       * Membuat payload respons untuk pertanyaan Akinator
       * @returns {Object} Payload Components V2
       */
      const createPayload = () => {
        return buildContainerV2({
          accentColorHex: "#f1c40f",
          authorName: "Akinator Genies",
          title: `Pertanyaan ${aki.currentStep + 1} (Progress: ${Math.round(aki.progress)}%)`,
          iconURL:
            "https://en.akinator.com/bundles/elokencesite/images/akinator.png",
          description: `### \ud83e\uddde\u200d\u2642\ufe0f **${aki.question}**`,
          buttonsRow: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("aki_0")
                .setLabel("Ya")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId("aki_1")
                .setLabel("Tidak")
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId("aki_2")
                .setLabel("Tidak Tahu")
                .setStyle(ButtonStyle.Secondary),
            ),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("aki_3")
                .setLabel("Mungkin Ya")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("aki_4")
                .setLabel("Mungkin Tidak")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("aki_back")
                .setLabel("\u00ab Kembali")
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
          footerText: ui.getFooter("core"),
        });
      };

      const message = await interaction.editReply(createPayload());

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: COLLECTOR_TIMEOUT,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content:
              "\u274c Ini bukan game-mu! Ketik `/akinator` untuk main sendiri.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const action = i.customId.replace("aki_", "");

        if (action === "back") {
          if (aki.currentStep > 0) await aki.back();
        } else {
          await aki.step(parseInt(action));
        }

        if (aki.progress >= WIN_PROGRESS_THRESHOLD || aki.currentStep >= MAX_STEPS) {
          await aki.win();
          const guess = aki.answers[0];

          if (guess) {
            const winPayload = buildContainerV2({
              accentColorHex: "#2ecc71",
              authorName: "Akinator Genies",
              title: "\ud83e\uddde\u200d\u2642\ufe0f Apakah ini karakter yang kamu pikirkan?",
              description: `### **${guess.name}**\n*${guess.description}*\n\n> \ud83c\udfc6 Ranking: **#${guess.ranking}**`,
              footerText: ui.getFooter("core"),
            });

            await i.update(winPayload);
            collector.stop("won");
          } else {
            await i.update({
              content: "\ud83e\uddde\u200d\u2642\ufe0f Aku menyerah! Aku tidak bisa menebak karaktermu.",
              embeds: [],
              components: [],
            });
            collector.stop("lost");
          }
        } else {
          await i.update(createPayload());
        }
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time") {
          interaction
            .editReply({
              content: "\u23f0 Waktu habis! Game Akinator dihentikan.",
              embeds: [],
              components: [],
            })
            .catch(() => {});
        }
      });
    } catch (error) {
      logger.error("[Akinator Error]", error);
      await interaction.editReply(
        "\u274c Gagal memulai Akinator. Coba beberapa saat lagi.",
      );
    }
  },
};