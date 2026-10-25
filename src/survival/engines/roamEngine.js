"use strict";

const cacheManager = require("../../managers/cacheManager");
const { ROAM_LOCATIONS, DATE_TICKETS, canWorkAt } = require("../data/roamLocations");
const storyIntegration = require("../helpers/storyIntegration");
const { advanceTime } = require("../helpers/survivalTime");
const currency = require("../engines/currency");

class RoamEngine {
  constructor() {
    this.LOCATION_EVENT_CHANCE = 0.05;
    this.FIRST_MEET_PRIORITY = 1;
    this.RELATIONSHIP_EVENT_PRIORITY = 2;
    this.LOCATION_EVENT_PRIORITY = 3;
    this.RANDOM_FLAVOR_PRIORITY = 4;
  }

  getAreaData(areaId) {
    return ROAM_LOCATIONS[areaId] || null;
  }

  getLocationData(areaId, locationId) {
    const area = this.getAreaData(areaId);
    if (!area) return null;
    return area.locations[locationId] || null;
  }

  getAvailableLocations(areaId) {
    const area = this.getAreaData(areaId);
    if (!area) return [];
    
    return Object.values(area.locations).map(loc => ({
      id: loc.id,
      name: loc.name,
      type: loc.type,
      description: loc.description,
    }));
  }

  async executeRoam(userId, areaId, locationId) {
    const survival = await cacheManager.getUserSurvival(userId);
    if (!survival) {
      return { success: false, error: "Survival data not found" };
    }

    const location = this.getLocationData(areaId, locationId);
    if (!location) {
      return { success: false, error: "Location not found" };
    }

    // Time cost: 1-5 minutes in-game
    const timeCost = Math.floor(Math.random() * 5) + 1;
    const staminaCost = Math.floor(Math.random() * 4) + 2;

    // Check stamina
    if (survival.stamina < staminaCost) {
      return { 
        success: false, 
        error: "Stamina tidak cukup untuk menjelajah." 
      };
    }

    // Deduct stamina
    await cacheManager.updateUserSurvival(userId, {
      stamina: survival.stamina - staminaCost,
    });

    // Advance time
    await advanceTime(userId, timeCost / 60);

    // Check for events (priority order)
    const eventResult = await this.checkEvents(userId, areaId, locationId, survival);

    // Build result
    return {
      success: true,
      location,
      timeCost,
      staminaCost,
      event: eventResult,
      areaCurrency: ROAM_LOCATIONS[areaId].currency,
    };
  }

  async checkEvents(userId, areaId, locationId, survival) {
    const location = this.getLocationData(areaId, locationId);
    const hour = survival.inGameHour || 8;

    // Priority 1: First Meet Event
    if (location.npcSpawn && location.npcSpawn.length > 0) {
      for (const npcId of location.npcSpawn) {
        const firstMeet = await storyIntegration.checkFirstEncounter(userId, npcId);
        if (firstMeet && (firstMeet.type === "first_encounter" || firstMeet.type === "vn_scene")) {
          return {
            type: "first_meet",
            npcId,
            scene: firstMeet.scene,
          };
        }
      }
    }

    // Priority 2: Relationship Event
    const relationshipEvent = await this.checkRelationshipEvent(userId, areaId, locationId, hour);
    if (relationshipEvent) {
      return relationshipEvent;
    }

    // Priority 3: Location Event (time-limited task)
    if (Math.random() < this.LOCATION_EVENT_CHANCE) {
      const locationEvent = await this.generateLocationEvent(areaId, locationId, hour);
      if (locationEvent) {
        return locationEvent;
      }
    }

    // Priority 4: Random flavor text or item find
    return await this.generateRandomFlavor(areaId, locationId, hour);
  }

  async checkRelationshipEvent(userId, areaId, locationId, hour) {
    const location = this.getLocationData(areaId, locationId);
    if (!location.npcSpawn || location.npcSpawn.length === 0) return null;

    const UserNPC = require("../../models/UserNPC");
    
    for (const npcId of location.npcSpawn) {
      const npcData = await UserNPC.findOne({ where: { userId, npcId } });
      if (!npcData) continue;

      // Check if relationship level triggers an event
      const eventKey = `rel_event_${npcId}_lvl${npcData.relationshipLevel}`;
      const storyProgress = await storyIntegration.getUserStoryProgress(userId);
      
      if (storyProgress.flags[eventKey]) continue; // Already triggered

      // Example: Level 2 event at specific location and time
      if (npcData.relationshipLevel >= 2 && hour >= 17 && hour < 20) {
        await storyIntegration.setStoryFlag(userId, eventKey, true);
        
        return {
          type: "relationship",
          npcId,
          level: npcData.relationshipLevel,
          scene: this.generateRelationshipScene(npcId, npcData.relationshipLevel, locationId),
        };
      }
    }

    return null;
  }

