'use strict';

// Alat bantu bersama untuk Meja Perakitan, Tungku Bagas, dan jalur naik level
// alat. Semuanya bekerja pada satu bentuk kebutuhan yang seragam:
// `[{ id, amount, isCore? }]` supaya pemanggil tidak perlu menebak formatnya.

const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('../canvas/canvasRuntime');
const items = require('./items');
const ui = require('../../src/config/ui');

const FONT_FILE = path.join(process.cwd(), 'assets', 'fonts', 'Inter-Bold.ttf');
try {
    if (fs.existsSync(FONT_FILE)) GlobalFonts.registerFromPath(FONT_FILE, 'Inter');
} catch (err) {
    // Font hanya pemanis; kanvas tetap tergambar dengan font bawaan sistem.
}

// Resep tungku menuliskan `coal`, sedangkan yang bisa dibuat pemain sendiri
// adalah `charcoal`. Keduanya saling menggantikan supaya arang buatan sendiri
// tidak jadi barang mati di dalam tas.
const MATERIAL_ALIAS = {
    coal: ['coal', 'charcoal'],
    charcoal: ['charcoal', 'coal']
};

function aliasesOf(id) {
    return MATERIAL_ALIAS[id] || [id];
}

function nameOf(id) {
    const found = items.find(item => item && item.id === id);
    return found ? found.name : id;
}

function e(key, fallback) {
    return ui.getEmoji(key) || fallback;
}

function matches(entry, id) {
    if (!entry) return false;
    if (typeof entry === 'string') return entry === id;
    return entry.id === id;
}

function countItem(inventory, id) {
    let total = 0;
    for (const wanted of aliasesOf(id)) {
        for (const entry of inventory) {
            if (!matches(entry, wanted)) continue;
            total += typeof entry === 'string' ? 1 : (entry.amount || 1);
        }
    }
    return total;
}

function takeItem(inventory, id, amount) {
    let left = amount;
    for (const wanted of aliasesOf(id)) {
        for (let i = inventory.length - 1; i >= 0 && left > 0; i--) {
            const entry = inventory[i];
            if (!matches(entry, wanted)) continue;

            if (typeof entry === 'string') {
                inventory.splice(i, 1);
                left -= 1;
                continue;
            }

            const owned = entry.amount || 1;
            const used = Math.min(owned, left);
            entry.amount = owned - used;
            left -= used;
            if (entry.amount <= 0) inventory.splice(i, 1);
        }
    }
    return left === 0;
}

function addItem(inventory, id, amount) {
    const existing = inventory.find(entry => entry && typeof entry !== 'string' && entry.id === id);
    if (existing) {
        existing.amount = (existing.amount || 1) + amount;
        return;
    }
    inventory.push({ id, name: nameOf(id), amount });
}

// Mengembalikan rincian per bahan supaya kanvas bisa mewarnai baris yang kurang.
function checkMaterials(inventory, requirements) {
    const lines = (requirements || []).map(req => {
        const have = countItem(inventory, req.id);
        return {
            id: req.id,
            name: nameOf(req.id),
            need: req.amount,
            have,
            ok: have >= req.amount,
            isCore: Boolean(req.isCore)
        };
    });
    return { ok: lines.every(line => line.ok), lines };
}

function takeAll(inventory, requirements) {
    for (const req of requirements || []) {
        if (!takeItem(inventory, req.id, req.amount)) return false;
    }
    return true;
}

function missingText(lines) {
    return (lines || [])
        .filter(line => !line.ok)
        .map(line => line.name + ' (' + line.have + '/' + line.need + ')')
        .join(', ');
}

async function createCraftingCanvas({ heading, target, lines = [], ready, note }) {
    const rows = Math.max(1, lines.length);
    const canvas = createCanvas(620, 200 + rows * 30);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#3E2723';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#4E342E';
    ctx.lineWidth = 2;
    for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.strokeStyle = '#271911';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.font = '22px "Inter", sans-serif';
    ctx.fillStyle = '#D7CCC8';
    ctx.fillText(heading, 24, 44);

    ctx.beginPath();
    ctx.moveTo(24, 56);
    ctx.lineTo(canvas.width - 24, 56);
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 26px "Inter", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(target, 24, 96);

    ctx.font = '18px "Inter", sans-serif';
    ctx.fillStyle = '#FFCC80';
    ctx.fillText('Bahan yang Naura butuhkan:', 24, 132);

    let y = 164;
    if (lines.length === 0) {
        ctx.fillStyle = '#D7CCC8';
        ctx.fillText('Tidak ada bahan tambahan.', 36, y);
    }
    for (const line of lines) {
        ctx.fillStyle = line.ok ? '#A5D6A7' : '#EF9A9A';
        ctx.font = (line.isCore ? 'bold ' : '') + '18px "Inter", sans-serif';
        const suffix = line.isCore ? '   (bahan inti)' : '';
        ctx.fillText(line.name + '   ' + line.have + ' / ' + line.need + suffix, 36, y);
        y += 30;
    }

    ctx.font = 'bold 20px "Inter", sans-serif';
    ctx.fillStyle = ready ? '#81C784' : '#E57373';
    const fallbackNote = ready ? 'Bahannya lengkap! Ayo Naura kerjakan sekarang.' : 'Bahannya masih kurang, ya. Naura tunggu, kok.';
    ctx.fillText(note || fallbackNote, 24, canvas.height - 26);

    return canvas.toBuffer('image/png');
}

module.exports = {
    MATERIAL_ALIAS,
    aliasesOf,
    nameOf,
    e,
    countItem,
    takeItem,
    addItem,
    checkMaterials,
    takeAll,
    missingText,
    createCraftingCanvas
};
