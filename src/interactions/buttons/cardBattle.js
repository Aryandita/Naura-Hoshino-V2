"use strict";

const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const redisManager = require("../../managers/redisManager");
const CardBattleEngine = require("../../card/cardBattleEngine");
const { drawCardBattleArena } = require("../../canvas/cardBattleCanvas");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const UserCardDeck = require("../../models/UserCardDeck");
const currency = require("../../survival/engines/currency");

module.exports = [
  {
    prefix: "card_battle_",
    label: "card-battle",
    defer: false,
    async handler(interaction) {
    const parts = interaction.customId.split("_");
    const action = parts[2]; // atk, skill, def, forfeit
    const sessionId = parts.slice(3).join("_");

    const sessionRaw = await redisManager.get(`card:battle:${sessionId}`);
    if (!sessionRaw) {
      return interaction.reply({
        content: "❌ Sesi pertempuran kartu sudah berakhir atau kedaluwarsa.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const session = JSON.parse(sessionRaw);

    // Verify player turn
    const isP1 = interaction.user.id === session.p1UserId;
    const isP2 = interaction.user.id === session.p2UserId;

    if (!isP1 && !isP2) {
      return interaction.reply({
        content: "❌ Anda bukan peserta dalam pertempuran kartu ini.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const expectedUser = session.turn === 1 ? session.p1UserId : session.p2UserId;
    if (interaction.user.id !== expectedUser && action !== "forfeit") {
      return interaction.reply({
        content: "⏳ Tunggu giliran Anda!",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferUpdate();

    if (action === "forfeit") {
      await redisManager.del(`card:battle:${sessionId}`);
      const winnerId = isP1 ? session.p2UserId : session.p1UserId;
      const winnerName = isP1 ? session.p2User.username : session.p1User.username;

      const container = buildContainerV2({
        title: "🏳️ Pertempuran Kartu Berakhir (Menyerah)",
        description: `${interaction.user.username} menyerah! **${winnerName}** memenangkan duel kartu ini!`,
        color: 0xffb6c1,
        authorName: "Naura Card TCG Arena",
      });

      return interaction.editReply({ ...container, components: [] });
    }

    // Execute Player Action
    const attacker = session.turn === 1 ? session.p1Card : session.p2Card;
    const defender = session.turn === 1 ? session.p2Card : session.p1Card;

    let actionType = "ATTACK";
    if (action === "skill") actionType = "SKILL";
    if (action === "def") actionType = "DEFEND";

    const turnRes = CardBattleEngine.executeTurn(attacker, defender, actionType);
    session.roundNumber = (session.roundNumber || 1) + 1;

    // Check Win Condition
    if (turnRes.isDefenderFainted) {
      await redisManager.del(`card:battle:${sessionId}`);
      const winnerId = session.turn === 1 ? session.p1UserId : session.p2UserId;
      const winnerUser = session.turn === 1 ? session.p1User : session.p2User;
      const loserUser = session.turn === 1 ? session.p2User : session.p1User;

      // Update Win/Loss Stats
      if (!session.isPvE) {
        const [wDeck] = await UserCardDeck.findOrCreate({ where: { userId: winnerId } });
        wDeck.wins += 1;
        wDeck.eloRating += 25;
        await wDeck.save();

        const loserId = session.turn === 1 ? session.p2UserId : session.p1UserId;
        const [lDeck] = await UserCardDeck.findOrCreate({ where: { userId: loserId } });
        lDeck.losses += 1;
        lDeck.eloRating = Math.max(500, lDeck.eloRating - 20);
        await lDeck.save();

        // Bet reward payout
        if (session.betAmount > 0) {
          await currency.reward(winnerId, { starFragments: session.betAmount * 2 }, "Card Battle Win");
        }
      } else if (session.isTower) {
        const [deck] = await UserCardDeck.findOrCreate({ where: { userId: winnerId } });
        deck.towerFloor += 1;
        if (deck.towerFloor > deck.highestFloor) deck.highestFloor = deck.towerFloor;
        await deck.save();

        // Tower floor reward
        const frags = session.towerFloor * 50;
        await currency.reward(winnerId, { starFragments: frags }, `Tower of Babel F${session.towerFloor}`);
      }

      const endBuffer = await drawCardBattleArena({
        p1: session.p1Card,
        p2: session.p2Card,
        p1User: session.p1User,
        p2User: session.p2User,
        turnLog: `${turnRes.log}\n🏆 **${winnerUser.username} KELUAR SEBAGAI PEMENANG!**`,
        roundNumber: session.roundNumber,
      });

      const attachment = new AttachmentBuilder(endBuffer, { name: "card-clash-victory.png" });
      const container = buildContainerV2({
        title: "🏆 Victory in Card Clash!",
        description: `Pertarungan sengit telah usai!\n\n👑 **Pemenang:** <@${winnerId}>\n💀 **Gugur:** ${loserUser.username}\n📜 **Kemenangan:** ${session.isTower ? `Menaklukkan Lantai ${session.towerFloor} Tower of Babel!` : "Mendapatkan +25 ELO Points & Kebanggaan!"}`,
        color: 0xffd700,
        authorName: "Naura TCG Arena Champion",
        media: attachment,
      });

      return interaction.editReply({ ...container, files: [attachment], components: [] });
    }

    // Switch turn
    session.turn = session.turn === 1 ? 2 : 1;

    // If PvE Tower/AI opponent, execute AI counter-turn immediately
    if (session.isPvE && session.turn === 2) {
      const aiAction = session.p2Card.energy >= session.p2Card.skill.energyCost ? "SKILL" : (Math.random() < 0.25 ? "DEFEND" : "ATTACK");
      const aiTurnRes = CardBattleEngine.executeTurn(session.p2Card, session.p1Card, aiAction);
      turnRes.log += `\n🤖 ${aiTurnRes.log}`;

      if (aiTurnRes.isDefenderFainted) {
        await redisManager.del(`card:battle:${sessionId}`);
        const endBuffer = await drawCardBattleArena({
          p1: session.p1Card,
          p2: session.p2Card,
          p1User: session.p1User,
          p2User: session.p2User,
          turnLog: `${turnRes.log}\n💀 **${session.p1User.username} Telah Dikalahkan!**`,
          roundNumber: session.roundNumber,
        });

        const attachment = new AttachmentBuilder(endBuffer, { name: "card-clash-defeat.png" });
        const container = buildContainerV2({
          title: "💀 Defeat in Tower of Babel",
          description: `Kartu Anda telah tumbang di Lantai ${session.towerFloor}.\nPerkuat deck dan tingkatkan kualitas kartu Anda untuk menantang kembali!`,
          color: 0xff0000,
          authorName: "Tower of Babel",
          media: attachment,
        });

        return interaction.editReply({ ...container, files: [attachment], components: [] });
      }

      session.turn = 1;
    }

    // Save updated session state
    await redisManager.set(`card:battle:${sessionId}`, JSON.stringify(session), "EX", 600);

    const arenaBuffer = await drawCardBattleArena({
      p1: session.p1Card,
      p2: session.p2Card,
      p1User: session.p1User,
      p2User: session.p2User,
      turnLog: turnRes.log,
      roundNumber: session.roundNumber,
    });

    const attachment = new AttachmentBuilder(arenaBuffer, { name: "card-clash-live.png" });

    const nextUser = session.turn === 1 ? session.p1User : session.p2User;
    const nextCard = session.turn === 1 ? session.p1Card : session.p2Card;

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`card_battle_atk_${sessionId}`)
        .setLabel("⚔️ Attack")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`card_battle_skill_${sessionId}`)
        .setLabel(`✨ Skill (${nextCard.skill.name})`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(nextCard.energy < nextCard.skill.energyCost),
      new ButtonBuilder()
        .setCustomId(`card_battle_def_${sessionId}`)
        .setLabel("🛡️ Defend")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`card_battle_forfeit_${sessionId}`)
        .setLabel("🏳️ Forfeit")
        .setStyle(ButtonStyle.Danger),
    );

    const container = buildContainerV2({
      title: `⚔️ Giliran: ${nextUser.username}`,
      description: `Pilih aksi bertarung Anda untuk ronde ke-${session.roundNumber}!\n⚡ **Energy Saat Ini:** ${nextCard.energy}/${nextCard.maxEnergy}`,
      color: 0xffb6c1,
      authorName: "Naura TCG Card Clash",
      media: attachment,
      buttonsRow: actionRow,
    });

    return interaction.editReply({ ...container, files: [attachment], components: [actionRow] });
  },
}];