  generateRelationshipScene(npcId, level, locationId) {
    const scenes = {
      ningsih: {
        1: {
          characterId: "ningsih",
          characterEmotion: "happy",
          backgroundId: "kebun_morning",
          speakerName: "Ningsih",
          title: "Bunga Untukmu",
          dialogText: "*Ningsih berlari kecil menghampirimu dengan tangan di belakang punggung.*\n\nHehe... ini untukmu!\n\n*Ia menyodorkan setangkai bunga lavender*\n\nKamu sering mampir ke kebun, jadi... aku pikir kamu mungkin suka bunga juga.",
          choices: [
            { label: "\"Terima kasih, Ningsih! Ini indah.\"", value: "grateful", effect: { affection: 5 } },
            { label: "*Menerima dengan senyum*", value: "warm_accept", effect: { affection: 3 } },
          ],
        },
        2: {
          characterId: "ningsih",
          characterEmotion: "shy",
          backgroundId: "kebun_afternoon",
          speakerName: "Ningsih",
          title: "Sore di Kebun",
          dialogText: "*Ningsih duduk di bangku kayu tua, memandang matahari terbenam di antara deretan bunga.*\n\nOh... kamu juga suka melihat sore dari sini?\n\n*Pipinya merona*\n\nAku sering ke sini sendirian. Tapi... rasanya berbeda kalau ada yang menemani. Lebih... hangat.",
          choices: [
            { label: "\"Aku senang bisa menemanimu.\"", value: "warm", effect: { affection: 5 } },
            { label: "\"Bunganya memang indah di sore hari.\"", value: "neutral", effect: { affection: 2 } },
            { label: "*Duduk di sampingnya tanpa kata*", value: "silent_comfort", effect: { affection: 4 } },
          ],
        },
        3: {
          characterId: "ningsih",
          characterEmotion: "evening",
          backgroundId: "kebun_afternoon",
          speakerName: "Ningsih",
          title: "Pengakuan di Senja",
          dialogText: "*Cahaya senja menerangi wajah Ningsih yang tampak gelisah. Ia menggenggam tangannya sendiri.*\n\nAku... aku mau bilang sesuatu.\n\n*Suara bergetar*\n\nSejak kamu datang ke desa ini... duniaku terasa lebih berwarna. Aku tidak tahu harus bagaimana, tapi... aku ingin kamu tahu.",
          choices: [
            { label: "\"Aku juga merasakan hal yang sama.\"", value: "reciprocate", effect: { affection: 8 } },
            { label: "*Menggenggam tangannya*", value: "hold_hand", effect: { affection: 6 } },
            { label: "\"Ningsih...\"", value: "speechless", effect: { affection: 4 } },
          ],
        },
      },
      tari: {
        1: {
          characterId: "tari",
          characterEmotion: "happy",
          backgroundId: "sungai_morning",
          speakerName: "Tari",
          title: "Hasil Tangkapan",
          dialogText: "*Tari mengangkat ikan besar dengan bangga, air memercik dari tubuhnya.*\n\nLihat nih! Dapat gede banget kan!\n\n*Ia menyeringai*\n\nNanti malam kita bakar bareng ya? Aku masakin spesial buat kamu!",
          choices: [
            { label: "\"Wah, mantap! Aku tunggu ya!\"", value: "excited", effect: { affection: 5 } },
            { label: "\"Kamu jago banget mancingnya!\"", value: "praise", effect: { affection: 4 } },
          ],
        },
        2: {
          characterId: "tari",
          characterEmotion: "casual",
          backgroundId: "sungai_evening",
          speakerName: "Tari",
          title: "Sunset Berdua",
          dialogText: "*Tari duduk di batu besar tepi sungai, kakinya menjuntai ke air. Langit berubah jingga.*\n\nHei. Pas banget kamu datang.\n\n*Ia menepuk batu di sebelahnya*\n\nDuduk dong. Sunset hari ini gila banget kan? Jarang-jarang aku ajak orang lihat ini...",
          choices: [
            { label: "*Duduk di sampingnya*", value: "sit_beside", effect: { affection: 5 } },
            { label: "\"Indah sekali... bersamamu.\"", value: "romantic_hint", effect: { affection: 6 } },
            { label: "\"Boleh juga.\"", value: "casual", effect: { affection: 2 } },
          ],
        },
        3: {
          characterId: "tari",
          characterEmotion: "swimming",
          backgroundId: "sungai_evening",
          speakerName: "Tari",
          title: "Di Bawah Bintang",
          dialogText: "*Malam telah tiba. Tari berbaring di rumput tepi sungai, menatap langit bertabur bintang.*\n\nKamu tahu... dulu aku selalu merasa kuat sendirian. Tapi belakangan...\n\n*Ia tersenyum tipis*\n\nAku sadar, kuat itu bukan berarti nggak butuh siapa-siapa. Terima kasih sudah jadi alasanku untuk istirahat sejenak.",
          choices: [
            { label: "*Berbaring di sampingnya*", value: "lie_beside", effect: { affection: 8 } },
            { label: "\"Kamu boleh bersandar padaku kapan saja.\"", value: "promise", effect: { affection: 7 } },
            { label: "\"Bintangnya cantik malam ini.\"", value: "deflect", effect: { affection: 3 } },
          ],
        },
      },
      bidan_sari: {
        2: {
          characterId: "bidan_sari",
          characterEmotion: "concerned",
          backgroundId: "warung_evening",
          speakerName: "Bidan Sari",
          title: "Perhatian Tersembunyi",
          dialogText: "*Bidan Sari menahanmu saat kau hendak pergi.*\n\nTunggu sebentar, nak.\n\n*Ia memeriksa tanganmu yang lecet*\n\nKamu terlalu keras pada dirimu sendiri. Istirahat juga penting, tahu? ...Aku khawatir padamu.",
          choices: [
            { label: "\"Terima kasih, Bu Sari...\"", value: "touched", effect: { affection: 5 } },
            { label: "\"Bu Sari perhatian sekali.\"", value: "appreciate", effect: { affection: 4 } },
          ],
        },
        3: {
          characterId: "bidan_sari",
          characterEmotion: "evening",
          backgroundId: "cafe_night",
          speakerName: "Bidan Sari",
          title: "Di Luar Seragam",
          dialogText: "*Untuk pertama kalinya, kau melihat Sari tanpa seragam perawat. Gaun sederhana, rambut terurai, dan senyum yang berbeda.*\n\nKaget ya melihatku begini?\n\n*Tertawa pelan*\n\nDi luar klinik... aku cuma wanita biasa yang juga ingin ditemani. Terima kasih sudah menganggapku lebih dari sekadar perawat.",
          choices: [
            { label: "\"Bu Sari cantik bagaimanapun.\"", value: "compliment", effect: { affection: 7 } },
            { label: "\"Aku senang mengenal sisi ini.\"", value: "genuine", effect: { affection: 6 } },
          ],
        },
      },
      bu_ratna: {
        2: {
          characterId: "bu_ratna",
          characterEmotion: "reading",
          backgroundId: "perpustakaan_evening",
          speakerName: "Bu Ratna",
          title: "Membaca Bersama",
          dialogText: "*Bu Ratna mendongak dari bukunya saat kau masuk perpustakaan yang hampir kosong.*\n\nOh, kamu juga suka membaca di jam segini?\n\n*Ia menutup bukunya dan tersenyum*\n\nJarang ada yang mengerti ketenangan perpustakaan di sore hari. Duduklah... boleh di sini kalau mau.",
          choices: [
            { label: "*Duduk di meja seberangnya*", value: "sit_nearby", effect: { affection: 5 } },
            { label: "\"Buku apa yang Ibu baca?\"", value: "curious", effect: { affection: 4 } },
          ],
        },
        3: {
          characterId: "bu_ratna",
          characterEmotion: "casual",
          backgroundId: "perpustakaan_evening",
          speakerName: "Bu Ratna",
          title: "Halaman Terakhir",
          dialogText: "*Ratna menutup buku tebalnya dan menghela napas panjang. Matanya berkaca-kaca.*\n\nMaaf... ceritanya menyentuh sekali.\n\n*Ia tersenyum malu*\n\nKadang aku iri pada tokoh dalam novel. Mereka punya seseorang yang selalu kembali. ...Seperti kamu yang selalu kembali ke perpustakaan ini.",
          choices: [
            { label: "\"Aku kembali karena ada Ibu di sini.\"", value: "direct", effect: { affection: 8 } },
            { label: "*Menyodorkan sapu tangan*", value: "gentle", effect: { affection: 6 } },
          ],
        },
      },

      // ═══ Mbak Rini ═══
      mbak_rini: {
        1: {
          characterId: "mbak_rini",
          characterEmotion: "flirty",
          backgroundId: "cafe_afternoon",
          speakerName: "Mbak Rini",
          title: "Tawaran Bisnis",
          dialogText: "*Rini menyodorkan kartu nama mewah dengan senyum kalkulatif.*\n\nKau terlihat punya potensi. Mau jadi partner bisnis?\n\n*Matanya menilai*\n\nJangan khawatir, aku tidak menggigit... kecuali kau mengecewakan.",
          choices: [
            { label: "\"Menarik. Ceritakan lebih lanjut.\"", value: "interested", effect: { affection: 4 } },
            { label: "\"Saya perlu pikir-pikir dulu.\"", value: "cautious", effect: { affection: 2 } },
          ],
        },
        2: {
          characterId: "mbak_rini",
          characterEmotion: "casual",
          backgroundId: "cafe_night",
          speakerName: "Mbak Rini",
          title: "Di Balik Topeng",
          dialogText: "*Untuk pertama kalinya, Rini terlihat tanpa riasan tebal. Rambut terurai, pakaian sederhana. Ia memegang gelas wine sendirian.*\n\nOh. Kau melihatku begini.\n\n*Tersenyum pahit*\n\nSemua orang hanya melihat uang dan kekuasaan. Kau... berbeda. Atau aku yang terlalu paranoid?",
          choices: [
            { label: "\"Kau lebih dari sekadar bisnis, Rini.\"", value: "see_through", effect: { affection: 7 } },
            { label: "*Duduk di sampingnya tanpa kata*", value: "silent_company", effect: { affection: 5 } },
          ],
        },
        3: {
          characterId: "mbak_rini",
          characterEmotion: "evening",
          backgroundId: "cafe_night",
          speakerName: "Mbak Rini",
          title: "Harga Sebuah Kepercayaan",
          dialogText: "*Rini menatapmu lama. Tidak ada senyum kalkulatif, tidak ada topeng. Hanya wanita yang lelah berpura-pura.*\n\nAku tidak pernah mempercayai siapa pun. Dalam duniaku, kepercayaan adalah kelemahan.\n\n*Suara bergetar*\n\nTapi kau... membuatku ingin mengambil risiko itu. Apakah ini bodoh?",
          choices: [
            { label: "\"Tidak bodoh. Aku akan menjaga kepercayaanmu.\"", value: "promise", effect: { affection: 8 } },
            { label: "*Menggenggam tangannya*", value: "hold_hand", effect: { affection: 7 } },
          ],
        },
      },

      // ═══ Suster Maya ═══
      suster_maya: {
        1: {
          characterId: "suster_maya",
          characterEmotion: "caring",
          backgroundId: "cafe_afternoon",
          speakerName: "Suster Maya",
          title: "Perhatian yang Tersembunyi",
          dialogText: "*Maya memeriksa lukamu dengan tangan lembut meski wajahnya tetap galak.*\n\nKenapa tidak hati-hati?! ...Sakit?\n\n*Ia menghela napas*\n\n...Maaf. Aku cuma khawatir. Jangan bilang siapa-siapa aku bilang begitu.",
          choices: [
            { label: "\"Terima kasih, Maya. Kamu baik sebenarnya.\"", value: "see_through_tsundere", effect: { affection: 6 } },
            { label: "\"Iya iya, maaf Suster galak.\"", value: "tease", effect: { affection: 3 } },
          ],
        },
        2: {
          characterId: "suster_maya",
          characterEmotion: "embarrassed",
          backgroundId: "cafe_evening",
          speakerName: "Suster Maya",
          title: "Tanpa Seragam",
          dialogText: "*Kau bertemu Maya di luar rumah sakit. Tanpa seragam, rambut terurai, dia terlihat... berbeda. Dia panik saat melihatmu.*\n\nJ-jangan lihat! Aku... aku nggak siap!\n\n*Wajahnya merah padam*\n\n...Kau boleh duduk. Tapi jangan bilang rekan kerjaku ya!",
          choices: [
            { label: "\"Kamu cantik bagaimanapun, Maya.\"", value: "compliment", effect: { affection: 7 } },
            { label: "\"Rahasia aman bersamaku.\"", value: "reassure", effect: { affection: 5 } },
          ],
        },
        3: {
          characterId: "suster_maya",
          characterEmotion: "off_duty",
          backgroundId: "cafe_night",
          speakerName: "Suster Maya",
          title: "Kata-Kata yang Tak Terucap",
          dialogText: "*Maya menatap langit malam dari balkon rumah sakit. Saat kau mendekat, dia tidak marah.*\n\n...Duduklah.\n\n*Jeda panjang*\n\nAku selalu marah karena takut kehilangan. Setiap pasien yang pergi... rasanya seperti ditusuk. Tapi kamu... kamu membuat rasa sakit itu terasa lebih ringan.",
          choices: [
            { label: "\"Aku tidak akan pergi, Maya.\"", value: "stay", effect: { affection: 8 } },
            { label: "*Bersandar di bahunya*", value: "lean", effect: { affection: 7 } },
          ],
        },
      },

      // ═══ Laras ═══
      laras: {
        1: {
          characterId: "laras",
          characterEmotion: "listening",
          backgroundId: "cafe_afternoon",
          speakerName: "Laras",
          title: "Pendengar Setia",
          dialogText: "*Laras menuangkan teh herbal dan mendorong cangkir ke arahmu.*\n\nKau terlihat butuh cerita. Atau didengarkan.\n\n*Senyum teduh*\n\nAku pendengar yang baik. Silakan, tidak ada yang menghakimi di sini.",
          choices: [
            { label: "*Mulai bercerita tentang perjalananmu*", value: "open_up", effect: { affection: 5 } },
            { label: "\"Terima kasih, Laras.\"", value: "grateful", effect: { affection: 3 } },
          ],
        },
        2: {
          characterId: "laras",
          characterEmotion: "melancholy",
          backgroundId: "cafe_evening",
          speakerName: "Laras",
          title: "Kesedihan yang Indah",
          dialogText: "*Laras memandang hujan dari jendela kafe. Matanya berkaca-kaca namun tersenyum.*\n\nHujan mengingatkanku pada seseorang...\n\n*Menoleh padamu*\n\nMaaf. Kadang aku terlalu tenggelam dalam kenangan. Terima kasih sudah tetap datang meski aku sering melamun.",
          choices: [
            { label: "\"Kenangan itu berharga, Laras.\"", value: "validate", effect: { affection: 6 } },
            { label: "*Menemani dalam keheningan*", value: "silent_comfort", effect: { affection: 5 } },
          ],
        },
        3: {
          characterId: "laras",
          characterEmotion: "evening",
          backgroundId: "cafe_night",
          speakerName: "Laras",
          title: "Rumah yang Baru",
          dialogText: "*Laras menutup kafe lebih awal. Hanya ada kalian berdua di bawah cahaya lilin.*\n\nKafe ini selalu jadi tempat orang singgah. Tidak pernah menetap.\n\n*Menatapmu dalam*\n\nTapi kamu... kamu membuatku ingin berhenti menjadi tempat singgah. Dan mulai menjadi rumah.",
          choices: [
            { label: "\"Aku ingin menjadi rumahmu juga.\"", value: "reciprocate", effect: { affection: 8 } },
            { label: "*Tersenyum dan menggenggam tangannya*", value: "warm_gesture", effect: { affection: 7 } },
          ],
        },
      },

      // ═══ Wulan ═══
      wulan: {
        1: {
          characterId: "wulan",
          characterEmotion: "passionate",
          backgroundId: "perpustakaan_afternoon",
          speakerName: "Wulan",
          title: "Dunia Buku",
          dialogText: "*Wulan berbicara cepat tentang novel favoritnya, matanya berbinar di balik kacamata bulat. Semua kegugupannya hilang saat membahas buku.*\n\n...dan itulah kenapa karakter utamanya begitu kompleks! Oh maaf, aku terlalu excited...\n\n*Tersipu*\n\nJarang ada yang mau mendengarkan...",
          choices: [
            { label: "\"Jangan berhenti! Aku suka mendengarmu.\"", value: "encourage", effect: { affection: 6 } },
            { label: "\"Pinjamkan bukunya dong!\"", value: "share_interest", effect: { affection: 5 } },
          ],
        },
        2: {
          characterId: "wulan",
          characterEmotion: "shy",
          backgroundId: "perpustakaan_evening",
          speakerName: "Wulan",
          title: "Surat di Dalam Buku",
          dialogText: "*Wulan menyodorkan buku tua dengan tangan gemetar. Di dalamnya terselip surat tulisan tangan.*\n\nA-aku menulis ini... untukmu. Bukan puisi atau apa, cuma... perasaan yang tidak bisa kuucapkan langsung.\n\n*Wajah merah padam*\n\nB-baca nanti saja ya! Jangan sekarang!",
          choices: [
            { label: "*Menerima dengan lembut*", value: "gentle_accept", effect: { affection: 7 } },
            { label: "\"Terima kasih, Wulan. Ini berarti banyak.\"", value: "appreciate", effect: { affection: 6 } },
          ],
        },
        3: {
          characterId: "wulan",
          characterEmotion: "happy",
          backgroundId: "perpustakaan_evening",
          speakerName: "Wulan",
          title: "Halaman Baru",
          dialogText: "*Wulan duduk di lantai perpustakaan, dikelilingi buku-buku. Untuk pertama kalinya, dia tersenyum tanpa gugup.*\n\nKamu tahu... buku favoritku selalu tentang seseorang yang menemukan rumahnya.\n\n*Menatapmu*\n\nAku pikir... aku sudah menemukannya.",
          choices: [
            { label: "\"Aku juga menemukan rumahku.\"", value: "mutual", effect: { affection: 8 } },
            { label: "*Duduk di sampingnya di lantai*", value: "sit_floor", effect: { affection: 7 } },
          ],
        },
      },

      // ═══ Elsa Frost ═══
      elsa_frost: {
        2: {
          characterId: "elsa_frost",
          characterEmotion: "gentle",
          backgroundId: "kebun_morning",
          speakerName: "Elsa Frost",
          title: "Kehangatan di Tengah Es",
          dialogText: "*Elsa memegang kristal es kecil di telapak tangannya. Kristal itu perlahan mencair.*\n\nEs selalu meleleh saat disentuh. Tapi kau...\n\n*Menatapmu dengan tatapan yang sedikit lebih hangat*\n\nKau membuat es ini bertahan lebih lama. Aneh.",
          choices: [
            { label: "\"Mungkin karena hatiku juga dingin.\"", value: "humor", effect: { affection: 5 } },
            { label: "*Menyentuh tangannya dengan lembut*", value: "touch", effect: { affection: 6 } },
          ],
        },
        3: {
          characterId: "elsa_frost",
          characterEmotion: "warm",
          backgroundId: "kebun_afternoon",
          speakerName: "Elsa Frost",
          title: "Musim Semi Pertama",
          dialogText: "*Untuk pertama kalinya, bunga mekar di sekitar Elsa. Salju mencair, rumput hijau muncul.*\n\nIni... belum pernah terjadi.\n\n*Air mata membeku di pipinya*\n\nSelama ini aku hanya mengenal musim dingin. Tapi bersamamu... aku merasakan sesuatu yang hangat. Apakah ini... musim semi?",
          choices: [
            { label: "\"Ya, Elsa. Ini musim semimu.\"", value: "affirm", effect: { affection: 8 } },
            { label: "*Memeluknya*", value: "embrace", effect: { affection: 9 } },
          ],
        },
      },

      // ═══ Fatimah ═══
      fatimah_salju: {
        2: {
          characterId: "fatimah",
          characterEmotion: "happy",
          backgroundId: "warung_evening",
          speakerName: "Fatimah",
          title: "Cerita Padang Pasir",
          dialogText: "*Fatimah menuangkan teh mint sambil bercerita tentang kehidupan nomaden di padang pasir.*\n\n...dan begitulah nenek moyangku menemukan oasis ini.\n\n*Tersenyum hangat*\n\nKau pendengar yang baik. Sudah lama aku tidak bercerita sepanjang ini.",
          choices: [
            { label: "\"Ceritamu indah, Fatimah.\"", value: "appreciate", effect: { affection: 5 } },
            { label: "\"Ajari aku tradisi desamu.\"", value: "learn", effect: { affection: 6 } },
          ],
        },
        3: {
          characterId: "fatimah",
          characterEmotion: "evening",
          backgroundId: "warung_evening",
          speakerName: "Fatimah",
          title: "Oasis Hati",
          dialogText: "*Di bawah langit berbintang Khul'Khas, Fatimah menyanyikan lagu tradisional padang pasir. Suaranya lembut seperti angin gurun.*\n\nLagu ini biasanya dinyanyikan untuk seseorang yang dicintai...\n\n*Tersenyum malu*\n\nMaaf. Tradisi kami mengatakan, jika kau menyanyikannya untuk seseorang, hatimu sudah memilih.",
          choices: [
            { label: "\"Aku merasa terhormat, Fatimah.\"", value: "honored", effect: { affection: 8 } },
            { label: "*Bernyanyi bersamanya*", value: "sing_together", effect: { affection: 9 } },
          ],
        },
      },

      // ═══ Shino Hoshino ═══
      shino_hoshino: {
        2: {
          characterId: "shino_hoshino",
          characterEmotion: "mischievous",
          backgroundId: "cafe_afternoon",
          speakerName: "Shino Hoshino",
          title: "Prank Master",
          dialogText: "*Shino menyembunyikan sesuatu di belakang punggungnya dengan senyum licik.*\n\nHehe~ tutup matamu!\n\n*Saat kau membuka mata, ada cupcake dengan tulisan namamu*\n\nSurprise! Bikin sendiri loh~ Enak kan? Bilang enak!",
          choices: [
            { label: "\"ENAK BANGET! Makasih Shino!\"", value: "enthusiastic", effect: { affection: 6 } },
            { label: "\"Kamu memang penuh kejutan ya.\"", value: "amused", effect: { affection: 5 } },
          ],
        },
        3: {
          characterId: "shino_hoshino",
          characterEmotion: "affectionate",
          backgroundId: "cafe_night",
          speakerName: "Shino Hoshino",
          title: "Bukan Lagi Bercanda",
          dialogText: "*Shino duduk di depanmu tanpa senyum ceria biasanya. Matanya serius untuk pertama kalinya.*\n\nAku selalu bercanda karena takut. Takut kalau orang tahu aku yang asli... mereka tidak akan suka.\n\n*Menatapmu*\n\nTapi kamu... kamu sudah melihat semua sisiku. Dan masih di sini. Itu... berarti banyak buatku.",
          choices: [
            { label: "\"Aku suka semua sisi Shino.\"", value: "accept_all", effect: { affection: 8 } },
            { label: "*Mengusap kepalanya*", value: "headpat", effect: { affection: 7 } },
          ],
        },
      },
    };

    return scenes[npcId]?.[level] || {
      characterId: npcId,
      characterEmotion: "happy",
      backgroundId: locationId,
      speakerName: "NPC",
      title: "Momen Spesial",
      dialogText: "Senang bertemu denganmu di sini. Rasanya berbeda dari biasanya...",
      choices: [
        { label: "Ngobrol sebentar", value: "chat", effect: { affection: 2 } },
        { label: "Pamit", value: "leave", effect: {} },
      ],
    };
  }

