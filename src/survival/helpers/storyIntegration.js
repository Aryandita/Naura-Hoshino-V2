"use strict";

const storyEngine = require("../engines/storyEngine");
const npcScheduleEngine = require("../engines/npcScheduleEngine");
const npcBackstoryEngine = require("../engines/npcBackstoryEngine");
const visualNovelRenderer = require("../engines/visualNovelRenderer");

/**
 * Story Integration Module
 * Mengintegrasikan VN story system langsung ke survival commands
 */
class StoryIntegration {
  /**
   * Trigger story scene saat user greet NPC untuk pertama kali
   */
  async checkFirstEncounter(userId, npcId) {
    const progress = await storyEngine.getUserStoryProgress(userId);
    const encounterKey = `first_meet_${npcId}`;

    if (progress.flags[encounterKey]) {
      return null; // Sudah pernah bertemu
    }

    // Mark as met
    await storyEngine.setStoryFlag(userId, encounterKey, true);

    // Return first encounter scene jika ada
    const firstScene = this.getFirstEncounterScene(npcId);
    if (firstScene) {
      return {
        type: "first_encounter",
        scene: firstScene,
      };
    }

    return null;
  }

  /**
   * Get first encounter scene untuk NPC tertentu
   * Emotion dan background harus match dengan assets yang tersedia
   */
  getFirstEncounterScene(npcId) {
    const scenes = {
      // ═══ DESA SUKAMAJU ═══
      ningsih: {
        characterId: "ningsih",
        characterEmotion: "shy",
        backgroundId: "kebun_morning",
        speakerName: "Ningsih",
        title: "Pertemuan di Kebun",
        dialogText: "*Seorang gadis sedang menyiram tanaman dengan penuh perhatian. Ia tidak menyadari kehadiranmu sampai kamu mendekat.*\n\nOh! Ma... maaf, aku tidak melihatmu datang.\n\n*Kemerahan menghiasi pipinya*\n\nAku Ningsih. Kamu... pendatang baru ya? Selamat datang di kebun kami.",
        choices: [
          { label: "\"Senang berkenalan, Ningsih.\"", value: "polite", effect: { affection: 3 } },
          { label: "\"Kebunmu indah sekali!\"", value: "compliment", effect: { affection: 5 } },
          { label: "\"Maaf mengganggu.\"", value: "apologetic", effect: { affection: 1 } },
        ],
      },
      tari: {
        characterId: "tari",
        characterEmotion: "excited",
        backgroundId: "sungai_morning",
        speakerName: "Tari",
        title: "Gadis Sungai",
        dialogText: "*Seorang gadis tomboy melompat turun dari batu besar di tepi sungai, memikul joran pancing di bahunya.*\n\nOi! Wajah baru nih!\n\n*Ia menyeringai lebar*\n\nAku Tari. Kamu juga suka laut? Kalau mau melaut bareng, bilang aja ya!",
        choices: [
          { label: "\"Boleh juga! Kapan kita pergi?\"", value: "enthusiastic", effect: { affection: 5 } },
          { label: "\"Aku lebih suka daratan sih...\"", value: "hesitant", effect: { affection: 1 } },
          { label: "\"Kamu pasti jago mancing ya?\"", value: "curious", effect: { affection: 3 } },
        ],
      },
      bidan_sari: {
        characterId: "bidan_sari",
        characterEmotion: "happy",
        backgroundId: "warung_morning",
        speakerName: "Bidan Sari",
        title: "Sentuhan Keibuan",
        dialogText: "*Seorang wanita paruh baya dengan senyum hangat menatapmu dari balik meja warung.*\n\nSelamat pagi, nak. Kamu kelihatan sehat.\n\n*Ia menuangkan secangkir teh hangat*\n\nAku Bidan Sari. Jangan ragu datang ke klinik kalau butuh bantuan medis ya. Atau sekadar mampir minum teh juga boleh.",
        choices: [
          { label: "\"Terima kasih, Bu.\"", value: "respectful", effect: { affection: 3 } },
          { label: "\"Tehnya wangi sekali, Bu.\"", value: "warm", effect: { affection: 5 } },
          { label: "\"Saya akan ingat, Bu Sari.\"", value: "polite", effect: { affection: 2 } },
        ],
      },
      bu_ratna: {
        characterId: "bu_ratna",
        characterEmotion: "neutral",
        backgroundId: "sekolah_morning",
        speakerName: "Bu Ratna",
        title: "Sang Pendidik",
        dialogText: "*Seorang wanita anggun berkacamata sedang merapikan buku-buku di rak perpustakaan sekolah. Ia menoleh saat mendengar langkah kakimu.*\n\nOh, selamat pagi. Kamu pasti warga baru yang dimaksud Pak Kades.\n\n*Ia tersenyum tipis namun tulus*\n\nAku Ratna, guru di sini. Kalau butuh buku atau ingin belajar sesuatu, perpustakaan ini selalu terbuka.",
        choices: [
          { label: "\"Senang bertemu Anda, Bu Ratna.\"", value: "formal", effect: { affection: 3 } },
          { label: "\"Perpustakaannya lengkap sekali!\"", value: "impressed", effect: { affection: 5 } },
          { label: "\"Saya suka membaca.\"", value: "shared_interest", effect: { affection: 4 } },
        ],
      },
      luna: {
        characterId: "luna",
        characterEmotion: "happy",
        backgroundId: "warung_morning",
        speakerName: "Luna",
        title: "Si Ceria",
        dialogText: "*Gadis berambut kepang dua dengan aksen pink melambai riang dari balik etalase toko gacha.*\n\nHalo halo! Customer baru!\n\n*Matanya berbinar-binar*\n\nAku Luna! Kamu mau coba gacha? Hari ini ada diskon spesial loh~ Atau mau lihat koleksi limited edition?",
        choices: [
          { label: "\"Wah, menarik! Tunjukkan dong.\"", value: "interested", effect: { affection: 5 } },
          { label: "\"Gacha? Apa itu?\"", value: "confused", effect: { affection: 2 } },
          { label: "\"Kamu semangat sekali ya, Luna.\"", value: "amused", effect: { affection: 3 } },
        ],
      },
      pak_kades_tirto: {
        characterId: "pak_kades_tirto",
        characterEmotion: "happy",
        backgroundId: "warung_evening",
        speakerName: "Pak Kades Tirto",
        title: "Pemimpin Desa",
        dialogText: "*Seorang pria paruh baya dengan batik rapi mengangguk hormat padamu. Senyum kebapakannya langsung membuatmu merasa diterima.*\n\nAh, selamat datang anak muda! Naura Wilds menyambutmu dengan tangan terbuka.\n\n*Ia menjabat tanganmu erat*\n\nAku Tirto, kepala desa di sini. Anggap saja rumah sendiri ya.",
        choices: [
          { label: "\"Terima kasih, Pak Kades.\"", value: "respectful", effect: { affection: 3 } },
          { label: "\"Desa ini terlihat sangat asri, Pak.\"", value: "compliment", effect: { affection: 4 } },
          { label: "\"Saya akan berusaha jadi warga yang baik.\"", value: "earnest", effect: { affection: 5 } },
        ],
      },
      bagas: {
        characterId: "bagas",
        characterEmotion: "neutral",
        backgroundId: "warung_evening",
        speakerName: "Bagas",
        title: "Pandai Besi",
        dialogText: "*Pria bertubuh kekar dengan bekas luka di alis menatapmu datar. Tangannya yang besar masih memegang palu tempa.*\n\n...\n\n*Ia mengangguk singkat*\n\nBagas. Pandai besi. Butuh senjata atau alat, datang ke bengkelku. Jangan sentuh barang-barang sebelum aku bilang boleh.",
        choices: [
          { label: "\"Siap, Bang Bagas.\"", value: "obedient", effect: { affection: 3 } },
          { label: "\"Karya-karyamu pasti luar biasa.\"", value: "respect_craft", effect: { affection: 5 } },
          { label: "\"...Oke.\"", value: "awkward", effect: { affection: 1 } },
        ],
      },
      mang_ujang: {
        characterId: "mang_ujang",
        characterEmotion: "happy",
        backgroundId: "sungai_evening",
        speakerName: "Mang Ujang",
        title: "Nelayan Filosofis",
        dialogText: "*Seorang nelayan tua duduk santai di tepi sungai, topi caping menutupi sebagian wajahnya. Ia tersenyum melihatmu mendekat.*\n\nEh, anak muda. Duduk dulu, jangan buru-buru.\n\n*Ia menunjuk batu kosong di sampingnya*\n\nAku Ujang. Laut dan sungai itu guru terbaik. Kadang kita cuma perlu diam dan mendengarkan.",
        choices: [
          { label: "*Duduk di sampingnya*", value: "sit", effect: { affection: 5 } },
          { label: "\"Apa yang Mang Ujang dengarkan?\"", value: "philosophical", effect: { affection: 4 } },
          { label: "\"Terima kasih, Mang.\"", value: "polite", effect: { affection: 2 } },
        ],
      },
      ki_prawiro: {
        characterId: "ki_prawiro",
        characterEmotion: "neutral",
        backgroundId: "kebun_afternoon",
        speakerName: "Ki Prawiro",
        title: "Pawang Hewan",
        dialogText: "*Seorang tetua berjenggot putih panjang duduk bersila di bawah pohon beringin. Seekor burung kecil hinggap di tangannya tanpa takut.*\n\n...\n\n*Ia membuka mata perlahan, menatapmu dengan tatapan yang seolah menembus jiwa*\n\nKau datang. Hutan sudah memberitahuku. Aku Prawiro. Duduklah... jika kau berani.",
        choices: [
          { label: "*Duduk dengan tenang*", value: "calm", effect: { affection: 5 } },
          { label: "\"Hutan... memberitahu?\"", value: "curious", effect: { affection: 3 } },
          { label: "\"Siap, Ki.\"", value: "respectful", effect: { affection: 2 } },
        ],
      },
      gatot: {
        characterId: "gatot",
        characterEmotion: "neutral",
        backgroundId: "kebun_afternoon",
        speakerName: "Gatot",
        title: "Penjaga Gua",
        dialogText: "*Sosok raksasa dengan armor berat berdiri menghalangi jalan masuk gua. Bekas luka memenuhi wajahnya. Ia menatapmu tanpa ekspresi.*\n\n...\n\n*Lama ia mengamati, lalu mengangguk pelan*\n\nGatot. Penjaga. Jangan masuk tanpa izin. Bahaya di dalam bukan main-main.",
        choices: [
          { label: "\"Mengerti. Terima kasih peringatannya.\"", value: "cautious", effect: { affection: 3 } },
          { label: "\"Apa yang kau jaga di sana?\"", value: "bold", effect: { affection: 2 } },
          { label: "*Mengangguk hormat*", value: "silent_respect", effect: { affection: 4 } },
        ],
      },

      // ═══ KOTA PRATAMA ═══
      mbak_rini: {
        characterId: "mbak_rini",
        characterEmotion: "neutral",
        backgroundId: "cafe_afternoon",
        speakerName: "Mbak Rini",
        title: "Bandar Lelang",
        dialogText: "*Wanita elegan dengan potongan rambut bob dan perhiasan mahal mengangkat pandangannya dari tablet. Senyum kalkulatif tersungging di bibirnya.*\n\nOh? Wajah baru di kota.\n\n*Ia menutup tabletnya perlahan*\n\nRini. Bandar lelang. Jika kau punya barang berharga... atau ingin mencari sesuatu yang langka, kau tahu harus ke mana.",
        choices: [
          { label: "\"Menarik. Mungkin kita bisa bekerja sama.\"", value: "business", effect: { affection: 4 } },
          { label: "\"Anda terlihat sangat profesional.\"", value: "flatter", effect: { affection: 3 } },
          { label: "\"Baik, Mbak Rini.\"", value: "simple", effect: { affection: 1 } },
        ],
      },
      suster_maya: {
        characterId: "suster_maya",
        characterEmotion: "angry",
        backgroundId: "cafe_afternoon",
        speakerName: "Suster Maya",
        title: "Perawat Tegas",
        dialogText: "*Perawat muda berkacamata menegurmu bahkan sebelum kau sempat bicara.*\n\nHei! Jangan berdiri di situ, kamu menghalangi jalan!\n\n*Ia memperbaiki letak kacamatanya dengan kesal*\n\n...Maaf. Aku Maya. Perawat di RS Kota. Jangan sakit-sakit ya, aku sudah cukup sibuk.",
        choices: [
          { label: "\"Maaf, Suster. Saya pindah.\"", value: "apologetic", effect: { affection: 3 } },
          { label: "\"Kamu pasti lelah ya, Suster?\"", value: "empathetic", effect: { affection: 5 } },
          { label: "\"Galak banget sih...\"", value: "teasing", effect: { affection: -1 } },
        ],
      },
      laras: {
        characterId: "laras",
        characterEmotion: "happy",
        backgroundId: "cafe_night",
        speakerName: "Laras",
        title: "Pemilik Kafe",
        dialogText: "*Wanita lembut dengan rambut bergelombang menyambutmu dengan senyum teduh. Aroma kopi dan kayu manis menghangatkan suasana.*\n\nSelamat datang di kafe kami.\n\n*Ia menuangkan latte art berbentuk daun*\n\nAku Laras. Silakan duduk di mana saja yang nyaman. Di sini, semua orang boleh jadi diri sendiri.",
        choices: [
          { label: "\"Tempatnya cozy sekali, Laras.\"", value: "compliment", effect: { affection: 5 } },
          { label: "\"Latte art-nya cantik!\"", value: "appreciate", effect: { affection: 4 } },
          { label: "\"Terima kasih.\"", value: "simple", effect: { affection: 2 } },
        ],
      },
      wulan: {
        characterId: "wulan",
        characterEmotion: "shy",
        backgroundId: "perpustakaan_afternoon",
        speakerName: "Wulan",
        title: "Pustakawati Pemalu",
        dialogText: "*Gadis berkacamata bulat menyembunyikan wajahnya di balik tumpukan buku saat kau mendekat. Pipinya merona merah.*\n\nE-eh... s-selamat siang...\n\n*Suara nyaris berbisik*\n\nA-aku Wulan. Pustakawati di sini. Kalau... kalau butuh buku, b-bilang saja ya...",
        choices: [
          { label: "\"Hai Wulan, senang kenalan.\"", value: "gentle", effect: { affection: 5 } },
          { label: "\"Kamu suka buku apa?\"", value: "bookish", effect: { affection: 4 } },
          { label: "\"Maaf mengganggu ya.\"", value: "careful", effect: { affection: 2 } },
        ],
      },
      shino_hoshino: {
        characterId: "shino_hoshino",
        characterEmotion: "happy",
        backgroundId: "cafe_afternoon",
        speakerName: "Shino Hoshino",
        title: "Adik Sepupu Naura",
        dialogText: "*Gadis stylish dengan rambut trendi berlari kecil menghampirimu sambil memegang cup kopi.*\n\nEh eh! Kamu temennya Kak Naura ya?\n\n*Ia tersenyum lebar*\n\nAku Shino! Adik sepupunya. Kita seumuran kan? Ayo ngopi bareng! Aku traktir deh~",
        choices: [
          { label: "\"Wah, boleh! Makasih Shino!\"", value: "accept", effect: { affection: 5 } },
          { label: "\"Kamu mirip Naura ya.\"", value: "compare", effect: { affection: 3 } },
          { label: "\"Nggak usah repot-repot.\"", value: "decline_polite", effect: { affection: 1 } },
        ],
      },
      naura: {
        characterId: "naura",
        characterEmotion: "happy",
        backgroundId: "perpustakaan_evening",
        speakerName: "Naura",
        title: "Heroine Utama",
        dialogText: "*Gadis berambut silver-pink mengalir menoleh padamu dengan senyum cerah yang seolah menerangi ruangan.*\n\nAh! Kamu akhirnya datang!\n\n*Ia clasps kedua tangannya*\n\nAku Naura. Sudah lama aku menunggu seseorang sepertimu. Entah kenapa... rasanya kita ditakdirkan untuk bertemu.",
        choices: [
          { label: "\"Aku juga merasa begitu, Naura.\"", value: "destiny", effect: { affection: 5 } },
          { label: "\"Kamu... siapa sebenarnya?\"", value: "question", effect: { affection: 3 } },
          { label: "\"Senang bertemu denganmu.\"", value: "polite", effect: { affection: 2 } },
        ],
      },

      // ═══ KHUL'KHAS ═══
      elsa_frost: {
        characterId: "elsa_frost",
        characterEmotion: "neutral",
        backgroundId: "kebun_morning",
        speakerName: "Elsa Frost",
        title: "Pawang Kristal Es",
        dialogText: "*Wanita berkulit pucat dengan rambut platinum perak berdiri di tengah kabut tipis. Matanya biru es menatapmu tanpa emosi.*\n\n...\n\n*Napasnya membentuk uap putih di udara dingin*\n\nElsa. Kau tidak seharusnya berada di sini. Tapi... kristal es tidak menolak kehadiranmu. Menarik.",
        choices: [
          { label: "\"Maaf jika aku mengganggu.\"", value: "respectful", effect: { affection: 3 } },
          { label: "\"Kristal es... tidak menolakku?\"", value: "curious", effect: { affection: 5 } },
          { label: "*Mengangguk tanpa kata*", value: "silent", effect: { affection: 4 } },
        ],
      },
      fatimah: {
        characterId: "fatimah",
        characterEmotion: "happy",
        backgroundId: "warung_morning",
        speakerName: "Fatimah",
        title: "Penyeduh Teh Hangat",
        dialogText: "*Wanita anggun dengan headpiece emas menuangkan teh dari teko tembaga. Aroma rempah memenuhi udara.*\n\nAhlan wa sahlan! Selamat datang, saudaraku.\n\n*Senyumnya hangat seperti matahari padang pasir*\n\nAku Fatimah. Minumlah dulu, perjalananmu pasti melelahkan. Teh ini resep turun-temurun dari nenek moyangku.",
        choices: [
          { label: "*Meminum teh dengan khidmat*", value: "accept_tea", effect: { affection: 5 } },
          { label: "\"Aromanya luar biasa, Fatimah.\"", value: "praise", effect: { affection: 4 } },
          { label: "\"Syukran, Fatimah.\"", value: "cultural", effect: { affection: 3 } },
        ],
      },

      // ═══ DESA SUKAMAJU (lanjutan) ═══
      kang_jajang: {
        characterId: "bagas",
        characterEmotion: "working",
        backgroundId: "warung_morning",
        speakerName: "Kang Jajang",
        title: "Tukang Bangunan",
        dialogText: "*Pria kekar dengan topi proyek sedang mengukur kayu. Ia menyeka keringat di dahi.*\n\nEh, ada orang baru! Kang Jajang nih, tukang bangunan desa.\n\nButuh rumah diperbaiki? Atau mau bangun sesuatu? Bilang aja, tapi bayar ya!",
        choices: [
          { label: "\"Siap, Kang! Nanti saya hubungi.\"", value: "agree", effect: { affection: 3 } },
          { label: "\"Bangunan di desa ini kokoh sekali.\"", value: "compliment_work", effect: { affection: 5 } },
        ],
      },
      budi: {
        characterId: "budi",
        characterEmotion: "neutral",
        backgroundId: "sekolah_afternoon",
        speakerName: "Budi",
        title: "Anak Desa Nakal",
        dialogText: "*Bocah laki-laki dengan rambut acak-acakan mengintip dari balik pohon. Ia nyengir saat ketahuan.*\n\nHehe! Kamu siapa? Orang kota ya?\n\nAku Budi! Mau lihat rahasia hutan? Aku tahu jalan tikus yang nggak diketahui orang dewasa!",
        choices: [
          { label: "\"Boleh juga, tunjukkan!\"", value: "adventurous", effect: { affection: 5 } },
          { label: "\"Hati-hati ya, Bud.\"", value: "cautious", effect: { affection: 2 } },
        ],
      },
      siti: {
        characterId: "siti",
        characterEmotion: "shy",
        backgroundId: "sekolah_morning",
        speakerName: "Siti",
        title: "Gadis Manis Desa",
        dialogText: "*Gadis kecil berambut kepang menyembunyikan boneka kain di belakang punggungnya. Ia menatapmu malu-malu.*\n\n...Halo.\n\n*Suara pelan*\n\nAku Siti. Kamu... baik ya? Ibu bilang jangan ngomong sama orang asing, tapi kamu kelihatan baik...",
        choices: [
          { label: "\"Hai Siti, kamu manis sekali.\"", value: "kind", effect: { affection: 5 } },
          { label: "\"Ibumu benar, hati-hati ya.\"", value: "responsible", effect: { affection: 3 } },
        ],
      },

      // ═══ KOTA PRATAMA (lanjutan) ═══
      pak_damar: {
        characterId: "pak_damar",
        characterEmotion: "neutral",
        backgroundId: "pasar_kota",
        speakerName: "Pak Damar",
        title: "Pedagang Keliling",
        dialogText: "*Pria paruh baya dengan mantel panjang membentangkan kain berisi barang-barang aneh. Matanya tajam menilai dirimu.*\n\nHmm... pelanggan baru.\n\n*Ia tersenyum misterius*\n\nDamar namanya. Barang-barang ini tidak kau temukan di toko biasa. Tertarik?",
        choices: [
          { label: "\"Tunjukkan yang paling langka.\"", value: "curious", effect: { affection: 5 } },
          { label: "\"Berapa harganya?\"", value: "practical", effect: { affection: 3 } },
          { label: "\"Tidak, terima kasih.\"", value: "decline", effect: { affection: 0 } },
        ],
      },
      prof_habibie: {
        characterId: "prof_habibie",
        characterEmotion: "neutral",
        backgroundId: "perpustakaan_afternoon",
        speakerName: "Prof. Habibie",
        title: "Dosen Academy",
        dialogText: "*Profesor tua berkacamata tebal menatapmu dari atas tumpukan jurnal ilmiah. Ekspresinya datar namun matanya penuh rasa ingin tahu.*\n\nMahasiswa baru? Atau sekadar pengunjung?\n\n*Ia menutup bukunya*\n\nHabibie. Professor. Jika kau serius belajar, temui aku di ruang kuliah. Jangan buang waktuku.",
        choices: [
          { label: "\"Saya siap belajar, Prof.\"", value: "eager", effect: { affection: 5 } },
          { label: "\"Saya hanya browsing buku.\"", value: "casual", effect: { affection: 1 } },
        ],
      },
      pak_anif: {
        characterId: "pak_anif",
        characterEmotion: "neutral",
        backgroundId: "pasar_kota",
        speakerName: "Pak Anif",
        title: "Petugas Pajak",
        dialogText: "*Pria rapi dengan seragam resmi memegang papan klip. Ia menatapmu dari atas ke bawah.*\n\nWarga baru? Sudah lapor diri ke kantor pajak?\n\n*Nada datar*\n\nAnif. Petugas pajak. Ingat, pajak itu kewajiban. Jangan sampai terlambat.",
        choices: [
          { label: "\"Siap, Pak. Segera saya urus.\"", value: "compliant", effect: { affection: 3 } },
          { label: "\"Pajak untuk apa saja, Pak?\"", value: "question", effect: { affection: 2 } },
        ],
      },
      dokter_wira: {
        characterId: "bidan_sari",
        characterEmotion: "concerned",
        backgroundId: "cafe_afternoon",
        speakerName: "Dokter Wira",
        title: "Dokter Kota",
        dialogText: "*Pria muda dengan jas putih dan mata lelah menyeruput kopi hitam. Kantung mata terlihat jelas.*\n\nOh, pasien baru? Bukan? Syukurlah...\n\n*Tersenyum tipis*\n\nWira. Dokter di RS Kota. Maaf kalau terlihat kurang tidur. Shift malam tadi berat.",
        choices: [
          { label: "\"Istirahat yang cukup, Dok.\"", value: "caring", effect: { affection: 5 } },
          { label: "\"Kopi hitam? Pilihan yang tepat.\"", value: "relatable", effect: { affection: 3 } },
        ],
      },
      bupati_rahmat: {
        characterId: "pak_kades_tirto",
        characterEmotion: "happy",
        backgroundId: "cafe_night",
        speakerName: "Bupati Rahmat",
        title: "Bupati Pratama",
        dialogText: "*Pria berwibawa dengan setelan jas mahal menjabat tanganmu dengan tegas. Karismanya langsung terasa.*\n\nSelamat datang di Kota Pratama!\n\n*Senyum politik yang tulus*\n\nRahmat. Bupati kota ini. Jika ada keluhan atau saran, pintu kantor saya selalu terbuka untuk rakyat.",
        choices: [
          { label: "\"Terima kasih, Pak Bupati.\"", value: "respectful", effect: { affection: 3 } },
          { label: "\"Kota ini berkembang pesat, Pak.\"", value: "observant", effect: { affection: 5 } },
        ],
      },
      bripka_agus: {
        characterId: "gatot",
        characterEmotion: "neutral",
        backgroundId: "pasar_kota",
        speakerName: "Bripka Agus",
        title: "Polisi Kota",
        dialogText: "*Pria tegap dengan seragam polisi menatapmu waspada. Tangannya resting di sabuk.*\n\nIdentitas? Tujuan di kota ini?\n\nSetelah kau menjelaskan, ia mengangguk.\n\nAgus. Bripka. Jaga dirimu. Kota ini aman, tapi tetap waspada.",
        choices: [
          { label: "\"Siap, Pak. Terima kasih.\"", value: "obedient", effect: { affection: 3 } },
          { label: "\"Apakah kota ini aman?\"", value: "concerned", effect: { affection: 2 } },
        ],
      },
      asep: {
        characterId: "mang_ujang",
        characterEmotion: "happy",
        backgroundId: "cafe_evening",
        speakerName: "Asep",
        title: "Pemuda Selo",
        dialogText: "*Pemuda santai dengan gitar di punggung duduk di bangku taman. Ia memetik senar sambil bersenandung.*\n\nYo! Duduk dong!\n\n*Menyeringai*\n\nAsep. Kerjaanku? Nyanyi. Hidup terlalu singkat buat stres, kan?",
        choices: [
          { label: "\"Main lagu dong, Sep!\"", value: "request_song", effect: { affection: 5 } },
          { label: "\"Filosofi hidup yang bagus.\"", value: "appreciate", effect: { affection: 3 } },
        ],
      },

      // ═══ KHUL'KHAS ═══
      syeikh_malik: {
        characterId: "syeikh_malik",
        characterEmotion: "neutral",
        backgroundId: "kebun_morning",
        speakerName: "Syeikh Malik",
        title: "Tetua Nomad",
        dialogText: "*Tetua berjubah pasir dengan sorban putih duduk bersila di atas permadani. Tongkat kayu bertanda rune tergeletak di sampingnya.*\n\n...\n\n*Ia membuka mata perlahan*\n\nAngin padang pasir membawamu kemari. Aku Malik. Duduklah, wahai musafir. Cerita perjalananmu pasti menarik.",
        choices: [
          { label: "*Duduk dan bercerita*", value: "share_story", effect: { affection: 5 } },
          { label: "\"Syeikh terlihat sangat bijaksana.\"", value: "respect", effect: { affection: 4 } },
        ],
      },
      boris_es: {
        characterId: "boris",
        characterEmotion: "neutral",
        backgroundId: "kebun_morning",
        speakerName: "Boris",
        title: "Pemburu Beruang Salju",
        dialogText: "*Raksasa berjaket bulu berdiri di tengah salju tipis. Napasnya membentuk uap putih. Ia menatapmu tanpa ekspresi.*\n\n...\n\n*Mengangguk singkat*\n\nBoris. Pemburu. Jangan jauh-jauh dari jalur. Beruang tidak ramah pada pendatang.",
        choices: [
          { label: "\"Mengerti. Terima kasih peringatannya.\"", value: "cautious", effect: { affection: 3 } },
          { label: "\"Kau pasti kuat sekali.\"", value: "admire", effect: { affection: 4 } },
        ],
      },
      pandai_es_tarek: {
        characterId: "tarek",
        characterEmotion: "neutral",
        backgroundId: "kebun_afternoon",
        speakerName: "Tarek",
        title: "Pandai Besi Kristal Dingin",
        dialogText: "*Pria fokus dengan goggles di dahi sedang menempa kristal es menjadi bilah pisau. Uap dingin mengepul dari tungku khusus.*\n\nJangan sentuh. Masih panas... atau lebih tepatnya, masih dingin ekstrem.\n\n*Tidak mengalihkan pandangan*\n\nTarek. Pandai besi kristal. Butuh senjata es? Tunggu antrean.",
        choices: [
          { label: "\"Teknik yang luar biasa!\"", value: "impressed", effect: { affection: 5 } },
          { label: "\"Baik, saya tunggu.\"", value: "patient", effect: { affection: 3 } },
        ],
      },
      lama_norbu: {
        characterId: "lama_norbu",
        characterEmotion: "neutral",
        backgroundId: "kebun_morning",
        speakerName: "Lama Norbu",
        title: "Biksu Puncak Es",
        dialogText: "*Biksu tua berjubah maroon duduk meditasi di batu datar. Mata terpejam, napas teratur. Keheningan di sekelilingnya terasa sakral.*\n\n...*Ia membuka mata perlahan*\n\nNorbu. Biksu. Kau mencari kedamaian atau kekuatan? Keduanya ada di sini, jika kau tahu cara melihat.",
        choices: [
          { label: "*Duduk bermeditasi bersamanya*", value: "meditate", effect: { affection: 5 } },
          { label: "\"Saya mencari keduanya.\"", value: "honest", effect: { affection: 4 } },
        ],
      },

      // ═══ HUTAN DHA MHAI ═══
      dara_rimba: {
        characterId: "dara_rimba",
        characterEmotion: "neutral",
        backgroundId: "kebun_afternoon",
        speakerName: "Dara Rimba",
        title: "Penjaga Hutan Purba",
        dialogText: "*Gadis lincah dengan rambut hijau-cokelat kusut melompat turun dari dahan pohon. Busur tersampir di punggungnya.*\n\nSiapa kau? Kenapa masuk ke hutanku?\n\n*Tangan menyentuh anak panah*\n\n...Tunggu. Kau bukan pemburu liar. Aku Dara. Penjaga hutan ini. Jangan merusak apapun.",
        choices: [
          { label: "\"Aku hanya menjelajah, tidak merusak.\"", value: "peaceful", effect: { affection: 5 } },
          { label: "\"Hutanmu indah, aku kagum.\"", value: "compliment_forest", effect: { affection: 4 } },
        ],
      },
      pak_wojo: {
        characterId: "pak_wojo",
        characterEmotion: "neutral",
        backgroundId: "kebun_afternoon",
        speakerName: "Pak Wojo",
        title: "Pemburu Rimba Veteran",
        dialogText: "*Pria tua dengan rompi kamuflase dan bekas luka di pipi sedang membersihkan senapan. Ia menoleh tanpa terkejut.*\n\nLangkah kakimu sudah terdengar dari 50 meter. Kurang sunyi.\n\n*Senyum tipis*\n\nWojo. Pemburu veteran. Mau belajar tracking? Atau cuma lewat?",
        choices: [
          { label: "\"Ajari saya tracking, Pak!\"", value: "eager_learn", effect: { affection: 5 } },
          { label: "\"Maaf mengganggu, Pak.\"", value: "polite", effect: { affection: 2 } },
        ],
      },
      kakek_danu: {
        characterId: "kakek_danu",
        characterEmotion: "neutral",
        backgroundId: "kebun_morning",
        speakerName: "Kakek Danu",
        title: "Penyadap Getah Damar",
        dialogText: "*Kakek keriput dengan tangan bernoda getah sedang menyadap pohon damar tua. Gerakannya lambat tapi presisi.*\n\nEh, anak muda. Jarang ada yang mampir ke sini.\n\n*Tersenyum sabar*\n\nDanu. Penyadap getah. Pekerjaan ini butuh kesabaran. Sama seperti hidup.",
        choices: [
          { label: "\"Boleh saya bantu, Kek?\"", value: "help", effect: { affection: 5 } },
          { label: "\"Kesabaran adalah guru terbaik.\"", value: "wisdom", effect: { affection: 4 } },
        ],
      },
      embun_puri: {
        characterId: "embun_puri",
        characterEmotion: "happy",
        backgroundId: "kebun_morning",
        speakerName: "Embun Puri",
        title: "Alkimis Herbal",
        dialogText: "*Gadis lembut dengan jamur kecil di rambutnya sedang memetik tanaman langka. Matanya berbinar saat melihat spesimen baru.*\n\nOh! Kamu lihat bunga ini?! Ini endemik hutan Dha Mhai!\n\n*Tersenyum lebar*\n\nAku Embun Puri. Peneliti herbal. Maaf kalau terlalu excited, tanaman itu passion-ku!",
        choices: [
          { label: "\"Wah, menarik! Ceritakan lebih!\"", value: "interested", effect: { affection: 5 } },
          { label: "\"Kamu sangat passionate ya.\"", value: "appreciate", effect: { affection: 4 } },
        ],
      },
      raden_bram: {
        characterId: "raden_bram",
        characterEmotion: "neutral",
        backgroundId: "kebun_afternoon",
        speakerName: "Raden Bram",
        title: "Ksatria Pengelana",
        dialogText: "*Pria bangsawan dengan rambut diikat rapi dan armor tradisional duduk bermeditasi di bawah pohon. Keris terselip di pinggangnya.*\n\n*Ia membuka mata, menatapmu tenang*\n\nBram. Ksatria pengelana. Hutan ini menyimpan banyak bahaya. Jika kau berjalan di sini, pastikan hatimu bersih.",
        choices: [
          { label: "\"Nasihat yang bijak, Raden.\"", value: "respect", effect: { affection: 5 } },
          { label: "\"Apa bahaya terbesar di hutan ini?\"", value: "curious", effect: { affection: 3 } },
        ],
      },

      // ═══ DESA LAUH THAN ═══
      kapten_reza: {
        characterId: "kapten_reza",
        characterEmotion: "neutral",
        backgroundId: "sungai_morning",
        speakerName: "Kapten Reza",
        title: "Nahkoda Dermaga",
        dialogText: "*Pria tegap dengan seragam angkatan laut dan topi kapten berdiri di dermaga, memandang cakrawala.*\n\nAhoy! Warga baru?\n\n*Salute singkat*\n\nReza. Kapten dermaga. Laut itu indah tapi tidak kenal ampun. Hormati dia, maka dia akan menghormatimu.",
        choices: [
          { label: "\"Siap, Kapten!\"", value: "salute", effect: { affection: 4 } },
          { label: "\"Laut memang guru yang keras.\"", value: "agree", effect: { affection: 5 } },
        ],
      },
      nyai_bahari: {
        characterId: "nyai_bahari",
        characterEmotion: "neutral",
        backgroundId: "sungai_evening",
        speakerName: "Nyai Bahari",
        title: "Tetua Adat Laut",
        dialogText: "*Wanita tua anggun dengan hiasan kerang di kepalanya duduk di batu karang. Suaranya tenang seperti ombak.*\n\nLaut membisikkan namamu padaku sebelum kau tiba.\n\n*Tersenyum teduh*\n\nBahari. Tetua adat laut. Hormati lautan, nak. Dia ibu kita semua.",
        choices: [
          { label: "\"Saya akan menghormati laut, Nyai.\"", value: "promise", effect: { affection: 5 } },
          { label: "*Membungkuk hormat*", value: "bow", effect: { affection: 4 } },
        ],
      },
      doro_penyelam: {
        characterId: "doro",
        characterEmotion: "excited",
        backgroundId: "sungai_morning",
        speakerName: "Doro",
        title: "Penyelam Palung",
        dialogText: "*Pemuda atletis dengan rambut basah dan goggles di dahi muncul dari air, mengangkat mutiara hitam.*\n\nWOI! LIHAT NIH! Mutiara hitam!\n\n*Tertawa lepas*\n\nDoro! Penyelam palung! Dasar laut itu dunia lain, bro! Kapan-kapan aku ajak snorkeling!",
        choices: [
          { label: "\"KEREN BANGET! Aku mau ikut!\"", value: "match_energy", effect: { affection: 5 } },
          { label: "\"Hati-hati ya, Doro.\"", value: "concerned", effect: { affection: 3 } },
        ],
      },
      mbok_darmi: {
        characterId: "mbok_darmi",
        characterEmotion: "happy",
        backgroundId: "warung_morning",
        speakerName: "Mbok Darmi",
        title: "Penjual Ikan Bakar",
        dialogText: "*Wanita gemuk ceria dengan celemek berlapis tepung ikan menggoreng ikan segar. Aroma bumbu bakar memenuhi udara.*\n\nEh eh! Customer baru! Ayo ayo, coba ikan bakarnya!\n\n*Tertawa renyah*\n\nDarmi! Ikan bakar terenak se-Lauh Than! Gratis untuk first timer!",
        choices: [
          { label: "\"Wah, gratis?! Makasih Mbok!\"", value: "grateful", effect: { affection: 5 } },
          { label: "\"Aromanya bikin lapar, Mbok!\"", value: "hungry", effect: { affection: 4 } },
        ],
      },
      laksamana_bayu: {
        characterId: "laksamana_bayu",
        characterEmotion: "neutral",
        backgroundId: "sungai_morning",
        speakerName: "Laksamana Bayu",
        title: "Patroli Samudra",
        dialogText: "*Perwira angkatan laut dengan seragam putih immaculate memeriksa kapal patroli. Posturnya sempurna, tatapannya tajam.*\n\nWarga sipil? Identifikasi.\n\nSetelah kau menjelaskan...\n\nBayu. Laksamana patroli. Perairan ini tanggung jawabku. Laporkan aktivitas mencurigakan.",
        choices: [
          { label: "\"Siap, Laksamana!\"", value: "formal", effect: { affection: 3 } },
          { label: "\"Apakah perairan ini aman?\"", value: "concerned", effect: { affection: 2 } },
        ],
      },

      // ═══ ISTANA DRAKEN ═══
      gargoyle_malakor: {
        characterId: "gargoyle_malakor",
        characterEmotion: "neutral",
        backgroundId: "kebun_afternoon",
        speakerName: "Gargoyle Malakor",
        title: "Iblis Penjaga Gerbang",
        dialogText: "*Makhluk raksasa bertanduk obsidian dengan mata emas menyala menghalangi gerbang istana. Suaranya menggelegar.*\n\n**SIAPA YANG BERANI MEMIJAK TANAH ISTANA?**\n\n*Jeda panjang, lalu nada merendah*\n\n...Malakor. Penjaga. Kau layak masuk... atau tidak. Kita lihat.",
        choices: [
          { label: "\"Aku datang dengan niat baik.\"", value: "peaceful", effect: { affection: 4 } },
          { label: "*Berdiri tegak tanpa gentar*", value: "brave", effect: { affection: 5 } },
        ],
      },

      // ═══ NPC DINAMIS ═══
      mayor_lucy: {
        characterId: "mbak_rini",
        characterEmotion: "neutral",
        backgroundId: "cafe_afternoon",
        speakerName: "Mayor Lucy",
        title: "Walikota Dinamis",
        dialogText: "*Wanita karir dengan blazer sharp dan tablet di tangan berjalan cepat melewati koridor. Ia berhenti sejenak saat melihatmu.*\n\nWajah baru. Bagus, kota butuh darah segar.\n\n*Tersenyum efisien*\n\nLucy. Mayor. Kota ini terus bergerak. Pastikan kau juga.",
        choices: [
          { label: "\"Siap berkontribusi, Mayor!\"", value: "motivated", effect: { affection: 4 } },
          { label: "\"Kota ini impressive, Mayor.\"", value: "impressed", effect: { affection: 3 } },
        ],
      },
    };

    return scenes[npcId] || null;
  }

