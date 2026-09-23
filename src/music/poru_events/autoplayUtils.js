// Lokasi: src/events/poru/autoplayUtils.js
// Utility bersama: memilih kandidat lagu autoplay yang paling relevan
// & membuat transisi volume (fade-out -> fade-in) antar lagu terasa mulus.

const BLACKLIST_KEYWORDS = [
  "karaoke",
  "instrumental",
  "cover",
  "live performance",
  "reaction",
  "nightcore",
  "slowed + reverb",
  "slowed and reverb",
  "8d audio",
  "tutorial",
  "how to play",
  "sped up version",
];

function normalize(str = "") {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 0 = tidak mirip sama sekali, 1 = judulnya nyaris identik
function titleOverlapScore(a, b) {
  const wordsA = new Set(
    normalize(a)
      .split(" ")
      .filter((w) => w.length > 2),
  );
  const wordsB = new Set(
    normalize(b)
      .split(" ")
      .filter((w) => w.length > 2),
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let common = 0;
  for (const w of wordsA) if (wordsB.has(w)) common++;
  return common / Math.max(wordsA.size, wordsB.size);
}

function isBlacklisted(title = "") {
  const t = title.toLowerCase();
  return BLACKLIST_KEYWORDS.some((kw) => t.includes(kw));
}

function isDurationSane(candidateLen, sourceLen) {
  if (!candidateLen || !sourceLen) return true;
  // Tolak video yang kelewat panjang (mix/kompilasi 1 jam) atau kelewat pendek (snippet/intro)
  if (candidateLen > 15 * 60 * 1000 && candidateLen > sourceLen * 3)
    return false;
  if (candidateLen < 45 * 1000) return false;
  return true;
}

/**
 * Mengurutkan & memfilter kandidat autoplay berdasarkan histori pemutaran, blacklist,
 * durasi, dan kemiripan judul/artis dengan lagu yang baru saja diputar.
 *
 * Mengembalikan ARRAY (bukan cuma 1 lagu) supaya sisanya bisa dijadikan buffer/prefetch queue,
 * jadi kalau kandidat teratas gagal di-resolve, tidak perlu nyari ulang dari nol.
 */
function rankAutoplayCandidates(
  tracks = [],
  sourceTrack,
  playedHistory = new Set(),
  limit = 3,
) {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];
  const sourceInfo = sourceTrack?.info || {};
  const sourceAuthor = (sourceInfo.author || "").toLowerCase();

  const scored = tracks
    .filter(
      (t) => t?.info?.identifier && t.info.identifier !== sourceInfo.identifier,
    )
    .filter((t) => !playedHistory.has(t.info.identifier))
    .filter((t) => !isBlacklisted(t.info.title))
    .filter((t) => isDurationSane(t.info.length, sourceInfo.length))
    .map((t) => {
      const overlap = titleOverlapScore(t.info.title, sourceInfo.title);
      const sameArtist =
        sourceAuthor && (t.info.author || "").toLowerCase() === sourceAuthor;
      return { track: t, overlap, sameArtist };
    })
    // Buang kandidat yang sebenarnya cuma versi lain dari lagu yang sama (upload duplikat/remaster)
    .filter(({ overlap, sameArtist }) => !(sameArtist && overlap > 0.85))
    .map(({ track, overlap, sameArtist }) => ({
      track,
      score: (sameArtist ? 2 : 0) + overlap,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.track);

  return scored.slice(0, limit);
}

/**
 * Fade volume secara bertahap dari satu nilai ke nilai lain.
 * Interval disimpan di player supaya bisa dibersihkan (clearTransitionTimers) saat lagu berganti.
 */
function smoothFade(
  player,
  fromVolume,
  toVolume,
  durationMs = 3000,
  steps = 15,
) {
  if (!player || typeof player.setVolume !== "function") return;
  if (player._fadeInterval) {
    clearInterval(player._fadeInterval);
    player._fadeInterval = null;
  }

  const safeSteps = Math.max(1, steps);
  const stepTime = Math.max(50, durationMs / safeSteps);
  const stepVol = (toVolume - fromVolume) / safeSteps;
  let current = fromVolume;
  let count = 0;

  try {
    player.setVolume(Math.round(Math.max(0, Math.min(100, current))));
  } catch (e) {}

  player._fadeInterval = setInterval(() => {
    count++;
    current += stepVol;
    try {
      player.setVolume(Math.round(Math.max(0, Math.min(100, current))));
    } catch (e) {
      clearInterval(player._fadeInterval);
      player._fadeInterval = null;
      return;
    }
    if (count >= safeSteps) {
      clearInterval(player._fadeInterval);
      player._fadeInterval = null;
      try {
        player.setVolume(Math.round(Math.max(0, Math.min(100, toVolume))));
      } catch (e) {}
    }
  }, stepTime);
  // Rule 1.9: timer berumur pendek ini dibersihkan via clearTransitionTimers,
  // unref hanya pengaman agar tidak pernah menahan proses saat shutdown.
  if (player._fadeInterval.unref) player._fadeInterval.unref();
}

/**
 * Heuristik estimasi BPM (Beats Per Minute) berdasarkan pola genre & judul lagu.
 * Digunakan untuk smart beatmatching crossfade antar trek musik.
 */
function estimateTrackBpm(title = "") {
  const t = title.toLowerCase();
  if (/speed\s*up|dnb|drum\s*and\s*bass|nightcore|hardstyle/i.test(t))
    return 165;
  if (/edm|house|dance|club|remix|electronic/i.test(t)) return 128;
  if (/hip\s*hop|trap|rap|r&b|groove/i.test(t)) return 95;
  if (/lo-?fi|chill|relax|study|sleep|ambient/i.test(t)) return 80;
  if (/ballad|acoustic|slow|piano/i.test(t)) return 75;
  if (/rock|metal|punk/i.test(t)) return 135;
  return 110; // Default pop standard tempo
}

/**
 * Menghitung durasi crossfade adaptif 3 s.d. 5 detik dan rasio kecocokan tempo
 * antar dua lagu berurutan.
 */
function calculateBeatmatchedCrossfade(currentTrack, nextTrack) {
  const currentTitle = currentTrack?.info?.title || "";
  const nextTitle = nextTrack?.info?.title || "";

  const bpmA = estimateTrackBpm(currentTitle);
  const bpmB = estimateTrackBpm(nextTitle);

  // Hitung perbedaan tempo relatif
  const diffRatio = Math.abs(bpmA - bpmB) / Math.max(bpmA, bpmB);

  // Jika tempo mirip (selisih <= 15%), gunakan crossfade lebih panjang (4500-5000ms) untuk beatmatch mulus
  let crossfadeMs = 4000;
  if (diffRatio <= 0.15) {
    crossfadeMs = 5000;
  } else if (diffRatio >= 0.4) {
    crossfadeMs = 3000; // Tempo sangat beda: transisi lebih cepat agar tidak bentrok ritme
  }

  return {
    crossfadeMs,
    bpmCurrent: bpmA,
    bpmNext: bpmB,
    diffRatio,
  };
}

/**
 * Memantau posisi lagu yang sedang berjalan, lalu otomatis memicu fade-out
 * beberapa detik sebelum lagu berakhir -- supaya perpindahan ke lagu berikutnya
 * (yang akan fade-in di trackStart) terasa seperti transisi DJ, bukan lompatan tiba-tiba.
 */
function startFadeOutWatcher(player, track, baseVolume, fadeOutMs = 4000) {
  if (!player || !track?.info?.length) return;
  if (player._endWatcher) {
    clearInterval(player._endWatcher);
    player._endWatcher = null;
  }

  const duration = track.info.length;
  let fading = false;

  player._endWatcher = setInterval(() => {
    const stillSameTrack =
      player.currentTrack &&
      player.currentTrack.info.identifier === track.info.identifier;
    if (!stillSameTrack || !player.isPlaying) {
      clearInterval(player._endWatcher);
      player._endWatcher = null;
      return;
    }
    const remaining = duration - (player.position || 0);
    if (!fading && remaining > 0 && remaining <= fadeOutMs) {
      fading = true;
      const floorVolume = Math.max(5, Math.floor(baseVolume * 0.15));
      smoothFade(
        player,
        player.volume ?? baseVolume,
        floorVolume,
        Math.min(fadeOutMs, remaining),
      );
    }
  }, 1000);
  if (player._endWatcher.unref) player._endWatcher.unref();
}

/**
 * Fade-in lagu yang baru mulai, dipanggil dari trackStart setelah playback benar-benar berjalan.
 * Mengintegrasikan smart beatmatching jika ada lagu berikutnya dalam antrean.
 */
function beginPlaybackTransition(
  player,
  track,
  baseVolume,
  { fadeInMs = 3000, fadeOutMs = 4000 } = {},
) {
  if (!player || typeof player.setVolume !== "function") return;
  const startVolume = Math.max(5, Math.floor(baseVolume * 0.15));
  smoothFade(player, startVolume, baseVolume, fadeInMs);

  // Jika ada lagu di antrean berikutnya, hitung beatmatching transisi crossfade adaptif
  let targetFadeOutMs = fadeOutMs;
  if (player.queue && player.queue.length > 0) {
    const nextTrack = player.queue[0];
    const match = calculateBeatmatchedCrossfade(track, nextTrack);
    targetFadeOutMs = match.crossfadeMs;
  }

  startFadeOutWatcher(player, track, baseVolume, targetFadeOutMs);
}

function clearTransitionTimers(player) {
  if (!player) return;
  if (player._fadeInterval) {
    clearInterval(player._fadeInterval);
    player._fadeInterval = null;
  }
  if (player._endWatcher) {
    clearInterval(player._endWatcher);
    player._endWatcher = null;
  }
}

module.exports = {
  rankAutoplayCandidates,
  smoothFade,
  estimateTrackBpm,
  calculateBeatmatchedCrossfade,
  startFadeOutWatcher,
  beginPlaybackTransition,
  clearTransitionTimers,
};