  async generateLocationEvent(areaId, locationId, hour) {
    const areaName = ROAM_LOCATIONS[areaId]?.name || areaId;
    const locData = this.getLocationData(areaId, locationId);
    const locName = locData?.name || locationId;

    // Time-specific events
    const isMorning = hour >= 5 && hour < 12;
    const isAfternoon = hour >= 12 && hour < 17;
    const isEvening = hour >= 17 && hour < 21;
    const isNight = hour >= 21 || hour < 5;

    const eventPool = [];

    // Universal events
    eventPool.push({
      type: "item_find",
      title: "Penemuan Kecil",
      description: `Saat menjelajahi ${locName}, kamu menemukan sesuatu yang menarik di sudut ruangan.`,
      reward: { itemId: "herb_common", amount: 1 },
    });

    eventPool.push({
      type: "mini_challenge",
      title: "Bantuan Singkat",
      description: `Seorang warga di ${locName} meminta bantuanmu mengangkat barang sebentar. Tidak berat, tapi mereka sangat berterima kasih.`,
      task: "help_carry",
      reward: { currency: ROAM_LOCATIONS[areaId].currency, amount: 20 },
    });

    // Morning events
    if (isMorning) {
      eventPool.push({
        type: "morning_encounter",
        title: "Pagi yang Tenang",
        description: `Udara pagi di ${locName} terasa segar. Kamu melihat seorang anak kecil sedang bermain sendirian. Ia melambai padamu dengan senyum polos.`,
        reward: { itemId: "pebble", amount: 1 },
      });
    }

    // Afternoon events
    if (isAfternoon) {
      eventPool.push({
        type: "afternoon_bustle",
        title: "Keramaian Siang",
        description: `${locName} ramai dengan aktivitas warga. Seorang pedagang menawarkan sampel gratis makanan khas ${areaName}.`,
        reward: { stamina: 10, hunger: 15 },
      });
    }

    // Evening events
    if (isEvening) {
      eventPool.push({
        type: "evening_atmosphere",
        title: "Senja di " + locName,
        description: `Cahaya matahari terbenam menerangi ${locName} dengan warna keemasan. Suasana terasa damai dan nostalgik. Kamu berhenti sejenak untuk menikmati momennya.`,
        reward: { stamina: 5 },
      });
    }

    // Night events
    if (isNight) {
      eventPool.push({
        type: "night_mystery",
        title: "Suara di Malam Hari",
        description: `${locName} terasa berbeda di malam hari. Kamu mendengar suara aneh dari arah yang tidak biasa... tapi setelah diperiksa, hanya kucing liar yang mencari makan.`,
        reward: { itemId: "feather", amount: 1 },
      });
    }

    // Location-specific events
    if (locationId === "kebun") {
      eventPool.push({
        type: "garden_discovery",
        title: "Tanaman Langka",
        description: "Di antara deretan tanaman biasa, kamu menemukan bunga langka yang bersinar redup dalam gelap.",
        reward: { itemId: "glowing_flower", amount: 1 },
      });
    }

    if (locationId === "sungai") {
      eventPool.push({
        type: "river_find",
        title: "Kilauan di Air",
        description: "Sesuatu berkilau di dasar sungai yang dangkal. Setelah diambil, ternyata sebuah kerang indah.",
        reward: { itemId: "pretty_shell", amount: 1 },
      });
    }

    if (locationId === "sekolah") {
      eventPool.push({
        type: "school_memory",
        title: "Kenangan Sekolah",
        description: "Meja tua di pojok kelas mengingatkanku pada masa kecil. Seseorang meninggalkan catatan kecil di laci meja.",
        reward: { itemId: "old_note", amount: 1 },
      });
    }

    if (locationId === "cafe") {
      eventPool.push({
        type: "cafe_special",
        title: "Resep Spesial",
        description: "Barista memberimu secangkir minuman spesial yang tidak ada di menu. Katanya ini untuk pelanggan yang terlihat butuh semangat.",
        reward: { stamina: 20, thirst: 25 },
      });
    }

    if (locationId === "perpustakaan") {
      eventPool.push({
        type: "library_secret",
        title: "Buku Tersembunyi",
        description: "Di rak paling atas, kamu menemukan buku tua yang terselip di belakang deretan ensiklopedia. Isinya tentang legenda Naura Wilds.",
        reward: { itemId: "ancient_book", amount: 1 },
      });
    }

    // Pick random event from pool
    const event = eventPool[Math.floor(Math.random() * eventPool.length)];

    return {
      type: "location_event",
      event,
    };
  }

