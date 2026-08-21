"use strict";

// Battle Arena antar pemain. Perhitungan tempur ada di plugin/survival/duelEngine.js.
//
// Versi lama command ini mati total: `inviteRow` dan `row` dipakai tanpa pernah
// dibuat, jadi setiap tantangan langsung gagal. Semua tombol sekarang dibuat
// eksplisit, taruhan lewat helper mata uang, dan gambarnya opsional.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { logger } = require("../../../src/managers/logger");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const currencyHelper = require("../../../src/survival/engines/currency");
const engine = require("../../../src/survival/engines/duelEngine");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");

const INVITE_MS = 30000;
const BATTLE_MS = 240000;
const COIN = currencyHelper.byKind(currencyHelper.COIN);

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

function isRegistered(profile) {
  return safeParseInventory(profile.inventory).some(
    (it) => it && it.id === "survival_started",
  );
}

/** Gambar arena bersifat pemanis, jadi kegagalannya tidak boleh mematikan duel. */
async function arenaImage(p1, p2, log) {
  try {
    const { drawDuel } = require("../../../src/canvas/duelCanvas");
    const buffer = await drawDuel(p1, p2, log);
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: "duel.png" });
  } catch (err) {
    logger.warn("[DUEL CANVAS]", err.message);
    return null;
  }
}

