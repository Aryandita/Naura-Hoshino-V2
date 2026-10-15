const fs = require("fs");
const path = require("path");

const fishAudioService = require("../src/services/fishAudioService");

const EMOTES = {
  Wave: "Halo semuanya!",
  Thinking: "Hmm... Naura lagi mikir nih.",
  Dizzy: "Aduh, Naura pusing...",
  Cheers: "Yey! Semangat terus ya!",
  Shy: "Hehe, Naura jadi malu.",
  Sleepy: "Hoaamm... ngantuk banget.",
  BlowKiss: "Muahh! Cinta untuk kalian semua!",
  AstralCast: "Rasakan sihir bintang Naura!",
  StarPose: "Tadaaa! Naura bersinar seperti bintang!"
};

const outputDir = path.join(__dirname, "../dashboard/public/sounds/emotes");

async function generateEmoteSounds() {
  console.log("Memulai pembuatan suara emote...");
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [emoteName, text] of Object.entries(EMOTES)) {
    const filePath = path.join(outputDir, `${emoteName.toLowerCase()}.mp3`);
    
    if (fs.existsSync(filePath)) {
      console.log(`[SKIP] ${emoteName} sudah ada.`);
      continue;
    }

    try {
      console.log(`[GENERATE] ${emoteName} -> "${text}"`);
      const buffer = await fishAudioService.generateSpeech(text, { format: "mp3", latency: "normal" });
      if (buffer) {
        fs.writeFileSync(filePath, buffer);
        console.log(`[OK] Disimpan: ${filePath}`);
      } else {
        console.log(`[FAIL] Gagal generate buffer untuk ${emoteName}`);
      }
    } catch (e) {
      console.error(`[ERROR] ${emoteName}: ${e.message}`);
    }
    
    // Tunggu 1 detik agar tidak rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log("Selesai!");
}

generateEmoteSounds();
