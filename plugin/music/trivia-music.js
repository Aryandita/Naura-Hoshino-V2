"use strict";

/**
 * 🎵 Music Trivia Command - Guess the Song Game - Naura Hoshino V2
 * -----------------------------------------------------------------
 * Interactive music trivia game where users guess song titles.
 * Plays 10-second clip from Spotify playlist, first correct answer wins.
 *
 * Features:
 * - Random playlist selection from curated Spotify lists
 * - 15-second guessing window with message collector
 * - Automatic winner detection and reward distribution
 * - Manners Point rewards (+100 for correct answer)
 * - Queue-safe playback (requires empty queue)
 *
 * @module plugin/music/trivia-music
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const UserLeveling = require("../../src/models/UserLeveling");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Curated Spotify playlists for trivia questions */
const PLAYLISTS = [
  "https://open.spotify.com/playlist/37i9dQZF1DXbeUHea2S5Lg",
  "https://open.spotify.com/playlist/37i9dQZF1DXd2tK8LXXI4B",
  "https://open.spotify.com/playlist/37i9dQZF1DX5cO1uP1xC1g",
];

/** Time limit for guessing in milliseconds */
const TRIVIA_TIME_LIMIT_MS = 15000;

/** Reward points for correct answer */
const TRIVIA_REWARD_POINTS = 100;

/** Number of words from title to accept as answer */
const ACCEPTABLE_ANSWER_WORDS = 2;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize text for comparison (lowercase, remove special chars).
 * @param {string} text - Raw text
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

/**
 * Build acceptable answer from track title (first N words).
 * @param {string} title - Track title
 * @returns {string} Acceptable answer string
 */
function buildAcceptableAnswer(title) {
  const normalized = normalizeText(title);
  return normalized.split(" ").slice(0, ACCEPTABLE_ANSWER_WORDS).join(" ");
}

/**
 * Award manners points to trivia winner.
 * @param {string} userId - Winner user ID
 * @param {string} guildId - Guild ID
 * @returns {Promise<void>}
 */
async function awardWinnerPoints(userId, guildId) {
  const [userLevel] = await UserLeveling.findOrCreate({
    where: { userId, guildId },
  });
  userLevel.mannersPoint += TRIVIA_REWARD_POINTS;
  await userLevel.save({ fields: ["mannersPoint"] });
}

/**
 * Build standardized error response.
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @param {boolean} [ephemeral=false] - Show only to user
 * @returns {object} Error payload
 */
function buildError(title, description, ephemeral = false) {
  const payload = buildErrorContainerV2({
    title,
    description,
    footerText: ui.getFooter("music"),
  });
  if (ephemeral) {
    payload.flags = MessageFlags.Ephemeral;
  }
  return payload;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trivia-music")
    .setDescription(
      "Tebak lagu! Dengarkan 10 detik pertama dan tebak judulnya.",
    ),

  /**
   * Execute music trivia command.
   * Sets up trivia game with message collector and reward system.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Voice channel validation
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply(
        buildError("Koneksi Gagal", "❌ Kamu harus berada di Voice Channel untuk bermain Trivia.", true),
      );
    }

    await interaction.deferReply();

    const guildId = interaction.guildId;
    const poru = interaction.client.musicManager.poru;

    // Check if player is busy
    let player = poru.players.get(guildId);
    if (player && player.isPlaying) {
      return interaction.editReply(
        buildError("Sistem Sibuk", "❌ Naura sedang memutar musik. Hentikan musik terlebih dahulu untuk bermain Trivia."),
      );
    }

    // Create player connection if needed
    if (!player) {
      player = poru.createConnection({
        guildId,
        voiceChannel: voiceChannel.id,
        textChannel: interaction.channel.id,
        deaf: true,
      });
    }

    // Select random playlist and resolve tracks
    const playlistUrl = PLAYLISTS[Math.floor(Math.random() * PLAYLISTS.length)];
    const res = await poru.resolve({
      query: playlistUrl,
      requester: interaction.user,
    });

    if (!res || !res.tracks || res.tracks.length === 0) {
      return interaction.editReply(
        buildError("Gagal Muat Playlist", "❌ Gagal memuat playlist untuk Trivia."),
      );
    }

    // Select random track and start playback
    const track = res.tracks[Math.floor(Math.random() * res.tracks.length)];
    player.isTrivia = true;
    await player.play(track);

    // Send trivia prompt
    const payload = buildContainerV2({
      accentColorHex: "#ff1493",
      title: "🎵 Music Trivia!",
      description:
        "Dengarkan cuplikan lagu ini dan ketik **judul lagunya** di chat secepat mungkin!\nKamu punya waktu **15 detik**.",
      footerText: ui.getFooter("music"),
    });

    await interaction.editReply(payload);

    // Setup message collector for answers
    const filter = (m) => !m.author.bot;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: TRIVIA_TIME_LIMIT_MS,
    });

    const acceptableAnswer = buildAcceptableAnswer(track.info.title);

    let winner = null;

    // Handle incoming guesses
    collector.on("collect", (m) => {
      const guess = normalizeText(m.content);
      if (guess.includes(acceptableAnswer)) {
        winner = m.author;
        collector.stop("answered");
      }
    });

    // Handle game end (timeout or answered)
    collector.on("end", async (collected, reason) => {
      player.stop();
      player.isTrivia = false;

      let endPayload;

      if (winner) {
        // Award points to winner
        await awardWinnerPoints(winner.id, guildId);

        endPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          title: "🎉 Ada Pemenang!",
          description: `Selamat <@${winner.id}>! Kamu berhasil menebak dengan benar.\nJudul asli: **${track.info.title}**\nArtis: **${track.info.author}**\n\n*Hadiah: +${TRIVIA_REWARD_POINTS} Manners Point*`,
          footerText: ui.getFooter("music"),
        });
      } else {
        // No winner - timeout
        endPayload = buildContainerV2({
          accentColorHex: "#ef4444",
          title: "⏰ Waktu Habis!",
          description: `Tidak ada yang berhasil menebak.\nJudul asli: **${track.info.title}**\nArtis: **${track.info.author}**`,
          footerText: ui.getFooter("music"),
        });
      }

      await interaction.followUp(endPayload);
    });
  },
};
