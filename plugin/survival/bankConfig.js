'use strict';

// Konfigurasi Naura Central Bank: pilihan deposito berjangka dan portofolio
// investasi. Dipisah dari subcommand supaya menambah produk bank tidak perlu
// menyentuh alur antarmuka.

const { FRAGMENT_PER_COIN } = require('./currency');

// Batas transaksi. Kurs resminya 1000 NSF = 1 Naura Coin, jadi setoran minimum
// disamakan dengan satu keping Coin supaya tidak ada setoran yang hangus.
const MIN_EXCHANGE_NSF = FRAGMENT_PER_COIN;
const MIN_DEPOSIT_COIN = 100;
const MIN_INVEST_COIN = 50;
const ANSWER_MS = 30000;
const COLLECTOR_MS = 180000;

const DEPOSIT_TERMS = {
    '1_month': { key: '1_month', days: 30, rate: 0.02, label: 'Bronze', name: '1 Bulan (bunga 2%)' },
    '4_months': { key: '4_months', days: 120, rate: 0.10, label: 'Silver', name: '4 Bulan (bunga 10%)' },
    '8_months': { key: '8_months', days: 240, rate: 0.20, label: 'Gold', name: '8 Bulan (bunga 20%)' },
    '12_months': { key: '12_months', days: 360, rate: 0.30, label: 'Platinum', name: '12 Bulan (bunga 30%)' }
};

// Nilai portofolio dihitung dari lama hari dalam game. Faktor sinus dipakai
// supaya grafiknya naik-turun dan terasa seperti pasar sungguhan.
const INVEST_ASSETS = {
    gold: {
        id: 'gold',
        name: 'Naura Mutual Gold (Reksa Dana Emas)',
        riskLabel: 'Sangat Rendah',
        riskEmojiKey: 'diff_easy',
        desc: 'Emas berjangka yang tumbuh pelan tapi hampir tidak pernah merugi.',
        calcValue: (principal, days) => (days <= 0 ? principal : Math.floor(principal + principal * days * 0.012))
    },
    prop: {
        id: 'prop',
        name: 'Naura Property Trust (Properti)',
        riskLabel: 'Rendah',
        riskEmojiKey: 'diff_easy',
        desc: 'Kepemilikan properti desa dan kota, naik-turunnya masih wajar.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.sin(days) * 0.4 + 1.0;
            return Math.floor(principal + principal * days * 0.025 * factor);
        }
    },
    tech: {
        id: 'tech',
        name: 'Naura Tech & AI Index (Teknologi)',
        riskLabel: 'Sedang',
        riskEmojiKey: 'diff_normal',
        desc: 'Indeks teknologi dan AI Naura. Gerakannya lebih lincah.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.sin(days) * 0.8 + 0.8;
            return Math.floor(principal + principal * days * 0.04 * factor);
        }
    },
    energy: {
        id: 'energy',
        name: 'Naura Energy & Mining (Tambang & Energi)',
        riskLabel: 'Tinggi',
        riskEmojiKey: 'diff_extreme',
        desc: 'Komoditas tambang dan energi. Untungnya besar, jatuhnya juga dalam.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.cos(days) * 1.5 + 0.6;
            return Math.floor(principal + principal * days * 0.09 * factor);
        }
    },
    capital: {
        id: 'capital',
        name: 'Naura Star Capital (Modal Ventura)',
        riskLabel: 'Sangat Tinggi',
        riskEmojiKey: 'dungeon_skull',
        desc: 'Pendanaan sangat agresif. Naura sarankan pakai uang yang siap hilang.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.sin(days * 2.5) * 3.0 + 0.4;
            return Math.floor(principal + principal * days * 0.15 * factor);
        }
    }
};

const EMPTY_DEPOSIT = { amount: 0, unlockDay: null, interestRate: 0, termName: null };

function termOf(key) {
    return DEPOSIT_TERMS[key] || null;
}

function assetOf(key) {
    return INVEST_ASSETS[key] || null;
}

module.exports = {
    DEPOSIT_TERMS,
    INVEST_ASSETS,
    EMPTY_DEPOSIT,
    MIN_EXCHANGE_NSF,
    MIN_DEPOSIT_COIN,
    MIN_INVEST_COIN,
    ANSWER_MS,
    COLLECTOR_MS,
    termOf,
    assetOf
};