  /**
   * Check dan trigger backstory unlock notification
   */
  async checkBackstoryUnlock(userId, npcId, newRelationshipLevel) {
    const wasUnlocked = await npcBackstoryEngine.checkAndUnlockBackstory(
      userId,
      npcId,
      newRelationshipLevel,
    );

    if (wasUnlocked) {
      const backstory = npcBackstoryEngine.getBackstory(npcId, newRelationshipLevel);
      if (backstory) {
        return {
          type: "backstory_unlocked",
          title: backstory.title,
          npcId,
          level: newRelationshipLevel,
        };
      }
    }

    return null;
  }

  /**
   * Get contextual dialog berdasarkan NPC schedule
   */
  getContextualDialog(npcId, hour) {
    return npcScheduleEngine.getContextualDialog(npcId, hour);
  }

  /**
   * Get NPC current state untuk display di interaction
   */
  getNpcCurrentState(npcId, hour) {
    return npcScheduleEngine.getNpcStateAtTime(npcId, hour);
  }

  /**
   * Check apakah ada story event yang triggered oleh lokasi/waktu
   */
  async checkLocationStoryEvent(userId, location, hour) {
    const progress = await storyEngine.getUserStoryProgress(userId);

    // Town square night event
    if (location === "town_square" && hour >= 20 && hour < 23) {
      const eventKey = "town_square_night_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "warung_evening",
            speakerName: "Narrator",
            title: "Malam di Alun-Alun",
            dialogText: "Alun-alun kota terasa berbeda di malam hari. Lentera-lentera temaram menciptakan suasana magis.\n\nKamu mendengar alunan musik sayup-sayup dari panggung kecil di sudut alun-alun. Seorang musisi tua memainkan melodi yang entah mengapa terasa familiar...",
            choices: [
              { label: "Mendengarkan sampai selesai", value: "listen", effect: { flag: "heard_melody" } },
              { label: "Pergi sebelum lagu berakhir", value: "leave_early", effect: {} },
            ],
          },
        };
      }
    }

    // Kebun pagi event
    if (location === "kebun" && hour >= 5 && hour < 8) {
      const eventKey = "kebun_dawn_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "kebun_morning",
            speakerName: "Narrator",
            title: "Embun Pagi",
            dialogText: "Embun masih menempel di kelopak bunga. Udara dingin menusuk kulit, tapi ada ketenangan yang tidak bisa dijelaskan.\n\nDi kejauhan, kamu melihat siluet seseorang yang sedang merawat tanaman dengan penuh kasih. Mereka belum menyadari kehadiranmu.",
            choices: [
              { label: "Mengamati dari jauh", value: "observe", effect: { flag: "observed_gardener" } },
              { label: "Menyapa dengan pelan", value: "greet_gently", effect: { flag: "greeted_gardener" } },
            ],
          },
        };
      }
    }

    // Sungai sore event
    if (location === "sungai" && hour >= 17 && hour < 19) {
      const eventKey = "sungai_sunset_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "sungai_evening",
            speakerName: "Narrator",
            title: "Refleksi Senja",
            dialogText: "Permukaan sungai memantulkan warna langit senja seperti cermin raksasa. Suara air mengalir menenangkan pikiran.\n\nKamu duduk di batu besar dan merenung. Perjalananmu di Naura Wilds sudah sejauh ini... apa yang kau cari sebenarnya?",
            choices: [
              { label: "Petualangan dan kekuatan", value: "adventure", effect: { flag: "seeks_adventure" } },
              { label: "Koneksi dengan orang lain", value: "connection", effect: { flag: "seeks_connection" } },
              { label: "Jawaban atas misteri", value: "mystery", effect: { flag: "seeks_truth" } },
            ],
          },
        };
      }
    }

    // Sekolah siang event
    if (location === "sekolah" && hour >= 12 && hour < 14) {
      const eventKey = "sekolah_lunch_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "sekolah_afternoon",
            speakerName: "Narrator",
            title: "Jam Istirahat",
            dialogText: "Sekolah sepi saat jam istirahat. Anak-anak bermain di halaman, tertawa riang.\n\nDi pojok kelas, kamu melihat coretan-coretan di meja kayu tua. Nama-nama, gambar hati, dan mimpi-mimpi kecil yang pernah ditorehkan generasi sebelummu.",
            choices: [
              { label: "Menambahkan namamu di meja itu", value: "leave_mark", effect: { flag: "left_school_mark" } },
              { label: "Tersenyum dan pergi", value: "smile_leave", effect: {} },
            ],
          },
        };
      }
    }

    // Cafe malam event
    if (location === "cafe" && hour >= 20 && hour < 23) {
      const eventKey = "cafe_night_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "cafe_night",
            speakerName: "Narrator",
            title: "Cafe Malam",
            dialogText: "Cafe hampir kosong. Hanya ada satu lilin yang menyala di mejamu dan alunan jazz pelan dari speaker tua.\n\nBarista menuangkan kopi tanpa diminta. Katanya, 'Untuk teman malam.' Kopi ini rasanya berbeda... lebih hangat dari biasanya.",
            choices: [
              { label: "Menikmati keheningan", value: "silence", effect: { flag: "cafe_solitude" } },
              { label: "Mengajak barista mengobrol", value: "chat_barista", effect: { flag: "befriended_barista" } },
            ],
          },
        };
      }
    }

    // ═══ KHUL'KHAS EVENTS ═══
    if (location === "hutan_belantara" && hour >= 5 && hour < 8) {
      const eventKey = "khulkhas_dawn_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "kebun_morning",
            speakerName: "Narrator",
            title: "Kabut Khul'Khas",
            dialogText: "Kabut tebal menyelimuti hutan Khul'Khas di pagi hari. Suara lonceng kuil terdengar sayup-sayup dari kejauhan.\n\nDi antara kabut, kau melihat siluet seorang biksu yang sedang berjalan tanpa alas kaki. Jejak kakinya meninggalkan kristal es kecil di tanah.",
            choices: [
              { label: "Mengikuti jejaknya", value: "follow", effect: { flag: "followed_monk" } },
              { label: "Menunggu sampai kabut menipis", value: "wait", effect: { flag: "patient_traveler" } },
            ],
          },
        };
      }
    }

    // ═══ HUTAN DHA MHAI EVENTS ═══
    if (location === "hutan_belantara" && hour >= 17 && hour < 20) {
      const eventKey = "dha_mhai_twilight_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "kebun_afternoon",
            speakerName: "Narrator",
            title: "Senja di Hutan Purba",
            dialogText: "Cahaya matahari menembus kanopi hutan menciptakan pilar-pilar cahaya emas. Kunang-kunang mulai bermunculan.\n\nSeekor rusa putih langka melintas di hadapanmu, berhenti sejenak, lalu menghilang ke dalam semak. Konon, melihat rusa putih adalah pertanda keberuntungan.",
            choices: [
              { label: "Berharap keberuntungan", value: "wish", effect: { flag: "white_deer_blessing" } },
              { label: "Mencatat momen ini", value: "record", effect: { flag: "forest_journal" } },
            ],
          },
        };
      }
    }

    // ═══ DESA LAUH THAN EVENTS ═══
    if (location === "sungai" && hour >= 20 && hour < 23) {
      const eventKey = "lauh_than_night_sea_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "sungai_evening",
            speakerName: "Narrator",
            title: "Nyanyian Laut Malam",
            dialogText: "Ombak memecah pelan di dermaga tua. Cahaya bulan memantul di permukaan air seperti perak cair.\n\nDari kejauhan, terdengar nyanyian nelayan yang pulang melaut. Melodi sederhana namun penuh kerinduan akan rumah dan keluarga.",
            choices: [
              { label: "Ikut bernyanyi pelan", value: "sing_along", effect: { flag: "sea_song" } },
              { label: "Mendengarkan sampai selesai", value: "listen_full", effect: { flag: "sea_listener" } },
            ],
          },
        };
      }
    }

    // ═══ ISTANA DRAKEN EVENTS ═══
    if (location === "aula_utama" && hour >= 12 && hour < 18) {
      const eventKey = "draken_hall_event";
      if (!progress.flags[eventKey]) {
        await storyEngine.setStoryFlag(userId, eventKey, true);
        return {
          type: "location_event",
          scene: {
            backgroundId: "kebun_afternoon",
            speakerName: "Narrator",
            title: "Gema Aula Kosong",
            dialogText: "Aula utama istana Draken sunyi senyap. Pilar-pilar raksasa menjulang tinggi, bayanganmu terlihat kecil di lantai marmer.\n\nLangkah kakimu bergema. Di dinding, lukisan-lukisan kuno menggambarkan perang besar masa lalu. Salah satu lukisan tampak... bergerak.",
            choices: [
              { label: "Memeriksa lukisan itu lebih dekat", value: "investigate", effect: { flag: "draken_painting" } },
              { label: "Pergi sebelum hal aneh terjadi", value: "retreat", effect: {} },
            ],
          },
        };
      }
    }

    return null;
  }

  /**
   * Process story choice dan apply effects
   */
  async processChoice(userId, choicePointId, choiceValue, effects, npcId) {
    // Record choice
    await storyEngine.recordChoice(userId, choicePointId, choiceValue);

    // Apply effects
    if (effects) {
      // Apply affection change to NPC
      if (effects.affection && npcId) {
        const UserNPC = require("../../models/UserNPC");
        const npcData = await UserNPC.findOne({ where: { userId, npcId } });
        
        if (npcData) {
          const newAffection = Math.max(0, Math.min(100, npcData.affection + effects.affection));
          npcData.affection = newAffection;
          
          const npcConfig = require("../data/npcs");
          const npc = npcConfig[npcId];
          if (npc) {
            const oldLevel = npcData.relationshipLevel || 0;
            let newLevel = 0;
            if (newAffection >= 90) newLevel = 3;
            else if (newAffection >= 60) newLevel = 2;
            else if (newAffection >= 30) newLevel = 1;
            
            npcData.relationshipLevel = newLevel;
            
            if (newLevel > oldLevel) {
              await npcBackstoryEngine.checkAndUnlockBackstory(userId, npcId, newLevel);
            }
          }
          
          await npcData.save({ fields: ["affection", "relationshipLevel"] });
        }
      }

      if (effects.flag) {
        await storyEngine.setStoryFlag(userId, effects.flag, true);
      }

      if (effects.nextScene) {
        await storyEngine.updateUserStoryProgress(userId, {
          currentScene: effects.nextScene,
        });
      }
    }
  }

  /**
   * Render VN scene sebagai Discord message
   */
  async renderStoryScene(sceneData) {
    return await visualNovelRenderer.renderScene(sceneData);
  }

  /**
   * Integrate story elements ke NPC greeting response
   */
  async enhanceGreetingWithStory(userId, npcId, baseGreeting, hour) {
    const enhancements = [];

    // Check first encounter
    const firstEncounter = await this.checkFirstEncounter(userId, npcId);
    if (firstEncounter) {
      return {
        type: "vn_scene",
        data: firstEncounter.scene,
      };
    }

    // Get contextual dialog dari schedule
    const contextualDialog = this.getContextualDialog(npcId, hour);
    if (contextualDialog) {
      enhancements.push({
        type: "contextual",
        text: contextualDialog,
      });
    }

    // Get NPC current appearance description
    const npcState = this.getNpcCurrentState(npcId, hour);
    if (npcState.appearanceDescription) {
      enhancements.push({
        type: "appearance",
        text: `*${npcState.appearanceDescription}*`,
      });
    }

    if (enhancements.length > 0) {
      return {
        type: "enhanced_greeting",
        baseGreeting,
        enhancements,
      };
    }

    return {
      type: "standard",
      greeting: baseGreeting,
    };
  }

  /**
   * Check story progression setelah aktivitas survival tertentu
   */
  async checkActivityStoryTrigger(userId, activityType, context = {}) {
    const progress = await storyEngine.getUserStoryProgress(userId);

    // Example triggers:
    
    // Setelah work pertama kali
    if (activityType === "work_first_time") {
      if (!progress.flags.worked_before) {
        await storyEngine.setStoryFlag(userId, "worked_before", true);
        return {
          type: "story_notification",
          message: "Kamu merasakan kepuasan setelah bekerja keras. Mungkin ini awal dari perjalanan barumu...",
        };
      }
    }

    // Setelah membantu NPC tertentu
    if (activityType === "help_npc" && context.npcId) {
      const helpKey = `helped_${context.npcId}`;
      if (!progress.flags[helpKey]) {
        await storyEngine.setStoryFlag(userId, helpKey, true);
        
        // Unlock special dialog atau backstory hint
        return {
          type: "relationship_hint",
          npcId: context.npcId,
          message: `${context.npcName} tampaknya menghargai bantuanmu. Hubungan kalian mungkin akan berkembang...`,
        };
      }
    }

    // Setelah travel ke lokasi baru
    if (activityType === "travel_new_location" && context.location) {
      const visitKey = `visited_${context.location}`;
      if (!progress.flags[visitKey]) {
        await storyEngine.setStoryFlag(userId, visitKey, true);
        
        return {
          type: "exploration_note",
          location: context.location,
          message: `Kamu menjelajahi ${context.location} untuk pertama kalinya. Ada banyak hal menarik yang menunggu untuk ditemukan...`,
        };
      }
    }

    // Setelah craft item pertama kali
    if (activityType === "craft_first") {
      if (!progress.flags.crafted_before) {
        await storyEngine.setStoryFlag(userId, "crafted_before", true);
        return {
          type: "story_notification",
          message: "Tanganmu mulai terbiasa menciptakan sesuatu dari bahan mentah. Setiap karya adalah jejak perjalananmu di Naura Wilds.",
        };
      }
    }

    // Setelah masuk dungeon pertama kali
    if (activityType === "dungeon_first") {
      if (!progress.flags.entered_dungeon) {
        await storyEngine.setStoryFlag(userId, "entered_dungeon", true);
        return {
          type: "story_notification",
          message: "Kegelapan dungeon menyambutmu. Udara dingin dan suara tetesan air menggema di lorong batu. Ini bukan sekadar petualangan... ini ujian keberanian.",
        };
      }
    }

    // Setelah mencapai level tertentu
    if (activityType === "level_up" && context.level) {
      const levelMilestoneKey = `level_milestone_${context.level}`;
      if (!progress.flags[levelMilestoneKey] && [5, 10, 20, 30, 50].includes(context.level)) {
        await storyEngine.setStoryFlag(userId, levelMilestoneKey, true);
        const messages = {
          5: "Kau mulai memahami ritme dunia ini. Langkahmu lebih yakin, matamu lebih tajam.",
          10: "Sepuluh tingkat. Kau bukan lagi pendatang baru. Warga desa mulai mengenalmu dengan nama.",
          20: "Kekuatanmu tumbuh pesat. Orang-orang mulai mempercayakan tugas-tugas penting padamu.",
          30: "Tiga puluh tingkat. Namamu dikenal hingga ke kota. Legenda kecilmu mulai terbentuk.",
          50: "Lima puluh tingkat. Kau telah menjadi legenda hidup di Naura Wilds. Dunia ini berubah karena kehadiranmu.",
        };
        return {
          type: "milestone_notification",
          level: context.level,
          message: messages[context.level] || "Kau semakin kuat.",
        };
      }
    }

    // Setelah membeli properti/rumah pertama
    if (activityType === "buy_property") {
      if (!progress.flags.owns_property) {
        await storyEngine.setStoryFlag(userId, "owns_property", true);
        return {
          type: "story_notification",
          message: "Untuk pertama kalinya, kau memiliki tempat yang bisa disebut rumah. Bukan sekadar bangunan, tapi akar yang menancap di tanah Naura Wilds.",
        };
      }
    }

    // Setelah menikah
    if (activityType === "marry_npc" && context.npcId) {
      if (!progress.flags.married) {
        await storyEngine.setStoryFlag(userId, "married", true);
        return {
          type: "story_notification",
          message: "Di bawah langit Naura Wilds, dua hati menjadi satu. Perjalananmu tidak lagi sendirian. Bersamamu, ada seseorang yang memilih untuk berjalan di sisimu selamanya.",
        };
      }
    }

    return null;
  }
}

module.exports = new StoryIntegration();
