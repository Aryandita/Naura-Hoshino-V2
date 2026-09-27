"use strict";

const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const redisManager = require("../../managers/redisManager");
const CardBattleV2Engine = require("../../card/cardBattleV2Engine");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const UserCardDeck = require("../../models/UserCardDeck");
const currency = require("../../survival/engines/currency");
const ui = require("../../config/ui");
const { drawCardBattleArena } = require("../../canvas/cardBattleCanvas");

module.exports = [
  {
    prefix: "card_battle_",
    label: "card-battle",
    defer: false,
    async handler(interaction) {
      const parts = interaction.customId.split("_");
      const action = parts[2]; // atk, skill, def, burst, forfeit
      const sessionId = parts.slice(3).join("_");

      const sessionRaw = await redisManager.get(`card:battle:${sessionId}`);
      if (!sessionRaw) {
        return interaction.reply({
          content: `${ui.getEmoji("error") || "❌"} Sesi pertempuran kartu sudah berakhir atau kedaluwarsa.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const session = JSON.parse(sessionRaw);

      // Verify player turn
      const isP1 = interaction.user.id === session.p1UserId;
      const isP2 = interaction.user.id === session.p2UserId;

      if (!isP1 && !isP2) {
        return interaction.reply({
          content: `${ui.getEmoji("error") || "❌"} Anda bukan peserta dalam pertempuran kartu ini.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const expectedUser =
        session.turn === 1 ? session.p1UserId : session.p2UserId;
      if (interaction.user.id !== expectedUser && action !== "forfeit") {
        return interaction.reply({
          content: `${ui.getEmoji("clock") || "⏳"} Tunggu giliran Anda!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferUpdate();

      if (action === "forfeit") {
        await redisManager.del(`card:battle:${sessionId}`);
        const winnerName = isP1
          ? session.p2User.username
          : session.p1User.username;

        const container = buildContainerV2({
          title: `${ui.getEmoji("flag_white") || "🏳️"} Pertempuran Kartu Berakhir (Menyerah)`,
          description: `${interaction.user.username} menyerah! **${winnerName}** memenangkan duel kartu ini!`,
          color: 0xffb6c1,
          authorName: "Naura Card TCG Arena",
        });

        return interaction.editReply({ ...container, components: [] });
      }

      // Execute Player Action V2
      const attacker = session.turn === 1 ? session.p1Card : session.p2Card;
      const defender = session.turn === 1 ? session.p2Card : session.p1Card;
      const attackerUser = session.turn === 1 ? session.p1User : session.p2User;
      const defenderUser = session.turn === 1 ? session.p2User : session.p1User;

      let actionType = "ATTACK";
      if (action === "skill") actionType = "SKILL";
      if (action === "def") actionType = "GUARD";
      if (action === "burst") actionType = "BURST";

      // Pastikan property shield & energy terdefinisi
      if (attacker.shield === undefined) attacker.shield = 0;
      if (defender.shield === undefined) defender.shield = 0;
      if (attacker.energy === undefined) attacker.energy = 2;
      if (attacker.maxEnergy === undefined) attacker.maxEnergy = 10;
      if (defender.energy === undefined) defender.energy = 2;
      if (defender.maxEnergy === undefined) defender.maxEnergy = 10;

      // Inisialisasi mini battle-state untuk CardBattleV2Engine
      const mockBattleState = {
        turn: session.roundNumber || 1,
        activeUserId: interaction.user.id,
        fighters: {
          [interaction.user.id]: {
            userId: interaction.user.id,
            username: attackerUser.username,
            card: attacker,
            currentHp: attacker.currentHp,
            maxHp: attacker.maxHp,
            shield: attacker.shield || 0,
            energy: attacker.energy || 2,
            maxEnergy: attacker.maxEnergy || 10,
            comboHistory: attacker.comboHistory || [],
          },
          [session.turn === 1 ? session.p2UserId : session.p1UserId]: {
            userId: session.turn === 1 ? session.p2UserId : session.p1UserId,
            username: defenderUser.username,
            card: defender,
            currentHp: defender.currentHp,
            maxHp: defender.maxHp,
            shield: defender.shield || 0,
            energy: defender.energy || 2,
            maxEnergy: defender.maxEnergy || 10,
            comboHistory: defender.comboHistory || [],
          },
        },
        combatLogs: [],
        isFinished: false,
        winnerUserId: null,
      };

      const turnRes = { log: "", isDefenderFainted: false };

      try {
        const afterActionState = CardBattleV2Engine.processAction(
          mockBattleState,
          interaction.user.id,
          actionType
        );

        // Sinkronisasi kembali ke session
        const fAttacker = afterActionState.fighters[interaction.user.id];
        const oppId = session.turn === 1 ? session.p2UserId : session.p1UserId;
        const fDefender = afterActionState.fighters[oppId];

        attacker.currentHp = fAttacker.currentHp;
        attacker.shield = fAttacker.shield;
        attacker.energy = fAttacker.energy;
        attacker.comboHistory = fAttacker.comboHistory;

        defender.currentHp = fDefender.currentHp;
        defender.shield = fDefender.shield;
        defender.energy = fDefender.energy;

        turnRes.log = afterActionState.combatLogs.join("\n");
        turnRes.isDefenderFainted = afterActionState.isFinished;
      } catch (err) {
        // Fallback jika ada validasi energy
        turnRes.log = `⚠️ ${err.message}`;
      }

      session.roundNumber = (session.roundNumber || 1) + 1;

      // Check Win Condition
      if (turnRes.isDefenderFainted || defender.currentHp <= 0) {
        await redisManager.del(`card:battle:${sessionId}`);
        const winnerId =
          session.turn === 1 ? session.p1UserId : session.p2UserId;
        const loserId =
          session.turn === 1 ? session.p2UserId : session.p1UserId;
        const winnerUser = session.turn === 1 ? session.p1User : session.p2User;
        const loserUser = session.turn === 1 ? session.p2User : session.p1User;

        let eloText = "Mendapatkan +25 ELO Points & Kebanggaan!";

        // Update Win/Loss Stats with Elo V2
        if (!session.isPvE) {
          const [wDeck] = await UserCardDeck.findOrCreate({
            where: { userId: winnerId },
          });
          const [lDeck] = await UserCardDeck.findOrCreate({
            where: { userId: loserId },
          });

          const currentWinnerElo = wDeck.eloRating || 1000;
          const currentLoserElo = lDeck.eloRating || 1000;

          const eloCalc = CardBattleV2Engine.calculateElo(currentWinnerElo, currentLoserElo);

          wDeck.wins += 1;
          wDeck.eloRating = eloCalc.winnerNewElo;
          await wDeck.save({ fields: ["wins", "eloRating"] });

          lDeck.losses += 1;
          lDeck.eloRating = eloCalc.loserNewElo;
          await lDeck.save({ fields: ["losses", "eloRating"] });

          // Update Redis Ranked Ladder
          if (redisManager.isReady) {
            await redisManager.client.zadd("card:ranked:ladder", eloCalc.winnerNewElo, winnerId);
            await redisManager.client.zadd("card:ranked:ladder", eloCalc.loserNewElo, loserId);
          }

          const rankTier = CardBattleV2Engine.getRankTier(eloCalc.winnerNewElo);
          eloText = `Peringkat: ${rankTier.icon} **${rankTier.name}** (+${eloCalc.winnerDelta} Elo -> **${eloCalc.winnerNewElo}**)`;

          // Bet reward payout
          if (session.betAmount > 0) {
            await currency.reward(
              winnerId,
              { starFragments: session.betAmount * 2 },
              "Card Battle Win",
            );
          }
        } else if (session.isTower) {
          const [deck] = await UserCardDeck.findOrCreate({
            where: { userId: winnerId },
          });
          deck.towerFloor += 1;
          if (deck.towerFloor > deck.highestFloor)
            deck.highestFloor = deck.towerFloor;
          await deck.save({ fields: ["towerFloor", "highestFloor"] });

          // Tower floor reward
          const frags = session.towerFloor * 50;
          await currency.reward(
            winnerId,
            { starFragments: frags },
            `Tower of Babel F${session.towerFloor}`,
          );
        }

        const endBuffer = await drawCardBattleArena({
          p1: session.p1Card,
          p2: session.p2Card,
          p1User: session.p1User,
          p2User: session.p2User,
          turnLog: `${turnRes.log}\n${ui.getEmoji("trophy") || "🏆"} **${winnerUser.username} KELUAR SEBAGAI PEMENANG!**`,
          roundNumber: session.roundNumber,
        });

        const attachment = new AttachmentBuilder(endBuffer, {
          name: "card-clash-victory.png",
        });
        const container = buildContainerV2({
          title: `${ui.getEmoji("trophy") || "🏆"} Victory in Card Clash!`,
          description: `Pertarungan sengit telah usai!\n\n${ui.getEmoji("crown") || "👑"} **Pemenang:** <@${winnerId}>\n${ui.getEmoji("skull") || "💀"} **Gugur:** ${loserUser.username}\n${ui.getEmoji("book") || "📜"} **Prestasi:** ${session.isTower ? `Menaklukkan Lantai ${session.towerFloor} Tower of Babel!` : eloText}`,
          color: 0xffd700,
          authorName: "Naura TCG Arena Champion",
          media: attachment,
        });

        return interaction.editReply({
          ...container,
          files: [attachment],
          components: [],
        });
      }

      // Switch turn
      session.turn = session.turn === 1 ? 2 : 1;

      // If PvE Tower/AI opponent, execute AI counter-turn immediately
      if (session.isPvE && session.turn === 2) {
        const aiAction =
          session.p2Card.energy >= 5
            ? "BURST"
            : session.p2Card.energy >= (session.p2Card.skill.energyCost || 3)
              ? "SKILL"
              : Math.random() < 0.25
                ? "GUARD"
                : "ATTACK";

        // Eksekusi turn AI via CardBattleV2Engine
        const mockAiState = {
          turn: session.roundNumber,
          activeUserId: session.p2UserId,
          fighters: {
            [session.p2UserId]: {
              userId: session.p2UserId,
              username: session.p2User.username,
              card: session.p2Card,
              currentHp: session.p2Card.currentHp,
              maxHp: session.p2Card.maxHp,
              shield: session.p2Card.shield || 0,
              energy: session.p2Card.energy || 2,
              maxEnergy: session.p2Card.maxEnergy || 10,
              comboHistory: session.p2Card.comboHistory || [],
            },
            [session.p1UserId]: {
              userId: session.p1UserId,
              username: session.p1User.username,
              card: session.p1Card,
              currentHp: session.p1Card.currentHp,
              maxHp: session.p1Card.maxHp,
              shield: session.p1Card.shield || 0,
              energy: session.p1Card.energy || 2,
              maxEnergy: session.p1Card.maxEnergy || 10,
              comboHistory: session.p1Card.comboHistory || [],
            },
          },
          combatLogs: [],
          isFinished: false,
          winnerUserId: null,
        };

        const aiStateResult = CardBattleV2Engine.processAction(
          mockAiState,
          session.p2UserId,
          aiAction
        );

        const fAi = aiStateResult.fighters[session.p2UserId];
        const fPlayer = aiStateResult.fighters[session.p1UserId];

        session.p2Card.currentHp = fAi.currentHp;
        session.p2Card.shield = fAi.shield;
        session.p2Card.energy = fAi.energy;

        session.p1Card.currentHp = fPlayer.currentHp;
        session.p1Card.shield = fPlayer.shield;
        session.p1Card.energy = fPlayer.energy;

        turnRes.log += `\n${ui.getEmoji("robot") || "🤖"} ${aiStateResult.combatLogs.join("\n")}`;

        if (aiStateResult.isFinished || session.p1Card.currentHp <= 0) {
          await redisManager.del(`card:battle:${sessionId}`);
          const endBuffer = await drawCardBattleArena({
            p1: session.p1Card,
            p2: session.p2Card,
            p1User: session.p1User,
            p2User: session.p2User,
            turnLog: `${turnRes.log}\n${ui.getEmoji("skull") || "💀"} **${session.p1User.username} Telah Dikalahkan!**`,
            roundNumber: session.roundNumber,
          });

          const attachment = new AttachmentBuilder(endBuffer, {
            name: "card-clash-defeat.png",
          });
          const container = buildContainerV2({
            title: `${ui.getEmoji("skull") || "💀"} Defeat in Tower of Babel`,
            description: `Kartu Anda telah tumbang di Lantai ${session.towerFloor}.\nPerkuat deck dan tingkatkan kualitas kartu Anda untuk menantang kembali!`,
            color: 0xff0000,
            authorName: "Tower of Babel",
            media: attachment,
          });

          return interaction.editReply({
            ...container,
            files: [attachment],
            components: [],
          });
        }

        session.turn = 1;
      }

      // Save updated session state
      await redisManager.set(
        `card:battle:${sessionId}`,
        JSON.stringify(session),
        "EX",
        600,
      );

      const arenaBuffer = await drawCardBattleArena({
        p1: session.p1Card,
        p2: session.p2Card,
        p1User: session.p1User,
        p2User: session.p2User,
        turnLog: turnRes.log,
        roundNumber: session.roundNumber,
      });

      const attachment = new AttachmentBuilder(arenaBuffer, {
        name: "card-clash-live.png",
      });

      const nextUser = session.turn === 1 ? session.p1User : session.p2User;
      const nextCard = session.turn === 1 ? session.p1Card : session.p2Card;

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`card_battle_atk_${sessionId}`)
          .setLabel("Attack")
          .setEmoji(ui.parseEmoji(ui.getEmoji("battle")) || { name: "⚔️" })
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`card_battle_skill_${sessionId}`)
          .setLabel(`Skill (${nextCard.skill ? nextCard.skill.name : "Skill"})`)
          .setEmoji(ui.parseEmoji(ui.getEmoji("sparkles")) || { name: "✨" })
          .setStyle(ButtonStyle.Success)
          .setDisabled(nextCard.energy < (nextCard.skill ? nextCard.skill.energyCost || 3 : 3)),
        new ButtonBuilder()
          .setCustomId(`card_battle_def_${sessionId}`)
          .setLabel("Guard")
          .setEmoji(ui.parseEmoji(ui.getEmoji("shield")) || { name: "🛡️" })
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`card_battle_burst_${sessionId}`)
          .setLabel("Burst")
          .setEmoji({ name: "🌌" })
          .setStyle(ButtonStyle.Primary)
          .setDisabled(nextCard.energy < 5),
        new ButtonBuilder()
          .setCustomId(`card_battle_forfeit_${sessionId}`)
          .setLabel("Forfeit")
          .setEmoji(ui.parseEmoji(ui.getEmoji("flag_white")) || { name: "🏳️" })
          .setStyle(ButtonStyle.Danger),
      );

      const container = buildContainerV2({
        title: `${ui.getEmoji("battle") || "⚔️"} Giliran: ${nextUser.username}`,
        description: `Pilih aksi bertarung Anda untuk ronde ke-${session.roundNumber}!\n${ui.getEmoji("stamina") || "⚡"} **Energy:** ${nextCard.energy}/${nextCard.maxEnergy || 10} | ${ui.getEmoji("shield") || "🛡️"} **Shield:** ${nextCard.shield || 0}`,
        color: 0xffb6c1,
        authorName: "Naura TCG Card Clash V2",
        media: attachment,
        buttonsRow: actionRow,
      });

      return interaction.editReply({
        ...container,
        files: [attachment],
        components: [actionRow],
      });
    },
  },
];
