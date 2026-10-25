// Story Script Template - Prologue Chapter
// Format ini digunakan untuk mendefinisikan scene VN

module.exports = {
  chapterId: "prologue",
  title: "Awal Perjalanan",
  scenes: {
    start: {
      id: "start",
      background: "village_entrance_morning",
      music: "peaceful_morning",
      dialog: [
        {
          speaker: "Narrator",
          text: "Pagi itu, matahari menyinari Desa Sukamaju dengan hangat. Angin sepoi-sepoi membawa aroma tanah basah dan bunga liar.",
          emotion: null,
        },
        {
          speaker: "Narrator",
          text: "Kamu melangkah masuk ke desa untuk pertama kalinya, membawa tas ransel berisi perlengkapan sederhana dan harapan baru.",
          emotion: null,
        },
        {
          speaker: "???",
          text: "Hei! Hati-hati!",
          emotion: "surprised",
          character: "ningsih",
        },
      ],
      choices: [
        {
          label: "Menoleh ke belakang",
          nextScene: "meet_ningsih_careful",
          effects: {},
        },
        {
          label: "Berhenti berjalan",
          nextScene: "meet_ningsih_stop",
          effects: {},
        },
      ],
    },

    meet_ningsih_careful: {
      id: "meet_ningsih_careful",
      background: "village_path_morning",
      music: "gentle_encounter",
      dialog: [
        {
          speaker: "Narrator",
          text: "Kamu menoleh dan melihat seorang gadis berlari kecil membawakan keranjang penuh sayuran.",
          emotion: null,
        },
        {
          speaker: "Ningsih",
          text: "Maaf, maaf! Aku hampir menabrakmu. Kamu tidak apa-apa?",
          emotion: "worried",
          character: "ningsih",
        },
        {
          speaker: "Ningsih",
          text: "Oh... kamu wajah baru ya? Aku Ningsih. Selamat datang di Desa Sukamaju!",
          emotion: "happy",
          character: "ningsih",
        },
      ],
      choices: [
        {
          label: "\"Aku baik-baik saja. Terima kasih.\"",
          nextScene: "ningsih_intro_polite",
          effects: { affection_ningsih: +2 },
        },
        {
          label: "\"Tidak apa-apa. Kamu siapa?\"",
          nextScene: "ningsih_intro_curious",
          effects: { affection_ningsih: +1 },
        },
      ],
    },

    meet_ningsih_stop: {
      id: "meet_ningsih_stop",
      background: "village_path_morning",
      music: "gentle_encounter",
      dialog: [
        {
          speaker: "Narrator",
          text: "Kamu berhenti tepat waktu. Seorang gadis dengan keranjang sayuran hampir menabrakmu.",
          emotion: null,
        },
        {
          speaker: "Ningsih",
          text: "Wah! Hampir saja! Terima kasih sudah berhenti.",
          emotion: "relieved",
          character: "ningsih",
        },
        {
          speaker: "Ningsih",
          text: "Aku Ningsih. Kamu pasti pendatang baru ya? Jarang lihat wajah asing di sini.",
          emotion: "curious",
          character: "ningsih",
        },
      ],
      choices: [
        {
          label: "\"Ya, aku baru tiba. Namaku [Player].\"",
          nextScene: "ningsih_intro_friendly",
          effects: { affection_ningsih: +3 },
        },
        {
          label: "\"Benar. Ada rekomendasi tempat tinggal?\"",
          nextScene: "ningsih_intro_practical",
          effects: { affection_ningsih: +1, flag: "asked_housing" },
        },
      ],
    },

    ningsih_intro_polite: {
      id: "ningsih_intro_polite",
      background: "village_path_morning",
      music: "friendly_talk",
      dialog: [
        {
          speaker: "Ningsih",
          text: "Sama-sama! Oh iya, kalau kamu cari Pak Kades, beliau biasanya ada di alun-alun pagi-pagi begini.",
          emotion: "helpful",
          character: "ningsih",
        },
        {
          speaker: "Ningsih",
          text: "Beliau yang mengurus pendaftaran warga baru. Bilang saja Ningsih yang menyuruh, hehe.",
          emotion: "playful",
          character: "ningsih",
        },
      ],
      nextScene: "to_kades",
      autoAdvance: true,
    },

    ningsih_intro_curious: {
      id: "ningsih_intro_curious",
      background: "village_path_morning",
      music: "friendly_talk",
      dialog: [
        {
          speaker: "Ningsih",
          text: "Aku? Aku cuma petani biasa yang suka merawat tanaman. Kebunku ada di ujung desa sana.",
          emotion: "shy",
          character: "ningsih",
        },
        {
          speaker: "Ningsih",
          text: "Kalau kamu butuh sayuran segar, mampir saja ya! Aku selalu punya stok berlebih.",
          emotion: "happy",
          character: "ningsih",
        },
      ],
      nextScene: "to_kades",
      autoAdvance: true,
    },

    ningsih_intro_friendly: {
      id: "ningsih_intro_friendly",
      background: "village_path_morning",
      music: "warm_welcome",
      dialog: [
        {
          speaker: "Ningsih",
          text: "[Player]... nama yang bagus! Senang berkenalan denganmu.",
          emotion: "blushing",
          character: "ningsih",
        },
        {
          speaker: "Ningsih",
          text: "Dengar, kalau kamu butuh bantuan apa pun, jangan sungkan cari aku ya? Aku mungkin cuma petani, tapi aku tahu banyak tentang desa ini.",
          emotion: "sincere",
          character: "ningsih",
        },
      ],
      effects: { flag: "ningsih_offered_help" },
      nextScene: "to_kades",
      autoAdvance: true,
    },

    ningsih_intro_practical: {
      id: "ningsih_intro_practical",
      background: "village_path_morning",
      music: "informative",
      dialog: [
        {
          speaker: "Ningsih",
          text: "Tempat tinggal? Hmm... ada kos-kosan murah di dekat pasar, atau kalau mau yang lebih tenang, coba cek rumah kosong di pinggir desa.",
          emotion: "thinking",
          character: "ningsih",
        },
        {
          speaker: "Ningsih",
          text: "Tapi untuk beli properti, kamu harus bicara sama Pak Kades dulu. Beliau yang urus surat-suratnya.",
          emotion: "helpful",
          character: "ningsih",
        },
      ],
      nextScene: "to_kades",
      autoAdvance: true,
    },

    to_kades: {
      id: "to_kades",
      background: "town_square_morning",
      music: "bustling_market",
      dialog: [
        {
          speaker: "Narrator",
          text: "Kamu berjalan menuju alun-alun desa. Di sana, seorang pria paruh baya dengan batik rapi sedang berbicara dengan beberapa warga.",
          emotion: null,
        },
        {
          speaker: "Narrator",
          text: "Itu pasti Pak Kades Tirto yang dimaksud Ningsih.",
          emotion: null,
        },
        {
          speaker: "Kades Tirto",
          text: "Ah, selamat pagi anak muda! Kamu pasti pendatang baru yang dimaksud Ningsih tadi.",
          emotion: "welcoming",
          character: "kades_tirto",
        },
      ],
      choices: [
        {
          label: "\"Benar, Pak. Saya ingin mendaftar jadi warga.\"",
          nextScene: "registration_formal",
          effects: { respect_kades: +2 },
        },
        {
          label: "\"Iya Pak. Ningsih bilang Bapak bisa bantu.\"",
          nextScene: "registration_mention_ningsih",
          effects: { respect_kades: +1, flag: "mentioned_ningsih_to_kades" },
        },
      ],
    },

    registration_formal: {
      id: "registration_formal",
      background: "town_square_morning",
      music: "official_business",
      dialog: [
        {
          speaker: "Kades Tirto",
          text: "Bagus, bagus! Desa kita selalu terbuka untuk orang-orang yang berniat baik.",
          emotion: "pleased",
          character: "kades_tirto",
        },
        {
          speaker: "Kades Tirto",
          text: "Ikuti saya ke kantor desa. Kita urus administrasinya dulu, lalu saya jelaskan tentang kehidupan di sini.",
          emotion: "fatherly",
          character: "kades_tirto",
        },
      ],
      nextScene: "chapter1_start",
      autoAdvance: true,
    },

    registration_mention_ningsih: {
      id: "registration_mention_ningsih",
      background: "town_square_morning",
      music: "warm_conversation",
      dialog: [
        {
          speaker: "Kades Tirto",
          text: "Haha, Ningsih memang anak baik. Dia selalu ramah pada pendatang baru.",
          emotion: "amused",
          character: "kades_tirto",
        },
        {
          speaker: "Kades Tirto",
          text: "Baiklah, mari kita urus pendaftaranmu. Nanti sore, mampir lagi ya. Saya kenalkan dengan warga-warga lain.",
          emotion: "kind",
          character: "kades_tirto",
        },
      ],
      nextScene: "chapter1_start",
      autoAdvance: true,
    },

    chapter1_start: {
      id: "chapter1_start",
      background: "office_interior",
      music: "new_beginning",
      dialog: [
        {
          speaker: "Narrator",
          text: "Setelah menyelesaikan administrasi, kamu resmi menjadi warga Desa Sukamaju.",
          emotion: null,
        },
        {
          speaker: "Narrator",
          text: "Pak Kades memberimu starter pack: sejumlah koin, peralatan dasar, dan peta desa.",
          emotion: null,
        },
        {
          speaker: "Kades Tirto",
          text: "Selamat datang, nak. Ingat, desa ini bukan sekadar tempat tinggal. Ini keluarga.",
          emotion: "wise",
          character: "kades_tirto",
        },
        {
          speaker: "System",
          text: "**PROLOGUE COMPLETE**\n\nChapter 1: Kehidupan Baru akan segera dimulai...\n\nTerima kasih telah bermain! Lanjutkan petualanganmu dengan `/survival` commands.",
          emotion: null,
        },
      ],
      onComplete: {
        markCompleted: ["prologue_start", "prologue_meet_ningsih", "prologue_registration"],
        setFlag: { completed_prologue: true },
        unlockNext: "chapter1",
      },
    },
  },
};
