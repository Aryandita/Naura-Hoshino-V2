"use strict";

// Pasar Tradisional Desa. Stok dan transaksinya ada di plugin/survival/marketStock.js,
// berkas ini hanya mengatur percakapan dan tampilannya.
//
// Perbaikan penting dari versi lama:
// - lokasi diperiksa sebagai 'desa' (dulu 'village', sehingga pasarnya tidak pernah terbuka),
// - pakai editReply karena survival.js sudah menunda balasan,
// - hasil penjualan benar-benar masuk ke dompet,
// - nilai pilihan memakai pemisah pipa supaya id bergaris bawah tidak terpotong.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const market = require("../../../src/survival/helpers/marketStock");
const currencyHelper = require("../../../src/survival/engines/currency");
const { SHOPS, say } = require("../../../src/survival/data/shopkeepers");
const { getSeason, getWeather } = require("../../../src/survival/helpers/survivalTime");
const { getDifficultyConfig } = require("../../../src/survival/helpers/difficultyHelper");

const COLLECTOR_MS = 120000;
const BANNER_NAME = "banner.png";
const MAX_OPTIONS = 25;
const VILLAGE_KEYS = ["desa", "village"];
const FRAGMENT = currencyHelper.byKind(currencyHelper.FRAGMENT);

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

function n(value) {
  return (Number(value) || 0).toLocaleString("id-ID");
}

function hidden(payload) {
  return {
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  };
}

