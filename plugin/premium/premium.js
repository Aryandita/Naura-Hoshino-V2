const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../../src/config/ui");
const cacheManager = require("../../src/managers/cacheManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const {
  tierByKey,
  buildBenefitsDescription,
} = require("../../src/premium/premiumTiers");
const store = require("../../src/premium/premiumStore");
const { sendPremiumDM } = require("../../src/premium/premiumNotify");
const { runInfo } = require("../../src/premium/premiumInfoView");
const { runCheck } = require("../../src/premium/premiumCheckView");
const { runRedeem } = require("../../src/premium/premiumRedeem");
const { runBuy } = require("../../src/premium/premiumBuyView");
const { runClaim } = require("../../src/premium/premiumClaimView");
const { checkPremiumStatus } = require("../../src/premium/premiumHelper");
const admin = require("../../src/premium/premiumAdmin");

const OWNER_ONLY = ["add", "remove", "generate_voucher", "stats"];

async function runBenefits(interaction) {
  const badge = ui.getEmoji("premium_badge") || "\ud83d\udc8e";

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("premium_vip"),
      authorName: "Naura V.I.P Subscription",
      title: `${badge} Perbandingan fitur V.I.P`,
      expression: "info",
      description: buildBenefitsDescription(),
      footerText: ui.getFooter("premium"),
    }),
  );
}

