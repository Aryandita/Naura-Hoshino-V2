// Subcommand khusus owner: add, remove, generate_voucher, dan stats.
const { Op } = require("sequelize");
const crypto = require("crypto");
const UserProfile = require("../models/UserProfile");
const PremiumVoucher = require("../models/PremiumVoucher");
const ui = require("../config/ui");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const { tierDisplayName } = require("./premiumTiers");
const store = require("./premiumStore");
const { sendPremiumDM } = require("./premiumNotify");

const CODE_PREFIX = "NAURA-VIP-";
const CODE_ATTEMPTS = 5;

function stamp(date, style) {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

function dmNote(delivered) {
  return delivered
    ? "-# Naura sudah mengabari user lewat DM."
    : "-# DM ke user tidak bisa dikirim, mungkin DM-nya tertutup. Tolong kabari manual ya.";
}

// Kode acak yang cukup kuat dan dipastikan belum terpakai.
async function freshCode() {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code =
      CODE_PREFIX + crypto.randomBytes(5).toString("hex").toUpperCase();
    const taken = await PremiumVoucher.findOne({ where: { code } });
    if (!taken) return code;
  }
  return null;
}

async function runAdd(interaction, targetUser, profile) {
  const days = interaction.options.getInteger("days");
  const newExpiry = await store.grantPremium(targetUser.id, profile, days);

  const tierKey = ui.getPremiumTier(days, true);
  const displayName = tierDisplayName(tierKey, days);

  const delivered = await sendPremiumDM(
    interaction.client,
    targetUser.id,
    "activated",
    {
      username: targetUser.username,
      tierName: displayName,
      premiumUntil: newExpiry,
    },
  );

  const crown =
    ui.getEmoji("premium_crown") ||
    ui.getEmoji("premium_badge") ||
    "\ud83d\udc8e";

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("premium_vip"),
      authorName: "Naura V.I.P Management",
      iconURL: targetUser.displayAvatarURL(),
      title: `${crown} V.I.P premium diberikan!`,
      expression: "success",
      description: [
        `**${targetUser.username}** sekarang resmi menjadi member **${displayName}**.`,
        ``,
        `Berlaku sampai ${stamp(newExpiry, "F")}.`,
        ``,
        dmNote(delivered),
      ].join("\n"),
      footerText: ui.getFooter("premium"),
    }),
  );
}

async function runRemove(interaction, targetUser, profile) {
  await store.revokePremium(targetUser.id, profile);

  const delivered = await sendPremiumDM(
    interaction.client,
    targetUser.id,
    "removed",
    {
      username: targetUser.username,
    },
  );

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("error"),
      authorName: "Naura V.I.P Management",
      title: "Status premium dicabut",
      expression: "info",
      description: [
        `Status premium **${targetUser.username}** sudah Naura cabut.`,
        ``,
        dmNote(delivered),
      ].join("\n"),
      footerText: ui.getFooter("premium"),
    }),
  );
}

async function runGenerateVoucher(interaction) {
  const days = interaction.options.getInteger("days");
  const expDays = interaction.options.getInteger("expired_in_days");

  const code = await freshCode();
  if (!code) {
    return interaction.editReply(
      buildContainerV2({
        accentColorHex: ui.getColor("error"),
        title: "Voucher gagal dibuat",
        expression: "error",
        description:
          "Naura sudah mencoba beberapa kali tapi kodenya selalu bentrok. Coba sekali lagi ya.",
        footerText: ui.getFooter("premium"),
      }),
    );
  }

  let expiresAt = null;
  if (expDays) expiresAt = new Date(Date.now() + expDays * store.DAY_MS);

  await PremiumVoucher.create({ code, durationDays: days, expiresAt });

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("premium_vip"),
      title: "Voucher V.I.P berhasil dibuat!",
      expression: "success",
      description: [
        `**Kode:** \`${code}\``,
        `**Durasi:** ${days} hari`,
        `**Kedaluwarsa:** ${expiresAt ? stamp(expiresAt, "R") : "tidak pernah"}`,
        ``,
        `-# Bagikan kode ini hanya ke user yang berhak ya.`,
      ].join("\n"),
      footerText: ui.getFooter("premium"),
    }),
  );
}

async function runStats(interaction) {
  const now = new Date();

  const subscribers = await UserProfile.findAll({
    where: { isPremium: true, premiumUntil: { [Op.gt]: now } },
    attributes: ["userId", "premiumUntil"],
    order: [["premiumUntil", "ASC"]],
  });

  const dist = { supporter: 0, friends: 0, vip: 0 };
  const rows = [];

  for (const sub of subscribers) {
    const expiry = store.toDate(sub.premiumUntil);
    if (!expiry) continue;

    const left = Math.ceil((expiry.getTime() - now.getTime()) / store.DAY_MS);
    const tier = ui.getPremiumTier(left, true);
    if (dist[tier] !== undefined) dist[tier] += 1;

    if (rows.length < 10) {
      rows.push(
        `${rows.length + 1}. <@${sub.userId}> - **${left} hari lagi** (${stamp(expiry, "R")})`,
      );
    }
  }

  const crown = ui.getEmoji("premium_crown") || "\ud83d\udc51";

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("premium_vip"),
      authorName: "Naura V.I.P Management - Panel Owner",
      title: `${crown} Statistik subscriber`,
      expression: "info",
      description: [
        `**Total subscriber aktif:** \`${subscribers.length}\``,
        ``,
        `**Sebaran tier:**`,
        `\u30fb Supporter: \`${dist.supporter}\` user`,
        `\u30fb Friends: \`${dist.friends}\` user`,
        `\u30fb V.I.P: \`${dist.vip}\` user`,
        ``,
        rows.length
          ? `**Sepuluh yang paling dekat berakhir:**\n${rows.join("\n")}`
          : `*Belum ada subscriber aktif saat ini.*`,
      ].join("\n"),
      footerText: ui.getFooter("premium"),
    }),
  );
}

module.exports = { runAdd, runRemove, runGenerateVoucher, runStats };
