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
          .setDescription("Memancing ikan di laut atau pantai utara"),
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
      ),
  );
}

module.exports = { addGatherGroup, addEconomyGroup };
