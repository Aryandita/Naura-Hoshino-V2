"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const UserSurvival = require("../../../src/models/UserSurvival");
const UserNPC = require("../../../src/models/UserNPC");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  safeParseInventory,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const npcConfig = require("../../../src/survival/data/npcs");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const COLLECTOR_MS = 120000;
const MIN_AFFECTION = 20;
const BONUS_AFFECTION = 15;
const MAX_OPTIONS = 25;
const CHARACTER_DIR = path.join(
  process.cwd(),
  "assets",
  "survival",
  "characters",
);
const IMAGE_EXTENSIONS = [".png", ".webp", ".jpeg", ".jpg"];

// Katalog barang memakai `dating_ticket`, tetapi kode lama mencari
// `date_ticket` sehingga tiket yang sudah dibeli tidak pernah terdeteksi.
const TICKET_IDS = ["dating_ticket", "date_ticket"];
const PARK_LOCATIONS = ["park", "taman", "amusement_park"];

const RELATIONSHIP_NAMES = ["Kenalan", "Teman", "Sahabat", "Pacar", "Menikah"];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function findPortrait(npc) {
  if (!npc) return null;

  const candidates = [];
  if (npc.image) candidates.push(npc.image);
  for (const ext of IMAGE_EXTENSIONS) candidates.push(`${npc.id}${ext}`);

  for (const name of candidates) {
    const full = path.join(CHARACTER_DIR, name);
    if (fs.existsSync(full)) return { full, name };
  }

  return null;
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (survival.currentLocation === "prison")
      return ui.sendError(interaction, "err_sys_39", true);
    if (!PARK_LOCATIONS.includes(survival.currentLocation))
      return ui.sendError(interaction, "err_sys_40", true);

    const profile = await cacheManager.getUserProfile(user.id);
    const inventory = safeParseInventory(profile.inventory);
    const ticketIndex = inventory.findIndex(
      (item) => item && TICKET_IDS.includes(item.id),
    );

    if (ticketIndex === -1)
      return ui.sendError(interaction, "err_sys_41", true);

    const romanticNPCs = Object.values(npcConfig)
      .filter((n) => n && n.type === "romansa")
      .slice(0, MAX_OPTIONS);

    if (romanticNPCs.length === 0) {
      return ui.sendError(
        interaction,
        "Duh, belum ada siapa pun di taman yang bisa kamu ajak kencan hari ini. Naura temani jalan-jalan saja, ya!",
        true,
      );
    }

    const userNPCs = await UserNPC.findAll({ where: { userId: user.id } });
    const npcMap = new Map(userNPCs.map((n) => [n.npcId, n]));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("date_npc_select")
      .setPlaceholder("Pilih siapa yang mau kamu ajak kencan...")
      .addOptions(
        romanticNPCs.map((n) => {
          const data = npcMap.get(n.id) || {
            affection: 0,
            relationshipLevel: 0,
          };
          const label =
            RELATIONSHIP_NAMES[data.relationshipLevel || 0] || "Kenalan";

          return {
            label: String(n.name).substring(0, 100),
            description:
              `${n.title || "Penduduk"} \u2022 Afeksi ${data.affection || 0}/100 (${label})`.substring(
                0,
                100,
              ),
            value: n.id,
          };
        }),
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const datePayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Amusement Park",
      title: `${e("happy", "\uD83C\uDFA1")} Taman Hiburan Naura`,
      iconURL: user.displayAvatarURL(),
      expression: "love",
      description: [
        "Kamu pegang selembar tiket kencan, dan tamannya ramai banget hari ini. Lampu-lampunya cantik, lho!",
        "",
        `Mau menghabiskan waktu sama siapa? Naura ingatkan ya, afeksinya harus minimal **${MIN_AFFECTION}** dulu supaya ajakanmu diterima.`,
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    const response = await interaction.editReply({
      ...datePayload,
      embeds: [],
      components: [...datePayload.components, row],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
      max: 1,
    });

    let handled = false;

    collector.on("collect", async (i) => {
      await i.deferUpdate().catch(() => {});

      const npcId = i.values[0];
      const selectedNPC = npcConfig[npcId];
      if (!selectedNPC) return;

      const [npcData] = await UserNPC.findOrCreate({
        where: { userId: user.id, npcId },
      });

      if ((npcData.affection || 0) < MIN_AFFECTION) {
        const reject = buildContainerV2({
          accentColorHex: ui.getColor("error") || "#ef4444",
          authorName: "Naura Amusement Park",
          title: `${e("shy", "\uD83D\uDE33")} Ajakanmu belum diterima`,
          iconURL: user.displayAvatarURL(),
          expression: "fail",
          description: `**${selectedNPC.name}** masih canggung sama kamu, jadi ajakannya ditolak halus. Butuh minimal **${MIN_AFFECTION} afeksi** dulu. Sapa dan kasih hadiah lewat \`/survival npc\` ya, Naura dukung kamu!`,
          footerText: ui.getFooter("survival"),
        });

        handled = true;
        await i
          .followUp({
            ...reject,
            flags: (reject.flags || 0) | MessageFlags.Ephemeral,
          })
          .catch(() => {});
        return;
      }

      // Tiketnya baru dipakai setelah ajakan benar-benar diterima.
      const fresh = await cacheManager.getUserProfile(user.id);
      const bag = safeParseInventory(fresh.inventory);
      const idx = bag.findIndex((item) => item && TICKET_IDS.includes(item.id));
      if (idx > -1) {
        bag.splice(idx, 1);
        await cacheManager.updateUserProfile(user.id, { inventory: bag });
      }

      npcData.affection = Math.min(
        100,
        (npcData.affection || 0) + BONUS_AFFECTION,
      );
      if (npcData.affection >= 30 && npcData.relationshipLevel < 1)
        npcData.relationshipLevel = 1;
      if (npcData.affection >= 60 && npcData.relationshipLevel < 2)
        npcData.relationshipLevel = 2;
      if (npcData.affection >= 90 && npcData.relationshipLevel < 3)
        npcData.relationshipLevel = 3;
      npcData.lastInteraction = new Date();
      await npcData.save();

      const portrait = findPortrait(selectedNPC);
      const files = [];
      let bannerAttachmentName;

      if (portrait) {
        const ext = path.extname(portrait.name) || ".png";
        bannerAttachmentName = `date${ext}`;
        files.push(
          new AttachmentBuilder(portrait.full, { name: bannerAttachmentName }),
        );
      }

      const levelName =
        RELATIONSHIP_NAMES[npcData.relationshipLevel || 0] || "Kenalan";

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        authorName: "Naura Amusement Park",
        title: `${e("blowkiss", "\uD83D\uDC96")} Kencannya menyenangkan!`,
        iconURL: user.displayAvatarURL(),
        expression: "love",
        description: [
          `Kamu naik bianglala bareng **${selectedNPC.name}**, dan senyumnya nggak hilang sepanjang jalan. Naura ikut senang lihat kalian!`,
          "",
          `> ${e("impressed", "\uD83D\uDC97")} Afeksi bertambah **+${BONUS_AFFECTION}** menjadi **${npcData.affection}/100**`,
          `> ${e("read", "\uD83D\uDCD6")} Status hubungan: **${levelName}**`,
          "",
          "Fotonya Naura simpan di galeri, biar bisa kamu lihat kapan saja lewat `/survival gallery`.",
        ].join("\n"),
        bannerAttachmentName,
        files,
        footerText: ui.getFooter("survival"),
      });

      handled = true;
      await i.editReply({ ...successPayload, embeds: [] }).catch(() => {});
    });

    collector.on("end", async () => {
      if (handled) return;

      const timeout = buildContainerV2({
        accentColorHex: ui.getColor("warning") || "#FFB347",
        authorName: "Naura Amusement Park",
        title: `${e("sleepy", "\u231B")} Waktunya habis`,
        iconURL: user.displayAvatarURL(),
        expression: "fail",
        description:
          "Tamannya mulai sepi dan kamu belum memilih siapa pun. Tiketmu Naura simpan utuh kok, jadi bisa dipakai lain waktu!",
        footerText: ui.getFooter("survival"),
      });

      await interaction.editReply({ ...timeout, embeds: [] }).catch(() => {});
    });
  },
};
