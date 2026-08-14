"use strict";

// Tampilan jalan-jalan. Pemain berkeliling di lokasi tempat dia berdiri, lalu
// bertemu penduduk secara acak lengkap dengan potretnya. Aturan biaya, hadiah,
// dan jeda menyapa dipegang npcEncounterRules.js.

const path = require("path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

const ui = require("../../config/ui");
const cacheManager = require("../../managers/cacheManager");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const UserNPC = require("../../models/UserNPC");
const { findPortrait, refreshRelationship } = require("./npcHelpers");
const encounter = require("./npcEncounter");
const rules = require("./npcEncounterRules");
const coupons = require("./shopCoupon");

const COLLECTOR_MS = 150000;
const MAX_STEPS = 4;
const RELATION_LABELS = [
  "Kenalan",
  "Akrab",
  "Sahabat",
  "Orang Terkasih",
  "Pasangan",
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/** Potret NPC sebagai ikon kartu. NPC tanpa gambar tetap bisa disapa. */
function portraitOf(npc) {
  const file = npc ? findPortrait(npc) : null;
  if (!file) return { files: [], iconURL: null };
  const name = `roamer${path.extname(file) || ".png"}`;
  return {
    files: [new AttachmentBuilder(file, { name })],
    iconURL: `attachment://${name}`,
  };
}

/**
 * Sapa NPC. Kedekatan hanya naik bila jeda 30 menit sudah lewat, sama seperti
 * papan NPC, supaya jalan-jalan tidak jadi jalan pintas menaikkan afeksi.
 */
async function greet(userId, npc) {
  const [row] = await UserNPC.findOrCreate({
    where: { userId, npcId: npc.id },
    defaults: { affection: 0, relationshipLevel: 0, dailyGifts: 0 },
  });

  const waiting = rules.cooldownLeft(row.lastInteraction);
  if (waiting > 0) {
    return {
      cooled: false,
      wait: rules.formatCooldown(waiting),
      affection: row.affection || 0,
    };
  }

  row.affection = (row.affection || 0) + encounter.AFFECTION_GAIN;
  row.lastInteraction = new Date();
  refreshRelationship(row, npc);
  await row.save();

  return {
    cooled: true,
    affection: row.affection,
    level: row.relationshipLevel || 0,
    label: RELATION_LABELS[row.relationshipLevel || 0] || RELATION_LABELS[0],
  };
}

/** Bocoran lokasi kios Gaston hari ini, dipakai sebagai hadiah informasi. */
async function hintLine(userId) {
  try {
    const survival = await cacheManager.getUserSurvival(userId);
    return coupons.rumor((survival && survival.inGameDay) || 1);
  } catch (error) {
    return null;
  }
}

function rows({ npc, canGreet, stepsLeft, cost }) {
  const row = new ActionRowBuilder();

  if (canGreet) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("roam_greet")
        .setLabel("Sapa dia")
        .setEmoji(e("npc_talk", "\uD83D\uDCAC"))
        .setStyle(ButtonStyle.Success),
    );
  }

  if (npc && npc.id === "luna_gacha") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("roam_gacha")
        .setLabel("Buka Toko Gacha")
        .setEmoji(e("gacha", "🎰"))
        .setStyle(ButtonStyle.Primary)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("roam_again")
      .setLabel(
        cost > 0
          ? `Jalan lagi (${stepsLeft}, -${cost} stamina)`
          : `Jalan lagi (${stepsLeft})`,
      )
      .setEmoji(e("run", "\uD83C\uDFC3"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(stepsLeft <= 0),
    new ButtonBuilder()
      .setCustomId("roam_done")
      .setLabel("Cukup dulu")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row];
}

function card({ user, result, art, extra }) {
  const found = result.found;
  const title = found
    ? `${e("npc_group", "\uD83D\uDC65")} Kamu bertemu ${result.npc.name}!`
    : `${e("sleepy", "\uD83C\uDF43")} Tidak ada siapa-siapa di sini`;

  const lines = found
    ? [
        `${e("lokasi", "\uD83D\uDCCD")} **${result.locationName}** \u2014 waktu ${result.dayPart}.`,
        "",
        `**${result.npc.name}** \u2014 *${result.npc.title || "Penduduk"}* ${result.activity}.`,
        "",
        `> *"${result.greeting}"*`,
      ]
    : [
        `${e("lokasi", "\uD83D\uDCCD")} **${result.locationName}** \u2014 waktu ${result.dayPart}.`,
        "",
        result.note,
        "",
        "Coba jalan sedikit lagi, atau datang di jam yang berbeda. Penduduk punya kesibukan masing-masing, kok.",
      ];

  if (extra) lines.push("", extra);

  return buildContainerV2({
    accentColorHex: ui.getColor(found ? "primary" : "secondary") || "#FFB6C1",
    authorName: "Naura Jalan-Jalan",
    title,
    iconURL: art.iconURL || user.displayAvatarURL(),
    expression: found ? "success" : "info",
    description: lines.join("\n"),
    files: art.files,
    footerText: ui.getFooter("survival"),
  });
}

/**
 * Buka sesi jalan-jalan sebagai pesan lanjutan, jadi kartu perintah pemanggil
 * tetap utuh.
 */
async function runRoam({ interaction, location, hour, luck }) {
  const user = interaction.user;
  const playerName = user.displayName || user.username;
  const cost = rules.staminaCostFor(location);
  const seen = [];
  let stepsLeft = MAX_STEPS;

  const roll = () => {
    const result = encounter.rollEncounter({
      location,
      hour,
      luck,
      exclude: seen,
      playerName,
    });
    if (result.found) seen.push(result.npc.id);
    return result;
  };

  let result = roll();
  let art = portraitOf(result.npc);
  let greeted = false;

  const render = (target, extra) => {
    const payload = card({ user, result, art, extra });
    return {
      ...payload,
      components: [
        ...payload.components,
        ...rows({ npc: result.npc, canGreet: result.found && !greeted, stepsLeft, cost }),
      ],
    };
  };

  const intro =
    cost > 0
      ? `${e("run", "\uD83C\uDFC3")} Medan di sini cukup berat, tiap langkah menguras **${cost} stamina**.`
      : null;

  const message = await interaction
    .followUp(render(null, intro))
    .catch(() => null);
  if (!message || typeof message.createMessageComponentCollector !== "function")
    return message;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === user.id && i.customId.startsWith("roam_"),
    time: COLLECTOR_MS,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate().catch(() => {});

    if (i.customId === "roam_done") return collector.stop("done");

    if (i.customId === "roam_greet" && result.found && !greeted) {
      const notes = [];

      try {
        const bond = await greet(user.id, result.npc);

        if (!bond.cooled) {
          notes.push(
            `${e("sleepy", "\u23F3")} Kalian baru saja mengobrol. **${result.npc.name}** masih sibuk, coba sapa lagi sekitar **${bond.wait}** lagi.`,
          );
        } else {
          greeted = true;
          notes.push(
            `${e("sparkle", "\u2728")} Kedekatanmu dengan **${result.npc.name}** naik jadi **${bond.affection}** \u2014 status **${bond.label}**.`,
          );

          const gift = rules.rollGift(location);
          if (gift.kind === "item") {
            const line = await rules.grantGift(user.id, gift);
            if (line) notes.push(`${e("gift", "\uD83C\uDF81")} ${line}`);
          } else if (gift.kind === "hint") {
            const hint = await hintLine(user.id);
            if (hint)
              notes.push(`${e("read", "\uD83D\uDDE3\uFE0F")} *"${hint}"*`);
          }
        }
      } catch (error) {
        notes.push(
          `${e("annoy", "\u26A0\uFE0F")} Sapaanmu tersampaikan, tapi catatannya gagal disimpan. Coba lagi nanti, ya.`,
        );
      }

      return i.editReply(render(null, notes.join("\n"))).catch(() => {});
    }

    if (i.customId === "roam_gacha" && result.found && result.npc.id === "luna_gacha") {
        // Open the Gacha Banner shop
        const { showGachaBannerShop } = require("./gachaBanner");
        await showGachaBannerShop(i, user);
        return;
    }

    if (i.customId === "roam_again") {
      const spent = await rules
        .spendStamina(user.id, location)
        .catch(() => ({ ok: true, cost: 0 }));

      if (!spent.ok) {
        stepsLeft = 0;
        return i
          .editReply(
            render(
              null,
              `${e("cry", "\uD83D\uDE13")} Kakimu sudah tidak kuat lagi. Staminamu tinggal **${spent.stamina}**, padahal butuh **${spent.cost}** untuk melangkah. Istirahat dulu, ya.`,
            ),
          )
          .catch(() => {});
      }

      stepsLeft = Math.max(0, stepsLeft - 1);
      greeted = false;
      result = roll();
      art = portraitOf(result.npc);

      const note =
        spent.cost > 0
          ? `${e("run", "\uD83C\uDFC3")} Stamina terpakai **${spent.cost}**, sisa **${spent.stamina}**.`
          : null;

      return i.editReply(render(null, note)).catch(() => {});
    }
  });

  collector.on("end", async () => {
    const closing = buildContainerV2({
      accentColorHex: ui.getColor("secondary") || "#C4B5FD",
      authorName: "Naura Jalan-Jalan",
      title: `${e("happy", "\uD83D\uDC5C")} Jalan-jalanmu selesai`,
      iconURL: user.displayAvatarURL(),
      expression: "success",
      description: [
        seen.length > 0
          ? `Hari ini kamu berpapasan dengan **${seen.length} orang** di ${encounter.locationName(location)}.`
          : `Kali ini tidak ada yang kamu temui di ${encounter.locationName(location)}.`,
        "",
        "Kalau mau ngobrol lebih lama, jalan-jalan lagi kapan pun kamu mau. Naura selalu senang lihat kamu akrab dengan warga.",
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    await message.edit(closing).catch(() => {});
  });

  return message;
}

module.exports = {
  COLLECTOR_MS,
  MAX_STEPS,
  RELATION_LABELS,
  portraitOf,
  greet,
  card,
  rows,
  runRoam,
};
