// Lokasi: src/commands/survival/survival.js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { logger } = require('../../src/managers/logger');
const { safeParseInventory } = require('./inventoryHelper');
const fs = require('fs');
const path = require('path');
const UserSurvival = require('../../src/models/UserSurvival');
const UserProfile = require('../../src/models/UserProfile');
const cacheManager = require('../../src/managers/cacheManager');
const ui = require('../../src/config/ui');
const languageManager = require('../../src/managers/languageManager');

// Dynamic loader for subcommands
const subcommands = new Map();
const subCommandFiles = fs.readdirSync(path.join(__dirname, 'subcommands')).filter(file => file.endsWith('.js'));
for (const file of subCommandFiles) {
    const subCmd = require(`./subcommands/${file}`);
    subcommands.set(file.replace('.js', ''), subCmd);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('survival')
        .setDescription('Masuk ke dalam dunia Naura RPG - Survival Edition')
        .addSubcommandGroup(group => group
            .setName('gather')
            .setDescription('Kumpulkan sumber daya alam')
            .addSubcommand(sub => sub.setName('collect').setDescription('Mencari material/bahan (sesuai lokasi)').addStringOption(opt => opt.setName('lokasi').setDescription('Pilih titik resource').setRequired(true).addChoices(
                { name: 'Pohon (Hutan)', value: 'hutan' },
                { name: 'Batu (Tambang)', value: 'tambang' },
                { name: 'Air (Laut)', value: 'laut' },
                { name: 'Rerumputan (Desa)', value: 'desa' }
            )))
            .addSubcommand(sub => sub.setName('fish').setDescription('Memancing ikan di laut atau pantai utara'))
            .addSubcommand(sub => sub.setName('mine').setDescription('Menambang batu dan mineral berharga di gua'))
            .addSubcommand(sub => sub.setName('chop').setDescription('Menebang pohon untuk mendapatkan kayu di hutan'))
        )
        .addSubcommandGroup(group => group
            .setName('economy')
            .setDescription('Sistem ekonomi dan keuangan')
            .addSubcommand(sub => sub.setName('bank').setDescription('Simpan koinmu di Bank (Hanya di Kota)'))
            .addSubcommand(sub => sub.setName('shop').setDescription('Membeli properti/kendaraan/alat premium dengan koin (Hanya di Kota)'))
            .addSubcommand(sub => sub.setName('market').setDescription('Beli kebutuhan dasar & properti murah (Hanya di Desa Pemula)'))
            .addSubcommand(sub => sub.setName('work').setDescription('Bekerja untuk mencari koin (Hanya di Kota)').addStringOption(opt => opt.setName('pekerjaan').setDescription('Pilih shift kerja').setRequired(true).addChoices(
                { name: 'Tukang Sapu (Butuh: 1 Int)', value: 'janitor' },
                { name: 'Pekerja Kantoran (Butuh: 10 Int)', value: 'office' },
                { name: 'Dokter (Butuh: 30 Int)', value: 'doctor' },
                { name: 'CEO (Butuh: 80 Int)', value: 'ceo' }
            )))
            .addSubcommand(sub => sub.setName('study').setDescription('Belajar untuk meningkatkan Intelligence (Hanya di Kampus)'))
        )
        .addSubcommandGroup(group => group
            .setName('rpg')
            .setDescription('Sistem petualangan RPG')
            .addSubcommand(sub => sub.setName('start').setDescription('Mulai petualanganmu! (Ambil Starter Kit)'))
            .addSubcommand(sub => sub.setName('travel').setDescription('Pindah ke lokasi lain di map').addStringOption(opt => opt.setName('lokasi').setDescription('Tujuan perjalanan').setRequired(true).addChoices(
                { name: 'Kerajaan Frostsnow', value: 'kota' },
                { name: 'Hutan Tak Berujung (Spring Town)', value: 'hutan' },
                { name: 'Desa Sunset (Pantai Utara)', value: 'laut' },
                { name: 'Desa Swallowtail', value: 'village' },
                { name: 'Tambang Kuno', value: 'tambang' },
                { name: 'Kota Twilight', value: 'academy' },
                { name: 'Taman Bunga', value: 'park' }
            )))
            .addSubcommand(sub => sub.setName('class').setDescription('Pilih atau ganti kelas RPG-mu').addStringOption(opt => opt.setName('nama').setDescription('Pilih Kelas').setRequired(true).addChoices(
                { name: 'Warrior (Fighter)', value: 'warrior' },
                { name: 'Mage (Penyihir)', value: 'mage' },
                { name: 'Assassin (Pembunuh)', value: 'assassin' },
                { name: 'Ranger (Pemanah)', value: 'ranger' }
            )))
            .addSubcommand(sub => sub.setName('duel').setDescription('🛡️ Tantang pemain lain dalam duel bertarung RPG turn-based!')
                .addUserOption(opt => opt.setName('lawan').setDescription('Pilih lawan main yang ingin kamu tantang').setRequired(true))
                .addIntegerOption(opt => opt.setName('taruhan').setDescription('Jumlah Naura Coin taruhan (Opsional)').setRequired(false).setMinValue(100))
            )
            .addSubcommand(sub => sub.setName('dungeon').setDescription('Memasuki lorong gelap untuk melawan monster'))
            .addSubcommand(sub => sub.setName('farm').setDescription('Bercocok tanam dan memanen hasil kebun'))
            .addSubcommand(sub => sub.setName('heist').setDescription('Perampokan bank berisiko tinggi (Hanya di Kota pada Malam Hari)'))
            .addSubcommand(sub => sub.setName('quest').setDescription('Terima dan selesaikan misi harian'))
            .addSubcommand(sub => sub.setName('clan').setDescription('Sistem klan & raid bersama anggota').addStringOption(opt => opt.setName('aksi').setDescription('Pilih aksi klan').setRequired(true).addChoices(
                { name: 'Info Klan Saya', value: 'info' },
                { name: 'Buat Klan Baru', value: 'create' },
                { name: 'Gabung Klan', value: 'join' },
                { name: 'Sumbang Vault', value: 'deposit' },
                { name: 'Serang Boss Raid', value: 'raid' }
            )).addStringOption(opt => opt.setName('nama').setDescription('Nama klan').setRequired(false)).addIntegerOption(opt => opt.setName('jumlah').setDescription('Jumlah Star Fragments').setRequired(false)))
            .addSubcommand(sub => sub.setName('trade').setDescription('🤝 P2P Transfer Star Fragment dengan pemain lain')
                .addUserOption(opt => opt.setName('user').setDescription('Pemain penerima').setRequired(true))
                .addIntegerOption(opt => opt.setName('nsf').setDescription('Jumlah Star Fragment (NSF)').setRequired(true).setMinValue(1))
            )
            .addSubcommand(sub => sub.setName('raid').setDescription('🐉 Serang Boss Raid Klan bersama kawan'))
            .addSubcommand(sub => sub.setName('rebirth').setDescription('Lakukan reinkarnasi setelah mencapai Level Maksimal (Lv. 50)'))
        )
        .addSubcommandGroup(group => group
            .setName('life')
            .setDescription('Sistem kehidupan simulasi')
            .addSubcommand(sub => sub.setName('consume').setDescription('Mengonsumsi makanan/minuman untuk energi'))
            .addSubcommand(sub => sub.setName('craft').setDescription('Merakit alat atau senjata di meja kerja'))
            .addSubcommand(sub => sub.setName('date').setDescription('Ajak NPC kencan ke taman hiburan (Hanya di Park)'))
            .addSubcommand(sub => sub.setName('house').setDescription('Kelola dekorasi dan perabotan properti rumahmu (Hanya di Properti)'))
            .addSubcommand(sub => sub.setName('npc').setDescription('Sapa & Ngobrol dengan penduduk lokal'))
            .addSubcommand(sub => sub.setName('pet').setDescription('Berinteraksi dengan hewan peliharaanmu').addStringOption(opt => opt.setName('aksi').setDescription('Apa yang ingin dilakukan?').setRequired(true).addChoices(
                { name: 'Lihat Status Pet', value: 'view' },
                { name: 'Jinakkan Hewan Liar', value: 'tame' },
                { name: 'Beri Makan', value: 'feed' }
            )))
            .addSubcommand(sub => sub.setName('rest').setDescription('Tidur di kasur untuk memulihkan stamina & nyawa'))
        )
        .addSubcommandGroup(group => group
            .setName('profile')
            .setDescription('Informasi pemain')
            .addSubcommand(sub => sub.setName('info').setDescription('Lihat profil survival, status, dan inventory-mu'))
            .addSubcommand(sub => sub.setName('achievements').setDescription('Lihat daftar pencapaian dan atur gelar aktifmu'))
            .addSubcommand(sub => sub.setName('gallery').setDescription('Lihat kembali memori dan cutscene yang sudah kamu buka'))
            .addSubcommand(sub => sub.setName('story').setDescription('Lanjutkan cerita utama dunia sihir ini'))
        ),

    async execute(interaction) {
        const subCommandName = interaction.options.getSubcommand();
        const cmd = subcommands.get(subCommandName);

        // --- ♻️ SMART AUTO-DELETE & DEFER INTERCEPTOR ---
        const origReply = interaction.reply.bind(interaction);
        const origEditReply = interaction.editReply.bind(interaction);
        const origFollowUp = interaction.followUp.bind(interaction);

        interaction.reply = async (options) => {
            const opts = typeof options === 'string' ? { content: options } : { ...options };
            opts.fetchReply = true;
            let res;

            if (interaction.deferred || interaction.replied) {
                if (opts.ephemeral && !interaction.ephemeral) {
                    res = await origFollowUp(opts);
                    interaction.deleteReply().catch(() => {});
                } else {
                    res = await origEditReply(opts);
                }
            } else {
                res = await origReply(opts);
            }

            if (!opts.ephemeral && !interaction.ephemeral) {
                setTimeout(() => interaction.deleteReply().catch(() => {}), 90000); // 90 Detik (1 Menit 30 Detik)
            }
            return res;
        };

        interaction.editReply = async (options) => {
            const opts = typeof options === 'string' ? { content: options } : { ...options };
            const res = await origEditReply(opts);
            if (!interaction.ephemeral) {
                setTimeout(() => interaction.deleteReply().catch(() => {}), 90000);
            }
            return res;
        };
        // ----------------------------------------------

        // DEFER IMMEDIATELY UNTUK MENCEGAH TIMEOUT "didn't respond in time"
        await interaction.deferReply().catch(() => {});

        // Pengecekan pendaftaran (starter kit)
        if (subCommandName !== 'start') {
            const profile = await cacheManager.getUserProfile(interaction.user.id);
            const inv = safeParseInventory(profile.inventory);
            const hasStarted = inv.some(item => item && item.id === 'survival_started');

            if (!hasStarted) {
                return ui.sendError(interaction, languageManager.translateSync(interaction.localeLang, 'survival_not_started'), true);
            }
        }

        if (!cmd) {
            return ui.sendError(interaction, languageManager.translateSync(interaction.localeLang, 'survival_not_implemented'), true);
        }

        try {
            await cmd.execute(interaction, interaction.client);
        } catch (error) {
            logger.error(`[Survival] Error executing ${subCommandName}:`, error);
            await ui.sendError(interaction, languageManager.translateSync(interaction.localeLang, 'survival_sys_error'), true);
        }
    },

    // --- LEGACY PREFIX SUPPORT ---
    async executePrefix(message, args, client) {
        const aliasMap = {
            'w': 'work', 'f': 'fish', 'm': 'mine', 'c': 'chop',
            'i': 'inventory', 'inv': 'inventory', 'bag': 'inventory',
            'stat': 'info', 'profile': 'info',
            'hunt': 'dungeon', 'store': 'shop'
        };
        let inputSubCmd = args[0] ? args[0].toLowerCase() : 'info';
        const subCmdName = aliasMap[inputSubCmd] || inputSubCmd;
        const cmd = subcommands.get(subCmdName);
        if (!cmd) return ui.sendError(message, 'err_sys_27');

        let loadingMsg = null;

        // Bikin mock object menyerupai 'interaction'
        const mockInteraction = {
            user: message.author,
            member: message.member,
            guild: message.guild,
            channel: message.channel,
            client: client,
            deferReply: async () => {
                const loadingPayload = buildLoadingContainerV2({
                    title: 'Naura Loading System...',
                    loadingMessage: `Naura sedang memproses permintaanmu... Bertahanlah! ⛺✨`,
                    footerText: `Sedang menyiapkan untuk ${message.author.username}`
                });
                loadingMsg = await message.reply(loadingPayload);
            },
            reply: async (data) => await message.reply(data),
            editReply: async (data) => {
                if (loadingMsg) return await loadingMsg.edit(data);
                return await message.reply(data);
            },
            followUp: async (data) => await message.reply(data),
            options: {
                getString: (name) => {
                    if (subCmdName === 'travel' && name === 'lokasi') return args[1] || 'kota';
                    if (subCmdName === 'collect' && name === 'lokasi') return args[1] || 'hutan';
                    if (subCmdName === 'work' && name === 'pekerjaan') return args[1] || 'janitor';
                    if (subCmdName === 'pet' && name === 'aksi') return args[1] || 'view';
                    if (subCmdName === 'class' && name === 'nama') return args[1] || 'warrior';
                    return args[1];
                }
            }
        };

        try {
            await cmd.execute(mockInteraction, client);
        } catch (error) {
            logger.error(`[Survival Prefix Error] ${subCmdName}:`, error);
            await ui.sendError(message, 'err_sys_28');
        }
    }
};