  async generateRandomFlavor(areaId, locationId, hour) {
    const location = this.getLocationData(areaId, locationId);
    
    const flavors = [
      `Kamu berjalan-jalan di ${location.name}. ${location.description}`,
      `Suasana ${location.name} terasa ${hour < 12 ? "segar di pagi hari" : hour < 18 ? "ramai di siang hari" : "tenang di malam hari"}.`,
      `Kamu menghabiskan waktu sejenak di ${location.name}. Tidak ada yang istimewa, tapi rasanya menyenangkan.`,
    ];

    // Small chance to find minor item
    if (Math.random() < 0.1) {
      return {
        type: "flavor_with_find",
        text: flavors[Math.floor(Math.random() * flavors.length)],
        find: { itemId: "pebble", amount: 1, message: "Kamu menemukan kerikil kecil yang menarik." },
      };
    }

    return {
      type: "flavor",
      text: flavors[Math.floor(Math.random() * flavors.length)],
    };
  }

  async executeWork(userId, areaId, locationId) {
    const location = this.getLocationData(areaId, locationId);
    if (!location || !location.workAvailable) {
      return { success: false, error: "Tidak bisa bekerja di sini." };
    }

    const survival = await cacheManager.getUserSurvival(userId);

    // Check requirements
    const userStats = {
      strength: survival.stats?.strength || 1,
      intelligence: survival.stats?.intelligence || 1,
      agility: survival.stats?.agility || 1,
      charisma: survival.stats?.charisma || 1,
      skills: survival.skills || [],
    };

    if (!canWorkAt(location, userStats)) {
      return { 
        success: false, 
        error: "Syarat fisik atau keahlian tidak terpenuhi untuk bekerja di sini." 
      };
    }

    // Execute work
    const reward = location.workReward;
    const currencyType = reward.currency;

    // Add currency
    if (currencyType === "fragment") {
      await cacheManager.incrementUserSurvival(userId, { sukamajuCoins: reward.amount });
    } else if (currencyType === "coin") {
      await cacheManager.incrementUserProfile(userId, { pratamaDollars: reward.amount });
    }

    // Add EXP
    if (reward.exp) {
      // TODO: Integrate with leveling system
    }

    return {
      success: true,
      reward: {
        currency: currencyType,
        amount: reward.amount,
        exp: reward.exp,
      },
    };
  }

