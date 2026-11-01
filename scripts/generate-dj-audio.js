"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const env = require("../src/config/env");
const fishAudioService = require("../src/services/fishAudioService");

const ROOT = path.join(process.cwd(), "assets", "audio", "dj");
const LANGS = ["id", "en"];
const PERSONAS = ["default", "tsundere", "kuudere", "gamer", "butler"];
const VARIANTS = [0, 1];
const GENRES = [
  "lofi",
  "anime",
  "rock",
  "edm",
  "kpop",
  "acoustic",
  "gaming",
  "stream",
  "pop_default",
];

const PERSONA_LINES = {
  id: {
    default: [
      "Halo, Naura di sini.",
      "Naura sudah siap menemani.",
    ],
    tsundere: [
      "Hmph, Naura kebetulan sedang ada di sini.",
      "Jangan salah paham, Naura cuma ingin suasananya tidak membosankan.",
    ],
    kuudere: [
      "Mode tenang aktif. Naura menemani dari sini.",
      "Semuanya terkendali. Kita bisa mulai dengan santai.",
    ],
    gamer: [
      "Oke, squad, kita masuk ke sesi berikutnya.",
      "Checkpoint aman. Saatnya lanjut dengan ritme yang bagus.",
    ],
    butler: [
      "Tuan dan Nyonya, Naura telah menyiapkan suasananya.",
      "Dengan senang hati, Naura akan menemani sesi ini.",
    ],
  },
  en: {
    default: [
      "Hello, Naura is here.",
      "Naura is ready to keep you company.",
    ],
    tsundere: [
      "Hmph, Naura just happened to be here.",
      "Do not get the wrong idea, Naura only wants the room to feel less dull.",
    ],
    kuudere: [
      "Calm mode is active. Naura is here with you.",
      "Everything is under control. We can take this slowly.",
    ],
    gamer: [
      "Alright, squad, we are moving into the next session.",
      "Checkpoint secure. Let us keep the rhythm going.",
    ],
    butler: [
      "Ladies and gentlemen, Naura has prepared the atmosphere.",
      "It is my pleasure to accompany this session.",
    ],
  },
};

const GENRE_LINES = {
  id: {
    lofi: [
      "Kita masuk ke nuansa lofi yang adem dan pelan.",
      "Biarkan warna lofi yang hangat mengisi ruang ini.",
    ],
    anime: [
      "Vibes anime mulai mengudara, cerah dan penuh warna.",
      "Gelombang jejepangan siap membawa sedikit semangat baru.",
    ],
    rock: [
      "Riff rock siap menaikkan energi tanpa basa-basi.",
      "Distorsi gitar mulai menyala. Saatnya menggoyang suasana.",
    ],
    edm: [
      "Beat EDM masuk perlahan, lalu biarkan bass mengambil alih.",
      "Gelombang dance sudah siap membuat ruangan ini bergerak.",
    ],
    kpop: [
      "Irama K-Pop yang rapi dan catchy siap menemani.",
      "Beat K-Pop menyala dengan warna yang stylish dan ringan.",
    ],
    acoustic: [
      "Nada akustik yang hangat siap menemani tanpa tergesa.",
      "Kita turunkan tempo dan memberi ruang untuk melodi yang lembut.",
    ],
    gaming: [
      "Nuansa soundtrack game membawa kita masuk ke sebuah petualangan.",
      "Mode petualangan dimulai dengan atmosfer yang lebih epik.",
    ],
    stream: [
      "Sesi panjang dimulai. Kita jaga ritmenya tetap nyaman.",
      "Mode fokus aktif untuk menemani aktivitas sampai selesai.",
    ],
    pop_default: [
      "Kita mulai dengan musik yang ringan dan menyenangkan.",
      "Suasana sudah siap untuk lagu berikutnya.",
    ],
  },
  en: {
    lofi: [
      "We are settling into a gentle, unhurried lofi mood.",
      "Let the warm colors of lofi fill the room for a while.",
    ],
    anime: [
      "Anime vibes are on the air, bright and full of color.",
      "A little Japanese pop energy is ready to lift the room.",
    ],
    rock: [
      "Rock riffs are ready to raise the energy without hesitation.",
      "The guitar distortion is warming up. Time to shake the room.",
    ],
    edm: [
      "The EDM beat is coming in gently, then the bass can take over.",
      "A dance wave is ready to get the room moving.",
    ],
    kpop: [
      "Crisp, catchy K-Pop rhythms are ready to keep you company.",
      "K-Pop beats are lighting up the room with a stylish, easy lift.",
    ],
    acoustic: [
      "Warm acoustic notes are ready to stay with you without rushing.",
      "We are lowering the tempo and making room for a softer melody.",
    ],
    gaming: [
      "A game soundtrack mood is taking us into a small adventure.",
      "Adventure mode starts with a more epic atmosphere.",
    ],
    stream: [
      "The long session starts now. We will keep the rhythm comfortable.",
      "Focus mode is active for as long as you need the company.",
    ],
    pop_default: [
      "We are starting with something light and easy to enjoy.",
      "The room is ready for the next song.",
    ],
  },
};

