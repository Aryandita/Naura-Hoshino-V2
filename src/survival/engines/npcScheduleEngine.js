"use strict";

const npcs = require("../data/npcs");

/**
 * NPC Schedule & Dynamic Appearance System
 * Mengelola lokasi, aktivitas, dan tampilan NPC berdasarkan waktu/hari
 */
class NpcScheduleEngine {
  constructor() {
    this.schedules = this.loadSchedules();
    this.appearanceVariants = this.loadAppearanceVariants();
  }

  /**
   * Load schedule data untuk semua NPC
   * Format: npcId -> { timeSlots: [{ hour, location, activity, portraitVariant }] }
   */
  loadSchedules() {
    // Default schedules - bisa di-extend dari file JSON terpisah
    return {
      ningsih: {
        timeSlots: [
          { startHour: 5, endHour: 8, location: "farm", activity: "menyiram tanaman", portraitVariant: "working" },
          { startHour: 8, endHour: 12, location: "market", activity: "menjual hasil panen", portraitVariant: "casual" },
          { startHour: 12, endHour: 14, location: "cafe", activity: "makan siang", portraitVariant: "relaxed" },
          { startHour: 14, endHour: 17, location: "farm", activity: "merawat kebun", portraitVariant: "working" },
          { startHour: 17, endHour: 19, location: "town_square", activity: "bersantai di taman", portraitVariant: "evening" },
          { startHour: 19, endHour: 22, location: "home", activity: "istirahat di rumah", portraitVariant: "home" },
          { startHour: 22, endHour: 5, location: "home", activity: "tidur", portraitVariant: "sleep" },
        ],
      },
      tari: {
        timeSlots: [
          { startHour: 4, endHour: 9, location: "sea", activity: "memancing di laut", portraitVariant: "fishing" },
          { startHour: 9, endHour: 12, location: "dock", activity: "memperbaiki perahu", portraitVariant: "working" },
          { startHour: 12, endHour: 14, location: "cafe", activity: "makan siang", portraitVariant: "casual" },
          { startHour: 14, endHour: 17, location: "beach", activity: "berenang", portraitVariant: "swimming" },
          { startHour: 17, endHour: 20, location: "town_square", activity: "nongkrong sore", portraitVariant: "evening" },
          { startHour: 20, endHour: 23, location: "tavern", activity: "bercerita di tavern", portraitVariant: "night" },
          { startHour: 23, endHour: 4, location: "home", activity: "tidur", portraitVariant: "sleep" },
        ],
      },
      bidan_sari: {
        timeSlots: [
          { startHour: 7, endHour: 12, location: "clinic", activity: "praktek pagi", portraitVariant: "uniform" },
          { startHour: 12, endHour: 13, location: "cafe", activity: "makan siang", portraitVariant: "casual" },
          { startHour: 13, endHour: 17, location: "clinic", activity: "praktek siang", portraitVariant: "uniform" },
          { startHour: 17, endHour: 19, location: "town_square", activity: "jalan sore", portraitVariant: "evening" },
          { startHour: 19, endHour: 21, location: "library", activity: "membaca jurnal medis", portraitVariant: "reading" },
          { startHour: 21, endHour: 7, location: "home", activity: "istirahat", portraitVariant: "home" },
        ],
      },
      bu_ratna: {
        timeSlots: [
          { startHour: 6, endHour: 7, location: "school", activity: "persiapan mengajar", portraitVariant: "formal" },
          { startHour: 7, endHour: 12, location: "school", activity: "mengajar murid", portraitVariant: "teaching" },
          { startHour: 12, endHour: 13, location: "cafe", activity: "makan siang", portraitVariant: "casual" },
          { startHour: 13, endHour: 15, location: "school", activity: "mengoreksi tugas", portraitVariant: "working" },
          { startHour: 15, endHour: 17, location: "library", activity: "riset materi ajar", portraitVariant: "reading" },
          { startHour: 17, endHour: 19, location: "park", activity: "membaca di taman", portraitVariant: "relaxed" },
          { startHour: 19, endHour: 6, location: "home", activity: "istirahat", portraitVariant: "home" },
        ],
      },
      bagas: {
        timeSlots: [
          { startHour: 6, endHour: 12, location: "smithy", activity: "menempa senjata", portraitVariant: "working" },
          { startHour: 12, endHour: 13, location: "cafe", activity: "makan siang", portraitVariant: "casual" },
          { startHour: 13, endHour: 18, location: "smithy", activity: "memperbaiki alat", portraitVariant: "working" },
          { startHour: 18, endHour: 20, location: "tavern", activity: "minum kopi", portraitVariant: "relaxed" },
          { startHour: 20, endHour: 6, location: "home", activity: "istirahat", portraitVariant: "home" },
        ],
      },
      kades_tirto: {
        timeSlots: [
          { startHour: 6, endHour: 8, location: "office", activity: "rapat pagi", portraitVariant: "formal" },
          { startHour: 8, endHour: 12, location: "town_square", activity: "inspeksi desa", portraitVariant: "official" },
          { startHour: 12, endHour: 13, location: "cafe", activity: "makan siang", portraitVariant: "casual" },
          { startHour: 13, endHour: 17, location: "office", activity: "urusan administrasi", portraitVariant: "working" },
          { startHour: 17, endHour: 19, location: "park", activity: "jalan sore", portraitVariant: "relaxed" },
          { startHour: 19, endHour: 6, location: "home", activity: "istirahat", portraitVariant: "home" },
        ],
      },
    };
  }

