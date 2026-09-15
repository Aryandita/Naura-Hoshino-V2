// Definisi subcommand group 'gather' dan 'economy' untuk /survival.
// Dipisah dari survival.js supaya berkas utama tetap ringan dan mudah dirawat.
// Setiap fungsi memutasi builder yang dikirim lalu mengembalikannya kembali.

function addGatherGroup(builder) {
  return builder.addSubcommandGroup((group) =>
    group
      .setName("gather")
      .setDescription("Kumpulkan sumber daya alam")
      .addSubcommand((sub) =>
        sub
          .setName("collect")
          .setDescription("Mencari material/bahan (sesuai lokasi)")
          .addStringOption((opt) =>
            opt
              .setName("lokasi")
              .setDescription("Pilih titik resource")
              .setRequired(true)
              .addChoices(
                { name: "Pohon (Hutan)", value: "hutan" },
                { name: "Batu (Tambang)", value: "tambang" },
                { name: "Air (Laut)", value: "laut" },
                { name: "Rerumputan (Desa)", value: "desa" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("fish")
          .setDescription(
            "Memancing ikan di laut dangkal atau samudra laut dalam & Vivarium",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih aksi memancing / vivarium")
              .addChoices(
                { name: "🎣 Lempar Kail (Cast)", value: "cast" },
                { name: "🌊 Lihat Holographic Vivarium", value: "vivarium" },
                { name: "📥 Taruh Ikan ke Akuarium", value: "deposit" },
                { name: "💰 Klaim Tiket Pengunjung", value: "collect" },
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("zona")
              .setDescription("Pilih kedalaman laut")
              .addChoices(
                { name: "Coral Reef (0 - 200m)", value: "CORAL_REEF" },
                {
                  name: "Midnight Trench (200 - 1000m)",
                  value: "MIDNIGHT_TRENCH",
                },
                { name: "Abyssal Core (1000m+)", value: "ABYSSAL_CORE" },
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("ikan")
              .setDescription("ID Ikan untuk dimasukkan ke Vivarium")
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("mine")
          .setDescription("Menambang batu dan mineral berharga di gua"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("chop")
          .setDescription("Menebang pohon untuk mendapatkan kayu di hutan"),
      ),
  );
}

function addEconomyGroup(builder) {
  return builder.addSubcommandGroup((group) =>
    group
      .setName("economy")
      .setDescription("Sistem ekonomi dan keuangan")
      .addSubcommand((sub) =>
        sub
          .setName("wallet")
          .setDescription(
            "💳 Dompet terpadu 3 mata uang, tiket undian, & subsidi petualang",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("bank")
          .setDescription("Simpan koinmu di Bank (Hanya di Kota)"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("shop")
          .setDescription(
            "Membeli properti/kendaraan/alat premium dengan koin (Hanya di Kota)",
          )
          .addStringOption((opt) =>
            opt
              .setName("item")
              .setDescription("Cari nama item untuk beli instan")
              .setRequired(false)
              .setAutocomplete(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih tindakan (Beli langsung atau Inspeksi Hologram)")
              .setRequired(false)
              .addChoices(
                { name: "🛒 Beli Langsung", value: "buy" },
                { name: "🔍 Inspeksi Hologram", value: "inspect" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("market")
          .setDescription(
            "Beli kebutuhan dasar & properti murah (Hanya di Desa Pemula)",
          )
          .addStringOption((opt) =>
            opt
              .setName("item")
              .setDescription("Cari nama item untuk beli instan")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("work")
          .setDescription("Bekerja untuk mencari koin (Hanya di Kota)")
          .addStringOption((opt) =>
            opt
              .setName("pekerjaan")
              .setDescription("Pilih shift kerja")
              .setRequired(true)
              .addChoices(
                { name: "Tukang Sapu (Butuh: 1 Int)", value: "janitor" },
                { name: "Pekerja Kantoran (Butuh: 10 Int)", value: "office" },
                { name: "Dokter (Butuh: 30 Int)", value: "doctor" },
                { name: "CEO (Butuh: 80 Int)", value: "ceo" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("study")
          .setDescription(
            "Belajar untuk meningkatkan Intelligence (Hanya di Kampus)",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("auction")
          .setDescription("Pasar lelang antar server Naura Hoshino")
          .addStringOption((opt) =>
            opt
              .setName("action")
              .setDescription("Pilih aksi lelang")
              .setRequired(true)
              .addChoices(
                { name: "List (Lihat Pasar Lelang)", value: "list" },
                { name: "Sell (Jual Barang)", value: "sell" },
                { name: "Bid (Tawar Barang)", value: "bid" },
                { name: "Claim (Klaim Lelang Selesai)", value: "claim" },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName("target")
              .setDescription("Nama item (sell) atau ID lelang (bid/claim)")
              .setRequired(false)
              .setAutocomplete(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("price")
              .setDescription("Harga awal (sell) atau Harga tawar (bid)")
              .setRequired(false),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("amount")
              .setDescription("Jumlah barang yang dijual (hanya sell)")
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("currency")
              .setDescription("Mata uang lelang (hanya sell)")
              .setRequired(false)
              .addChoices(
                { name: "Star Fragment (NSF)", value: "nsf" },
                { name: "Naura Coin", value: "coin" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("caravan")
          .setDescription(
            "Ekspedisi karavan dagang antariksa & bursa komoditas",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Pilih aksi karavan")
              .setRequired(false)
              .addChoices(
                { name: "Status (Cek Karavan)", value: "status" },
                { name: "Market (Bursa Harga & Rute)", value: "market" },
                { name: "Dispatch (Berangkatkan)", value: "dispatch" },
                { name: "Claim (Cairkan Laba)", value: "claim" },
                { name: "Escort (Gabung Pengawal)", value: "escort" },
                { name: "Ambush (Penyergapan Karavan PvP)", value: "ambush" },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName("caravan_id")
              .setDescription("ID Karavan target (khusus aksi Escort & Ambush)")
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("rute")
              .setDescription("Pilih rute tujuan ekspor")
              .setRequired(false)
              .addChoices(
                { name: "Neo Tokyo Orbit (30m · +35% Laba)", value: "tokyo" },
                {
                  name: "Starlight Outpost (60m · +75% Laba)",
                  value: "outpost",
                },
                {
                  name: "Galactic Core Nexus (120m · +150% Laba)",
                  value: "nexus",
                },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName("komoditas")
              .setDescription("Komoditas kargo yang dikirim")
              .setRequired(false)
              .addChoices(
                { name: "Kayu Jati Emas 🪵", value: "GOLDEN_WOOD" },
                { name: "Ikan Mitos Samudera 🐟", value: "MYTHIC_FISH" },
                { name: "Bijih Kristal Kosmik 💎", value: "COSMIC_ORE" },
                { name: "Kain Sutra Nebula 👘", value: "ASTRAL_SILK" },
              ),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("jumlah")
              .setDescription("Jumlah unit komoditas (min: 5 unit)")
              .setRequired(false)
              .setMinValue(5)
              .setMaxValue(500),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("history")
          .setDescription(
            "Lihat 10 riwayat aktivitas & transaksi ekonomi terakhir",
          ),
      ),
  );
}

module.exports = { addGatherGroup, addEconomyGroup };
