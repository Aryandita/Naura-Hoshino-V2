"use strict";

const { SlashCommandBuilder } = require("discord.js");
const ui = require("../../src/config/ui");
const env = require("../../src/config/env");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { cleanArtistName } = require("../../src/music/spotifyResolver");
const { formatDuration } = require("./helpers/musicShared");

const subcommands = new Map();
const registerSubcommands = (mod) => {
  for (const [name, fn] of Object.entries(mod)) {
    subcommands.set(name, fn);
  }
};

registerSubcommands(require("./subcommands/profileStats"));
registerSubcommands(require("./subcommands/playEngine"));
registerSubcommands(require("./subcommands/playbackControls"));
registerSubcommands(require("./subcommands/playlistEngine"));
registerSubcommands(require("./subcommands/musicFeatures"));

async function runMusicLogic(
  client,
  user,
  member,
  guild,
  channel,
  subcommand,
  args,
  sendReply,
  isSlash,
  deleteReply,
) {
  const poru = client.musicManager.poru;
  const musicManager = client.musicManager;
  const memberVoice = member?.voice?.channel;
  const eError = ui.getEmoji("error") || "❌";

  const ctx = {
    client,
    user,
    member,
    guild,
    channel,
    subcommand,
    args,
    sendReply,
    isSlash,
    deleteReply,
    poru,
    musicManager,
    memberVoice,
    player: poru.players.get(guild.id),
  };

  const noVoiceNeeded = ["profile", "aura", "wrapped"];
  if (!noVoiceNeeded.includes(subcommand)) {
    if (!memberVoice) {
      const errPayload = buildErrorContainerV2({
        title: "Koneksi Gagal",
        description: `${eError} | Anda harus berada di dalam Voice Channel terlebih dahulu!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    if (ctx.player && ctx.player.voiceChannel !== memberVoice.id) {
      const errPayload = buildErrorContainerV2({
        title: "Voice Channel Berbeda",
        description: `${eError} | Naura sedang aktif di Voice Channel lain.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  }

  const handler = subcommands.get(subcommand);
  if (!handler) {
    const errPayload = buildErrorContainerV2({
      title: "Perintah Salah",
      description: `${eError} | Perintah tidak dikenali.`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(errPayload, true);
  }

  return handler(ctx);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("Sistem musik interaktif Naura")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Putar musik dari YouTube, Spotify, atau SoundCloud")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Judul lagu atau URL link")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("pause").setDescription("Jeda musik yang sedang berputar"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("resume")
        .setDescription("Lanjutkan kembali lagu yang dijeda"),
    )
    .addSubcommand((sub) =>
      sub.setName("skip").setDescription("Lewati lagu yang sedang berputar"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("voteskip")
        .setDescription(
          "Voting bersama pendengar di voice channel untuk melewati lagu",
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("stop").setDescription("Hentikan musik dan hapus antrean"),
    )
    .addSubcommand((sub) =>
      sub.setName("queue").setDescription("Lihat daftar antrean lagu saat ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("nowplaying")
        .setDescription("Lihat informasi lagu yang sedang diputar"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("volume")
        .setDescription("Atur volume pemutaran musik")
        .addIntegerOption((opt) =>
          opt
            .setName("persen")
            .setDescription("Tingkat volume (1 - 150%)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(150),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("seek")
        .setDescription(
          "Lompat ke durasi waktu lagu tertentu (cth: 1:30 atau 90)",
        )
        .addStringOption((opt) =>
          opt
            .setName("posisi")
            .setDescription(
              "Posisi waktu tujuan (format: mm:ss, hh:mm:ss, atau detik)",
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("sleep")
        .setDescription("Atur timer tidur otomatis dengan efek audio fade-out")
        .addIntegerOption((opt) =>
          opt
            .setName("menit")
            .setDescription(
              "Durasi timer dalam menit (masukkan 0 untuk membatalkan)",
            )
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1440),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("loop")
        .setDescription("Atur mode pengulangan musik")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilih mode loop")
            .setRequired(true)
            .addChoices(
              { name: "📴 Matikan Loop (Off)", value: "off" },
              { name: "🔂 Ulangi Lagu Ini (Track)", value: "track" },
              { name: "🔁 Ulangi Seluruh Antrean (Queue)", value: "queue" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("shuffle").setDescription("Acak urutan lagu dalam antrean"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("247")
        .setDescription("Aktifkan atau matikan mode 24/7 di Voice Channel"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lyrics")
        .setDescription(
          "Cari lirik lagu yang sedang diputar atau berdasarkan judul",
        )
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Judul lagu yang ingin dicari liriknya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("filter")
        .setDescription("Terapkan efek DSP audio profesional")
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Pilih filter audio")
            .setRequired(true)
            .addChoices(
              { name: "Original (Reset)", value: "reset" },
              { name: "Bass Boost", value: "bassboost" },
              { name: "Nightcore", value: "nightcore" },
              { name: "8D Audio", value: "8d" },
              { name: "Vaporwave", value: "vaporwave" },
              { name: "Pop", value: "pop" },
              { name: "Karaoke", value: "karaoke" },
              { name: "Vibrato", value: "vibrato" },
              { name: "Tremolo", value: "tremolo" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("profile")
        .setDescription("Tampilkan kartu profil musik statistik personal kamu")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin dilihat profil musiknya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("save")
        .setDescription(
          "Simpan antrean saat ini menjadi Cloud Playlist pribadi",
        )
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Nama playlist yang ingin disimpan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("playlist")
        .setDescription("Putar salah satu Cloud Playlist milikmu")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Nama playlist yang ingin diputar")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dedicate")
        .setDescription("Kirim pesan dedikasi / ucapan lagu kepada seseorang")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin kamu tuju")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Pesan dedikasi / ucapan yang ingin disampaikan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("wrapped")
        .setDescription(
          "Lihat rekap kilas balik musik personal & server Naura Wrapped",
        )
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin dilihat rekap Wrapped-nya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("party")
        .setDescription(
          "Buka sesi Listening Party kolaboratif bersama seluruh anggota Voice",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dj")
        .setDescription(
          "🎧 Aktifkan atau kelola mode AI Smart DJ Companion (Hoshino FM)",
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilihan mode DJ")
            .setRequired(false)
            .addChoices(
              { name: "Aktifkan AI Smart DJ (On)", value: "on" },
              { name: "Matikan AI Smart DJ (Off)", value: "off" },
              { name: "Status AI Smart DJ (Status)", value: "status" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("duplicates")
        .setDescription(
          "🛡️ Smart Duplicate Track Detection di antrean lagu guild (5 lagu terakhir)",
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilihan mode anti-duplikasi")
            .setRequired(false)
            .addChoices(
              { name: "Aktifkan Anti-Duplikasi (On)", value: "on" },
              { name: "Matikan Anti-Duplikasi (Off)", value: "off" },
              { name: "Status Anti-Duplikasi (Status)", value: "status" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("aura")
        .setDescription(
          "🔮 Analisis AI Music Aura & Kartu Resonansi Kepribadian Musik Kamu",
        )
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin dianalisis Music Aura-nya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("quality")
        .setDescription(
          "🎚️ Atur kualitas format audio (Standard, HD, Lossless Hi-Fi)",
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Tingkat kualitas audio")
            .setRequired(false)
            .addChoices(
              { name: "Standard (128kbps)", value: "standard" },
              { name: "HD Audio (256kbps)", value: "hd" },
              {
                name: "Lossless Hi-Fi (384kbps FLAC/Opus)",
                value: "lossless",
              },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("cluster")
        .setDescription(
          "🌐 Lihat status kluster Lavalink dan Lossless Hi-Fi Federation",
        ),
    ),

  async autocomplete(interaction) {
    const {
      getCached,
      setCache,
      choice,
      safeRespond,
      respondWithFallback,
      truncateLabel,
    } = require("../../src/utils/autocompleteHelper");

    const focusedValue = interaction.options.getFocused();
    if (focusedValue.match(/^(https?:\/\/)?(open\.)?spotify\.com\//)) {
      return safeRespond(interaction, [
        choice("🎧 [Spotify Link] Tekan Enter untuk memutar", focusedValue),
      ]);
    }

    if (focusedValue.match(/^https?:\/\//)) {
      return safeRespond(interaction, [
        choice("🔗 [Direct URL] Tekan Enter untuk memutar link", focusedValue),
      ]);
    }

    if (!focusedValue || focusedValue.trim().length === 0) {
      return respondWithFallback(interaction, "");
    }

    const cleanQuery = focusedValue
      .replace(
        /^(sc:|ytm:|yt:|spsearch:|ytsearch:|scsearch:|ytmsearch:|amsearch:)/,
        "",
      )
      .trim();
    const fallbackChoice = {
      name: `🔎 Cari: ${truncateLabel(cleanQuery, 85)}`,
      value:
        (cleanQuery.length > 100 ? cleanQuery.substring(0, 100) : cleanQuery) ||
        focusedValue.substring(0, 100),
    };

    try {
      const manager = interaction.client.musicManager;
      if (!manager || !manager._poru) {
        return respondWithFallback(interaction, cleanQuery);
      }
      const poru = manager._poru;
      const defaultEngine = env.MUSIC_DEFAULT_SEARCH || "ytsearch";

      if (cleanQuery.length < 2) {
        const hints = [];
        const activePlayer = poru.players?.get(interaction.guildId);
        if (activePlayer && activePlayer.currentTrack) {
          const ct = activePlayer.currentTrack.info;
          const nowUri = ct.uri || `${defaultEngine}:${ct.title} ${ct.author}`;
          hints.push(
            choice(`🎵 Sedang diputar: ${ct.title} - ${ct.author}`, nowUri),
          );
        }
        hints.push(
          choice("☁️ SoundCloud (Stabil & Anti-Block)", "sc:"),
          choice("▶️ YouTube", "yt:"),
          choice("🎧 YouTube Music", "ytm:"),
          choice("🔍 Ketik nama lagu atau artis untuk mencari...", " "),
        );
        return safeRespond(interaction, hints.slice(0, 5));
      }

      const searchEngine = focusedValue.startsWith("sc:")
        ? "scsearch"
        : focusedValue.startsWith("ytm:")
          ? "ytmsearch"
          : focusedValue.startsWith("yt:")
            ? "ytsearch"
            : "spsearch";

      const cacheKey = `music:ac:${searchEngine}:${cleanQuery}`;
      const cached = getCached(cacheKey);
      if (cached) return safeRespond(interaction, cached);

      let res = await Promise.race([
        poru.resolve({
          query: `${searchEngine}:${cleanQuery}`,
          requester: interaction.user,
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 2200)),
      ]);

      if (
        searchEngine === "spsearch" &&
        (!res || !res.tracks || res.tracks.length === 0)
      ) {
        res = await Promise.race([
          poru.resolve({
            query: `ytmsearch:${cleanQuery}`,
            requester: interaction.user,
          }),
          new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
        ]);
      }

      if (!res || !res.tracks || res.tracks.length === 0) {
        return respondWithFallback(interaction, cleanQuery);
      }

      const choices = res.tracks.slice(0, 24).map((track) => {
        const title = track.info.title || "Unknown Track";
        const author = cleanArtistName(track.info.author || "Unknown Artist");
        const duration = formatDuration(track.info.length);
        const label = `${title} - ${author} (${duration})`;

        const uri = track.info.uri;
        const val =
          uri && uri.startsWith("http")
            ? uri.substring(0, 100)
            : `${searchEngine}:${title} ${author}`.substring(0, 100);

        return choice(label, val);
      });

      if (choices.length < 25) {
        choices.push(fallbackChoice);
      }

      setCache(cacheKey, choices);

      return safeRespond(interaction, choices);
    } catch {
      return respondWithFallback(interaction, cleanQuery);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    const args = {
      query: interaction.options.getString("query"),
      url: interaction.options.getString("url"),
      mode: interaction.options.getString("mode"),
      tipe: interaction.options.getString("tipe"),
      persen: interaction.options.getInteger("persen"),
      target: interaction.options.getUser("target"),
      pesan: interaction.options.getString("pesan"),
      id: interaction.options.getInteger("id"),
      ronde: interaction.options.getInteger("ronde"),
      posisi: interaction.options.getString("posisi"),
      menit: interaction.options.getInteger("menit"),
    };
    const sendReply = async (payload, autoDelete = false) => {
      const msg = await interaction.editReply(payload).catch(() => {});
      if (autoDelete && msg) {
        setTimeout(() => interaction.deleteReply().catch(() => {}), 15000);
      }
      return msg;
    };
    await runMusicLogic(
      interaction.client,
      interaction.user,
      interaction.member,
      interaction.guild,
      interaction.channel,
      subcommand,
      args,
      sendReply,
      true,
      () => interaction.deleteReply().catch(() => {}),
    );
  },

  async executePrefix(message, args, client) {
    if (!args || args.length === 0) return ui.sendError(message, "err_sys_13");
    const subcommand = args.shift().toLowerCase();
    const parsedArgs = {
      query: args.join(" "),
      url: args[0],
      persen: parseInt(args[0]),
      target: message.mentions.users.first(),
      id: parseInt(args[0]),
      mode: args[0],
      posisi: args[0],
      menit: parseInt(args[0]),
    };
    const loadingPayload = buildContainerV2({
      accentColorHex: ui.getColor("dark") || "#0b0c10",
      title: "Audio Processor",
      description: "⏳ | `Memproses sistem audio...`",
      footerText: ui.getFooter("music"),
    });
    const sentMsg = await message.reply(loadingPayload);
    const sendReply = async (payload, autoDelete = false) => {
      const msg = await sentMsg.edit(payload).catch(() => {});
      if (autoDelete && msg) {
        setTimeout(() => msg.delete().catch(() => {}), 15000);
      }
      return msg;
    };
    await runMusicLogic(
      client,
      message.author,
      message.member,
      message.guild,
      message.channel,
      subcommand,
      parsedArgs,
      sendReply,
      false,
    );
  },
};
