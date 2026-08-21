const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const cacheManager = require("../../src/managers/cacheManager");
const guildSettingsService = require("../../src/managers/guildSettingsService");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roleshop")
    .setDescription("🛍️ Kelola atau beli Role Berbayar di server.")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Admin: Daftarkan role untuk disewa.")
        .addRoleOption(opt => opt.setName("role").setDescription("Role yang disewakan").setRequired(true))
        .addIntegerOption(opt => opt.setName("durasi_hari").setDescription("Durasi sewa (hari)").setRequired(true))
        .addIntegerOption(opt => opt.setName("harga_nsf").setDescription("Harga dalam Naura Star Fragment (NSF)").setRequired(true))
        .addIntegerOption(opt => opt.setName("harga_coin").setDescription("Harga dalam Naura Coin").setRequired(true))
        .addIntegerOption(opt => opt.setName("harga_coupon").setDescription("Harga dalam Naura Coupon").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("buy")
        .setDescription("User: Beli/Sewa role yang tersedia.")
    ),
    
  async execute(interaction) {
    const subCmd = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subCmd === "setup") {
        if (!interaction.member.permissions.has("ManageRoles")) {
            return interaction.reply({ content: "Kamu butuh izin Manage Roles!", flags: MessageFlags.Ephemeral });
        }
        
        const role = interaction.options.getRole("role");
        const days = interaction.options.getInteger("durasi_hari");
        const hNsf = interaction.options.getInteger("harga_nsf");
        const hCoin = interaction.options.getInteger("harga_coin");
        const hCoupon = interaction.options.getInteger("harga_coupon");

        const guildData = await cacheManager.getGuildSettings(guildId);
        const settings = guildData.settings || {};
        if (!settings.roleShop) settings.roleShop = [];

        // Hapus jika role sudah ada
        settings.roleShop = settings.roleShop.filter(r => r.roleId !== role.id);
        
        settings.roleShop.push({
            roleId: role.id,
            days,
            prices: { nsf: hNsf, coin: hCoin, coupon: hCoupon }
        });

        await guildSettingsService.updateGuildSetting(guildId, "roleShop", settings.roleShop);
        return interaction.reply({ content: `✅ Role ${role.name} berhasil ditambahkan ke Role Shop!`, flags: MessageFlags.Ephemeral });
    }

    if (subCmd === "buy") {
        const guildData = await cacheManager.getGuildSettings(guildId);
        const shop = (guildData?.settings?.roleShop) || [];

        if (shop.length === 0) {
            return interaction.reply({ content: "Belum ada role yang disewakan di server ini.", flags: MessageFlags.Ephemeral });
        }

        // Tampilkan daftar role yang bisa dibeli
        let desc = "Pilih Role yang ingin kamu sewa:\n\n";
        
        const row = new ActionRowBuilder();
        
        const eNsf = ui.getEmoji("nsf") || "💠";
        const eCoin = ui.getEmoji("coin") || "🪙";
        const eCoupon = ui.getEmoji("coupon") || "🎫";
        const eShop = ui.getEmoji("shop_cart") || "🛍️";

        shop.forEach((item, index) => {
            const roleObj = interaction.guild.roles.cache.get(item.roleId);
            const roleName = roleObj ? roleObj.name : "Role Terhapus";
            
            desc += `**${index + 1}. ${roleName}** (${item.days} Hari)\n`;
            desc += `> ${eNsf} ${item.prices.nsf} NSF\n`;
            desc += `> ${eCoin} ${item.prices.coin} Coin\n`;
            desc += `> ${eCoupon} ${item.prices.coupon} Coupon\n\n`;

            if (row.components.length < 5) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`roleshop_buy_${item.roleId}`)
                        .setLabel(`Sewa ${roleName.substring(0, 20)}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }
        });

        const payload = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFB6C1",
            title: `${eShop} Role Shop`,
            description: desc,
            buttonsRow: row,
            footerText: ui.getFooter("core")
        });

        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  }
};
