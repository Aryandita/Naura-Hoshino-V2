// Definisi subcommand group 'life' dan 'profile' untuk /survival.
// Dirampingkan agar payload JSON berada aman di bawah batas ketat Discord API.
// Detail opsi dialihkan ke Discord Components V2 (Hub, Select Menu, dan Modal).

function addLifeGroup(builder) {
  return builder.addSubcommandGroup((group) =>
    group
      .setName("life")
      .setDescription("Sistem kehidupan simulasi")
      .addSubcommand((sub) =>
        sub
          .setName("consume")
          .setDescription("Konsumsi makanan/minuman untuk energi"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("craft")
          .setDescription("Merakit alat atau senjata di meja kerja"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("enchant")
          .setDescription("Sematkan Permata Kosmik ke peralatan"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("date")
          .setDescription("Ajak NPC kencan ke taman hiburan (Park)"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("house")
          .setDescription("Kelola dekorasi & perabotan rumah (Properti)"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("npc")
          .setDescription("Sapa & ngobrol dengan penduduk lokal"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("town")
          .setDescription("Kunjungi Alun-Alun Kota (Town Square)"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("pet")
          .setDescription("Interaksi hewan peliharaan")
          .addStringOption((opt) =>
            opt
              .setName("nama_pet")
              .setDescription("Pilih pet spesifik")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("family")
          .setDescription("Asuh anak dan keluarga"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("rest")
          .setDescription("Tidur untuk pulihkan stamina & HP"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("expedition")
          .setDescription("Kirim Pet dalam ekspedisi idle dungeon")
          .addIntegerOption((opt) =>
            opt
              .setName("durasi")
              .setDescription("Durasi jam")
              .addChoices(
                { name: "1 Jam", value: 1 },
                { name: "4 Jam", value: 4 },
                { name: "8 Jam", value: 8 },
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("cafe")
          .setDescription("Kelola Cyber-Cafe, masak & layani tamu"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("farm")
          .setDescription("Kelola Greenhouse, tanam benih & panen"),
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
          .setDescription("Lihat profil survival & status"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("inventory")
          .setDescription("Buka ransel petualang & barang"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("achievements")
          .setDescription("Daftar pencapaian & gelar"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("gallery")
          .setDescription("Memori & cutscene petualangan"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("story")
          .setDescription("Lanjutkan cerita utama dunia sihir"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("guide")
          .setDescription("Panduan bermain Naura Wilds"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("pass")
          .setDescription("Battle Pass & klaim hadiah musiman"),
      ),
  );
}

module.exports = { addLifeGroup, addProfileGroup };
