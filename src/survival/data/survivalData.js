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

const { data } = optimizeCommandBuilder(builder, 0, 38);

module.exports = data;
