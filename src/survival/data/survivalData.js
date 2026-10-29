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

// Roam System - Jelajah area sekitar
builder.addSubcommand((sub) =>
  sub
    .setName("roam")
    .setDescription("🚶 Jelajahi area sekitar di kawasan saat ini")
    .addStringOption((opt) =>
      opt
        .setName("aksi")
        .setDescription("Apa yang ingin dilakukan?")
        .addChoices(
          { name: "🗺️ Jelajah", value: "explore" },
          { name: "💼 Bekerja", value: "work" },
          { name: "🛒 Belanja", value: "shop" },
        )
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("lokasi")
        .setDescription("Lokasi tujuan (untuk work/shop)")
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("item")
        .setDescription("Item yang ingin dibeli (untuk shop)")
        .setRequired(false)
        .setAutocomplete(true),
    ),
);

// World Event Chronicle - Narasi sinematik peristiwa server
builder.addSubcommand((sub) =>
  sub
    .setName("chronicle")
    .setDescription("📜 Generate narasi sinematik dari peristiwa server")
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription("Tipe event")
        .addChoices(
          { name: "⚔️ Boss Defeat", value: "boss_defeat" },
          { name: "🎉 Festival", value: "festival" },
          { name: "💰 Trade Milestone", value: "trade_milestone" },
          { name: "🏰 Dungeon Clear", value: "dungeon_clear" },
          { name: "⚔️ Clan War", value: "clan_war" },
          { name: "📝 Generic", value: "generic" },
        )
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("style")
        .setDescription("Gaya narasi")
        .addChoices(
          { name: "🗡️ Epic", value: "epic" },
          { name: "🌙 Mysterious", value: "mysterious" },
          { name: "☀️ Cheerful", value: "cheerful" },
          { name: "🎭 Dramatic", value: "dramatic" },
          { name: "📜 Poetic", value: "poetic" },
        )
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("location")
        .setDescription("Lokasi peristiwa")
        .setRequired(false),
    ),
);

// Raid Strategy Planner - Analisis komposisi party
builder.addSubcommand((sub) =>
  sub
    .setName("raidplan")
    .setDescription("⚔️ Analisis komposisi party dan strategi raid")
    .addStringOption((opt) =>
      opt
        .setName("boss")
        .setDescription("Nama boss target")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("level")
        .setDescription("Level boss (default: 50)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false),
    ),
);

const { data } = optimizeCommandBuilder(builder, 0, 100);

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
