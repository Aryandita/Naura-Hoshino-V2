// Lokasi: scripts/build_m3_assets.js
// Generator untuk manifest.json, UPLOAD_CHECKLIST.md, dan customEmojis.template.js
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, loadImage } = require("../src/canvas/canvasRuntime");

const ROOT_DIR = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(
  ROOT_DIR,
  "assets/emojis/naura_custom/manifest.json",
);
const CHECKLIST_PATH = path.join(
  ROOT_DIR,
  "assets/emojis/naura_custom/UPLOAD_CHECKLIST.md",
);
const TEMPLATE_PATH = path.join(
  ROOT_DIR,
  "src/config/ui/customEmojis.template.js",
);

const RAW_ITEMS = [
  // A. Core, Sistem & Navigasi (8 items)
  {
    key: "naura_core",
    category: "core",
    description: "Chibi Naura hugging glowing central cyber core orb",
    fallback: "🔮",
  },
  {
    key: "naura_ping",
    category: "core",
    description: "Chibi Naura with antenna headband holding radar stopwatch",
    fallback: "📶",
  },
  {
    key: "naura_uptime",
    category: "core",
    description: "Chibi Naura sitting next to ticking hourglass/cyber-clock",
    fallback: "⏳",
  },
  {
    key: "naura_cpu",
    category: "core",
    description: "Chibi Naura holding glowing cyber processor chip",
    fallback: "💻",
  },
  {
    key: "naura_ram",
    category: "core",
    description: "Chibi Naura carrying memory RAM stick modules",
    fallback: "💾",
  },
  {
    key: "naura_shard",
    category: "core",
    description: "Chibi Naura juggling glowing crystal cluster shards",
    fallback: "💎",
  },
  {
    key: "naura_lang",
    category: "core",
    description: "Chibi Naura holding bilingual ID/EN speech bubbles",
    fallback: "🌐",
  },
  {
    key: "naura_donate",
    category: "core",
    description: "Chibi Naura holding Saweria coffee cup with coin sparkles",
    fallback: "☕",
  },

  // B. AI Companion & Machine Learning (6 items)
  {
    key: "ai_sparkle",
    category: "ai",
    description: "Chibi Naura with neural magic sparkles around fingertips",
    fallback: "✨",
  },
  {
    key: "ai_thinking",
    category: "ai",
    description: "Chibi Naura resting cheek on hand with floating neural net",
    fallback: "🧠",
  },
  {
    key: "ai_vision",
    category: "ai",
    description: "Chibi Naura wearing futuristic holographic scanner visor",
    fallback: "👁️",
  },
  {
    key: "ai_voice",
    category: "ai",
    description: "Chibi Naura speaking into floating cyber studio mic",
    fallback: "🎙️",
  },
  {
    key: "ai_openrouter",
    category: "ai",
    description: "Chibi Naura routing glowing multi-model node switchboard",
    fallback: "🔀",
  },
  {
    key: "ai_vip_fast",
    category: "ai",
    description: "Chibi Naura wearing speed goggles with lightning crown",
    fallback: "⚡",
  },

  // C. Arcade, Minigame & Edukasi (9 items)
  {
    key: "arcade_hub",
    category: "arcade",
    description: "Chibi Naura holding mini retro arcade cabinet with joystick",
    fallback: "🕹️",
  },
  {
    key: "arcade_dice",
    category: "arcade",
    description: "Chibi Naura tossing twin sparkling 3D dice",
    fallback: "🎲",
  },
  {
    key: "arcade_card",
    category: "arcade",
    description: "Chibi Naura fanning playing cards with playful wink",
    fallback: "🃏",
  },
  {
    key: "arcade_duel",
    category: "arcade",
    description: "Chibi Naura in fighting headband with twin wooden swords",
    fallback: "⚔️",
  },
  {
    key: "arcade_target",
    category: "arcade",
    description: "Chibi Naura aiming toy dart at colorful bullseye target",
    fallback: "🎯",
  },
  {
    key: "edu_math",
    category: "arcade",
    description: "Chibi Naura solving arithmetic chalkboard with glasses",
    fallback: "📐",
  },
  {
    key: "edu_map",
    category: "arcade",
    description: "Chibi Naura holding explorer map with mini compass",
    fallback: "🗺️",
  },
  {
    key: "edu_flag",
    category: "arcade",
    description: "Chibi Naura waving country flags energetically",
    fallback: "🚩",
  },
  {
    key: "edu_word",
    category: "arcade",
    description: "Chibi Naura holding syllable block/vocabulary scroll",
    fallback: "📖",
  },

  // D. Ekonomi, Kas & Bisnis (6 items)
  {
    key: "eco_cash",
    category: "economy",
    description: "Chibi Naura tossing shiny golden Naura Coins (NC)",
    fallback: "🪙",
  },
  {
    key: "eco_bank",
    category: "economy",
    description: "Chibi Naura standing proudly in front of bank vault",
    fallback: "🏦",
  },
  {
    key: "eco_shop",
    category: "economy",
    description: "Chibi Naura wearing merchant apron behind market stall",
    fallback: "🏪",
  },
  {
    key: "eco_work",
    category: "economy",
    description: "Chibi Naura in hardhat/uniform holding work clipboard",
    fallback: "💼",
  },
  {
    key: "eco_heist",
    category: "economy",
    description: "Chibi Naura in stealth cat-ear hood tiptoeing with sack",
    fallback: "🕵️",
  },
  {
    key: "eco_trade",
    category: "economy",
    description: "Chibi Naura exchanging wrapped gift/box with both hands",
    fallback: "🤝",
  },

  // E. Moderasi, Admin & Server (7 items)
  {
    key: "mod_shield",
    category: "moderation",
    description: "Chibi Naura holding guardian shield protecting chat",
    fallback: "🛡️",
  },
  {
    key: "mod_warn",
    category: "moderation",
    description: "Chibi Naura holding yellow caution warning sign",
    fallback: "⚠️",
  },
  {
    key: "mod_mute",
    category: "moderation",
    description: "Chibi Naura placing finger on lips with mute padlock",
    fallback: "🔇",
  },
  {
    key: "mod_kick",
    category: "moderation",
    description: "Chibi Naura performing dynamic high martial arts kick",
    fallback: "👢",
  },
  {
    key: "mod_ban",
    category: "moderation",
    description: "Chibi Naura wielding heavy mythical ban hammer",
    fallback: "🔨",
  },
  {
    key: "mod_lock",
    category: "moderation",
    description: "Chibi Naura holding golden key locking channel container",
    fallback: "🔒",
  },
  {
    key: "mod_ticket",
    category: "moderation",
    description: "Chibi Naura holding verified support ticket envelope",
    fallback: "🎫",
  },

  // F. Musik & Media (6 items)
  {
    key: "music_play",
    category: "music",
    description: "Chibi Naura in headphones tapping glowing play triangle",
    fallback: "▶️",
  },
  {
    key: "music_pause",
    category: "music",
    description: "Chibi Naura holding up two hands in calm pause sign",
    fallback: "⏸️",
  },
  {
    key: "music_skip",
    category: "music",
    description: "Chibi Naura swiping forward with speed-arrow trail",
    fallback: "⏭️",
  },
  {
    key: "music_queue",
    category: "music",
    description: "Chibi Naura holding organized playlist sheet with notes",
    fallback: "📑",
  },
  {
    key: "music_bass",
    category: "music",
    description: "Chibi Naura grooving with thumping subwoofer speakers",
    fallback: "🔊",
  },
  {
    key: "music_disc",
    category: "music",
    description: "Chibi Naura as DJ spinning vinyl record on turntable",
    fallback: "💿",
  },

  // G. Utility & Pihak Ketiga (8 items)
  {
    key: "mc_pickaxe",
    category: "utility",
    description: "Chibi Naura holding iconic diamond pickaxe on shoulder",
    fallback: "⛏️",
  },
  {
    key: "mc_steve",
    category: "utility",
    description: "Chibi Naura standing next to blocky Steve companion",
    fallback: "🧱",
  },
  {
    key: "mc_ping",
    category: "utility",
    description: "Chibi Naura inspecting Minecraft server latency radar",
    fallback: "📡",
  },
  {
    key: "weather_sun",
    category: "utility",
    description: "Chibi Naura in sunhat and sunglasses smiling in sunshine",
    fallback: "☀️",
  },
  {
    key: "weather_rain",
    category: "utility",
    description: "Chibi Naura holding umbrella under cyber-rain drops",
    fallback: "🌧️",
  },
  {
    key: "media_anime",
    category: "utility",
    description: "Chibi Naura holding popcorn bowl with sparkling eyes",
    fallback: "🍿",
  },
  {
    key: "media_movie",
    category: "utility",
    description: "Chibi Naura holding cinema director clapperboard",
    fallback: "🎬",
  },
  {
    key: "dl_cobalt",
    category: "utility",
    description: "Chibi Naura holding hyper-speed cobalt download bolt",
    fallback: "⚡",
  },

  // Core Expressions (17 items)
  {
    key: "naura_happy",
    category: "expression",
    description: "Canonical joyful smile, sparkling eyes, warm blush",
    fallback: "😊",
  },
  {
    key: "naura_thinking",
    category: "expression",
    description: "Pondering, fingertip on chin, looking upward",
    fallback: "🤔",
  },
  {
    key: "naura_cry",
    category: "expression",
    description: "Sobbing with flowing anime tears, quivering mouth",
    fallback: "😭",
  },
  {
    key: "naura_angry",
    category: "expression",
    description: "Fierce pout, eyebrows angled down, red temple vein",
    fallback: "😡",
  },
  {
    key: "naura_shy",
    category: "expression",
    description: "Blushing cheeks, index fingers tapping together",
    fallback: "😳",
  },
  {
    key: "naura_sleepy",
    category: "expression",
    description: "Heavy drooping eyelids, tiny yawn, floating Zzz",
    fallback: "😴",
  },
  {
    key: "naura_shocked",
    category: "expression",
    description: "Wide round eyes, mouth agape in O, surprise",
    fallback: "😲",
  },
  {
    key: "naura_eat",
    category: "expression",
    description: "Puffed cheeks munching snack with happy crumbs",
    fallback: "😋",
  },
  {
    key: "naura_cheers",
    category: "expression",
    description: "Triumphant wink, holding celebration toast/sparkler",
    fallback: "🥂",
  },
  {
    key: "naura_chirping",
    category: "expression",
    description: "Singing happily with open mouth, musical notes",
    fallback: "🎵",
  },
  {
    key: "naura_annoy",
    category: "expression",
    description: "Teasing akanbe tongue-out wink with lower eyelid",
    fallback: "😜",
  },
  {
    key: "naura_blow_kiss",
    category: "expression",
    description: "Sweet wink blowing glowing floating heart from palm",
    fallback: "😘",
  },
  {
    key: "naura_akward",
    category: "expression",
    description: "Uneasy slanted smile, nervous sweatdrop on forehead",
    fallback: "😅",
  },
  {
    key: "naura_confused",
    category: "expression",
    description: "Head tilted sideways, question mark, puzzled eyes",
    fallback: "🤨",
  },
  {
    key: "naura_hmph",
    category: "expression",
    description: "Head turned sideways, eyes closed, haughty pout",
    fallback: "😤",
  },
  {
    key: "naura_impressed",
    category: "expression",
    description: "Starry twinkling eyes, hands clasped, awe",
    fallback: "🤩",
  },
  {
    key: "naura_read",
    category: "expression",
    description: "Studying open guide book with circular glasses",
    fallback: "📚",
  },
];

