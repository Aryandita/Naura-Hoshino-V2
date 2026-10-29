const { SlashCommandBuilder } = require("discord.js");
const { addRpgSubcommands } = require("../helpers/survivalGroupsRpg");
const { optimizeCommandBuilder } = require("../helpers/commandOptimizer");

const builder = new SlashCommandBuilder()
  .setName("rpg")
  .setDescription("Sistem Petualangan RPG Naura Wilds");

addRpgSubcommands(builder);

const { data } = optimizeCommandBuilder(builder, 2, 20, 25);

module.exports = data;
