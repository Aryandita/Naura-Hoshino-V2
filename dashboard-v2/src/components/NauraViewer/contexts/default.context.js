/**
 * default.context.js - Fallback reaktivitas standar NauraViewer.
 *
 * Konteks ini digunakan bila halaman tidak memiliki context khusus.
 * Naura hanya akan diam idle.
 */

export default function(viewer) {
    return {
        init() {
            // Set ke idle saat pertama kali load
            viewer.setMood('idle');
        },
        cleanup() {
            // Tidak ada event listener yang perlu dibersihkan
        }
    };
}
