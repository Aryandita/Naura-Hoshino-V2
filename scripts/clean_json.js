const fs = require("fs");
const path = require("path");

const idPath = path.join(__dirname, "..", "language", "id.json");
const enPath = path.join(__dirname, "..", "language", "en.json");

let idData = JSON.parse(fs.readFileSync(idPath, "utf8"));
let enData = JSON.parse(fs.readFileSync(enPath, "utf8"));

// Bersihkan karakter garbage dari proses regex sebelumnya (seperti dYZY, dY, dY` dsb.)
const cleanText = (str) => {
  return str.replace(/dY[^\s]*\s?/g, "").trim();
};

for (let key in idData) {
  if (key.startsWith("err_sys_")) {
    let text = idData[key];
    text = cleanText(text);

    // Jika teks rusak parah, beri default
    if (text.length < 3) {
      text = "Terjadi kesalahan sistem.";
    }

    idData[key] = text;

    let enText = text;
    if (text.toLowerCase().includes("voice channel"))
      enText = "You must be in a Voice Channel!";
    else if (text.toLowerCase().includes("akses ditolak"))
      enText = "Access Denied!";
    else if (text.toLowerCase().includes("penjara"))
      enText = "You cannot do this while in Prison!";
    else if (text.toLowerCase().includes("sistem sedang sibuk"))
      enText = "System is busy. Please wait a few seconds.";
    else if (text.toLowerCase().includes("tidak dapat menemukan pengguna"))
      enText = "Could not find the user.";
    else if (text.toLowerCase().includes("kesalahan sistem"))
      enText = "A system error occurred.";
    else if (text.toLowerCase().includes("perintah tidak dikenali"))
      enText = "Command not recognized.";
    else if (text.toLowerCase().includes("gagal"))
      enText = "Failed to process the request.";
    else if (text.toLowerCase().includes("rumah disegel"))
      enText = "Your house has been sealed due to unpaid taxes!";
    else if (text.toLowerCase().includes("staminamu tidak cukup"))
      enText = "Not enough stamina. Take a rest first!";
    else if (text.toLowerCase().includes("premium"))
      enText = "This feature is exclusive for Premium members.";
    else enText = text; // Sama dengan ID kalau tidak ada di list

    enData[key] = enText;
  }
}

fs.writeFileSync(idPath, JSON.stringify(idData, null, 4), "utf8");
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4), "utf8");

console.log("✅ JSON berhasil dibersihkan dan diterjemahkan!");