module.exports = {
  async execute(interaction) {
    const challenger = interaction.user;
    const opponent = interaction.options.getUser("lawan");
    const wager = interaction.options.getInteger("taruhan") || 0;
    const isRanked = interaction.options.getBoolean("ranked") || false;

    if (opponent.bot)
      return ui.sendError(
        interaction,
        "Bot tidak bisa diajak duel, nanti Naura yang repot~",
        true,
      );
    if (opponent.id === challenger.id)
      return ui.sendError(
        interaction,
        "Kamu tidak bisa menantang dirimu sendiri, lho!",
        true,
      );

    const p1Profile = await cacheManager.getUserProfile(challenger.id);
    const p2Profile = await cacheManager.getUserProfile(opponent.id);
    const [p1Survival] = await UserSurvival.findOrCreate({
      where: { userId: challenger.id },
    });
    const [p2Survival] = await UserSurvival.findOrCreate({
      where: { userId: opponent.id },
    });

    if (!isRegistered(p1Profile))
      return ui.sendError(
        interaction,
        "Kamu belum memulai petualangan. Pakai `/survival start` dulu ya!",
        true,
      );
    if (!isRegistered(p2Profile))
      return ui.sendError(
        interaction,
        `**${opponent.username}** belum terdaftar di dunia Naura. Minta dia pakai \`/survival start\` dulu, ya.`,
        true,
      );

    if (p1Survival.hp <= 20 || p1Survival.stamina <= 20)
      return ui.sendError(
        interaction,
        "Badanmu masih lemas. Pulihkan HP dan stamina dulu, Naura khawatir!",
        true,
      );
    if (p2Survival.hp <= 20 || p2Survival.stamina <= 20)
      return ui.sendError(
        interaction,
        `**${opponent.username}** sedang lemas, kasih waktu istirahat dulu ya.`,
        true,
      );

    const p1Holders = { survival: p1Survival, profile: p1Profile };
    const p2Holders = { survival: p2Survival, profile: p2Profile };

    if (wager > 0) {
      if (!currencyHelper.canAfford(COIN, p1Holders, wager)) {
        return ui.sendError(
          interaction,
          `Naura Coin kamu belum cukup untuk bertaruh **${wager.toLocaleString("id-ID")}**.`,
          true,
        );
      }
      if (!currencyHelper.canAfford(COIN, p2Holders, wager)) {
        return ui.sendError(
          interaction,
          `Naura Coin **${opponent.username}** belum cukup untuk mengimbangi taruhanmu.`,
          true,
        );
      }
    }

    const wagerText =
      wager > 0
        ? currencyHelper.format(COIN, wager)
        : "tanpa taruhan, murni gengsi";

    const inviteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("duel_accept")
        .setLabel("Terima tantangan")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("duel_decline")
        .setLabel("Tolak")
        .setStyle(ButtonStyle.Secondary),
    );

    const card = ({ title, description, expression, colorKey, banner }) =>
      buildContainerV2({
        accentColorHex: ui.getColor(colorKey || "primary"),
        authorName: "Naura Battle Arena",
        title,
        expression: expression || "Happy",
        description,
        bannerAttachmentName: banner ? "duel.png" : undefined,
        footerText: ui.getFooter("survival"),
      });

    const invitePayload = card({
      title: `${e("sword")} Ada tantangan duel!`,
      description: [
        `<@${opponent.id}>, kamu ditantang <@${challenger.id}> ke Battle Arena!`,
        "",
        `**Taruhan:** ${wagerText}`,
        `**Mode:** ${isRanked ? `${ui.getEmoji("battle") || "⚔️"} RANKED` : "Kasual"}`,
        "",
        "Naura jadi juri hari ini. Mau terima tantangannya?",
      ].join("\n"),
      expression: "Shocked",
      colorKey: "warning",
    });

    const inviteMessage = await interaction.editReply({
      content: `<@${opponent.id}>`,
      ...invitePayload,
      components: [...invitePayload.components, inviteRow],
    });

    const inviteCollector = inviteMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === opponent.id,
      time: INVITE_MS,
      max: 1,
    });

    inviteCollector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "duel_decline") {
        return interaction.editReply({
          content: null,
          ...card({
            title: `${e("naura_akward")} Tantangan ditolak`,
            description: `<@${opponent.id}> memilih tidak bertarung kali ini. Tidak apa-apa, damai juga bagus~`,
            expression: "Akward",
            colorKey: "warning",
          }),
        });
      }

      // --- Taruhan ditahan dulu oleh Naura ---
      if (wager > 0) {
        const p1Charged = await currencyHelper.charge(COIN, p1Holders, wager);
        const p2Charged =
          p1Charged === null
            ? null
            : await currencyHelper.charge(COIN, p2Holders, wager);

        if (p1Charged === null || p2Charged === null) {
          if (p1Charged !== null)
            await currencyHelper.reward(COIN, p1Holders, wager);
          return interaction.editReply({
            content: null,
            ...card({
              title: `${e("naura_akward")} Duel dibatalkan`,
              description:
                "Salah satu koin taruhan sudah tidak cukup. Naura kembalikan semuanya, tidak ada yang dirugikan.",
              expression: "Akward",
              colorKey: "error",
            }),
          });
        }
      }

      const UserPet = require("../../../src/models/UserPet");
      const p1Pet = await UserPet.findOne({ where: { userId: challenger.id, isActive: true } });
      const p2Pet = await UserPet.findOne({ where: { userId: opponent.id, isActive: true } });

      const p1 = engine.buildFighter(challenger, p1Profile, p1Survival, p1Pet);
      const p2 = engine.buildFighter(opponent, p2Profile, p2Survival, p2Pet);

      const state = {
        turn: 1,
        round: 1,
        log: `Pertarungan dimulai! Giliran ${p1.username} lebih dulu.`,
      };
      let winner = null;
      let loser = null;

      const actionRow = () =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("duel_attack")
            .setLabel("Serang")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("duel_skill")
            .setLabel("Jurus kelas")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("duel_flee")
            .setLabel("Menyerah")
            .setStyle(ButtonStyle.Secondary),
        );

      const renderBattle = async () => {
        const active = state.turn === 1 ? p1 : p2;
        const image = await arenaImage(p1, p2, state.log);
        const payload = card({
          title: `${e("sword")} Battle Arena \u2014 Ronde ${state.round}`,
          description: [
            `${state.log}`,
            "",
            `Sekarang giliran <@${active.id}> (**${active.username}**).`,
            `> ${e("health")} ${p1.username}: **${p1.hp}**/${p1.maxHp} \u2022 ${e("stamina")} ${p1.stamina}`,
            `> ${e("health")} ${p2.username}: **${p2.hp}**/${p2.maxHp} \u2022 ${e("stamina")} ${p2.stamina}`,
          ].join("\n"),
          banner: Boolean(image),
        });

        return {
          content: `<@${p1.id}> vs <@${p2.id}>`,
          ...payload,
          files: image ? [image] : [],
          components: [...payload.components, actionRow()],
        };
      };

      const battleMessage = await interaction.editReply(await renderBattle());
      const battleCollector = battleMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === p1.id || i.user.id === p2.id,
        time: BATTLE_MS,
      });

      battleCollector.on("collect", async (btn) => {
        const active = state.turn === 1 ? p1 : p2;
        const target = state.turn === 1 ? p2 : p1;

        if (btn.customId === "duel_flee") {
          await btn.deferUpdate();
          const quitter = btn.user.id === p1.id ? p1 : p2;
          winner = quitter.id === p1.id ? p2 : p1;
          loser = quitter;
          state.log = `${quitter.username} mengangkat bendera putih dan menyerah.`;
          return battleCollector.stop("flee");
        }

        if (btn.user.id !== active.id) {
          return btn.reply({
            content: `${e("naura_hmph")} Sabar ya, sekarang giliran **${active.username}**!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await btn.deferUpdate();

        let result;
        if (btn.customId === "duel_skill") {
          result = engine.useSkill(active, target);
          if (!result.ok) {
            const reason =
              result.reason === "no_class"
                ? "Kamu belum punya kelas. Pilih dulu lewat `/survival class`, ya!"
                : `Staminamu kurang, jurus ini butuh **${result.needed}** stamina.`;
            return btn.followUp({
              content: `${e("naura_akward")} ${reason}`,
              flags: MessageFlags.Ephemeral,
            });
          }
        } else if (btn.customId === "duel_attack") {
          result = engine.basicAttack(active, target);
        } else {
          return;
        }

        const line = engine.narrate(active, target, result);

        if (target.hp <= 0) {
          winner = active;
          loser = target;
          state.log = `${line}\n${target.username} tumbang!`;
          return battleCollector.stop("ko");
        }

        state.turn = state.turn === 1 ? 2 : 1;
        state.round += 1;
        state.log = `${line}\nSekarang giliran ${target.username}.`;
        await interaction.editReply(await renderBattle()).catch(() => {});
      });

      battleCollector.on("end", async () => {
        try {
          const eloChanges = await engine.settle(p1Survival, p1, p2Survival, p2, isRanked);

          if (!winner) {
            if (wager > 0) {
              await currencyHelper.reward(COIN, p1Holders, wager);
              await currencyHelper.reward(COIN, p2Holders, wager);
            }
            return interaction.editReply({
              content: null,
              ...card({
                title: `${e("naura_sleepy")} Duelnya berhenti di tengah jalan`,
                description:
                  "Tidak ada yang bergerak sampai waktunya habis. Taruhan sudah Naura kembalikan penuh, kok!",
                expression: "Sleepy",
                colorKey: "warning",
              }),
              files: [],
            });
          }

          let prizeText = "Penghormatan seluruh arena";
          if (wager > 0) {
            const winnerHolders = winner.id === p1.id ? p1Holders : p2Holders;
            await currencyHelper.reward(COIN, winnerHolders, wager * 2);
            prizeText = currencyHelper.format(COIN, wager * 2);
          }

          const image = await arenaImage(
            p1,
            p2,
            `${state.log}\nPemenang: ${winner.username}`,
          );
          let eloText = "";
          if (isRanked && eloChanges) {
            const wChange = eloChanges.winner.diff > 0 ? `+${eloChanges.winner.diff}` : eloChanges.winner.diff;
            const lChange = eloChanges.loser.diff > 0 ? `+${eloChanges.loser.diff}` : eloChanges.loser.diff;
            eloText = `\n**MMR Changes:**\n> ${ui.getEmoji("chart") || "📈"} <@${eloChanges.winner.id}>: **${eloChanges.winner.mmr}** (${wChange})\n> ${ui.getEmoji("stock_down") || "📉"} <@${eloChanges.loser.id}>: **${eloChanges.loser.mmr}** (${lChange})\n`;
          }

          const payload = card({
            title: `${e("trophy")} ${winner.username} menang!`,
            description: [
              `${state.log}`,
              "",
              `Selamat ya <@${winner.id}>! Naura ikut bangga lihat kamu bertahan sampai akhir.`,
              `<@${loser.id}> juga hebat, jangan sedih ya~`,
              "",
              `**Hadiah:** ${prizeText}`,
              eloText
            ].join("\n"),
            expression: "Impressed",
            colorKey: "success",
            banner: Boolean(image),
          });

          await interaction.editReply({
            content: `<@${winner.id}>`,
            ...payload,
            files: image ? [image] : [],
          });
        } catch (err) {
          logger.error("[DUEL END]", err);
        }
      });
    });

    inviteCollector.on("end", async (collected) => {
      if (collected.size === 0) {
        await interaction
          .editReply({
            content: null,
            ...card({
              title: `${e("naura_sleepy")} Tidak ada jawaban`,
              description: `<@${opponent.id}> belum membalas tantangannya. Coba tantang lagi nanti ya!`,
              expression: "Sleepy",
              colorKey: "warning",
            }),
          })
          .catch(() => {});
      }
    });
  },
};
