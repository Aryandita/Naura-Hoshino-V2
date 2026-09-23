const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "assets", "audio", "soundboard");
fs.mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 44100;

function createWavBuffer(samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF identifier
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);

  // format chunk identifier
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // format chunk length
  buffer.writeUInt16LE(1, 20); // sample format (1 is PCM)
  buffer.writeUInt16LE(1, 22); // channel count (1 is mono)
  buffer.writeUInt32LE(SAMPLE_RATE, 24); // sample rate
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk identifier
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(
      Math.floor(s < 0 ? s * 0x8000 : s * 0x7fff),
      44 + i * 2,
    );
  }

  return buffer;
}

// 1. Airhorn MLG: Tri-tone brass stack with stutter attack
function genAirhorn() {
  const dur = 1.3;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  const freqs = [466.16, 587.33, 700.0, 932.33]; // Bb4, D5, F5, Bb5 brass chord
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Rhythmic stutter: burst at t=0, t=0.18, t=0.35, then sustained hold at t=0.5
    let env = 0;
    if (t < 0.14) env = Math.sin((t / 0.14) * Math.PI);
    else if (t < 0.18) env = 0.05;
    else if (t < 0.32) env = Math.sin(((t - 0.18) / 0.14) * Math.PI);
    else if (t < 0.36) env = 0.05;
    else if (t < 0.5) env = Math.sin(((t - 0.36) / 0.14) * Math.PI);
    else {
      const sustainT = (t - 0.5) / 0.8;
      env = Math.max(0, 1 - sustainT * sustainT);
    }
    let val = 0;
    freqs.forEach((f) => {
      val +=
        (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) *
        0.25;
    });
    samples[i] = val * env * 0.85;
  }
  return samples;
}

// 2. Bruh: Resonant low vocal formant pitch drop
function genBruh() {
  const dur = 0.85;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.sin((t / dur) * Math.PI);
    // Pitch drops from 140Hz to 85Hz
    const pitch = 140 - (t / dur) * 55;
    // Vocal formants F1 ~ 500Hz, F2 ~ 1000Hz (vowel 'uh')
    const fundamental = Math.sin(2 * Math.PI * pitch * t);
    const f1 = Math.sin(2 * Math.PI * 480 * t) * 0.4;
    const f2 = Math.sin(2 * Math.PI * 980 * t) * 0.25;
    samples[i] = (fundamental * 0.6 + f1 + f2) * env * 0.9;
  }
  return samples;
}

// 3. Victory: Triumphant brass fanfare C4 -> E4 -> G4 -> C5
function genVictory() {
  const dur = 2.2;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  const notes = [
    { f: 523.25, start: 0.0, len: 0.22 }, // C5
    { f: 523.25, start: 0.24, len: 0.22 }, // C5
    { f: 523.25, start: 0.48, len: 0.22 }, // C5
    { f: 659.25, start: 0.72, len: 0.35 }, // E5
    { f: 587.33, start: 1.1, len: 0.2 }, // D5
    { f: 783.99, start: 1.32, len: 0.85 }, // G5 triumph sustain
  ];
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    notes.forEach((n) => {
      if (t >= n.start && t < n.start + n.len) {
        const nt = t - n.start;
        const env = Math.sin((nt / n.len) * Math.PI);
        s +=
          (Math.sin(2 * Math.PI * n.f * t) +
            0.35 * Math.sin(4 * Math.PI * n.f * t)) *
          env *
          0.4;
      }
    });
    samples[i] = s;
  }
  return samples;
}

// 4. Game Over: Retro 8-bit descending arpeggio
function genGameOver() {
  const dur = 1.8;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  const notes = [
    { f: 493.88, start: 0.0, len: 0.28 }, // B4
    { f: 466.16, start: 0.3, len: 0.28 }, // Bb4
    { f: 440.0, start: 0.6, len: 0.28 }, // A4
    { f: 415.3, start: 0.9, len: 0.85 }, // Ab4 sad drop
  ];
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    notes.forEach((n) => {
      if (t >= n.start && t < n.start + n.len) {
        const nt = t - n.start;
        const env = Math.max(0, 1 - nt / n.len);
        // 8-bit square wave
        const sq = Math.sin(2 * Math.PI * n.f * t) > 0 ? 0.35 : -0.35;
        s += sq * env;
      }
    });
    samples[i] = s;
  }
  return samples;
}

// 5. Magic: Celestial fairy sparkle chimes
function genMagic() {
  const dur = 2.2;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  const sparkleFreqs = [1046.5, 1318.5, 1567.9, 1975.5, 2093.0, 2637.0, 3135.9];
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    sparkleFreqs.forEach((f, idx) => {
      const noteStart = idx * 0.12;
      if (t >= noteStart) {
        const nt = t - noteStart;
        const env = Math.exp(-nt * 3.5);
        s += Math.sin(2 * Math.PI * f * t) * env * 0.18;
      }
    });
    samples[i] = s;
  }
  return samples;
}

// 6. Drum Roll: Building snare acoustic roll with cymbal crash
function genDrumroll() {
  const dur = 2.4;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    if (t < 1.8) {
      // Snare roll build
      const build = t / 1.8;
      const rate = 22 + build * 10;
      const hit = Math.sin(2 * Math.PI * rate * t) > 0 ? 1 : 0;
      const noise = (Math.random() * 2 - 1) * 0.4;
      const tone = Math.sin(2 * Math.PI * 180 * t) * 0.3;
      samples[i] = (noise + tone) * hit * (0.2 + build * 0.75);
    } else {
      // Cymbal crash finish
      const ct = t - 1.8;
      const env = Math.exp(-ct * 3.0);
      const noise = (Math.random() * 2 - 1) * env * 0.8;
      samples[i] = noise;
    }
  }
  return samples;
}

// 7. Bonk: Cartoon hollow hammer
function genBonk() {
  const dur = 0.55;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 12);
    const pitch = 750 * Math.exp(-t * 8) + 120;
    const s = Math.sin(2 * Math.PI * pitch * t);
    const hollow = Math.sin(4 * Math.PI * pitch * t) * 0.4;
    samples[i] = (s + hollow) * env * 0.95;
  }
  return samples;
}

// 8. Coin: Star Fragment pickup chime
function genCoin() {
  const dur = 0.65;
  const numSamples = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    if (t < 0.1) {
      s = Math.sin(2 * Math.PI * 987.77 * t) * Math.exp(-t * 4);
    } else {
      const nt = t - 0.1;
      s = Math.sin(2 * Math.PI * 1318.51 * t) * Math.exp(-nt * 3.2);
    }
    samples[i] = s * 0.8;
  }
  return samples;
}

const generators = {
  "airhorn.wav": genAirhorn,
  "bruh.wav": genBruh,
  "victory.wav": genVictory,
  "gameover.wav": genGameOver,
  "magic.wav": genMagic,
  "drumroll.wav": genDrumroll,
  "bonk.wav": genBonk,
  "coin.wav": genCoin,
};

console.log("Generating authentic soundboard SFX WAV files...");
for (const [filename, gen] of Object.entries(generators)) {
  const samples = gen();
  const wavBuf = createWavBuffer(samples);
  const targetPath = path.join(outDir, filename);
  fs.writeFileSync(targetPath, wavBuf);
  console.log(`✅ Generated: ${filename} (${wavBuf.length} bytes)`);
}
