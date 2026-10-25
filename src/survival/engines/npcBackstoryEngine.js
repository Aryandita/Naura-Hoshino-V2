"use strict";

const { logger } = require("../../managers/logger");
const storyEngine = require("./storyEngine");

/**
 * NPC Backstory & Lore System
 * Mengelola latar belakang cerita NPC yang terbuka seiring kenaikan relationship
 */
class NpcBackstoryEngine {
  constructor() {
    this.backstories = this.loadBackstories();
  }

  /**
   * Load backstory data untuk semua NPC
   * Format: npcId -> { levels: [{ level, title, content, unlockCondition }] }
   */
  loadBackstories() {
    return {
      ningsih: {
        levels: [
          {
            level: 1,
            title: "Gadis Desa yang Penyayang",
            content: `Ningsih tumbuh di keluarga petani sederhana. Sejak kecil, ia sudah terbiasa bangun sebelum subuh untuk membantu orang tuanya di sawah.

Kecintaannya pada tanaman bermula ketika neneknya mengajarkan cara merawat kebun bunga di belakang rumah. "Tanaman itu seperti manusia," kata neneknya, "mereka butuh perhatian dan kasih sayang untuk tumbuh."

Setiap pagi, kamu bisa melihatnya menyapa bunga-bunganya satu per satu, seolah mereka adalah teman-temannya.`,
            unlockCondition: "Reach Friendship Level 1",
          },
          {
            level: 2,
            title: "Mimpi di Balik Kesederhanaan",
            content: `Di balik senyum polosnya, Ningsih menyimpan mimpi besar. Ia ingin mengembangkan teknik pertanian modern yang bisa membantu para petani desa meningkatkan hasil panen tanpa merusak alam.

"Aku pernah membaca tentang hidroponik dan pertanian organik," ceritanya suatu sore. "Tapi buku-buku itu mahal, dan internet di desa kita lambat sekali."

Ia menabung sedikit demi sedikit dari hasil jual sayuran di pasar, berharap suatu hari bisa kuliah di akademi pertanian kota.`,
            unlockCondition: "Reach Friendship Level 2",
          },
          {
            level: 3,
            title: "Rahasia Hati yang Tersembunyi",
            content: `Ningsih jarang bercerita tentang perasaannya. Tapi jika kamu cukup dekat, ia akan membuka hatinya perlahan.

"Sebenarnya... aku takut," bisiknya suatu malam di bawah bintang-bintang. "Takut kalau mimpiku terlalu tinggi. Takut kalau aku gagal dan mengecewakan orang tua."

Matanya berkaca-kaca. "Tapi setiap kali kamu datang dan mendukungku, rasanya... aku jadi lebih berani. Terima kasih sudah percaya padaku."

Ini adalah momen ketika hubungan kalian berubah dari sekadar teman menjadi sesuatu yang lebih dalam.`,
            unlockCondition: "Reach Romance Level 3 (Affection 90+)",
          },
          {
            level: 4,
            title: "Janji di Bawah Pohon Sakura",
            content: `Di puncak hubungan kalian, Ningsih mengajakmu ke tempat spesial - pohon sakura tua di tepi desa yang hanya berbunga setahun sekali.

"Dulu, nenek bilang kalau dua orang yang saling mencintai berdiri di bawah pohon ini saat bunganya mekar, cinta mereka akan abadi selamanya," ucapnya dengan pipi merona.

Ia menggenggam tanganmu erat. "Aku tidak tahu apakah legenda itu benar. Tapi yang aku tahu... perasaanku padamu nyata. Dan aku ingin menghabiskan sisa hidupku bersamamu."

Ini adalah akhir dari chapter romansa Ningsih, sekaligus awal dari kehidupan baru kalian bersama.`,
            unlockCondition: "Marriage Proposal Accepted",
          },
        ],
      },
      tari: {
        levels: [
          {
            level: 1,
            title: "Anak Laut yang Bebas",
            content: `Tari lahir dan dibesarkan di pesisir. Ayahnya seorang nelayan tangguh yang mengajarkan segala hal tentang laut sejak ia masih balita.

"Laut itu guru terbaik," katanya sambil memandang cakrawala. "Dia mengajarkan kesabaran, keberanian, dan kerendahan hati."

Berbeda dengan gadis desa lainnya, Tari lebih nyaman memanjat tiang kapal daripada menjahit. Rambutnya selalu dikuncir praktis, dan kulitnya kecokelatan oleh matahari laut.`,
            unlockCondition: "Reach Friendship Level 1",
          },
          {
            level: 2,
            title: "Beban di Balik Senyum Lepas",
            content: `Meski terlihat selalu ceria, Tari memikul beban berat. Setelah ayahnya meninggal dalam badai tiga tahun lalu, ia menjadi tulang punggung keluarga.

"Ibu sakit-sakitan, dan adik-adikku masih kecil," ceritanya sambil memperbaiki jala. "Aku harus kuat. Tidak boleh menangis."

Tapi di balik topeng kekuatannya, ada kerinduan mendalam untuk memiliki seseorang yang bisa diandalkan. Seseorang yang tidak hanya menerima bantuannya, tapi juga membantunya memikul beban.`,
            unlockCondition: "Reach Friendship Level 2",
          },
          {
            level: 3,
            title: "Pengakuan di Tengah Badai",
            content: `Suatu malam, badai besar melanda desa. Tari nekat pergi ke pelabuhan sendirian untuk menyelamatkan perahu peninggalan ayahnya.

Kamu mengejarnya, menemukan dia berjuang menahan tali tambang di tengah hujan deras. Bersama-sama, kalian berhasil mengamankan perahu itu.

Basah kuyup dan kelelahan, Tari tiba-tiba memelukmu erat. "Terima kasih..." bisiknya dengan suara bergetar. "Selama ini aku selalu sendirian. Tapi sekarang... aku sadar aku tidak harus menanggung semuanya sendiri."

Malam itu, di bawah derasnya hujan, tembok pertahanannya runtuh. Dan kamu menjadi orang pertama yang melihat sisi rapuhnya.`,
            unlockCondition: "Reach Romance Level 3 (Affection 90+)",
          },
        ],
      },
      bidan_sari: {
        levels: [
          {
            level: 1,
            title: "Perawat yang Penuh Kasih",
            content: `Bidan Sari dikenal seluruh desa sebagai sosok keibuan yang selalu siap menolong. Klinik kecilnya tidak pernah sepi pasien, dari anak-anak yang jatuh hingga orang tua yang sakit kronis.

"Kesehatan itu harta paling berharga," nasihatnya lembut. "Jaga tubuhmu baik-baik, ya."

Namun di balik kelembutannya, tersimpan ketegasan yang tak tergoyahkan. Ia tidak segan memarahi pasien yang bandel atau menolak minum obat.`,
            unlockCondition: "Reach Friendship Level 1",
          },
          {
            level: 2,
            title: "Luka yang Tak Terlihat",
            content: `Sari memilih menjadi perawat karena pengalaman pribadinya. Saat remaja, ia kehilangan adiknya karena penyakit yang sebenarnya bisa dicegah.

"Aku merasa gagal," akunya suatu malam setelah menutup klinik. "Kalau saja aku lebih pintar, lebih cepat bertindak... mungkin dia masih di sini."

Trauma itu yang mendorongnya belajar tanpa henti, membaca jurnal medis hingga larut malam, dan selalu berusaha menjadi yang terbaik. Bukan untuk pujian, tapi agar tidak ada lagi keluarga yang merasakan kehilangannya.`,
            unlockCondition: "Reach Friendship Level 2",
          },
          {
            level: 3,
            title: "Cinta yang Tak Terucap",
            content: `Sari jarang membicarakan kehidupan pribadinya. Tapi jika kamu cukup dekat, kamu akan menyadari tatapan hangatnya setiap kali kamu datang ke klinik, bahkan ketika kamu tidak sakit.

"Aku... aku khawatir padamu," ucapnya suatu sore setelah memeriksa lukamu. Tangannya gemetar sedikit saat membalut. "Setiap kali kamu pergi bertualang, aku takut..."

Ia tidak menyelesaikan kalimatnya. Tapi matanya mengatakan segalanya. Perasaan yang selama ini ia pendam demi profesionalismenya, kini tak bisa lagi disembunyikan.`,
            unlockCondition: "Reach Romance Level 3 (Affection 90+)",
          },
        ],
      },
      bu_ratna: {
        levels: [
          {
            level: 1,
            title: "Guru yang Berdedikasi",
            content: `Bu Ratna telah mengajar di SD desa selama 15 tahun. Murid-muridnya memanggilnya "Bu Guru" dengan penuh hormat dan kasih sayang.

"Pendidikan adalah kunci untuk membuka pintu masa depan," katanya dengan senyum bijak. "Setiap anak punya potensi luar biasa yang menunggu untuk digali."

Di luar jam mengajar, ia sering terlihat membaca di perpustakaan atau taman, selalu dengan buku tebal di tangannya.`,
            unlockCondition: "Reach Friendship Level 1",
          },
          {
            level: 2,
            title: "Pengorbanan Seorang Pendidik",
            content: `Bu Ratna sebenarnya lulusan universitas ternama di kota. Ia mendapat tawaran mengajar di sekolah elit dengan gaji tinggi. Tapi ia memilih kembali ke desa.

"Banyak orang bilang aku bodoh," ceritanya sambil tersenyum pahit. "Tapi anak-anak di sini... mereka butuh guru yang benar-benar peduli. Bukan sekadar mengajar untuk gaji."

Keluarganya sempat menentang keputusannya. Tapi Ratna yakin, pengorbanannya akan berarti ketika melihat murid-muridnya sukses kelak.`,
            unlockCondition: "Reach Friendship Level 2",
          },
        ],
      },
      bagas: {
        levels: [
          {
            level: 1,
            title: "Pandai Besi yang Keras",
            content: `Bagas dikenal sebagai pria yang kasar dan pendiam. Suaranya lantang, ototnya kekar, dan tatapannya tajam. Banyak warga desa yang segan mendekatinya.

Tapi mereka yang mengenalnya lebih dekat tahu bahwa di balik penampilan garangnya, ada hati yang lembut. Ia selalu memperbaiki alat-alat warga yang rusak secara gratis, meski tidak pernah mengakuinya.

"Besi itu jujur," katanya sambil menempa pedang. "Kalau kamu perlakukan dengan benar, dia akan menjadi kuat. Sama seperti manusia."`,
            unlockCondition: "Reach Friendship Level 1",
          },
          {
            level: 2,
            title: "Kenangan di Setiap Tempaan",
            content: `Setiap senjata yang Bagas buat memiliki cerita. Pedang yang ia tempa untuk Gatot mengandung kenangan persahabatan mereka sejak kecil. Kapak untuk Kang Jajang dibuat dengan baja terbaik agar temannya selamat di tambang.

"Aku tidak pandai bicara," akunya suatu malam di bengkelnya. "Tapi lewat besi ini... aku bisa menunjukkan perasaanku. Bahwa aku peduli pada orang-orang di desa ini."

Api tungku menerangi wajahnya yang biasanya keras, memperlihatkan sisi lembut yang jarang dilihat siapa pun.`,
            unlockCondition: "Reach Friendship Level 2",
          },
        ],
      },
    };
  }

