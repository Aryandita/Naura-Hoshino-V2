// Tampilan /premium check, termasuk pencabutan status yang sudah kedaluwarsa.
const ui = require("../config/ui");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const { tierByKey } = require("./premiumTiers");
const store = require("./premiumStore");
const { buildTierCard } = require("./premiumCard");

function activeDescription(targetUser, tierData, tierEmoji, expiry, daysLeft) {
  const stamp = Math.floor(expiry.getTime() / 1000);
  return [
    `${tierEmoji} **${targetUser.username}** terdaftar sebagai anggota **${tierData.name}**!`,
    ``,
    `⏳ **Masa Berlaku:** Berakhir <t:${stamp}:F> (<t:${stamp}:R>)`,
    `📅 **Sisa Durasi:** **${daysLeft} hari**`,
    ``,
    `Seluruh keistimewaan dan benefit tier ini aktif untuk akunmu. Ketik \`/premium benefits\` untuk melihat rincian lengkapnya.`,
  ].join("\n");
}

function regularDescription(targetUser) {
  return [
    `**${targetUser.username}** saat ini masih berstatus sebagai **Regular Member**.`,
    ``,
    `Tingkatkan ke **Naura V.I.P** untuk membuka berbagai fitur eksklusif:`,
    `・ Hingga 2.0x Global XP Multiplier & Bonus Gaji Kerja`,
    `・ Musik Siaga 24/7 di Voice Channel & DSP Audio Filters`,
    `・ Autoplay AI Dropdown Rekomendasi Musik Cerdas`,
    `・ Akses Dungeon RPG Tanpa Batas (> Lantai 50)`,
    `・ Kartu Profil Gold Glow & VIP Badges Eksklusif`,
    ``,
    `Gunakan perintah \`/premium info\` untuk memilih paket langgananmu!`,
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
        ? activeDescription(targetUser, tierData, tierEmoji, expiry, daysLeft)
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
