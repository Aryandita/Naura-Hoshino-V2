// Shim Chart.js: menyediakan global window.Chart untuk script inline
// halaman yang masih memakai pola CDN lama. Semua pemakaian di halaman
// sudah di-guard `typeof Chart !== 'undefined'`, jadi bila modul ini
// gagal dimuat, chart memang tidak muncul tapi halaman tidak crash.
import Chart from 'chart.js/auto';

window.Chart = Chart;
