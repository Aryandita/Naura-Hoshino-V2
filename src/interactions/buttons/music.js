"use strict";

module.exports = [
  {
    prefix: "music_",
    label: "music-panel",
    // Penangan musik memakai pola balasannya sendiri, termasuk update() dan
    // showModal(), jadi tidak boleh di-defer dari luar.
    onError: "Terjadi kesalahan pada panel musik.",
    async handler(interaction, client) {
      const musicButtonsHandler = require("../../music/musicButtons");
      await musicButtonsHandler(interaction, client);
    },
  },
];
