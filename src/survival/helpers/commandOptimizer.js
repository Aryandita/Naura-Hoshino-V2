// Optimizer untuk definisi SlashCommandBuilder Naura Wilds.
// Memotong payload JSON agar selalu berada di bawah batas ketat Discord API (8000 bytes)
// tanpa mengurangi fitur pengguna dengan mengalihkan choices besar ke autocomplete dinamis.

// Discord menolak command yang payload JSON-nya >= 8000 bytes. Kita sisakan
// margin karena pre-flight check di CommandHandler memakai angka yang sama.
const PAYLOAD_BUDGET = 7800;

/**
 * Terapkan pemotongan deskripsi + pemindahan choices ke autocomplete pada
 * sebuah snapshot JSON command.
 *
 * @param {object} rawJson - Hasil builder.toJSON() sebelum dioptimasi.
 * @param {number} keepChoicesLimit - Choices di bawah jumlah ini dipertahankan inline.
 * @param {number} maxDescLength - Panjang maksimum deskripsi.
 * @param {number} maxChoiceNameLength - Panjang maksimum nama choice.
 * @returns {{ json: object, choicesRegistry: Map<string, Array> }}
 */
function optimizeJson(rawJson, keepChoicesLimit, maxDescLength, maxChoiceNameLength) {
  const choicesRegistry = new Map();
  const optimizedJson = JSON.parse(JSON.stringify(rawJson));

  function processOptions(options, parentPath = "") {
    for (const opt of options) {
      const currentPath = parentPath ? parentPath + "_" + opt.name : opt.name;

      if (opt.description && opt.description.length > maxDescLength) {
        opt.description = opt.description.slice(0, maxDescLength - 3) + "...";
      }

      if (Array.isArray(opt.choices)) {
        if (opt.choices.length > keepChoicesLimit) {
          // Keep full choice names in choicesRegistry for autocomplete filtering
          choicesRegistry.set(currentPath, opt.choices);
          choicesRegistry.set(opt.name, opt.choices);
          delete opt.choices;
          opt.autocomplete = true;
        } else {
          for (const choice of opt.choices) {
            if (choice.name && choice.name.length > maxChoiceNameLength) {
              choice.name = choice.name.slice(0, maxChoiceNameLength - 3) + "...";
            }
          }
        }
      }

      if (Array.isArray(opt.options) && opt.options.length > 0) {
        processOptions(opt.options, currentPath);
      }
    }
  }

  if (Array.isArray(optimizedJson.options)) {
    processOptions(optimizedJson.options);
  }

  return { json: optimizedJson, choicesRegistry };
}

/**
 * Optimasi sebuah SlashCommandBuilder agar payload-nya muat di Discord.
 *
 * maxDescLength diperlakukan sebagai titik awal, bukan harga mati: bila
 * hasilnya masih melebihi budget, panjang deskripsi diturunkan bertahap
 * sampai muat. Ini mencegah terulangnya kasus di mana penambahan subcommand
 * baru diam-diam mendorong /survival melewati 8000 bytes.
 *
 * @param {object} builder - Instance SlashCommandBuilder.
 * @param {number} [keepChoicesLimit=0] - Choices di bawah jumlah ini tetap inline.
 * @param {number} [maxDescLength=38] - Panjang deskripsi awal yang diinginkan.
 * @param {number} [maxChoiceNameLength=40] - Panjang maksimum nama choice.
 * @returns {{ data: object, choicesRegistry: Map, handleDynamicAutocomplete: Function }}
 */
function optimizeCommandBuilder(builder, keepChoicesLimit = 0, maxDescLength = 38, maxChoiceNameLength = 40) {
  // Snapshot diambil SEKALI di awal. runOptimize menimpa builder.toJSON(),
  // jadi membaca ulang dari builder pada percobaan berikutnya akan
  // menghasilkan JSON yang sudah terpotong dan ladder jadi tidak berguna.
  const rawJson = builder.toJSON();

  const descLadder = [];
  for (const step of [maxDescLength, 80, 60, 50, 40, 30, 24]) {
    if (step > 0 && step <= maxDescLength && !descLadder.includes(step)) {
      descLadder.push(step);
    }
  }
  descLadder.sort((a, b) => b - a);

  let chosen = null;
  for (const descLen of descLadder) {
    chosen = optimizeJson(rawJson, keepChoicesLimit, descLen, maxChoiceNameLength);
    chosen.descLength = descLen;
    chosen.size = JSON.stringify(chosen.json).length;
    if (chosen.size < PAYLOAD_BUDGET) break;
  }

  const { json: optimizedJson, choicesRegistry, size } = chosen;

  if (size >= PAYLOAD_BUDGET) {
    // Semua anak tangga sudah dicoba dan masih kebesaran. Jangan diam-diam
    // lolos ke Discord dan gagal di sana: laporkan supaya terlihat di log boot.
    const { logger } = require("../../managers/logger");
    logger.error(
      `[OPTIMIZER] Payload "/${optimizedJson.name}" masih ${size} bytes setelah deskripsi dipangkas ke ${chosen.descLength} char. ` +
        `Batas Discord 8000 bytes. Pindahkan sebagian subcommand ke command terpisah.`,
    );
  }

  builder.toJSON = () => optimizedJson;
  builder.choicesRegistry = choicesRegistry;

  async function handleDynamicAutocomplete(interaction) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      if (!focusedOption) return interaction.respond([]).catch(() => {});

      const subCommand = interaction.options.getSubcommand(false);
      const query = (focusedOption.value || "").toString().toLowerCase().trim();

      const key = subCommand
        ? subCommand + "_" + focusedOption.name
        : focusedOption.name;
      const choices =
        choicesRegistry.get(key) || choicesRegistry.get(focusedOption.name) || [];

      const filtered = choices
        .filter((c) => {
          if (!query) return true;
          const nameMatch = c.name && c.name.toLowerCase().includes(query);
          const valMatch =
            c.value && c.value.toString().toLowerCase().includes(query);
          return nameMatch || valMatch;
        })
        .slice(0, 25);

      await interaction.respond(filtered).catch(() => {});
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  }

  builder.handleDynamicAutocomplete = handleDynamicAutocomplete;

  return {
    data: builder,
    choicesRegistry,
    handleDynamicAutocomplete,
  };
}

module.exports = {
  optimizeCommandBuilder,
  PAYLOAD_BUDGET,
};
