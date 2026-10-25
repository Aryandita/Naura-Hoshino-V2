"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const UserNPC = require("../../../src/models/UserNPC");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  safeParseInventory,
  takeItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const npcConfig = require("../../../src/survival/data/npcs");
const {
  buildContainerV2,
  disableContainerV2,
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

// Katalog barang memakai `dating_ticket` dan tiket kencan wilayah khusus (ticket_picnic, ticket_beach, dll.)
const TICKET_IDS = [
  "ticket_picnic",
  "ticket_beach",
  "ticket_cafe",
  "ticket_library",
  "dating_ticket",
  "date_ticket",
];
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
    const survival = await cacheManager.getUserSurvival(user.id);

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
      accentColorHex: survivalUI.getColor("emerald"),
      authorName: "Naura Amusement Park",
      title: `${e("happy", "\uD83C\uDFA1")} Taman Hiburan Naura`,
      iconURL: user.displayAvatarURL(),
      expression: "love",
      description: [
        "Kamu pegang selembar tiket kencan, dan tamannya ramai banget hari ini. Lampu-lampunya cantik, lho!",
        "",
        `Mau menghabiskan waktu sama siapa? Naura ingatkan ya, afeksinya harus minimal **${MIN_AFFECTION}** dulu supaya ajakanmu diterima.`,
      ].join("\n"),
      buttonsRow: [row],
      footerText: ui.getFooter("survival"),
    });

    const response = await interaction.editReply(datePayload);

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
          accentColorHex: survivalUI.getColor("danger"),
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
      const ticket = bag.find((item) => item && TICKET_IDS.includes(item.id));
      if (ticket) {
        await takeItemsAtomic(user.id, [{ id: ticket.id, amount: 1 }]);
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
      await npcData.save({
        fields: ["affection", "relationshipLevel", "lastInteraction"],
      });

      const familyEngine = require("../../../src/survival/engines/familyEngine");
      await familyEngine.unlockCg(survival, `date_${selectedNPC.id}`);

      const portrait = findPortrait(selectedNPC);
      const files = [];
      let bannerAttachmentName;

      // Resolusi latar belakang taman sesuai waktu
      const now = new Date();
      const inGameHour = (now.getUTCHours() * 2) % 24;
      let timePeriod = "siang";
      if (inGameHour >= 5 && inGameHour < 11) timePeriod = "pagi";
      else if (inGameHour >= 11 && inGameHour < 15) timePeriod = "siang";
      else if (inGameHour >= 15 && inGameHour < 19) timePeriod = "sore";
      else timePeriod = "malam";

      const parkBgPath = path.join(
        process.cwd(),
        "assets",
        "survival",
        "background",
        `park_${timePeriod}.jpeg`,
      );
      let topBannerAttachmentName;
      if (fs.existsSync(parkBgPath)) {
        topBannerAttachmentName = "park_bg.jpeg";
        files.push(
          new AttachmentBuilder(parkBgPath, { name: topBannerAttachmentName }),
        );
      }

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
        accentColorHex: survivalUI.getColor("moss"),
        authorName: "Naura Amusement Park",
        title: `${e("blowkiss", "\uD83D\uDC96")} Kencannya menyenangkan!`,
        iconURL: user.displayAvatarURL(),
        expression: "love",
        topBannerAttachmentName,
        bannerAttachmentName,
        files,
        description: [
          `Kamu menikmati momen indah bareng **${selectedNPC.name}**, dan senyumnya tidak hilang sepanjang jalan. Naura ikut senang melihat kalian!`,
          "",
          `> ${e("impressed", "\uD83D\uDC97")} Afeksi bertambah **+${BONUS_AFFECTION}** menjadi **${npcData.affection}/100**`,
          `> ${e("read", "\uD83D\uDCD6")} Status hubungan: **${levelName}**`,
          "",
          `📸 **Visual Dating CG Terbuka!** Foto kenangan kencan ini resmi tersimpan di album \`/survival gallery\`!`,
        ].join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("survival_act_date")],
        footerText: ui.getFooter("survival"),
      });


      handled = true;
      await i.editReply({ ...successPayload, embeds: [] }).catch(() => {});
    });

    collector.on("end", async (collected, reason) => {
      if (handled || reason === "navigated") return;

      await interaction
        .editReply({ ...disableContainerV2(datePayload), embeds: [] })
        .catch(() => {});
    });
  },
};
