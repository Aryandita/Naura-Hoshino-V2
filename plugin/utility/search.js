"use strict";

/**
 * @namespace: plugin/utility/search.js
 * @type: Command
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 2.3.0
 * @description Omni-Search & Interactive Command Palette (/search / /quick)
 */

const { SlashCommandBuilder } = require("discord.js");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const {
  choice,
  safeRespond,
  respondWithFallback,
} = require("../../src/utils/autocompleteHelper");
const { BALANCED_ITEMS_CATALOG } = require("../../src/survival/data/items_catalog");
const { SMELT_RECIPES, WORKBENCH_RECIPES } = require("../../src/survival/data/craftingRecipes");
const { CAFE_RECIPES } = require("../../src/survival/data/cafeRecipes");

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

// Koleksi data statis perintah bot utama
const SYSTEM_COMMANDS = [
  { id: "cmd_survival", name: "/survival", desc: "Akses seluruh petualangan Naura Wilds (profil, eksplorasi, craft, pasar)", category: "Command" },
  { id: "cmd_pass", name: "/survival pass", desc: "Buka Seasonal Battle Pass Naura Wilds (30 Tiers)", category: "Command" },
  { id: "cmd_town", name: "/survival town", desc: "Kunjungi Alun-Alun Kota, sapa warga, dan temui pedagang", category: "Command" },
  { id: "cmd_forge", name: "/survival forge", desc: "Tempa, smelt bahan mentah, dan daur ulang perlengkapan", category: "Command" },
  { id: "cmd_mine", name: "/survival mine", desc: "Menambang ore dan batu mulia di gua kristal", category: "Command" },
  { id: "cmd_fish", name: "/survival fish", desc: "Memancing ikan laut dalam dan kelola vivarium akuarium", category: "Command" },
  { id: "cmd_farm", name: "/survival farm", desc: "Bercocok tanam di greenhouse hidroponik", category: "Command" },
  { id: "cmd_dungeon", name: "/survival dungeon", desc: "Masuk ke Infinite Dungeon dan hadapi monster", category: "Command" },
  { id: "cmd_abyss", name: "/survival activity abyss", desc: "Ekspedisi co-op Celestial Raid The Neo-Abyss", category: "Command" },
  { id: "cmd_music", name: "/music", desc: "Putar lagu berkualitas tinggi bertenaga Lavalink Cluster", category: "Command" },
  { id: "cmd_dj", name: "/music dj", desc: "Aktifkan AI Smart DJ Companion untuk memandu siaran musik", category: "Command" },
  { id: "cmd_astral", name: "/astral", desc: "Ramalan Omikuji tarot harian dan cuaca astral server", category: "Command" },
  { id: "cmd_predict", name: "/predict", desc: "Bursa prediksi server pari-mutuel bertenaga odds dinamis", category: "Command" },
  { id: "cmd_court", name: "/court", desc: "Sidang peradilan AI Virtual Tribunal Court", category: "Command" },
  { id: "cmd_history", name: "/history", desc: "Lihat 10 riwayat transaksi dan aktivitas akun terakhir", category: "Command" },
  { id: "cmd_profile", name: "/profile", desc: "Kartu identitas petualang dan status reputasi", category: "Command" },
  { id: "cmd_faq", name: "/faq", desc: "Tanya panduan dan aturan server kepada asisten AI", category: "Command" },
];

// Koleksi data raid & dungeon
const DUNGEON_TIERS = [
  { id: "abyss_floor_1", name: "The Neo-Abyss Floor 1-5 (Shadow Outskirts)", desc: "Rekomendasi Level 10+. Monster bayangan dengan drop material kristal.", category: "Dungeon" },
  { id: "abyss_floor_2", name: "The Neo-Abyss Floor 6-15 (Neon Underworld)", desc: "Rekomendasi Level 25+. Musuh cyborg terkorupsi dengan drop relic.", category: "Dungeon" },
  { id: "abyss_floor_3", name: "The Neo-Abyss Floor 16-30 (Celestial Core)", desc: "Rekomendasi Level 40+. Bos Astral Warden dengan drop mythic.", category: "Dungeon" },
  { id: "dungeon_infinite", name: "Infinite Dungeon Klasik", desc: "Gua tambang bawah tanah tanpa batas. Membutuhkan Dungeon Pass.", category: "Dungeon" },
];

