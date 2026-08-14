const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const CanvasAsset = require("../../src/models/CanvasAsset");
const UserCosmetic = require("../../src/models/UserCosmetic");
const UserProfile = require("../../src/models/UserProfile");
const cacheManager = require("../../src/managers/cacheManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cosmetic")
    .setDescription(
      "\u{1F3A8} Manajemen kosmetik profil canvas kamu (Background & Border)",
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("shop")
        .setDescription(
          "\u{1F6D2} Beli aset kosmetik baru untuk menghias profilmu",
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("equip")
        .setDescription("\u{1F457} Pakai aset kosmetik yang sudah kamu miliki"),
    ),

  async execute(interaction) {
    const subCmd = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subCmd === "shop") {
      await handleShop(interaction, userId);
    } else if (subCmd === "equip") {
      await handleEquip(interaction, userId);
    }
  },
};

async function handleShop(interaction, userId) {
  await interaction.deferReply();

  let assets;
  try {
    assets = await CanvasAsset.findAll();
  } catch (err) {
    return interaction.editReply(
      "\u274C Terjadi kesalahan saat memuat data toko.",
    );
  }

  if (!assets || assets.length === 0) {
    return interaction.editReply(
      "\u{1F6D2} Toko kosmetik saat ini sedang kosong. Harap tunggu update selanjutnya!",
    );
  }

  // Ambil data user
  let userProfile = await UserProfile.findOne({ where: { userId } });
  if (!userProfile) userProfile = await UserProfile.create({ userId });

  // Dapatkan ID dari kosmetik yang sudah dimiliki
  const ownedCosmetics = await UserCosmetic.findAll({ where: { userId } });
  const ownedAssetIds = ownedCosmetics.map((uc) => uc.assetId);

  const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
  const shopPayload = buildContainerV2({
    accentColorHex: "#00d9ff",
    title: "🛒 Toko Kosmetik Naura",
    description: `Uang kamu: **${userProfile.economy_wallet} Naura Coins**\n\nGunakan menu di bawah ini untuk memilih aset yang ingin dibeli. Aset yang sudah dibeli akan otomatis masuk ke inventori kamu.`,
    footerText: "Naura Cosmetic System",
  });

  const options = assets.map((asset) => {
    const isOwned = ownedAssetIds.includes(asset.id);
    let label = `[${asset.type.toUpperCase()}] ${asset.name}`;
    let description = `Harga: ${asset.price} NC ${asset.isPremiumOnly ? "| \u{1F451} VIP Only" : ""}`;

    if (isOwned) {
      description = "\u2705 Sudah Dimiliki";
    }

    return {
      label: label,
      description: description,
      value: asset.id.toString(),
      emoji: asset.type === "background" ? "\u{1F5BC}\uFE0F" : "\u{1F3A8}",
    };
  });

  // Batasi ke 25 item (maksimal select menu)
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("cosmetic_shop_select")
      .setPlaceholder("Pilih kosmetik untuk dibeli...")
      .addOptions(options.slice(0, 25)),
  );

  const msg = await interaction.editReply({
    ...shopPayload,
    components: [row],
  });

  const filter = (i) =>
    i.customId === "cosmetic_shop_select" && i.user.id === userId;
  const collector = msg.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    const selectedAssetId = parseInt(i.values[0]);
    const asset = assets.find((a) => a.id === selectedAssetId);

    if (ownedAssetIds.includes(selectedAssetId)) {
      return i.reply({
        content: "❌ Kamu sudah memiliki kosmetik ini.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (asset.isPremiumOnly && !userProfile.isPremium) {
      return i.reply({
        content: "❌ Kosmetik ini eksklusif untuk member VIP.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (userProfile.economy_wallet < asset.price) {
      return i.reply({
        content: `❌ Uangmu tidak cukup. Kosmetik ini harganya **${asset.price} NC**, tapi kamu hanya punya **${userProfile.economy_wallet} NC**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const debitSuccess = await cacheManager.debitUserProfile(
      userId,
      "economy_wallet",
      asset.price,
    );
    if (!debitSuccess) {
      return i.reply({
        content: `❌ Transaksi gagal, uangmu tidak cukup.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await UserCosmetic.create({
      userId: userId,
      assetId: asset.id,
      isActive: false,
    });

    ownedAssetIds.push(asset.id);

    await i.reply({
      content: `✅ Berhasil membeli **${asset.name}** seharga **${asset.price} NC**. Gunakan \`/cosmetic equip\` untuk menggunakannya.`,
      flags: MessageFlags.Ephemeral,
    });
  });
}

async function handleEquip(interaction, userId) {
  await interaction.deferReply();

  const ownedCosmetics = await UserCosmetic.findAll({
    where: { userId },
    include: [{ model: CanvasAsset, as: "asset" }],
  });

  if (!ownedCosmetics || ownedCosmetics.length === 0) {
    return interaction.editReply(
      "👗 Kamu belum memiliki kosmetik apapun. Kunjungi `/cosmetic shop` terlebih dahulu.",
    );
  }

  const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
  const equipPayload = buildContainerV2({
    accentColorHex: "#00d9ff",
    title: "👗 Inventori Kosmetik",
    description:
      "Pilih kosmetik yang ingin kamu gunakan. Jika kamu memilih tipe yang sama dengan yang sedang aktif, kosmetik lama akan digantikan.",
    footerText: "Naura Cosmetic System",
  });

  const options = ownedCosmetics
    .filter((uc) => uc.asset)
    .map((uc) => {
      return {
        label: `[${uc.asset.type.toUpperCase()}] ${uc.asset.name}`,
        description: uc.isActive
          ? "\u2705 Sedang dipakai"
          : "Klik untuk memakai",
        value: uc.id.toString(),
        emoji: uc.isActive ? "\u{1F31F}" : "\u2B1C",
      };
    });

  // Batasi ke 25 item
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("cosmetic_equip_select")
      .setPlaceholder("Pilih kosmetik untuk dipakai...")
      .addOptions(options.slice(0, 25)),
  );

  // Tambahkan tombol untuk unequip semua
  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cosmetic_unequip_all")
      .setLabel("Copot Semua Kosmetik")
      .setStyle(ButtonStyle.Danger),
  );

  const msg = await interaction.editReply({
    ...equipPayload,
    components: [row, btnRow],
  });

  const filter = (i) =>
    ["cosmetic_equip_select", "cosmetic_unequip_all"].includes(i.customId) &&
    i.user.id === userId;
  const collector = msg.createMessageComponentCollector({
    filter,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "cosmetic_unequip_all") {
      await UserCosmetic.update({ isActive: false }, { where: { userId } });
      return i.reply({
        content:
          "\u2705 Semua kosmetik telah dilepas. Profilmu kembali ke desain default.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (i.customId === "cosmetic_equip_select") {
      const selectedUcId = parseInt(i.values[0]);
      const selectedCosmetic = ownedCosmetics.find(
        (uc) => uc.id === selectedUcId,
      );

      if (!selectedCosmetic || !selectedCosmetic.asset) {
        return i.reply({
          content: "\u274C Terjadi kesalahan, aset tidak ditemukan.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Nonaktifkan semua kosmetik lain yang bertipe sama
      const targetType = selectedCosmetic.asset.type;
      const sameTypeCosmetics = ownedCosmetics.filter(
        (uc) =>
          uc.asset && uc.asset.type === targetType && uc.id !== selectedUcId,
      );

      for (const stc of sameTypeCosmetics) {
        if (stc.isActive) {
          stc.isActive = false;
          await stc.save();
        }
      }

      // Aktifkan yang dipilih
      selectedCosmetic.isActive = true;
      await selectedCosmetic.save();

      await i.reply({
        content: `\u2705 Kosmetik **${selectedCosmetic.asset.name}** berhasil dipakai! Cek profilmu dengan \`/profile\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  });

  collector.on("end", () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}
