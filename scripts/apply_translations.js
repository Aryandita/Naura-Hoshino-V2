const fs = require("fs");
const path = require("path");
const glob = require("fast-glob");

async function runMigration() {
  console.log("🌸 Memulai Migrasi Bilingual Otomatis...");

  // 1. Baca file bahasa
  const idPath = path.join(__dirname, "..", "language", "id.json");
  const enPath = path.join(__dirname, "..", "language", "en.json");

  let idData = JSON.parse(fs.readFileSync(idPath, "utf8"));
  let enData = JSON.parse(fs.readFileSync(enPath, "utf8"));

  // 2. Ambil semua file javascript
  const files = await glob(["plugin/**/*.js", "src/events/**/*.js"], {
    absolute: true,
  });

  let keyCounter = 1;
  let modifiedFilesCount = 0;
  const sendErrorRegex = /ui\.sendError\(([^,]+),\s*(['"`])(.*?)\2(.*?)\)/g;

  for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    let fileModified = false;

    let match;
    // Gunakan replacer function untuk mengubah isi file
    content = content.replace(
      sendErrorRegex,
      (fullMatch, p1, quote, text, p4) => {
        // Skip jika sudah diterjemahkan atau ada template literal kompleks
        if (
          text.includes("languageManager") ||
          text.includes("${") ||
          text.startsWith("err_sys_")
        ) {
          return fullMatch;
        }

        const key = `err_sys_${keyCounter++}`;

        // Tambahkan ke ID dictionary
        idData[key] = text;

        fileModified = true;
        return `ui.sendError(${p1}, '${key}'${p4})`;
      },
    );

    if (fileModified) {
      fs.writeFileSync(file, content, "utf8");
      modifiedFilesCount++;
    }
  }

  console.log(
    `✅ Berhasil menemukan dan mengganti key di ${modifiedFilesCount} file.`,
  );
  console.log(
    `⏳ Menyalin string ke en.json (Menunggu terjemahan manual atau batch)...`,
  );

  // 3. Salin string baru ke en.json
  for (const [key, text] of Object.entries(idData)) {
    if (!enData[key] && key.startsWith("err_sys_")) {
      enData[key] = text; // fallback: copy ID to EN
    }
  }

  // 4. Simpan kembali JSON
  fs.writeFileSync(idPath, JSON.stringify(idData, null, 4), "utf8");
  fs.writeFileSync(enPath, JSON.stringify(enData, null, 4), "utf8");

  console.log("🎉 Selesai mengupdate bahasa!");
}

runMigration().catch(console.error);
