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
| `ai_radio_podcast/dailyChroniclePodcast.js` | Perangkum obrolan server dan peristiwa RPG menjadi naskah siaran radio/podcast harian. | Gemini 2.5 Flash |

---

## 🚀 Cara Mengaktifkan Modul (Jika Siap Digunakan)

1. Pastikan limit API token provider (`GEMINI_API_KEY`, `GROQ_API_KEY`, atau `FISH_AUDIO_API_KEY`) mencukupi di `.env`.
2. Pindahkan atau hubungkan modul ke `plugin/<kategori>/` atau daftarkan servicenya ke `src/services/`.
3. Tambahkan route command di `CommandHandler.js` dan terjemahan di `assets/language/id.json` serta `en.json`.
4. Jalankan pengujian QA Gate (`npm test`, `npm run lint`).