// Koleksi FAQ Umum
const SYSTEM_FAQS = [
  { id: "faq_nsf", name: "FAQ: Apa itu NSF (Star Fragments)?", desc: "Mata uang survival utama untuk belanja di toko desa, makan di kafe, dan upgrade alat.", category: "FAQ" },
  { id: "faq_nc", name: "FAQ: Apa itu NC (Naura Coins)?", desc: "Mata uang ekonomi server global untuk transfer antar pemain dan pasar saham.", category: "FAQ" },
  { id: "faq_coupons", name: "FAQ: Bagaimana cara mendapat Naura Coupon?", desc: "Kupon didapat dari reward Battle Pass, dungeon boss, dan event server khusus.", category: "FAQ" },
  { id: "faq_durability", name: "FAQ: Mengapa senjataku rusak?", desc: "Setiap alat memiliki durabilitas. Jika 0, perbaiki di /survival forge atau daur ulang.", category: "FAQ" },
];

function buildSearchDatabase() {
  const list = [];

  // 1. Items (150 item)
  for (const it of BALANCED_ITEMS_CATALOG) {
    list.push({
      type: "item",
      id: it.id,
      name: `${it.emoji || "📦"} ${it.name} [Tier ${it.tier}]`,
      cleanName: it.name,
      category: "Item",
      detail: it,
    });
  }

  // 2. Smelt Recipes
  for (const rec of (SMELT_RECIPES || [])) {
    list.push({
      type: "recipe_smelt",
      id: `smelt_${rec.id}`,
      name: `🔥 Peleburan: ${rec.id.replace(/_/g, " ").toUpperCase()}`,
      cleanName: rec.id,
      category: "Resep",
      detail: rec,
    });
  }

  // 3. Workbench Recipes
  for (const rec of (WORKBENCH_RECIPES || [])) {
    list.push({
      type: "recipe_craft",
      id: `craft_${rec.id}`,
      name: `🔨 Tempa: ${rec.id.replace(/_/g, " ").toUpperCase()}`,
      cleanName: rec.id,
      category: "Resep",
      detail: rec,
    });
  }

  // 4. Cafe Recipes
  for (const rec of (CAFE_RECIPES || [])) {
    list.push({
      type: "recipe_cafe",
      id: `cafe_${rec.id}`,
      name: `${rec.emoji || "☕"} Kafe: ${rec.name}`,
      cleanName: rec.name,
      category: "Resep",
      detail: rec,
    });
  }

  // 5. Commands
  for (const cmd of SYSTEM_COMMANDS) {
    list.push({
      type: "command",
      id: cmd.id,
      name: `⚡ ${cmd.name} (${cmd.desc.substring(0, 40)}...)`,
      cleanName: cmd.name,
      category: "Command",
      detail: cmd,
    });
  }

  // 6. Dungeons
  for (const dg of DUNGEON_TIERS) {
    list.push({
      type: "dungeon",
      id: dg.id,
      name: `🏰 ${dg.name}`,
      cleanName: dg.name,
      category: "Dungeon",
      detail: dg,
    });
  }

  // 7. FAQs
  for (const fq of SYSTEM_FAQS) {
    list.push({
      type: "faq",
      id: fq.id,
      name: `❓ ${fq.name}`,
      cleanName: fq.name,
      category: "FAQ",
      detail: fq,
    });
  }

  return list;
}

