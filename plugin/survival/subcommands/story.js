"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const fs = require("fs");

const UserSurvival = require("../../../src/models/UserSurvival");
const StoryProgress = require("../../../src/models/StoryProgress");
const cacheManager = require("../../../src/managers/cacheManager");
const storyData = require("../../../src/survival/data/storyData");
const ui = require("../../../src/config/ui");
const leveling = require("../../../src/survival/engines/survivalLeveling");
const currency = require("../../../src/survival/engines/currency");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const {
  safeParseInventory,
} = require("../../../src/survival/engines/inventoryHelper");

const COLLECTOR_MS = 300000;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function fill(text, username) {
  return String(text || "").replace(/{player}/g, username);
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;

    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });
    const profile = await cacheManager.getUserProfile(user.id);
    const [storyProgress] = await StoryProgress.findOrCreate({
      where: { userId: user.id },
    });

    const currentArcId = storyProgress.currentArc;
    if (currentArcId === -1)
      return ui.sendError(interaction, "err_sys_60", true);

    const arc = storyData.find((a) => a.arc === currentArcId);
    if (!arc) return ui.sendError(interaction, "err_sys_61", true);

    if ((survival.survival_level || 1) < arc.reqLevel) {
      return ui.sendError(
        interaction,
        [
          `Ceritanya belum bisa dibuka, sayang. Arc **${arc.arcName}** butuh **Level ${arc.reqLevel}**.`,
          `Levelmu sekarang **${survival.survival_level || 1}**. Ayo naik level dulu, Naura temani!`,
        ].join("\n"),
        true,
      );
    }

    const chapter = arc.chapters.find(
      (c) => c.chapter === storyProgress.currentChapter,
    );
    if (!chapter) return ui.sendError(interaction, "err_sys_62", true);

    let dialogueIndex = 0;

    const buildFrame = () => {
      const isLast = dialogueIndex >= chapter.dialogue.length - 1;
      const line = chapter.dialogue[dialogueIndex];

      const bgPath =
        typeof ui.getSurvivalBackground === "function"
          ? ui.getSurvivalBackground(chapter.background, 12)
          : null;

      const files = [];
      let bannerAttachmentName;

      if (bgPath && fs.existsSync(bgPath)) {
        bannerAttachmentName = "story.png";
        files.push(
          new AttachmentBuilder(bgPath, { name: bannerAttachmentName }),
        );
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Story",
        title: `${e("read", "\uD83D\uDCD6")} Arc ${arc.arc}: ${arc.arcName} \u2014 Bab ${chapter.chapter}`,
        iconURL: user.displayAvatarURL(),
        expression: "info",
        description: [
          `*${fill(chapter.narrative, user.username)}*`,
          "",
          `**${fill(line.speaker, user.username)}**`,
          `"${fill(line.text, user.username)}"`,
        ].join("\n"),
        bannerAttachmentName,
        files,
        footerText: ui.getFooter("survival"),
      });

      const row = new ActionRowBuilder();

      if (!isLast) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("story_next")
            .setLabel("Selanjutnya")
            .setStyle(ButtonStyle.Primary),
        );
      } else if (chapter.challenge) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("story_challenge")
            .setLabel(chapter.challenge.btnLabel || "Hadapi tantangan")
            .setStyle(ButtonStyle.Danger),
        );
      } else {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("story_finish")
            .setLabel("Selesaikan bab ini")
            .setStyle(ButtonStyle.Success),
        );
      }

      return {
        ...payload,
        embeds: [],
        components: [...payload.components, row],
      };
    };

    const message = await interaction.editReply(buildFrame());

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate().catch(() => {});

      if (i.customId === "story_next") {
        dialogueIndex += 1;
        return i.editReply(buildFrame()).catch(() => {});
      }

      if (i.customId !== "story_finish" && i.customId !== "story_challenge")
        return;

      const inventory = safeParseInventory(profile.inventory);

      if (i.customId === "story_challenge") {
        const challenge = chapter.challenge || {};
        let passed = false;

        if (challenge.type === "item") {
          const item = inventory.find(
            (inv) => inv && inv.id === challenge.reqId,
          );
          if (item && (item.amount || 1) >= challenge.reqAmount) {
            item.amount = (item.amount || 1) - challenge.reqAmount;
            if (item.amount <= 0) inventory.splice(inventory.indexOf(item), 1);
            await cacheManager.updateUserProfile(user.id, { inventory });
            passed = true;
          }
        } else if (challenge.type === "coin") {
          // Kode lama membaca `profile.wallet` yang tidak ada di model,
          // sehingga tantangan berbayar selalu dianggap gagal.
          const paid = await currency.charge(
            currency.COIN,
            { survival, profile },
            challenge.reqAmount,
          );
          passed = paid !== null;
        }

        if (!passed) {
          const failPayload = buildContainerV2({
            accentColorHex: ui.getColor("error") || "#ef4444",
            authorName: "Naura Story",
            title: `${e("shy", "\uD83D\uDE45")} Syaratnya belum terpenuhi`,
            iconURL: user.displayAvatarURL(),
            expression: "fail",
            description: fill(
              challenge.failMsg ||
                "Persiapanmu belum cukup untuk bagian ini. Kumpulkan dulu ya, Naura tunggu di sini.",
              user.username,
            ),
            footerText: ui.getFooter("survival"),
          });

          return i
            .followUp({
              ...failPayload,
              flags: (failPayload.flags || 0) | MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      }

      collector.stop("finished");

      const reward = chapter.reward || {};
      const rewardLines = [];

      if (reward.exp) {
        await leveling.addPlayerXP(user.id, reward.exp);
        rewardLines.push(
          `> ${e("impressed", "\uD83C\uDF1F")} **+${reward.exp} XP**`,
        );
      }

      if (reward.item) {
        const bag = safeParseInventory(
          (await cacheManager.getUserProfile(user.id)).inventory,
        );
        const amount = reward.amount || 1;
        const exist = bag.find((inv) => inv && inv.id === reward.item);

        if (exist) exist.amount = (exist.amount || 1) + amount;
        else
          bag.push({
            id: reward.item,
            name: reward.item,
            amount,
            type: "loot",
          });

        await cacheManager.updateUserProfile(user.id, { inventory: bag });
        rewardLines.push(
          `> ${e("cheers", "\uD83D\uDCE6")} **${amount}x ${reward.item}**`,
        );
      }

      storyProgress.currentArc = chapter.nextArc;
      storyProgress.currentChapter = chapter.nextChapter;
      await storyProgress.save();

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        authorName: "Naura Story",
        title: `${e("cheers", "\uD83C\uDF89")} Babnya selesai!`,
        iconURL: user.displayAvatarURL(),
        expression: "achievement",
        description: [
          `Kamu menuntaskan **${chapter.title}**. Naura ikut terharu membacanya bareng kamu.`,
          "",
          rewardLines.length > 0
            ? "**Hadiahmu**"
            : "Bab ini belum berhadiah, tapi ceritanya makin seru!",
          ...rewardLines,
          "",
          "Lanjut lagi kapan pun kamu siap ya, Naura simpan progresnya.",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      // Pesan Components V2 tidak boleh dikosongkan komponennya, jadi
      // kartunya diganti utuh tanpa baris tombol.
      await i.editReply({ ...successPayload, embeds: [] }).catch(() => {});
    });
  },
};
