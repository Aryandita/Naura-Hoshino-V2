"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");


const cacheManager = require("../../../src/managers/cacheManager");
const currencyHelper = require("../../../src/survival/engines/currency");
const recyclingPoolEngine = require("../../../src/survival/engines/recyclingPoolEngine");
const arcadeContract = require("../../../src/domain/contracts/arcadeContract");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");

function n(num) {
  return (Number(num) || 0).toLocaleString("id-ID");
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);
    const survival = await cacheManager.getUserSurvival(user.id);

    const holders = { profile, survival };
    const scBal = currencyHelper.balanceOf(currencyHelper.FRAGMENT, holders);
    const pdBal = currencyHelper.balanceOf(currencyHelper.COIN, holders);
    const bankBal = Number((profile && profile.economy_bank) || 0);
    const vbBal = currencyHelper.balanceOf(currencyHelper.COUPON, holders);
    const baBal = currencyHelper.balanceOf(currencyHelper.DIAMOND, holders);
    const mpBal = await arcadeContract.getBalance(user.id);
    const tickets = Number(survival.lotteryTickets || 0);
    const playerLevel = Number(survival.survival_level || 1);

    const treasury = await recyclingPoolEngine.getOverview();
    const quote = await currencyHelper.getDynamicRateAndFee(scBal);

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
        noviceStatus = "✅ Sudah Diklaim Hari Ini (Kembali besok jam 00:00 UTC)";
      } else {
        noviceStatus = "🎁 **Tersedia untuk Diklaim!** (Bantuan 150 SC)";
        canClaimNovice = true;
      }
    }

    const eSc = currencyHelper.emojiOf(currencyHelper.FRAGMENT);
    const ePd = currencyHelper.emojiOf(currencyHelper.COIN);
    const eVb = currencyHelper.emojiOf(currencyHelper.COUPON);
    const eBa = currencyHelper.emojiOf(currencyHelper.DIAMOND);
    const eMp = ui.getEmoji("medali_permainan") || "🏅";

    let currentSc = scBal;
    let isNoviceClaimable = canClaimNovice;
    let currentNoviceStatus = noviceStatus;

    const buildWalletPayload = () => {
      const desc = [
        `### 💳 Paspor & Dompet Terpadu: ${user.displayName || user.username}`,
        `Level Survival: **Lv. ${playerLevel}** \u2022 Hari ke-**${survival.inGameDay || 1}**`,
        "",
        `**Saldo Lima Mata Uang:**`,
        `> ${eSc} **Sukamaju Koin (SC):** \`${n(currentSc)}\` *(Desa & Alam)*`,
        `> ${ePd} **Pratama Dollar (PD):** \`${n(pdBal)}\` | **Bank:** \`${n(bankBal)}\` *(Kota)*`,
        `> ${eVb} **Voucher Beasiswa (VB):** \`${n(vbBal)}\` *(Prestasi & Festival)*`,
        `> ${eBa} **Berlian Adisha (BA):** \`${n(baBal)}\` *(Legendaris & Endgame)*`,
        `> ${eMp} **Medali Permainan (MP):** \`${n(mpBal)}\` *(Arcade & Minigame)*`,
        "",
        `**Status Fasilitas Komunitas & Undian:**`,
        `> 🎟️ **Tiket Astral Lottery Anda:** \`${n(tickets)}\` Tiket Aktif`,
        `> 🏆 **Jackpot Undian Mingguan:** \`${n(treasury.lotteryJackpot)}\` SC`,
        `> 🔰 **Subsidi Petualang Pemula:** ${currentNoviceStatus}`,
        `> 📊 **Kurs Central Bank:** 1 PD = \`${n(quote.rate)}\` SC *(Pajak Admin: ${quote.feePercent * 100}%)*`,
      ].join("\n");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("wallet_claim_novice")
          .setLabel(isNoviceClaimable ? "Klaim Subsidi Pemula" : "Subsidi Telah Diklaim")
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
        buttonsRow: [row, survivalUI.buildSurvivalActionRow("economy", user.id)],
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
          currentSc += res.amount;
          isNoviceClaimable = false;
          currentNoviceStatus = "✅ Sudah Diklaim Hari Ini (Kembali besok jam 00:00 UTC)";

          const updatedPayload = buildWalletPayload();
          await interaction.editReply(updatedPayload).catch(() => {});

          await i.followUp({
            content: `🎉 **Berhasil!** Kamu telah menerima subsidi harian sebesar **${n(res.amount)} SC** dari Dana Bantuan Petualang Pemula!`,
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        } else {
          await i.followUp({
            content: `❌ Gagal mengklaim subsidi: ${res.reason}`,
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        }
      } else if (i.customId === "wallet_lottery_info") {
        await i.reply({
          content: [
            `🎟️ **Informasi Astral Lottery Mingguan:**`,
            `• **Total Jackpot Saat Ini:** \`${n(treasury.lotteryJackpot)}\` SC`,
            `• **Tiket Anda:** \`${n(tickets)}\` Tiket Aktif`,
            `• **Jadwal Pengundian:** Setiap hari Minggu pukul 20:00 WIB`,
            `• **Cara Mendapatkan Tiket:** Dapatkan 1 Tiket gratis secara otomatis setiap membelanjakan/membayar 250 SC untuk biaya perbaikan alat atau administrasi bank!`,
          ].join("\n"),
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    });
  },
};
