const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const UserLeveling = require("../../src/models/UserLeveling");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const PLAYLISTS = [
  "https://open.spotify.com/playlist/37i9dQZF1DXbeUHea2S5Lg",
  "https://open.spotify.com/playlist/37i9dQZF1DXd2tK8LXXI4B",
  "https://open.spotify.com/playlist/37i9dQZF1DX5cO1uP1xC1g",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trivia-music")
    .setDescription(
      "Tebak lagu! Dengarkan 10 detik pertama dan tebak judulnya.",
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      const errPayload = buildErrorContainerV2({
        title: "Koneksi Gagal",
        description:
          "❌ Kamu harus berada di Voice Channel untuk bermain Trivia.",
        footerText: ui.getFooter("music"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();
    const guildId = interaction.guildId;
    const poru = interaction.client.musicManager.poru;

    let player = poru.players.get(guildId);
    if (player && player.isPlaying) {
      const errPayload = buildErrorContainerV2({
        title: "Sistem Sibuk",
        description:
          "❌ Naura sedang memutar musik. Hentikan musik terlebih dahulu untuk bermain Trivia.",
        footerText: ui.getFooter("music"),
      });
      return interaction.editReply(errPayload);
    }

    if (!player) {
      player = poru.createConnection({
        guildId,
        voiceChannel: voiceChannel.id,
        textChannel: interaction.channel.id,
        deaf: true,
      });
    }

    const playlistUrl = PLAYLISTS[Math.floor(Math.random() * PLAYLISTS.length)];
    const res = await poru.resolve({
      query: playlistUrl,
      requester: interaction.user,
    });

    if (!res || !res.tracks || res.tracks.length === 0) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Muat Playlist",
        description: "❌ Gagal memuat playlist untuk Trivia.",
        footerText: ui.getFooter("music"),
      });
      return interaction.editReply(errPayload);
    }

    const track = res.tracks[Math.floor(Math.random() * res.tracks.length)];
    player.isTrivia = true;
    await player.play(track);

    const payload = buildContainerV2({
      accentColorHex: "#ff1493",
      title: "🎵 Music Trivia!",
      description:
        "Dengarkan cuplikan lagu ini dan ketik **judul lagunya** di chat secepat mungkin!\nKamu punya waktu **15 detik**.",
      footerText: ui.getFooter("music"),
    });

    await interaction.editReply(payload);

    const filter = (m) => !m.author.bot;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 15000,
    });

    const correctAnswer = track.info.title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");
    const acceptableAnswer = correctAnswer.split(" ").slice(0, 2).join(" ");

    let winner = null;

    collector.on("collect", (m) => {
      const guess = m.content.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      if (guess.includes(acceptableAnswer)) {
        winner = m.author;
        collector.stop("answered");
      }
    });

    collector.on("end", async (collected, reason) => {
      player.stop();
      player.isTrivia = false;

      let endPayload;
      if (winner) {
        const [userLevel] = await UserLeveling.findOrCreate({
          where: { userId: winner.id, guildId },
        });
        userLevel.mannersPoint += 100;
        await userLevel.save({ fields: ["mannersPoint"] });

        endPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          title: "🎉 Ada Pemenang!",
          description: `Selamat <@${winner.id}>! Kamu berhasil menebak dengan benar.\nJudul asli: **${track.info.title}**\nArtis: **${track.info.author}**\n\n*Hadiah: +100 Manners Point*`,
          footerText: ui.getFooter("music"),
        });
      } else {
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
