const { SlashCommandBuilder } = require("discord.js");
const {
  addGatherGroup,
  addEconomyGroup,
} = require("../helpers/survivalGroups");
const {
  addLifeGroup,
  addProfileGroup,
} = require("../helpers/survivalGroupsLife");
const { optimizeCommandBuilder } = require("../helpers/commandOptimizer");

const builder = new SlashCommandBuilder()
  .setName("survival")
  .setDescription("Masuk ke dalam dunia Naura RPG - Survival Edition");

addGatherGroup(builder);
addEconomyGroup(builder);
addLifeGroup(builder);
addProfileGroup(builder);

// Subcommand cepat untuk menu aksi cepat (Quick Action Menu)
builder.addSubcommand((sub) =>
  sub
    .setName("quick")
    .setDescription("🚀 Menu aksi cepat survival via select menu"),
);

// Sistem Quest Harian
builder.addSubcommand((sub) =>
  sub
    .setName("dailyquest")
    .setDescription("📜 Sistem quest harian Naura Wilds")
    .addStringOption((opt) =>
      opt
        .setName("aksi")
        .setDescription("Pilih aksi quest harian")
        .addChoices(
          { name: "📜 Buat Quest", value: "generate" },
          { name: "👁️ Lihat Quest", value: "view" },
          { name: "🎁 Klaim Hadiah", value: "claim" },
          { name: "🗓️ Papan Mingguan", value: "weekly" },
        )
        .setRequired(false),
    ),
);

const { data } = optimizeCommandBuilder(builder, 0, 38);

module.exports = data;
