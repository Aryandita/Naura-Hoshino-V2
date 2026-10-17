"use strict";

/**
 * fun.js - Plugin Interaksi Sosial & Hiburan Kasual Naura
 *
 * Memisahkan perintah hiburan santai tanpa taruhan uang dari minigame kompetitif:
 * - /fun affinity (atau /fun ship): Kartu visual Canvas resonansi 2 avatar
 * - /fun tod: Truth or Dare interaktif dengan tombol
 * - /fun 8ball: Ramalan bola 8 dengan kepribadian khas Naura
 * - /fun coinflip: Lempar koin kasual tanpa risiko saldo
 *
 * Mematuhi aturan Components V2 dan bebas karakter em-dash (\u2014).
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const { logger } = require("../../src/managers/logger");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const {
  calculateAffinityScore,
  getAffinityTier,
  renderAffinityCard,
} = require("../../src/canvas/affinityCanvas");

// Database Pertanyaan Truth & Dare Kasual (Human-written, Anti-Slop)
const TRUTH_QUESTIONS = [
  "Apa hal paling memalukan yang pernah kamu lakukan saat masa sekolah tapi sekarang malah bikin ketawa?",
  "Jika kamu punya kesempatan menghapus satu kebiasaan burukmu hari ini, kebiasaan apa yang ingin kamu hilangkan?",
  "Pernahkah kamu pura-pura mengerti obrolan teman padahal sebenarnya kamu tidak paham sama sekali?",
  "Siapa sosok di server ini yang menurutmu punya selera musik atau humor paling unik?",
  "Apa lagu guilty pleasure yang sering kamu dengarkan diam-diam tanpa headset?",
  "Jika kamu terdampar di pulau terpencil selama seminggu, 3 barang apa yang wajib kamu bawa?",
  "Pernahkah kamu mengirim pesan ke orang yang salah lalu pura-pura HP kamu dibajak teman?",
  "Apa impian masa kecilmu yang sampai sekarang masih sering kamu bayangkan?",
];

const DARE_CHALLENGES = [
  "Kirimkan voice note selama 5 detik menyanyikan potongan lirik lagu favoritmu ke channel ini!",
  "Ganti status profil Discord kamu menjadi 'Sedang diawasi oleh Naura' selama 10 menit!",
  "Ceritakan hal paling random yang ada di atas meja kerjamu saat ini dalam satu paragraf!",
  "Ketik kalimat ini tanpa melihat keyboard: 'Naura adalah bot paling seru di server ini'!",
  "Gunakan emoji kucing di setiap akhir pesanmu selama 15 menit ke depan!",
  "Sebutkan 3 hal positif tentang orang yang mengirim pesan tepat sebelum kamu di channel ini!",
  "Pilih salah satu lagu di bot musik dan dengarkan sampai habis tanpa menekan tombol skip!",
];

// Jawaban Bola 8 Khas Naura
const EIGHT_BALL_ANSWERS = [
  // Afirmatif
  { text: "Tentu saja! Langkahmu sudah tepat, jalani saja dengan percaya diri.", type: "positive" },
  { text: "Peluangnya sangat besar. Bintang keberuntungan sedang berpihak padamu!", type: "positive" },
  { text: "Naura yakin jawabannya iya! Jangan ragu lagi yaa.", type: "positive" },
  { text: "Tanda-tanda alam menunjukkan hasil yang memuaskan.", type: "positive" },

  // Netral / Belum Pasti
  { text: "Kabutnya masih agak tebal. Coba tanyakan lagi setelah minum segelas air dingin.", type: "neutral" },
  { text: "Bisa jadi iya, bisa jadi tidak. Semua tergantung bagaimana kamu memulainya.", type: "neutral" },
  { text: "Naura belum bisa memastikan sekarang. Waktu yang akan menjawabnya.", type: "neutral" },
  { text: "Fokus dulu pada apa yang bisa kamu kendalikan hari ini.", type: "neutral" },

  // Negatif / Peringatan Halus
  { text: "Sepertinya untuk saat ini lebih baik jangan terburu-buru mengambil keputusan itu.", type: "negative" },
  { text: "Jawaban Naura: kurang disarankan. Ada alternatif jalan lain yang lebih aman.", type: "negative" },
  { text: "Firasat Naura bilang jangan dulu, coba pertimbangkan kembali risikonya.", type: "negative" },
  { text: "Kemungkinan kecil terjadi. Lebih baik cari peluang yang lain yaa.", type: "negative" },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fun")
    .setDescription("🎉 Perintah hiburan, interaksi sosial, dan seru-seruan tanpa taruhan saldo")
    .addSubcommand((sub) =>
      sub
        .setName("affinity")
        .setDescription("❤️ Ukur kecocokan dan resonansi sosial antara dua pengguna dengan kartu visual Canvas")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("Pengguna yang ingin kamu ukur kecocokannya")
            .setRequired(true),
        )
        .addUserOption((opt) =>
          opt
            .setName("user2")
            .setDescription("Pengguna kedua (opsional, jika ingin mengukur 2 orang lain)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ship")
        .setDescription("💞 Periksa kecocokan pasangan atau sahabat (alias untuk /fun affinity)")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("Pengguna yang ingin kamu jodohkan")
            .setRequired(true),
        )
        .addUserOption((opt) =>
          opt
            .setName("user2")
            .setDescription("Pengguna kedua (opsional)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tod")
        .setDescription("🎲 Mainkan Truth or Dare seru bersama teman server")
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Pilih langsung Truth atau Dare")
            .setRequired(false)
            .addChoices(
              { name: "Truth (Kejujuran)", value: "truth" },
              { name: "Dare (Tantangan)", value: "dare" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("8ball")
        .setDescription("🎱 Tanyakan pertanyaan apa saja pada Bola Ramal Ajaib Naura")
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription("Pertanyaan yang ingin kamu tanyakan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("coinflip")
        .setDescription("🪙 Lempar koin kasual untuk mengambil keputusan santai")
        .addStringOption((opt) =>
          opt
            .setName("tebakan")
            .setDescription("Pilihan tebakanmu (opsional)")
            .setRequired(false)
            .addChoices(
              { name: "Gambar (Garuda / Bintang)", value: "gambar" },
              { name: "Angka (Nominal Koin)", value: "angka" },
            ),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // ─────────────────────────────────────────────────────────────
    // 1. AFFINITY / SHIP (Canvas Visual Dual Avatar)
    // ─────────────────────────────────────────────────────────────
    if (subcommand === "affinity" || subcommand === "ship") {
      await interaction.deferReply();

      const optionUser2 = interaction.options.getUser("user2");
      const targetUser = interaction.options.getUser("target");

      const u1 = optionUser2 ? targetUser : interaction.user;
      const u2 = optionUser2 ? optionUser2 : targetUser;

      if (u1.id === u2.id) {
        const selfPayload = buildContainerV2({
          accentColorHex: "#F59E0B",
          title: "Cinta Diri Sendiri Itu Penting!",
          description:
            `Mengukur kecocokan dengan diri sendiri menghasilkan nilai **100% Sempurna**!\n\n` +
            `Tapi untuk seru-seruan, coba tag teman lain di server yaa.`,
          expression: "happy",
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(selfPayload);
      }

      const score = calculateAffinityScore(u1.id, u2.id);
      const tier = getAffinityTier(score);

      const renderPayload = {
        user1: {
          id: u1.id,
          username: u1.username,
          displayName: u1.displayName || u1.username,
          avatarUrl: u1.displayAvatarURL({ extension: "png", size: 256 }),
        },
        user2: {
          id: u2.id,
          username: u2.username,
          displayName: u2.displayName || u2.username,
          avatarUrl: u2.displayAvatarURL({ extension: "png", size: 256 }),
        },
        score,
      };

      let cardBuffer = null;
      try {
        cardBuffer = await canvasWorkerPool.runTask(
          "renderAffinity",
          renderPayload,
          interaction.user.id,
        );
      } catch (err) {
        logger.warn("[fun:affinity] Canvas worker gagal, fallback inline: " + (err?.message || err));
        cardBuffer = await renderAffinityCard(renderPayload).catch(() => null);
      }

      const files = cardBuffer
        ? [new AttachmentBuilder(cardBuffer, { name: "affinity.png" })]
        : [];

      const payload = buildContainerV2({
        accentColorHex: tier.color,
        authorName: "Naura Social Compatibility Matrix",
        title: `💞 Resonansi Sosial: ${tier.title}`,
        description: [
          `Pengukuran kecocokan antara **${u1.displayName || u1.username}** dan **${u2.displayName || u2.username}**:`,
          ``,
          `📊 **Tingkat Kecocokan:** \`${score}%\` *(Status: ${tier.title})*`,
          `💬 **Komentar Naura:** *"${tier.quote}"*`,
        ].join("\n"),
        bannerAttachmentName: cardBuffer ? "affinity.png" : undefined,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply({ ...payload, files });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. TRUTH OR DARE (TOD)
    // ─────────────────────────────────────────────────────────────
    if (subcommand === "tod") {
      const directType = interaction.options.getString("tipe");

      const getRandomTruth = () =>
        TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];
      const getRandomDare = () =>
        DARE_CHALLENGES[Math.floor(Math.random() * DARE_CHALLENGES.length)];

      if (directType === "truth") {
        const payload = buildContainerV2({
          accentColorHex: "#38BDF8",
          authorName: "Truth or Dare • Naura Fun Party",
          title: "🎲 Tantangan Kejujuran (Truth)",
          description: `**Pertanyaan untuk <@${interaction.user.id}>:**\n\n> *"${getRandomTruth()}"*\n\nJawab dengan jujur di channel ini yaa!`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply(payload);
      }

      if (directType === "dare") {
        const payload = buildContainerV2({
          accentColorHex: "#F43F5E",
          authorName: "Truth or Dare • Naura Fun Party",
          title: "🔥 Tantangan Keberanian (Dare)",
          description: `**Tantangan untuk <@${interaction.user.id}>:**\n\n> *"${getRandomDare()}"*\n\nTunjukkan keberanianmu sekarang!`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply(payload);
      }

      // Tampilkan pilihan interaktif dengan tombol
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fun_tod_truth")
          .setLabel("Pilih Truth (Jujur)")
          .setEmoji("🎲")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("fun_tod_dare")
          .setLabel("Pilih Dare (Tantang)")
          .setEmoji("🔥")
          .setStyle(ButtonStyle.Danger),
      );

      const promptPayload = buildContainerV2({
        accentColorHex: "#A855F7",
        authorName: "Truth or Dare • Naura Fun Party",
        title: "🎭 Giliranmu Memilih!",
        description:
          `Halo <@${interaction.user.id}>! Siap bersenang-senang?\n\n` +
          `Pilih salah satu tombol di bawah ini: apakah kamu ingin mengungkap fakta (**Truth**) atau menerima tantangan unik (**Dare**)?`,
        buttonsRow: row,
        footerText: ui.getFooter("core"),
      });

      const reply = await interaction.reply({
        ...promptPayload,
        fetchReply: true,
      });

      const collector = reply.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 45000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "fun_tod_truth") {
          const res = buildContainerV2({
            accentColorHex: "#38BDF8",
            authorName: "Truth or Dare • Naura Fun Party",
            title: "🎲 Tantangan Kejujuran (Truth)",
            description: `**Pertanyaan untuk <@${interaction.user.id}>:**\n\n> *"${getRandomTruth()}"*\n\nJawab dengan jujur di channel ini yaa!`,
            footerText: ui.getFooter("core"),
          });
          await i.update({ ...res, components: [] });
        } else if (i.customId === "fun_tod_dare") {
          const res = buildContainerV2({
            accentColorHex: "#F43F5E",
            authorName: "Truth or Dare • Naura Fun Party",
            title: "🔥 Tantangan Keberanian (Dare)",
            description: `**Tantangan untuk <@${interaction.user.id}>:**\n\n> *"${getRandomDare()}"*\n\nTunjukkan keberanianmu sekarang!`,
            footerText: ui.getFooter("core"),
          });
          await i.update({ ...res, components: [] });
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "time") {
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("fun_tod_expired")
              .setLabel("Waktu Pemilihan Habis")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          );
          await interaction.editReply({ components: [disabledRow] }).catch(() => {});
        }
      });

      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. MAGIC 8-BALL
    // ─────────────────────────────────────────────────────────────
    if (subcommand === "8ball") {
      const question = interaction.options.getString("pertanyaan");
      const answer =
        EIGHT_BALL_ANSWERS[
          Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)
        ];

      const colorMap = {
        positive: "#10B981",
        neutral: "#F59E0B",
        negative: "#EF4444",
      };

      const payload = buildContainerV2({
        accentColorHex: colorMap[answer.type] || "#8B5CF6",
        authorName: "Bola Ramal Ajaib Naura",
        title: "🎱 Jawaban dari Bola Kosmik",
        description: [
          `❓ **Pertanyaanmu:**`,
          `> *"${question}"*`,
          ``,
          `🔮 **Jawaban Naura:**`,
          `**${answer.text}**`,
        ].join("\n"),
        expression: answer.type === "positive" ? "happy" : "normal",
        footerText: ui.getFooter("core"),
      });

      return interaction.reply(payload);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. COINFLIP (Kasual Tanpa Taruhan Uang)
    // ─────────────────────────────────────────────────────────────
    if (subcommand === "coinflip") {
      const userGuess = interaction.options.getString("tebakan");
      const isHeads = Math.random() < 0.5;
      const resultSide = isHeads ? "gambar" : "angka";
      const resultLabel = isHeads ? "Gambar (Garuda)" : "Angka (Nominal)";
      const coinEmoji = isHeads ? "🦅" : "🪙";

      let guessFeedback = "";
      if (userGuess) {
        const isCorrect = userGuess.toLowerCase() === resultSide;
        guessFeedback = isCorrect
          ? `\n\n🎉 **Tebakanmu Tepat!** Kamu menebak **${resultLabel}** dengan benar.`
          : `\n\n😅 **Hampir Benar!** Kamu menebak **${userGuess === "gambar" ? "Gambar" : "Angka"}**, tapi hasilnya adalah **${resultLabel}**.`;
      }

      const payload = buildContainerV2({
        accentColorHex: "#F59E0B",
        authorName: "Lempar Koin Kasual • Naura",
        title: `${coinEmoji} Koin Telah Mendarat!`,
        description:
          `Koin berputar di udara lalu jatuh menampilkan sisi:\n\n` +
          `# ${coinEmoji} **${resultLabel}**${guessFeedback}\n\n` +
          `- # *Tips: Gunakan lempar koin untuk menentukan giliran game atau keputusan santai bersama teman.*`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply(payload);
    }
  },
};
