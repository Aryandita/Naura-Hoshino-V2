// Definisi subcommand group 'rpg' untuk /survival.
// Grup ini paling besar sehingga diberi berkasnya sendiri.

function addRpgGroup(builder) {
  return builder.addSubcommandGroup((group) =>
    group
      .setName("rpg")
      .setDescription("Sistem petualangan RPG")
      .addSubcommand((sub) =>
        sub
          .setName("start")
          .setDescription("Mulai petualanganmu! (Ambil Starter Kit)"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("event")
          .setDescription(
            "🎁 Ambil hadiah harian dari Event Musiman yang sedang aktif!",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("pass")
          .setDescription(
            "🏆 Buka antarmuka Naura Wilds Season Battle Pass (30 Tiers)",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilihan aksi")
              .addChoices(
                { name: "Lihat Status (View)", value: "view" },
                { name: "Klaim Hadiah (Claim)", value: "claim" },
                { name: "Beli Premium (Buy)", value: "buy" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("travel")
          .setDescription("Pindah ke lokasi lain di map")
          .addStringOption((opt) =>
            opt
              .setName("lokasi")
              .setDescription("Tujuan perjalanan")
              .setRequired(true)
              .addChoices(
                { name: "Kerajaan Frostsnow", value: "kota" },
                { name: "Hutan Tak Berujung (Spring Town)", value: "hutan" },
                { name: "Desa Sunset (Pantai Utara)", value: "laut" },
                { name: "Desa Swallowtail", value: "village" },
                { name: "Tambang Kuno", value: "tambang" },
                { name: "Kota Twilight", value: "academy" },
                { name: "Taman Bunga", value: "park" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("class")
          .setDescription("Pilih atau ganti kelas RPG-mu")
          .addStringOption((opt) =>
            opt
              .setName("nama")
              .setDescription("Pilih Kelas")
              .setRequired(true)
              .addChoices(
                { name: "Warrior (Fighter)", value: "warrior" },
                { name: "Mage (Penyihir)", value: "mage" },
                { name: "Assassin (Pembunuh)", value: "assassin" },
                { name: "Ranger (Pemanah)", value: "ranger" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("skill")
          .setDescription(
            "⚡ Kelola Pohon Kemampuan Jiwa & alokasikan Stat Points",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("duel")
          .setDescription(
            "\ud83d\udee1\ufe0f Tantang pemain lain dalam duel bertarung RPG turn-based!",
          )
          .addUserOption((opt) =>
            opt
              .setName("lawan")
              .setDescription("Pilih lawan main yang ingin kamu tantang")
              .setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("taruhan")
              .setDescription("Jumlah Naura Coin taruhan (Opsional)")
              .setRequired(false)
              .setMinValue(100),
          )
          .addBooleanOption((opt) =>
            opt
              .setName("ranked")
              .setDescription(
                "Mainkan mode Ranked untuk mendapatkan poin MMR? (Opsional)",
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("arena")
          .setDescription("Akses sistem PvP Arena (Leaderboard & Stats)")
          .addStringOption((opt) =>
            opt
              .setName("menu")
              .setDescription("Pilih menu arena")
              .setRequired(true)
              .addChoices(
                { name: "🏆 Papan Peringkat MMR", value: "leaderboard" },
                { name: "📊 Statistik PvP Pribadi", value: "stats" },
                {
                  name: "⚔️ Galactic Coliseum 3v3 Match",
                  value: "coliseum_match",
                },
                {
                  name: "🛡️ Formasi Tim & Divisi Coliseum",
                  value: "coliseum_team",
                },
                {
                  name: "👑 Papan Peringkat Divisi Master",
                  value: "coliseum_leaderboard",
                },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("dungeon")
          .setDescription("Memasuki lorong gelap untuk melawan monster"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("pet")
          .setDescription("Rawat dan main dengan pet milikmu")
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Aksi yang ingin dilakukan")
              .setRequired(true)
              .addChoices(
                { name: "Lihat Status Pet", value: "view" },
                { name: "Beri Makan", value: "feed" },
                { name: "Ajak Main", value: "play" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("farm")
          .setDescription("Bercocok tanam dan memanen hasil kebun"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("heist")
          .setDescription(
            "Perampokan bank berisiko tinggi (Hanya di Kota pada Malam Hari)",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("quest")
          .setDescription("Terima dan selesaikan misi harian"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("clan")
          .setDescription("Sistem klan & raid bersama anggota")
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih aksi klan")
              .setRequired(true)
              .addChoices(
                { name: "🏰 Dashboard & Info Klan", value: "info" },
                { name: "🌐 Aliansi Federasi Global", value: "federation" },
                { name: "🏡 2.5D Guild Hall Lounge", value: "hall" },
                { name: "☕ Seduh Kopi Lounge (+25 Energy)", value: "coffee" },
                { name: "🛋️ Beli Furnitur Lounge", value: "furniture" },
                { name: "🎨 Ubah Tema Hall", value: "theme" },
                { name: "⭐ Upgrade Fasilitas", value: "upgrade" },
                { name: "Buat Klan Baru", value: "create" },
                { name: "Gabung Klan", value: "join" },
                { name: "Sumbang Vault", value: "deposit" },
                { name: "Serang Boss Raid", value: "raid" },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName("nama")
              .setDescription("Nama klan atau ID furnitur")
              .setRequired(false),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("jumlah")
              .setDescription("Jumlah Star Fragments")
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("trade")
          .setDescription(
            "\ud83e\udd1d P2P Transfer Star Fragment dengan pemain lain",
          )
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("Pemain penerima")
              .setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("nsf")
              .setDescription("Jumlah Star Fragment (NSF)")
              .setRequired(true)
              .setMinValue(1),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("raid")
          .setDescription(
            "🐉 Serang World Boss Global bersama seluruh petualang!",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih aksi raid")
              .setRequired(false)
              .addChoices(
                { name: "📊 Status World Boss", value: "status" },
                { name: "⚔️ Serang World Boss", value: "serang" },
                { name: "🏆 Papan Peringkat Kontribusi", value: "leaderboard" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("rebirth")
          .setDescription(
            "Lakukan reinkarnasi setelah mencapai Level Maksimal (Lv. 50)",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("gacha")
          .setDescription("Roll Gacha untuk mendapatkan item langka!")
          .addStringOption((option) =>
            option
              .setName("banner")
              .setDescription("Pilih banner gacha")
              .setRequired(true)
              .addChoices(
                { name: "📦 Standard Drop (3000 Coins)", value: "standard" },
                { name: "💎 Premium Mythic (5 Coupons)", value: "premium" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("conquest")
          .setDescription(
            "🏰 Perang Faksi Wilayah Klan & Klaim Pajak Sektor (Neo-Hoshino)",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Aksi perang wilayah")
              .addChoices(
                { name: "🗺️ Lihat Peta Wilayah", value: "map" },
                { name: "⚔️ Serang Sektor", value: "attack" },
                { name: "🛡️ Perkuat Pertahanan", value: "defend" },
                { name: "💰 Klaim Pajak Kas Klan", value: "tax" },
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("sektor")
              .setDescription("ID Sektor target")
              .addChoices(
                { name: "Neon Cyber-Docks", value: "SECTOR_DOCKS" },
                { name: "Crystal Quarry", value: "SECTOR_MINES" },
                { name: "Babel Citadel", value: "SECTOR_CITADEL" },
                { name: "Sakura Valley", value: "SECTOR_VALLEY" },
                { name: "Central Cyber-Hub", value: "SECTOR_PLAZA" },
              )
              .setRequired(false),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("energi")
              .setDescription("Jumlah poin energi yang dikerahkan (10-500)")
              .setMinValue(10)
              .setMaxValue(500)
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("abyss")
          .setDescription(
            "🌀 Jelajahi Labirin Rogue-lite Prosedural 50 Lantai (The Neo-Abyss)",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih aksi ekspedisi labirin")
              .addChoices(
                { name: "🚀 Mulai / Lanjutkan Ekspedisi", value: "start" },
                { name: "🚪 Masuki Ruangan 1", value: "room_1" },
                { name: "🚪 Masuki Ruangan 2", value: "room_2" },
                { name: "🚪 Masuki Ruangan 3", value: "room_3" },
                { name: "🏁 Selesaikan & Klaim Hadiah", value: "leave" },
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("custom-dungeon")
          .setDescription(
            "🏰 Custom Community Dungeon Maker & Arena Buatan Pemain",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih aksi dungeon komunitas")
              .addChoices(
                { name: "Jelajahi Dungeon (Browse)", value: "browse" },
                { name: "Buat Dungeon Baru (Create)", value: "create" },
                { name: "Tantang Dungeon (Play)", value: "play" },
                { name: "Beri Rating Bintang (Rate)", value: "rate" },
                {
                  name: "Cairkan Royalti Brankas (Withdraw)",
                  value: "withdraw",
                },
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("nama")
              .setDescription("Nama dungeon baru (khusus aksi Create)")
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("dungeon_id")
              .setDescription(
                "ID Dungeon target (khusus aksi Play, Rate, Withdraw)",
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("tema")
              .setDescription("Tema visual arsitektur dungeon")
              .addChoices(
                { name: "Cyber Void", value: "CYBER_VOID" },
                { name: "Volcanic Core", value: "VOLCANIC_CORE" },
                { name: "Astral Temple", value: "ASTRAL_TEMPLE" },
                { name: "Neon Crypt", value: "NEON_CRYPT" },
              )
              .setRequired(false),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("tiket")
              .setDescription("Biaya tiket masuk koin (default: 100)")
              .setRequired(false),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("bintang")
              .setDescription("Rating bintang 1 s/d 5 (khusus aksi Rate)")
              .setMinValue(1)
              .setMaxValue(5)
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("federation")
          .setDescription(
            "🌐 Hub Aliansi Federasi Klan Lintas-Server & Global Hall of Fame",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih aksi federasi aliansi")
              .addChoices(
                { name: "🏰 Status Aliansi Klan", value: "status" },
                { name: "🏆 Global Hall of Fame", value: "halloffame" },
                { name: "🐉 Status Alliance Raid Boss", value: "boss" },
                { name: "👑 Dirikan Federasi (Ketua Klan)", value: "create" },
                { name: "🤝 Gabung Aliansi Federasi", value: "join" },
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("nama")
              .setDescription("Nama aliansi federasi baru (khusus aksi Create)")
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("tag")
              .setDescription(
                "Tag aliansi klan maks 5 karakter (khusus aksi Create)",
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("federation_id")
              .setDescription("ID Aliansi Federasi target (khusus aksi Join)")
              .setRequired(false),
          ),
      ),
  );
}

module.exports = { addRpgGroup };
