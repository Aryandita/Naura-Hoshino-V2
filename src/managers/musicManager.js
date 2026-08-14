// Lokasi: src/managers/musicManager.js
const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const ui = require("../config/ui");

// poru menarik klien WebSocket beserta seluruh mesin pemutarnya saat di-require.
// Sebelumnya biaya itu dibayar di SETIAP boot dan di setiap shard, termasuk pada
// server yang tidak pernah memutar musik sama sekali. Sekarang require ditunda
// sampai Lavalink benar-benar dinyalakan.
let PoruCtor = null;

function loadPoru() {
  if (!PoruCtor) {
    ({ Poru: PoruCtor } = require("poru"));
  }
  return PoruCtor;
}

class MusicManager {
  constructor(client) {
    this.client = client;
    this.ui = ui;
    this.uiCache = new Collection();

    // Instance Poru dibuat belakangan, bukan di constructor.
    this._poru = null;
  }

  // Banyak perintah musik membaca client.musicManager.poru. Getter ini SENGAJA tidak
  // membuat instance baru bila belum ada. index.js memeriksa properti ini saat shutdown,
  // dan membangun Poru di tengah proses mati hanya melahirkan koneksi yang tidak pernah
  // ditutup. Pemanggil yang memang perlu menyalakannya harus memakai ensurePoru().
  get poru() {
    return this._poru;
  }

  // Catatan: pemetaan di bawah masih mendukung banyak node lewat pemisah koma, tetapi
  // src/config/env.js sudah menormalkan LAVA_PORT dengan parseInt dan LAVA_SECURE
  // menjadi boolean. Jadi selama nilainya lewat env.js, isi koma hanya berdampak pada
  // LAVA_HOST dan LAVA_PASS. Ini perilaku yang ada sejak awal, bukan perubahan di sini.
  buildNodes() {
    const env = require("../config/env");

    if (env.LAVA_NODES) {
      try {
        const nodes = JSON.parse(env.LAVA_NODES);
        if (Array.isArray(nodes) && nodes.length > 0) {
          return nodes.map((node, index) => ({
            name: node.name || `Naura Node ${index + 1}`,
            host: String(node.host || "localhost").trim(),
            port: parseInt(node.port) || 2333,
            password: String(node.password || "youshallnotpass").trim(),
            secure:
              node.secure === true || String(node.secure).trim() === "true",
          }));
        }
      } catch (e) {
        console.error(
          "\x1b[41m\x1b[37m \ud83c\udfb5 MUSIC \x1b[0m \x1b[31mGagal parse LAVA_NODES, kembali ke mode fallback 1 node.\x1b[0m",
        );
      }
    }

    // Mode fallback: mendukung 1 node saja dari LAVA_HOST dkk
    return [
      {
        name: "Naura Node 1",
        host: String(env.LAVA_HOST).trim(),
        port: parseInt(env.LAVA_PORT),
        password: String(env.LAVA_PASS).trim(),
        secure: env.LAVA_SECURE,
      },
    ];
  }

  // Membuat instance Poru bila belum ada. Aman dipanggil berkali-kali.
  ensurePoru() {
    if (this._poru) return this._poru;

    const Poru = loadPoru();
    const env = require("../config/env");

    const options = {
      library: "discord.js",
      clientName: "Naura-Hoshino-Music-System/3.1",
      plugins: [],
    };

    if (env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET) {
      try {
        const { Spotify } = require("poru-spotify");
        options.plugins.push(
          new Spotify({
            clientID: env.SPOTIFY_CLIENT_ID,
            clientSecret: env.SPOTIFY_CLIENT_SECRET,
          }),
        );
      } catch (e) {
        console.error("Gagal memuat poru-spotify:", e.message);
      }
    }

    // Mode Poru dengan/tanpa plugin
    this._poru = new Poru(this.client, this.buildNodes(), options);

    return this._poru;
  }

  initialize() {
    console.log(
      "\x1b[45m\x1b[37m \ud83c\udfb5 AUDIO \x1b[0m \x1b[35mMemulai Ekosistem Lavalink (Native Mode)...\x1b[0m",
    );

    const poru = this.ensurePoru();

    const connectPoru = () => poru.init(this.client);
    if (this.client.isReady()) connectPoru();
    else this.client.once("clientReady", () => connectPoru());

    this.loadPoruEvents();
  }

  loadPoruEvents() {
    const poru = this.ensurePoru();
    const eventsPath = path.join(__dirname, "./poru_events");
    if (!fs.existsSync(eventsPath))
      fs.mkdirSync(eventsPath, { recursive: true });

    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of eventFiles) {
      const event = require(`./poru_events/${file}`);
      const eventName = file.split(".")[0];
      poru.on(eventName, (...args) => event.execute(this, ...args));
    }

    console.log(
      "\x1b[42m\x1b[30m \ud83d\udcc2 SYSTEM \x1b[0m \x1b[32m" +
        eventFiles.length +
        " Poru Events dimuat.\x1b[0m",
    );
  }

  async updatePanelEmbed(player) {
    if (!player.nowPlayingMessage || !player.generatePanelPayload) return;
    try {
      const channel = this.client.channels.cache.get(player.textChannel);
      if (!channel) return;
      const msg = await channel.messages
        .fetch(player.nowPlayingMessage)
        .catch(() => null);
      if (msg) {
        const payload = await player.generatePanelPayload(player.position);
        await msg.edit(payload).catch(() => {});
      }
    } catch (e) {}
  }
}

module.exports = MusicManager;
