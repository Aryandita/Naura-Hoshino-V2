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

let Aki;
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("akinator")
    .setDescription(
      "🧞‍♂️ Akinator akan mencoba menebak karakter yang sedang kamu pikirkan!",
    ),

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
          "❌ Fitur Akinator saat ini sedang tidak tersedia karena masalah modul server.",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(errPayload);
    }

    try {
      const aki = new AkiModule({ region: "id" }); // Indonesian region
      await aki.start();

      const {
        buildContainerV2,
      } = require("../../src/utils/NauraContainerBuilder");

      const createPayload = () => {
        return buildContainerV2({
          accentColorHex: "#f1c40f",
          authorName: "Akinator Genies",
          title: `Pertanyaan ${aki.currentStep + 1} (Progress: ${Math.round(aki.progress)}%)`,
          iconURL:
            "https://en.akinator.com/bundles/elokencesite/images/akinator.png",
          description: `### 🧞‍♂️ **${aki.question}**`,
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
                .setLabel("« Kembali")
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
          footerText: ui.getFooter("core"),
        });
      };

      const message = await interaction.editReply(createPayload());

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000,
      }); // 5 min timeout

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content:
              "❌ Ini bukan game-mu! Ketik `/akinator` untuk main sendiri.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const action = i.customId.replace("aki_", "");

        if (action === "back") {
          if (aki.currentStep > 0) await aki.back();
        } else {
          await aki.step(parseInt(action));
        }

        if (aki.progress >= 80 || aki.currentStep >= 79) {
          await aki.win();
          const guess = aki.answers[0];

          if (guess) {
            const winPayload = buildContainerV2({
              accentColorHex: "#2ecc71",
              authorName: "Akinator Genies",
              title: "🧞‍♂️ Apakah ini karakter yang kamu pikirkan?",
              description: `### **${guess.name}**\n*${guess.description}*\n\n> 🏆 Ranking: **#${guess.ranking}**`,
              footerText: ui.getFooter("core"),
            });

            await i.update(winPayload);
            collector.stop("won");
          } else {
            await i.update({
              content: "🧞‍♂️ Aku menyerah! Aku tidak bisa menebak karaktermu.",
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
              content: "⏰ Waktu habis! Game Akinator dihentikan.",
              embeds: [],
              components: [],
            })
            .catch(() => {});
        }
      });
    } catch (error) {
      logger.error("[Akinator Error]", error);
      await interaction.editReply(
        "❌ Gagal memulai Akinator. Coba beberapa saat lagi.",
      );
    }
  },
};
