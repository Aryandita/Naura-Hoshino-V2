# 🏛️ AI Server Lore RAG (Pending Plugin)

## 📌 Status
- **Status:** Diarsipkan / Nonaktif Sementara (Dormant Blueprint)
- **Alasan:** Penghematan Kuota Free-Tier API (Google Gemini Vector Embeddings).
- **Model Target:** `text-embedding-004` (Gemini) atau model embedding lokal Ollama.

## 💡 Konsep Fitur
Menyimpan dan mengambil konteks sejarah, budaya, dan lelucon lokal (*inside jokes*) suatu server Discord.
Setiap kali ada kejadian besar atau pengumuman server, AI dapat mengindeksnya ke koleksi Vector Memory di MongoDB Atlas atau PostgreSQL pgvector.
Saat anggota bertanya:
> *"Siapa pendiri faksi Sukamaju di server ini?"*

Sistem Server Lore RAG akan mencari potongan dokumen terdekat dan memberikan jawaban yang sesuai dengan tradisi server tersebut.

## 🚀 Panduan Reaktivasi
1. Pastikan ekstensi `vector` aktif di PostgreSQL atau MongoDB Atlas Vector Search dikonfigurasi.
2. Impor modul `serverLoreService.js` ke `src/ai/`.
3. Hubungkan pemanggilan ke `aiEnsembleRouter.js` pada task `GENERAL_CONVERSATION`.
