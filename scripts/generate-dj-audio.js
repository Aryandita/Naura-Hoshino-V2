"use strict";

const fs = require("node:fs");
const path = require("node:path");

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

const TEMPLATES_ID = {
  lofi: [
    "Meredupkan lampu studio sebentar... Suasana adem nan syahdu mengudara lewat {title} karya {author} untuk Kak {name}. Tarik napas pelan-pelan, selamat menikmati ketenangannya ya~",
    "Waktunya rehat sejenak dari hiruk-pikuk hari ini! Naura putarkan {title} karya {author} spesial buat Kak {name}. Pas banget buat teman belajar atau santai malam ini.",
  ],
  anime: [
    "Kyaa! Gelombang anime mengudara di frekuensi kita! Ini dia {title} karya {author} untuk Kak {name}. Yuk kita sing-along bareng Naura di voice channel!",
    "Vibes jejepangan yang selalu bikin bersemangat! Naura putarkan {title} pilihan keren dari Kak {name}. Siap-siap larut dalam melodinya yaa!",
  ],
  rock: [
    "Whoaaa! Pasang sabuk pengaman kalian, distorsi gitar cadas mulai menggelegar! Trek {title} oleh {author} hadir untuk Kak {name}. Bikin adrenalin langsung memuncak!",
    "Energi tanpa batas! Riff membara dari {author} dalam {title} siap mengguncang server untuk Kak {name}. Naikkan volume dan nikmati hentakannya!",
  ],
  edm: [
    "Turn up the bass! Dentuman beat menghentak siap membakar suasana! Naura putarkan {title} karya {author} untuk Kak {name}. Jangan ragu buat seru-seruan bareng di sini!",
    "Party vibes on air! Pilihan luar biasa dari Kak {name}, ini dia {title} oleh {author}. Rasakan gelombang energinya ya semuanya!",
  ],
  kpop: [
    "Irama stylish dan ritmis khas K-Pop siap memikat hari kalian! Lagu {title} dari {author} mengudara untuk Kak {name}. Melodi yang asyik banget buat sing-along!",
    "Visual soundstage menyala! Naura hadirkan {title} oleh {author} untuk Kak {name}. Beat-nya beneran nagih di telinga!",
  ],
  acoustic: [
    "Petikan nada yang hangat dan menyentuh hati... Ini dia {title} persembahan {author} untuk Kak {name}. Biarkan melodinya menemani relung hatimu ya~",
    "Sentuhan nada lembut yang menenangkan jiwa. Naura hadirkan karya manis dari {author}, {title}, untuk Kak {name}. Selamat meresapi kehangatannya.",
  ],
  gaming: [
    "Panggilan petualangan berbunyi! Soundtrack epik {title} karya {author} mulai mengalun untuk Kak {name}. Rasakan atmosfer dunia fantasi yang megah!",
    "Siapkan perlengkapanmu, penjelajah! Irama legendaris {title} oleh {author} hadir untuk Kak {name}. Musik yang pas buat temani grinding atau santai!",
  ],
  stream: [
    "Sesi marathon siaran panjang telah dimulai! Naura hadirkan trek fokus {title} untuk Kak {name}. Naura bakal tetap standby menemani aktivitasmu sampai selesai ya~",
    "Siaran berdurasi panjang untuk fokus maksimal. Naura temani Kak {name} dan kawan-kawan di voice channel. Duduk manis dan nikmati alurnya!",
  ],
  pop_default: [
    "Halo halo semuanya! Lagu spesial berikutnya, {title} oleh {author} mengudara untuk Kak {name}. Selamat mendengarkan bersama Naura ya!",
    "Pilihan yang manis dan menyenangkan dari Kak {name}! Sekarang Naura putarkan {title} karya {author}. Yuk kita nikmati bareng-bareng!",
  ],
};

