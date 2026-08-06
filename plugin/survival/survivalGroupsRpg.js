// Definisi subcommand group 'rpg' untuk /survival.
// Grup ini paling besar sehingga diberi berkasnya sendiri.

function addRpgGroup(builder) {
    return builder.addSubcommandGroup(group => group
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
        .addSubcommand(sub => sub.setName('duel').setDescription('\ud83d\udee1\ufe0f Tantang pemain lain dalam duel bertarung RPG turn-based!')
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
        .addSubcommand(sub => sub.setName('trade').setDescription('\ud83e\udd1d P2P Transfer Star Fragment dengan pemain lain')
            .addUserOption(opt => opt.setName('user').setDescription('Pemain penerima').setRequired(true))
            .addIntegerOption(opt => opt.setName('nsf').setDescription('Jumlah Star Fragment (NSF)').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub => sub.setName('raid').setDescription('\ud83d\udc09 Serang Boss Raid Klan bersama kawan'))
        .addSubcommand(sub => sub.setName('rebirth').setDescription('Lakukan reinkarnasi setelah mencapai Level Maksimal (Lv. 50)'))
    );
}

module.exports = { addRpgGroup };
