"use strict";

// Tampilan /premium check, termasuk pencabutan status yang sudah kedaluwarsa.
const ui = require("../config/ui");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const { tierByKey } = require("./premiumTiers");
const store = require("./premiumStore");
const { buildTierCard } = require("./premiumCard");
const {
  getDurabilityDiscount,
  getMarketTaxDiscount,
  getCooldownReduction,
  getMaxEnergy,
  getDailyStipend,
  getCustomPersona,
} = require("./premiumHelper");

function activeDescription(
  targetUser,
  tierData,
  tierEmoji,
  expiry,
  daysLeft,
  profile,
) {
  const stamp = Math.floor(expiry.getTime() / 1000);
  const tier = tierData.tier;

  const duraShield = Math.round(getDurabilityDiscount(tier) * 100);
  const taxDisc = Math.round(getMarketTaxDiscount(tier) * 100);
  const cdRush = Math.round(getCooldownReduction(tier) * 100);
  const maxEnergy = getMaxEnergy(tier);
  const stipend = getDailyStipend(tier);
  const persona = getCustomPersona(profile);

  const stipendSummary = stipend
    ? `+${stipend.coupons} Kupon & +${stipend.nsf.toLocaleString("id-ID")} NSF`
    : "Tidak ada";

  return [
    `${tierEmoji} **${targetUser.username}** terdaftar sebagai anggota **${tierData.name}**!`,
    "",
    `⏳ **Masa Berlaku:** Berakhir <t:${stamp}:F> (<t:${stamp}:R>)`,
    `📅 **Sisa Durasi:** **${daysLeft} hari**`,
    "",
    "**⚡ Manfaat & Buff V.I.P yang Sedang Aktif:**",
    `• 🛡️ **Durability Shield:** Ketahanan alat aus \`${duraShield}%\` lebih lambat`,
    `• 💰 **Tax Haven:** Diskon pajak pasar & lelang \`${taxDisc}%\``,
    `• ⚡ **Cooldown Rush:** Cooldown aksi survival dipangkas \`${cdRush}%\``,
    `• 🔋 **Kapasitas Energi:** Maksimal \`${maxEnergy} Energy\` (Normal: 100)`,
    `• 🎁 **Gaji Dividen Harian:** \`${stipendSummary}\` (Klaim via \`/premium claim\`)`,
    `• 🎭 **AI Persona Tuning:** Gaya \`${persona}\``,
    "",
    "-# Gunakan `/premium claim` setiap hari untuk mengambil dividen, atau `/premium buy` untuk memperpanjang durasi.",
  ].join("\n");
}

function regularDescription(targetUser) {
  return [
    `**${targetUser.username}** saat ini masih berstatus sebagai **Regular Member**.`,
    "",
    "Tingkatkan ke **Naura V.I.P** untuk membuka berbagai keistimewaan super:",
    "・ Gaji Dividen Harian Kupon & Star Fragments Gratis (`/premium claim`)",
    "・ Durability Shield (Ketahanan alat kerja & senjata 50% lebih awet)",
    "・ Diskon 50% Pajak Pasar Lelang & P2P Trade",
    "・ Hingga 2.0x Global XP Multiplier & Bonus Gaji Kerja Survival",
    "・ Musik Siaga 24/7 di Voice Channel, Filter DSP, & Lossless Hi-Fi Audio",
    "・ Kapasitas Energi Petualang naik hingga 150 Max Energy",
    "・ Kartu Profil Gold Glow & VIP Badges Eksklusif",
    "",
    "💡 *Bisa dibeli menggunakan Kupon in-game via `/premium buy` atau via QRIS di `/premium info`!*",
  ].join("\n");
}

async function runCheck(interaction, targetUser, profile) {
  // Status yang sudah lewat masa berlakunya dicabut lebih dulu agar tampilan
  // dan database tidak berbeda.
  await store.expireIfNeeded(targetUser.id, profile);

  const isPremium = store.isActive(profile);
  const daysLeft = isPremium ? store.daysLeft(profile) : 0;
  const expiry = store.expiryOf(profile);

  const tierKey = ui.getPremiumTier(daysLeft, isPremium);
  const tierData = tierByKey(tierKey) || {
    name: "Regular Member",
    tier: "none",
  };
  const tierEmoji =
    ui.getPremiumEmoji(tierKey) ||
    ui.getEmoji("premium_badge") ||
    "\ud83d\udc8e";

  const attachment = await buildTierCard(
    targetUser,
    tierData,
    isPremium,
    daysLeft,
    expiry,
    "premium-status.png",
  );

  const payload = buildContainerV2({
    accentColorHex: isPremium
      ? ui.getPremiumColor(tierKey)
      : ui.getColor("primary"),
    authorName: "Naura V.I.P Subscription",
    iconURL: targetUser.displayAvatarURL(),
    title: isPremium
      ? `${tierEmoji} Status V.I.P aktif`
      : "Status V.I.P belum aktif",
    expression: isPremium ? "celebrate" : "info",
    description:
      isPremium && expiry
        ? activeDescription(
            targetUser,
            tierData,
            tierEmoji,
            expiry,
            daysLeft,
            profile,
          )
        : regularDescription(targetUser),
    bannerAttachmentName: attachment ? "premium-status.png" : null,
    footerText: ui.getFooter(isPremium ? `premium_${tierKey}` : "premium"),
  });

  return interaction.editReply({
    ...payload,
    files: attachment ? [attachment] : [],
  });
}

module.exports = { runCheck };
