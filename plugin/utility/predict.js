"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionsBitField,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const predictionEngine = require("../../src/services/predictionEngine");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("predict")
    .setDescription(
      "Pasar taruhan prediksi sosial Pari-Mutuel (Hoshino Predictions)",
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Buat pasar prediksi baru di server")
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription("Pertanyaan atau peristiwa yang diprediksi")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("opsi_a")
            .setDescription("Label Opsi 1 (Default: Ya)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("opsi_b")
            .setDescription("Label Opsi 2 (Default: Tidak)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("kategori")
            .setDescription("Kategori prediksi")
            .setRequired(false)
            .addChoices(
              { name: "Komunitas", value: "COMMUNITY" },
              { name: "Esports & Turnamen", value: "ESPORTS" },
              { name: "Survival MMORPG", value: "SURVIVAL" },
              { name: "Anime & Pop Culture", value: "ANIME" },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("durasi_menit")
            .setDescription("Durasi pasar dibuka dalam menit (Default: 60)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("maks_bet")
            .setDescription("Batas maksimal taruhan per user (Default: 10.000)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat status detail dan rasio odds pasar prediksi")
        .addStringOption((opt) =>
          opt
            .setName("market_id")
            .setDescription("ID Pasar Prediksi (misal: pred_...)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("bet")
        .setDescription("Pasang taruhan Star Fragments pada salah satu opsi")
        .addStringOption((opt) =>
          opt
            .setName("market_id")
            .setDescription("ID Pasar Prediksi")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("opsi")
            .setDescription("Pilihan opsi taruhan")
            .setRequired(true)
            .addChoices(
              { name: "1 - Opsi A", value: 1 },
              { name: "2 - Opsi B", value: 2 },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("jumlah")
            .setDescription("Jumlah Star Fragments yang ditaruhkan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription(
          "Lihat daftar pasar prediksi yang sedang aktif di server ini",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lock")
        .setDescription(
          "Kunci pasar agar tidak ada yang bisa bertaruh lagi (Admin / Creator)",
        )
        .addStringOption((opt) =>
          opt
            .setName("market_id")
            .setDescription("ID Pasar Prediksi")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("resolve")
        .setDescription(
          "Selesaikan pasar dan bagikan payout kemenangan (Admin / Creator)",
        )
        .addStringOption((opt) =>
          opt
            .setName("market_id")
            .setDescription("ID Pasar Prediksi")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("pemenang")
            .setDescription("Opsi yang dinyatakan menang")
            .setRequired(true)
            .addChoices(
              { name: "1 - Opsi A Menang", value: 1 },
              { name: "2 - Opsi B Menang", value: 2 },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("cancel")
        .setDescription(
          "Batalkan pasar dan kembalikan 100% koin ke peserta (Admin / Creator)",
        )
        .addStringOption((opt) =>
          opt
            .setName("market_id")
            .setDescription("ID Pasar Prediksi")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const isMod =
      interaction.member?.permissions?.has(
        PermissionsBitField.Flags.ManageGuild,
      ) ||
      interaction.member?.permissions?.has(
        PermissionsBitField.Flags.Administrator,
      );

    // ==========================================
    // 1. CREATE MARKET
    // ==========================================
    if (subcommand === "create") {
      const title = interaction.options.getString("judul");
      const optA = interaction.options.getString("opsi_a") || "Ya";
      const optB = interaction.options.getString("opsi_b") || "Tidak";
      const category = interaction.options.getString("kategori") || "COMMUNITY";
      const durationMinutes =
        interaction.options.getInteger("durasi_menit") || 60;
      const maxBetPerUser = interaction.options.getInteger("maks_bet") || 10000;

      const market = await predictionEngine.createMarket({
        guildId,
        creatorId: userId,
        title,
        category,
        optionsList: [optA, optB],
        durationMinutes,
        maxBetPerUser,
      });

      const expTs = Math.floor(new Date(market.lockTime).getTime() / 1000);
      const eChart = ui.getEmoji("chart") || "📈";
      const eSparkles = ui.getEmoji("sparkles") || "✨";
      const eTag = ui.getEmoji("desc") || "🏷️";
      const eFolder = ui.getEmoji("shop_box") || "📂";
      const eClock = ui.getEmoji("clock") || "⏳";
      const eCoin = ui.getEmoji("coin") || "💰";
      const eStar = ui.getEmoji("star") || "⭐";

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: `${eChart} Hoshino Prediction Market`,
        title: `${eSparkles} Pasar Prediksi Baru Dibuat!`,
        description: [
          `**"${market.title}"**`,
          ``,
          `${eTag} **ID Pasar:** \`${market.marketId}\``,
          `${eFolder} **Kategori:** \`${market.category}\``,
          `${eClock} **Batas Pasang Taruhan:** <t:${expTs}:R>`,
          `${eCoin} **Batas Maksimal Bet:** \`${market.maxBetPerUser.toLocaleString("id-ID")}\` ${eStar}`,
          ``,
          `1️⃣ **[Opsi 1]** ${optA}`,
          `2️⃣ **[Opsi 2]** ${optB}`,
          ``,
          `*Gunakan \`/predict bet market_id:${market.marketId} opsi:1 jumlah:500\` untuk bertaruh!*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }

    // ==========================================
    // 2. VIEW MARKET
    // ==========================================
    if (subcommand === "view") {
      const marketId = interaction.options.getString("market_id");
      const market = await predictionEngine.getMarket(marketId);

      if (!market) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Pasar Tidak Ditemukan",
            description: `Pasar dengan ID \`${marketId}\` tidak ditemukan atau telah dihapus.`,
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const totalPool = Number(market.totalPool) || 0;
      const options = Array.isArray(market.options)
        ? market.options
        : typeof market.options === "string"
          ? JSON.parse(market.options)
          : [];

      const expTs = Math.floor(new Date(market.lockTime).getTime() / 1000);

      const optionLines = options.map((opt) => {
        const pool = Number(opt.pool || opt.totalBet) || 0;
        const odds =
          pool > 0 && totalPool > 0 ? (totalPool / pool).toFixed(2) : "1.00";
        const percent =
          totalPool > 0 ? ((pool / totalPool) * 100).toFixed(1) : "0.0";
        return `**[${opt.id}] ${opt.label}**\n↳ Pool: \`${pool.toLocaleString("id-ID")}\` ${ui.getEmoji("star") || "⭐"} (${percent}%) | Multiplier: \`${odds}x\``;
      });

      const eGreen = ui.getEmoji("greenping") || "🟢";
      const eLock = ui.getEmoji("lock") || "🔒";
      const eTrophy = ui.getEmoji("trophy") || "🏆";
      const eCross = ui.getEmoji("error") || "❌";
      const eChart = ui.getEmoji("chart") || "📈";
      const eTag = ui.getEmoji("desc") || "🏷️";
      const eCoin = ui.getEmoji("coin") || "💰";
      const eStar = ui.getEmoji("star") || "⭐";
      const eClock = ui.getEmoji("clock") || "⏳";
      const eSparkle = ui.getEmoji("sparkle") || "💡";

      const statusBadge =
        market.status === "OPEN"
          ? `${eGreen} TERBUKA`
          : market.status === "LOCKED"
            ? `${eLock} TERKUNCI`
            : market.status === "RESOLVED"
              ? `${eTrophy} SELESAI`
              : `${eCross} DIBATALKAN`;

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pred_bet_${market.marketId}_1`)
          .setLabel(`1️⃣ Bet ${options[0]?.label || "Opsi A"}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(market.status !== "OPEN"),
        new ButtonBuilder()
          .setCustomId(`pred_bet_${market.marketId}_2`)
          .setLabel(`2️⃣ Bet ${options[1]?.label || "Opsi B"}`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(market.status !== "OPEN"),
      );

      const payload = buildContainerV2({
        accentColorHex:
          market.status === "OPEN"
            ? "#38BDF8"
            : market.status === "RESOLVED"
              ? "#22C55E"
              : "#EF4444",
        authorName: `${eChart} Prediction Market [${statusBadge}]`,
        title: market.title,
        description: [
          `${eTag} **ID Pasar:** \`${market.marketId}\``,
          `${eCoin} **Total Hadiah Pool:** \`${totalPool.toLocaleString("id-ID")}\` Star Fragments ${eStar}`,
          `${eClock} **Batas Waktu:** <t:${expTs}:R>`,
          ``,
          ...optionLines,
          ``,
          `-# ${eSparkle} *Sistem Pari-Mutuel: Odds berubah dinamis. Fee 5% dialirkan ke World Boss Bounty Vault.*`,
        ].join("\n"),
        buttonsRow,
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }

    // ==========================================
    // 3. BET ON MARKET
    // ==========================================
    if (subcommand === "bet") {
      const marketId = interaction.options.getString("market_id");
      const optionId = interaction.options.getInteger("opsi");
      const amount = interaction.options.getInteger("jumlah");

      const result = await predictionEngine.placeBet({
        marketId,
        guildId,
        userId,
        username,
        optionId,
        amount,
      });

      if (!result.success) {
        let msg = "Terjadi kesalahan saat memasang taruhan.";
        if (result.reason === "MARKET_NOT_FOUND")
          msg = "Pasar prediksi tidak ditemukan.";
        if (result.reason === "MARKET_LOCKED_OR_CLOSED")
          msg = "Pasar prediksi telah dikunci atau selesai.";
        if (result.reason === "INSUFFICIENT_FUNDS")
          msg = `Saldo Star Fragments kamu tidak mencukupi! (Saldumu: \`${(result.balance || 0).toLocaleString("id-ID")}\` ⭐)`;
        if (result.reason === "EXCEEDS_MAX_BET")
          msg = `Jumlah taruhan melebihi batas maksimal (\`${result.maxBet.toLocaleString("id-ID")}\` ⭐).`;

        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Taruhan Gagal",
            description: msg,
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const eTicket = ui.getEmoji("ticket") || "🎟️";
      const eTag = ui.getEmoji("desc") || "🏷️";
      const ePoll = ui.getEmoji("poll") || "📊";
      const eChart = ui.getEmoji("chart") || "📈";
      const eStar = ui.getEmoji("star") || "⭐";

      const payload = buildContainerV2({
        accentColorHex: "#22C55E",
        title: `${eTicket} Taruhan Berhasil Dipasang!`,
        description: [
          `Kamu bertaruh **${result.amount.toLocaleString("id-ID")}** Star Fragments ${eStar} untuk opsi **"${result.chosenOption}"**.`,
          ``,
          `${eTag} **ID Tiket:** \`${result.betId}\``,
          `${ePoll} **Total Pool Saat Ini:** \`${result.totalPool.toLocaleString("id-ID")}\` ${eStar}`,
          `${eChart} **Pool Opsi Pilihanmu:** \`${result.optionPool.toLocaleString("id-ID")}\` ${eStar}`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    // ==========================================
    // 4. LIST MARKETS
    // ==========================================
    if (subcommand === "list") {
      const markets = await predictionEngine.getActiveMarkets(guildId);

      if (markets.length === 0) {
        return interaction.reply({
          ...buildContainerV2({
            accentColorHex: "#38BDF8",
            title: "Daftar Pasar Prediksi",
            description:
              "Belum ada pasar prediksi yang sedang aktif di server ini.\nBuat pasar baru dengan `/predict create`!",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const eGreen = ui.getEmoji("greenping") || "🟢";
      const eLock = ui.getEmoji("lock") || "🔒";
      const eStar = ui.getEmoji("star") || "⭐";
      const eChart = ui.getEmoji("chart") || "📈";
      const eTrophy = ui.getEmoji("trophy") || "🏆";

      const lines = markets.map((m) => {
        const expTs = Math.floor(new Date(m.lockTime).getTime() / 1000);
        const statusBadge = m.status === "OPEN" ? eGreen : eLock;
        return `${statusBadge} **${m.title}** (\`${m.marketId}\`)\n↳ Pool: \`${Number(m.totalPool || 0).toLocaleString("id-ID")}\` ${eStar} | Berakhir <t:${expTs}:R>`;
      });

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: `${eChart} Hoshino Predictions`,
        title: `${eTrophy} Pasar Prediksi Aktif di Server`,
        description: lines.join("\n\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }

    // ==========================================
    // 5. LOCK MARKET (Mod / Creator)
    // ==========================================
    if (subcommand === "lock") {
      const marketId = interaction.options.getString("market_id");
      const market = await predictionEngine.getMarket(marketId);

      if (!market) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Tidak Ditemukan",
            description: "Pasar prediksi tidak ditemukan.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (market.creatorId !== userId && !isMod) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Akses Ditolak",
            description:
              "Hanya pembuat pasar atau moderator server yang dapat mengunci pasar ini.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const res = await predictionEngine.lockMarket(marketId, guildId);
      if (!res.success) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Gagal Mengunci",
            description: "Pasar sudah dalam status terkunci atau selesai.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const eLock = ui.getEmoji("lock") || "🔒";

      const payload = buildContainerV2({
        accentColorHex: "#F59E0B",
        title: `${eLock} Pasar Prediksi Dikunci!`,
        description: `Pasar \`${marketId}\` telah dikunci. Tidak ada taruhan baru yang dapat dimasukkan. Menunggu penyelesaian hasil!`,
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }

    // ==========================================
    // 6. RESOLVE MARKET (Mod / Creator)
    // ==========================================
    if (subcommand === "resolve") {
      const marketId = interaction.options.getString("market_id");
      const winningOptionId = interaction.options.getInteger("pemenang");
      const market = await predictionEngine.getMarket(marketId);

      if (!market) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Tidak Ditemukan",
            description: "Pasar prediksi tidak ditemukan.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (market.creatorId !== userId && !isMod) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Akses Ditolak",
            description:
              "Hanya pembuat pasar atau moderator server yang dapat menyelesaikan pasar ini.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const res = await predictionEngine.resolveMarket(
        marketId,
        guildId,
        winningOptionId,
      );
      if (!res.success) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Gagal Menyelesaikan",
            description:
              "Pasar sudah diselesaikan sebelumnya atau data opsi tidak valid.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const eTrophy = ui.getEmoji("trophy") || "🏆";
      const eCrown = ui.getEmoji("badge_master") || "👑";
      const eCoin = ui.getEmoji("coin") || "💰";
      const eBank = ui.getEmoji("bank") || "🏛️";
      const eStar = ui.getEmoji("star") || "⭐";

      const payload = buildContainerV2({
        accentColorHex: "#22C55E",
        title: `${eTrophy} Pasar Prediksi Selesai & Hadiah Dibagikan!`,
        description: [
          `**"${market.title}"**`,
          ``,
          `${eCrown} **Opsi Pemenang:** \`${res.winningOption}\``,
          `${eCoin} **Total Payout Dibagikan:** \`${res.payoutDistributed.toLocaleString("id-ID")}\` ${eStar}`,
          `${eBank} **Fee ke World Boss Vault (5%):** \`${res.houseFee.toLocaleString("id-ID")}\` ${eStar}`,
          ``,
          `*Seluruh saldo Star Fragments pemenang telah ditransfer secara otomatis!*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }

    // ==========================================
    // 7. CANCEL MARKET (Mod / Creator)
    // ==========================================
    if (subcommand === "cancel") {
      const marketId = interaction.options.getString("market_id");
      const market = await predictionEngine.getMarket(marketId);

      if (!market) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Tidak Ditemukan",
            description: "Pasar prediksi tidak ditemukan.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (market.creatorId !== userId && !isMod) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Akses Ditolak",
            description:
              "Hanya pembuat pasar atau moderator server yang dapat membatalkan pasar ini.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const res = await predictionEngine.cancelMarket(marketId, guildId);
      if (!res.success) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Gagal Membatalkan",
            description: "Pasar sudah dalam status selesai atau dibatalkan.",
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const eCross = ui.getEmoji("error") || "❌";

      const payload = buildContainerV2({
        accentColorHex: "#EF4444",
        title: `${eCross} Pasar Prediksi Dibatalkan & Refund Selesai`,
        description: `Pasar \`${marketId}\` telah dibatalkan. Total \`${res.refundedBetsCount}\` tiket taruhan telah di-refund 100% ke seluruh peserta.`,
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply(payload);
    }
  },
};
