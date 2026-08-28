"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const {
  addItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const {
  getCurrentSeason,
} = require("../../../src/survival/helpers/survivalContext");

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;

    // Pastikan season sedang berjalan
    const season = getCurrentSeason();

    if (!season) {
      return ui.sendError(
        interaction,
        "Saat ini tidak ada event musiman yang sedang berlangsung. Cek lagi nanti ya!",
        true,
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // Pakai mutator JSON untuk memastikan klaim event aman dari race condition
    const mutation = await cacheManager.mutateUserSurvivalJson(
      user.id,
      "rpg_state",
      (state) => {
        if (!state) state = {};

        const lastEventClaim = state.lastEventClaim;
        if (lastEventClaim === today) {
          return null; // Batal, sudah klaim hari ini
        }

        state.lastEventClaim = today;
        return state;
      },
    );

    if (!mutation.ok) {
      const alreadyClaimedPayload = buildContainerV2({
        accentColorHex: ui.getColor("warning") || "#FFB347",
        authorName: "Naura Event Manager",
        title: `${e("akward", "💨")} Sudah diambil`,
        iconURL: user.displayAvatarURL(),
        expression: "fail",
        description: `Kamu sudah mengambil hadiah event **${season.label}** hari ini. Besok kembali lagi ya!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction
        .editReply({ ...alreadyClaimedPayload, embeds: [] })
        .catch(() => {});
    }

    // Berikan hadiah sesuai musim
    const lines = [
      `Terima kasih sudah ikut meramaikan **${season.label}**! Ini hadiah kecil dari Naura untukmu.`,
      "",
      `**${e("cheers", "🎁")} Hadiah Spesial Event**`,
    ];

    const itemsToGive = [];

    // Logika Tahun Baru (Daily Random Kupon)
    if (season.name === "new_year") {
      const randomCoupon = Math.floor(Math.random() * 3) + 1; // 1-3 Kupon

      await cacheManager.incrementUserSurvival(
        user.id,
        "coupons",
        randomCoupon,
      );
      lines.push(`> ${e("coupon", "🎫")} **${randomCoupon}x Naura Coupon**`);
      lines.push(
        "",
        `${e("happy", "✨")} Selamat Tahun Baru! Semoga petualanganmu tahun ini semakin seru!`,
      );
    }
    // Logika Ramadhan (Daily Ketupat)
    else if (season.name === "ramadhan") {
      const randomKetupat = Math.floor(Math.random() * 10) + 1; // 1-10 Ketupat
      itemsToGive.push({
        id: "ketupat",
        name: "Ketupat Lebaran",
        amount: randomKetupat,
        type: "consumable",
      });

      lines.push(
        `> ${e("consumable", "🍙")} **${randomKetupat}x Ketupat Lebaran**`,
      );
      lines.push(
        "",
        `${e("happy", "🌙")} Selamat menunaikan ibadah puasa! Kumpulkan terus ketupatnya untuk ditukar saat Lebaran nanti.`,
      );
    } else {
      // Event lain (Kemerdekaan, Ultah Naura) biasanya punya exclusive item
      if (season.exclusiveItem) {
        itemsToGive.push({
          id: "event_box",
          name: "Kotak Hadiah Event",
          amount: 1,
          type: "consumable",
        });
        lines.push(`> ${e("gift", "🎁")} **1x Kotak Hadiah Event**`);
      }

      // Default bonus
      const randomNSF = Math.floor(Math.random() * 50) + 50;
      await cacheManager.incrementUserSurvival(
        user.id,
        "starFragments",
        randomNSF,
      );
      lines.push(`> ${e("nsf", "⭐")} **${randomNSF}x Naura Star Fragment**`);
    }

    if (itemsToGive.length > 0) {
      await addItemsAtomic(user.id, itemsToGive);
    }

    const successPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFC0CB",
      authorName: "Naura Event Manager",
      title: `${e("cheers", "🎉")} Hadiah Event Diambil!`,
      iconURL: user.displayAvatarURL(),
      expression: "success",
      description: lines.join("\n"),
      footerText: ui.getFooter("survival"),
    });

    return interaction
      .editReply({ ...successPayload, embeds: [] })
      .catch(() => {});
  },
};
