// Lokasi: plugin/canvas/nowplayingCanvas.js
const { createCanvas, loadImage, GlobalFonts } = require('./canvasRuntime');
const path = require('path');



async function drawNowPlayingCard(trackInfo, playbackInfo) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    const isVIP = Boolean(playbackInfo && (playbackInfo.isVIP || playbackInfo.isPremium));

    // 1. Background (Futuristic Dark Cyberpunk Gradient)
    const bgGrad = ctx.createRadialGradient(400, 150, 50, 400, 150, 450);
    bgGrad.addColorStop(0, isVIP ? '#2b1e05' : '#1a0d2e'); // Deep gold/purple center
    bgGrad.addColorStop(1, '#0b0c10'); // Dark canvas edges
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 300);

    // Neon Glow Line at the bottom
    ctx.strokeStyle = isVIP ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 182, 193, 0.4)';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = isVIP ? '#ffd700' : '#ffb6c1';
    ctx.beginPath();
    ctx.moveTo(30, 290);
    ctx.lineTo(770, 290);
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow

    // Glassmorphism Main Board
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = isVIP ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255, 182, 193, 0.15)';
    ctx.lineWidth = isVIP ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(20, 20, 760, 250, 20);
    ctx.fill();
    ctx.stroke();

    // 2. Load and draw Thumbnail (Album Art)
    let albumArt;
    let artLoaded = false;
    const thumbnailUri = trackInfo.image || trackInfo.thumbnail;

    if (thumbnailUri) {
        try {
            albumArt = await loadImage(thumbnailUri);
            artLoaded = true;
        } catch (e) {
            console.error('\x1b[41m\x1b[37m 💥 nowplayingCanvas \x1b[0m \x1b[31mGagal memuat thumbnail:', e.message, '\x1b[0m');
        }
    }

    // Draw Thumbnail Box
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 182, 193, 0.3)';
    
    // Round clipping for Album Art
    ctx.beginPath();
    ctx.roundRect(40, 45, 200, 200, 15);
    ctx.clip();

    if (artLoaded && albumArt) {
        ctx.drawImage(albumArt, 40, 45, 200, 200);
    } else {
        // Fallback: CD/Vinyl visualizer
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(40, 45, 200, 200);
        
        // Draw vinyl lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 5;
        for (let r = 20; r < 90; r += 15) {
            ctx.beginPath();
            ctx.arc(140, 145, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Center vinyl label
        ctx.fillStyle = '#ffb6c1';
        ctx.beginPath();
        ctx.arc(140, 145, 25, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0b0c10';
        ctx.beginPath();
        ctx.arc(140, 145, 8, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // 3. Track Details (Title & Author)
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';

    // Title (Outfit Bold / sans-serif)
    ctx.font = 'bold 26px "MontserratBold", "EmojiFont"';
    const rawTitle = trackInfo.title || 'Unknown Track';
    const titleText = rawTitle.length > 30 ? rawTitle.substring(0, 27) + '...' : rawTitle;
    
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffffff';
    ctx.fillText(titleText, 270, 85);
    ctx.shadowBlur = 0; // Reset

    // Artist (Outfit / Light sans-serif)
    ctx.fillStyle = '#ffb6c1';
    ctx.font = '20px "Inter", "EmojiFont"';
    const rawAuthor = trackInfo.author || 'Unknown Artist';
    const authorText = rawAuthor.length > 35 ? rawAuthor.substring(0, 32) + '...' : rawAuthor;
    ctx.fillText(authorText, 270, 125);

    // Platform Badge / Text
    ctx.fillStyle = isVIP ? '#FFD700' : 'rgba(255, 255, 255, 0.4)';
    ctx.font = '12px "InterBold", "EmojiFont"';
    const platform = (trackInfo.originalSource || trackInfo.sourceName || 'Lavalink').toUpperCase();
    const vipTag = isVIP ? ' | 💎 VIP HIGH-FIDELITY' : '';
    ctx.fillText(`TRANSMITTING VIA: ${platform}${vipTag}`, 270, 155);

    // 4. Playback Progress (Bar & Timers)
    const position = playbackInfo.position || 0;
    const duration = trackInfo.length || 1;
    const progressPercent = Math.max(0, Math.min(1, position / duration));

    // Progress Bar Background
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(270, 185, 480, 10, 5);
    ctx.fill();

    // Progress Bar Filled
    ctx.fillStyle = '#ffb6c1'; // Naura Core Pink
    ctx.beginPath();
    ctx.roundRect(270, 185, 480 * progressPercent, 10, 5);
    ctx.fill();

    // Timer Text (Orbitron / sans-serif)
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px "InterBold", "EmojiFont"';
    
    const formatDuration = (ms) => {
        if (!ms || isNaN(ms)) return '0:00';
        if (ms >= 8640000000) return '🔴 LIVE';
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    ctx.fillText(formatDuration(position), 270, 225);

    ctx.textAlign = 'right';
    ctx.fillText(formatDuration(duration), 750, 225);

    return canvas.toBuffer('image/png');
}

module.exports = { drawNowPlayingCard };
