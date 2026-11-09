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
const { ROAM_LOCATIONS } = require("./roamLocations");
const cacheManager = require("../../managers/cacheManager");
const currency = require("../engines/currency");

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
    .setDescription("Menu aksi cepat survival"),
);

// Command Center Hub
builder.addSubcommand((sub) =>
  sub
    .setName("hub")
    .setDescription("Buka Command Center Survival"),
);

// Sistem Quest Harian
builder.addSubcommand((sub) =>
  sub
    .setName("dailyquest")
    .setDescription("Sistem quest harian")
    .addStringOption((opt) =>
      opt
        .setName("aksi")
        .setDescription("Aksi quest")
        .addChoices(
          { name: "Buat", value: "generate" },
          { name: "Lihat", value: "view" },
          { name: "Klaim", value: "claim" },
        )
        .setRequired(false),
    ),
);

// Roam System - Jelajah area sekitar
builder.addSubcommand((sub) =>
  sub
    .setName("roam")
    .setDescription("Jelajahi area sekitar")
    .addStringOption((opt) =>
      opt
        .setName("aksi")
        .setDescription("Aksi jelajah")
        .addChoices(
          { name: "Jelajah", value: "explore" },
          { name: "Bekerja", value: "work" },
          { name: "Belanja", value: "shop" },
        )
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("lokasi")
        .setDescription("Lokasi tujuan")
        .setRequired(false)
        .setAutocomplete(true),
    ),
);

// World Event Chronicle - Narasi sinematik peristiwa server
builder.addSubcommand((sub) =>
  sub
    .setName("chronicle")
    .setDescription("Narasi sinematik server")
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription("Tipe event")
        .addChoices(
          { name: "Boss Defeat", value: "boss_defeat" },
          { name: "Festival", value: "festival" },
          { name: "Milestone", value: "trade_milestone" },
        )
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("style")
        .setDescription("Gaya narasi")
        .addChoices(
          { name: "Epic", value: "epic" },
          { name: "Mysterious", value: "mysterious" },
        )
        .setRequired(false),
    ),
);

// Raid Strategy Planner - Analisis komposisi party
builder.addSubcommand((sub) =>
  sub
    .setName("raidplan")
    .setDescription("Analisis party raid")
    .addStringOption((opt) =>
      opt
        .setName("boss")
        .setDescription("Nama boss target")
        .setRequired(false),
    ),
);

const { data } = optimizeCommandBuilder(builder, 0, 36);

// Autocomplete handler untuk roam command
async function handleRoamAutocomplete(interaction) {
  const focusedOption = interaction.options.getFocused(true);
  const aksi = interaction.options.getString("aksi");
  
  if (!focusedOption || !aksi) return [];

  const userId = interaction.user.id;
  const survival = await cacheManager.getUserSurvival(userId).catch(() => null);
  const rawLocation = survival?.currentLocation || "desa_sukamaju";
  
  // Normalisasi lokasi (sama seperti di roam.js)
  let currentArea = rawLocation.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!ROAM_LOCATIONS[currentArea]) {
    for (const key of Object.keys(ROAM_LOCATIONS)) {
      if (key.includes(currentArea) || currentArea.includes(key.replace(/_/g, ""))) {
        currentArea = key;
        break;
      }
    }
    if (!ROAM_LOCATIONS[currentArea]) currentArea = "desa_sukamaju";
  }
  
  const areaData = ROAM_LOCATIONS[currentArea];

  if (!areaData) return [];

  const query = (focusedOption.value || "").toLowerCase();

  if (focusedOption.name === "lokasi") {
    const locations = Object.values(areaData.locations)
      .filter(loc => {
        if (aksi === "work") return loc.workAvailable;
        if (aksi === "shop") return loc.type === "shop";
        return true;
      })
      .filter(loc => loc.name.toLowerCase().includes(query))
      .slice(0, 25)
      .map(loc => ({ name: `${loc.name} (${loc.type.toUpperCase()})`, value: loc.id }));
    
    return locations;
  }

  if (focusedOption.name === "item" && aksi === "shop") {
    const allItems = [];
    for (const loc of Object.values(areaData.locations)) {
      if (loc.type === "shop" && loc.shopItems) {
        allItems.push(...loc.shopItems);
      }
    }
    
    const filtered = allItems
      .filter(item => item.itemId.toLowerCase().includes(query))
      .slice(0, 25)
      .map(item => ({ 
        name: `${item.itemId} - ${item.price} ${currency.emojiOf(areaData.currency)} ${currency.nameOf(areaData.currency)}`, 
        value: item.itemId 
      }));
    
    return filtered;
  }

  return [];
}

data.handleRoamAutocomplete = handleRoamAutocomplete;

module.exports = data;
