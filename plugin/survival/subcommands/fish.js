"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  safeParseInventory,
  countStack,
  addItemsAtomic,
  takeItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const questGen = require("../../../src/survival/engines/questGenerator");
const achievementHelper = require("../../../src/survival/helpers/achievementHelper");

const STAMINA_COST = 10;
const REACTION_MS = 2500;
const WAIT_MIN_MS = 3000;
const WAIT_SPAN_MS = 4000;
const BAIT_ID = "worm_bait";

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function rollCatch() {
  const rand = Math.random() * 100;

  if (rand < 50) {
    return {
      id: "trash",
      name: "Sampah Plastik",
      emoji: e("trash", "\uD83D\uDDD1\uFE0F"),
      mood: "fail",
    };
  }
  if (rand < 90) {
    return {
      id: "salmon",
      name: "Ikan Salmon",
      emoji: e("fish", "\uD83D\uDC1F"),
      mood: "success",
    };
  }
  return {
    id: "golden_fish",
    name: "Ikan Mas Koki",
    emoji: e("goldfish", "\uD83D\uDC21"),
    mood: "reward",
  };
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const action = interaction.options?.getString("aksi") || "cast";
    const zone = interaction.options?.getString("zona");
    const fishInput = interaction.options?.getString("ikan");

    // 1. LIHAT VIVARIUM AQUARIUM
    if (action === "vivarium") {
      const vivariumEngine = require("../../../src/survival/engines/vivariumEngine");
      const { drawVivarium } = require("../../../src/canvas/vivariumCanvas");
      const { AttachmentBuilder } = require("discord.js");

      const vivarium = await vivariumEngine.getVivarium(user.id);
      const files = [];
      try {
        const vivBuf = await drawVivarium(vivarium);
        files.push(new AttachmentBuilder(vivBuf, { name: "vivarium.png" }));
      } catch (err) {
        // Fallback
      }

      const fishList =
        vivarium.fishes
          .map(
            (f) =>
              `**• ${f.emoji} ${f.name}** (\`${f.rarity}\` | +${f.ticketYield} ${ui.getEmoji("star") || "⭐"}/jam)`,
          )
          .join("\n") || "*Belum ada ikan di akuarium.*";

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: `${ui.getEmoji("water") || "🌊"} Holographic Deep-Sea Vivarium`,
        title: `${ui.getEmoji("sparkles") || "✨"} Akuarium Virtual Milik ${user.displayName || user.username}`,
        description: [
          `Selamat datang di akuarium holografis laut dalam milikmu!`,
          ``,
          `${ui.getEmoji("ticket") || "🎟️"} **Pendapatan Tiket:** \`+${vivarium.hourlyIncome} Star Fragments / jam\``,
          `${ui.getEmoji("fish") || "🐟"} **Koleksi Spesies (${vivarium.totalFishes}/10 Ekor):**`,
          fishList,
          ``,
          `-# ${ui.getEmoji("sparkle") || "💡"} *Gunakan \`/survival activity fish aksi:collect\` untuk menarik koin atau pancing ikan laut dalam baru dengan opsi \`zona:Midnight Trench\`!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, files });
    }

    // 2. KLAIM TIKET PENGUNJUNG VIVARIUM
    if (action === "collect") {
      const vivariumEngine = require("../../../src/survival/engines/vivariumEngine");
      const collectRes = await vivariumEngine.claimTicketRevenue(user.id);

      if (!collectRes.success) {
        const payload = buildContainerV2({
          accentColorHex: "#F59E0B",
          title: "Tiket Belum Tersedia",
          description:
            "Belum ada akumulasi koin tiket pengunjung yang bisa ditarik saat ini.",
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(payload);
      }

      const payload = buildContainerV2({
        accentColorHex: "#86EFAC",
        authorName: `${ui.getEmoji("ticket") || "🎟️"} Loket Tiket Vivarium`,
        title: `${ui.getEmoji("sparkles") || "✨"} Hasil Tiket Pengunjung Masuk Kas!`,
        description: `Kamu berhasil mengklaim **+${collectRes.revenue.toLocaleString("id-ID")} Star Fragments** dari hasil kunjungan akuarium selama ${collectRes.hoursPassed} jam terakhir!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 3. TARUH IKAN KE VIVARIUM
    if (action === "deposit") {
      const vivariumEngine = require("../../../src/survival/engines/vivariumEngine");
      const targetFishId = fishInput || "neon_guppy";
      const depRes = await vivariumEngine.depositFish(user.id, targetFishId);

      if (!depRes.success) {
        let msg = "Gagal menempatkan ikan ke akuarium.";
        if (depRes.reason === "INVALID_FISH")
          msg =
            "ID Ikan tidak valid! Pilihan: `neon_guppy`, `prism_clownfish`, `cyber_anglerfish`, `phantom_eel`, `astral_jellyfish`.";
        if (depRes.reason === "VIVARIUM_FULL")
          msg = "Akuarium sudah penuh (Maksimal 10 ekor ikan)!";

        const payload = buildContainerV2({
          accentColorHex: "#EF4444",
          title: "Gagal Menempatkan Ikan",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(payload);
      }

      const payload = buildContainerV2({
        accentColorHex: "#86EFAC",
        authorName: `${ui.getEmoji("water") || "🌊"} Ekosistem Vivarium Diperbarui`,
        title: `${ui.getEmoji("celebrate") || "🎉"} Ikan Baru Masuk Akuarium!`,
        description: `**${depRes.fish.emoji} ${depRes.fish.name}** berhasil ditempatkan di dalam Vivarium! Pendapatan tiket naik menjadi **+${depRes.newHourlyIncome} ${ui.getEmoji("star") || "⭐"}/jam**!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 4. DEEP-SEA FISHING (Jika zona ditentukan)
    if (zone) {
      const vivariumEngine = require("../../../src/survival/engines/vivariumEngine");
      const deepRes = await vivariumEngine.castDeepSea(user.id, zone);

      if (!deepRes.success) {
        const payload = buildContainerV2({
          accentColorHex: "#EF4444",
          title: "Energi Tidak Cukup",
          description: `Kamu membutuhkan ${deepRes.cost || 15} Energy untuk memancing di zona laut dalam ${zone}!`,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(payload);
      }

      const caught = deepRes.fish;
      const payload = buildContainerV2({
        accentColorHex:
          caught.rarity === "MYTHIC"
            ? "#FFD700"
            : caught.rarity === "EPIC"
              ? "#C084FC"
              : "#38BDF8",
        authorName: `${ui.getEmoji("water") || "🌊"} Deep-Sea Cyber-Fishing (${deepRes.zone})`,
        title: `${ui.getEmoji("celebrate") || "🎉"} Berhasil Menangkap: ${caught.emoji} ${caught.name}!`,
        description: [
          `Kail laut dalammu berhasil mengangkat spesies langka dari kegelapan samudra!`,
          ``,
          `${ui.getEmoji("star") || "⭐"} **Kelangkaan:** \`${caught.rarity}\``,
          `${ui.getEmoji("coin") || "💵"} **Nilai Jual Pasar:** \`${caught.price} Star Fragments\``,
          `${ui.getEmoji("ticket") || "🎟️"} **Yield Tiket Akuarium:** \`+${caught.ticketYield} ${ui.getEmoji("star") || "⭐"}/jam\``,
          ``,
          `-# ${ui.getEmoji("sparkle") || "💡"} *Tempatkan ikan ini di akuarium dengan \`/survival activity fish aksi:deposit ikan:${caught.id}\`!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    const profile = await cacheManager.getUserProfile(user.id);
    const inventory = safeParseInventory(profile.inventory);
    const hasRod = inventory.some((i) => i && i.id === "fishing_rod");

    if (!hasRod) return ui.sendError(interaction, "err_sys_46", true);
    if (countStack(inventory, BAIT_ID) <= 0)
      return ui.sendError(interaction, "err_sys_47", true);

    const paid = await cacheManager.debitUserSurvival(
      user.id,
      "stamina",
      STAMINA_COST,
    );
    if (!paid.ok) return ui.sendError(interaction, "err_sys_48", true);

    // Umpan diambil lewat transaksi terkunci. Pola lama mengurangi amount di
    // memori lalu menulis ulang seluruh tas, sehingga dua pancingan yang tiba
    // bersamaan hanya memakan satu umpan.
    const usedBait = await takeItemsAtomic(user.id, [
      { id: BAIT_ID, amount: 1 },
    ]);

    if (!usedBait.ok) {
      // Umpannya ternyata sudah habis dipakai proses lain. Tenaganya
      // dikembalikan supaya pemain tidak dirugikan tanpa memancing.
      await cacheManager.incrementUserSurvival(user.id, {
        stamina: STAMINA_COST,
      });
      return ui.sendError(interaction, "err_sys_47", true);
    }

    const waitingPayload = buildContainerV2({
      accentColorHex: "#3b82f6",
      authorName: "Naura Fishing Spot",
      title: `${e("happy", "\uD83C\uDFA3")} Memancing di Pantai Utara`,
      iconURL: user.displayAvatarURL(),
      expression: "loading",
      description:
        "Kailmu sudah melayang ke laut. Naura ikut duduk di sebelah kamu sambil menunggu...\n\n> Sabar ya, ikannya belum menggigit.",
      footerText: ui.getFooter("survival"),
    });

    // Perintah survival sudah di-defer orkestrator, jadi wajib editReply.
    const message = await interaction.editReply({
      ...waitingPayload,
      embeds: [],
    });
    const waitTime = Math.floor(Math.random() * WAIT_SPAN_MS) + WAIT_MIN_MS;

    setTimeout(async () => {
      try {
        const pullBtn = new ButtonBuilder()
          .setCustomId("fish_pull")
          .setLabel("TARIK KAIL!")
          .setStyle(ButtonStyle.Success)
          .setEmoji(
            ui.parseEmoji(e("fishing_rod", "\uD83C\uDFA3")) || {
              name: "\uD83C\uDFA3",
            },
          );

        const row = new ActionRowBuilder().addComponents(pullBtn);

        const alertPayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: "Naura Fishing Spot",
          title: `${e("shocked", "\u203C\uFE0F")} Ada yang menggigit!`,
          iconURL: user.displayAvatarURL(),
          expression: "warning",
          description:
            "**Cepat tarik kailnya sebelum ikannya kabur!** Ayo, Naura percaya sama refleks kamu!",
          footerText: ui.getFooter("survival"),
        });

        await interaction.editReply({
          ...alertPayload,
          embeds: [],
          components: [...alertPayload.components, row],
        });

        const collector = message.createMessageComponentCollector({
          filter: (i) => i.user.id === user.id,
          time: REACTION_MS,
        });

        let pulled = false;

        collector.on("collect", async (i) => {
          pulled = true;
          collector.stop("pulled");
          await i.deferUpdate().catch(() => {});

          const catchResult = rollCatch();
          let amount = 1;

          // === SEASONAL EVENT BOOST ===
          const {
            getCurrentSeason,
            checkNauraBirthdayEncounter,
          } = require("../../../src/survival/helpers/survivalContext");
          const season = getCurrentSeason();
          const seasonDrops = [];
          if (season) {
            amount = Math.max(1, Math.floor(amount * season.dropBoost));
            if (season.exclusiveItem && Math.random() < 0.25) {
              seasonDrops.push({
                id: season.exclusiveItem,
                name: "Event Item",
                amount: 1,
                type: "loot",
              });
            }
          }

          const itemsToStore = [
            {
              id: catchResult.id,
              name: catchResult.name,
              amount: amount,
              type: "loot",
            },
            ...seasonDrops,
          ];
          const stored = await addItemsAtomic(user.id, itemsToStore);

          if (!stored.ok) {
            const writeFailPayload = buildContainerV2({
              accentColorHex: ui.getColor("warning") || "#FFB347",
              authorName: "Naura Fishing Spot",
              title: `${e("cry", "\uD83D\uDCA6")} Tangkapannya gagal dicatat`,
              iconURL: user.displayAvatarURL(),
              expression: "fail",
              description:
                "Kailnya kena, tapi Naura gagal mencatat tangkapannya ke dalam tas kamu. Maaf ya, coba sebentar lagi.",
              footerText: ui.getFooter("survival"),
            });

            await interaction
              .editReply({ ...writeFailPayload, embeds: [] })
              .catch(() => {});
            return;
          }

          const lines =
            catchResult.id === "trash"
              ? [
                  "Aduh... yang kena kail malah sampah. Nggak apa-apa, sekalian bersihkan laut ya!",
                  "",
                  `**${e("cheers", "\uD83C\uDF81")} Tangkapanmu**`,
                  `> ${catchResult.emoji} **${amount}x ${catchResult.name}**`,
                ]
              : [
                  "Waa, refleksmu cepat banget! Kailnya kamu tarik tepat pada waktunya. Naura kagum!",
                  "",
                  `**${e("cheers", "\uD83C\uDF81")} Tangkapanmu**`,
                  `> ${catchResult.emoji} **${amount}x ${catchResult.name}**`,
                ];

          if (season) {
            if (season.dropBoost > 1.0) {
              lines.push(
                `\n${e("impressed", "\u2728")} **[${season.label}]** Hasil tangkapan meningkat x${season.dropBoost}!`,
              );
            }
            if (seasonDrops.length > 0) {
              lines.push(
                `${e("cheers", "\uD83C\uDF81")} **[${season.label}]** Kamu juga mendapatkan item eksklusif event!`,
              );
            }
          }

          if (catchResult.id === "golden_fish") {
            lines.push(
              "",
              `${e("shocked", "\u2728")} Ini Ikan Mas Koki yang langka banget! Naura sampai kaget lihatnya.`,
            );
          }

          const successPayload = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFC0CB",
            authorName: "Naura Fishing Spot",
            title: `${e("cheers", "\uD83C\uDF89")} Kailnya kena!`,
            iconURL: user.displayAvatarURL(),
            expression: catchResult.mood,
            description: lines.join("\n"),
            footerText: ui.getFooter("survival"),
          });

          await interaction
            .editReply({ ...successPayload, embeds: [] })
            .catch(() => {});

          await questGen
            .incrementQuestProgress(user.id, "collect", 1)
            .catch(() => {});

          if (catchResult.id === "golden_fish") {
            await achievementHelper.unlockAchievement(
              interaction,
              "master_angler",
            );
          }

          await checkNauraBirthdayEncounter(interaction, user.id);
        });

        collector.on("end", async () => {
          if (pulled) return;

          const failPayload = buildContainerV2({
            accentColorHex: ui.getColor("warning") || "#FFB347",
            authorName: "Naura Fishing Spot",
            title: `${e("cry", "\uD83D\uDCA6")} Ikannya kabur`,
            iconURL: user.displayAvatarURL(),
            expression: "fail",
            description:
              "Yah, sedikit terlambat menariknya. Umpannya habis dimakan dan ikannya melenggang pergi. Jangan sedih, lempar kail lagi ya, Naura tunggu di sini!",
            footerText: ui.getFooter("survival"),
          });

          await interaction
            .editReply({ ...failPayload, embeds: [] })
            .catch(() => {});
        });
      } catch (err) {
        // Timer berjalan di luar alur perintah, jadi galatnya harus
        // ditelan supaya tidak menjatuhkan proses bot.
      }
    }, waitTime);
  },
};