const TEMPLATES_EN = {
  lofi: [
    "Dimming the studio lights for a bit... A chill and peaceful vibe is on the air with {title} by {author} for {name}. Take a deep breath and enjoy the tranquility~",
    "Time for a quick break from today's hustle! Naura is playing {title} by {author} especially for {name}. Perfect companion for studying or just chilling tonight.",
  ],
  anime: [
    "Kyaa! Anime waves are broadcasting on our frequency! Here is {title} by {author} for {name}. Let's sing along together with Naura in the voice channel!",
    "Japanese vibes that always hype us up! Naura is playing {title}, an awesome pick from {name}. Get ready to get lost in the melody!",
  ],
  rock: [
    "Whoaaa! Fasten your seatbelts, the heavy guitar distortion is rolling in! {title} by {author} is up next for {name}. This will surely pump up your adrenaline!",
    "Limitless energy! The blazing riffs from {author} in {title} are ready to rock the server for {name}. Turn up the volume and enjoy the beat!",
  ],
  edm: [
    "Turn up the bass! The dropping beats are ready to set the mood on fire! Naura is playing {title} by {author} for {name}. Don't hesitate to rave with us here!",
    "Party vibes on air! An incredible choice from {name}, here is {title} by {author}. Feel the energy waves, everyone!",
  ],
  kpop: [
    "The stylish and rhythmic K-Pop beats are ready to charm your day! {title} by {author} is on the air for {name}. Such a catchy melody to sing along to!",
    "Visual soundstage activated! Naura presents {title} by {author} for {name}. The beat is absolutely addicting!",
  ],
  acoustic: [
    "Warm and heart-touching acoustic strums... Here is {title} presented by {author} for {name}. Let the melody accompany your soul~",
    "Gentle notes that soothe the soul. Naura presents a sweet masterpiece from {author}, {title}, for {name}. Please enjoy the warmth.",
  ],
  gaming: [
    "The call of adventure sounds! The epic soundtrack {title} by {author} begins to play for {name}. Feel the majestic fantasy world atmosphere!",
    "Gear up, explorers! The legendary rhythm {title} by {author} is here for {name}. The perfect music to accompany your grinding or chill session!",
  ],
  stream: [
    "The long marathon session has begun! Naura presents the focus track {title} for {name}. Naura will stay on standby to accompany your activities until you're done~",
    "A long-duration broadcast for maximum focus. Naura is accompanying {name} and friends in the voice channel. Sit back and enjoy the flow!",
  ],
  pop_default: [
    "Hello hello everyone! A special song up next, {title} by {author} is on the air for {name}. Enjoy listening together with Naura!",
    "A sweet and delightful pick from {name}! Now Naura is playing {title} by {author}. Let's enjoy this together!",
  ],
};

const PLACEHOLDERS = {
  id: { name: "kamu", title: "Lagu Spesial", author: "Artis Favorit" },
  en: { name: "you", title: "Special Song", author: "Favorite Artist" },
};

function parseArgs() {
  const args = process.argv.slice(2);
  let lang = "all";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang" && args[i + 1]) {
      lang = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { lang, dryRun };
}

function resolveText(template, lang) {
  const p = PLACEHOLDERS[lang];
  return template
    .replace(/\{name\}/g, p.name)
    .replace(/\{title\}/g, p.title)
    .replace(/\{author\}/g, p.author);
}

function buildTasks(lang) {
  const templates = lang === "en" ? TEMPLATES_EN : TEMPLATES_ID;
  const tasks = [];

  for (const genre of GENRES) {
    const variants = templates[genre] || [];
    variants.forEach((tpl, idx) => {
      tasks.push({
        lang,
        genre,
        variant: idx + 1,
        text: resolveText(tpl, lang),
        filename: `${genre}_v${idx + 1}.mp3`,
      });
    });
  }

  return tasks;
}

async function generateAudio(fishAudio, task) {
  const buffer = await fishAudio.generateSpeech(task.text, {
    format: "mp3",
    latency: "normal",
  });
  return buffer;
}

async function main() {
  const { lang, dryRun } = parseArgs();
  const langs = lang === "all" ? ["id", "en"] : [lang];

  console.log(`\n=== DJ Audio Generator ===`);
  console.log(`Language(s): ${langs.join(", ")}`);
  console.log(`Dry run: ${dryRun}\n`);

  const allTasks = [];
  for (const l of langs) {
    allTasks.push(...buildTasks(l));
  }

  console.log(`Total files to generate: ${allTasks.length}\n`);

  if (dryRun) {
    for (const task of allTasks) {
      const outPath = path.join("assets", "audio", "dj", task.lang, task.filename);
      console.log(`[DRY-RUN] Would generate: ${outPath}`);
      console.log(`  Text: "${task.text.slice(0, 80)}..."`);
    }
    console.log(`\nDry run complete. No files generated.`);
    return;
  }

  let fishAudio;
  try {
    fishAudio = require("../src/services/fishAudioService.js");
  } catch (err) {
    console.error(`Failed to load fishAudioService: ${err.message}`);
    process.exit(1);
  }

  if (!fishAudio.isConfigured()) {
    console.error("FISH_AUDIO_API_KEY not configured in .env");
    process.exit(1);
  }

  const manifest = { generatedAt: new Date().toISOString(), files: [] };
  let success = 0;
  let failed = 0;

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];
    const outDir = path.join("assets", "audio", "dj", task.lang);
    const outPath = path.join(outDir, task.filename);
    const progress = `[${i + 1}/${allTasks.length}]`;

    process.stdout.write(`${progress} Generating ${task.lang}/${task.genre} v${task.variant}... `);

    try {
      const buffer = await generateAudio(fishAudio, task);
      fs.writeFileSync(outPath, buffer);

      const sizeKb = (buffer.length / 1024).toFixed(1);
      console.log(`OK (${sizeKb} KB)`);

      manifest.files.push({
        lang: task.lang,
        genre: task.genre,
        variant: task.variant,
        filename: task.filename,
        path: `assets/audio/dj/${task.lang}/${task.filename}`,
        sizeBytes: buffer.length,
      });

      success++;
    } catch (err) {
      console.log(`FAILED - ${err.message}`);
      failed++;
    }

    if (i < allTasks.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  const manifestPath = path.join("assets", "audio", "dj", "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n=== Complete ===`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
