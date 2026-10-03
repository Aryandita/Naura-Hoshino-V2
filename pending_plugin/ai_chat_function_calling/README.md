# 🤖 AI Chat Function Calling (Pending Plugin)

## 📌 Status
- **Status:** Diarsipkan / Nonaktif Sementara (Dormant Blueprint)
- **Alasan:** Penghematan Kuota Free-Tier API (Google Gemini / Groq). Tidak dieksekusi di runtime utama sampai pengguna mengaktifkan paket API berbayar.
- **Model Target:** Gemini 2.5 Flash / GPT-4o-mini dengan Function Calling support.

## 💡 Konsep Fitur
Menghubungkan percakapan bebas (natural language chat) dengan eksekusi tool/command bot secara otomatis.
Pengguna dapat mengetik:
> *"Naura, tolong putarkan lagu lofi dan cek saldo dompetku dong!"*

Sistem Function Calling akan memetakan prompt tersebut menjadi pemanggilan terstruktur:
1. `tool: music_play(query: "lofi beats")`
2. `tool: economy_balance(userId: "...")`

## 🚀 Panduan Reaktivasi
1. Pindahkan atau impor modul `chatFunctionCalling.js` ke `src/ai/`.
2. Daftarkan skema tools pada `geminiClient.js` atau `aiEnsembleRouter.js`.
3. Pasang middleware otorisasi agar user tidak dapat mengeksekusi perintah admin via chat tool-calling.
