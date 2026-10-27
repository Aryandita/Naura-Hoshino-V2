"use strict";

/**
 * @module collect
 * @description Subcommand /survival collect - Eksplorasi lokasi untuk mengumpulkan bahan alam dengan QTE mini-game.
 * 
 * Fitur Utama:
 * - Location selector UI (Hutan, Tambang, Laut, Desa) jika tidak ada argumen
 * - Validasi stamina/hunger/threshold minimum sebelum eksplorasi
 * - Gear check per lokasi (pancingan wajib untuk laut)
 * - Random encounter flavor text (10% chance)
 * - NPC detection berdasarkan lokasi dan waktu in-game
 * - Quick Time Event (QTE) untuk lokasi tertentu (5 detik decision window)
 * - Loot granting via collectActions.grantLoot()
 * - Post-exploration NPC talk option
 * - Automatic return to village ("desa") setelah eksplorasi selesai
 * - Background dinamis berdasarkan lokasi dan jam in-game
 * 
 * Alur Eksekusi:
 * 1. Jika no lokasi argumen -> tampilkan location selector buttons
 * 2. Validasi prisoner status, vitals minimum, gear requirement
 * 3. Update currentLocation via cacheManager
 * 4. Tampilkan arrival card dengan choice buttons (Cari sini/sana/Sapa warga)
 * 5. On collect: trigger QTE jika applicable, atau langsung grantLoot
 * 6. Success: tampilkan loot summary + talk button + gathering action row
 * 7. Fail/timeout: pulang ke desa dengan fail card
 * 
 * Timing Constants:
 * - CHOICE_MS: 15 detik untuk memilih aksi di lokasi
 * - QTE_MS: 5 detik untuk quick time event
 * - TALK_MS: 30 detik untuk opsi sapa warga setelah sukses
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const UserSurvival = require("../../../src/models/UserSurvival");
const UserPet = require("../../../src/models/UserPet");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const npcs = require("../../../src/survival/data/npcs");
const actions = require("../../../src/survival/helpers/collectActions");
const currency = require("../../../src/survival/engines/currency");
const {
  safeParseInventory,
} = require("../../../src/survival/engines/inventoryHelper");
const { getTimeState } = require("../../../src/survival/helpers/survivalTime");

// ============================================================================
// CONSTANTS
// ============================================================================

const CHOICE_MS = 15000;
const QTE_MS = 5000;
const TALK_MS = 30000;
const LOCATION_SELECT_MS = 30000;
const VITALS_MIN_THRESHOLD = 10;
const ENCOUNTER_CHANCE = 0.1;
const DELAY_BEFORE_LOOT_MS = 1500;


// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mengambil emoji dari config atau fallback ke unicode
 * @param {string} name - Nama emoji di config
 * @param {string} fallback - Unicode emoji fallback
 * @returns {string} Emoji string
 */
function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

/**
 * Membangun kartu penutup generik untuk akhir eksplorasi
 * @param {object} options - Opsi kartu
 * @param {string} options.title - Judul kartu
 * @param {string} options.description - Deskripsi kartu
 * @param {string} [options.expression] - Ekspresi mascot (default: "Happy")
 * @param {string} [options.colorKey] - Key warna dari ui config (default: "primary")
 * @param {Array} [options.buttonsRow] - Array button rows
 * @param {import('discord.js').User} user - User object untuk author name
 * @returns {object} Container V2 payload
 */
function closingCard({ title, description, expression, colorKey, buttonsRow }, user) {
  return buildContainerV2({
    accentColorHex: ui.getColor(colorKey || "primary"),
    authorName: `Perjalanan ${user.displayName || user.username}`,
    title,
    expression: expression || "Happy",
    description,
    buttonsRow,
    footerText: ui.getFooter("survival"),
  });
}

/**
 * Memfilter NPC yang hadir di lokasi tertentu pada jam in-game saat ini
 * @param {number} inGameHour - Jam in-game (0-23)
 * @param {string} lokasi - ID lokasi
 * @returns {Array} Array NPC objects yang hadir
 */
function getPresentNPCs(inGameHour, lokasi) {
  return Object.values(npcs).filter((npc) => {
    const loc =
      typeof npc.getLocation === "function"
        ? npc.getLocation(inGameHour)
        : npc.location;
    return loc === lokasi;
  });
}

/**
 * Membuat mock interaction object untuk recursive call dari location selector
 * @param {import('discord.js').ButtonInteraction} i - Button interaction asli
 * @param {string} chosenLoc - Lokasi yang dipilih
 * @returns {object} Mock interaction object
 */