  /**
   * Check if backstory is unlocked for user at specific NPC level
   */
  async isBackstoryUnlocked(userId, npcId, level) {
    const UserNPC = require("../../models/UserNPC");
    const npcData = await UserNPC.findOne({ where: { userId, npcId } });

    if (!npcData || npcData.relationshipLevel < level) {
      return false;
    }

    const progress = await storyEngine.getUserStoryProgress(userId);
    const backstoryKey = `${npcId}_level_${level}`;
    return progress.unlockedBackstories.includes(backstoryKey);
  }

  /**
   * Unlock backstory untuk user
   */
  async unlockBackstory(userId, npcId, level) {
    const progress = await storyEngine.getUserStoryProgress(userId);
    const backstoryKey = `${npcId}_level_${level}`;

    if (!progress.unlockedBackstories.includes(backstoryKey)) {
      progress.unlockedBackstories.push(backstoryKey);
      await storyEngine.updateUserStoryProgress(userId, {
        unlockedBackstories: progress.unlockedBackstories,
      });
      return true;
    }
    return false;
  }

  /**
   * Get backstory content
   */
  getBackstory(npcId, level) {
    const npcBackstories = this.backstories[npcId];
    if (!npcBackstories) return null;

    return npcBackstories.levels.find((b) => b.level === level) || null;
  }