async function isTransparentPng(relPath) {
  const img = await loadImage(fs.readFileSync(path.join(ROOT_DIR, relPath)));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 30) clear++;
  }
  return (clear / (img.width * img.height)) * 100 > 15;
}

async function buildManifest() {
  const categoryCounts = {
    core: 0,
    ai: 0,
    arcade: 0,
    economy: 0,
    moderation: 0,
    music: 0,
    utility: 0,
    expression: 0,
  };

  const emojis = [];
  for (const item of RAW_ITEMS) {
    categoryCounts[item.category]++;

    const staticRel = `assets/emojis/naura_custom/${item.key}.png`;
    const animatedRel = `assets/emojis/naura_custom/${item.key}.gif`;

    const staticFull = path.join(ROOT_DIR, staticRel);
    const animatedFull = path.join(ROOT_DIR, animatedRel);

    if (!fs.existsSync(staticFull)) {
      throw new Error(`Static file missing for ${item.key}: ${staticFull}`);
    }

    const hasAnimated = fs.existsSync(animatedFull);
    const artSourceRel = `assets/Naura_Expression/${item.key}.png`;
    const art128Rel = `assets/emojis/naura_art_128/${item.key}.png`;
    const hasArtSource = fs.existsSync(path.join(ROOT_DIR, artSourceRel));
    const uploadRel = fs.existsSync(path.join(ROOT_DIR, art128Rel))
      ? art128Rel
      : staticRel;

    emojis.push({
      key: item.key,
      discordName: item.key,
      category: item.category,
      staticFile: staticRel.replace(/\\/g, "/"),
      animatedFile: hasAnimated ? animatedRel.replace(/\\/g, "/") : null,
      animated: hasAnimated,
      description: item.description,
      fallback: item.fallback,
      uploadFile: uploadRel.replace(/\\/g, "/"),
      artSourceFile: hasArtSource ? artSourceRel : null,
      uploadTransparent: await isTransparentPng(uploadRel),
      artSourceTransparent: hasArtSource
        ? await isTransparentPng(artSourceRel)
        : null,
    });
  }

  const generatedAt = new Date().toISOString();
  const manifest = {
    version: "1.0.0",
    generatedAt,
    total: emojis.length,
    categories: categoryCounts,
    transparencyAudit: {
      auditedAt: generatedAt,
      method:
        "Audit kanal alpha: piksel alpha < 30 harus mencakup > 15% kanvas; checkerboard terbake dihapus via scripts/make-assets-transparent.js",
      artDerived: emojis.filter((e) => e.artSourceFile).length,
      proceduralOnly: emojis.filter((e) => !e.artSourceFile).length,
      opaqueFiles: emojis
        .filter((e) => !e.uploadTransparent || e.artSourceTransparent === false)
        .map((e) => e.key),
    },
    emojis,
  };

  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
  console.log(`Manifest written to ${MANIFEST_PATH} (${emojis.length} emojis)`);
  return manifest;
}

