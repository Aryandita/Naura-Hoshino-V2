"use strict";

const path = require("path");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const items = require("../../../src/survival/data/items");
const npcs = require("../../../src/survival/data/npcs");
const { findPortrait } = require("../../../src/survival/helpers/npcHelpers");
const { resolveShop, say } = require("../../../src/survival/data/shopkeepers");
const stock = require("../../../src/survival/data/shopStock");
const coupons = require("../../../src/survival/helpers/shopCoupon");
const purchase = require("../../../src/survival/helpers/shopPurchase");
const currencyHelper = require("../../../src/survival/engines/currency");
const {
  getSeason,
  getWeather,
  getShopMultiplier,
} = require("../../../src/survival/helpers/survivalTime");
const {
  getDifficultyConfig,
} = require("../../../src/survival/helpers/difficultyHelper");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const COLLECTOR_MS = 120000;
const PORTRAIT_NAME = "shopkeeper.png";
const MAX_OPTIONS = 25;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function ephemeral(payload) {
  return {
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  };
}

function portraitOf(npc) {
  const file = findPortrait(npc);
  if (!file) return { files: [], iconURL: null };
  const name = `shopkeeper${path.extname(file) || path.extname(PORTRAIT_NAME)}`;
  return {
    files: [new AttachmentBuilder(file, { name })],
    iconURL: `attachment://${name}`,
  };
}

