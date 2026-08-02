// Lokasi: src/managers/musicManager.js
const { Poru } = require('poru');
const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const ui = require('../../src/config/ui');
const { logError } = require('../../src/managers/logger');

class MusicManager {
    constructor(client) {
        this.client = client;
        this.ui = ui;

        const hosts = (process.env.LAVALINK_HOST || 'localhost').split(',');
        const ports = (process.env.LAVALINK_PORT || '2333').split(',');
        const passwords = (process.env.LAVALINK_PASSWORD || 'youshallnotpass').split(',');
        const secures = (process.env.LAVALINK_SECURE || 'false').split(',');

        const nodes = hosts.map((host, index) => {
            return {
                name: `Naura Node ${index + 1}`,
                host: host.trim(),
                port: parseInt((ports[index] || ports[0]).trim()),
                password: (passwords[index] || passwords[0]).trim(),
                secure: (secures[index] || secures[0]).trim() === 'true'
            };
        });

        // Mode Poru murni tanpa plugin
        this.poru = new Poru(client, nodes, {
            library: 'discord.js',
            clientName: 'Naura-Hoshino-Music-System/3.1'
        });

        this.uiCache = new Collection();
    }

    initialize() {
        console.log('\x1b[45m\x1b[37m 🎵 AUDIO \x1b[0m \x1b[35mMemulai Ekosistem Lavalink (Native Mode)...\x1b[0m');

        const connectPoru = () => this.poru.init(this.client);
        if (this.client.isReady()) connectPoru();
        else this.client.once('clientReady', () => connectPoru());

        this.loadPoruEvents();
    }

    loadPoruEvents() {
        const eventsPath = path.join(__dirname, './poru_events');
        if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath, { recursive: true });

        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const event = require(`./poru_events/${file}`);
            const eventName = file.split('.')[0];
            this.poru.on(eventName, (...args) => event.execute(this, ...args));
        }

        console.log('\x1b[42m\x1b[30m 📂 SYSTEM \x1b[0m \x1b[32m' + eventFiles.length + ' Poru Events dimuat.\x1b[0m');
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
