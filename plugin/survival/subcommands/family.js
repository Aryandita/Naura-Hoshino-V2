"use strict";

const { MessageFlags } = require("discord.js");
const familyEngine = require("../../../src/survival/engines/familyEngine");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildSuccessContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = {
  name: "family",
  description: "👨‍👩‍👧 Interaksi Pengasuhan Keluarga & Magang Bakat Anak",

  async execute(interaction) {
    const action = interaction.options.getString("aksi") || "status";
    const user = interaction.user;

    const child = await familyEngine.getChild(user.id);
    if (!child) {
      const payload = buildErrorContainerV2({
        title: "Belum Memiliki Anak",
        description: [
          "Kamu belum memiliki anak dalam perjalanan hidupmu di Naura Wilds.",
          "",
          "> **Syarat Memulai Keluarga:**",
          "> 1. Menikah dengan salah satu wanita romansa resmi (`/survival date`).",
          "> 2. Tingkatkan keharmonisan rumah tangga hingga memicu event kelahiran anak (*Parenthood Event*).",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 1. STATUS ANAK
    if (action === "status") {
      const hungerBar =
        "🟩".repeat(Math.round(child.hunger / 10)) +
        "⬜".repeat(10 - Math.round(child.hunger / 10));
      const happyBar =
        "🟨".repeat(Math.round(child.happiness / 10)) +
        "⬜".repeat(10 - Math.round(child.happiness / 10));

      const stageLabels = {
        Toddler: "🍼 Balita (Toddler)",
        Kid: "🎒 Anak Sekolah (Kid)",
        Apprentice: "⭐ Murid Magang Berbakat (Apprentice)",
      };

      const payload = buildContainerV2({
        accentColorHex: "#F472B6",
        authorName: "NAURA WILDS FAMILY SYSTEM",
        title: `👨‍👩‍👧 Profil Buah Hati: ${child.name}`,
        description: [
          `Buah cinta pernikahan bahagiamu bersama **${child.motherName}**.\n`,
          `🌱 **Fase Pertumbuhan:** \`${stageLabels[child.stage] || child.stage}\``,
          `⭐ **Level Tumbuh Kembang:** \`Level ${child.level} / 10\` (\`${child.xp} / ${child.nextLevelXp} XP\`)`,
          "",
          `🍗 **Kenyang:** \`${child.hunger}%\`\n${hungerBar}`,
          `💖 **Kebahagiaan:** \`${child.happiness}%\`\n${happyBar}`,
          "",
          child.level >= 8
            ? "✨ *Anakmu sudah cukup dewasa dan siap membantu mata pencaharian keluarga! Gunakan `/survival family aksi:apprentice` untuk mengklaim bantuan harian.*"
            : "📖 *Rawat dan bimbing anakmu dengan `/survival family aksi:feed` dan `/survival family aksi:teach` agar cepat tumbuh dewasa.*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 2. MEMBERI MAKAN (FEED)
    if (action === "feed") {
      const feedRes = await familyEngine.feedChild(user.id);
      if (!feedRes.ok) {
        const payload = buildErrorContainerV2({
          title: "Gagal Menyuapi Anak",
          description: "Terjadi kendala saat menyuapi buah hati.",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const desc = [
        `Kamu menyiapkan sarapan hangat penuh cinta untuk **${child.name}**.`,
        `Si kecil tersenyum ceria dan menyantap makanannya sampai habis!`,
        "",
        `🍗 **Kenyang:** \`+30%\` (Sekarang: \`${feedRes.child.hunger}%\`)`,
        `💖 **Kebahagiaan:** \`+15%\` (Sekarang: \`${feedRes.child.happiness}%\`)`,
        `⭐ **EXP Tumbuh Kembang:** \`+25 XP\``,
      ];

      if (feedRes.leveledUp) {
        desc.push(
          "",
          `🎉 **Selamat! ${child.name} naik ke Level ${feedRes.child.level} (${feedRes.child.stage})!**`,
        );
      }

      const payload = buildSuccessContainerV2({
        title: `Momen Hangat Bersama ${child.name}`,
        description: desc.join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 3. BIMBINGAN BELAJAR (TEACH)
    if (action === "teach") {
      const teachRes = await familyEngine.teachChild(user.id);
      if (!teachRes.ok) {
        const payload = buildErrorContainerV2({
          title: "Gagal Membimbing Belajar",
          description: "Terjadi kendala saat membimbing buah hati.",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const desc = [
        `Kamu meluangkan waktu duduk bersama **${child.name}**, membacakan buku dongeng dan mengajarinya keterampilan dasar.`,
        `Matanya berbinar penuh rasa ingin tahu terhadap dunia petualangan!`,
        "",
        `💖 **Kebahagiaan:** \`+10%\` (Sekarang: \`${teachRes.child.happiness}%\`)`,
        `⭐ **EXP Tumbuh Kembang:** \`+40 XP\``,
      ];

      if (teachRes.leveledUp) {
        desc.push(
          "",
          `🎉 **Selamat! ${child.name} naik ke Level ${teachRes.child.level} (${teachRes.child.stage})!**`,
        );
      }

      const payload = buildSuccessContainerV2({
        title: `Pelajaran Penuh Kasih Bersama ${child.name}`,
        description: desc.join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 4. BANTUAN MAGANG (APPRENTICE PERK)
    if (action === "apprentice") {
      const perkRes = await familyEngine.claimApprenticePerk(user.id);
      if (!perkRes.ok) {
        const payload = buildErrorContainerV2({
          title: "Belum Memenuhi Syarat Magang",
          description: [
            `**${child.name}** saat ini masih berada di \`Level ${child.level}\` (${child.stage}).`,
            "",
            "> Buah hatimu baru bisa membantu mata pencaharian keluarga setelah mencapai **Level 8 (Apprentice)**.",
            "> Terus bimbing belajarnya setiap hari!",
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const payload = buildSuccessContainerV2({
        title: `Bantuan Magang: ${perkRes.perkName}`,
        description: [
          `**${child.name}** dengan bangga menyerahkan hasil kerja magangnya hari ini sesuai keahlian sang ibu (${child.motherName}):`,
          "",
          `🎁 **Hasil Magang:** **${perkRes.rewardDesc}**`,
          `💰 Saldo Star Fragments dan Kuponmu telah bertambah secara otomatis!`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    return interaction.reply({
      content: "Aksi tidak dikenal.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
