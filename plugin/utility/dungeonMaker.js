"use strict";

const { SlashCommandBuilder } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildSuccessContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const customDungeonEngine = require("../../src/survival/engines/customDungeonEngine");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dungeon-maker")
    .setDescription(
      "🏰 Bangun, rancang, dan jelajahi Dungeon buatan komunitas server!",
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Rancang dungeon baru dengan deskripsi lore multiline")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama dungeon yang ingin kamu bangun")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("deskripsi")
            .setDescription(
              "Latar belakang cerita, narasi lore, dan jebakan dungeon (multiline)",
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("tema")
            .setDescription("Tema visual dan atmosfer dungeon")
            .addChoices(
              { name: "⚡ Cyber Void", value: "CYBER_VOID" },
              { name: "🔥 Magma Abyss", value: "MAGMA_ABYSS" },
              { name: "❄️ Frost Ruins", value: "FROST_RUINS" },
              { name: "🌌 Astral Sanctuary", value: "ASTRAL_SANCTUARY" },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("tiket")
            .setDescription(
              "Harga tiket masuk penantang dalam koin (default: 100)",
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("browse")
        .setDescription(
          "Lihat daftar dungeon komunitas terpopuler di server ini",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Tantang dungeon komunitas buatan pemain")
        .addStringOption((opt) =>
          opt
            .setName("dungeon_id")
            .setDescription("ID dungeon yang ingin ditantang")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("vault")
        .setDescription("Cairkan royalti hasil tiket dari dungeon buatanmu")
        .addStringOption((opt) =>
          opt
            .setName("dungeon_id")
            .setDescription("ID dungeon yang ingin dicairkan brankasnya")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId || "dm";
    const user = interaction.user;

    await interaction.deferReply();

    // 1. CREATE DUNGEON
    if (sub === "create") {
      const dungeonName = interaction.options.getString("nama");
      const deskripsi = interaction.options.getString("deskripsi");
      const theme = interaction.options.getString("tema") || "CYBER_VOID";
      const entryFee = interaction.options.getInteger("tiket") || 100;

      const defaultRooms = [
        {
          roomNumber: 1,
          type: "MONSTER",
          name: "Glitch Sentinel",
          difficulty: 40,
        },
        {
          roomNumber: 2,
          type: "PUZZLE",
          name: "Cyber Gatekeeper Cipher",
          difficulty: 50,
        },
        {
          roomNumber: 3,
          type: "MONSTER",
          name: "Void Stalker",
          difficulty: 70,
        },
        { roomNumber: 4, type: "PUZZLE", name: "Quantum Maze", difficulty: 85 },
        {
          roomNumber: 5,
          type: "BOSS",
          name: "Cybernetic Chimera",
          difficulty: 110,
        },
      ];

      const res = await customDungeonEngine.createDungeon(user.id, guildId, {
        dungeonName,
        theme,
        lore: deskripsi,
        rooms: defaultRooms,
        entryFee,
        initialVault: 500,
      });

      if (!res.success) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Membangun Dungeon",
            description: `Tidak dapat membuat dungeon: ${res.reason || "Kendala transaksi modal awal."}`,
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      return interaction.editReply(
        buildSuccessContainerV2({
          title: "🏰 Dungeon Berhasil Dibangun!",
          description: [
            `Selamat! Dungeon **${dungeonName}** (\`${res.dungeon.dungeonId}\`) siap ditantang!`,
            `• **Tema:** \`${theme}\` | **Tiket Masuk:** \`${entryFee.toLocaleString("id-ID")}\` Koin`,
            `• **Lore/Narasi:** *${deskripsi.substring(0, 150)}*`,
            ``,
            `💡 *Kamu akan menerima royalti otomatis setiap ada pemain yang menantang dungeon ini!*`,
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    // 2. BROWSE
    if (sub === "browse") {
      const dungeons = await customDungeonEngine.browseDungeons(guildId);
      if (!dungeons || dungeons.length === 0) {
        return interaction.editReply(
          buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFB6C1",
            title: "🏰 Bursa Dungeon Komunitas Masih Kosong",
            description:
              "Belum ada dungeon yang dirancang di server ini. Jadilah arsitek pertama dengan `/dungeon-maker create`!",
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      const list = dungeons
        .map(
          (d, idx) =>
            `**#${idx + 1}. ${d.dungeonName}** (\`${d.dungeonId}\`)\n• Tema: \`${d.theme}\` | Tiket: \`${d.entryFee}\` Koin | Rating: ⭐ \`${d.ratingAverage} / 5.0\``,
        )
        .join("\n\n");

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          title: "🏰 Daftar Dungeon Komunitas Server",
          description: list,
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    // 3. PLAY
    if (sub === "play") {
      const dungeonId = interaction.options.getString("dungeon_id");
      const res = await customDungeonEngine.playDungeon(user.id, dungeonId);

      if (!res.success) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Menantang Dungeon",
            description:
              res.message || `Tidak dapat memainkan dungeon ${dungeonId}.`,
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: res.cleared ? "#10B981" : "#EF4444",
          title: res.cleared
            ? "🏆 Dungeon Berhasil Ditaklukkan!"
            : "💀 Tereliminasi di Dalam Dungeon",
          description: [
            res.cleared
              ? `Hebat! Kamu berhasil menuntaskan seluruh ruangan dan mengklaim hadiah \`${res.reward}\` Koin!`
              : `Kamu tumbang di ruangan ke-${res.roomFailed}. Bersiaplah lebih baik dan coba lagi!`,
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    // 4. VAULT
    if (sub === "vault") {
      const dungeonId = interaction.options.getString("dungeon_id");
      const res = await customDungeonEngine.withdrawVault(user.id, dungeonId);

      if (!res.success) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Mencairkan Brankas",
            description:
              res.message ||
              "Saldo brankas kosong atau kamu bukan pemilik sah dungeon ini.",
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      return interaction.editReply(
        buildSuccessContainerV2({
          title: "💰 Royalti Berhasil Dicairkan!",
          description: `Kamu berhasil mencairkan \`${res.amount.toLocaleString("id-ID")}\` Koin royalti dari dungeonmu!`,
          footerText: ui.getFooter("survival"),
        }),
      );
    }
  },
};
