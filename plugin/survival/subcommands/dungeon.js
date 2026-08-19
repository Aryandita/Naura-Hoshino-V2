// Lokasi: plugin/survival/subcommands/dungeon.js
"use strict";

const { MessageFlags } = require("discord.js");
const {
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const diffHelper = require("../../../src/survival/helpers/difficultyHelper");
const currency = require("../../../src/survival/engines/currency");
const combat = require("../../../src/survival/engines/dungeonCombat");
const render = require("../../../src/survival/engines/dungeonRender");
const rewards = require("../../../src/survival/engines/dungeonRewards");
const helpers = require("../../../src/survival/helpers/craftHelpers");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const {
  DUNGEON_PASS_ID,
  DUNGEON_SPECIAL_PASS_ID,
} = require("../../../src/survival/data/items_dungeon");

const COLLECTOR_MS = 90000;
const CHOICE_MS = 60000;
const CAVE_LOCATIONS = ["tambang", "desa", "village"];
const e = helpers.e;

function errorView(message) {
  return buildErrorContainerV2({
    errorMessage: message,
    footerText: ui.getFooter("survival"),
  });
}

function ephemeral(payload) {
  return {
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  };
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });
    const profile = await cacheManager.getUserProfile(user.id);

    const inventory = safeParseInventory(profile.inventory);
    const passes = rewards.availablePasses(inventory);

    if (passes.normal < 1 && passes.special < 1) {
      return interaction.editReply(
        errorView(
          "Pintu batunya terkunci, sayang. Kamu butuh **Dungeon Pass** dulu \u2014 Pak Damar menjualnya di warung desa. " +
            "Kalau mau tantangan dua kali lebih berat dengan jarahan dua kali lipat, cari **Dungeon Special Pass** di butik Mbak Rini di kota, ya!",
        ),
      );
    }

    if (!CAVE_LOCATIONS.includes(survival.currentLocation)) {
      return interaction.editReply(
        errorView(
          "Pintu dungeonnya ada di gua tambang dekat desa, lho. Naura tunggu kamu di sana, ya!",
        ),
      );
    }

    if ((survival.hp || 0) <= 20 || (survival.stamina || 0) <= 20) {
      return interaction.editReply(
        errorView(
          "Badanmu masih lemas begini, Naura tidak izinkan turun ke dungeon. Istirahat dulu, ya?",
        ),
      );
    }

    const isPremium = Boolean(
      profile.isPremium &&
      profile.premiumUntil &&
      profile.premiumUntil > new Date(),
    );
    const floor = profile.dungeon_floor || 1;

    if (!isPremium && floor > combat.FREE_FLOOR_LIMIT) {
      return interaction.editReply(
        errorView(
          "Lantai " +
            combat.FREE_FLOOR_LIMIT +
            " adalah batas untuk penjelajah biasa. Kalau mau turun lebih dalam bersama Naura, coba lihat /premium, ya!",
        ),
      );
    }

    const diffConfig = diffHelper.getDifficultyConfig(
      (survival.rpg_state || {}).difficulty || "Normal",
    );
    const stats = combat.statsFor(survival, profile);

    // ===== PERTEMPURAN =====
    const startBattle = async (passId, respond) => {
      const used = await rewards.consumePass(user.id, passId);
      if (!used.ok)
        return respond(
          ephemeral(
            errorView(
              "Tiketnya sudah tidak ada di tasmu. Coba beli lagi dulu, ya?",
            ),
          ),
        );

      const multiplier = used.multiplier;
      const enemy = combat.enemyFor(floor, diffConfig, multiplier);

      let enemyHp = enemy.maxHp;
      let playerHp = Math.min(survival.hp || 100, stats.playerMaxHp);
      let finished = false;

      const opening =
        "Kamu berhadapan dengan **" +
        enemy.name +
        "**!\n" +
        (enemy.special
          ? "Segel merahnya menyala\u2026 musuhnya jauh lebih tebal, tapi jarahannya dua kali lipat. Hati-hati, ya!"
          : "Naura pegang obat-obatannya, kamu fokus bertarung saja!");

      const message = await respond(
        await render.buildBattleView({
          user,
          stats,
          survival,
          enemy,
          enemyHp,
          playerHp,
          floor,
          logText: opening,
        }),
      );

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === user.id,
        time: COLLECTOR_MS,
      });

      collector.on("collect", async (i) => {
        if (finished) return;

        try {
          await i.deferUpdate();

          if (i.customId === "dungeon_flee") {
            finished = true;
            collector.stop("flee");

            if (Math.random() * 100 < 50 + stats.agility) {
              return i.editReply(
                render.buildClosingView({
                  expression: "sleepy",
                  colorKey: "info",
                  title: e("run", "\ud83c\udfc3") + " Berhasil Kabur",
                  description:
                    "Kelincahanmu menyelamatkanmu. Naura ikut lari di sebelahmu sambil bawa tas, kok!",
                }),
              );
            }

            const hit = await rewards.applyFleePenalty(
              user.id,
              playerHp,
              floor,
            );
            return i.editReply(
              render.buildClosingView({
                expression: "cry",
                colorKey: "error",
                title: e("run", "\ud83c\udfc3") + " Gagal Kabur",
                description:
                  "Kamu tersandung dan diserang dari belakang, kehilangan **" +
                  hit.penalty +
                  " HP**. Sini, Naura obati dulu.",
              }),
            );
          }

          if (i.customId !== "dungeon_attack" && i.customId !== "dungeon_skill")
            return;

          const useSkill = i.customId === "dungeon_skill";
          if (
            useSkill &&
            (!stats.skill || (survival.stamina || 0) < stats.skill.cost)
          ) {
            return i.followUp(
              ephemeral(
                errorView(
                  "Staminamu belum cukup untuk skill itu. Serangan biasa dulu, ya!",
                ),
              ),
            );
          }

          const attack = combat.resolveAttack({ useSkill, stats, profile });
          let logText = attack.log;

          if (attack.cost > 0) {
            const staminaLeft = Math.max(
              0,
              (survival.stamina || 0) - attack.cost,
            );
            survival.stamina = staminaLeft;
            await cacheManager.updateUserSurvival(user.id, {
              stamina: staminaLeft,
            });
          }

          enemyHp -= attack.damage;

          if (enemyHp <= 0) {
            finished = true;
            collector.stop("win");

            const win = await rewards.grantVictory({
              userId: user.id,
              survival,
              floor,
              diffConfig,
              stats,
              multiplier,
              playerHp,
            });

            const lines = [
              "Kamu mengalahkan **" +
                enemy.name +
                "**! Naura sudah tepuk tangan dari tadi, lho.",
              "",
              currency.format(currency.FRAGMENT, win.reward.money) +
                " masuk kantongmu, sisa saldo " +
                win.balance.toLocaleString("id-ID") +
                ".",
              "XP bertambah **" + win.reward.xp + "**.",
              "",
              "**Jarahan:**",
              win.lootText,
            ];
            if (win.couponText) lines.push("", win.couponText);
            lines.push(
              "",
              "Lantai berikutnya: **" +
                win.nextFloor +
                "**. Naura tunggu di depan pintunya, ya!",
            );

            return i.editReply(
              render.buildClosingView({
                expression: "success",
                colorKey: "success",
                title: e("cheers", "\ud83c\udf89") + " Pertarungan Menang!",
                description: lines.join("\n"),
              }),
            );
          }

          let enemyHit = combat.enemyDamage(
            floor,
            enemy.isBoss,
            diffConfig,
            multiplier,
          );
          if (Math.random() * 100 < stats.dodgeChance) {
            enemyHit = 0;
            logText +=
              "\nKamu berkelit mulus, serangannya tidak kena sama sekali!";
          }

          playerHp -= enemyHit;

          if (playerHp <= 0) {
            finished = true;
            collector.stop("lose");
            await rewards.applyDefeat(user.id);

            return i.editReply(
              render.buildClosingView({
                expression: "cry",
                colorKey: "error",
                title: e("cry", "\ud83d\udc80") + " Kamu Tumbang di Dungeon",
                description:
                  "**" +
                  enemy.name +
                  "** terlalu kuat kali ini. Gatot menyeretmu keluar gua dan Naura menunggu di desa " +
                  "dengan air hangat. Jangan sedih, ya \u2014 kita coba lagi setelah kamu pulih!",
              }),
            );
          }

          if (enemyHit > 0)
            logText +=
              "\nMusuh membalas dan memberikan **" + enemyHit + "** damage!";

          survival.hp = playerHp;
          await cacheManager.updateUserSurvival(user.id, { hp: playerHp });

          return i.editReply(
            await render.buildBattleView({
              user,
              stats,
              survival,
              enemy,
              enemyHp,
              playerHp,
              floor,
              logText,
            }),
          );
        } catch (err) {
          finished = true;
          collector.stop("error");
        }
      });
    };

    // Kalau pemain hanya punya satu jenis tiket, langsung masuk. Kalau punya
    // keduanya, biarkan dia memilih supaya tiket mahal tidak terpakai iseng.
    if (passes.normal > 0 && passes.special > 0) {
      const choice = await interaction.editReply(
        render.buildPassChoiceView(passes),
      );
      const picker = choice.createMessageComponentCollector({
        filter: (i) => i.user.id === user.id,
        time: CHOICE_MS,
      });

      picker.on("collect", async (i) => {
        await i.deferUpdate();
        picker.stop("picked");

        if (i.customId === "dungeon_cancel") {
          return i.editReply(
            render.buildClosingView({
              expression: "shy",
              colorKey: "info",
              title: "Baik, nanti saja!",
              description:
                "Tiketmu Naura simpan utuh. Panggil Naura lagi kalau sudah siap, ya!",
            }),
          );
        }

        const passId =
          i.customId === "dungeon_use_special"
            ? DUNGEON_SPECIAL_PASS_ID
            : DUNGEON_PASS_ID;
        return startBattle(passId, (payload) => i.editReply(payload));
      });
      return;
    }

    const passId =
      passes.special > 0 ? DUNGEON_SPECIAL_PASS_ID : DUNGEON_PASS_ID;
    return startBattle(passId, (payload) => interaction.editReply(payload));
  },
};
