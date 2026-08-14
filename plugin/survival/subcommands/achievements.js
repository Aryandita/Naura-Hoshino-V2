"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require("discord.js");

const UserAchievement = require("../../../src/models/UserAchievement");
const achievementsPool = require("../../../src/survival/data/achievementsData");
const {
  generateAchievementImage,
} = require("../../../src/canvas/achievementCanvas");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const COLLECTOR_MS = 60000;
const CUSTOM_EMOJI = /^<(a)?:(\w+):(\d+)>$/;
const IMAGE_NAME = "achievement.png";

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

// Select menu menolak emoji kustom kalau dikirim sebagai teks mentah, jadi
// bentuknya harus diurai dulu menjadi objek.
function toSelectEmoji(raw) {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const match = raw.match(CUSTOM_EMOJI);
  if (!match) return raw;
  return { id: match[3], name: match[2], animated: Boolean(match[1]) };
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [achievementData] = await UserAchievement.findOrCreate({
      where: { userId: user.id },
    });

    const unlockedIds = achievementData.unlockedAchievements || [];
    const unlocked = achievementsPool.filter((a) => unlockedIds.includes(a.id));

    if (unlocked.length === 0) {
      return ui.sendError(interaction, "err_sys_33", true);
    }

    const activeTitle = achievementData.activeTitle
      ? achievementsPool.find((a) => a.id === achievementData.activeTitle)
      : null;

    const daftar = unlocked
      .map((a) => `> ${a.emoji} **${a.title}**\n> *${a.description}*`)
      .join("\n\n");

    const payload = buildContainerV2({
      accentColorHex: "#FFD700",
      authorName: "Naura Hall of Fame",
      title: `${e("impressed", "\uD83C\uDFC6")} Koleksi pencapaian ${user.username}`,
      iconURL: user.displayAvatarURL(),
      description: `Naura simpan semua gelar yang sudah kamu raih di sini. Bangga banget lihat daftarnya sepanjang ini!\n\n${daftar}`,
      footerText: activeTitle
        ? `Gelar aktif: ${activeTitle.emoji} ${activeTitle.title}`
        : ui.getFooter("survival"),
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("set_active_title")
      .setPlaceholder("Pilih gelar yang mau dipakai di profilmu")
      .addOptions(
        unlocked.map((a) => {
          const option = {
            label: a.title.substring(0, 100),
            description: (a.description || "").substring(0, 100),
            value: a.id,
          };
          const emoji = toSelectEmoji(a.emoji);
          if (emoji) option.emoji = emoji;
          return option;
        }),
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Container hasil builder harus di-spread, bukan ditimpa. Kalau ditimpa,
    // seluruh isi kartunya hilang dan pemain cuma melihat select menu kosong.
    await interaction.reply({
      ...payload,
      components: [...payload.components, row],
    });
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    let selesai = false;

    collector.on("collect", async (i) => {
      if (i.customId !== "set_active_title") return;

      await i.deferUpdate();

      const selected = achievementsPool.find((a) => a.id === i.values[0]);
      if (!selected) return;

      achievementData.activeTitle = selected.id;
      await achievementData.save();

      const files = [];
      let bannerName;

      try {
        const buffer = await generateAchievementImage(
          user,
          selected.title,
          selected.description,
          selected.color,
        );
        files.push(new AttachmentBuilder(buffer, { name: IMAGE_NAME }));
        bannerName = IMAGE_NAME;
      } catch (err) {
        // Gelarnya tetap tersimpan walaupun gambarnya gagal dirender.
      }

      const updated = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#00FF00",
        authorName: "Naura Hall of Fame",
        title: `${e("cheers", "\uD83C\uDF89")} Gelarmu sudah Naura ganti!`,
        iconURL: user.displayAvatarURL(),
        description: `Yaay! Mulai sekarang kamu resmi menyandang gelar **${selected.title}**. Cocok banget sama kamu, lho!`,
        bannerAttachmentName: bannerName,
        files,
        footerText: ui.getFooter("survival"),
      });

      selesai = true;
      await i.editReply(updated);
      collector.stop("selected");
    });

    collector.on("end", async (collected, reason) => {
      if (selesai || reason !== "time") return;

      const timeout = buildErrorContainerV2({
        title: `${e("sleepy", "\u231B")} Waktunya sudah habis`,
        description:
          "Naura tunggu agak lama, tapi belum ada gelar yang dipilih. Nggak apa-apa, panggil Naura lagi kapan saja yaa!",
        footerText: ui.getFooter("survival"),
      });

      await interaction.editReply(timeout).catch(() => {});
    });
  },
};