  /**
   * Load appearance variants untuk setiap NPC
   * Format: npcId -> { variantName: { portraitFile, description } }
   */
  loadAppearanceVariants() {
    return {
      ningsih: {
        working: { portraitFile: "ningsih_working.png", description: "Memakai celemek berkebun" },
        casual: { portraitFile: "ningsih_casual.png", description: "Pakaian santai" },
        relaxed: { portraitFile: "ningsih_casual.png", description: "Sedang bersantai" },
        evening: { portraitFile: "ningsih_evening.png", description: "Gaun sore" },
        home: { portraitFile: "ningsih_casual.png", description: "Pakaian rumah" },
        sleep: { portraitFile: "ningsih_evening.png", description: "Sedang tidur" },
        shy: { portraitFile: "ningsih_shy.png", description: "Tersipu malu" },
        happy: { portraitFile: "ningsih_happy.png", description: "Senyum ceria" },
      },
      tari: {
        fishing: { portraitFile: "tari_working.png", description: "Memakai topi nelayan" },
        working: { portraitFile: "tari_working.png", description: "Memperbaiki perahu" },
        casual: { portraitFile: "tari_casual.png", description: "Pakaian santai" },
        swimming: { portraitFile: "tari_swimming.png", description: "Baju renang" },
        evening: { portraitFile: "tari_casual.png", description: "Pakaian malam" },
        night: { portraitFile: "tari_casual.png", description: "Outfit tavern" },
        sleep: { portraitFile: "tari_casual.png", description: "Sedang tidur" },
        excited: { portraitFile: "tari_excited.png", description: "Semangat tinggi" },
        happy: { portraitFile: "tari_happy.png", description: "Senyum lebar" },
      },
      bidan_sari: {
        uniform: { portraitFile: "bidan_sari_working.png", description: "Seragam perawat" },
        casual: { portraitFile: "bidan_sari_casual.png", description: "Pakaian santai" },
        evening: { portraitFile: "bidan_sari_evening.png", description: "Dress sore" },
        reading: { portraitFile: "bidan_sari_concerned.png", description: "Membaca dengan kacamata" },
        home: { portraitFile: "bidan_sari_casual.png", description: "Pakaian rumah" },
        concerned: { portraitFile: "bidan_sari_concerned.png", description: "Ekspresi khawatir" },
        happy: { portraitFile: "bidan_sari_happy.png", description: "Senyum hangat" },
      },
      bu_ratna: {
        formal: { portraitFile: "bu_ratna_formal.png", description: "Blazer formal" },
        teaching: { portraitFile: "bu_ratna_teaching.png", description: "Sedang mengajar" },
        casual: { portraitFile: "bu_ratna_casual.png", description: "Pakaian santai" },
        working: { portraitFile: "bu_ratna_reading.png", description: "Di meja kerja" },
        reading: { portraitFile: "bu_ratna_reading.png", description: "Membaca buku" },
        relaxed: { portraitFile: "bu_ratna_casual.png", description: "Bersantai di taman" },
        home: { portraitFile: "bu_ratna_casual.png", description: "Pakaian rumah" },
        happy: { portraitFile: "bu_ratna_happy.png", description: "Senyum bangga" },
      },
      bagas: {
        working: { portraitFile: "bagas_working.png", description: "Memakai apron pandai besi" },
        casual: { portraitFile: "bagas_casual.png", description: "Pakaian santai" },
        relaxed: { portraitFile: "bagas_casual.png", description: "Sedang istirahat" },
        home: { portraitFile: "bagas_casual.png", description: "Pakaian rumah" },
        angry: { portraitFile: "bagas_angry.png", description: "Marah" },
        proud: { portraitFile: "bagas_proud.png", description: "Bangga dengan hasil karya" },
        happy: { portraitFile: "bagas_happy.png", description: "Senyum jarang-jarang" },
      },
      kades_tirto: {
        formal: { portraitFile: "pak_kades_tirto_official.png", description: "Batik resmi" },
        official: { portraitFile: "pak_kades_tirto_official.png", description: "Seragam kepala desa" },
        casual: { portraitFile: "pak_kades_tirto_relaxed.png", description: "Pakaian santai" },
        working: { portraitFile: "pak_kades_tirto_working.png", description: "Di meja kerja" },
        relaxed: { portraitFile: "pak_kades_tirto_relaxed.png", description: "Jalan sore" },
        home: { portraitFile: "pak_kades_tirto_relaxed.png", description: "Pakaian rumah" },
        wise: { portraitFile: "pak_kades_tirto_wise.png", description: "Memberi nasihat" },
        happy: { portraitFile: "pak_kades_tirto_happy.png", description: "Senyum kebapakan" },
      },
    };
  }

