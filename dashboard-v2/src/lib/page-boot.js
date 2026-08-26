// Boot minimal untuk setiap halaman dashboard-v2.
//
// Selain titik masuk idiomatik Vite (halaman tanpa module script membuat
// ekstraksi <style> inline gagal saat build), berkas ini tempat meletakkan
// inisialisasi lintas-halaman di masa depan tanpa menyentuh script inline
// warisan yang besar.
document.documentElement.dataset.nauraV2 = '1';
