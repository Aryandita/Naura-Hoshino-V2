// Definisi subcommand group 'gather' dan 'economy' untuk /survival.
// Dirampingkan agar payload JSON berada aman di bawah batas ketat Discord API.
// Detail opsi dialihkan ke Discord Components V2 (Hub, Select Menu, dan Modal).

function addGatherGroup(builder) {
  return builder.addSubcommandGroup((group) =>
    group
      .setName("gather")
      .setDescription("Kumpulkan sumber daya alam")
      .addSubcommand((sub) =>
        sub
          .setName("collect")
          .setDescription("Mencari material")
          .addStringOption((opt) =>
            opt
              .setName("lokasi")
              .setDescription("Titik resource")
              .setRequired(false)
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
          .setDescription("Memancing ikan & Vivarium")
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Aksi mancing / vivarium")
              .addChoices(
                { name: "🎣 Mancing (Cast)", value: "cast" },
                { name: "🌊 Buka Vivarium", value: "vivarium" },
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("mine")
          .setDescription("Menambang batu & mineral berharga di gua"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("chop")
          .setDescription("Menebang pohon kayu di hutan"),
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
          .setDescription("Dompet 3 mata uang, kupon & subsidi"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("bank")
          .setDescription("Simpan koin di Bank (Kota)"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("shop")
          .setDescription("Beli properti & alat premium (Kota)")
          .addStringOption((opt) =>
            opt
              .setName("item")
              .setDescription("Nama item untuk beli langsung")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("market")
          .setDescription("Beli kebutuhan dasar & bibit murah (Desa)")
          .addStringOption((opt) =>
            opt
              .setName("item")
              .setDescription("Nama item untuk beli langsung")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("work")
          .setDescription("Bekerja mencari koin di Kota")
          .addStringOption((opt) =>
            opt
              .setName("pekerjaan")
              .setDescription("Pilih shift kerja")
              .setRequired(false)
              .addChoices(
                { name: "Tukang Sapu", value: "janitor" },
                { name: "Pekerja Kantoran", value: "office" },
                { name: "Dokter", value: "doctor" },
                { name: "CEO", value: "ceo" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("study")
          .setDescription("Belajar meningkatkan Intelligence di Kampus"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("auction")
          .setDescription("Bursa pasar lelang antar-server"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("caravan")
          .setDescription("Ekspedisi karavan dagang antariksa"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("history")
          .setDescription("10 riwayat aktivitas & transaksi terakhir"),
      ),
  );
}

module.exports = { addGatherGroup, addEconomyGroup };
