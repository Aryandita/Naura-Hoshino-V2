// Lokasi: plugin/canvas/battleCanvas.js
const { createCanvas, loadImage } = require('./canvasRuntime');
const fs = require('fs');
const path = require('path');

async function drawBattle(playerInfo, enemyInfo, roundLog) {
    const canvas = createCanvas(800, 450);
    const ctx = canvas.getContext('2d');

    // 1. Gambar Background
    const ui = require('../../src/config/ui');
    const bgPath = ui.getDungeonBackground();
    let bgLoaded = false;
    try {
        if (fs.existsSync(bgPath)) {
            const bgImage = await loadImage(bgPath);
            ctx.drawImage(bgImage, 0, 0, 800, 450);
            bgLoaded = true;
        }
    } catch (err) {
        console.error('\x1b[41m\x1b[37m 💥 BattleCanvas \x1b[0m \x1b[31mGagal memuat background:', err.message, '\x1b[0m');
    }

    if (!bgLoaded) {
        // Fallback Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, 450);
        grad.addColorStop(0, '#0b0c10');
        grad.addColorStop(1, '#1f2833');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 800, 450);
    }

    // Overlay gelap transparan agar UI terlihat jelas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, 800, 450);

    // 2. Gambar Player (Kiri)
    let playerAvatar;
    try {
        playerAvatar = await loadImage(playerInfo.avatarUrl);
    } catch (e) {
        // Fallback default avatar shape
        playerAvatar = null;
    }

    // Avatar Frame & Glow (Glassmorphism Style)
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 182, 193, 0.6)'; // Pink glow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 182, 193, 0.3)';
    ctx.lineWidth = 3;
    
    // Draw Round Player Container
    ctx.beginPath();
    ctx.roundRect(40, 40, 320, 240, 20);
    ctx.fill();
    ctx.stroke();
    
    ctx.shadowBlur = 0; // Reset shadow

    // Render Avatar
    if (playerAvatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(100, 100, 45, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(playerAvatar, 55, 55, 90, 90);
        ctx.restore();
    } else {
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.arc(100, 100, 45, 0, Math.PI * 2);
        ctx.fill();
    }

    // Player Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(playerInfo.username.substring(0, 15), 160, 85);
    
    ctx.fillStyle = '#ffb6c1';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Class: ${(playerInfo.class || 'No Class').toUpperCase()}`, 160, 115);

    // HP Bar Player
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.roundRect(60, 170, 280, 20, 10);
    ctx.fill();

    const playerHpPercent = Math.max(0, Math.min(1, playerInfo.hp / playerInfo.maxHp));
    ctx.fillStyle = playerHpPercent > 0.5 ? '#2ecc71' : playerHpPercent > 0.2 ? '#f1c40f' : '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(60, 170, 280 * playerHpPercent, 20, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HP: ${playerInfo.hp}/${playerInfo.maxHp}`, 200, 185);

    // Stamina Bar Player
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.roundRect(60, 210, 280, 16, 8);
    ctx.fill();

    const playerStaminaPercent = Math.max(0, Math.min(1, playerInfo.stamina / 100));
    ctx.fillStyle = '#3498db'; // Blue for stamina
    ctx.beginPath();
    ctx.roundRect(60, 210, 280 * playerStaminaPercent, 16, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`STAMINA: ${playerInfo.stamina}/100`, 200, 222);


    // 3. Gambar Monster (Kanan)
    let monsterImage;
    const monsterType = (enemyInfo.type || 'slime').toLowerCase();
    const monsterPath = ui.getMonsterSprite(monsterType);

    try {
        if (fs.existsSync(monsterPath)) {
            monsterImage = await loadImage(monsterPath);
        }
    } catch (e) {
        console.error('\x1b[41m\x1b[37m 💥 BattleCanvas \x1b[0m \x1b[31mGagal memuat monster image:', e.message, '\x1b[0m');
    }

    // Monster Container
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(192, 132, 252, 0.6)'; // Purple glow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.3)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(440, 40, 320, 240, 20);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset

    // Draw Monster Image
    if (monsterImage) {
        ctx.drawImage(monsterImage, 460, 50, 100, 100);
    } else {
        // Fallback Shape
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(510, 100, 40, 0, Math.PI * 2);
        ctx.fill();
    }

    // Monster Info
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(enemyInfo.name.substring(0, 18), 580, 105);

    // HP Bar Monster
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.roundRect(460, 180, 280, 20, 10);
    ctx.fill();

    const enemyHpPercent = Math.max(0, Math.min(1, enemyInfo.hp / enemyInfo.maxHp));
    ctx.fillStyle = '#e74c3c'; // Always red/crimson for monsters
    ctx.beginPath();
    ctx.roundRect(460, 180, 280 * enemyHpPercent, 20, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HP: ${enemyInfo.hp}/${enemyInfo.maxHp}`, 600, 195);


    // 4. Log Panel & VS (Tengah / Bawah)
    
    // VS Badge
    ctx.fillStyle = '#ffb6c1';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', 400, 140);

    // Action Log Box (Glassmorphism)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(40, 300, 720, 110, 15);
    ctx.fill();
    ctx.stroke();

    // Text Log
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';

    const lines = roundLog.split('\n');
    let yPos = 335;
    for (const line of lines.slice(0, 3)) {
        ctx.fillText(line, 60, yPos);
        yPos += 28;
    }

    return canvas.toBuffer('image/png');
}

module.exports = { drawBattle };