  /**
   * Dapatkan state NPC saat ini berdasarkan jam in-game
   */
  getNpcStateAtTime(npcId, hour) {
    const schedule = this.schedules[npcId];
    if (!schedule) {
      // Fallback ke default jika tidak ada schedule
      return {
        location: "unknown",
        activity: "tidak diketahui",
        portraitVariant: "neutral",
        isAvailable: false,
      };
    }

    // Cari time slot yang sesuai
    const slot = schedule.timeSlots.find((s) => {
      if (s.startHour < s.endHour) {
        return hour >= s.startHour && hour < s.endHour;
      } else {
        // Handle overnight slots (e.g., 22-5)
        return hour >= s.startHour || hour < s.endHour;
      }
    });

    if (!slot) {
      return {
        location: "unknown",
        activity: "tidak tersedia",
        portraitVariant: "neutral",
        isAvailable: false,
      };
    }

    return {
      location: slot.location,
      activity: slot.activity,
      portraitVariant: slot.portraitVariant,
      isAvailable: slot.location !== "home" && slot.activity !== "tidur",
    };
  }

  /**
   * Dapatkan portrait file untuk NPC dengan variant tertentu
   */
  getPortraitForVariant(npcId, variant) {
    const variants = this.appearanceVariants[npcId];
    if (!variants || !variants[variant]) {
      // Fallback ke base portrait dari npcs.js
      const npc = npcs[npcId];
      return npc?.image || null;
    }

    return variants[variant].portraitFile;
  }

  /**
   * Get full portrait path untuk NPC dengan variant
   */
  getPortraitPath(npcId, variant) {
    const fs = require("fs");
    const path = require("path");
    
    const portraitFile = this.getPortraitForVariant(npcId, variant);
    if (!portraitFile) return null;

    const dirs = [
      path.join(process.cwd(), "assets", "survival", "roam", "npcs", npcId),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "roam", "npcs", npcId),
      path.join(process.cwd(), "assets", "survival", "characters"),
      path.join(__dirname, "..", "..", "..", "assets", "survival", "characters"),
    ];

    for (const dir of dirs) {
      const candidate = path.join(dir, portraitFile);
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch (e) {
        // Continue
      }
    }

    return null;
  }

  /**
   * Dapatkan deskripsi penampilan NPC saat ini
   */
  getAppearanceDescription(npcId, variant) {
    const variants = this.appearanceVariants[npcId];
    if (!variants || !variants[variant]) {
      return null;
    }

    return variants[variant].description;
  }

  /**
   * Cek apakah NPC available untuk interaksi
   */
  isNpcAvailable(npcId, hour) {
    const state = this.getNpcStateAtTime(npcId, hour);
    return state.isAvailable;
  }

  /**
   * Dapatkan semua NPC yang available di lokasi tertentu pada jam tertentu
   */
  getAvailableNpcsAtLocation(location, hour) {
    const availableNpcs = [];

    for (const npcId of Object.keys(this.schedules)) {
      const state = this.getNpcStateAtTime(npcId, hour);
      if (state.location === location && state.isAvailable) {
        availableNpcs.push({
          id: npcId,
          ...npcs[npcId],
          currentState: state,
        });
      }
    }

    return availableNpcs;
  }

  /**
   * Generate dialog kontekstual berdasarkan aktivitas NPC
   */
  getContextualDialog(npcId, hour) {
    const state = this.getNpcStateAtTime(npcId, hour);
    const npc = npcs[npcId];

    if (!npc || !state.isAvailable) {
      return null;
    }

    // Template dialog berdasarkan aktivitas
    const activityDialogs = {
      "menyiram tanaman": `*${npc.name} sedang menyiram tanaman dengan teliti*\n\n"Oh, halo! Lihat, bunga-bunga ini butuh air yang cukup agar tumbuh subur."`,
      "menjual hasil panen": `*${npc.name} sedang menata sayuran segar di kios pasar*\n\n"Pagi! Mau beli sayur segar? Baru dipanen tadi subuh loh!"`,
      "memancing di laut": `*${npc.name} melempar kail ke laut dengan penuh konsentrasi*\n\n"Ssst... ikan lagi banyak nih. Mau coba mancing bareng?"`,
      "menempa senjata": `*Suara palu memukul besi terdengar ritmis*\n\n"Hah! Butuh senjata baru? Tunggu sebentar, aku selesaikan dulu pesanan ini."`,
      "praktek pagi": `*${npc.name} memeriksa peralatan medis dengan seksama*\n\n"Selamat pagi. Ada keluhan kesehatan? Jangan ragu untuk konsultasi ya."`,
      "mengajar murid": `*${npc.name} menulis rumus di papan tulis*\n\n"Perhatian semuanya! Hari ini kita belajar tentang ekosistem hutan."`,
      "inspeksi desa": `*${npc.name} berjalan mengelilingi alun-alun sambil mencatat*\n\n"Ah, kamu juga sedang berkeliling? Desa kita makin hari makin ramai ya."`,
    };

    return activityDialogs[state.activity] || 
           `*${npc.name} sedang ${state.activity}*\n\n"Halo! Senang bertemu denganmu."`;
  }
}

module.exports = new NpcScheduleEngine();