module.exports = {
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: interaction.user.id },
    });
    
    if (!VILLAGE_KEYS.includes(survival.currentLocation)) {
      return interaction.respond([]).catch(() => {});
    }

    const diffConfig = getDifficultyConfig(
      survival.rpg_state?.difficulty || "Normal",
    );

    const available = [];
    for (const cat of Object.keys(market.CATEGORIES)) {
      const pool = market.poolFor(cat, diffConfig);
      pool.forEach((it) => {
        available.push({
          name: `${it.name} (${n(it.finalPrice)} NSF)`,
          value: market.encode(it.id, it.finalPrice, 1),
        });
      });
    }

    const filtered = available
      .filter((it) => it.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);
    await interaction.respond(filtered).catch(() => {});
  },

  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (survival.currentLocation === "prison")
      return ui.sendError(interaction, "err_sys_51", true);
    if (!VILLAGE_KEYS.includes(survival.currentLocation))
      return ui.sendError(interaction, "err_sys_52", true);

    const vendor = SHOPS.desa;
    const vars = { nama: user.displayName || user.username };
    const season = getSeason(survival.inGameDay || 1);
    const weather = getWeather(
      survival.inGameDay || 1,
      survival.inGameHour || 6,
    );
    const diffConfig = getDifficultyConfig(
      survival.rpg_state?.difficulty || "Normal",
    );

    const banner = ui.getBanner("shop");
    const bannerFiles = banner
      ? [new AttachmentBuilder(banner, { name: BANNER_NAME })]
      : [];

    const walletNow = async () => {
      const freshProfile = await cacheManager.getUserProfile(user.id);
      const freshSurvival = await UserSurvival.findOne({
        where: { userId: user.id },
      });
      return {
        profile: freshProfile,
        survival: freshSurvival,
        balance: currencyHelper.balanceOf(FRAGMENT, {
          survival: freshSurvival,
          profile: freshProfile,
        }),
      };
    };

    async function processBuy(responder, encodedValue) {
      const { itemId, value } = market.decode(encodedValue);
      const result = await market.buy(user.id, itemId, value);

      if (!result.ok) {
        const kurang = `${n(result.shortage || 0)} ${FRAGMENT.name}`;
        return responder.followUp(
          hidden(
            buildErrorContainerV2({
              title: `${e("naura_akward")} Pak Damar menggeleng`,
              description: `> *"${say(vendor.dialog.broke, { ...vars, kurang })}"*`,
              footerText: ui.getFooter("survival"),
            }),
          ),
        );
      }

      return responder.followUp(
        hidden(
          buildContainerV2({
            accentColorHex: ui.getColor("success") || "#22c55e",
            title: `${e("naura_cheers")} Belanja selesai!`,
            expression: "Cheers",
            description: [
              `> *"${say(vendor.dialog.bought, { ...vars, barang: result.itemName })}"*`,
              "",
              `Kamu membayar ${currencyHelper.format(FRAGMENT, result.price)} untuk **${result.itemName}**.`,
              `${currencyHelper.emojiOf(FRAGMENT)} Sisa dompet: \`${n(result.balance)}\``,
            ].join("\n"),
            footerText: ui.getFooter("survival"),
          }),
        ),
      );
    }

    const targetItem = interaction.options.getString("item");
    if (targetItem) {
      await processBuy(interaction, targetItem);
      return interaction.editReply(await mainCard());
    }

    function card({
      title,
      description,
      rows = [],
      expression = "Happy",
      withBanner = false,
    }) {
      const payload = buildContainerV2({
        accentColorHex: vendor.accentColorHex,
        authorName: `Pasar Tradisional Desa \u2014 ${vendor.shopName}`,
        title,
        iconURL: user.displayAvatarURL(),
        expression,
        description,
        bannerAttachmentName: withBanner && banner ? BANNER_NAME : undefined,
        files: withBanner ? bannerFiles : [],
        footerText: ui.getFooter("survival"),
      });
      return { ...payload, components: [...payload.components, ...rows] };
    }

    const mainRow = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("market_buy_init")
          .setLabel("Beli Barang")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("market_sell_init")
          .setLabel("Jual Hasil Panen")
          .setStyle(ButtonStyle.Success),
      );

    const backRow = (target = "market_back") =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(target)
          .setLabel("Kembali")
          .setStyle(ButtonStyle.Secondary),
      );

    const categoryRow = () =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("market_category")
          .setPlaceholder("Mau lihat kebutuhan yang mana?")
          .addOptions(
            Object.entries(market.CATEGORIES).map(([value, meta]) => ({
              label: meta.label,
              value,
            })),
          ),
      );

    const mainCard = async () => {
      const { balance } = await walletNow();
      return card({
        title: `${e("shop_cart")} Pasar Tradisional Desa`,
        description: [
          `> *"${say(vendor.dialog.greet, vars)}"*`,
          "",
          `Sekarang **musim ${season.name}** ${season.emoji} dengan cuaca **${weather.name}** ${weather.emoji}. Barang di sini murah dan sederhana, pas untuk bertahan hidup.`,
          "",
          `${currencyHelper.emojiOf(FRAGMENT)} **Dompetmu:** \`${n(balance)}\` ${FRAGMENT.name}`,
        ].join("\n"),
        rows: [mainRow()],
        withBanner: true,
      });
    };

    const sellCard = async () => {
      const {
        survival: freshSurvival,
        profile: freshProfile,
        balance,
      } = await walletNow();
      const sellable = market.sellableFrom(
        freshProfile.inventory,
        freshSurvival,
      );

      if (sellable.length === 0) {
        return card({
          title: `${e("naura_akward")} Tasmu masih kosong`,
          description:
            `> *"Belum ada yang bisa dijual, {nama}. Cari dulu di hutan atau sawah, nanti Pak Damar tunggu di sini."*`.replace(
              "{nama}",
              vars.nama,
            ),
          rows: [mainRow()],
          expression: "Akward",
        });
      }

      const bonusNote =
        sellable[0].multiplier > 1
          ? `\n${e("sparkle")} Sarung Tangan Midas aktif! Harga jualmu naik **${Math.round((sellable[0].multiplier - 1) * 100)}%**.`
          : "";

      const sellMenu = new StringSelectMenuBuilder()
        .setCustomId("market_sell_pick")
        .setPlaceholder("Pilih barang dari tas untuk dijual...")
        .addOptions(
          sellable.slice(0, MAX_OPTIONS).map((it) => ({
            label: `${it.name} (x${it.amount})`.substring(0, 100),
            description:
              `${n(it.unitPrice)} ${FRAGMENT.short} per unit`.substring(0, 100),
            value: market.encode(it.id, it.unitPrice, it.amount),
          })),
        );

      return card({
        title: `${currencyHelper.emojiOf(FRAGMENT)} Jual Hasil Panen`,
        description: [
          `> *"${say(vendor.dialog.browse, vars)}"*`,
          bonusNote,
          "",
          `${currencyHelper.emojiOf(FRAGMENT)} **Dompetmu:** \`${n(balance)}\` ${FRAGMENT.name}`,
        ]
          .filter(Boolean)
          .join("\n"),
        rows: [new ActionRowBuilder().addComponents(sellMenu), backRow()],
        expression: "Cheers",
      });
    };

    const response = await interaction.editReply(await mainCard());
    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "market_back") {
        return i.editReply(await mainCard());
      }

      if (i.customId === "market_buy_init") {
        const { balance } = await walletNow();
        return i.editReply(
          card({
            title: `${e("shop_cart")} Beli Kebutuhan Desa`,
            description: [
              `> *"${say(vendor.dialog.browse, vars)}"*`,
              "",
              `${currencyHelper.emojiOf(FRAGMENT)} **Sisa dompet:** \`${n(balance)}\` ${FRAGMENT.name}`,
            ].join("\n"),
            rows: [categoryRow(), backRow()],
          }),
        );
      }

      if (i.customId === "market_sell_init") {
        return i.editReply(await sellCard());
      }

      if (i.customId === "market_category") {
        const category = i.values[0];
        const meta = market.CATEGORIES[category];
        const pool = market.poolFor(category, diffConfig);
        const { balance } = await walletNow();

        if (pool.length === 0) {
          return i.editReply(
            card({
              title: `${e("shop_box")} ${meta.label}`,
              description: `> *"Aduh, yang itu sedang habis. Besok Pak Damar bawa lagi, ya!"*`,
              rows: [categoryRow(), backRow()],
              expression: "Akward",
            }),
          );
        }

        const buyMenu = new StringSelectMenuBuilder()
          .setCustomId("market_buy_pick")
          .setPlaceholder(`Beli ${meta.label}...`)
          .addOptions(
            pool.slice(0, MAX_OPTIONS).map((it) => ({
              label: String(it.name).substring(0, 100),
              description:
                `${n(it.finalPrice)} ${FRAGMENT.short} \u2022 ${it.description || it.desc || "Kebutuhan desa"}`.substring(
                  0,
                  100,
                ),
              value: market.encode(it.id, it.finalPrice, 1),
            })),
          );

        return i.editReply(
          card({
            title: `${e(meta.emojiKey)} ${meta.label}`,
            description: [
              `> *"${say(vendor.dialog.browse, vars)}"*`,
              "",
              `${currencyHelper.emojiOf(FRAGMENT)} **Sisa dompet:** \`${n(balance)}\` ${FRAGMENT.name}`,
            ].join("\n"),
            rows: [
              new ActionRowBuilder().addComponents(buyMenu),
              categoryRow(),
              backRow("market_buy_init"),
            ],
          }),
        );
      }

      if (i.customId === "market_buy_pick") {
        await processBuy(i, i.values[0]);
        return i.editReply(await mainCard());
      }

      if (i.customId === "market_sell_pick") {
        const { itemId, value, amount } = market.decode(i.values[0]);
        const item = market.findItem(itemId);

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`market_sell_one|${itemId}`)
            .setLabel("Jual 1")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`market_sell_all|${itemId}`)
            .setLabel("Jual semua")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("market_sell_init")
            .setLabel("Kembali")
            .setStyle(ButtonStyle.Secondary),
        );

        return i.editReply(
          card({
            title: `${currencyHelper.emojiOf(FRAGMENT)} Yakin mau dijual?`,
            description: [
              `Barang: **${item ? item.name : itemId}**`,
              `Jumlah di tas: **${amount} unit**`,
              `Harga per unit: ${currencyHelper.format(FRAGMENT, value)}`,
              "",
              `> *"Pak Damar bayar tunai, kok. Mau dijual satu dulu atau semuanya sekalian?"*`,
            ].join("\n"),
            rows: [confirmRow],
            expression: "Thinking",
          }),
        );
      }

      if (
        i.customId.startsWith("market_sell_one|") ||
        i.customId.startsWith("market_sell_all|")
      ) {
        const sellAll = i.customId.startsWith("market_sell_all|");
        const itemId = i.customId.split("|")[1];
        const result = await market.sell(user.id, itemId, sellAll);

        if (!result.ok) {
          return i.followUp(
            hidden(
              buildErrorContainerV2({
                title: `${e("naura_akward")} Belum bisa dijual`,
                description:
                  "Barangnya sudah tidak ada di tasmu, atau memang tidak ada yang mau membelinya.",
                footerText: ui.getFooter("survival"),
              }),
            ),
          );
        }

        const bonusNote =
          result.multiplier > 1
            ? `\n${e("sparkle")} Berkah Sarung Tangan Midas menambah nilai jualnya!`
            : "";

        await i.followUp(
          hidden(
            buildContainerV2({
              accentColorHex: ui.getColor("success") || "#22c55e",
              title: `${e("naura_cheers")} Terjual!`,
              expression: "Cheers",
              description: [
                `Kamu menjual **${result.qty}x ${result.itemName}** dan menerima ${currencyHelper.format(FRAGMENT, result.earned)}.${bonusNote}`,
                "",
                `${currencyHelper.emojiOf(FRAGMENT)} Dompet sekarang: \`${n(result.balance)}\``,
                result.left > 0
                  ? `${e("shop_box")} Sisa di tas: **${result.left} unit**`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
              footerText: ui.getFooter("survival"),
            }),
          ),
        );

        return i.editReply(await sellCard());
      }
    });

    // Pesan Components V2 tidak boleh dikosongkan komponennya, jadi kartu
    // penutupnya dirender ulang dengan salam perpisahan Pak Damar.
    collector.on("end", async () => {
      const closing = card({
        title: `${e("sleepy")} Pasar desa sudah bubar`,
        description: `> *"${say(vendor.dialog.farewell, vars)}"*`,
        expression: "Sleepy",
      });
      await interaction.editReply(closing).catch(() => {});
    });
  },
};
