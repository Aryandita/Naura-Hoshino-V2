"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const currency = require("../../../src/survival/engines/currency");
const worldMapData = require("../../../src/survival/data/worldMapData");
const poiEngine = require("../../../src/survival/engines/poiEngine");
const townEngine = require("../../../src/survival/engines/townEngine");

const COLLECTOR_MS = 90000;

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });
    const profile = await cacheManager.getUserProfile(user.id);

    const now = new Date();
    const inGameHour = (now.getUTCHours() * 2) % 24;

    const locKey = survival.currentLocation || "desa_sukamaju";
    const region = worldMapData.getRegion(locKey) || worldMapData.REGIONS.desa_sukamaju;

    const activePois = poiEngine.getActivePois(region.id, inGameHour);
    const townState = townEngine.getTownSquareState(inGameHour);
    const merchant = await townEngine
      .getWanderingMerchant()
      .catch(() => ({ isPresent: false, items: [] }));

    let selectedPoiId = null;

    const buildPayload = (extraSnippet = "") => {
      const descLines = [
        `> *"${region.description}"*`,
        "",
        `⏰ **Waktu Wilayah:** Jam ${String(inGameHour).padStart(2, "0")}:00 (${townState.period.toUpperCase()})`,
        `💰 **Mata Uang Utama:** **${region.primaryCurrency}**`,
      ];

      if (region.id === "kota_pratama") {
        descLines.push(
          `🏦 **Layanan Bank Pratama:** Kamu dapat menukarkan Naura Star Fragments (NSF) ke Naura Coin (NC) di sini!`,
        );
      }

      if (merchant.isPresent) {
        descLines.push(
          "",
          `🧳 **Pedagang Pengembara Hadir:** *"${merchant.merchantName}"* (${merchant.merchantTitle}) sedang menggelar lapak relik langka!`,
        );
      }

      descLines.push(
        "",
        "📍 **Gedung & Titik Kunjungan (POIs) di Wilayah Ini:**",
        ...activePois.map((p) => {
          const statusTag = p.isOpen ? "🟢 Buka" : "🔴 Tutup";
          const npcNames = p.residents.map((r) => r.name).join(", ") || "Penjaga Otomatis";
          return `• **${p.emoji} ${p.name}** [${statusTag}]\n  > Pengelola: *${npcNames}*`;
        }),
      );

      if (extraSnippet) {
        descLines.push("", extraSnippet);
      }

      // 1. Select menu untuk mengunjungi POI
      const poiOptions = activePois.slice(0, 25).map((p) => ({
        label: p.name.substring(0, 100),
        description: `${p.isOpen ? "Buka" : "Tutup"} - Pengelola: ${p.residents.map((r) => r.name).join(", ") || "Umum"}`.substring(0, 100),
        value: p.id,
        emoji: p.emoji || "📍",
      }));

      // 2. Select menu sapa penduduk
      const npcList = [];
      for (const p of activePois) {
        for (const r of p.residents) {
          if (!npcList.some((n) => n.id === r.id)) {
            npcList.push({ ...r, poiName: p.name });
          }
        }
      }

      const npcOptions = npcList.slice(0, 25).map((n) => ({
        label: `Sapa ${n.name}`,
        description: `${n.title} di ${n.poiName}`.substring(0, 100),
        value: n.id,
        emoji: "👋",
      }));

      const rows = [];
      if (poiOptions.length > 0) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("town_select_poi")
              .setPlaceholder("Pilih gedung / titik kunjungan untuk diinspeksi...")
              .addOptions(poiOptions),
          ),
        );
      }

      if (npcOptions.length > 0) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("town_greet_npc")
              .setPlaceholder("Pilih penduduk setempat untuk disapa...")
              .addOptions(npcOptions),
          ),
        );
      }

      if (region.id === "kota_pratama") {
        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("town_exchange_nsf")
              .setLabel("Tukar 500 NSF -> 500 NC (Bank Pratama)")
              .setEmoji("🏦")
              .setStyle(ButtonStyle.Success),
          ),
        );
      }

      return {
        ...buildContainerV2({
          accentColorHex: region.themeColor || "#10B981",
          authorName: `Naura Wilds - ${region.name}`,
          title: `🗺️ ${region.title}`,
          description: descLines.join("\n"),
          footerText: ui.getFooter("survival"),
        }),
        components: rows,
      };
    };

    const initialPayload = buildPayload();
    const reply = await interaction.editReply(initialPayload);
    if (!reply) return;

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "town_select_poi") {
        await i.deferUpdate().catch(() => {});
        selectedPoiId = i.values[0];
        const detail = await poiEngine.getPoiDetail(selectedPoiId, inGameHour, user.id);

        if (!detail) {
          const payload = buildPayload("⚠️ Tempat yang kamu tuju sedang tidak dapat diakses.");
          return i.editReply(payload).catch(() => {});
        }

        const residentLines = detail.residents.map((r) => {
          const discountInfo = r.discountPercent > 0 ? ` (Diskon Relasi: ${r.discountPercent}%)` : "";
          return `• **${r.name}** [${r.relationshipTitle} - ${r.affection} RP]${discountInfo}\n  > *"${r.personality}"*`;
        });

        const snippet = [
          `🏢 **Kamu sedang berada di:** **${detail.name}** [${detail.statusLabel}]`,
          `> *"${detail.atmosphere}"*`,
          "",
          "👥 **Penghuni / Pengelola yang Ditemui:**",
          residentLines.length > 0 ? residentLines.join("\n") : "• Tidak ada pengelola tetap di lokasi ini.",
          "",
          `🛠️ **Fasilitas Tersedia:** ${detail.facilities.join(", ")}`,
        ].join("\n");

        const updatedPayload = buildPayload(snippet);
        await i.editReply(updatedPayload).catch(() => {});
      } else if (i.customId === "town_greet_npc") {
        await i.deferUpdate().catch(() => {});
        const selectedNpcId = i.values[0];
        const result = await townEngine.talkToTownNpc(selectedNpcId, user.id, inGameHour);

        const targetNpc = activePois
          .flatMap((p) => p.residents)
          .find((n) => n.id === selectedNpcId);
        const npcName = targetNpc ? targetNpc.name : "Penduduk";

        const talkSnippet = [
          `💬 **${npcName}:** "${result.reply}"`,
          result.affinityText ? result.affinityText : "",
          result.bonusText ? result.bonusText : "",
        ]
          .filter(Boolean)
          .join("\n");

        const updatedPayload = buildPayload(talkSnippet);
        await i.editReply(updatedPayload).catch(() => {});
      } else if (i.customId === "town_exchange_nsf") {
        await i.deferUpdate().catch(() => {});
        // Kurs: 500 NSF -> 500 NC di Bank Kota Pratama
        const currentNsf = currency.balanceOf(currency.FRAGMENT, { survival, profile });
        if (currentNsf < 500) {
          const errPayload = buildPayload("⚠️ **Bank Pratama:** Saldo Naura Star Fragments (NSF) milikmu kurang dari 500 NSF.");
          return i.editReply(errPayload).catch(() => {});
        }

        const debit = await currency.charge(currency.FRAGMENT, { survival, profile }, 500);
        if (!debit) {
          const errPayload = buildPayload("⚠️ **Bank Pratama:** Gagal memotong saldo NSF.");
          return i.editReply(errPayload).catch(() => {});
        }

        await cacheManager.incrementUserProfile(user.id, { economy_wallet: 500 });
        const successSnippet = "🏦 **Transaksi Sukses:** Kamu menukarkan **500 NSF** menjadi **500 Naura Coin (NC)** di Bank Sentral Pratama!";
        const updatedPayload = buildPayload(successSnippet);
        await i.editReply(updatedPayload).catch(() => {});
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
