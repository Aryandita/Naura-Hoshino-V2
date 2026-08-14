const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("🖼️ Atur banner kosmetik untuk profil atau Now Playing.")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Pasang banner yang kamu miliki.")
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Tipe banner yang mau diubah (Profile/Music)")
            .setRequired(true)
            .addChoices(
              { name: "Profile", value: "profile" },
              { name: "Music (Now Playing)", value: "music" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("banner_id")
            .setDescription("ID Banner (contoh: banner_sakura) atau ketik 'default' untuk reset.")
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    const type = interaction.options.getString("tipe");
    const bannerId = interaction.options.getString("banner_id").toLowerCase();
    const userId = interaction.user.id;

    const profile = await cacheManager.getUserProfile(userId);
    
    // Fallback if null
    let activeBanners = profile.activeBanners || { profile: null, music: null };

    if (bannerId === "default") {
        activeBanners[type] = null;
    } else {
        // Cek apakah user punya banner ini di inventory
        const inventory = typeof profile.inventory === "string" 
            ? JSON.parse(profile.inventory) 
            : profile.inventory;
        
        const hasBanner = inventory.some(item => item.id === bannerId || item.id === `item_${bannerId}`);
        if (!hasBanner) {
            return interaction.reply({
                content: `${ui.getEmoji("cross") || "❌"} Kamu tidak memiliki banner ini! Dapatkan dari Gacha Banner.`,
                flags: MessageFlags.Ephemeral
            });
        }
        activeBanners[type] = bannerId.replace("item_", "");
    }

    // Update profile
    const mutator = await cacheManager.mutateUserProfileJson(userId);
    if (mutator) {
        mutator.activeBanners = activeBanners;
        await mutator.save();
    }

    const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: "🖼️ Banner Diperbarui",
        description: `Banner untuk **${type.toUpperCase()}** berhasil diubah menjadi: \`${bannerId}\`.`,
        footerText: ui.getFooter("utility")
    });

    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  }
};
