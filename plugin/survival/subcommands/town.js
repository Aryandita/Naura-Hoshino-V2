"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const townEngine = require("../../../src/survival/engines/townEngine");

const COLLECTOR_MS = 60000;

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const now = new Date();
    const inGameHour = (now.getUTCHours() * 2) % 24;

    const townState = townEngine.getTownSquareState(inGameHour);
    const merchant = await townEngine.getWanderingMerchant().catch(() => ({ isPresent: false, items: [] }));

    const npcOptions = townState.activeNpcs.map((npc) => ({
      label: `Sapa ${npc.name}`,
      description: `${npc.title} - ${npc.personality}`.substring(0, 100),
      value: npc.id,
      emoji: "👋",
    }));

    const merchantOptions = merchant.isPresent
      ? merchant.items.map((it) => ({
          label: `Beli ${it.name}`,
          description: `${it.price.toLocaleString("id-ID")} NSF - ${it.description}`.substring(0, 100),
          value: it.id,
          emoji: it.emoji || "💎",
        }))
      : [];

    const buildPayload = (extraDesc = "") => {
      const descLines = [
        `> *"${townState.atmosphere}"*`,
        "",
        `⏰ **Waktu Kota:** Jam ${String(inGameHour).padStart(2, "0")}:00 (${townState.period.toUpperCase()})`,
        `🎪 **Event Alun-Alun:** **${townState.eventName}**`,
        `✨ **Efek Khusus:** ${townState.eventBonus}`,
      ];

      if (merchant.isPresent) {
        descLines.push(
          "",
          `🧳 **Pedagang Pengembara Hadir:** *"${merchant.merchantName}"* (${merchant.merchantTitle}) sedang menggelar lapak relik langka!`,
          `- Saldo Kas Subsidi Daur Ulang: \`${merchant.poolBalance.toLocaleString("id-ID")} NSF\``
        );
      }

      descLines.push(
        "",
        "👥 **Penduduk yang Sedang Berada di Alun-Alun:**",
        ...townState.activeNpcs.map(
          (n) => `• **${n.name}** (${n.title})`
        ),
      );

      if (extraDesc) {
        descLines.push("", extraDesc);
      }

      const rows = [];
      if (npcOptions.length > 0) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("town_greet_npc")
              .setPlaceholder("Pilih penduduk untuk disapa...")
              .addOptions(npcOptions)
          )
        );
      }

      if (merchant.isPresent && merchantOptions.length > 0) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("town_buy_merchant")
              .setPlaceholder("Beli relik dari Pedagang Pengembara...")
              .addOptions(merchantOptions)
          )
        );
      }

      return {
        ...buildContainerV2({
          accentColorHex: "#38BDF8",
          authorName: "Naura Wilds - Alun-Alun Kota",
          title: `🏛️ ${townState.title}`,
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
      if (i.customId === "town_greet_npc") {
        await i.deferUpdate().catch(() => {});
        const selectedNpcId = i.values[0];
        const result = await townEngine.talkToTownNpc(selectedNpcId, user.id, inGameHour);

        const targetNpc = townState.activeNpcs.find((n) => n.id === selectedNpcId);
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
      } else if (i.customId === "town_buy_merchant") {
        await i.deferUpdate().catch(() => {});
        const selectedItemId = i.values[0];
        const buyResult = await townEngine.buyFromWanderingMerchant(user.id, selectedItemId);

        let snippet = "";
        if (buyResult.ok) {
          snippet = `🛍️ **Transaksi Berhasil!** Kamu membeli **${buyResult.item.name}** seharga \`${buyResult.cost.toLocaleString("id-ID")} NSF\` dari Pedagang Pengembara!`;
        } else {
          snippet = `⚠️ **Gagal Membeli:** ${buyResult.message}`;
        }

        const updatedPayload = buildPayload(snippet);
        await i.editReply(updatedPayload).catch(() => {});
      }
    });

    collector.on("end", async () => {
      // Hilangkan components saat timeout
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
