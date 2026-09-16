"use strict";

const path = require("path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const UserNPC = require("../../../src/models/UserNPC");
const ui = require("../../../src/config/ui");
const npcs = require("../../../src/survival/data/npcs");
const { findPortrait } = require("../../../src/survival/helpers/npcHelpers");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const COLLECTOR_MS = 180000;
const MAX_OPTIONS = 25;

const RELATIONSHIP_NAMES = ["Kenalan", "Teman", "Sahabat", "Pacar", "Menikah"];
const RELATIONSHIP_EMOJI = [
  "🤝",
  "😊",
  "✨",
  "💖",
  "💍",
];

const CAPTIONS = [
  "Lihat deh, senyum kalian di foto ini manis banget! Naura ikut senang lihatnya.",
  "Naura simpan foto ini rapi-rapi buat kamu. Kenangan kayak gini tidak boleh hilang, ya!",
  "Ihh, kalian akrab banget di sini. Naura sampai terharu melihatnya.",
  "Momen ini spesial banget. Kapan pun kamu kangen, tinggal buka album ini lagi ya!",
  "Naura suka banget foto yang ini. Kelihatan hangat dan tulus.",
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function relationshipLabel(level) {
  const index = Math.max(
    0,
    Math.min(RELATIONSHIP_NAMES.length - 1, Number(level) || 0),
  );
  return `${RELATIONSHIP_EMOJI[index]} ${RELATIONSHIP_NAMES[index]}`;
}

function formatDate(value) {
  if (!value) return "belum tercatat";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

module.exports = {
  async execute(interaction, client) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    const bonds = await UserNPC.findAll({ where: { userId: user.id } });
    // ATURAN KETAT: Hanya tampilkan NPC yang sudah pernah ditemui (afeksi > 0 atau lastInteraction != null)
    const met = (bonds || [])
      .filter((b) => npcs[b.npcId] && ((b.affection || 0) > 0 || b.lastInteraction))
      .sort((a, b) => (b.affection || 0) - (a.affection || 0));

    const state = survival.rpg_state || {};
    const album = Array.isArray(state.gallery_album) ? state.gallery_album : [];
    const unlockedCgs = Array.isArray(state.unlocked_cgs) ? state.unlocked_cgs : [];

    if (met.length === 0 && unlockedCgs.length === 0) {
      const emptyPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Album Kenangan Naura",
        title: `${e("gallery", "📸")} Albummu masih kosong`,
        iconURL: client.user.displayAvatarURL(),
        description: [
          '> *"Belum ada satu pun foto di sini, lho. Yuk temui warga desa dan kota dulu!"*',
          "",
          `Pakai ${"`/survival npc`"} untuk menyapa mereka. Begitu kamu berkenalan, fotonya otomatis terbuka di album ini.`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });
      return interaction.reply(emptyPayload);
    }

    const buildIndex = () => {
      const saved = met.filter((b) => album.includes(b.npcId)).length;
      return buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Album Kenangan Naura",
        title: `${e("gallery", "📸")} Album ${user.displayName || user.username}`,
        iconURL: user.displayAvatarURL(),
        description: [
          `> *"${pick(CAPTIONS)}"*`,
          "",
          `${e("naura", "💖")} Foto warga terbuka: **${met.length}** • Favorit: **${saved}**`,
          `🖼️ Visual Romance CG terbuka: **${unlockedCgs.length}** foto momen spesial`,
          "",
          "Pilih salah satu foto yang sudah kamu buka di bawah untuk melihat kenangannya!",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });
    };

    const selectRow = () => {
      const options = met.slice(0, MAX_OPTIONS).map((bond) => {
        const npc = npcs[bond.npcId];
        const mark = album.includes(bond.npcId) ? "⭐ " : "";
        return {
          label: `${mark}${npc.name}`.substring(0, 100),
          value: bond.npcId,
          description:
            `${RELATIONSHIP_NAMES[Math.min(4, bond.relationshipLevel || 0)]} • afeksi ${bond.affection || 0} RP`.substring(
              0,
              100,
            ),
          emoji: "📸",
        };
      });

      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("gallery_pick")
          .setPlaceholder("Buka foto kenangan yang sudah kamu dapatkan...")
          .addOptions(options),
      );
    };

    const indexPayload = buildIndex();
    const response = await interaction.reply({
      ...indexPayload,
      components: [...indexPayload.components, selectRow()],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    let opened = null;

    function photoPayload(bond) {
      const npc = npcs[bond.npcId];
      const portrait = findPortrait(npc);
      const files = [];
      let mediaAttachmentNames;

      if (portrait) {
        const name = `memory${path.extname(portrait)}`;
        files.push(new AttachmentBuilder(portrait, { name }));
        mediaAttachmentNames = [name];
      }

      const isFavorite = album.includes(bond.npcId);
      const hasWeddingCg = unlockedCgs.includes(`wedding_${bond.npcId}`);
      const hasFamilyCg = unlockedCgs.includes(`family_${bond.npcId}`);

      const extraCgStatus = [];
      if (hasWeddingCg) extraCgStatus.push("💍 Foto Pernikahan: Terbuka");
      if (hasFamilyCg) extraCgStatus.push("👶 Potret Keluarga: Terbuka");

      return buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: `${npc.name} - ${npc.title || "Warga"}`,
        title: `${isFavorite ? "⭐" : e("gallery", "📸")} Kenangan bersama ${npc.name}`,
        iconURL: user.displayAvatarURL(),
        description: [
          `> *"${pick(CAPTIONS)}"*`,
          "",
          `**Hubungan:** ${relationshipLabel(bond.relationshipLevel)}`,
          `**Afeksi:** ${bond.affection || 0} RP`,
          `**Terakhir bertemu:** ${formatDate(bond.lastInteraction)}`,
          npc.location ? `**Wilayah:** ${npc.location}` : "",
          extraCgStatus.length > 0 ? `\n**Momen Spesial:**\n${extraCgStatus.join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        mediaAttachmentNames,
        files,
        footerText: ui.getFooter("survival"),
      });
    }

    const photoButtons = (bond) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("gallery_save")
          .setLabel(
            album.includes(bond.npcId)
              ? "Hapus dari favorit"
              : "Simpan ke favorit",
          )
          .setStyle(
            album.includes(bond.npcId)
              ? ButtonStyle.Secondary
              : ButtonStyle.Success,
          ),
        new ButtonBuilder()
          .setCustomId("gallery_download")
          .setLabel("Unduh foto")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("gallery_back")
          .setLabel("Kembali ke album")
          .setStyle(ButtonStyle.Secondary),
      );

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "gallery_pick") {
        opened = met.find((b) => b.npcId === i.values[0]) || null;
        if (!opened) {
          return i.followUp({
            content: "🔒 Foto ini belum berhasil kamu dapatkan di petualanganmu.",
            flags: MessageFlags.Ephemeral,
          });
        }
        const payload = photoPayload(opened);
        return i.editReply({
          ...payload,
          components: [...payload.components, photoButtons(opened)],
        });
      }

      if (i.customId === "gallery_back" || !opened) {
        const backPayload = buildIndex();
        return i.editReply({
          ...backPayload,
          components: [...backPayload.components, selectRow()],
        });
      }

      if (i.customId === "gallery_save") {
        const index = album.indexOf(opened.npcId);
        if (index >= 0) album.splice(index, 1);
        else album.push(opened.npcId);

        survival.rpg_state = {
          ...(survival.rpg_state || {}),
          gallery_album: album,
        };
        survival.changed("rpg_state", true);
        await survival.save({ fields: ["rpg_state"] });

        const payload = photoPayload(opened);
        return i.editReply({
          ...payload,
          components: [...payload.components, photoButtons(opened)],
        });
      }

      if (i.customId === "gallery_download") {
        const npc = npcs[opened.npcId];
        const portrait = findPortrait(npc);
        if (!portrait) {
          return i.followUp({
            content: `${e("cry", "😢")} Aduh, berkas fotonya tidak ketemu. Naura minta maaf, ya.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        return i.followUp({
          content: `${e("cheers", "🥂")} Ini fotomu bersama **${npc.name}**. Simpan baik-baik ya!`,
          files: [
            new AttachmentBuilder(portrait, {
              name: `naura-${npc.id}${path.extname(portrait)}`,
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on("end", async () => {
      const closing = buildIndex();
      await interaction.editReply(closing).catch(() => {});
    });
  },
};