function createMockInteraction(i, chosenLoc) {
  return {
    ...i,
    user: i.user,
    member: i.member,
    client: i.client,
    options: {
      getString: (name) => (name === "lokasi" ? chosenLoc : null),
    },
    editReply: (p) => i.editReply(p),
    reply: (p) => i.reply(p),
    followUp: (p) => i.followUp(p),
    deferred: true,
    replied: false,
  };
}

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  /**
   * Handler utama untuk command /survival collect
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (
      typeof interaction.deferUpdate === "function" &&
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferUpdate().catch(() => {});
    }

    const user = interaction.user;
    const lokasiOption = interaction.options?.getString?.("lokasi") || null;

    if (!lokasiOption) {
      const selectPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Resource Gathering",
        title: `${e("axe", "🪓")} Pusat Pengumpulan Bahan Alam`,
        description: [
          `Pilih lokasi alam yang ingin kamu kunjungi untuk mengumpulkan bahan baku petualangan:`,
          "",
          `🌲 **Pohon (Hutan)** : Kayu, Serat, Apel liar, Batu`,
          `⛏️ **Batu (Tambang)** : Bebatuan alam, Bijih Besi, Perak, Berlian`,
          `🌊 **Air (Laut)** : Ikan Salmon, Ikan Emas, Umpan pancing`,
          `🌿 **Rerumputan (Desa)** : Dedaunan, Serat herbal, Air mineral`,
          "",
          `> *Pastikan staminamu cukup sebelum berangkat mengais sumber daya!*`,
        ].join("\n"),
        buttonsRow: new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("gather_loc_hutan")
            .setLabel("🌲 Hutan")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("gather_loc_tambang")
            .setLabel("⛏️ Tambang")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("gather_loc_laut")
            .setLabel("🌊 Laut")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("gather_loc_desa")
            .setLabel("🌿 Desa")
            .setStyle(ButtonStyle.Secondary),
        ),
        footerText: ui.getFooter("survival"),
      });

      const replyMsg = await (interaction.deferred || interaction.replied
        ? interaction.editReply(selectPayload)
        : interaction.reply(selectPayload));

      if (
        !replyMsg ||
        typeof replyMsg.createMessageComponentCollector !== "function"
      ) {
        return;
      }

      const locCollector = replyMsg.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === user.id && i.customId.startsWith("gather_loc_"),
        time: LOCATION_SELECT_MS,
        max: 1,
      });

      locCollector.on("collect", async (i) => {
        await i.deferUpdate().catch(() => {});
        const chosenLoc = i.customId.replace("gather_loc_", "");
        const mockInteraction = createMockInteraction(i, chosenLoc);
        return module.exports.execute(mockInteraction);
      });

      return;
    }

    const lokasi = lokasiOption;

    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });
    const profile = await cacheManager.getUserProfile(user.id);

    if (survival.currentLocation === "prison") {
      return ui.sendError(
        interaction,
        "Kamu masih di dalam penjara, jadi belum bisa ke mana-mana. Sabar ya!",
        true,
      );
    }

    if (
      survival.hunger <= VITALS_MIN_THRESHOLD ||
      survival.thirst <= VITALS_MIN_THRESHOLD ||
      survival.stamina <= VITALS_MIN_THRESHOLD
    ) {
      return ui.sendError(
        interaction,
        `Naura nggak izinkan kamu ke **${lokasi}** dalam keadaan lemas begini. Makan, minum, atau tidur dulu ya!`,
        true,
      );
    }

    const inventory = safeParseInventory(profile.inventory);
    const gear = actions.gearCheck(lokasi, inventory);

    if (!gear.allowed) {
      return ui.sendError(
        interaction,
        `Kamu butuh ${e("fishing_rod")} **pancingan** dulu untuk melaut. Menangkap ikan pakai tangan itu mustahil, lho~`,
        true,
      );
    }

    const bareHands = Boolean(gear.bareHands);

    survival.currentLocation = lokasi;
    await cacheManager.updateUserSurvival(user.id, { currentLocation: lokasi });

    const timeState = getTimeState(survival.inGameHour || 6);
    const activePets = await UserPet.findAll({
      where: { userId: user.id, isActive: true },
    });

    let encounter = "";
    if (Math.random() < ENCOUNTER_CHANCE) {
      encounter =
        Math.random() < 0.5
          ? `\n\n${e("thief")} **Hati-hati!** Ada yang bergerak di semak-semak. Naura harap itu cuma kelinci...`
          : `\n\n${e("shop_box")} **Eh?** Ada jejak gerobak di tanah. Sepertinya Pak Damar baru lewat sini.`;
    }

    const presentNPCs = getPresentNPCs(survival.inGameHour || 6, lokasi);

    const bgInfo = survivalUI.getSurvivalBackground(lokasi, survival.inGameHour || 6);
    const files = bgInfo ? [bgInfo.attachment] : [];
    const bgName = bgInfo ? bgInfo.attachmentName : undefined;

    const choiceRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("collect_here")
        .setLabel("Cari di sini")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("collect_there")
        .setLabel("Cari di sana")
        .setStyle(ButtonStyle.Secondary),
    );

    if (presentNPCs.length > 0) {
      choiceRow.addComponents(
        new ButtonBuilder()
          .setCustomId("collect_talk_prep")
          .setLabel("Sapa warga")
          .setStyle(ButtonStyle.Success),
      );
    }

    const arrivalPayload = buildContainerV2({
      accentColorHex: timeState.color || ui.getColor("primary"),
      authorName: `Perjalanan ${user.displayName || user.username}`,
      title: `${e("lokasi")} Kamu sampai di ${String(lokasi).toUpperCase()}`,
      expression: "Happy",
      description: [
        bareHands
          ? "Alatnya belum ada, jadi kamu harus mengais pakai tangan kosong. Naura ikut prihatin, tapi tetap semangat ya!"
          : "Pilih dulu mau menjelajah bagian mana. Naura temani dari sini~",
        encounter,
      ]
        .filter(Boolean)
        .join(""),
      topBannerAttachmentName: bgName,
      files,
      buttonsRow: [choiceRow],
      footerText: ui.getFooter("survival"),
    });

    const response = await interaction.editReply(arrivalPayload);

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: CHOICE_MS,
      max: 1,
    });

    const finishSuccess = async (source) => {
      const result = await actions.grantLoot({
        userId: user.id,
        lokasi,
        bareHands,
        activePets,
      });

      if (!result.ok) {
        return source.editReply(
          closingCard({
            title: `${e("naura_cry")} Naura gagal mencatat hasilnya`,
            description:
              "Datamu belum bisa dibaca. Coba ulangi sebentar lagi ya, maaf banget!",
            expression: "Cry",
            colorKey: "error",
          }, user),
        );
      }

      const lootText = result.gained
        .map(
          (g) =>
            `> ${e("shop_box")} **${g.amount}x ${g.name}**${g.bonus ? " *(bonus!)*" : ""}`,
        )
        .join("\n");

      const talkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("collect_talk")
          .setLabel("Sapa warga desa")
          .setStyle(ButtonStyle.Success),
      );

      const actionRow = survivalUI.buildSurvivalActionRow("gathering", user.id);

      const payload = closingCard({
        title: `${e("naura_cheers")} Eksplorasi berhasil!`,
        description: [
          result.bareStory ||
            `Kamu menjelajah **${lokasi}** dan pulang membawa sesuatu!`,
          "",
          `**Yang kamu dapat:**`,
          lootText,
          "",
          `**Tenaga yang terpakai:**`,
          `> ${e("hunger")} Lapar -${result.cost.hunger} \u2022 ${e("thirst")} Haus -${result.cost.thirst}`,
          `> ${e("stamina")} Stamina -${result.cost.stamina} \u2022 ${e("clock")} Waktu +${result.hours} jam`,
          `> ${e("experience")} XP +${result.xp}`,
          "",
          `**Upah eksplorasi:**`,
          `> ${currency.format(currency.FRAGMENT, result.nsf || 0)}`,
          "",
          `${result.timeState.emoji} Sekarang hari ke-**${result.day}**, pukul ${String(result.hour).padStart(2, "0")}:00 (${result.timeState.label}).`,
          result.passedOut
            ? `\n${e("sick")} Kamu sempat tumbang di jalan dan ditolong warga. Istirahat dulu ya!`
            : "",
          "",
          "*Naura sudah antar kamu pulang ke desa.*",
        ]
          .filter(Boolean)
          .join("\n"),
        expression: "Cheers",
        colorKey: "success",
        buttonsRow: [talkRow, actionRow],
      }, user);

      const finalMsg = await source.editReply(payload);

      if (
        !finalMsg ||
        typeof finalMsg.createMessageComponentCollector !== "function"
      )
        return;

      const talkCollector = finalMsg.createMessageComponentCollector({
        filter: (btn) =>
          btn.user.id === user.id && btn.customId === "collect_talk",
        time: TALK_MS,
        max: 1,
      });

      talkCollector.on("collect", async (btn) => {
        await btn.deferUpdate();
        try {
          const npcHandler = require("./npc.js");
          await npcHandler.execute(btn, interaction.client);
        } catch (err) {
          await btn
            .followUp({
              ...closingCard({
                title: `${e("naura_akward")} Warganya sedang sibuk`,
                description:
                  "Belum ada yang bisa diajak bicara sekarang. Coba lagi nanti ya!",
                expression: "Akward",
                colorKey: "warning",
              }, user),
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      });
    };

    const finishFail = async (source, reason) => {
      await actions.goHome(user.id);
      const failCard = closingCard({
        title: `${e("naura_akward")} Sayang sekali...`,
        description: `${reason}\n\n*Naura antar kamu pulang ke desa dulu, ya.*`,
        expression: "Akward",
        colorKey: "error",
        buttonsRow: [survivalUI.buildSurvivalActionRow("gathering", user.id)],
      }, user);
      return source.editReply(failCard);
    };

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "collect_talk_prep") {
        try {
          const npcHandler = require("./npc.js");
          await npcHandler.execute(i, interaction.client);
        } catch (err) {
          await finishFail(i, "Warganya sedang tidak ada di tempat.");
        }
        return;
      }

      if (!bareHands && actions.shouldQte(lokasi)) {
        const buttons = [
          new ButtonBuilder()
            .setCustomId("qte_correct")
            .setLabel(
              lokasi === "laut"
                ? "TARIK!"
                : lokasi === "tambang"
                  ? "HANTAM!"
                  : "TEBANG!",
            )
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("qte_miss_a")
            .setLabel("TUNGGU")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("qte_miss_b")
            .setLabel("LEPAS")
            .setStyle(ButtonStyle.Secondary),
        ].sort(() => Math.random() - 0.5);

        let prompt = `${e("fishing_rod")} **Kena!** Pancinganmu ditarik kencang sekali!`;
        if (lokasi === "tambang")
          prompt = `${e("diamond")} **Urat mineral!** Bebatuannya keras, pukul di titik yang tepat!`;
        if (lokasi === "hutan")
          prompt = `${e("wood_mahogany")} **Pohon besar!** Ayunkan kapakmu dengan mantap!`;

        const qtePayload = closingCard({
          title: `${e("naura_shocked")} Cepat, ambil keputusan!`,
          description: `${prompt}\n\nTekan tombol yang benar dalam **5 detik**! Naura ikut deg-degan~`,
          expression: "Shocked",
          colorKey: "warning",
          buttonsRow: [new ActionRowBuilder().addComponents(buttons)],
        }, user);

        const qteMsg = await i.editReply(qtePayload);

        const qteCollector = qteMsg.createMessageComponentCollector({
          filter: (btn) => btn.user.id === user.id,
          time: QTE_MS,
          max: 1,
        });

        qteCollector.on("collect", async (btn) => {
          await btn.deferUpdate();
          if (btn.customId === "qte_correct") await finishSuccess(btn);
          else
            await finishFail(
              btn,
              "Langkahmu kurang tepat, targetnya lepas begitu saja.",
            );
        });

        qteCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await finishFail(
              i,
              "Waktunya habis, kamu terlambat bereaksi.",
            ).catch(() => {});
          }
        });

        return;
      }

      const waitPayload = closingCard({
        title: `${e("naura_thinking")} Sedang mencari...`,
        description: "Naura ikut mengintip sekeliling. Sebentar ya~",
        expression: "Thinking",
        colorKey: "info",
      }, user);
      await i.editReply(waitPayload);

      setTimeout(() => {
        finishSuccess(i).catch(() => {});
      }, DELAY_BEFORE_LOOT_MS).unref?.();
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await actions.goHome(user.id);
        await interaction
          .editReply(
            closingCard({
              title: `${e("naura_sleepy")} Kamu melamun kelamaan`,
              description:
                "Waktunya habis, jadi Naura antar kamu pulang ke desa dulu. Tidak ada tenaga yang terbuang, kok!",
              expression: "Sleepy",
              colorKey: "warning",
            }, user),
          )
          .catch(() => {});
      }
    });
  },
};
