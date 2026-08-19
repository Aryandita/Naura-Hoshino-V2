// Definisi subcommand group 'life' dan 'profile' untuk /survival.

function addLifeGroup(builder) {
  return builder.addSubcommandGroup((group) =>
    group
      .setName("life")
      .setDescription("Sistem kehidupan simulasi")
      .addSubcommand((sub) =>
        sub
          .setName("consume")
          .setDescription("Mengonsumsi makanan/minuman untuk energi"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("craft")
          .setDescription("Merakit alat atau senjata di meja kerja"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("date")
          .setDescription("Ajak NPC kencan ke taman hiburan (Hanya di Park)"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("house")
          .setDescription(
            "Kelola dekorasi dan perabotan properti rumahmu (Hanya di Properti)",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("npc")
          .setDescription("Sapa & Ngobrol dengan penduduk lokal"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("pet")
          .setDescription("Berinteraksi dengan hewan peliharaanmu")
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Apa yang ingin dilakukan?")
              .setRequired(true)
              .addChoices(
                { name: "Lihat Status Pet", value: "view" },
                { name: "Jinakkan Hewan Liar", value: "tame" },
                { name: "Beri Makan", value: "feed" },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName("nama_pet")
              .setDescription("Pilih pet spesifik (Autocomplete)")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("rest")
          .setDescription("Tidur di kasur untuk memulihkan stamina & nyawa"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("expedition")
          .setDescription("Kirim Pet aktif dalam ekspedisi idle dungeon untuk mencari hadiah langka")
          .addIntegerOption((opt) =>
            opt
              .setName("durasi")
              .setDescription("Durasi ekspedisi pet")
              .addChoices(
                { name: "1 Jam (Cepat)", value: 1 },
                { name: "4 Jam (Menengah)", value: 4 },
                { name: "8 Jam (Panjang & Hadiah Terbesar)", value: 8 },
              )
              .setRequired(true),
          ),
      ),
  );
}

function addProfileGroup(builder) {
  return builder.addSubcommandGroup((group) =>
    group
      .setName("profile")
      .setDescription("Informasi pemain")
      .addSubcommand((sub) =>
        sub
          .setName("info")
          .setDescription("Lihat profil survival, status, dan inventory-mu"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("achievements")
          .setDescription("Lihat daftar pencapaian dan atur gelar aktifmu"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("gallery")
          .setDescription(
            "Lihat kembali memori dan cutscene yang sudah kamu buka",
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("story")
          .setDescription("Lanjutkan cerita utama dunia sihir ini"),
      ),
  );
}

module.exports = { addLifeGroup, addProfileGroup };