function buildChecklist(manifest) {
  const categorySections = [
    { key: "core", title: "1. Core, Sistem & Navigasi (8 Emojis)" },
    { key: "ai", title: "2. AI Companion & Machine Learning (6 Emojis)" },
    { key: "arcade", title: "3. Arcade, Minigame & Edukasi (9 Emojis)" },
    { key: "economy", title: "4. Ekonomi, Kas & Bisnis (6 Emojis)" },
    { key: "moderation", title: "5. Moderasi, Admin & Server (7 Emojis)" },
    { key: "music", title: "6. Musik & Media (6 Emojis)" },
    { key: "utility", title: "7. Utility & Pihak Ketiga (8 Emojis)" },
    { key: "expression", title: "8. Core Character Expressions (17 Emojis)" },
  ];

  let lines = [];
  lines.push("# Naura Hoshino V2 - Discord Custom Emoji Upload Checklist");
  lines.push("");
  lines.push(
    "Panduan komprehensif checklist unggah aset custom emoji Naura Hoshino V2 ke Discord untuk server owner dan bot developer.",
  );
  lines.push("");
  lines.push(
    "Total Emojis: 67 items (50 category feature emojis + 17 canonical character expressions).",
  );
  lines.push(
    "Format Aset: 128x128 HD, 1:1 square aspect ratio, RGBA PNG transparan terverifikasi audit alpha (< 256 KB), serta looping animated GIF untuk ekspresi dan aksi utama.",
  );
  lines.push("");
  lines.push("## Status Transparansi Final");
  lines.push("");
  const audit = manifest.transparencyAudit;
  const proceduralKeys = manifest.emojis
    .filter((e) => !e.artSourceFile)
    .map((e) => e.key);
  lines.push(
    `- Audit alpha terakhir: ${audit.auditedAt}. Metode: piksel dengan alpha < 30 harus mencakup > 15% kanvas; latar checkerboard terbake pada art zip dihapus in-place memakai scripts/make-assets-transparent.js.`,
  );
  lines.push(
    `- ${audit.artDerived} key berbasis art: original full-res transparan di assets/Naura_Expression/<key>.png (1264x1264) dan varian upload 128x128 di assets/emojis/naura_art_128/<key>.png, keduanya terverifikasi.`,
  );
  lines.push(
    `- ${audit.proceduralOnly} key tanpa art baru (${proceduralKeys.join(", ")}): static prosedural di assets/emojis/naura_custom/ terverifikasi transparan.`,
  );
  lines.push(
    `- Berkas opaque tersisa: ${audit.opaqueFiles.length ? audit.opaqueFiles.join(", ") : "tidak ada"}.`,
  );
  lines.push(
    "- GIF animasi tetap berasal dari set prosedural; audit pass ini hanya mencakup static PNG.",
  );
  lines.push(
    "- Kolom **Upload 128** menunjuk static siap unggah yang diaudit; kolom **Transparansi** bernilai verified bila audit alpha lolos.",
  );
  lines.push("");
  lines.push("## Panduan Unggah ke Discord");
  lines.push("");
  lines.push("### Opsi A: Discord Application Emojis (Rekomendasi untuk Bot)");
  lines.push(
    "Aset emoji dapat diunggah langsung ke Discord Developer Portal sehingga dapat digunakan oleh bot di semua server tanpa memakan slot server lokal:",
  );
  lines.push(
    "1. Buka [Discord Developer Portal](https://discord.com/developers/applications).",
  );
  lines.push("2. Pilih aplikasi bot Naura Hoshino V2 Anda.");
  lines.push("3. Buka tab **Emojis** di menu navigasi sebelah kiri.");
  lines.push("4. Klik tombol **Upload Emoji**.");
  lines.push(
    "5. Pilih berkas sesuai kolom **Upload 128**: folder `assets/emojis/naura_art_128/` untuk key berbasis art, `assets/emojis/naura_custom/` untuk key prosedural.",
  );
  lines.push(
    "6. Beri nama emoji sesuai kolom **Recommended Discord Name** (contoh: `naura_happy`, `ai_sparkle`).",
  );
  lines.push(
    "7. Simpan dan perhatikan bahwa aplikasi bot memiliki kuota hingga 50 emoji statis dan 50 emoji animasi.",
  );
  lines.push("");
  lines.push("### Opsi B: Discord Server Emojis (Unggah ke Guild/Server)");
  lines.push("Jika diunggah ke server Discord (guild):");
  lines.push(
    "1. Buka server Discord tempat bot beroperasi (pastikan memiliki izin *Manage Emojis and Stickers*).",
  );
  lines.push("2. Buka **Server Settings** -> **Emoji**.");
  lines.push("3. Klik tombol **Upload Emoji**.");
  lines.push(
    "4. Unggah berkas PNG (untuk statis) atau berkas GIF (untuk animasi).",
  );
  lines.push("5. Beri nama emoji persis sesuai **Recommended Discord Name**.");
  lines.push("");
  lines.push("### Cara Mendapatkan Tag Emoji ID Discord");
  lines.push(
    "Setelah emoji berhasil diunggah, dapatkan string ID Discord lengkap:",
  );
  lines.push(
    "1. Di chat Discord, ketik backslash sebelum nama emoji, contoh: `\\:naura_happy:` lalu kirim pesan.",
  );
  lines.push("2. Discord akan menampilkan tag lengkap:");
  lines.push(
    "   - Untuk emoji statis: `<:nama:ID_ANGKA>` (contoh: `<:naura_core:123456789012345678>`)",
  );
  lines.push(
    "   - Untuk emoji animasi: `<a:nama:ID_ANGKA>` (contoh: `<a:naura_happy:123456789012345678>`)",
  );
  lines.push(
    "3. Salin tag tersebut dan masukkan ke dalam file konfigurasi bot (`src/config/ui/customEmojis.template.js` atau `src/config/ui/customEmojis.js`).",
  );
  lines.push("");
  lines.push("## Checklist Inventaris Emoji (67 Items)");
  lines.push("");

  for (const section of categorySections) {
    const items = manifest.emojis.filter((e) => e.category === section.key);
    lines.push(`### ${section.title}`);
    lines.push("");
    lines.push(
      "| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |",
    );
    lines.push(
      "|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|",
    );
    for (const item of items) {
      const formatStr = item.animated
        ? "Animated GIF + Static PNG"
        : "Static PNG";
      const filePath = item.animated ? item.animatedFile : item.staticFile;
      const transparencyStr = item.uploadTransparent
        ? "verified"
        : "UNVERIFIED";
      lines.push(
        `| [ ] | \`${item.key}\` | \`${item.discordName}\` | \`${filePath}\` | \`${item.uploadFile}\` | ${transparencyStr} | ${formatStr} | ${item.fallback} | ${item.description} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Panduan Integrasi Kode Bot");
  lines.push("");
  lines.push("1. Salin berkas template konfigurasi:");
  lines.push("   ```bash");
  lines.push(
    "   cp src/config/ui/customEmojis.template.js src/config/ui/customEmojis.js",
  );
  lines.push("   ```");
  lines.push(
    "2. Buka `src/config/ui/customEmojis.js` dan ganti nilai slot `ID_PLACEHOLDER` dengan tag emoji Discord yang valid:",
  );
  lines.push("   ```javascript");
  lines.push("   // Sebelum konfigurasi:");
  lines.push('   naura_happy: "<a:naura_happy:ID_PLACEHOLDER>",');
  lines.push("   // Setelah konfigurasi:");
  lines.push('   naura_happy: "<a:naura_happy:135792468012345678>",');
  lines.push("   ```");
  lines.push(
    "3. Bot secara otomatis mendukung fallback Unicode (`getCustomEmoji(key)`) selama ID belum diisi atau masih berupa placeholder.",
  );
  lines.push("4. Jalankan pengujian verifikasi:");
  lines.push("   ```bash");
  lines.push("   node --test test/m3ManifestConfig.test.js");
  lines.push("   ```");
  lines.push("");

  const content = lines.join("\n");
  fs.writeFileSync(CHECKLIST_PATH, content, "utf8");
  console.log(`Checklist written to ${CHECKLIST_PATH}`);
}

function buildTemplate(manifest) {
  let lines = [];
  lines.push('"use strict";');
  lines.push("");
  lines.push("// Lokasi: src/config/ui/customEmojis.template.js");
  lines.push(
    "// Template Konfigurasi Custom Emojis Naura Hoshino V2 (67 Custom Emojis)",
  );
  lines.push("// Petunjuk:");
  lines.push(
    "// 1. Unggah berkas emoji di assets/emojis/naura_custom/ ke Discord Server atau Developer Portal.",
  );
  lines.push(
    "// 2. Salin tag emoji yang dihasilkan Discord (<:name:id> atau <a:name:id>) ke slot di bawah ini.",
  );
  lines.push(
    "// 3. Selama ID masih berupa ID_PLACEHOLDER, fungsi getCustomEmoji() akan mengembalikan fallback Unicode.",
  );
  lines.push("");
  lines.push("/**");
  lines.push(" * Pemetaan Custom Emoji Discord (67 item).");
  lines.push(
    " * Ganti ID_PLACEHOLDER dengan ID emoji Discord sebenarnya setelah diunggah.",
  );
  lines.push(" */");
  lines.push("const customEmojis = {");

  const categoryTitles = {
    core: "// A. Core, Sistem & Navigasi (8 items)",
    ai: "// B. AI Companion & Machine Learning (6 items)",
    arcade: "// C. Arcade, Minigame & Edukasi (9 items)",
    economy: "// D. Ekonomi, Kas & Bisnis (6 items)",
    moderation: "// E. Moderasi, Admin & Server (7 items)",
    music: "// F. Musik & Media (6 items)",
    utility: "// G. Utility & Pihak Ketiga (8 items)",
    expression: "// Core Character Expressions (17 items)",
  };

  const categories = [
    "core",
    "ai",
    "arcade",
    "economy",
    "moderation",
    "music",
    "utility",
    "expression",
  ];

  for (const cat of categories) {
    lines.push(`  ${categoryTitles[cat]}`);
    const items = manifest.emojis.filter((e) => e.category === cat);
    for (const item of items) {
      const prefix = item.animated ? "<a:" : "<:";
      lines.push(
        `  ${item.key}: "${prefix}${item.discordName}:ID_PLACEHOLDER>",`,
      );
    }
    lines.push("");
  }
  lines.push("};");
  lines.push("");

  lines.push("/**");
  lines.push(" * Pemetaan Unicode Fallback Emoji (67 item).");
  lines.push(
    " * Digunakan jika custom emoji belum diunggah atau ID masih berupa placeholder.",
  );
  lines.push(" */");
  lines.push("const fallbackEmojis = {");
  for (const cat of categories) {
    lines.push(`  ${categoryTitles[cat]}`);
    const items = manifest.emojis.filter((e) => e.category === cat);
    for (const item of items) {
      lines.push(`  ${item.key}: "${item.fallback}",`);
    }
    lines.push("");
  }
  lines.push("};");
  lines.push("");

  lines.push("/**");
  lines.push(
    " * Memeriksa apakah format string adalah custom emoji Discord yang valid dengan ID numerik.",
  );
  lines.push(" * Regex: ^<(a)?:[a-zA-Z0-9_]{2,32}:(\\d+)>$");
  lines.push(" * @param {string} emojiStr");
  lines.push(" * @returns {boolean}");
  lines.push(" */");
  lines.push("function isCustomEmojiConfigured(emojiStr) {");
  lines.push('  if (typeof emojiStr !== "string") return false;');
  lines.push(
    "  return /^<(a)?:[a-zA-Z0-9_]{2,32}:(\\d+)>$/.test(emojiStr.trim());",
  );
  lines.push("}");
  lines.push("");

  lines.push("/**");
  lines.push(" * Mengambil emoji berdasarkan key:");
  lines.push(
    " * - Mengembalikan custom emoji jika sudah memiliki Discord ID numerik valid.",
  );
  lines.push(
    " * - Mengembalikan fallback Unicode jika masih placeholder atau belum terpasang.",
  );
  lines.push(
    " * - Kompatibel langsung dengan parseEmoji() di src/config/ui/helpers.js.",
  );
  lines.push(" * @param {string} key");
  lines.push(" * @returns {string|null}");
  lines.push(" */");
  lines.push("function getCustomEmoji(key) {");
  lines.push("  if (!key) return null;");
  lines.push("  const custom = customEmojis[key];");
  lines.push("  if (isCustomEmojiConfigured(custom)) {");
  lines.push("    return custom;");
  lines.push("  }");
  lines.push("  if (fallbackEmojis[key]) {");
  lines.push("    return fallbackEmojis[key];");
  lines.push("  }");
  lines.push("  if (isCustomEmojiConfigured(key)) {");
  lines.push("    return key;");
  lines.push("  }");
  lines.push("  return custom || key;");
  lines.push("}");
  lines.push("");

  lines.push("module.exports = {");
  lines.push("  ...customEmojis,");
  lines.push("  customEmojis,");
  lines.push("  fallbackEmojis,");
  lines.push("  getCustomEmoji,");
  lines.push("  isCustomEmojiConfigured,");
  lines.push("};");
  lines.push("");

  const content = lines.join("\n");
  fs.writeFileSync(TEMPLATE_PATH, content, "utf8");
  console.log(`Template written to ${TEMPLATE_PATH}`);
}

(async () => {
  const manifest = await buildManifest();
  buildChecklist(manifest);
  buildTemplate(manifest);
  console.log("All M3 assets successfully generated!");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