module.exports = {
  async autocomplete(interaction) {
    const { choice, safeRespond, fuzzyFilter } = require('../../../src/utils/autocompleteHelper');
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: interaction.user.id },
    });
    const shop = resolveShop(survival.currentLocation);
    if (!shop) return safeRespond(interaction, []);

    const currentDay = survival.inGameDay || 1;
    const currentHour = survival.inGameHour || 6;
    const season = getSeason(currentDay);
    const weather = getWeather(currentDay, currentHour);
    const shopMultiplier = getShopMultiplier(currentDay, currentHour);
    const shopPurchases = survival.shop_purchases || {};

    const available = [];
    const categories = {
      ...shop.categories,
      ...stock.extraCategories(shop.key),
    };

    for (const cat of Object.keys(categories)) {
      const pool = items
        .filter(
          (it) =>
            it && it.category === cat && it.price && !stock.isExcluded(it.id),
        )
        .concat(stock.exclusiveStock(shop.key, cat));

      pool.forEach((it) => {
        const base = Math.floor(
          it.price * (weather.priceMod || 1) * (season.priceMod || 1),
        );
        const isCons = ["makanan", "minuman"].includes(cat);
        const inflasi = isCons ? 1 + (shopPurchases[it.id] || 0) * 0.1 : 1;
        const finalPrice = Math.floor(base * shopMultiplier * inflasi);
        available.push(
          choice(
            `${it.name} (${finalPrice} Koin)`,
            purchase.encodeChoice(it.id, finalPrice, false),
          ),
        );
      });
    }

    if (coupons.isOpen(currentDay, currentHour)) {
      Object.keys(coupons.CATEGORIES).forEach((cat) => {
        coupons.stockByCategory(cat).forEach((it) => {
          available.push(
            choice(
              `${ui.getEmoji("ticket") || "🎟️"} ${it.name} (${it.price} Kupon)`,
              purchase.encodeChoice(it.id, it.price, true),
            ),
          );
        });
      });
    }

    return safeRespond(interaction, fuzzyFilter(available, focusedValue, 25));
  },

  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (survival.currentLocation === "prison")
      return ui.sendError(interaction, "err_sys_58", true);

    const shop = resolveShop(survival.currentLocation);
    if (!shop)
      return ui.sendError(
        interaction,
        "Di sini nggak ada penjual, lho. Coba ke desa atau kota dulu yaa!",
        true,
      );

    const gastonShop = coupons.COUPON_SHOP;
    const npc = npcs[shop.npcId] || { id: shop.npcId, name: shop.shopName };
    const gaston = npcs[gastonShop.npcId] || {
      id: gastonShop.npcId,
      name: gastonShop.shopName,
    };

    const holders = { survival, profile };
    const vars = { nama: user.displayName || user.username };
    const categories = {
      ...shop.categories,
      ...stock.extraCategories(shop.key),
    };

    const shopArt = portraitOf(npc);
    const gastonArt = portraitOf(gaston);

    const currentDay = survival.inGameDay || 1;
    const currentHour = survival.inGameHour || 6;
    const season = getSeason(currentDay);
    const weather = getWeather(currentDay, currentHour);
    const diffConfig = getDifficultyConfig(
      survival.rpg_state?.difficulty || "Normal",
    );

    // Gaston berpindah setiap hari dan hanya buka pada jendela jam tertentu.
    const gastonOpen = coupons.isOpen(
      survival.currentLocation,
      currentDay,
      currentHour,
    );

    let shopPurchases = survival.shop_purchases || {};
    if (currentDay >= (survival.shop_last_reset_day || 1) + 30) {
      shopPurchases = {};
      await cacheManager.updateUserSurvival(user.id, {
        shop_purchases: {},
        shop_last_reset_day: currentDay,
      });
    }

    function priceOf(item) {
      const flat =
        item.id.startsWith("prop_") ||
        item.id.startsWith("veh_") ||
        item.category === "pass";
      const weatherMultiplier = flat
        ? 1
        : getShopMultiplier(item, weather, season);
      const bought = shopPurchases[item.id] || 0;
      let final = Math.floor(
        item.price * weatherMultiplier * (1 + bought * 0.1),
      );
      if (diffConfig.extreme) final = Math.floor(final * 1.5);
      return final;
    }

    function contextOf(isCoupon) {
      const active = isCoupon ? gastonShop : shop;
      return {
        active,
        person: isCoupon ? gaston : npc,
        art: isCoupon ? gastonArt : shopArt,
        currency: currencyHelper.byKind(active.currency),
      };
    }

    async function processBuy(responder, valueToBuy, isCoupon) {
      const ctx = contextOf(isCoupon);
      const result = await purchase.buy({
        userId: user.id,
        value: valueToBuy,
        currency: ctx.currency,
      });

      if (!result.ok) {
        const kurang = `${(result.shortage || 0).toLocaleString("id-ID")} ${ctx.currency.name}`;
        const line = isCoupon
          ? coupons.say("broke", { ...vars, kurang })
          : say(shop.dialog.broke, { ...vars, kurang });
        return responder.followUp(
          ephemeral(
            buildErrorContainerV2({
              title: `${e("sad", "\uD83D\uDE22")} ${ctx.person.name} menggeleng`,
              description: `> *"${line}"*`,
              footerText: ui.getFooter("survival"),
            }),
          ),
        );
      }

      if (!result.isCoupon) {
        shopPurchases[result.itemId] = (shopPurchases[result.itemId] || 0) + 1;
        await cacheManager.updateUserSurvival(user.id, {
          shop_purchases: shopPurchases,
        });
      }

      const boughtLine = isCoupon
        ? coupons.say("bought", { ...vars, barang: result.itemName })
        : say(shop.dialog.bought, { ...vars, barang: result.itemName });

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        authorName: `${ctx.person.name} \u2014 ${ctx.person.title || "Penjual"}`,
        title: `${e("cheers", "\uD83E\uDD42")} Transaksi berhasil!`,
        iconURL: ctx.art.iconURL || user.displayAvatarURL(),
        description: [
          `> *"${boughtLine}"*`,
          "",
          `Kamu membayar ${currencyHelper.format(ctx.currency, result.price)} untuk **${result.itemName}**.`,
          result.effectNote
            ? `\n${e("sparkle", "\u2728")} ${result.effectNote}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return responder.followUp(successPayload);
    }

    const targetItem = interaction.options.getString("item");
    if (targetItem) {
      const { isCoupon } = purchase.decodeChoice(targetItem);
      await processBuy(interaction, targetItem, isCoupon);

      const openPayload = shopPayload(
        `${e("shop_cart", "\uD83D\uDED2")} ${shop.shopName}`,
        say(shop.dialog.greet, vars),
        `\n*Transaksi cepat selesai! Buka menu di bawah untuk transaksi lainnya.*`,
      );
      return interaction.editReply({
        ...openPayload,
        components: [...openPayload.components, categoryRow()],
      });
    }

    const categoryRow = () => {
      const options = Object.entries(categories).map(([value, label]) => ({
        label,
        value,
      }));
      if (gastonOpen) {
        Object.entries(coupons.availableCategories()).forEach(
          ([key, label]) => {
            options.push({
              label: `Kios Gaston \u2014 ${label}`.substring(0, 100),
              description: "Dibayar dengan Naura Coupon",
              value: purchase.COUPON_PREFIX + key,
            });
          },
        );
      }
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("shop_category")
          .setPlaceholder("Mau lihat dagangan yang mana?")
          .addOptions(options.slice(0, MAX_OPTIONS)),
      );
    };

    function shopPayload(title, dialogue, extra = "", isCoupon = false) {
      const ctx = contextOf(isCoupon);
      const balance = currencyHelper.balanceOf(ctx.currency, holders);
      return buildContainerV2({
        accentColorHex: ctx.active.accentColorHex,
        authorName: `${ctx.person.name} \u2014 ${ctx.person.title || "Penjual"}`,
        title,
        iconURL: ctx.art.iconURL || user.displayAvatarURL(),
        description: [
          `> *"${dialogue}"*`,
          "",
          `${e("lokasi", "\uD83D\uDCCD")} **${ctx.active.shopName}** \u2014 Musim **${season.name}** ${season.emoji}, cuaca **${weather.name}** ${weather.emoji}.`,
          `${currencyHelper.emojiOf(ctx.currency)} Saldomu: **${balance.toLocaleString("id-ID")} ${ctx.currency.name}**`,
          extra,
        ]
          .filter(Boolean)
          .join("\n"),
        files: ctx.art.files,
        footerText: ui.getFooter("survival"),
      });
    }

    const gastonNote = gastonOpen
      ? `\n${e("coupon", "\uD83C\uDF9F\uFE0F")} *Psst, Gaston sedang menggelar tikar di sini! Kios kuponnya ada di daftar paling bawah.*`
      : `\n${e("npc_talk", "\uD83D\uDCAC")} *${coupons.rumor(currentDay)}*`;

    const openPayload = shopPayload(
      `${e("shop_cart", "\uD83D\uDED2")} ${shop.shopName}`,
      say(shop.dialog.greet, vars),
      `\n*Harga bergerak mengikuti cuaca, musim, dan seberapa sering kamu membeli barang yang sama bulan ini.*${gastonNote}`,
    );

    const response = await interaction.editReply({
      ...openPayload,
      components: [...openPayload.components, categoryRow()],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    let activeIsCoupon = false;

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "shop_category") {
        const raw = i.values[0];
        activeIsCoupon = purchase.isCouponCategory(raw);

        if (activeIsCoupon && !gastonOpen) {
          return i.followUp(
            ephemeral(
              buildErrorContainerV2({
                title: `${e("npc_talk", "\uD83D\uDCAC")} Gaston sudah pergi`,
                description: coupons.rumor(currentDay),
                footerText: ui.getFooter("survival"),
              }),
            ),
          );
        }

        const ctx = contextOf(activeIsCoupon);
        const category = activeIsCoupon ? purchase.couponCategoryOf(raw) : raw;
        const label = activeIsCoupon
          ? coupons.CATEGORIES[category]
          : categories[category];

        const pool = activeIsCoupon
          ? coupons.stockByCategory(category)
          : items
              .filter(
                (it) =>
                  it &&
                  it.category === category &&
                  it.price &&
                  !stock.isExcluded(it.id),
              )
              .concat(stock.exclusiveStock(shop.key, category));

        if (pool.length === 0) {
          const emptyPayload = shopPayload(
            `${e("shop_cart", "\uD83D\uDED2")} ${label}`,
            "Aduh, yang itu sedang kosong. Stoknya belum datang dari pemasok.",
            "",
            activeIsCoupon,
          );
          return i.editReply({
            ...emptyPayload,
            components: [...emptyPayload.components, categoryRow()],
          });
        }

        const buyRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("shop_buy")
            .setPlaceholder(`Beli dari ${label}...`)
            .addOptions(
              pool.slice(0, MAX_OPTIONS).map((it) => {
                const finalPrice = activeIsCoupon
                  ? Number(it.couponPrice)
                  : priceOf(it);
                const note = activeIsCoupon
                  ? `${finalPrice} ${ctx.currency.short} \u2022 ${it.rarity || "Langka"}`
                  : `${finalPrice.toLocaleString("id-ID")} ${ctx.currency.short} \u2022 inflasi ${(shopPurchases[it.id] || 0) * 10}%`;
                return {
                  label: it.name.substring(0, 100),
                  description: note.substring(0, 100),
                  value: purchase.encodeChoice(
                    it.id,
                    finalPrice,
                    activeIsCoupon,
                  ),
                };
              }),
            ),
        );

        const dialogue = activeIsCoupon
          ? coupons.say("browse", vars)
          : say(shop.dialog.browse, vars);

        const listPayload = shopPayload(
          `${e(activeIsCoupon ? "coupon" : "shop_cart", "\uD83D\uDED2")} ${label}`,
          dialogue,
          "",
          activeIsCoupon,
        );
        return i.editReply({
          ...listPayload,
          components: [...listPayload.components, categoryRow(), buyRow],
        });
      }

      if (i.customId === "shop_buy") {
        await processBuy(i, i.values[0], activeIsCoupon);
      }
    });

    collector.on("end", async () => {
      const closingPayload = shopPayload(
        `${e("sleepy", "\uD83D\uDCA4")} ${shop.shopName} sudah tutup`,
        say(shop.dialog.farewell, vars),
      );
      await interaction.editReply(closingPayload).catch(() => {});
    });
  },
};