const SEARCH_DATABASE = buildSearchDatabase();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("🔎 Omni-Search: Cari item, resep, dungeon, command, dan panduan Naura")
    .addStringOption((opt) =>
      opt
        .setName("kueri")
        .setDescription("Kata kunci yang ingin dicari (misal: pedang, kopi, abyss, /mine, coupon)")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("kategori")
        .setDescription("Saring hasil pencarian berdasarkan kategori")
        .setRequired(false)
        .addChoices(
          { name: "Semua Kategori", value: "all" },
          { name: "📦 Item RPG", value: "Item" },
          { name: "🔨 Resep Tempa & Kafe", value: "Resep" },
          { name: "🏰 Dungeon & Raid", value: "Dungeon" },
          { name: "⚡ Perintah Bot", value: "Command" },
          { name: "❓ FAQ Panduan", value: "FAQ" },
        ),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const query = (focused.value || "").trim().toLowerCase();

    if (!query) {
      // Rekomendasi awal yang bermanfaat
      const defaults = [
        choice("📦 Item: Pedang Besi Tempa", "iron_sword"),
        choice("☕ Kafe: Sakura Blossom Latte", "sakura_latte"),
        choice("⚡ Command: /survival pass (Battle Pass)", "cmd_pass"),
        choice("🏰 Dungeon: The Neo-Abyss Raid", "abyss_floor_1"),
        choice("❓ FAQ: Apa itu NSF (Star Fragments)?", "faq_nsf"),
      ];
      return safeRespond(interaction, defaults);
    }

    const filtered = SEARCH_DATABASE.filter((entry) => {
      const matchName = entry.name.toLowerCase().includes(query);
      const matchClean = entry.cleanName.toLowerCase().includes(query);
      const matchId = entry.id.toLowerCase().includes(query);
      return matchName || matchClean || matchId;
    });

    if (filtered.length === 0) {
      return respondWithFallback(interaction, query);
    }

    const choices = filtered.slice(0, 25).map((item) => choice(item.name, item.id));
    return safeRespond(interaction, choices);
  },

  async execute(interaction) {
    await interaction.deferReply();
    const queryInput = interaction.options.getString("kueri", true);
    const categoryFilter = interaction.options.getString("kategori") || "all";

    // Cari kecocokan exact ID terlebih dahulu
    let exactMatch = SEARCH_DATABASE.find((item) => item.id === queryInput);

    // Jika tidak cocok via ID, cari fuzzy matching terbaik
    if (!exactMatch) {
      const q = queryInput.toLowerCase();
      exactMatch = SEARCH_DATABASE.find((item) => {
        const passCategory = categoryFilter === "all" || item.category === categoryFilter;
        const passQuery = item.cleanName.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
        return passCategory && passQuery;
      });
    }

    if (!exactMatch) {
      // Tampilkan saran hasil terdekat
      const nearMatches = SEARCH_DATABASE.filter((item) => {
        const passCategory = categoryFilter === "all" || item.category === categoryFilter;
        return passCategory && item.name.toLowerCase().includes(queryInput.toLowerCase().slice(0, 3));
      }).slice(0, 5);

      const suggestionText = nearMatches.length > 0
        ? nearMatches.map((m) => `• **${m.name}**`).join("\n")
        : "Tidak ada saran pencarian yang cocok.";

      const notFoundPayload = buildErrorContainerV2({
        title: "Pencarian Tidak Ditemukan",
        errorMessage: [
          `Tidak ditemukan hasil yang cocok untuk kueri: **"${queryInput}"**`,
          categoryFilter !== "all" ? `(Filter Kategori: \`${categoryFilter}\`)` : "",
          "",
          "**Saran Pencarian Serupa:**",
          suggestionText,
          "",
          "-# 💡 *Gunakan fitur autocomplete saat mengetik untuk memilih opsi resmi.*",
        ].filter(Boolean).join("\n"),
      });

      return interaction.editReply({ ...notFoundPayload, embeds: [] });
    }

    // Render detail sesuai tipe entitas
    const { type, detail } = exactMatch;
    let title = `${e("search", "🔎")} Informasi Hasil Pencarian`;
    let descLines = [];
    const fields = [];
    let accentColor = ui.getColor("info") || "#38BDF8";

    if (type === "item") {
      accentColor = detail.tierColor || ui.getColor("primary");
      title = `${detail.emoji || "📦"} ${detail.name} (Tier ${detail.tier})`;
      descLines = [
        `*${detail.description || "Tidak ada deskripsi item."}*`,
        "",
        `• **Kategori:** \`${detail.category.toUpperCase()}\``,
        `• **Kelangkaan:** **${detail.rarity}**`,
        `• **Harga Beli:** \`${detail.price.toLocaleString("id-ID")} NSF\``,
        `• **Harga Jual:** \`${detail.sellPrice.toLocaleString("id-ID")} NSF\``,
      ];

      if (detail.attributes && Object.keys(detail.attributes).length > 0) {
        const attrLines = Object.entries(detail.attributes).map(([k, v]) => `• \`${k}\`: **+${v}**`);
        fields.push({
          name: "Atribut & Bonus Status",
          value: attrLines.join("\n"),
          inline: true,
        });
      }

      fields.push({
        name: "Petunjuk Penggunaan",
        value: "Beli di `/survival shop` atau tempa di `/survival forge`.",
        inline: false,
      });
    } else if (type.startsWith("recipe_")) {
      accentColor = "#F59E0B";
      title = `📜 ${exactMatch.cleanName.toUpperCase()}`;

      if (type === "recipe_cafe") {
        descLines = [
          `*${detail.description}*`,
          "",
          `• **Tipe Menu:** \`${detail.category}\``,
          `• **Harga Jual:** \`${detail.price} NSF\``,
          `• **Minimal Level Kafe:** Level \`${detail.requiredLevel}\``,
        ];

        const ingLines = (detail.ingredients || []).map((i) => `• ${i.name || i.id} x${i.amount}`);
        fields.push({
          name: "Bahan Resep Kafe",
          value: ingLines.join("\n") || "Tidak ada bahan.",
          inline: true,
        });

        if (detail.buff) {
          fields.push({
            name: "Efek Konsumsi (Buff)",
            value: `✨ **${detail.buff.description}** (Durasi: ${detail.buff.durationHours} Jam)`,
            inline: true,
          });
        }
      } else {
        const inputLines = (detail.input || []).map((i) => `• \`${i.id}\` x${i.amount}`).join("\n");
        const outText = detail.output ? `• \`${detail.output.id}\` x${detail.output.amount}` : "1x Item";

        descLines = [
          `Resep resmi fasilitas pandai besi & perakitan Alun-Alun Kota.`,
          "",
          `• **Biaya Upah:** \`${detail.fee} ${detail.currency || "NSF"}\``,
          `• **Syarat Level:** Level \`${detail.reqLevel || 1}\``,
        ];

        fields.push(
          { name: "Bahan Mentah Dibutuhkan", value: inputLines, inline: true },
          { name: "Hasil Olahan Jadi", value: outText, inline: true },
        );
      }
    } else if (type === "command") {
      accentColor = ui.getColor("primary") || "#8B5CF6";
      title = `⚡ Perintah Bot: ${detail.name}`;
      descLines = [
        `**Fungsi:** ${detail.desc}`,
        "",
        `• **Kategori:** \`${detail.category}\``,
        `• **Sintaks:** \`${detail.name}\``,
        "",
        "-# 💡 *Ketik tanda slash (\`/\`) lalu nama perintah untuk melihat parameter lengkapnya.*",
      ];
    } else if (type === "dungeon") {
      accentColor = "#EF4444";
      title = `🏰 ${detail.name}`;
      descLines = [
        `**Zona Petualangan:** ${detail.desc}`,
        "",
        `• **Kategori:** \`${detail.category}\``,
        `• **Cara Akses:** Gunakan perintah \`/survival dungeon\` atau \`/survival activity abyss\`.`,
      ];
    } else if (type === "faq") {
      accentColor = "#10B981";
      title = `❓ ${detail.name}`;
      descLines = [
        `**Penjelasan:** ${detail.desc}`,
        "",
        `• **Kategori Panduan:** \`${detail.category}\``,
        "",
        "-# 💡 *Ingin bertanya pertanyaan spesifik? Gunakan \`/faq ask pertanyaan:...\`*",
      ];
    }

    const payload = buildContainerV2({
      accentColorHex: accentColor,
      authorName: "Naura Omni-Search System",
      title,
      description: descLines.join("\n"),
      fields,
      footerText: ui.getFooter("utility"),
    });

    return interaction.editReply({ ...payload, embeds: [] });
  },
};
