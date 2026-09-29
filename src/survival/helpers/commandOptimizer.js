// Optimizer untuk definisi SlashCommandBuilder Naura Wilds.
// Memotong payload JSON agar selalu berada di bawah batas ketat Discord API (8000 bytes)
// tanpa mengurangi fitur pengguna dengan mengalihkan choices besar ke autocomplete dinamis.

function optimizeCommandBuilder(builder, keepChoicesLimit = 0, maxDescLength = 38) {
  const choicesRegistry = new Map();

  function processOptions(options, parentPath = "") {
    for (const opt of options) {
      const currentPath = parentPath ? `${parentPath}_${opt.name}` : opt.name;

      // Ringkas deskripsi jika terlalu panjang
      if (opt.description && opt.description.length > maxDescLength) {
        opt.description = `${opt.description.slice(0, maxDescLength - 3)}...`;
      }

      // Jika pilihan statis lebih dari batas, daftarkan ke autocomplete registry
      if (Array.isArray(opt.choices) && opt.choices.length > keepChoicesLimit) {
        choicesRegistry.set(currentPath, opt.choices);
        choicesRegistry.set(opt.name, opt.choices);
        delete opt.choices;
        opt.autocomplete = true;
      }

      if (Array.isArray(opt.options) && opt.options.length > 0) {
        processOptions(opt.options, currentPath);
      }
    }
  }

  const rawJson = builder.toJSON();
  const optimizedJson = JSON.parse(JSON.stringify(rawJson));
  if (Array.isArray(optimizedJson.options)) {
    processOptions(optimizedJson.options);
  }

  // Override toJSON agar mengembalikan payload teroptimasi
  builder.toJSON = () => optimizedJson;
  builder.choicesRegistry = choicesRegistry;

  /**
   * Helper fallback autocomplete untuk menyajikan choices yang dialihkan ke autocomplete
   */
  async function handleDynamicAutocomplete(interaction) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      if (!focusedOption) return interaction.respond([]).catch(() => {});

      const subCommand = interaction.options.getSubcommand(false);
      const query = (focusedOption.value || "").toString().toLowerCase().trim();

      // Cari pilihan berdasarkan hierarki: subCommand_optionName -> optionName
      const key = subCommand
        ? `${subCommand}_${focusedOption.name}`
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
};
