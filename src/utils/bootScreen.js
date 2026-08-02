const os = require('os');
const env = require('../config/env');

/**
 * Display the boot screen with system info
 * @param {import('discord.js').Client} client
 * @param {Object} sysStatus
 */
const displayBootScreen = (client, sysStatus) => {
    const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const usedRam = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);

    const cpuStr = os.cpus()[0].model.trim().substring(0, 48).padEnd(49);
    const ramStr = `${usedRam} GB / ${totalRam} GB`.padEnd(49);
    const platStr = `${os.platform()} ${os.arch()}`.substring(0, 48).padEnd(49);
    const tagStr = client.user ? client.user.tag.padEnd(49) : 'Naura Hoshino#0000'.padEnd(49);
    const ownerStr = 'Aryandita Praftian'.padEnd(49);

    let pingText = `🟢 ONLINE (${client.ws.ping}ms)`;
    if (pingText.length < 18) pingText = pingText.padEnd(18);

    const verStr = `v${env.BOT_VERSION || '1.2.0'}`.padEnd(13);

    console.log(`
\x1b[38;5;51m╔══════════════════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[38;5;51m║\x1b[0m \x1b[38;5;87m███╗   ██╗ █████╗ ██╗   ██╗██████╗  █████╗ \x1b[0m                          \x1b[38;5;51m║\x1b[0m
\x1b[38;5;45m║\x1b[0m \x1b[38;5;81m████╗  ██║██╔══██╗██║   ██║██╔══██╗██╔══██╗\x1b[0m                          \x1b[38;5;45m║\x1b[0m
\x1b[38;5;39m║\x1b[0m \x1b[38;5;75m██╔██╗ ██║███████║██║   ██║██████╔╝███████║\x1b[0m    \x1b[38;5;255mH O S H I N O\x1b[0m         \x1b[38;5;39m║\x1b[0m
\x1b[38;5;33m║\x1b[0m \x1b[38;5;69m██║╚██╗██║██╔══██║██║   ██║██╔══██╗██╔══██║\x1b[0m    \x1b[38;5;255m${verStr}\x1b[0m\x1b[38;5;33m║\x1b[0m
\x1b[38;5;27m║\x1b[0m \x1b[38;5;63m██║ ╚████║██║  ██║╚██████╔╝██║  ██║██║  ██║\x1b[0m                          \x1b[38;5;27m║\x1b[0m
\x1b[38;5;21m║\x1b[0m \x1b[38;5;57m╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝\x1b[0m                          \x1b[38;5;21m║\x1b[0m
\x1b[38;5;51m╠══════════════════════════════════════════════════════════════════════════╣\x1b[0m
\x1b[38;5;51m║\x1b[0m \x1b[38;5;226m✦ IDENTITAS SISTEM & HARDWARE\x1b[0m                                            \x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m├─ Nama Bot :\x1b[0m \x1b[38;5;15m${tagStr}\x1b[0m\x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m├─ Owner    :\x1b[0m \x1b[38;5;15m${ownerStr}\x1b[0m\x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m├─ Prosesor :\x1b[0m \x1b[38;5;15m${cpuStr}\x1b[0m\x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m├─ Memori   :\x1b[0m \x1b[38;5;15m${ramStr}\x1b[0m\x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m└─ Platform :\x1b[0m \x1b[38;5;15m${platStr}\x1b[0m\x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m                                                                          \x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m \x1b[38;5;226m✦ STATUS MODUL & DATABASE\x1b[0m                                                \x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m├─ Database :\x1b[0m ${sysStatus.db} \x1b[38;5;246m│ Lavalink   :\x1b[0m ${sysStatus.music}      \x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m├─ Redis    :\x1b[0m ${sysStatus.redis} \x1b[38;5;246m│ Commands   :\x1b[0m ${sysStatus.cmds}    \x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m║\x1b[0m   \x1b[38;5;246m└─ Discord  :\x1b[0m \x1b[38;5;82m${pingText}\x1b[0m \x1b[38;5;246m│ RSS Alerts :\x1b[0m ${sysStatus.rss}    \x1b[38;5;51m║\x1b[0m
\x1b[38;5;51m╚══════════════════════════════════════════════════════════════════════════╝\x1b[0m
 
\x1b[42m\x1b[30m ✨ SUCCESS \x1b[0m \x1b[32mSemua sistem siap beroperasi penuh! Naura v${env.BOT_VERSION || '1.2.0'} mengudara ^.^\x1b[0m
`);
};

module.exports = { displayBootScreen };
