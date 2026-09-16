"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const path = require("path");
const fs = require("fs");

const UserSurvival = require("../../../src/models/UserSurvival");
const StoryProgress = require("../../../src/models/StoryProgress");
const cacheManager = require("../../../src/managers/cacheManager");
const storyData = require("../../../src/survival/data/storyData");
const npcs = require("../../../src/survival/data/npcs");
const ui = require("../../../src/config/ui");
const leveling = require("../../../src/survival/engines/survivalLeveling");
const currency = require("../../../src/survival/engines/currency");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const {
  takeItemsAtomic,
  addItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");

const COLLECTOR_MS = 300000;
const CHARACTER_DIR = path.join(process.cwd(), "assets", "survival", "characters");

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function fill(text, username) {
  return String(text || "").replace(/{player}/g, username);
}

function findNpcPortrait(npcId) {
  if (!npcId) return null;
  const npc = npcs[npcId];
  const candidates = [];
  if (npc?.image) candidates.push(npc.image);
  candidates.push(`${npcId}.png`, `${npcId}.jpeg`, `${npcId}.jpg`);

  for (const name of candidates) {
    const full = path.join(CHARACTER_DIR, name);
    if (fs.existsSync(full)) return { full, name };
  }
  return null;
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
    if (currentArcId === -1) {
      return ui.sendError(
        interaction,
        "✨ Selamat! Kamu telah menuntaskan seluruh 4-Act Saga Naura Wilds: Resonansi Inti Astral!",
        true,
      );
    }

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

      // NPC Avatar icon di pojok bila berbicara dengan NPC tertentu
      const iconURL = user.displayAvatarURL();
      const speakerPortrait = findNpcPortrait(chapter.speakerNpcId);
      if (speakerPortrait && line.speaker !== user.username && line.speaker !== "{player}") {
        // Bisa disematkan bila dibutuhkan
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: `Naura Wilds Saga - Arc ${arc.arc}: ${arc.arcName}`,
        title: `${e("read", "📖")} Bab ${chapter.chapter}: ${chapter.title}`,
        iconURL,
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

      if (i.customId !== "story_finish" && i.customId !== "story_challenge") {
        return;
      }

      if (i.customId === "story_challenge") {
        const challenge = chapter.challenge || {};
        let passed = false;

        if (challenge.type === "item") {
          const taken = await takeItemsAtomic(user.id, [
            { id: challenge.reqId, amount: challenge.reqAmount || 1 },
          ]);
          passed = taken.ok;
        } else if (challenge.type === "coin") {
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
            title: `${e("shy", "🙅")} Syaratnya belum terpenuhi`,
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
          `> ${e("impressed", "🌟")} **+${reward.exp} XP**`,
        );
      }

      if (reward.item) {
        const amount = reward.amount || 1;
        await addItemsAtomic(user.id, [
          {
            id: reward.item,
            name: reward.item,
            amount,
            type: "loot",
          },
        ]);
        rewardLines.push(
          `> ${e("cheers", "📦")} **${amount}x ${reward.item}**`,
        );
      }

      if (reward.starFragments) {
        await cacheManager.incrementUserSurvival(user.id, {
          starFragments: reward.starFragments,
        });
        rewardLines.push(
          `> ⭐ **+${reward.starFragments.toLocaleString("id-ID")} Naura Star Fragments**`,
        );
      }

      if (reward.nauraCoins) {
        await cacheManager.incrementUserProfile(user.id, {
          economy_wallet: reward.nauraCoins,
        });
        rewardLines.push(
          `> 🪙 **+${reward.nauraCoins.toLocaleString("id-ID")} Naura Coins**`,
        );
      }

      if (reward.coupons) {
        await cacheManager.incrementUserSurvival(user.id, {
          coupons: reward.coupons,
        });
        rewardLines.push(
          `> 🎟️ **+${reward.coupons} Naura Coupons**`,
        );
      }

      storyProgress.currentArc = chapter.nextArc;
      storyProgress.currentChapter = chapter.nextChapter;
      await storyProgress.save({ fields: ["currentArc", "currentChapter"] });

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        authorName: "Naura Story",
        title: `${e("cheers", "🎉")} Bab Selesai!`,
        iconURL: user.displayAvatarURL(),
        expression: "achievement",
        description: [
          `Kamu menuntaskan **${chapter.title}**. Naura ikut terharu membacanya bareng kamu.`,
          "",
          rewardLines.length > 0
            ? "**Hadiahmu:**"
            : "Bab ini belum berhadiah, tapi ceritanya makin seru!",
          ...rewardLines,
          "",
          "Lanjut lagi kapan pun kamu siap ya, Naura simpan progresnya.",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      await i.editReply({ ...successPayload, embeds: [] }).catch(() => {});
    });
  },
};
