import { defineConfig } from 'vite';
import { resolve } from 'path';

// Target backend Express saat dev. Selaras dengan env.DASHBOARD_PORT
// (default 3070) yang dibaca dashboard/server.js.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3070';

export default defineConfig({
    root: '.',
    publicDir: 'public',

    // Dilayani Express di subpath /v2 (lihat dashboard/server.js).
    // Base relatif membuat semua URL asset menunjuk relatif terhadap
    // lokasi HTML di dalam /v2, tanpa bentrok route /assets milik bot.
    // Base absolut '/v2/' terbukti merusak registry proxy HTML Vite
    // (error "No matching HTML proxy module found" yang bergeser acak).
    base: './',

    // Catatan: Tailwind diproses lewat CLI terpisah (npm run build:css),
    // bukan plugin @tailwindcss/vite, karena plugin itu bertabrakan dengan
    // <style> inline di halaman-halaman MPA ini saat build.

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            // Multi-page: satu entry per halaman
            // VITE_ONLY=<nama> untuk debug build satu halaman
            input: process.env.VITE_ONLY ? {
                [process.env.VITE_ONLY]: resolve(__dirname, `src/pages/${process.env.VITE_ONLY}.html`),
            } : {
                index:        resolve(__dirname, 'src/pages/index.html'),
                status:       resolve(__dirname, 'src/pages/status.html'),
                music:        resolve(__dirname, 'src/pages/music.html'),
                leaderboard:  resolve(__dirname, 'src/pages/leaderboard.html'),
                economy:      resolve(__dirname, 'src/pages/economy.html'),
                feed:         resolve(__dirname, 'src/pages/feed.html'),
                automations:  resolve(__dirname, 'src/pages/automations.html'),
                karaoke:      resolve(__dirname, 'src/pages/karaoke.html'),
                settings:     resolve(__dirname, 'src/pages/settings.html'),
                tickets:      resolve(__dirname, 'src/pages/tickets.html'),
                welcomer:     resolve(__dirname, 'src/pages/welcomer.html'),
                world:        resolve(__dirname, 'src/pages/world.html'),
                activity:     resolve(__dirname, 'src/pages/activity.html'),
                portfolio:    resolve(__dirname, 'src/pages/portfolio.html'),
            },
        },
        // Chunk terpisah agar model Three.js tidak disertakan di halaman yang tidak perlu
        chunkSizeWarningLimit: 2000,
    },

    server: {
        port: 3001,
        // Proxy ke server Express utama untuk API & Socket.IO.
        // Client socket.io sengaja tetap dimuat dari backend (/socket.io)
        // supaya versinya dijamin cocok dengan server.
        proxy: {
            '/api': apiTarget,
            '/auth': apiTarget,
            '/socket.io': {
                target: apiTarget,
                ws: true,
            },
            '/assets': apiTarget,
        },
    },

    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@models': resolve(__dirname, 'public/models'),
        },
    },

    // Pastikan file .glb dan .vrm bisa di-import
    assetsInclude: ['**/*.glb', '**/*.vrm', '**/*.gltf'],
});