  async purchaseItem(userId, areaId, locationId, itemId) {
    const location = this.getLocationData(areaId, locationId);
    if (!location || location.type !== "shop") {
      return { success: false, error: "Bukan tempat berbelanja." };
    }

    const shopItem = location.shopItems.find(item => item.itemId === itemId);
    if (!shopItem) {
      return { success: false, error: "Item tidak tersedia." };
    }

    const area = this.getAreaData(areaId);
    const currencyType = area.currency;

    // Check balance
    const survival = await cacheManager.getUserSurvival(userId);
    const profile = await cacheManager.getUserProfile(userId);
    const balance = currency.balanceOf(currencyType, { survival, profile });

    if (balance < shopItem.price) {
      return { 
        success: false, 
        error: `Saldo tidak cukup. Butuh ${shopItem.price} ${currency.emojiOf(currencyType)}` 
      };
    }

    // Deduct currency
    await currency.charge(currencyType, { survival, profile }, shopItem.price);

    // Handle ticket items - add to inventory instead of consuming
    if (shopItem.isTicket) {
      const { addItemsAtomic } = require("../engines/inventoryHelper");
      const taken = await addItemsAtomic(userId, [
        { id: itemId, amount: 1, name: shopItem.itemId },
      ]);
      
      if (!taken.ok) {
        return { success: false, error: "Gagal menambahkan tiket ke inventaris." };
      }
      
      return {
        success: true,
        item: shopItem,
        newBalance: balance - shopItem.price,
        isTicket: true,
      };
    }

    // Apply restores for consumable items
    const updates = {};
    if (shopItem.restores.stamina) {
      updates.stamina = Math.min(100, (survival.stamina || 0) + shopItem.restores.stamina);
    }
    if (shopItem.restores.hunger) {
      updates.hunger = Math.min(100, (survival.hunger || 0) + shopItem.restores.hunger);
    }
    if (shopItem.restores.thirst) {
      updates.thirst = Math.min(100, (survival.thirst || 0) + shopItem.restores.thirst);
    }

    if (Object.keys(updates).length > 0) {
      await cacheManager.updateUserSurvival(userId, updates);
    }

    return {
      success: true,
      item: shopItem,
      newBalance: balance - shopItem.price,
    };
  }

