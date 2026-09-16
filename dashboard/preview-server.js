/**
 * preview-server.js, Simple static server for dashboard preview
 * Serves dashboard-preview at port 3002
 * Run with: node preview-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env dari root project (dashboard-preview dijalankan dari subfolder)
try {
  const rootEnv = path.join(__dirname, '..', '.env');
  if (fs.existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
} catch (e) {
  // Node < 20.6 atau .env tidak ada, lanjut tanpa dotenv
}

const PORT = 3002;
const BASE = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.glb':  'model/gltf-binary',
  '.vrm':  'model/gltf-binary',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
};

const PAGE_MAP = {
  '/':             '/src/pages/index.html',
  '/music':        '/src/pages/music.html',
  '/leaderboard':  '/src/pages/leaderboard.html',
  '/economy':      '/src/pages/economy.html',
  '/settings':     '/src/pages/settings.html',
  '/status':       '/src/pages/status.html',
  '/soundboard':   '/src/pages/soundboard.html',
  '/world':        '/src/pages/world.html',
  '/activity':     '/src/pages/activity.html',
  '/welcomer':     '/src/pages/welcomer.html',
  '/topology':     '/src/pages/topology.html',
  '/feed':         '/src/pages/feed.html',
  '/portfolio':    '/src/pages/portfolio.html',
  '/builder':      '/src/pages/builder.html',
  '/automations':  '/src/pages/automations.html',
  '/tickets':      '/src/pages/tickets.html',
  '/karaoke':      '/src/pages/karaoke.html',
  '/jam':          '/src/pages/jam.html',
  '/survival-map': '/src/pages/survival-map.html',
};

// Also serve assets from the main dashboard's public directory as fallback
const MAIN_DASHBOARD_PUBLIC = path.join(__dirname, '..', 'dashboard', 'public');
const PREVIEW_PUBLIC = path.join(__dirname, 'public');

function serveFile(res, filePath, mime) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
    return true;
  } catch (e) {
    return null;
  }
}

const supabaseService = require('./src/api/supabaseService');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Realtime Supabase API endpoints
  if (pathname === '/api/supabase/status') {
    const data = await supabaseService.getStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/realtime/overview') {
    const data = await supabaseService.getOverview();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/realtime/leaderboard') {
    const data = await supabaseService.getLeaderboard();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/realtime/economy') {
    const data = await supabaseService.getEconomy();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/realtime/survival') {
    const data = await supabaseService.getSurvival();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/realtime/leveling') {
    const data = await supabaseService.getLeveling();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/realtime/feed') {
    const data = await supabaseService.getFeed();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Server-Sent Events (SSE) Real-Time Stream
  if (pathname === '/api/realtime/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial snapshot
    const sendSnapshot = async () => {
      try {
        const [status, overview, economy] = await Promise.all([
          supabaseService.getStatus(),
          supabaseService.getOverview(),
          supabaseService.getEconomy()
        ]);
        const payload = JSON.stringify({
          timestamp: Date.now(),
          supabase: status.supabase,
          overview: overview.data,
          economy: economy.data,
          feed: supabaseService.getFeed().data
        });
        res.write(`event: snapshot\ndata: ${payload}\n\n`);
      } catch (_) {}
    };

    await sendSnapshot();

    // Stream updates every 3.5 seconds
    const intervalId = setInterval(sendSnapshot, 3500);

    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });
    return;
  }

  // Dedicated Auth Endpoints
  if (pathname === '/api/auth/me') {
    // Ambil data user pertama (owner) dari DB
    try {
      const userData = await supabaseService.getLeveling();
      const topUser = userData?.data?.[0];
      const econData = await supabaseService.getEconomy();
      const ownerEcon = econData?.data?.userEconomy?.[0];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        authenticated: true,
        user: {
          id: topUser?.userId || '795241173009825853',
          username: topUser?.name || 'Adventurer#5853',
          displayName: topUser?.name || 'Adventurer#5853',
          role: 'Server Member',
          avatar: topUser ? `https://cdn.discordapp.com/embed/avatars/${Number(topUser.userId) % 5 || 0}.png` : '/assets/core/avatar.png',
          level: topUser?.level || 1,
          xp: topUser?.xp || 0,
          nc: ownerEcon?.wallet || 0,
          bank: ownerEcon?.bank || 0,
          nsf: 0,
          isPremium: ownerEcon?.isPremium || false,
          source: 'live_db'
        }
      }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ authenticated: false, error: 'db_error' }));
    }
    return;
  }

  if (pathname === '/auth/discord' || pathname === '/auth/login') {
    res.writeHead(302, { Location: '/?auth=success' });
    res.end();
    return;
  }

  if (pathname === '/auth/logout') {
    res.writeHead(302, { Location: '/?auth=logout' });
    res.end();
    return;
  }

  // Generic fallback for other /api and /auth
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, preview: true, data: null, message: 'Preview mode, API handled' }));
    return;
  }

  // Block socket.io (stub)
  if (pathname.startsWith('/socket.io/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
    return;
  }

  // Named pages (HTML routes)
  if (PAGE_MAP[pathname]) {
    const htmlFile = path.join(BASE, PAGE_MAP[pathname]);
    if (serveFile(res, htmlFile, 'text/html; charset=utf-8')) return;
    // Fallback: serve index
    serveFile(res, path.join(BASE, '/src/pages/index.html'), 'text/html; charset=utf-8');
    return;
  }

  // Static file from preview public first, then main dashboard public
  const ext = path.extname(pathname).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  // Try preview public
  const previewFile = path.join(PREVIEW_PUBLIC, pathname);
  if (serveFile(res, previewFile, mime)) return;

  // Try main dashboard public (for assets like /assets/core/avatar.png, /models/)
  const mainFile = path.join(MAIN_DASHBOARD_PUBLIC, pathname);
  if (serveFile(res, mainFile, mime)) return;

  // Try src/ files (for /src/css and /src/js)
  const srcFile = path.join(BASE, pathname);
  if (serveFile(res, srcFile, mime)) return;

  // Try root node_modules (for Three.js and plugins)
  if (pathname.startsWith('/node_modules/')) {
    const nmFile = path.join(BASE, '..', pathname);
    if (serveFile(res, nmFile, mime)) return;
  }

  // Try root assets/ folder (for /assets/core/avatar.png, etc.)
  if (pathname.startsWith('/assets/')) {
    const assetFile = path.join(BASE, '..', pathname);
    if (serveFile(res, assetFile, mime)) return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html><html><body style="background:#060810;color:#94a3b8;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;">
    <div style="font-size:48px;">🌸</div>
    <div style="font-size:24px;color:#f1f5f9;font-weight:700;">404, Not Found</div>
    <div style="font-size:13px;color:#475569;">${pathname}</div>
    <a href="/" style="color:#f472b6;font-size:13px;">← Kembali ke Dashboard</a>
  </body></html>`);
});

server.listen(PORT, () => {
  console.log(`\n🌸 Naura Dashboard Preview`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  🌐 URL:    http://localhost:${PORT}`);
  console.log(`  📁 Root:   dashboard-preview/`);
  console.log(`  📦 Assets: Dari main dashboard/public/`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Halaman tersedia:`);
  Object.keys(PAGE_MAP).forEach(route => {
    const file = PAGE_MAP[route];
    const exists = fs.existsSync(path.join(BASE, file));
    console.log(`    ${exists ? '✅' : '⬜'} ${route.padEnd(20)} → ${file}`);
  });
  console.log(`\n  Tekan Ctrl+C untuk berhenti.\n`);
});
