#!/usr/bin/env node
'use strict';

/**
 * Audit aturan arsitektur Naura Hoshino.
 *
 * Skrip ini bersifat read-only. Tujuannya membantu review dan debugging dengan
 * mencari pola kode yang perlu diperiksa manual sebelum fitur baru ditambahkan.
 *
 * Pemakaian:
 *   node scripts/audit-repo.js
 *   node scripts/audit-repo.js --strict
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    'assets',
    'coverage',
    'dist',
    'build',
    'logs',
    'backups',
]);

const TEXT_EXTENSIONS = new Set([
    '.js',
    '.cjs',
    '.mjs',
    '.json',
    '.md',
    '.ejs',
    '.html',
    '.css',
    '.yml',
    '.yaml',
    '.example',
]);

const ALLOWED_PROCESS_ENV = new Set([
    'src/config/env.js',
    'scripts/audit-repo.js',
]);

const ALLOWED_ALTER_TABLE = new Set([
    'src/managers/dbMigrator.js',
    'scripts/audit-repo.js',
]);

const ALLOWED_EMBED_BUILDER = new Set([
    'src/utils/NauraEmbedBuilder.js',
    'scripts/audit-repo.js',
]);

const severityOrder = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

const rules = [
    {
        id: 'direct-process-env',
        severity: 'critical',
        title: 'Akses process.env langsung di luar env.js',
        description: 'Semua environment variable harus lewat src/config/env.js agar validasi dan fallback konsisten.',
        pattern: /process\.env\.[A-Z0-9_]+/g,
        ignore: (file) => ALLOWED_PROCESS_ENV.has(file),
    },
    {
        id: 'alter-table-outside-migrator',
        severity: 'critical',
        title: 'ALTER TABLE di luar dbMigrator.js',
        description: 'Migration schema harus berada di dbMigrator.js agar urutan versi aman dan mudah dilacak.',
        pattern: /ALTER\s+TABLE/gi,
        ignore: (file) => ALLOWED_ALTER_TABLE.has(file),
    },
    {
        id: 'guild-settings-direct-query',
        severity: 'high',
        title: 'GuildSettings.findOne langsung',
        description: 'Gunakan cacheManager.getGuildSettings() atau cache Redis untuk event/command yang sering dipanggil.',
        pattern: /GuildSettings\.findOne\s*\(/g,
    },
    {
        id: 'user-profile-direct-query',
        severity: 'high',
        title: 'UserProfile.findByPk langsung',
        description: 'Gunakan cacheManager.getUserProfile() kecuali ada alasan kuat dan sudah didokumentasikan.',
        pattern: /UserProfile\.findByPk\s*\(/g,
    },
    {
        id: 'module-map-set',
        severity: 'medium',
        title: 'Map/Set in-memory perlu cleanup TTL',
        description: 'Setiap Map/Set sementara harus punya mekanisme cleanup untuk mencegah memory leak.',
        pattern: /new\s+(Map|Set)\s*\(/g,
    },
    {
        id: 'embed-builder-main-response',
        severity: 'medium',
        title: 'EmbedBuilder perlu ditinjau',
        description: 'Output utama command sebaiknya memakai Components V2. Embed legacy hanya untuk loading/error sederhana.',
        pattern: /\bEmbedBuilder\b/g,
        ignore: (file) => ALLOWED_EMBED_BUILDER.has(file),
    },
    {
        id: 'hardcoded-discord-snowflake',
        severity: 'medium',
        title: 'Kemungkinan Discord ID hardcoded',
        description: 'Channel, role, dan guild ID sebaiknya disimpan di config.json atau GuildSettings.',
        pattern: /(?<![A-Za-z0-9_])\d{17,20}(?![A-Za-z0-9_])/g,
        ignore: (file) => file === 'package-lock.json',
    },
    {
        id: 'unicode-emoji-literal',
        severity: 'low',
        title: 'Emoji unicode literal perlu ditinjau',
        description: 'Untuk teks bot, prioritaskan emoji dari ui.js agar render lebih konsisten lintas device.',
        pattern: /[\u{1F300}-\u{1FAFF}]/gu,
        ignore: (file) => file.endsWith('.md') || file === 'src/config/ui.js',
    },
];

function toPosix(file) {
    return file.split(path.sep).join('/');
}

function shouldSkipDir(relDir) {
    const parts = toPosix(relDir).split('/');
    return parts.some((part) => SKIP_DIRS.has(part));
}

function collectFiles(dir, acc = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return acc;
    }

    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(ROOT, full);

        if (entry.isDirectory()) {
            if (!shouldSkipDir(rel)) collectFiles(full, acc);
            continue;
        }

        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        const isEnvExample = entry.name.startsWith('.env');
        if (!TEXT_EXTENSIONS.has(ext) && !isEnvExample) continue;

        acc.push(full);
    }

    return acc;
}

function lineNumberAt(content, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (content.charCodeAt(i) === 10) line += 1;
    }
    return line;
}

function getLine(content, index) {
    const start = content.lastIndexOf('\n', index) + 1;
    const end = content.indexOf('\n', index);
    return content.slice(start, end === -1 ? content.length : end).trim();
}

function scanFile(file) {
    const rel = toPosix(path.relative(ROOT, file));
    let content;

    try {
        content = fs.readFileSync(file, 'utf8');
    } catch {
        return [];
    }

    const findings = [];

    for (const rule of rules) {
        if (rule.ignore && rule.ignore(rel)) continue;

        const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match;
        while ((match = pattern.exec(content)) !== null) {
            findings.push({
                ruleId: rule.id,
                severity: rule.severity,
                title: rule.title,
                description: rule.description,
                file: rel,
                line: lineNumberAt(content, match.index),
                sample: getLine(content, match.index),
            });

            if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
        }
    }

    return findings;
}

function groupFindings(findings) {
    const grouped = new Map();

    for (const finding of findings) {
        const key = `${finding.severity}:${finding.ruleId}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                severity: finding.severity,
                ruleId: finding.ruleId,
                title: finding.title,
                description: finding.description,
                items: [],
            });
        }
        grouped.get(key).items.push(finding);
    }

    return [...grouped.values()].sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return a.ruleId.localeCompare(b.ruleId);
    });
}

function printReport(findings) {
    console.log('\n=== Audit Repository Naura Hoshino ===\n');

    if (findings.length === 0) {
        console.log('Bersih. Tidak ada temuan dari aturan audit saat ini.\n');
        return;
    }

    const grouped = groupFindings(findings);
    const totals = findings.reduce((acc, finding) => {
        acc[finding.severity] = (acc[finding.severity] || 0) + 1;
        return acc;
    }, {});

    console.log(
        `Ringkasan: ${findings.length} temuan `
        + `(critical: ${totals.critical || 0}, high: ${totals.high || 0}, medium: ${totals.medium || 0}, low: ${totals.low || 0})\n`
    );

    for (const group of grouped) {
        console.log(`[${group.severity.toUpperCase()}] ${group.title}`);
        console.log(`  Rule: ${group.ruleId}`);
        console.log(`  ${group.description}`);
        console.log(`  Total: ${group.items.length}`);

        for (const item of group.items.slice(0, 20)) {
            console.log(`  - ${item.file}:${item.line}  ${item.sample}`);
        }

        if (group.items.length > 20) {
            console.log(`  ... ${group.items.length - 20} temuan lain disembunyikan`);
        }
        console.log('');
    }
}

function main() {
    const files = collectFiles(ROOT);
    const findings = files.flatMap(scanFile);

    printReport(findings);

    const blocking = findings.filter((finding) => (
        finding.severity === 'critical' || finding.severity === 'high'
    ));

    if (STRICT && blocking.length > 0) {
        console.error('Gagal: mode --strict aktif dan masih ada temuan critical/high.\n');
        return 1;
    }

    return 0;
}

process.exitCode = main();
