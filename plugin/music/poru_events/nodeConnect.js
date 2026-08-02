// Lokasi: src/events/poru/nodeConnect.js
const GuildSettings = require('../../../src/models/GuildSettings');

module.exports = {
    async execute(manager, node) {
        // Log sukses berwarna hijau cerah
        console.log(`\x1b[42m\x1b[30m ✨ SUCCESS \x1b[0m \x1b[32mKoneksi Audio Node [${node.name}] Berhasil & Stabil.\x1b[0m`);
        
        setTimeout(async () => {
            try {
                const allSettings = await GuildSettings.findAll().catch(() => []);
                for (const guildData of allSettings) {
                    if (guildData.music?.twentyFourSeven === true) {
                        const guild = manager.client.guilds.cache.get(guildData.guildId);
                        if (guild && guild.channels.cache.has(guildData.music.voiceChannel)) {
                            manager.poru.createConnection({ 
                                guildId: guildData.guildId, 
                                voiceChannel: guildData.music.voiceChannel, 
                                textChannel: guildData.music.textChannel, 
                                deaf: true 
                            }).is247 = true;
                        }
                    }
                }
            } catch (e) {
                console.log('\x1b[41m\x1b[37m ⚠️ ERROR \x1b[0m \x1b[31mGagal memulihkan mode 24/7.\x1b[0m');
            }
        }, 5000); 
    }
};