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
          .setName("enchant")
          .setDescription("💎 Sematkan Permata Kosmik ke peralatanmu"),
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
                { name: "🏡 Kunjungi Pet Habitat", value: "habitat" },
                { name: "⚡ Cosmic Ascension Fusion", value: "fuse" },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName("nama_pet")
              .setDescription("Pilih pet spesifik (Autocomplete)")
              .setRequired(false)
              .setAutocomplete(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("target_pet_id")
              .setDescription("ID Pet bahan untuk Cosmic Fusion")
              .setRequired(false),
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
          .setDescription(
            "Kirim Pet aktif dalam ekspedisi idle dungeon untuk mencari hadiah langka",
          )
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
      )
      .addSubcommand((sub) =>
        sub
          .setName("cafe")
          .setDescription(
            "☕ Kelola Cozy Cyber-Cafe, masak hidangan, dan layani pelanggan!",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Aksi kafe yang ingin dilakukan")
              .addChoices(
                { name: "Lihat Status Kafe", value: "status" },
                { name: "Masak Menu (Cook)", value: "cook" },
                { name: "Layani Tamu NPC (Serve)", value: "serve" },
                { name: "Klaim Pendapatan Pasif (Collect)", value: "collect" },
                { name: "Beli Menu Kafe Pemain Lain (Order)", value: "order" },
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("resep")
              .setDescription(
                "ID Resep untuk dimasak / dipesan (misal: sakura_latte, cyber_ramen)",
              )
              .setRequired(false),
          )
          .addUserOption((opt) =>
            opt
              .setName("target_user")
              .setDescription(
                "Pemain yang kafenya ingin kamu kunjungi (untuk aksi order)",
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("farm")
          .setDescription(
            "🌿 Kelola Lahan Hidroponik Greenhouse, tanam benih, dan panen bahan kafe!",
          )
          .addStringOption((opt) =>
            opt
              .setName("aksi")
              .setDescription("Aksi greenhouse yang ingin dilakukan")
              .addChoices(
                { name: "Lihat Status Greenhouse", value: "status" },
                { name: "Toko Benih Kosmik (Shop)", value: "shop" },
                { name: "Tanam Benih (Plant)", value: "plant" },
                { name: "Siram Pod Tanaman (Water)", value: "water" },
                {
                  name: "Beri Pupuk Bio-Elektrolit (Fertilize)",
                  value: "fertilize",
                },
                { name: "Panen Tanaman Matang (Harvest)", value: "harvest" },
                {
                  name: "Tingkatkan Kapasitas Grid (Upgrade)",
                  value: "upgrade",
                },
              )
              .setRequired(false),
          )
          .addStringOption((opt) =>
            opt
              .setName("benih")
              .setDescription("Pilih jenis benih kosmik yang ingin ditanam")
              .addChoices(
                {
                  name: "🍓 Astral Strawberry (60m)",
                  value: "astral_strawberry",
                },
                { name: "🌿 Cyber Mint (120m)", value: "cyber_mint" },
                { name: "☕ Void Coffee Bean (240m)", value: "void_coffee" },
                { name: "🍈 Neon Melon (360m)", value: "neon_melon" },
                { name: "🌾 Sakura Grain (720m)", value: "sakura_grain" },
              )
              .setRequired(false),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("slot")
              .setDescription("Nomor Pod Lahan (1 s/d 6)")
              .setRequired(false),
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
          .setDescription("Lihat profil survival, status, dan statistikmu"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("inventory")
          .setDescription(
            "🎒 Buka ransel petualang dan lihat semua barang bawaanmu",
          ),
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
