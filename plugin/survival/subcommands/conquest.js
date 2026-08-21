"use strict";

const { AttachmentBuilder } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const territoryWarEngine = require("../../../src/services/territoryWarEngine");
const { drawTerritoryMap } = require("../../../src/canvas/territoryCanvas");
const GuildClan = require("../../../src/models/GuildClan");

module.exports = {
  name: "conquest",
  description: "🏰 Perang Faksi Wilayah Klan & Klaim Pajak Sektor (Neo-Hoshino)",

  async execute(interaction) {
    const action = interaction.options.getString("aksi") || "map";
    const sectorId = interaction.options.getString("sektor") || "SECTOR_DOCKS";
    const energy = interaction.options.getInteger("energi") || 50;
    const userId = interaction.user.id;

    // Cari klan pemain
    const allClans = await GuildClan.findAll();
    const userClan = allClans.find((c) => {
      const members = Array.isArray(c.members) ? c.members : (typeof c.members === "string" ? JSON.parse(c.members) : []);
      return c.leaderId === userId || members.includes(userId);
    });

    // 1. LIHAT PETA WILAYAH (MAP)
    if (action === "map") {
      const territories = await territoryWarEngine.getTerritories();
      const files = [];

      try {
        const mapBuffer = await drawTerritoryMap(territories);
        files.push(new AttachmentBuilder(mapBuffer, { name: "territory_map.png" }));
      } catch (err) {
        // Fallback jika canvas gagal
      }

      const territoryList = territories
        .map((t) => `**• ${t.name}** (\`${t.territoryId}\`)\n  - Penguasa: **${t.clanName || "Netral"}** | Poin: \`${t.controlPoints}/1000\`\n  - Pajak: \`${t.taxYield} ⭐/jam\` | *${t.buffEffect}*`)
        .join("\n\n");

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "🗺️ Peta Dominasi Wilayah Neo-Hoshino",
        title: "🏰 Status 5 Sektor Kekuasaan Klan",
        description: [
          `Perang faksi wilayah klan berlangsung setiap saat! Rebut sektor strategis untuk mendapatkan pajak koin dan buff pasif klan.`,
          ``,
          territoryList,
          ``,
          userClan ? `🚩 **Klan Anda:** **${userClan.name}** (Level ${userClan.level})` : `⚠️ *Anda belum bergabung dengan klan mana pun!*`,
          ``,
          `-# 💡 *Gunakan \`/survival rpg conquest aksi:attack sektor:SECTOR_DOCKS energi:50\` untuk menyerang!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, files });
    }

    // Periksa keanggotaan klan untuk aksi serang/bertahan/pajak
    if (!userClan) {
      return interaction.editReply({
        ...buildErrorContainerV2({
          title: "Klan Diperlukan",
          description: "Kamu harus menjadi anggota atau pemimpin klan untuk berpartisipasi dalam Perang Wilayah!",
          footerText: ui.getFooter("survival"),
        }),
      });
    }

    // 2. SERANG SEKTOR (ATTACK)
    if (action === "attack") {
      const res = await territoryWarEngine.attackTerritory({
        clanId: userClan.id,
        clanName: userClan.name,
        territoryId: sectorId,
        energySpent: energy,
      });

      if (res.action === "CAPTURED") {
        const payload = buildContainerV2({
          accentColorHex: "#86EFAC",
          authorName: "🚩 Kemenangan Penaklukan Sektor",
          title: `🎉 SEKTOR BERHASIL DIREBUT!`,
          description: [
            `Luar biasa! Klan **${userClan.name}** berhasil menaklukkan **${res.territoryName}**!`,
            ``,
            `🏰 **Penguasa Baru:** **${res.newOwnerName}**`,
            `🛡️ **Poin Kontrol Awal:** \`${res.controlPoints} Poin\``,
            ``,
            `Seluruh anggota klan kini menikmati buff pasif sektor dan royalti pajak harian yang masuk ke kas klan!`,
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return interaction.editReply(payload);
      } else if (res.action === "DEFENDED") {
        const payload = buildContainerV2({
          accentColorHex: "#38BDF8",
          authorName: "🛡️ Penguatan Pertahanan Sektor",
          title: `✨ Pertahanan ${res.territoryName} Meningkat!`,
          description: `Klan **${userClan.name}** memperkuat pertahanan sektor! Poin kontrol kini mencapai **${res.controlPoints} / 1000**.`,
          footerText: ui.getFooter("survival"),
        });

        return interaction.editReply(payload);
      } else {
        const payload = buildContainerV2({
          accentColorHex: "#F59E0B",
          authorName: "⚔️ Serangan Sektor Wilayah",
          title: `💥 Menyerang ${res.territoryName}!`,
          description: [
            `Klan **${userClan.name}** mengerahkan ${energy} poin energi tempur!`,
            ``,
            `🛡️ **Sisa Pertahanan Lawan:** \`${res.remainingDefPoints} Poin Kontrol\``,
            `Serang terus bersama anggota klan lain untuk merebut sektor ini sepenuhnya!`,
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return interaction.editReply(payload);
      }
    }

    // 3. KLAIM PAJAK KAS KLAN (TAX)
    if (action === "tax") {
      const taxRes = await territoryWarEngine.claimClanTax(userClan.id);
      if (!taxRes.success) {
        let msg = "Gagal mengklaim pajak wilayah.";
        if (taxRes.reason === "NO_TERRITORIES_OWNED") msg = "Klan milikmu belum menguasai sektor wilayah mana pun!";
        if (taxRes.reason === "NO_ACCUMULATED_TAX") msg = "Belum ada akumulasi pajak baru yang dapat diklaim saat ini.";

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Pajak Tidak Tersedia",
            description: msg,
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#86EFAC",
        authorName: "💰 Kas Bendahara Klan",
        title: "✨ Pajak Wilayah Masuk ke Kas Klan!",
        description: [
          `Hasil panen pajak dari **${taxRes.territoriesCount} Sektor** telah berhasil disetorkan!`,
          ``,
          `💵 **Total Setoran Kas:** \`+${taxRes.claimedTax.toLocaleString("id-ID")} Star Fragments\``,
          `🏰 **Klan Penerima:** **${userClan.name}**`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }
  },
};
