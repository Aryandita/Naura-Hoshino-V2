"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  buildContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const redisManager = require("../../src/managers/redisManager");
const cacheManager = require("../../src/managers/cacheManager");
const aiManager = require("../../src/managers/aiManager");
const geminiClient = require("../../src/ai/geminiClient");
const { logger } = require("../../src/managers/logger");
const { buildGoalGradientBar } = require("../../src/utils/uxHelper");

const GENRE_COLORS = {
  Fantasy: "#9B59B6",
  SciFi: "#00CEC9",
  Horror: "#D63031",
  Romance: "#FD79A8",
  Cyberpunk: "#0984E3",
};

const GENRE_ICONS = {
  Fantasy: "🧙‍♂️",
  SciFi: "🚀",
  Horror: "👻",
  Romance: "💖",
  Cyberpunk: "⚡",
};

const SESSION_TTL = 3 * 60 * 60; // 3 jam sesi aktif

function calculateTierReward(chapter) {
  if (chapter <= 3) {
    return { fragments: 15, xp: 10, coupons: 0 };
  } else if (chapter <= 7) {
    return { fragments: 30, xp: 25, coupons: 0 };
  } else if (chapter <= 9) {
    return { fragments: 50, xp: 50, coupons: 0 };
  } else {
    // Chapter 10 (Finale)
    return { fragments: 75, xp: 100, coupons: 1 };
  }
}

function parseStoryOptions(rawText) {
  let narrative = rawText;
  const options = [];

  const opt1Match = rawText.match(/\[OPSI\s*1\]\s*(.+)/i);
  const opt2Match = rawText.match(/\[OPSI\s*2\]\s*(.+)/i);
  const opt3Match = rawText.match(/\[OPSI\s*3\]\s*(.+)/i);

  if (opt1Match) options.push(opt1Match[1].trim());
  if (opt2Match) options.push(opt2Match[1].trim());
  if (opt3Match) options.push(opt3Match[1].trim());

  // Bersihkan tag opsi dari narasi utama
  narrative = narrative
    .replace(/\[OPSI\s*1\][\s\S]*/i, "")
    .trim();

  // Fallback pilihan jika LLM tidak menyertakan format
  if (options.length === 0) {
    options.push("Maju menyelidiki keadaan di depan");
    options.push("Mempersiapkan senjata dan bertahan");
    options.push("Mencari jalur alternatif lain yang aman");
  }

  return { narrative, options };
}

