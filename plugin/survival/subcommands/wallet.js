"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const currencyHelper = require("../../../src/survival/engines/currency");
const recyclingPoolEngine = require("../../../src/survival/engines/recyclingPoolEngine");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

function n(num) {
  return (Number(num) || 0).toLocaleString("id-ID");
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);
    const survival =
      (await UserSurvival.findOne({ where: { userId: user.id } })) ||
      (await UserSurvival.create({ userId: user.id }));

    const holders = { profile, survival };
    const nsfBal = currencyHelper.balanceOf(currencyHelper.FRAGMENT, holders);
    const coinBal = currencyHelper.balanceOf(currencyHelper.COIN, holders);
    const bankBal = Number((profile && profile.economy_bank) || 0);
    const couponBal = currencyHelper.balanceOf(currencyHelper.COUPON, holders);
    const tickets = Number(survival.lotteryTickets || 0);
    const playerLevel = Number(survival.survival_level || 1);

    const treasury = await recyclingPoolEngine.getOverview();
    const quote = await currencyHelper.getDynamicRateAndFee(nsfBal);

    // Evaluasi status subsidi pemula (Level 1 s.d. 10)
    let noviceStatus = "❌ Tidak Memenuhi Syarat (Khusus Level 1 - 10)";
    let canClaimNovice = false;
    if (playerLevel <= 10) {
      const now = new Date();
      let alreadyClaimed = false;
      if (survival.lastNoviceAidClaimAt) {
        const last = new Date(survival.lastNoviceAidClaimAt);
        alreadyClaimed =
          last.getUTCFullYear() === now.getUTCFullYear() &&
          last.getUTCMonth() === now.getUTCMonth() &&
          last.getUTCDate() === now.getUTCDate();
      }
      if (alreadyClaimed) {
        noviceStatus =
          "✅ Sudah Diklaim Hari Ini (Kembali besok jam 00:00 UTC)";
      } else {
        noviceStatus = "🎁 **Tersedia untuk Diklaim!** (Bantuan 250 NSF)";
        canClaimNovice = true;
      }
    }

    const eNsf = currencyHelper.emojiOf(currencyHelper.FRAGMENT);
    const eCoin = currencyHelper.emojiOf(currencyHelper.COIN);
    const eCoupon = currencyHelper.emojiOf(currencyHelper.COUPON);

    let currentNsf = nsfBal;
    let isNoviceClaimable = canClaimNovice;
    let currentNoviceStatus = noviceStatus;

    const buildWalletPayload = () => {
      const desc = [
        `### 💳 Paspor & Dompet Terpadu: ${user.displayName || user.username}`,
        `Level Survival: **Lv. ${playerLevel}** \u2022 Hari ke-**${survival.inGameDay || 1}**`,
        "",
        `**Saldo Tiga Mata Uang:**`,
        `> ${eNsf} **Star Fragments (NSF):** \`${n(currentNsf)}\` *(Alam & Survival)*`,
        `> ${eCoin} **Naura Coin (Dompet):** \`${n(coinBal)}\` | **Bank:** \`${n(bankBal)}\` *(Kota)*`,
        `> ${eCoupon} **Naura Coupon:** \`${n(couponBal)}\` *(Prestise & Kosmetik)*`,
        "",
        `**Status Fasilitas Komunitas & Undian:**`,
        `> 🎟️ **Tiket Astral Lottery Anda:** \`${n(tickets)}\` Tiket Aktif`,
        `> 🏆 **Jackpot Undian Mingguan:** \`${n(treasury.lotteryJackpot)}\` NSF`,
        `> 🔰 **Subsidi Petualang Pemula:** ${currentNoviceStatus}`,
        `> 📊 **Kurs Central Bank:** 1 Coin = \`${n(quote.rate)}\` NSF *(Pajak Admin: ${quote.feePercent * 100}%)*`,
      ].join("\n");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("wallet_claim_novice")
          .setLabel(
            isNoviceClaimable
              ? "Klaim Subsidi Pemula"
              : "Subsidi Telah Diklaim",
          )
          .setStyle(ButtonStyle.Success)
          .setDisabled(!isNoviceClaimable)
          .setEmoji("🔰"),
        new ButtonBuilder()
          .setCustomId("wallet_lottery_info")
          .setLabel("Info Undian Astral")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎟️"),
      );

      return buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Hoshino \u2022 Financial Identity",
        title: "💳 Dompet Terpadu Petualang (Naura Wilds)",
        iconURL: user.displayAvatarURL(),
        description: desc,
        buttonsRow: row,
        footerText: "Naura Hoshino Ecosystem \u2022 Closed-Loop Economy V2",
      });
    };

    const initialPayload = buildWalletPayload();
    const reply = await interaction.editReply(initialPayload);
    if (!reply) return;

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "wallet_claim_novice") {
        await i.deferUpdate().catch(() => {});
        const res = await recyclingPoolEngine.claimNoviceAid(user.id);
        if (res.ok) {
          currentNsf += res.amount;
          isNoviceClaimable = false;
          currentNoviceStatus =
            "✅ Sudah Diklaim Hari Ini (Kembali besok jam 00:00 UTC)";

          const updatedPayload = buildWalletPayload();
          await interaction.editReply(updatedPayload).catch(() => {});

          await i
            .followUp({
              content: `🎉 **Berhasil!** Kamu telah menerima subsidi harian sebesar **${n(res.amount)} NSF** dari Dana Bantuan Petualang Pemula!`,
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        } else {
          await i
            .followUp({
              content: `❌ Gagal mengklaim subsidi: ${res.reason}`,
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      } else if (i.customId === "wallet_lottery_info") {
        await i
          .reply({
            content: [
              `🎟️ **Informasi Astral Lottery Mingguan:**`,
              `• **Total Jackpot Saat Ini:** \`${n(treasury.lotteryJackpot)}\` NSF`,
              `• **Tiket Anda:** \`${n(tickets)}\` Tiket Aktif`,
              `• **Jadwal Pengundian:** Setiap hari Minggu pukul 20:00 WIB`,
              `• **Cara Mendapatkan Tiket:** Dapatkan 1 Tiket gratis secara otomatis setiap membelanjakan/membayar 250 NSF untuk biaya perbaikan alat atau administrasi bank!`,
            ].join("\n"),
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    });
  },
};
