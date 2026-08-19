"use strict";

// Eksplorasi lokasi. Tabel jarahan dan pemrosesan hadiah ada di
// plugin/survival/collectActions.js, berkas ini hanya mengatur adegannya.
//
// Perbaikan penting dari versi lama:
// - kartu keberhasilan dulu memanggil `successEmbed` yang tidak pernah dibuat,
//   sehingga eksplorasi yang berhasil selalu berakhir dengan error,
// - `client` dipakai tanpa pernah didefinisikan saat memanggil NPC,
// - pakai editReply karena survival.js sudah menunda balasan,
// - pemain diantar pulang ke 'desa', bukan 'village' yang tidak dikenal NPC,
// - perpindahan lokasi ditulis lewat cacheManager, bukan `survival.save()`,
//   supaya cache `user:survival` tidak menyimpan lokasi lama sampai TTL habis.

const fs = require("fs");
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
const UserSurvival = require("../../../src/models/UserSurvival");
const UserPet = require("../../../src/models/UserPet");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const npcs = require("../../../src/survival/data/npcs");
const actions = require("../../../src/survival/helpers/collectActions");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const { getTimeState } = require("../../../src/survival/helpers/survivalTime");

const CHOICE_MS = 15000;
const QTE_MS = 5000;
const TALK_MS = 30000;
const BG_NAME = "location.jpeg";

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const lokasi = interaction.options.getString("lokasi");

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
      survival.hunger <= 10 ||
      survival.thirst <= 10 ||
      survival.stamina <= 10
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

    // Lewat cacheManager supaya cache dan database sepakat. `survival.save()`
    // menulis langsung ke MySQL dan meninggalkan cache berisi lokasi lama.
    survival.currentLocation = lokasi;
    await cacheManager.updateUserSurvival(user.id, { currentLocation: lokasi });

    const timeState = getTimeState(survival.inGameHour || 6);
    const activePets = await UserPet.findAll({
      where: { userId: user.id, isActive: true },
    });

    // Kejadian kecil di jalan supaya tiap perjalanan terasa berbeda.
    let encounter = "";
    if (Math.random() < 0.1) {
      encounter =
        Math.random() < 0.5
          ? `\n\n${e("thief")} **Hati-hati!** Ada yang bergerak di semak-semak. Naura harap itu cuma kelinci...`
          : `\n\n${e("shop_box")} **Eh?** Ada jejak gerobak di tanah. Sepertinya Pak Damar baru lewat sini.`;
    }

    const presentNPCs = Object.values(npcs).filter((npc) => {
      const loc =
        typeof npc.getLocation === "function"
          ? npc.getLocation(survival.inGameHour || 6)
          : npc.location;
      return loc === lokasi;
    });

    const bgPath = ui.getSurvivalBackground(lokasi, survival.inGameHour || 6);
    const files =
      bgPath && fs.existsSync(bgPath)
        ? [new AttachmentBuilder(bgPath, { name: BG_NAME })]
        : [];

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
      bannerAttachmentName: files.length > 0 ? BG_NAME : undefined,
      files,
      footerText: ui.getFooter("survival"),
    });

    const response = await interaction.editReply({
      ...arrivalPayload,
      components: [...arrivalPayload.components, choiceRow],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: CHOICE_MS,
      max: 1,
    });

    /** Kartu penutup setelah semua urusan di lokasi selesai. */
    const closingCard = ({ title, description, expression, colorKey }) =>
      buildContainerV2({
        accentColorHex: ui.getColor(colorKey || "primary"),
        authorName: `Perjalanan ${user.displayName || user.username}`,
        title,
        expression: expression || "Happy",
        description,
        footerText: ui.getFooter("survival"),
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
          }),
        );
      }

      const lootText = result.gained
        .map((g) => `> ${e("shop_box")} **${g.amount}x ${g.name}**`)
        .join("\n");

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
      });

      const talkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("collect_talk")
          .setLabel("Sapa warga desa")
          .setStyle(ButtonStyle.Success),
      );

      const finalMsg = await source.editReply({
        ...payload,
        components: [...payload.components, talkRow],
      });

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
              }),
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      });
    };

    const finishFail = async (source, reason) => {
      await actions.goHome(user.id);
      return source.editReply(
        closingCard({
          title: `${e("naura_akward")} Sayang sekali...`,
          description: `${reason}\n\n*Naura antar kamu pulang ke desa dulu, ya.*`,
          expression: "Akward",
          colorKey: "error",
        }),
      );
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

      // --- Quick Time Event ---
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
        });

        const qteMsg = await i.editReply({
          ...qtePayload,
          components: [
            ...qtePayload.components,
            new ActionRowBuilder().addComponents(buttons),
          ],
        });

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

      // --- Tanpa QTE: langsung mengais ---
      const waitPayload = closingCard({
        title: `${e("naura_thinking")} Sedang mencari...`,
        description: "Naura ikut mengintip sekeliling. Sebentar ya~",
        expression: "Thinking",
        colorKey: "info",
      });
      await i.editReply(waitPayload);

      setTimeout(() => {
        finishSuccess(i).catch(() => {});
      }, 1500);
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
            }),
          )
          .catch(() => {});
      }
    });
  },
};
