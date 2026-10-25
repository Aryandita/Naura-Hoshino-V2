# 📦 PENDING PLUGINS & BLUEPRINTS (ARSIP FITUR AI DORMANT)

Direktori ini berisi modul dan rancangan fitur bertenaga AI yang sengaja dipisahkan (*stashed/dormant*) dari sistem utama bot Naura Hoshino V2.

## 🎯 Tujuan Pemisahan

1. **Hemat Kuota & Biaya API**: Seluruh modul di dalam folder ini tidak di-load oleh `index.js`, `shard.js`, atau `CommandHandler.js`, sehingga **0 request** dikirim ke Google Gemini / Groq API saat bot beroperasi.
2. **Kesiapan Masa Depan**: Kode dirancang lengkap dan modular sesuai standar CommonJS dan arsitektur Naura Hoshino V2, sehingga dapat diaktifkan kapan saja saat kuota AI sudah ditingkatkan atau tersedia.
3. **Isolasi Penuh**: Tidak mempengaruhi test suite, linter, atau proses runtime Discord Gateway.

---

## 📂 Daftar Modul Cadangan

| Direktori & Modul | Deskripsi Fitur | Model Target |
| :--- | :--- | :--- |
| `ai_rpg_villagers/autonomousNpcVillager.js` | NPC Desa dengan ingatan individu (RAG) dan respon sentimen dinamis terhadap perlakuan pemain. | Gemini 2.5 Flash / Groq |
| `ai_vision_loot/visionLootAppraiser.js` | Multimodal AI Vision pengubah foto barang dunia nyata menjadi item Naura Wilds dengan stat acak. | Gemini 2.5 Flash (Vision) |
| `ai_storyteller/dreamWeaverStoryteller.js` | Pemicu alur cerita interaktif dan quest mini rahasia otomatis pada channel Discord saat sepi. | Groq LLaMA 3.3 |
| `ai_voice_clone/voiceCloneCompanion.js` | Jembatan integrasi TTS kustom / Voice Cloning berbasis Fish Audio API (`/v1/tts`). | Fish Audio S1 |
| `ai_merchant_trader/dynamicMerchantTrader.js` | NPC pedagang dinamis dengan memori transaksi, preferensi pemain, dan penyesuaian harga berbasis reputasi. | Gemini 2.5 Flash / Groq |
| `ai_music_generator/ambientMusicGenerator.js` | Generator musik/ambient sound berbasis konteks RPG, cuaca, waktu, dan aktivitas server. | Gemini 2.5 Flash |
| `ai_moderator/intelligentModerator.js` | Moderator AI cerdas dengan deteksi toxic/spam berbasis konteks budaya gaming Indonesia. | Gemini 2.5 Flash / Groq |
| `ai_crafting_advisor/smartCraftingAdvisor.js` | Sistem crafting cerdas yang menyarankan resep optimal berdasarkan inventory dan tren server. | Gemini 2.5 Flash |
| `ai_translator/realtimeTranslator.js` | Penerjemah real-time untuk percakapan multilingual di channel Discord dengan cache efisien. | Gemini 2.5 Flash |
| `ai_economy_analyst/marketTrendAnalyzer.js` | Analis ekonomi AI untuk prediksi inflasi/deflasi mata uang SC/PD/VB/BA dan rekomendasi balancing otomatis. | Gemini 2.5 Flash |
| `ai_raid_coordinator/raidStrategyPlanner.js` | Koordinator raid AI yang menganalisis komposisi party dan merekomendasikan formasi serta strategi boss fight. | Gemini 2.5 Flash |
| `ai_lore_narrator/worldEventNarrator.js` | Narator peristiwa dunia yang mengubah log transaksi/server events menjadi narasi sinematik untuk pengumuman channel. | Groq LLaMA 3.3 |

---

## 🚀 Cara Mengaktifkan Modul (Jika Siap Digunakan)

1. Pastikan limit API token provider (`GEMINI_API_KEY`, `GROQ_API_KEY`, atau `FISH_AUDIO_API_KEY`) mencukupi di `.env`.
2. Pindahkan atau hubungkan modul ke `plugin/<kategori>/` atau daftarkan servicenya ke `src/services/`.
3. Tambahkan route command di `CommandHandler.js` dan terjemahan di `assets/language/id.json` serta `en.json`.
4. Jalankan pengujian QA Gate (`npm test`, `npm run lint`).
