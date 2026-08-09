const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const CanvasAsset = require('../../src/models/CanvasAsset');
const env = require('../../src/config/env');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admincosmetic')
        .setDescription('🔧 [OWNER] Manajemen penambahan/penghapusan aset kosmetik')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Tambah aset baru ke database toko')
                .addStringOption(option => option.setName('name').setDescription('Nama aset').setRequired(true))
                .addStringOption(option => option.setName('type').setDescription('Tipe aset (background/border)').setRequired(true).addChoices(
                    { name: 'Background', value: 'background' },
                    { name: 'Border', value: 'border' }
                ))
                .addStringOption(option => option.setName('url').setDescription('URL gambar aset (jpg/png)').setRequired(true))
                .addIntegerOption(option => option.setName('price').setDescription('Harga di toko (Naura Coins)').setRequired(true))
                .addBooleanOption(option => option.setName('premium_only').setDescription('Apakah eksklusif VIP?').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Hapus aset dari database berdasarkan ID')
                .addIntegerOption(option => option.setName('id').setDescription('ID dari CanvasAsset').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lihat semua ID aset yang terdaftar')
        ),

    async execute(interaction) {
        // Cek apakah user adalah owner
        const ownerIds = env.OWNER_IDS ? env.OWNER_IDS.split(',') : [];
        if (!ownerIds.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ Anda tidak memiliki izin. Hanya Bot Owner yang dapat menggunakan command ini.', flags: MessageFlags.Ephemeral });
        }

        const subCmd = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (subCmd === 'add') {
            const name = interaction.options.getString('name');
            const type = interaction.options.getString('type');
            const url = interaction.options.getString('url');
            const price = interaction.options.getInteger('price');
            const premiumOnly = interaction.options.getBoolean('premium_only') || false;

            try {
                const newAsset = await CanvasAsset.create({
                    name: name,
                    type: type,
                    url: url,
                    price: price,
                    isPremiumOnly: premiumOnly
                });

                return interaction.editReply(`✅ Berhasil menambahkan aset!\n**ID:** \`${newAsset.id}\`\n**Nama:** ${newAsset.name}\n**Tipe:** ${newAsset.type}\n**Harga:** ${newAsset.price} NC`);
            } catch (err) {
                logger.error('[ADMIN] Gagal menambah aset:', err);
                return interaction.editReply('❌ Terjadi kesalahan saat menyimpan ke database.');
            }
        }
        else if (subCmd === 'delete') {
            const id = interaction.options.getInteger('id');
            try {
                const deleted = await CanvasAsset.destroy({ where: { id: id } });
                if (deleted) {
                    return interaction.editReply(`✅ Aset dengan ID \`${id}\` berhasil dihapus.`);
                } else {
                    return interaction.editReply(`❌ Aset dengan ID \`${id}\` tidak ditemukan.`);
                }
            } catch (err) {
                return interaction.editReply('❌ Terjadi kesalahan database saat menghapus aset.');
            }
        }
        else if (subCmd === 'list') {
            try {
                const assets = await CanvasAsset.findAll();
                if (assets.length === 0) return interaction.editReply('Kosong.');

                let text = assets.map(a => `**[${a.id}]** ${a.name} (${a.type}) - ${a.price} NC ${a.isPremiumOnly ? '[VIP]' : ''}`).join('\n');

                // Jika text terlalu panjang, potong
                if (text.length > 2000) text = text.substring(0, 1990) + '...';

                return interaction.editReply(text);
            } catch (err) {
                return interaction.editReply('❌ Terjadi kesalahan saat mengambil daftar.');
            }
        }
    }
};