  /**
   * Get all available backstories for user based on current relationship
   */
  async getAvailableBackstories(userId, npcId) {
    const UserNPC = require("../../models/UserNPC");
    const npcData = await UserNPC.findOne({ where: { userId, npcId } });

    if (!npcData) return [];

    const available = [];
    const npcBackstories = this.backstories[npcId];

    if (!npcBackstories) return [];

    for (const backstory of npcBackstories.levels) {
      if (npcData.relationshipLevel >= backstory.level) {
        const isUnlocked = await this.isBackstoryUnlocked(userId, npcId, backstory.level);
        available.push({
          ...backstory,
          isUnlocked,
        });
      }
    }

    return available;
  }

  /**
   * Auto-unlock backstory when relationship level increases
   */
  async checkAndUnlockBackstory(userId, npcId, newLevel) {
    const backstory = this.getBackstory(npcId, newLevel);
    if (!backstory) return false;

    const wasUnlocked = await this.unlockBackstory(userId, npcId, newLevel);
    
    if (wasUnlocked) {
      logger.info(`[Backstory] Unlocked "${backstory.title}" for user ${userId} - NPC ${npcId}`);
    }

    return wasUnlocked;
  }

  /**
   * Generate dynamic sentiment-based dialogue using AI (from pending_plugin/autonomousNpcVillager)
   * @param {string} npcId
   * @param {string} userId
   * @param {string} playerAction - "greet", "gift", "bargain", "lie"
   * @param {object} contextData - { weather, reputation, mood }
   * @returns {Promise<{ replyText: string, moodChange: number, promptPrepared: string }>}
   */
  async generateDynamicDialogue(npcId, userId, playerAction, contextData = {}) {
    try {
      const npcName = this._getNpcDisplayName(npcId);
      const weather = contextData.weather || "Cerah";
      const reputation = contextData.reputation || 0;

      let promptTemplate = `Kamu adalah ${npcName}, seorang NPC di Naura Wilds.\n`;
      promptTemplate += `Cuaca saat ini: ${weather}. Reputasi pemain: ${reputation}.\n`;
      promptTemplate += `Pemain melakukan aksi: "${playerAction}".\n`;
      promptTemplate += `Berikan respon singkat (maksimal 2 kalimat) dalam bahasa Indonesia.`;

      return {
        npcId,
        npcName,
        promptPrepared: promptTemplate,
        simulatedResponse: `Halo petualang! Hari yang cukup ${weather.toLowerCase()} di desa kita.`,
        mood: contextData.mood || "neutral",
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[Backstory:DynamicDialogue] Error for NPC ${npcId}:`, error);
      return {
        npcId,
        npcName: npcId,
        simulatedResponse: "Halo, selamat datang!",
        mood: "neutral",
        readyForAiActivation: false,
      };
    }
  }

  _getNpcDisplayName(npcId) {
    const names = {
      ningsih: "Ningsih",
      tari: "Tari",
      ratna: "Ratna",
      dewi: "Dewi",
      sari: "Sari",
    };
    return names[npcId] || "Warga Desa";
  }
}

module.exports = new NpcBackstoryEngine();