async function runPersona(interaction) {
  const userId = interaction.user.id;
  const isPremium = await checkPremiumStatus(userId);
  if (!isPremium) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: "Akses Khusus V.I.P",
        description: "Fitur kustomisasi persona AI Naura hanya tersedia untuk pelanggan V.I.P aktif.",
        footerText: ui.getFooter("premium"),
      }),
    );
  }
  const personaChoice = interaction.options.getString("gaya") || "default";
  await cacheManager.updateUserProfile(userId, { customPersona: personaChoice });

  const personaNames = {
    default: "Ceria & Hangat (Default Naura)",
    tsundere: "Tsundere (Jutek tapi Perhatian)",
    kuudere: "Kuudere (Tenang & Analitis)",
    gamer: "Gamer Cyberpunk (Penuh Istilah RPG)",
    butler: "Formal Butler (Sopan & Penuh Hormat)",
  };

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "NAURA AI LIVING COMPANION",
    title: "✨ Persona AI Berhasil Diperbarui",
    expression: "happy",
    description: [
      `Gaya kepribadian Naura saat mengobrol denganmu telah diubah ke:`,
      "",
      `> 🎭 **Persona Baru:** \`${personaNames[personaChoice] || personaChoice}\``,
      "",
      "Naura akan langsung menyesuaikan nada bicara dan responnya saat kamu mengobrol dengannya!",
    ].join("\n"),
    footerText: ui.getFooter("premium"),
  });
  return interaction.editReply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Lihat dan kelola langganan V.I.P Naura.")
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Lihat paket dan harga langganan V.I.P."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("benefits")
        .setDescription("Bandingkan fitur lengkap semua tier V.I.P."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Cek status premium kamu atau orang lain.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Pilih user (opsional)"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("redeem")
        .setDescription("Tukar kode voucher V.I.P.")
        .addStringOption((opt) =>
          opt
            .setName("kode")
            .setDescription("Masukkan kode voucher")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("buy")
        .setDescription("Beli atau perpanjang V.I.P menggunakan Naura Coupon.")
        .addStringOption((opt) =>
          opt
            .setName("paket")
            .setDescription("Pilihan paket langganan V.I.P")
            .setRequired(true)
            .addChoices(
              { name: "🌱 Starter (7 Hari) - 5 Kupon", value: "starter" },
              { name: "🌟 Supporter (30 Hari) - 15 Kupon", value: "supporter" },
              { name: "💫 Friends (90 Hari) - 35 Kupon", value: "friends" },
              { name: "👑 V.I.P (365 Hari) - 80 Kupon", value: "vip" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("claim")
        .setDescription("Klaim hadiah dividen harian eksklusif anggota V.I.P (Kupon, NSF, Mystery Box)."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("persona")
        .setDescription("Atur gaya kepribadian obrolan AI Naura saat mengobrol denganmu.")
        .addStringOption((opt) =>
          opt
            .setName("gaya")
            .setDescription("Pilihan gaya karakter")
            .setRequired(true)
            .addChoices(
              { name: "🌸 Ceria & Hangat (Default Naura)", value: "default" },
              { name: "😤 Tsundere (Jutek tapi Perhatian)", value: "tsundere" },
              { name: "❄️ Kuudere (Tenang & Analitis)", value: "kuudere" },
              { name: "🎮 Gamer Cyberpunk (Penuh Istilah RPG)", value: "gamer" },
              { name: "🎩 Formal Butler (Sopan & Penuh Hormat)", value: "butler" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("[OWNER] Berikan status premium ke user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Pilih user").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("days")
            .setDescription("Lama premium dalam hari")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("[OWNER] Cabut status premium user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Pilih user").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("generate_voucher")
        .setDescription("[OWNER] Buat kode redeem V.I.P baru.")
        .addIntegerOption((opt) =>
          opt
            .setName("days")
            .setDescription("Lama V.I.P dalam hari")
            .setRequired(true)
            .setMinValue(1),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("expired_in_days")
            .setDescription("Batas waktu klaim kode (opsional)")
            .setRequired(false)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("[OWNER] Lihat statistik subscriber aktif."),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand(false) || "info";

    if (
      OWNER_ONLY.includes(subcommand) &&
      !store.isOwner(interaction.user.id)
    ) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Akses ditolak",
          description: "Maaf ya, sub-perintah ini hanya untuk owner Naura.",
          footerText: ui.getFooter("premium"),
        }),
      );
    }

    const targetUser = interaction.options.getUser("user") || interaction.user;
    const profile = await cacheManager.getUserProfile(targetUser.id);

    switch (subcommand) {
      case "benefits":
        return runBenefits(interaction);
      case "check":
        return runCheck(interaction, targetUser, profile);
      case "redeem": {
        const selfProfile = await cacheManager.getUserProfile(
          interaction.user.id,
        );
        return runRedeem(interaction, selfProfile);
      }
      case "buy":
        return runBuy(interaction);
      case "claim":
        return runClaim(interaction);
      case "persona":
        return runPersona(interaction);
      case "add":
        return admin.runAdd(interaction, targetUser, profile);
      case "remove":
        return admin.runRemove(interaction, targetUser, profile);
      case "generate_voucher":
        return admin.runGenerateVoucher(interaction);
      case "stats":
        return admin.runStats(interaction);
      default: {
        const selfProfile = await cacheManager.getUserProfile(
          interaction.user.id,
        );
        return runInfo(interaction, selfProfile);
      }
    }
  },

  async executePrefix(message, args, client) {
    if (!args || args.length === 0) {
      return message.reply(
        "Pakai `/premium` untuk tampilan interaktifnya, atau `n!premium check` kalau mau cepat.",
      );
    }

    const subcommand = args[0].toLowerCase();

    if (
      ["add", "remove"].includes(subcommand) &&
      !store.isOwner(message.author.id)
    ) {
      return message.reply(
        buildErrorContainerV2({
          title: "Akses ditolak",
          description: "Maaf ya, hanya owner yang boleh mengatur status V.I.P.",
          footerText: ui.getFooter("premium"),
        }),
      );
    }

    const mentioned = message.mentions.users.first();
    const targetUser = mentioned || message.author;
    const profile = await cacheManager.getUserProfile(targetUser.id);

    if (subcommand === "add") {
      if (!mentioned)
        return message.reply(
          "Formatnya begini ya: `n!premium add @user <hari>`",
        );

      // Argumen numerik dicari eksplisit. Memakai argumen terakhir bisa
      // salah membaca mention yang ditulis di belakang.
      const numeric = args
        .slice(1)
        .map((a) => parseInt(a, 10))
        .find((n) => Number.isInteger(n) && n > 0);
      if (!numeric)
        return message.reply(
          "Jumlah harinya belum valid. Coba tulis angka lebih dari nol ya.",
        );

      const newExpiry = await store.grantPremium(
        targetUser.id,
        profile,
        numeric,
      );
      const tierInfo = tierByKey(ui.getPremiumTier(numeric, true));

      const delivered = await sendPremiumDM(
        client,
        targetUser.id,
        "activated",
        {
          username: targetUser.username,
          tierName: tierInfo ? tierInfo.name : "V.I.P",
          premiumUntil: newExpiry,
        },
      );

      return message.reply(
        buildContainerV2({
          accentColorHex: ui.getColor("premium_vip"),
          title: "Status V.I.P diberikan",
          expression: "success",
          description: [
            `**${targetUser.username}** resmi menjadi premium sampai <t:${Math.floor(newExpiry.getTime() / 1000)}:R>.`,
            delivered
              ? ""
              : "-# DM ke user gagal terkirim, tolong kabari manual ya.",
          ]
            .filter(Boolean)
            .join("\n"),
          footerText: ui.getFooter("premium"),
        }),
      );
    }

    if (subcommand === "remove") {
      await store.revokePremium(targetUser.id, profile);
      const delivered = await sendPremiumDM(client, targetUser.id, "removed", {
        username: targetUser.username,
      });

      return message.reply(
        buildContainerV2({
          accentColorHex: ui.getColor("error"),
          title: "Status premium dicabut",
          expression: "info",
          description: [
            `Status premium **${targetUser.username}** sudah dicabut.`,
            delivered
              ? ""
              : "-# DM ke user gagal terkirim, tolong kabari manual ya.",
          ]
            .filter(Boolean)
            .join("\n"),
          footerText: ui.getFooter("premium"),
        }),
      );
    }

    if (subcommand === "check") {
      await store.expireIfNeeded(targetUser.id, profile);

      const isPremium = store.isActive(profile);
      const daysLeft = isPremium ? store.daysLeft(profile) : 0;
      const tierKey = ui.getPremiumTier(daysLeft, isPremium);
      const tierInfo = tierByKey(tierKey);
      const expiry = store.expiryOf(profile);

      if (isPremium && expiry) {
        return message.reply(
          buildContainerV2({
            accentColorHex: ui.getPremiumColor(tierKey),
            title:
              `${ui.getPremiumEmoji(tierKey) || ""} Status V.I.P aktif`.trim(),
            expression: "celebrate",
            description: `**${targetUser.username}** adalah member **${tierInfo ? tierInfo.name : "Premium"}**, berakhir <t:${Math.floor(expiry.getTime() / 1000)}:R>.`,
            footerText: ui.getFooter(`premium_${tierKey}`),
          }),
        );
      }

      return message.reply(
        buildContainerV2({
          accentColorHex: ui.getColor("primary"),
          title: "Status V.I.P belum aktif",
          expression: "info",
          description: `**${targetUser.username}** masih member reguler. Ketik \`/premium info\` kalau mau berlangganan ya.`,
          footerText: ui.getFooter("premium"),
        }),
      );
    }

    return message.reply(
      "Sub-perintah itu belum Naura kenali. Coba `check`, atau pakai `/premium` untuk tampilan penuhnya.",
    );
  },

  // Diekspor agar modul lain bisa memakai penjaga flag yang sama.
  ephemeralFlag: MessageFlags.Ephemeral,
};
