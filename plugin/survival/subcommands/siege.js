"use strict";

/**
 * plugin/survival/subcommands/siege.js
 * Subcommand /survival siege: Perang Wilayah GvG & Pengepungan Menara Relik Kuno.
 */

const { MessageFlags } = require("discord.js");
const GuildClan = require("../../../src/models/GuildClan");
const UserSurvival = require("../../../src/models/UserSurvival");
const guildFederationEngine = require("../../../src/survival/engines/guildFederationEngine");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "siege",
  description: "Perang wilayah GvG & pengepungan Menara Relik Kuno",

  async execute(interaction, client) {
    const action = interaction.options.getString("aksi") || "status";
    const towerId =
      interaction.options.getString("tower_id") || "chrono_siphon";
    const user = interaction.user;

    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (!survival.clanId) {
      const payload = buildErrorContainerV2({
        title: "Perlu Bergabung Klan",
        description:
          "Kamu harus bergabung ke dalam klan terlebih dahulu untuk dapat berpartisipasi dalam perang wilayah dan pengepungan menara relik.",
        footerText: ui.getFooter("survival"),
      });
      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const userClan = await GuildClan.findByPk(survival.clanId);
    if (!userClan) {
      const payload = buildErrorContainerV2({
        title: "Klan Tidak Ditemukan",
        description: "Data klanmu tidak valid di database.",
        footerText: ui.getFooter("survival"),
      });
      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 1. STATUS MENARA RELIK
    if (action === "status" || action === "info") {
      const towers = guildFederationEngine.getRelicTowers();
      const lines = towers.map((t) => {
        const controller = t.controllerFedTag
          ? `[${t.controllerFedTag}]`
          : "BELUM DIKONTROL";
        const hpBar = `Ketahanan: \`${t.defenseHp.toLocaleString("id-ID")} / ${t.maxHp.toLocaleString("id-ID")}\``;
        return `🗼 **${t.name}** (${t.zone})\n   👑 Pengontrol: \`${controller}\` | ${hpBar}\n   ✨ Buff Wilayah: *${t.buffDescription}*`;
      });

      const payload = buildContainerV2({
        accentColorHex: "#8B5CF6",
        authorName: "NAURA ANCIENT RELIC TOWERS",
        title: "⚔️ Status Menara Relik Kuno & Wilayah Galaksi",
        description: [
          "Daftar menara relik kuno yang diperebutkan oleh seluruh aliansi klan antar-server:\n",
          lines.join("\n\n"),
          "\n> *Gunakan `/survival siege aksi:attack tower_id:<id>` untuk melancarkan serangan pengepungan bersama aliansimu!*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 2. SERANGAN PENGEPUNGAN (ATTACK / SIEGE)
    if (action === "attack" || action === "siege") {
      const fedId = userClan.federationId || "fed_celestial";

      const siegeResult = await guildFederationEngine.siegeRelicTower({
        federationId: fedId,
        clanId: userClan.id,
        towerId,
        siegePower: 350,
      });

      if (!siegeResult.success) {
        const payload = buildErrorContainerV2({
          title: "Pengepungan Gagal",
          description:
            siegeResult.error || "Gagal melancarkan serangan ke menara relik.",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const isConquered = siegeResult.conquered;
      const payload = buildContainerV2({
        accentColorHex: isConquered ? "#10B981" : "#F59E0B",
        authorName: "GVG TERRITORY SIEGE OPERATION",
        title: isConquered
          ? `🏆 Menara Ditaklukkan: ${siegeResult.towerName}!`
          : `💥 Serangan Berhasil ke ${siegeResult.towerName}`,
        description: isConquered
          ? [
              `Aliansimu berhasil menghancurkan pertahanan lawan dan merebut kendali penuh atas **${siegeResult.towerName}**!`,
              "",
              `• **Aliansi Pengontrol Baru:** \`[${siegeResult.controllerFedTag}]\``,
              `• **Prestise Aliansi:** \`+300 Poin\``,
              `• **Dividen Harian:** Kas klan berhak mengklaim dividen menara harian!`,
            ].join("\n")
          : [
              `Pasukan klan **${userClan.name}** berhasil menggempur barikade **${siegeResult.towerName}**!`,
              "",
              `• **Kerusakan Pengepungan:** \`-${siegeResult.damage} Defense HP\``,
              `• **Sisa Ketahanan:** \`${siegeResult.remainingHp.toLocaleString("id-ID")} / ${siegeResult.maxHp.toLocaleString("id-ID")}\``,
              `• **Pengontrol Saat Ini:** \`[${siegeResult.controllerFedTag || "BELUM DIKONTROL"}]\``,
            ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // 3. KLAIM DIVIDEN MENARA (DIVIDENDS / CLAIM)
    if (action === "dividends" || action === "claim") {
      const fedId = userClan.federationId || "fed_celestial";
      const claimResult = await guildFederationEngine.claimTowerDividends({
        federationId: fedId,
        clanId: userClan.id,
        towerId,
      });

      if (!claimResult.success) {
        const payload = buildErrorContainerV2({
          title: "Klaim Dividen Gagal",
          description:
            claimResult.error || "Gagal mengklaim dividen kas menara.",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#10B981",
        authorName: "TERRITORY DIVIDEND VAULT",
        title: "💰 Dividen Wilayah Berhasil Diklaim!",
        description: [
          `Dividen penguasaan wilayah **${claimResult.towerName}** telah ditransfer ke brankas klan!`,
          "",
          `• **Hasil Dividen:** \`+${claimResult.dividends.toLocaleString("id-ID")} Star Fragments\``,
          `• **Saldo Brankas Baru:** \`${claimResult.clanVault.toLocaleString("id-ID")} NSF\``,
          `• **Jadwal Klaim Berikutnya:** Besok pukul 00:00 UTC`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const payload = buildErrorContainerV2({
      title: "Aksi Tidak Dikenal",
      description: "Pilihlah aksi yang valid: `status`, `attack`, atau `dividends`.",
      footerText: ui.getFooter("survival"),
    });
    return interaction.reply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
