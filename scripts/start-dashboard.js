'use strict';

/**
 * Script untuk menjalankan Dashboard Naura secara mandiri di lokal
 */

const env = require('../src/config/env');
const initDashboard = require('../dashboard/server');
const { connectToDatabase } = require('../src/managers/dbManager');

async function main() {
    console.log('\n🌸 Memulai Naura Hoshino Web Dashboard di Lokal...\n');

    // 1. Hubungkan database
    try {
        await connectToDatabase();
        console.log('✅ Database terkoneksi.');
    } catch (e) {
        console.warn('⚠️ Database gagal, menggunakan fallback:', e.message);
    }

    // 2. Mock Client untuk telemetri
    const mockClient = {
        uptime: 3600000,
        ws: { ping: 28 },
        guilds: {
            cache: {
                size: 1,
                get: () => null,
            },
        },
        users: {
            cache: new Map(),
            fetch: async () => null,
        },
        channels: {
            cache: new Map(),
        },
        user: {
            id: '1483665745727721543',
            username: 'Naura Hoshino',
            displayAvatarURL: () => '/assets/dashboard/naura.png',
        },
    };

    const mockPoru = {
        nodes: new Map([
            ['Lavalink-Primary', { isConnected: true }],
        ]),
        players: new Map(),
    };

    initDashboard(mockClient, mockPoru);

    const port = env.DASHBOARD_PORT || 3000;
    console.log(`\n✨ ===================================================`);
    console.log(`🚀 Naura Dashboard SIAP DIAKSES di Lokal:`);
    console.log(`   🔗 Dashboard Utama:   http://localhost:${port}`);
    console.log(`   🔗 Member Portfolio:  http://localhost:${port}/portfolio`);
    console.log(`   🔗 3D Model Asset:    http://localhost:${port}/assets/3d/Naura%20Hoshino%203D.glb`);
    console.log(`✨ ===================================================\n`);
}

main().catch(err => {
    console.error('Fatal error starting dashboard:', err);
});
