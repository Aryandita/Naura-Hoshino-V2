"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const crypto = require("crypto");
const CardEngine = require("../../src/card/cardEngine");
const CardBattleEngine = require("../../src/card/cardBattleEngine");
const { drawAnimeCard } = require("../../src/canvas/cardCanvas");
const { drawCardBattleArena } = require("../../src/canvas/cardBattleCanvas");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const UserCard = require("../../src/models/UserCard");
const UserCardDeck = require("../../src/models/UserCardDeck");
const cacheManager = require("../../src/managers/cacheManager");
const redisManager = require("../../src/managers/redisManager");
const currency = require("../../src/survival/engines/currency");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("card")
    .setDescription("🎴 Sistem Koleksi Kartu Anime, TCG Battle & Tower of Babel")
    .addSubcommand((sub) =>
      sub
        .setName("drop")
        .setDescription("Munculkan 3 kartu anime untuk diperebutkan di chat!"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("daily")
        .setDescription("Buka 1 kartu gratis harianmu!"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("collection")
        .setDescription("Lihat daftar kartu anime milikmu"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat dan render visual kartu anime")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Kode unik kartu (misal: nra-7x9q)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("deck")
        .setDescription("Kelola 3-kartu deck pertarungan TCG Anda")
        .addStringOption((opt) =>
          opt
            .setName("card1")
            .setDescription("Kode kartu ke-1 (misal: nra-7x9q)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("card2")
            .setDescription("Kode kartu ke-2 (misal: nra-ab12)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("card3")
            .setDescription("Kode kartu ke-3 (misal: nra-cd34)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("battle")
        .setDescription("Tantang pemain lain dalam duel kartu TCG!")
        .addUserOption((opt) =>
          opt
            .setName("opponent")
            .setDescription("Pemain yang ingin ditantang (kosongkan untuk melawan AI)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("bet")
            .setDescription("Taruhan Star Fragments (Opsional)")
            .setMinValue(0)
            .setMaxValue(100000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tower")
        .setDescription("Tantang lantai Tower of Babel dan panjat menara legendaris!"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("burn")
        .setDescription("Bakar kartu duplikat untuk mendapatkan Star Fragments")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Kode unik kartu yang ingin dibakar")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dye")
        .setDescription("Warnai bingkai kartu dengan warna Hex pilihanmu (Biaya: 100 NSF)")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Kode unik kartu")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("hex")
            .setDescription("Kode warna hex (misal: #FFB6C1 atau #00FFFF)")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === "drop") {
      const dropSession = await CardEngine.createDropSession(interaction.channelId);

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("card_claim_0")
          .setLabel("1️⃣ Klaim Kartu 1")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("card_claim_1")
          .setLabel("2️⃣ Klaim Kartu 2")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("card_claim_2")
          .setLabel("3️⃣ Klaim Kartu 3")
          .setStyle(ButtonStyle.Primary),
      );

      const lines = dropSession.cards.map((c, i) => `**${i + 1}.** ${c.name}, *${c.series}*`);

      const payload = buildContainerV2({
        accentColorHex: "#F9A8D4",
        title: "🎴 3 Kartu Anime Muncul di Chat!",
        description: `Cepat klaim salah satu kartu sebelum pemain lain mengambilnya!\n\n${lines.join("\n")}`,
        footerText: ui.getFooter("core"),
        buttonsRow,
      });

      return interaction.reply(payload);
    }

    if (subcommand === "daily") {
      await interaction.deferReply();
      const card = await CardEngine.claimDailyCard(userId);
      if (!card) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Hadiah Harian Sudah Diambil",
            description: "Kamu sudah mengklaim kartu harian gratis hari ini. Coba lagi besok!",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const imgBuffer = await drawAnimeCard(card);
      const attachment = new AttachmentBuilder(imgBuffer, { name: "daily_card.png" });

      const payload = buildContainerV2({
        accentColorHex: "#FFD700",
        title: "✨ Kartu Harian Berhasil Dibuka!",
        description: `Selamat! Kamu mendapatkan **${card.characterName}** (*${card.seriesName}*)!\n\n🏷️ **Kode:** \`${card.cardCode}\`\n🌟 **Kondisi:** \`${card.quality}\`\n🔢 **Print:** \`#${card.printNumber}\``,
        footerText: ui.getFooter("core"),
        media: attachment,
      });

      return interaction.editReply({ ...payload, files: [attachment] });
    }

    if (subcommand === "deck") {
      await interaction.deferReply();
      const card1Code = interaction.options.getString("card1");
      const card2Code = interaction.options.getString("card2");
      const card3Code = interaction.options.getString("card3");

      const [userDeck] = await UserCardDeck.findOrCreate({ where: { userId } });

      if (card1Code && card2Code && card3Code) {
        // Validate card ownership
        const cards = await UserCard.findAll({
          where: {
            userId,
            cardCode: [card1Code.trim(), card2Code.trim(), card3Code.trim()],
          },
        });

        if (cards.length < 3) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Kartu Tidak Valid",
              description: "Pastikan Anda memiliki ketiga kartu tersebut di koleksi Anda.",
              footerText: ui.getFooter("core"),
            }),
          });
        }

        userDeck.activeDeck = [card1Code.trim(), card2Code.trim(), card3Code.trim()];
        await userDeck.save();

        const payload = buildContainerV2({
          accentColorHex: "#86EFAC",
          title: "🃏 Active Battle Deck Diperbarui!",
          description: `Deck 3-Kartu Anda berhasil disimpan:\n1. \`${cards[0].characterName}\` (${cards[0].cardCode})\n2. \`${cards[1].characterName}\` (${cards[1].cardCode})\n3. \`${cards[2].characterName}\` (${cards[2].cardCode})`,
          footerText: ui.getFooter("core"),
        });

        return interaction.editReply(payload);
      }

      // View Deck
      const currentDeckCodes = userDeck.activeDeck || [];
      const deckCards = currentDeckCodes.length > 0
        ? await UserCard.findAll({ where: { userId, cardCode: currentDeckCodes } })
        : [];

      const listText = deckCards.length > 0
        ? deckCards.map((c, i) => `**Slot ${i + 1}:** ${c.characterName} (\`${c.cardCode}\`) - 🌟 ${c.quality} #${c.printNumber}`).join("\n")
        : "*Deck masih kosong. Gunakan `/card deck card1:.. card2:.. card3:..` untuk mengatur deck.*";

      const payload = buildContainerV2({
        accentColorHex: "#C084FC",
        title: `🎴 Active TCG Deck: ${interaction.user.username}`,
        description: `🏆 **ELO Rating:** \`${userDeck.eloRating}\` | ⚔️ **W/L:** \`${userDeck.wins}W / ${userDeck.losses}L\`\n🗼 **Tower Lantai:** \`${userDeck.towerFloor}\` (Rekor: \`${userDeck.highestFloor}\`)\n\n${listText}`,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "tower") {
      await interaction.deferReply();
      const [userDeck] = await UserCardDeck.findOrCreate({ where: { userId } });
      const currentDeckCodes = userDeck.activeDeck || [];

      let leadCard;
      if (currentDeckCodes.length > 0) {
        leadCard = await UserCard.findOne({ where: { userId, cardCode: currentDeckCodes[0] } });
      }
      if (!leadCard) {
        leadCard = await UserCard.findOne({ where: { userId } });
      }

      if (!leadCard) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Belum Memiliki Kartu",
            description: "Anda membutuhkan minimal 1 kartu anime untuk menantang Tower of Babel. Gunakan `/card drop` atau `/card daily`!",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const p1Card = CardBattleEngine.computeCardStats(leadCard);
      const floor = userDeck.towerFloor || 1;
      const monsterCard = CardBattleEngine.getTowerMonster(floor);

      const sessionId = crypto.randomBytes(6).toString("hex");
      const sessionData = {
        sessionId,
        isPvE: true,
        isTower: true,
        towerFloor: floor,
        p1UserId: userId,
        p2UserId: "TOWER_BOSS_AI",
        p1User: { username: interaction.user.username },
        p2User: { username: monsterCard.characterName },
        p1Card,
        p2Card: monsterCard,
        turn: 1,
        roundNumber: 1,
      };

      await redisManager.set(`card:battle:${sessionId}`, JSON.stringify(sessionData), "EX", 600);

      const arenaBuffer = await drawCardBattleArena({
        p1: p1Card,
        p2: monsterCard,
        p1User: sessionData.p1User,
        p2User: sessionData.p2User,
        turnLog: `🏰 **TOWER OF BABEL - LANTAI ${floor}**! Kalahkan penjaga menara untuk melangkah ke lantai berikutnya!`,
        roundNumber: 1,
      });

      const attachment = new AttachmentBuilder(arenaBuffer, { name: "tower-battle.png" });

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`card_battle_atk_${sessionId}`)
          .setLabel("⚔️ Attack")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`card_battle_skill_${sessionId}`)
          .setLabel(`✨ Skill (${p1Card.skill.name})`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(p1Card.energy < p1Card.skill.energyCost),
        new ButtonBuilder()
          .setCustomId(`card_battle_def_${sessionId}`)
          .setLabel("🛡️ Defend")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`card_battle_forfeit_${sessionId}`)
          .setLabel("🏳️ Forfeit")
          .setStyle(ButtonStyle.Danger),
      );

      const payload = buildContainerV2({
        accentColorHex: "#93C5FD",
        title: `🗼 Tower of Babel - Tantangan Lantai ${floor}`,
        description: `Penjaga Lantai: **${monsterCard.characterName}** (${monsterCard.elementEmoji} ${monsterCard.element})\nHP: \`${monsterCard.maxHp}\` | ATK: \`${monsterCard.atk}\`\n\nPilih aksi giliran Anda!`,
        footerText: ui.getFooter("core"),
        media: attachment,
        buttonsRow: actionRow,
      });

      return interaction.editReply({ ...payload, files: [attachment], components: [actionRow] });
    }

    if (subcommand === "battle") {
      await interaction.deferReply();
      const opponent = interaction.options.getUser("opponent");
      const bet = interaction.options.getInteger("bet") || 0;

      const [p1Deck] = await UserCardDeck.findOrCreate({ where: { userId } });
      const p1DeckCodes = p1Deck.activeDeck || [];
      const leadCard = p1DeckCodes.length > 0
        ? await UserCard.findOne({ where: { userId, cardCode: p1DeckCodes[0] } })
        : await UserCard.findOne({ where: { userId } });

      if (!leadCard) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Belum Memiliki Kartu",
            description: "Anda membutuhkan minimal 1 kartu anime untuk bertarung. Buka kartu lewat `/card drop` atau `/card daily`!",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      if (bet > 0) {
        const canDebit = await currency.charge(userId, { starFragments: bet }, "Card Battle Bet Escrow");
        if (!canDebit) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Saldo Star Fragments Kurang",
              description: `Anda membutuhkan **${bet} Star Fragments** untuk taruhan duel ini.`,
              footerText: ui.getFooter("core"),
            }),
          });
        }
      }

      const p1Card = CardBattleEngine.computeCardStats(leadCard);
      let p2Card;
      let p2User;
      let isPvE = false;

      if (!opponent || opponent.id === userId || opponent.bot) {
        // AI Opponent Battle
        isPvE = true;
        p2User = { username: "Cyber Hologram AI" };
        const catalog = CardEngine.getCatalog();
        const randMeta = catalog[Math.floor(Math.random() * catalog.length)];
        p2Card = CardBattleEngine.computeCardStats({
          characterName: randMeta.name,
          seriesName: randMeta.series,
          quality: "GOOD",
          printNumber: 42,
        });
      } else {
        // PvP Opponent Battle
        p2User = { username: opponent.username };
        const [p2Deck] = await UserCardDeck.findOrCreate({ where: { userId: opponent.id } });
        const p2DeckCodes = p2Deck.activeDeck || [];
        const oppCard = p2DeckCodes.length > 0
          ? await UserCard.findOne({ where: { userId: opponent.id, cardCode: p2DeckCodes[0] } })
          : await UserCard.findOne({ where: { userId: opponent.id } });

        if (!oppCard) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Lawan Belum Memiliki Kartu",
              description: `${opponent.username} belum memiliki kartu anime untuk bertarung.`,
              footerText: ui.getFooter("core"),
            }),
          });
        }
        p2Card = CardBattleEngine.computeCardStats(oppCard);
      }

      const sessionId = crypto.randomBytes(6).toString("hex");
      const sessionData = {
        sessionId,
        isPvE,
        betAmount: bet,
        p1UserId: userId,
        p2UserId: opponent ? opponent.id : "AI_BOT",
        p1User: { username: interaction.user.username },
        p2User: { username: p2User.username },
        p1Card,
        p2Card,
        turn: 1,
        roundNumber: 1,
      };

      await redisManager.set(`card:battle:${sessionId}`, JSON.stringify(sessionData), "EX", 600);

      const arenaBuffer = await drawCardBattleArena({
        p1: p1Card,
        p2: p2Card,
        p1User: sessionData.p1User,
        p2User: sessionData.p2User,
        turnLog: `⚔️ **DUEL DIMULAI!** ${interaction.user.username} menantang ${p2User.username}!`,
        roundNumber: 1,
      });

      const attachment = new AttachmentBuilder(arenaBuffer, { name: "card-battle-start.png" });

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`card_battle_atk_${sessionId}`)
          .setLabel("⚔️ Attack")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`card_battle_skill_${sessionId}`)
          .setLabel(`✨ Skill (${p1Card.skill.name})`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(p1Card.energy < p1Card.skill.energyCost),
        new ButtonBuilder()
          .setCustomId(`card_battle_def_${sessionId}`)
          .setLabel("🛡️ Defend")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`card_battle_forfeit_${sessionId}`)
          .setLabel("🏳️ Forfeit")
          .setStyle(ButtonStyle.Danger),
      );

      const payload = buildContainerV2({
        accentColorHex: "#F9A8D4",
        title: `⚔️ Duel Kartu Anime: ${interaction.user.username} vs ${p2User.username}`,
        description: `Taruhan: **${bet} Star Fragments** 🌟\nGiliran: <@${userId}>\n\nPilih aksi serangan atau pertahanan Anda!`,
        footerText: ui.getFooter("core"),
        media: attachment,
        buttonsRow: actionRow,
      });

      return interaction.editReply({ ...payload, files: [attachment], components: [actionRow] });
    }

    if (subcommand === "collection") {
      await interaction.deferReply();
      const cards = await UserCard.findAll({ where: { userId }, limit: 20, order: [["createdAt", "DESC"]] });

      if (cards.length === 0) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Koleksi Kosong",
            description: "Kamu belum memiliki kartu anime. Dapatkan lewat `/card drop` atau `/card daily`!",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const lines = cards.map(
        (c) =>
          `• **${c.characterName}** (\`${c.cardCode}\`) - 🌟 \`${c.quality}\` | 🔢 \`#${c.printNumber}\` ${c.dyeColor ? `| 🎨 \`${c.dyeColor}\`` : ""}`,
      );

      const payload = buildContainerV2({
        accentColorHex: "#FFB6C1",
        title: `🎴 Koleksi Kartu: ${interaction.user.username}`,
        description: `Total Kartu: **${cards.length} kartu**\n\n${lines.join("\n")}`,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "view") {
      const code = interaction.options.getString("code").trim();
      await interaction.deferReply();

      const card = await UserCard.findOne({ where: { cardCode: code, userId } });
      if (!card) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Kartu Tidak Ditemukan",
            description: "Kartu dengan kode tersebut tidak ditemukan di koleksimu.",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const imgBuffer = await drawAnimeCard(card);
      const attachment = new AttachmentBuilder(imgBuffer, { name: `${card.cardCode}.png` });

      const payload = buildContainerV2({
        accentColorHex: card.dyeColor || "#FFB6C1",
        title: `🎴 ${card.characterName} (#${card.printNumber})`,
        description: `🌟 **Kondisi:** \`${card.quality}\`\n🏷️ **Kode:** \`${card.cardCode}\`\n📺 **Serial:** *${card.seriesName}*\n💰 **Nilai Lebur:** \`${card.burnValue || 100} Star Fragments\``,
        footerText: ui.getFooter("core"),
        media: attachment,
      });

      return interaction.editReply({ ...payload, files: [attachment] });
    }

    if (subcommand === "burn") {
      const code = interaction.options.getString("code").trim();
      await interaction.deferReply();

      const card = await UserCard.findOne({ where: { cardCode: code, userId } });
      if (!card) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Kartu Tidak Ditemukan",
            description: "Kartu tidak ditemukan atau bukan milikmu.",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const rewardFrag = card.burnValue || 100;
      await card.destroy();
      await cacheManager.incrementUserSurvival(userId, "starFragments", rewardFrag);

      const payload = buildContainerV2({
        accentColorHex: "#E74C3C",
        title: "🔥 Kartu Berhasil Dibakar",
        description: `Kartu **${card.characterName}** (\`${card.cardCode}\`) telah dilebur menjadi **+${rewardFrag} Star Fragments** 🌟`,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "dye") {
      const code = interaction.options.getString("code").trim();
      const hex = interaction.options.getString("hex").trim();
      await interaction.deferReply();

      const card = await UserCard.findOne({ where: { cardCode: code, userId } });
      if (!card) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Kartu Tidak Ditemukan",
            description: "Kartu tidak ditemukan atau bukan milikmu.",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      card.dyeColor = hex;
      await card.save();

      const payload = buildContainerV2({
        accentColorHex: hex,
        title: "🎨 Kartu Berhasil Diwarnai!",
        description: `Kartu **${card.characterName}** kini memancarkan aura warna \`${hex}\`!`,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }
  },
};
