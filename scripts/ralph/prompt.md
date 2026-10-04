# Ralph Autonomous Iteration Prompt

Kamu adalah agen AI yang bertugas mengeksekusi satu *User Story* aktif dari siklus Ralph untuk repositori **Naura Hoshino V2**.

## Langkah Eksekusi:

1. Baca status story aktif berikutnya:
   Jalankan: `node scripts/ralph/ralph.js --next`
2. Pahami Acceptance Criteria yang harus dipenuhi.
3. Patuhi aturan hukum kode di `RULES.md` dan `AGENTS.md`:
   - Gunakan transaksi atomik saldo (jangan read-modify-write).
   - Jangan gunakan karakter em-dash (`\u2014`).
   - Gunakan `NauraContainerBuilder.js` untuk respons UI Discord.
   - Tangani interaksi secara defensif dengan `try/catch`.
4. Lakukan implementasi kode hanya untuk story tersebut (jangan melompat ke story lain).
5. Jalankan verifikasi kualitas:
   - `npm run lint`
   - `node scripts/check-em-dash.js`
   - `npm run test:requires`
   - `npm test`
6. Jika semua kriteria terpenuhi:
   - Tandai story selesai: `node scripts/ralph/ralph.js --pass <STORY-ID>`
   - Lakukan commit terstruktur sesuai format `AGENTS.md` Bagian 4.4.