  getDateTicketForNpc(npcId) {
    return DATE_TICKETS[npcId] || null;
  }

  async canGoOnDate(userId, npcId) {
    const ticket = this.getDateTicketForNpc(npcId);
    if (!ticket) return { canDate: false, reason: "NPC tidak bisa diajak kencan." };

    const UserNPC = require("../../models/UserNPC");
    const npcData = await UserNPC.findOne({ where: { userId, npcId } });

    if (!npcData || npcData.relationshipLevel < 3) {
      return { canDate: false, reason: "Hubungan belum cukup dekat untuk berkencan." };
    }

    const npcConfig = require("../data/npcs");
    const npc = npcConfig[npcId];
    if (npc.type !== "romansa") {
      return { canDate: false, reason: "NPC ini bukan tipe romansa." };
    }

    // Check if user has ticket
    const { safeParseInventory } = require("./inventoryHelper");
    const profile = await cacheManager.getUserProfile(userId);
    const inventory = safeParseInventory(profile?.inventory);
    const hasTicket = inventory.some((item) => item && item.id === ticket.itemId && (item.amount === undefined || item.amount > 0));

    if (!hasTicket) {
      return { 
        canDate: false, 
        reason: `Butuh ${ticket.itemName}. Beli di toko ${ticket.area === "desa_sukamaju" ? "Desa Sukamaju" : "Kota Pratama"}.` 
      };
    }

    return { canDate: true, ticket };
  }
}

module.exports = new RoamEngine();
