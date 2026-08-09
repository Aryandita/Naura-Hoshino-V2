const { createCanvas } = require('./canvasRuntime');

async function generatePetCard(petInfo) {
    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext('2d');

    // Background Nature/Taman
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, '#87CEEB'); // Sky
    grad.addColorStop(0.6, '#87CEEB');
    grad.addColorStop(0.6, '#32CD32'); // Grass
    grad.addColorStop(1, '#228B22');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 300);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 392, 292);

    // Gambar Pet (Simulasi menggunakan emoji atau shape)
    // Karena kita tidak punya asset gambar pet, kita gambar slime sederhana
    ctx.beginPath();
    ctx.arc(200, 180, 50 + petInfo.level * 2, 0, Math.PI, true);
    ctx.lineTo(250 + petInfo.level * 2, 220);
    ctx.bezierCurveTo(200, 240, 150, 240, 150 - petInfo.level * 2, 220);
    ctx.closePath();

    // Warna berubah berdasarkan happiness/kelaparan
    if (petInfo.hunger < 30) {
        ctx.fillStyle = '#ff4500'; // Lapar = merah
    } else if (petInfo.happiness < 40) {
        ctx.fillStyle = '#1e90ff'; // Sedih = biru
    } else {
        ctx.fillStyle = '#ff69b4'; // Normal = pink
    }

    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.stroke();

    // Mata Pet
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(180, 160, 5, 0, Math.PI * 2);
    ctx.arc(220, 160, 5, 0, Math.PI * 2);
    ctx.fill();

    // Mulut Pet
    ctx.beginPath();
    if (petInfo.happiness > 50 && petInfo.hunger > 30) {
        ctx.arc(200, 175, 10, 0, Math.PI, false); // Senyum
    } else {
        ctx.arc(200, 180, 10, 0, Math.PI, true); // Sedih
    }
    ctx.stroke();

    // Teks Status
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';

    // Outline Teks
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(`Lv.${petInfo.level} ${petInfo.name}`, 200, 40);
    ctx.fillText(`Lv.${petInfo.level} ${petInfo.name}`, 200, 40);

    ctx.font = '18px sans-serif';
    ctx.strokeText(`Hunger: ${petInfo.hunger}% | Happy: ${petInfo.happiness}%`, 200, 270);
    ctx.fillText(`Hunger: ${petInfo.hunger}% | Happy: ${petInfo.happiness}%`, 200, 270);

    // XP Bar
    ctx.fillStyle = '#444444';
    ctx.fillRect(100, 280, 200, 10);
    ctx.fillStyle = '#00ff00';
    const xpPercent = Math.min(petInfo.xp / (petInfo.level * 100), 1);
    ctx.fillRect(100, 280, 200 * xpPercent, 10);

    return canvas.toBuffer('image/png');
}

module.exports = { generatePetCard };