async function runStoryTurn(interaction, { actionText, reset = false, newGenre = null }) {
  const userId = interaction.user.id;
  const sessionKey = `story:session:${userId}`;

  let session = (await redisManager.getCache(sessionKey)) || null;

  if (reset || !session || newGenre) {
    session = {
      genre: newGenre || session?.genre || "Fantasy",
      chapter: 1,
      totalChapters: 10,
      history: [],
      totalRewards: { fragments: 0, xp: 0, coupons: 0 },
    };
  } else {
    session.chapter = (session.chapter || 1) + 1;
  }

  if (session.chapter > 10) {
    session.chapter = 10;
  }

  const isFinale = session.chapter === 10;
  const currentChapter = session.chapter;
  const genre = session.genre;
  const genreColor = GENRE_COLORS[genre] || "#9B59B6";
  const genreIcon = GENRE_ICONS[genre] || "📜";

  const systemInstruction = `Kamu adalah AI Dungeon Master untuk game RPG interaktif (Genre: ${genre}).
Pemain (${interaction.user.username}) saat ini berada di Babak (Chapter) ${currentChapter} dari 10.
Aksi pemain: "${actionText || "Memulai petualangan baru di dunia " + genre}".

Instruksi:
1. Tuliskan narasi cerita lanjutan 2 paragraf dalam bahasa Indonesia yang sangat imersif, deskriptif, dan seru.
${
  isFinale
    ? "2. Ini adalah BABAK AKHIR (FINALE / CHAPTER 10). Tuliskan penutup petualangan yang epik, heroik, dan memuaskan sebagai konklusi cerita!"
    : "2. Di akhir teks, sertakan TEPAT 3 opsi pilihan tindakan untuk pemain dalam format persis berikut:\n[OPSI 1] <deskripsi aksi 3-7 kata>\n[OPSI 2] <deskripsi aksi 3-7 kata>\n[OPSI 3] <deskripsi aksi 3-7 kata>"
}`;

  let responseRaw = "";
  try {
    const aiClient = aiManager.getGenAI();
    if (aiClient) {
      session.history.push({
        role: "user",
        parts: [{ text: actionText || `Memulai petualangan babak ${currentChapter}` }],
      });

      const gemResult = await aiClient.models.generateContent({
        model: aiManager._defaultModel || "gemini-2.5-flash",
        contents: session.history.slice(-8),
        config: {
          systemInstruction,
          maxOutputTokens: 1200,
          temperature: 0.8,
        },
      });

      responseRaw = gemResult.text || "";
      session.history.push({
        role: "model",
        parts: [{ text: responseRaw }],
      });
    } else {
      // Fallback geminiClient tunggal
      responseRaw = await geminiClient.generate({
        parts: [{ text: `${systemInstruction}\n\nAksi: ${actionText}` }],
      });
    }
  } catch (error) {
    logger.error("[Story AI Error]", error);
    responseRaw =
      "Kabut tebal menyelimuti pandanganmu saat mantra sihir misterius bergejolak. Kamu merasakan kekuatan baru mengalir dalam jiwamu dan bersiap untuk melanjutkan langkah selanjutnya.\n\n[OPSI 1] Melangkah menembus kabut\n[OPSI 2] Berhenti dan menyalakan obor\n[OPSI 3] Membaca mantra pelindung";
  }

  const { narrative, options } = parseStoryOptions(responseRaw);

  // Berikan Hadiah Bertingkat secara Atomik
  const rewards = calculateTierReward(currentChapter);
  await cacheManager.incrementUserSurvival(userId, "starFragments", rewards.fragments);
  await cacheManager.incrementUserSurvival(userId, "survival_xp", rewards.xp);
  if (rewards.coupons > 0) {
    await cacheManager.incrementUserSurvival(userId, "coupons", rewards.coupons);
  }

  session.totalRewards.fragments += rewards.fragments;
  session.totalRewards.xp += rewards.xp;
  session.totalRewards.coupons += rewards.coupons;

  if (isFinale) {
    // Sesi tamat, hapus cache sesi agar bisa mulai petualangan baru
    await redisManager.deleteCache(sessionKey);
  } else {
    // Simpan progres ke Redis
    await redisManager.setCache(sessionKey, session, SESSION_TTL);
  }

  // Progress Bar
  const progress = buildGoalGradientBar({
    current: currentChapter,
    target: 10,
    length: 8,
    fillChar: "▰",
    emptyChar: "▱",
    user: interaction.user,
  });

  // Susun Teks Deskripsi
  let desc = `${genreIcon} **Genre:** ${genre} \u2022 **Progress:** ${progress.bar} (${currentChapter}/10)\n\n`;
  desc += `${narrative}\n\n`;
  desc += `─────────\n`;
  desc += `🎁 **Hadiah Babak Ini:** +${rewards.fragments} Star Fragments ⭐, +${rewards.xp} XP 🌟${
    rewards.coupons > 0 ? `, +${rewards.coupons} Naura Coupon 🎟️` : ""
  }\n`;

  if (isFinale) {
    desc += `\n🏆 **PETUALANGAN SELESAI (FINALE)!**\nTotal hadiah yang kamu kumpulkan: **+${session.totalRewards.fragments} ⭐**, **+${session.totalRewards.xp} XP**, dan **+${session.totalRewards.coupons} 🎟️**!\nGunakan \`/story start\` untuk memulai kisah baru.`;
  } else {
    desc += `\n**Pilihan Langkah Berikutnya:**\n`;
    options.forEach((opt, idx) => {
      desc += `${idx + 1}️⃣ ${opt}\n`;
    });
  }

  // Action Rows Buttons
  const buttons = [];
  if (!isFinale) {
    options.forEach((opt, idx) => {
      const label = `${idx + 1}️⃣ ${opt}`.slice(0, 75);
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`story_choice_${idx + 1}`)
          .setLabel(label)
          .setStyle(idx === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      );
    });
    buttons.push(
      new ButtonBuilder()
        .setCustomId("story_btn_reset")
        .setLabel("🔄 Reset")
        .setStyle(ButtonStyle.Danger),
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("story_btn_restart")
        .setLabel("✨ Mulai Petualangan Baru")
        .setStyle(ButtonStyle.Success),
    );
  }

  const buttonsRow =
    buttons.length > 0 ? new ActionRowBuilder().addComponents(buttons.slice(0, 5)) : null;

  const payload = buildContainerV2({
    accentColorHex: genreColor,
    authorName: `Dungeon Master Naura (${genre})`,
    title: isFinale
      ? `👑 Babak Akhir (10/10): Konklusi Petualangan`
      : `📜 Babak ${currentChapter}/10: Petualangan Berlanjut`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description: desc,
    buttonsRow,
    footerText: isFinale
      ? "Kisah selesai dengan gemilang! \u2022 Naura Dungeon Master"
      : `Babak ${currentChapter}/10 \u2022 Klik tombol di bawah untuk melanjutkan`,
  });

  const responseMessage = interaction.replied || interaction.deferred
    ? await interaction.editReply(payload)
    : await interaction.reply(payload);

  // Setup Button Collector (3 menit interaktivitas)
  const collector = responseMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 180000,
  });

  collector.on("collect", async (btnInteraction) => {
    if (btnInteraction.user.id !== userId) {
      return btnInteraction.reply({
        content: "❌ Ini adalah buku petualangan pemain lain! Gunakan `/story start` untuk membuka ceritamu sendiri.",
        flags: 64, // Ephemeral
      });
    }

    collector.stop("chosen");
    await btnInteraction.deferUpdate();

    if (btnInteraction.customId === "story_btn_reset") {
      await redisManager.deleteCache(sessionKey);
      const resetPayload = buildContainerV2({
        accentColorHex: ui.getColor("info") || "#3498DB",
        title: "🔄 Petualangan Direset",
        description: "Sesi petualanganmu telah dibersihkan. Gunakan `/story start` kapan pun kamu siap bertualang kembali!",
        footerText: ui.getFooter("utility"),
      });
      return btnInteraction.editReply(resetPayload);
    }

    if (btnInteraction.customId === "story_btn_restart") {
      return runStoryTurn(btnInteraction, {
        actionText: "Memulai petualangan baru",
        reset: true,
        newGenre: genre,
      });
    }

    const choiceIdx = parseInt(btnInteraction.customId.replace("story_choice_", ""), 10) - 1;
    const selectedAction = options[choiceIdx] || options[0] || "Melanjutkan perjalanan";

    return runStoryTurn(btnInteraction, {
      actionText: selectedAction,
      reset: false,
    });
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("story")
    .setDescription("🎮 AI Dungeon Master: Petualangan RPG interaktif multi-babak bersama Naura!")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Mulai petualangan baru dengan genre pilihanmu!")
        .addStringOption((opt) =>
          opt
            .setName("genre")
            .setDescription("Pilih genre petualangan")
            .setRequired(true)
            .addChoices(
              { name: "🧙‍♂️ Fantasi Epik (Fantasy)", value: "Fantasy" },
              { name: "🚀 Luar Angkasa & Sci-Fi", value: "SciFi" },
              { name: "👻 Horor & Misteri", value: "Horror" },
              { name: "💖 Romance & Visual Novel", value: "Romance" },
              { name: "⚡ Cyberpunk 2077", value: "Cyberpunk" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("latar")
            .setDescription("Latar belakang atau aksi awal karaktermu (opsional)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("action")
        .setDescription("Lakukan aksi tindakan bebas pada babak ceritamu saat ini.")
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Apa yang ingin karaktermu lakukan?")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Reset sesi petualangan yang sedang berjalan."),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply();

    if (subcommand === "reset") {
      const userId = interaction.user.id;
      await redisManager.deleteCache(`story:session:${userId}`);
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("info") || "#3498DB",
        title: "🔄 Petualangan Direset",
        description: "Catatan petualanganmu telah dibersihkan. Gunakan `/story start` untuk membuka babak baru!",
        footerText: ui.getFooter("utility"),
      });
      return interaction.editReply(payload);
    }

    if (subcommand === "start") {
      const genre = interaction.options.getString("genre");
      const latar = interaction.options.getString("latar");
      return runStoryTurn(interaction, {
        actionText: latar || `Memulai petualangan baru di dunia ${genre}`,
        reset: true,
        newGenre: genre,
      });
    }

    if (subcommand === "action") {
      const aksi = interaction.options.getString("aksi");
      return runStoryTurn(interaction, {
        actionText: aksi,
        reset: false,
      });
    }
  },
  calculateTierReward,
  parseStoryOptions,
};
