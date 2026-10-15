"use strict";

/**
 * Skrip pemeliharaan sekali-pakai untuk memperbarui tautan font Google
 * dan menyuntikkan kelas animasi reveal pada halaman Dashboard Mobile.
 *
 * Dipindahkan dari dashboard/mobile/update.js ke scripts/maintenance/update.js
 * agar direktori source Vite mobile tetap bersih.
 */

const fs = require("fs");
const path = require("path");

const mobileRoot = path.resolve(__dirname, "../../dashboard/mobile");
const pagesDir = path.join(mobileRoot, "src", "pages");
const jsDir = path.join(mobileRoot, "src", "js", "pages");

const OLD_FONT =
    '<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />';
const NEW_FONT =
    '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Orbitron:wght@700;900&family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />';

// Perbarui font HTML & tambahkan kelas reveal ke section utama
fs.readdirSync(pagesDir)
    .filter((f) => f.endsWith(".html"))
    .forEach((file) => {
        if (file === "index.html") return;
        const targetFile = path.join(pagesDir, file);
        let content = fs.readFileSync(targetFile, "utf8");

        content = content.replace(OLD_FONT, NEW_FONT);
        content = content.replace(/<section([^>]*)>/g, (match, p1) => {
            if (!p1.includes("class=")) return `<section${p1} class="reveal">`;
            if (!p1.includes("reveal")) {
                return `<section${p1.replace('class="', 'class="reveal ')}>`;
            }
            return match;
        });

        fs.writeFileSync(targetFile, content, "utf8");
    });

// Perbarui berkas JS halaman untuk menginisialisasi initReveal
const revealImportLine = ["import { initReveal }", 'from "../core/reveal.js";'].join(" ");

fs.readdirSync(jsDir)
    .filter((f) => f.endsWith(".js"))
    .forEach((file) => {
        if (file === "home.js") return;
        const targetJs = path.join(jsDir, file);
        let content = fs.readFileSync(targetJs, "utf8");

        if (!content.includes("initReveal")) {
            content = content.replace(
                "// ── Init",
                `${revealImportLine}\n\n// ── Init`,
            );
            content = content.replace(
                "initBottomNav();",
                "initBottomNav();\n  initReveal();",
            );
            fs.writeFileSync(targetJs, content, "utf8");
        }
    });

console.log("[MAINTENANCE] Pembaruan HTML dan JS mobile selesai.");
