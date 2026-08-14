const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const UserSurvival = require("../../models/UserSurvival");
const UserProfile = require("../../models/UserProfile");
const cacheManager = require("../../managers/cacheManager");
const ui = require("../../config/ui");
const path = require("path");
const fs = require("fs");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

async function executeOnboarding(interaction, client) {
  const user = interaction.user;
  const botAvatar = client.user.displayAvatarURL({ size: 128 });

  const pages = [
    {
      title: "🌟 Selamat Datang di Dunia Baru!",
      desc: `Halo **${user.username}**! Aku Naura.\nSepertinya ini pertama kalinya kamu menginjakkan kaki di dunia Survival RPG ini.\n\n▬▬▬\n\n💬 **Naura:** "Dunia ini sangat luas, mulai dari Desa yang asri, Tambang yang gelap, hingga gemerlap Naura City. Tapi, untuk bertahan hidup, kamu butuh kerja keras!"`,
      imgPath: path.join(
        __dirname,
        "..",
        "..",
        "assets",
        "dashboard",
        "naura.png",
      ),
    },
    {
      title: "📖 Cara Bermain (Basic)",
      desc: `Untuk bertahan hidup, kamu harus menjaga 3 indikator utama:\n\n🥩 **Lapar (Hunger) & Haus (Thirst):** Jika habis, kamu akan pingsan.\n⚡ **Stamina:** Dibutuhkan untuk bekerja dan memancing.\n💖 **HP (Darah):** Untuk bertarung di Gua/Dungeon.\n\n▬▬▬\n\n💬 **Naura:** "Gunakan \`/survival work\` untuk mencari uang, dan beli makanan di \`/survival shop\` sebelum kamu kelaparan!"`,
      imgPath: path.join(
        __dirname,
        "..",
        "..",
        "assets",
        "dashboard",
        "naura.png",
      ),
    },
    {
      title: "🕒 Jam Malam & Rumah Sakit",
      desc: `Dunia ini memiliki sistem waktu (Pagi/Siang/Sore/Malam) dan Cuaca (Cerah/Hujan/Badai) yang berganti.\n\n🚨 **Aturan Penting:** Jangan begadang melewati jam 24:00 (Tengah Malam) in-game! Jika melanggar, kamu akan pingsan, waktu akan melompat keesokan harinya, dan kamu harus membayar denda rumah sakit yang sangat mahal!\n\n▬▬▬\n\n💬 **Naura:** "Suster Maya di Rumah Sakit Kota galak loh kalau kamu masuk UGD gara-gara begadang!"`,
      imgPath: path.join(
        __dirname,
        "..",
        "..",
        "assets",
        "survival",
        "characters",
        "suster_maya.jpeg",
      ),
    },
    {
      title: "❤️ Penduduk & Relasi",
      desc: `Ada 16 NPC Khas Nusantara yang tersebar!\nKamu bisa menyapa mereka di \`/survival npc\` atau memberikan hadiah. Semakin tinggi afeksi (hati) mereka, kamu bisa menjalin hubungan dari Teman, Sahabat, hingga Menikah!\n\n▬▬▬\n\n💬 **Naura:** "Yuk mulai! Aku sudah tak sabar melihat petualanganmu. Klik tombol di bawah untuk membuat profilmu!"`,
      imgPath: path.join(__dirname, "..", "..", "assets", "core", "avatar.png"),
    },
  ];

  let currentPage = 0;

  // Membangun payload Container V2 untuk satu halaman onboarding
  const generateContainer = (pageIndex) => {
    const page = pages[pageIndex];
    let files = [];
    let bannerAttachmentName;

    // Lampirkan gambar lokal jika ada sebagai banner
    if (page.imgPath && fs.existsSync(page.imgPath)) {
      const ext = path.extname(page.imgPath).replace(".", "");
      const filename = `onboard_${pageIndex}.${ext}`;
      files.push(new AttachmentBuilder(page.imgPath, { name: filename }));
      bannerAttachmentName = filename;
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura RPG Survival, Tutorial",
      title: page.title,
      iconURL: botAvatar,
      description: page.desc,
      bannerAttachmentName,
      footerText: `Prolog Survival - Halaman ${pageIndex + 1} dari ${pages.length}`,
    });

    return { ...payload, files };
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tut_next")
      .setLabel("Berikutnya")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("▶️"),
  );

  const firstContainer = generateContainer(0);
  const response = await interaction.reply({
    ...firstContainer,
    components: [row],
    fetchReply: true,
  });

  const collector = response.createMessageComponentCollector({
    filter: (i) => i.user.id === user.id,
    time: 180000,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();

    if (i.customId === "tut_next") {
      currentPage++;

      if (currentPage < pages.length - 1) {
        const nextContainer = generateContainer(currentPage);
        await i.editReply({ ...nextContainer, components: [row] });
      } else if (currentPage === pages.length - 1) {
        const finalRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("tut_start")
            .setLabel("Mulai Petualangan!")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
        );
        const lastContainer = generateContainer(currentPage);
        await i.editReply({ ...lastContainer, components: [finalRow] });
      }
    } else if (i.customId === "tut_start") {
      collector.stop();

      // Buat data user di DB untuk membuka akses command survival
      await cacheManager.getUserSurvival(user.id);
      await cacheManager.getUserProfile(user.id);

      const finishPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#00FF00",
        title: "🎉 Profil Survival Dibuat!",
        description:
          "Kamu sekarang resmi menjadi penduduk Desa Naura. Silakan ulangi perintah `/survival` kamu tadi untuk bermain!",
        footerText: ui.getFooter("survival"),
      });

      await i.editReply({ ...finishPayload, components: [], files: [] });
    }
  });

  collector.on("end", (collected) => {
    if (currentPage < pages.length - 1) {
      interaction.editReply({ components: [] }).catch(() => {});
    }
  });
}

module.exports = { executeOnboarding };
