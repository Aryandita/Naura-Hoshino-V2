"use strict";

const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const { renderRoomCanvas } = require("../../src/canvas/roomCanvas");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const UserRoom = require("../../src/models/mongo/UserRoom");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("room")
    .setDescription("🛋️ Kelola dan kunjungi Kamar Virtual Cyber-Pod Isometrik 2.5D")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat kamar virtual 2.5D milikmu atau teman satu server")
        .addUserOption((opt) => opt.setName("target").setDescription("User pemilik kamar yang ingin dilihat")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("decorate")
        .setDescription("Tambahkan atau tata furnitur di dalam kamarmu"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("guestbook")
        .setDescription("Tinggalkan pesan hologram di buku tamu kamar teman")
        .addUserOption((opt) => opt.setName("target").setDescription("Pemilik kamar").setRequired(true))
        .addStringOption((opt) => opt.setName("pesan").setDescription("Isi pesan hologram").setRequired(true).setMaxLength(150)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("gift")
        .setDescription("Kirimkan secangkir kopi / teh untuk menambah stamina teman")
        .addUserOption((opt) => opt.setName("target").setDescription("Penerima kado").setRequired(true)),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.user;
    const authorDisplayName = interaction.member?.displayName || user.displayName || user.username;

    if (subcommand === "view") {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser("target") || user;
      const targetDisplayName = interaction.guild?.members.cache.get(targetUser.id)?.displayName || targetUser.displayName || targetUser.username;

      let room = null;
      try {
        room = await UserRoom.findOne({ userId: targetUser.id });
      } catch (_) {}

      if (!room) {
        room = {
          userId: targetUser.id,
          displayName: targetDisplayName,
          level: 1,
          comfortScore: 120,
          furniture: [
            { name: "Cyber Bed", icon: "🛏️", x: 1, y: 1 },
            { name: "Synthesizer Desk", icon: "🎹", x: 4, y: 1 },
            { name: "Kotatsu Table", icon: "🍵", x: 2, y: 3 },
            { name: "Neon Bonsai", icon: "🪴", x: 4, y: 4 },
          ],
          holoCardName: "Hoshino Spark",
          guestbook: [],
          likesCount: 5,
        };
      }

      const roomBuffer = await renderRoomCanvas(room, targetUser, { icon: "🐱" });
      const attachment = new AttachmentBuilder(roomBuffer, { name: "cyber-room.png" });

      const guestEntries = (room.guestbook || [])
        .slice(-3)
        .map((g) => `• **${g.fromName}**: "${g.message}"`)
        .join("\n") || "*Belum ada catatan di buku tamu.*";

      const payload = buildContainerV2({
        authorName: "NAURA LIVING ROOM 2.5D",
        title: `🛋️ Cyber Pod Milik ${targetDisplayName}`,
        description: `Selamat datang di ruang santai **${targetDisplayName}**! Kamar ini tertata dengan suasana futuristik dan kenyamanan hangat.\n\n📊 **Statistik Kamar:**\n• Level Kamar: \`Level ${room.level || 1}\`\n• Skor Kenyamanan: \`${room.comfortScore || 120}/1000\`\n• Total Disukai: \`${room.likesCount || 0} ❤️\`\n\n📖 **Buku Tamu Terkini:**\n${guestEntries}`,
        mediaUrl: "attachment://cyber-room.png",
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({
        ...payload,
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (subcommand === "guestbook") {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser("target");
      const message = interaction.options.getString("pesan");

      if (targetUser.id === user.id) {
        const payload = buildContainerV2({
          authorName: "NAURA LIVING ROOM 2.5D",
          title: "✦ Buku Tamu Sendiri ✦",
          description: `Kamu tidak bisa menulis di buku tamu kamarmu sendiri ya, **${authorDisplayName}**! Kunjungi kamar temanmu untuk meninggalkan pesan hangat~ ✨`,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
      }

      try {
        let room = await UserRoom.findOne({ userId: targetUser.id });
        if (!room) {
          room = new UserRoom({
            userId: targetUser.id,
            displayName: targetUser.username,
            guestbook: [],
          });
        }
        room.guestbook.push({
          fromUserId: user.id,
          fromName: authorDisplayName,
          message,
          timestamp: new Date(),
        });
        if (room.guestbook.length > 20) room.guestbook.shift();
        room.likesCount = (room.likesCount || 0) + 1;
        await room.save();
      } catch (_) {}

      const payload = buildContainerV2({
        authorName: "NAURA LIVING ROOM 2.5D",
        title: "✉️ Pesan Hologram Terpasang!",
        description: `Pesan hangat dari **${authorDisplayName}** berhasil diabadikan di buku tamu kamar **${targetUser.username}**!\n\n> *"${message}"*\n\n❤️ *Skor disukai kamar temanmu bertambah +1!*`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }

    if (subcommand === "gift") {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser("target");

      if (targetUser.id === user.id) {
        const payload = buildContainerV2({
          authorName: "NAURA LIVING ROOM 2.5D",
          title: "✦ Kado Untuk Diri Sendiri ✦",
          description: `Gunakan secangkir kopi ini untuk menyemangati temanmu ya, **${authorDisplayName}**!`,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
      }

      try {
        await cacheManager.incrementUserSurvival(targetUser.id, "stamina", 20);
      } catch (_) {}

      const payload = buildContainerV2({
        authorName: "NAURA LIVING ROOM 2.5D",
        title: "☕ Secangkir Kopi Kosmik Dikirimkan!",
        description: `**${authorDisplayName}** menyuguhkan secangkir kopi hangat ke kamar **${targetUser.username}**!\n\n✨ **Efek Kado:**\n• Stamina **${targetUser.username}** bertambah: \`+20 Stamina\`!`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }

    if (subcommand === "decorate") {
      await interaction.deferReply();
      const payload = buildContainerV2({
        authorName: "NAURA LIVING ROOM 2.5D",
        title: "🛠️ Studio Dekorasi Kamar",
        description: `Halo, **${authorDisplayName}**! Kamu bisa mengatur dan membeli furnitur kamar baru melalui Web Dashboard di **http://localhost:19130/portfolio** atau gunakan koin RPG untuk memperluas luas grid kamarmu!\n\n✨ *Setiap furnitur baru yang kamu pasang akan meningkatkan skor kenyamanan dan regenerasi staminamu.*`,
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }
  },
};
