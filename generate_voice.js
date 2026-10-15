const fs = require('fs');
const path = require('path');
const fishAudioService = require('./src/services/fishAudioService');

const outputDir = path.join(__dirname, 'assets', 'audio', 'voice');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
  console.log('Generating standby.mp3...');
  const standbyScript = 'Lagu terakhir sudah selesai diputar. Ada yang mau tambah lagu lagi? Naura tungguin di sini sebentar ya! Kalau tidak ada, Naura pamit dalam dua menit.';
  const standbyBuffer = await fishAudioService.generateSpeech(standbyScript, { format: 'mp3', latency: 'normal' });
  if (standbyBuffer) {
    fs.writeFileSync(path.join(outputDir, 'standby.mp3'), standbyBuffer);
    console.log('Saved standby.mp3');
  }

  console.log('Generating goodbye.mp3...');
  const goodbyeScript = 'Sepertinya sudah tidak ada lagu lagi. Naura pamit dari Voice Channel ya! Sampai jumpa di sesi musik berikutnya!';
  const goodbyeBuffer = await fishAudioService.generateSpeech(goodbyeScript, { format: 'mp3', latency: 'normal' });
  if (goodbyeBuffer) {
    fs.writeFileSync(path.join(outputDir, 'goodbye.mp3'), goodbyeBuffer);
    console.log('Saved goodbye.mp3');
  }
  
  console.log('Done!');
}

run().catch(console.error);