const CLOSINGS = {
  id: [
    "Tarik napas, lalu nikmati musiknya.",
    "Tidak perlu terburu-buru. Kita nikmati bersama.",
  ],
  en: [
    "Take a breath, and enjoy the music.",
    "There is no need to rush. Let us enjoy it together.",
  ],
};

function parseArgs() {
  const raw = process.argv.slice(2);
  const langIndex = raw.indexOf("--lang");
  const lang = langIndex >= 0 ? raw[langIndex + 1]?.toLowerCase() : null;
  return {
    dryRun: raw.includes("--dry-run"),
    force: raw.includes("--force"),
    langs: lang ? [lang] : LANGS,
  };
}

function buildText(lang, persona, genre, variant) {
  return [
    PERSONA_LINES[lang][persona][variant],
    GENRE_LINES[lang][genre][variant],
    CLOSINGS[lang][variant],
  ].join(" ");
}

function targetFor(lang, genre, persona, variant) {
  const filename = `${genre}_${persona}_v${variant + 1}.mp3`;
  return {
    filename,
    dir: path.join(ROOT, lang),
    fullPath: path.join(ROOT, lang, filename),
  };
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs();
  if (options.langs.some((lang) => !LANGS.includes(lang))) {
    throw new Error(`Bahasa tidak didukung. Pilih: ${LANGS.join(", ")}`);
  }
  if (!options.dryRun && !fishAudioService.isConfigured()) {
    throw new Error("FISH_AUDIO_API_KEY belum dikonfigurasi di .env");
  }

  const jobs = [];
  for (const lang of options.langs) {
    for (const genre of GENRES) {
      for (const persona of PERSONAS) {
        for (const variant of VARIANTS) {
          jobs.push({
            lang,
            genre,
            persona,
            variant,
            text: buildText(lang, persona, genre, variant),
            target: targetFor(lang, genre, persona, variant),
          });
        }
      }
    }
  }

  console.log(`[DJ Audio] ${options.dryRun ? "Preview" : "Generate"}: ${jobs.length} file`);
  if (options.dryRun) {
    for (const job of jobs) {
      console.log(`${job.lang}/${job.target.filename}: ${job.text}`);
    }
    return;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    provider: "Fish Audio",
    languages: options.langs,
    personas: PERSONAS,
    genres: GENRES,
    note: "Static fallback lines contain no track title or user name. Runtime synthesis remains enabled for custom personas and personalized announcements.",
    files: [],
  };

  for (const [index, job] of jobs.entries()) {
    fs.mkdirSync(job.target.dir, { recursive: true });
    let audio;
    if (!options.force && fs.existsSync(job.target.fullPath)) {
      audio = fs.readFileSync(job.target.fullPath);
      console.log(`[${index + 1}/${jobs.length}] skip ${job.lang}/${job.target.filename}`);
    } else {
      console.log(`[${index + 1}/${jobs.length}] generate ${job.lang}/${job.target.filename}`);
      audio = await fishAudioService.generateSpeech(job.text, {
        format: "mp3",
        latency: "low",
        useLocal: false,
        referenceId: env.FISH_AUDIO_VOICE_ID,
      });
      if (!Buffer.isBuffer(audio) || audio.length < 1024) {
        throw new Error(`Audio invalid untuk ${job.lang}/${job.target.filename}`);
      }
      fs.writeFileSync(job.target.fullPath, audio);
      await sleep(2000);
    }

    manifest.files.push({
      lang: job.lang,
      genre: job.genre,
      persona: job.persona,
      variant: job.variant + 1,
      filename: job.target.filename,
      path: path.relative(process.cwd(), job.target.fullPath).replaceAll("\\", "/"),
      sizeBytes: audio.length,
      sha256: sha256(audio),
      text: job.text,
    });
  }

  fs.writeFileSync(path.join(ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[DJ Audio] Selesai. Manifest: ${path.join(ROOT, "manifest.json")}`);
}

main().catch((error) => {
  console.error(`[DJ Audio] Gagal: ${error.message}`);
  process.exitCode = 1;
});
