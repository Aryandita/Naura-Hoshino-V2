// Lokasi: src/managers/musicManager.js
const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const ui = require('../config/ui');

// poru menarik klien WebSocket beserta seluruh mesin pemutarnya saat di-require.
// Sebelumnya biaya itu dibayar di SETIAP boot dan di setiap shard, termasuk pada
// server yang tidak pernah memutar musik sama sekali. Sekarang require ditunda
// sampai Lavalink benar-benar dinyalakan.
let PoruCtor = null;

function loadPoru() {
    if (!PoruCtor) {
        ({ Poru: PoruCtor } = require('poru'));
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
        const env = require('../config/env');
        const hosts = String(env.LAVA_HOST || 'localhost').split(',');
        const ports = String(env.LAVA_PORT || '2333').split(',');
        const passwords = String(env.LAVA_PASS || 'youshallnotpass').split(',');
        const secures = String(env.LAVA_SECURE || 'false').split(',');

        return hosts.map((host, index) => {
            return {
                name: `Naura Node ${index + 1}`,
                host: host.trim(),
                port: parseInt((ports[index] || ports[0]).trim()),
                password: (passwords[index] || passwords[0]).trim(),
                secure: (secures[index] || secures[0]).trim() === 'true'
            };
        });
    }

    // Membuat instance Poru bila belum ada. Aman dipanggil berkali-kali.
    ensurePoru() {
        if (this._poru) return this._poru;

        const Poru = loadPoru();

        // Mode Poru murni tanpa plugin
        this._poru = new Poru(this.client, this.buildNodes(), {
            library: 'discord.js',
            clientName: 'Naura-Hoshino-Music-System/3.1'
        });

        return this._poru;
    }

    initialize() {
        console.log('\x1b[45m\x1b[37m \ud83c\udfb5 AUDIO \x1b[0m \x1b[35mMemulai Ekosistem Lavalink (Native Mode)...\x1b[0m');

        const poru = this.ensurePoru();

        const connectPoru = () => poru.init(this.client);
        if (this.client.isReady()) connectPoru();
        else this.client.once('clientReady', () => connectPoru());

        this.loadPoruEvents();
    }

    loadPoruEvents() {
        const poru = this.ensurePoru();
        const eventsPath = path.join(__dirname, './poru_events');
        if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath, { recursive: true });

        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const event = require(`./poru_events/${file}`);
            const eventName = file.split('.')[0];
            poru.on(eventName, (...args) => event.execute(this, ...args));
        }

        console.log('\x1b[42m\x1b[30m \ud83d\udcc2 SYSTEM \x1b[0m \x1b[32m' + eventFiles.length + ' Poru Events dimuat.\x1b[0m');
    }

    async updatePanelEmbed(player) {
        if (!player.nowPlayingMessage || !player.generatePanelPayload) return;
        try {
            const channel = this.client.channels.cache.get(player.textChannel);
            if (!channel) return;
            const msg = await channel.messages.fetch(player.nowPlayingMessage).catch(() => null);
            if (msg) {
                const payload = await player.generatePanelPayload(player.position);
                await msg.edit(payload).catch(() => {});
            }
        } catch (e) {}
    }
}

module.exports = MusicManager;
